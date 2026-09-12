import { z } from 'zod';

/**
 * Somewhere with a name — an office, a venue, a room.
 *
 * The schema is the contract: the api validates every request body against it
 * and the console can validate a form against the same object, so the two
 * cannot drift into disagreeing about what a valid place is.
 */

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const ADDRESS_MAX = 500;

export const placeSchema = z.object({
  /**
   * Assigned by the api, never by the caller — `createPlaceSchema` omits it
   * for the same reason it does on a user: a client that could choose an id
   * could overwrite an existing record by guessing one.
   */
  id: z.uuid(),

  name: z.string().trim().min(1, 'A name is required.').max(NAME_MAX),

  /** Optional: plenty of places are adequately described by their name. */
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),

  /**
   * The postal address, as one line of text.
   *
   * **Deliberately a string rather than a reference to an `Address`
   * resource**, even though topos models addresses separately. Two reasons to
   * revisit that: an address that changes has to be edited on every place
   * holding a copy, and nothing can ask "what else is at this address".
   * Neither matters until something needs an address on its own; when it does,
   * this becomes `addressId` and the text moves.
   */
  address: z.string().trim().min(1, 'An address is required.').max(ADDRESS_MAX),

  /**
   * Where it is, in WGS 84 degrees — the system a phone's GPS and every web
   * map already speak, so no projection is implied.
   *
   * The bounds are worth having. Latitude beyond ±90 does not exist, so a
   * value that exceeds it is usually a longitude in the wrong field — the
   * single most common way coordinates get entered wrongly, and one of the
   * few that a schema can catch. It cannot catch a *plausible* swap, where
   * both values are in range; only a map can.
   */
  lat: z.number().min(-90, 'Latitude runs from -90 to 90.').max(90, 'Latitude runs from -90 to 90.'),
  lng: z.number().min(-180, 'Longitude runs from -180 to 180.').max(180, 'Longitude runs from -180 to 180.'),
});

/** What a caller may send to create one. The id is the api's to assign. */
export const createPlaceSchema = placeSchema.omit({ id: true });

/**
 * What a caller may send to change one.
 *
 * Every field optional, so a caller can send only what moved rather than
 * reading the record back and returning it whole — and an absent field means
 * "leave it alone" rather than "clear it".
 */
export const updatePlaceSchema = createPlaceSchema.partial();

export type PlaceDTO = z.infer<typeof placeSchema>;
export type CreatePlaceDTO = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceDTO = z.infer<typeof updatePlaceSchema>;
