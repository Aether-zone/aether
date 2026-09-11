import type { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AETHER_SOURCE } from '@aether/contract';
import {
  EventPublisher,
  type Actor,
  type AetherEvent,
  type AetherEventType,
  type JsonLdDocument,
} from '@aether-zone/organon';

/**
 * Puts a resource change on the bus.
 *
 * One function for every domain that announces, where prosopone, topos and
 * chronos still each keep a private copy of the same forty lines. Every copy
 * is a place the `organizationId` or the delete rule below can be got wrong in
 * only one of them, which is the kind of bug that is invisible until one
 * consumer is quietly missing rows.
 *
 * It lived in `@aether/telos` first, with a note saying it belonged in a
 * shared library once a second domain needed it. Tekmerion is that domain.
 * The three older ones are unchanged: moving working code to prove a point is
 * how unrelated things break, and this is here for them when someone has
 * reason to touch them.
 */
export async function announce<D extends JsonLdDocument>(
  events: EventPublisher,
  logger: Logger,
  {
    routingKey,
    type,
    subject,
    organizationId,
    actor,
    document,
  }: {
    routingKey: string;
    type: AetherEventType;
    subject: string;
    organizationId: string;
    actor: Actor;
    /** Omitted for a delete, where there is nothing left to describe. */
    document?: D;
  },
): Promise<void> {
  const event = {
    /*
     * Overwritten before it leaves — `EventPublisher` spreads its transport
     * envelope last, so the id on the wire is the message's. Set anyway
     * because the type requires it.
     */
    id: randomUUID(),
    type,
    source: AETHER_SOURCE,
    time: new Date().toISOString(),
    subject,
    /*
     * Which tenant the resource belongs to. Not decoration: arachni refuses to
     * write a node it cannot scope, mneme refuses to index text it cannot
     * file, and akouo's `organizationId` column is NOT NULL — an event without
     * this is accepted by the schema and dropped by everyone.
     */
    organizationId,
    // A delete carries no `data`: there is nothing left to describe, and
    // organon's schema has no field for it on that variant.
    ...(type === 'aether:ResourceDeleted' ? {} : { data: document }),
    actor: { id: actor.id, type: 'User' },
  } as AetherEvent<D>;

  try {
    await events.publish(routingKey, event);
  } catch (cause) {
    /*
     * Logged and swallowed. The record has already changed, and failing the
     * request now would tell the caller their write did not happen when it
     * did — leaving them to retry and create a second one.
     */
    logger.error(
      `${subject} changed but "${routingKey}" could not be published`,
      cause,
    );
  }
}
