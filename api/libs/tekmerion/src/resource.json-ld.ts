import type {
  RelationTargetDTO,
  RelationTargetKind,
  ResourceDTO,
  ResourceType,
} from '@aether/contract';
import type { JsonLdDocument } from '@aether-zone/organon';

/**
 * A resource as the rest of aether-zone sees it.
 *
 * Not `ResourceDTO`. That one is aether's HTTP shape, and putting it on the
 * bus would make every consumer depend on this api's idea of a resource. This
 * is the same artefact described in a vocabulary anything can read, keyed by
 * an IRI rather than a bare uuid.
 */

/** The vocabulary aether-zone publishes under. */
export const AETHER_VOCAB = 'https://aether.zone/vocab/';

/**
 * The context every resource document carries.
 *
 * Inline rather than a URL: a remote context has to be fetched before a
 * document can be read, which would turn every consumer into an HTTP client
 * and this service into their dependency.
 */
export const RESOURCE_CONTEXT = {
  aether: AETHER_VOCAB,
  title: 'aether:title',
  description: 'aether:description',
  content: 'aether:content',
  url: 'aether:url',
  sourceType: 'aether:sourceType',
  sourceId: 'aether:sourceId',
  sourceName: 'aether:sourceName',
  externalId: 'aether:externalId',
  tags: 'aether:tag',
  involves: 'aether:involves',
  /*
   * The relation predicates.
   *
   * `relatedTo` maps to `aether:related_to` rather than `aether:relatedTo`
   * because arachni names an edge from the predicate's local name: it strips
   * everything but letters, digits and underscore and upper-cases the rest, so
   * the camelCase spelling would arrive as `RELATEDTO`. The underscore is what
   * makes the edge read `RELATED_TO` in Cypher. The field itself stays
   * camelCase, like every other field in this contract.
   */
  about: 'aether:about',
  relatedTo: 'aether:related_to',
  mentions: 'aether:mentions',
} as const;

/**
 * The kind, as a second `@type` rather than a property.
 *
 * The same choice chronos makes for an event's kind, and for the same payoff:
 * a consumer building a graph gets an `:Email` or a `:Transcript` node it can
 * match on directly, instead of every artefact being a `:Resource` that has to
 * be filtered by a property afterwards.
 */
const KIND_TYPES: Record<ResourceType, string> = {
  NOTE: 'aether:Note',
  DOCUMENT: 'aether:Document',
  FILE: 'aether:File',
  WEB_PAGE: 'aether:WebPage',
  EMAIL: 'aether:Email',
  CONVERSATION: 'aether:Conversation',
  AUDIO: 'aether:Audio',
  VIDEO: 'aether:Video',
};

export interface ResourceJsonLD extends JsonLdDocument {
  '@type': string[];
  '@context': typeof RESOURCE_CONTEXT;

  title?: string;
  description?: string;
  content?: string;
  url?: string;
  sourceType?: string;
  sourceId?: string;
  sourceName?: string;
  externalId?: string;
  tags?: string[];
  involves?: { '@id': string }[];

  about?: { '@id': string }[];
  relatedTo?: { '@id': string }[];
  mentions?: { '@id': string }[];
}

/**
 * The IRI a resource is known by outside aether.
 *
 * A URN rather than a URL: it names the resource without promising anything
 * answers if you fetch it, which is the honest claim for an id on a bus. Note
 * that this is distinct from the resource's own `url`, which is where the
 * artefact came from and may well answer.
 */
export const resourceIri = (id: string): string => `urn:aether:resource:${id}`;

/**
 * The IRI prosopone knows a person by.
 *
 * Restated rather than imported from `@aether/prosopone`, which would make
 * tekmerion depend on another domain for one string. The rule is the shared
 * one every service mints people under, so the two agreeing is the point.
 */
const personIri = (id: string): string => `urn:aether:person:${id}`;

/**
 * The IRI each kind of relation target is known by.
 *
 * Restated here for the same reason as `personIri` above, and every one of
 * them matches the function that domain already mints with — prosopone's
 * `groupIri`, telos's `ideaIri`, `goalIri`, `projectIri` and `taskIri`. That
 * agreement is the entire value of the feature: a reference has to land on the
 * node telos already published, and a scheme invented here would produce a
 * second node beside it, related to nothing. akouo's `meeting.json-ld.ts`
 * carries the note on having made that mistake with people and undone it.
 *
 * A total record rather than a switch with a default, so adding a kind to
 * `RELATION_TARGET_KINDS` fails to compile here until it has an IRI.
 */
const TARGET_IRI: Record<RelationTargetKind, (id: string) => string> = {
  PERSON: personIri,
  GROUP: (id) => `urn:aether:group:${id}`,
  PROJECT: (id) => `urn:aether:project:${id}`,
  GOAL: (id) => `urn:aether:goal:${id}`,
  TASK: (id) => `urn:aether:task:${id}`,
  IDEA: (id) => `urn:aether:idea:${id}`,
};

/**
 * A relation array as JSON-LD references.
 *
 * **Bare `{'@id': …}` and nothing else, deliberately.** arachni reads an
 * object with more than an `@id` as a resource *defined inside* this document,
 * marks it `PART_OF`, and deletes it when the resource is deleted. A person a
 * document merely mentions must outlive the document mentioning them.
 *
 * The nodes need not exist yet: arachni merges on the IRI, so a reference
 * stands up a placeholder that prosopone or telos fills in when it announces
 * the thing — or never, in which case the edge still records truthfully what
 * this resource points at.
 */
const targetRefs = (targets: RelationTargetDTO[]) =>
  targets.map((target) => ref(TARGET_IRI[target.kind](target.id)));

/** A pointer at a resource described elsewhere. */
const ref = (iri: string) => ({ '@id': iri });

/**
 * A resource as a JSON-LD document.
 *
 * **`content` travels with the event**, and that is the one decision here
 * worth arguing. It makes these the largest messages on the bus — a transcript
 * is not small — and arachni will write it as a node property it has no use
 * for. The alternative is worse: mneme exists to index what a resource says,
 * and an event without the text would send every consumer back to this api to
 * ask, which is precisely the coupling a shared vocabulary removes. If the
 * size becomes the problem it may well become, the fix is a content *reference*
 * here and a fetch by those who want it — not a second event carrying the text.
 *
 * The source is flattened into three fields rather than nested. A nested
 * object with no `@id` is not a resource in JSON-LD, it is a blank node —
 * arachni would give it an invented identity and relate the resource to a node
 * nothing else can ever match. Flat properties say the same thing without
 * claiming the source is a thing in its own right, which it is not yet.
 *
 * `metadata` is deliberately absent: it holds whatever the source wanted to
 * keep, in no agreed vocabulary, so publishing it would put arbitrary keys
 * into a shared graph. It stays available over HTTP to anything that knows
 * what it means.
 */
export function toResourceDocument(resource: ResourceDTO): ResourceJsonLD {
  return {
    '@context': RESOURCE_CONTEXT,
    '@id': resourceIri(resource.id),
    '@type': ['aether:Resource', KIND_TYPES[resource.type]],
    ...(resource.title ? { title: resource.title } : {}),
    ...(resource.description ? { description: resource.description } : {}),
    ...(resource.content ? { content: resource.content } : {}),
    ...(resource.url ? { url: resource.url } : {}),
    ...(resource.source
      ? {
          sourceType: resource.source.type,
          ...(resource.source.id ? { sourceId: resource.source.id } : {}),
          ...(resource.source.name ? { sourceName: resource.source.name } : {}),
        }
      : {}),
    ...(resource.externalId ? { externalId: resource.externalId } : {}),
    /*
     * Tags are literals, not references. A tag is a word somebody chose, not a
     * resource in its own right — minting `urn:aether:tag:graph` would invent
     * an identity nothing else can confirm, and arachni would fill the graph
     * with nodes that exist only because they were mentioned.
     */
    ...(resource.tags.length > 0 ? { tags: resource.tags } : {}),
    ...(resource.involves.length > 0
      ? { involves: resource.involves.map((id) => ref(personIri(id))) }
      : {}),
    /*
     * Omitted when empty rather than sent as `[]`, matching every other
     * optional field here: absent means "nothing stated", and an empty array
     * would have arachni write a property it then has to ignore.
     */
    ...(resource.about.length > 0 ? { about: targetRefs(resource.about) } : {}),
    ...(resource.relatedTo.length > 0
      ? { relatedTo: targetRefs(resource.relatedTo) }
      : {}),
    ...(resource.mentions.length > 0
      ? { mentions: targetRefs(resource.mentions) }
      : {}),
  };
}
