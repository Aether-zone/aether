# @aether/contract

Types and schemas shared by `@aether/api` and `@aether/web`.

One folder per domain, matching the libraries under `api/libs`. What belongs
here is only what both sides have to agree on — the shape of a request and the
shape of a resource. Anything only the server needs stays in its library.

## Why zod rather than types

A type is erased at runtime, so an api that declared one still has to check the
body it was actually sent. Deriving the type *from* a schema means the check and
the type cannot disagree:

```ts
export const createUserSchema = userSchema.omit({ id: true });
export type CreateUserDTO = z.infer<typeof createUserSchema>;
```

The api binds the schema to a handler argument with organon's
`ZodValidationPipe`, and what reaches the method is the parsed value — unknown
keys stripped, `email` already lowercased. A console form can validate against
the same object before sending anything.

## This package is built

Unlike akouo's contract, which points `main` at its TypeScript source, this one
compiles to `dist`. akouo gets away with source because a webpack bundle
compiles it in; aether's api is compiled by `tsc` and not bundled, so at runtime
it does a real `require('@aether/contract')` — and Node cannot load a `.ts`
file.

`pnpm build` at the root therefore has to build this before the api, which it
does: pnpm orders `-r` by workspace dependency.

Relative imports carry a `.js` extension because the workspace compiles under
`nodenext`, where the extension is part of the specifier and points at the
emitted file.

## prosopone

`userSchema` — `id` (uuid), `firstName`, `lastName`, `email`, `phoneNumber`.

Three of those are stricter than they look, and each is a decision:

- **The id is not in `createUserSchema`.** The api assigns it. A caller who
  could choose one could overwrite somebody else's record by guessing it.
- **The email is lowercased** on the way in, so `Ada@Example.com` and
  `ada@example.com` are one person rather than two records nothing can join.
- **The phone number is E.164** — `+31612345678`. `06 12345678` means something
  only if you already know which country it came from, and a number that
  crosses a service boundary has left that context behind.

`updateUserSchema` is `createUserSchema.partial()`: an absent field means
"leave it alone", which is why the api exposes PATCH rather than PUT.
