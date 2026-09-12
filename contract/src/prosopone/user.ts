import { z } from 'zod';

/**
 * A person's contact details, as prosopone holds them.
 *
 * The schema is the contract: the api validates every request body against it
 * and the console can validate a form against the same object, so the two
 * cannot drift into disagreeing about what a valid user is.
 */

/** Longest a name may be. Generous — names are not a place to be clever. */
const NAME_MAX = 100;
const NOTE_MAX = 10000;

export const userSchema = z.object({
  /**
   * Assigned by the api, never by the caller. `createUserSchema` omits it for
   * exactly that reason: a client that could choose an id could overwrite
   * somebody else's record by guessing one.
   */
  id: z.uuid(),

  firstName: z
    .string()
    .trim()
    .min(1, 'A first name is required.')
    .max(NAME_MAX),
  lastName: z.string().trim().min(1, 'A last name is required.').max(NAME_MAX),

  /**
   * Lowercased on the way in, so `Ada@Example.com` and `ada@example.com` are
   * the same address rather than two people. Addresses are case-insensitive in
   * the part that matters, and storing both spellings makes duplicates that
   * nothing can join.
   */
  email: z.email('That is not an email address.').toLowerCase(),

  /**
   * E.164 — a leading `+`, country code, up to fifteen digits.
   *
   * Strict on purpose. `06 12345678` means something only if you already know
   * which country it is from, and a number that crosses a service boundary has
   * left the context that made it unambiguous. The cost is that a caller has
   * to normalise before sending; the alternative is a store full of numbers
   * nobody can dial.
   */
  phoneNumber: z.e164('Use the international format, like +31612345678.'),

  /**
   * Whatever is worth remembering about them, in free text.
   *
   * Deliberately unstructured. What a person needs to recall about somebody —
   * how they like to be contacted, what they are working through, who
   * introduced them — is not a set of fields anybody can enumerate in advance,
   * and a form that tried would collect less than a sentence does.
   */
  note: z.string().trim().max(NOTE_MAX).optional(),

  /**
   * The group they belong to, by id — a prosopone group.
   *
   * One, not many, and that is a simplification worth naming: people belong to
   * several groups in life, and this records the one that explains why they
   * are in your console. When that stops being enough the field becomes a
   * list, which is a widening rather than a rewrite.
   */
  groupId: z.uuid().optional(),
});

/**
 * What a caller may send to create one. The id is the api's to assign.
 */
export const createUserSchema = userSchema.omit({ id: true });

/**
 * What a caller may send to change one.
 *
 * Every field optional, so a caller can send only what changed rather than
 * having to read the record back and return it whole — and an absent field
 * means "leave it alone" rather than "clear it".
 */
export const updateUserSchema = createUserSchema.partial().extend({
  /*
   * Nullable, unlike the rest. A missing key already means "leave it alone",
   * so an optional-only field can be added and never taken back — and both of
   * these are things somebody will want to remove: a note that stopped being
   * true, a group somebody left.
   */
  note: z.string().trim().max(NOTE_MAX).nullable().optional(),
  groupId: z.uuid().nullable().optional(),
});

export type UserDTO = z.infer<typeof userSchema>;
export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
