import type { PlaceDTO } from '@aether/contract';
import type { JsonLdDocument } from '@aether-zone/organon';

/**
 * A place as the rest of aether-zone sees it.
 *
 * Not `PlaceDTO`. That one is aether's HTTP shape, and putting it on the bus
 * would make every consumer depend on this api's idea of a place. This is the
 * same somewhere described in a vocabulary anything can read, keyed by an IRI
 * rather than a bare uuid — which is what lets akouo record it, or arachni
 * relate a meeting to it, without either knowing where it came from.
 */

/** The vocabulary aether-zone publishes under. */
export const AETHER_VOCAB = 'https://aether.zone/vocab/';

/**
 * The context every place document carries.
 *
 * Inline rather than a URL: a remote context has to be fetched before a
 * document can be read, which would turn every consumer into an HTTP client
 * and this service into their dependency.
 */
export const PLACE_CONTEXT = {
  aether: AETHER_VOCAB,
  name: 'aether:name',
  description: 'aether:description',
  address: 'aether:address',
  latitude: 'aether:latitude',
  longitude: 'aether:longitude',
} as const;

export interface PlaceJsonLD extends JsonLdDocument {
  '@type': 'aether:Place';
  '@context': typeof PLACE_CONTEXT;

  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
}

/**
 * The IRI a place is known by outside aether.
 *
 * A URN rather than a URL: it names the resource without promising anything
 * answers if you fetch it, which is the honest claim for an id on a bus.
 */
export const placeIri = (id: string): string => `urn:aether:place:${id}`;

/**
 * A place as a JSON-LD document.
 *
 * `latitude`/`longitude` rather than the DTO's `lat`/`lng`: the abbreviations
 * are aether's own shorthand, and a consumer reading a shared vocabulary
 * should not have to guess at them. `description` is omitted when absent
 * rather than sent as null — absent means "not stated", where null would
 * assert that the place has no description.
 */
export function toPlaceDocument(place: PlaceDTO): PlaceJsonLD {
  return {
    '@context': PLACE_CONTEXT,
    '@id': placeIri(place.id),
    '@type': 'aether:Place',
    name: place.name,
    ...(place.description ? { description: place.description } : {}),
    address: place.address,
    latitude: place.lat,
    longitude: place.lng,
  };
}
