import 'server-only';

import { createAuth } from '@aether-zone/daimon';

/**
 * aether as an OAuth client of pistis. Configured once here; everything
 * downstream takes the session and the route handlers from this object rather
 * than reading the environment again.
 *
 * This said `loculus` in all three places until now, which meant the console
 * asked pistis for a token as another application and wrote its session under
 * that application's cookie names — and since both run on localhost, signing
 * in here signed you out of loculus. The client has to exist in pistis as
 * `aether`, with the redirect URI below.
 */
export const auth = createAuth({
  cookiePrefix: 'aether',
  clientId: 'aether',
  redirectUri: 'http://localhost:3042/api/auth/callback',
  // `organizations` is what puts the `orgs` claim on the token, which the
  // sidebar's switcher reads.
  scopes: 'profile email organizations',
});

export const getSession = auth.getSession;
