import type { UserDTO } from '@aether/contract';
import type { JsonLdDocument } from '@aether-zone/organon';

/**
 * A person as the rest of aether-zone sees them.
 *
 * Not `UserDTO`. That one is aether's HTTP shape, and putting it on the bus
 * would make every consumer depend on this api's idea of a user. This is the
 * same person described in a vocabulary anything can read, keyed by an IRI
 * rather than a bare uuid — which is what lets arachni relate them to a
 * meeting akouo published without either service knowing about the other.
 */

/** The vocabulary aether-zone publishes under. */
export const AETHER_VOCAB = 'https://aether.zone/vocab/';

/**
 * The context every person document carries.
 *
 * Inline rather than a URL: a remote context has to be fetched before a
 * document can be read, which would turn every consumer into an HTTP client
 * and this service into their dependency.
 */
export const PERSON_CONTEXT = {
  aether: AETHER_VOCAB,
  givenName: 'aether:givenName',
  familyName: 'aether:familyName',
  email: 'aether:email',
  telephone: 'aether:telephone',
} as const;

export interface PersonJsonLD extends JsonLdDocument {
  '@type': 'aether:Person';
  '@context': typeof PERSON_CONTEXT;

  givenName: string;
  familyName: string;
  email: string;
  telephone: string;
}

/**
 * The IRI a person is known by outside aether.
 *
 * **The same rule akouo mints participants under** — `urn:aether:person:{id}`,
 * defined in its `meeting.json-ld.ts`. That is the point: a meeting published
 * by akouo already references people by this IRI, so a person created here
 * lands on the node those references were waiting for. Changing the shape on
 * one side silently splits the graph in two.
 *
 * A URN rather than a URL: it names the resource without promising anything
 * answers if you fetch it, which is the honest claim for an id on a bus.
 */
export const personIri = (id: string): string => `urn:aether:person:${id}`;

/** A user as a JSON-LD document. */
export function toPersonDocument(user: UserDTO): PersonJsonLD {
  return {
    '@context': PERSON_CONTEXT,
    '@id': personIri(user.id),
    '@type': 'aether:Person',
    givenName: user.firstName,
    familyName: user.lastName,
    email: user.email,
    telephone: user.phoneNumber,
  };
}
