import 'server-only';

import type { CreatePlaceDTO, PlaceDTO } from '@aether/contract';

import { apiGet, apiPost, type ApiResult } from './api';

/**
 * The places topos knows about.
 *
 * The types come from `@aether/contract`, which is also what the api validates
 * against — so a field renamed there stops compiling here rather than becoming
 * an `undefined` the console renders as blank.
 *
 * No organization in these paths: `lib/api.ts` resolves every one against the
 * organization the person is working in.
 */

const PLACES = '/places';

export function listPlaces(): Promise<ApiResult<PlaceDTO[]>> {
  return apiGet<PlaceDTO[]>(PLACES);
}

export function createPlace(
  place: CreatePlaceDTO,
): Promise<ApiResult<PlaceDTO>> {
  return apiPost<PlaceDTO>(PLACES, place);
}

/** "52.3676, 4.8776" — enough to paste into a map. */
export function formatCoordinates(place: PlaceDTO): string {
  return `${place.lat}, ${place.lng}`;
}
