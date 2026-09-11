import type { ResourceDTO, ResourceType } from '@aether/contract';
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
  };
}
