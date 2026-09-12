import { Nack } from '@golevelup/nestjs-rabbitmq';

import type { FileService } from './file.service';
import { ObjectUploadedListener } from './object-uploaded.listener';

/** The event as loculus publishes it, envelope included. */
const event = (over: Record<string, unknown> = {}) => ({
  objectKey: 'aether/org-1/a24b27c8-report.pdf',
  name: 'report.pdf',
  contentType: 'application/pdf',
  size: 7127,
  id: 'c0ffee00-0000-4000-8000-000000000000',
  occurredAt: '2026-09-12T06:24:19.011Z',
  ...over,
});

function harness(
  markUploadedByKey = jest.fn().mockResolvedValue({ id: 'f1' }),
) {
  const files = { markUploadedByKey } as unknown as FileService;

  return { listener: new ObjectUploadedListener(files), markUploadedByKey };
}

describe('ObjectUploadedListener', () => {
  it('settles the file the event names', async () => {
    const { listener, markUploadedByKey } = harness();

    await expect(listener.handle(event())).resolves.toBeUndefined();

    expect(markUploadedByKey).toHaveBeenCalledWith(
      'aether/org-1/a24b27c8-report.pdf',
    );
  });

  /*
   * The bucket is shared with every other service that stores through loculus,
   * so most of what arrives is somebody else's. Acknowledged, not requeued:
   * there is nothing to wait for.
   */
  it('accepts an object it has no row for', async () => {
    const { listener } = harness(jest.fn().mockResolvedValue(null));

    await expect(listener.handle(event())).resolves.toBeUndefined();
  });

  it('drops a message that is not this event rather than requeuing it', async () => {
    const { listener, markUploadedByKey } = harness();

    const result = await listener.handle({ objectKey: 42 });

    expect(result).toBeInstanceOf(Nack);
    expect((result as Nack).requeue).toBe(false);
    expect(markUploadedByKey).not.toHaveBeenCalled();
  });

  it('takes the event without its transport envelope', async () => {
    const { listener, markUploadedByKey } = harness();

    await listener.handle({
      objectKey: 'aether/org-1/a-b.pdf',
      name: 'b.pdf',
      contentType: 'application/pdf',
      size: 1,
    });

    expect(markUploadedByKey).toHaveBeenCalled();
  });

  /*
   * A database that is briefly unwell is the one failure worth retrying, and
   * the write is idempotent on the key — so a redelivery settles the same row
   * or finds it already settled.
   */
  it('requeues when the row could not be written', async () => {
    const { listener } = harness(
      jest.fn().mockRejectedValue(new Error('database is away')),
    );

    const result = await listener.handle(event());

    expect(result).toBeInstanceOf(Nack);
    expect((result as Nack).requeue).toBe(true);
  });
});
