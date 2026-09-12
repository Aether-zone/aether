import { Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';

import { Public } from '@aether-zone/organon';

import { FileService } from './file.service';
import { OBJECT_UPLOADED, objectUploadedSchema } from './loculus/object-events';

/**
 * loculus saying the bytes arrived, which is how a file row stops being
 * `INITIAL`.
 *
 * Until now the only thing that moved a row was the browser coming back to
 * `PATCH` it, and `FileService.markUploaded` still says so: aether took the
 * client's word and never asked whether the object was really there. The
 * failure that made that worth fixing is dull and common — the upload succeeds,
 * the tab is closed before the confirmation request goes out, and the row says
 * `INITIAL` for ever over bytes that exist and are being paid for.
 *
 * This is the other direction: the object store noticed the write, loculus
 * published it, and aether believes the store rather than the client. The HTTP
 * path stays, because it is what makes the UI update immediately, and the two
 * settle the same row idempotently — whichever arrives second finds nothing to
 * do.
 */
@Injectable()
export class ObjectUploadedListener {
  private readonly logger = new Logger(ObjectUploadedListener.name);

  constructor(private readonly files: FileService) {}

  /*
   * `@Public()` on something that is not a route: organon's JWT guard is an
   * `APP_GUARD`, and a global guard runs on every execution context — an AMQP
   * delivery included. There is no request behind one, so the token extractor
   * throws before this method is entered, the `Nack` decisions below never run,
   * and the broker redelivers for ever.
   *
   * Its own durable queue, bound to the one routing key. Not `#` like the
   * projections elsewhere: those decide from a document's `@type` because they
   * consume a shared vocabulary, whereas this is one producer's own event and
   * the key is the whole of what identifies it. Named, because an anonymous
   * queue is exclusive and vanishes with the process — it would lose every
   * upload that finished while aether was restarting, which is exactly the
   * window this exists to cover.
   */
  @Public()
  @RabbitSubscribe({
    exchange: 'aether-zone',
    routingKey: OBJECT_UPLOADED,
    queue: 'aether.object-uploaded',
    queueOptions: { durable: true },
  })
  async handle(message: unknown): Promise<Nack | undefined> {
    const parsed = objectUploadedSchema.safeParse(message);

    if (!parsed.success) {
      /*
       * Dropped rather than requeued: it will not become valid on a second
       * reading, and `Nack(true)` on what can never succeed is a loop that
       * takes the queue down with it. Logged at warn rather than debug — unlike
       * a `#` subscription, everything arriving here was addressed to us, so a
       * message that does not fit means the two ends have drifted apart.
       */
      this.logger.warn(
        `Ignoring a malformed "${OBJECT_UPLOADED}": ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`,
      );

      return new Nack(false);
    }

    const { objectKey } = parsed.data;

    try {
      const file = await this.files.markUploadedByKey(objectKey);

      if (!file) {
        /*
         * Not aether's object. The bucket is shared with every other service
         * that stores through loculus, so this is the ordinary path for most of
         * what arrives here rather than a problem — hence debug.
         */
        this.logger.debug(`No file recorded for "${objectKey}"`);

        return undefined;
      }

      this.logger.log(`File ${file.id} confirmed uploaded`);

      return undefined;
    } catch (cause) {
      /*
       * The database failed, which may well be temporary — so this one *is*
       * requeued. The write is idempotent on the key, so a redelivery settles
       * the same row or finds it already settled.
       */
      this.logger.error(
        `"${objectKey}" arrived but the file could not be settled; requeuing`,
        cause,
      );

      return new Nack(true);
    }
  }
}
