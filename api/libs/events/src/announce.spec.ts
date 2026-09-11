import { aetherEventSchema, type Actor } from '@aether-zone/organon';
import { Logger } from '@nestjs/common';

import { announce } from '@aether/events';

/**
 * The one function every announcing domain shares.
 *
 * Imported through `@aether/events` rather than a relative path, deliberately:
 * the alias is a TypeScript path mapping and Jest does not read those, so this
 * import is what proves `moduleNameMapper` was kept in step with `paths`.
 * Without it the mapping rots silently until someone finds their imports do
 * not resolve.
 */

class RecordingPublisher {
  readonly published: { routingKey: string; event: any }[] = [];

  publish(routingKey: string, event: unknown) {
    this.published.push({ routingKey, event });

    return Promise.resolve();
  }
}

class FailingPublisher {
  publish(): Promise<void> {
    return Promise.reject(new Error('the broker is down'));
  }
}

const ACTOR = { id: 'caller-1', organizationId: 'org-1' } as Actor;

const DOCUMENT = {
  '@context': { aether: 'https://aether.zone/vocab/' },
  '@id': 'urn:aether:thing:1',
  '@type': 'aether:Thing',
} as any;

const base = {
  routingKey: 'thing.created',
  type: 'aether:ResourceCreated' as const,
  subject: 'urn:aether:thing:1',
  organizationId: 'org-1',
  actor: ACTOR,
  document: DOCUMENT,
};

let publisher: RecordingPublisher;
let logger: Logger;

beforeEach(() => {
  publisher = new RecordingPublisher();
  logger = { error: jest.fn() } as unknown as Logger;
});

describe('the envelope', () => {
  it('carries the subject, the tenant and who did it', async () => {
    await announce(publisher as any, logger, base);

    const { routingKey, event } = publisher.published[0];

    expect(routingKey).toBe('thing.created');
    expect(event).toMatchObject({
      type: 'aether:ResourceCreated',
      subject: 'urn:aether:thing:1',
      organizationId: 'org-1',
      actor: { id: 'caller-1', type: 'User' },
    });
  });

  it('always states the organization', async () => {
    /*
     * Not decoration: arachni refuses to write a node it cannot scope, mneme
     * refuses to index text it cannot file, and akouo's column is NOT NULL. An
     * event without this parses fine and is dropped by everyone.
     */
    await announce(publisher as any, logger, base);

    expect(publisher.published[0].event.organizationId).toBe('org-1');
  });

  it('is one organon will accept', async () => {
    await announce(publisher as any, logger, base);

    expect(
      aetherEventSchema.safeParse(publisher.published[0].event).success,
    ).toBe(true);
  });
});

describe('a delete', () => {
  it('carries no data, because there is nothing left to describe', async () => {
    await announce(publisher as any, logger, {
      ...base,
      routingKey: 'thing.deleted',
      type: 'aether:ResourceDeleted',
      document: undefined,
    });

    expect(publisher.published[0].event).not.toHaveProperty('data');
  });

  it('drops a document even when one is handed to it', async () => {
    // organon's schema has no `data` field on that variant, so a caller that
    // passed one would produce an event every consumer refuses.
    await announce(publisher as any, logger, {
      ...base,
      type: 'aether:ResourceDeleted',
    });

    expect(publisher.published[0].event).not.toHaveProperty('data');
    expect(
      aetherEventSchema.safeParse(publisher.published[0].event).success,
    ).toBe(true);
  });
});

describe('when the broker is down', () => {
  it('logs and does not throw', async () => {
    /*
     * The record has already changed by the time this runs. Failing here would
     * tell the caller their write did not happen when it did, and leave them
     * to retry and create a second one.
     */
    await expect(
      announce(new FailingPublisher() as any, logger, base),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('urn:aether:thing:1'),
      expect.any(Error),
    );
  });

  it('names the key that could not be published', async () => {
    // So the log says which subscriber is now missing a row.
    await announce(new FailingPublisher() as any, logger, base);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('thing.created'),
      expect.any(Error),
    );
  });
});
