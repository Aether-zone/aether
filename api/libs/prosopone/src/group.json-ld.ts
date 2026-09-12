import type { GroupDTO } from '@aether/contract';
import type { JsonLdDocument } from '@aether-zone/organon';

/**
 * A group as the rest of aether-zone sees it.
 *
 * Not `GroupDTO`. That one is aether's HTTP shape, and putting it on the bus
 * would make every consumer depend on this api's idea of a group. This is the
 * same group described in a vocabulary anything can read, keyed by an IRI
 * rather than a bare uuid.
 */

/** The vocabulary aether-zone publishes under. */
export const AETHER_VOCAB = 'https://aether.zone/vocab/';

/**
 * The context every group document carries.
 *
 * Inline rather than a URL: a remote context has to be fetched before a
 * document can be read, which would turn every consumer into an HTTP client
 * and this service into their dependency.
 */
export const GROUP_CONTEXT = {
  aether: AETHER_VOCAB,
  name: 'aether:name',
  description: 'aether:description',
  groupType: 'aether:groupType',
} as const;

export interface GroupJsonLD extends JsonLdDocument {
  '@type': 'aether:Group';
  '@context': typeof GROUP_CONTEXT;

  name: string;
  description?: string;
  groupType?: string;
}

/**
 * The IRI a group is known by outside aether.
 *
 * A URN rather than a URL: it names the group without promising anything
 * answers if you fetch it, which is the honest claim for an id on a bus.
 *
 * `urn:aether:group:` and not `urn:aether:group:` — an IRI is the one
 * thing here that outlives a rename, because consumers store it. Getting it
 * wrong now would mean either living with the wrong word forever or migrating
 * other people's databases later.
 */
export const groupIri = (id: string): string => `urn:aether:group:${id}`;

/**
 * A group as a JSON-LD document.
 *
 * `groupType` rather than `type`, because `@type` already means something in
 * JSON-LD — the classes a node has — and a property called `type` beside it is
 * a trap for anyone reading the document rather than the schema.
 *
 * Optional fields are omitted when absent rather than sent as null: absent
 * means "not stated", where null would assert the group has no kind.
 */
export function toGroupDocument(group: GroupDTO): GroupJsonLD {
  return {
    '@context': GROUP_CONTEXT,
    '@id': groupIri(group.id),
    '@type': 'aether:Group',
    name: group.name,
    ...(group.description ? { description: group.description } : {}),
    ...(group.type ? { groupType: group.type } : {}),
  };
}
