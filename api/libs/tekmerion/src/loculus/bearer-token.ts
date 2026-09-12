import { UnauthorizedException } from '@nestjs/common';

/**
 * The raw access token from an `Authorization` header.
 *
 * The guard has already verified it by the time a handler runs — what it
 * leaves behind is an `Actor`, not the credential — so the header is read
 * again here for the one thing an `Actor` cannot do: be presented to another
 * service.
 *
 * Throwing rather than returning null keeps the failure at the edge. A handler
 * reaching this without a bearer token means the route lost its guard, and a
 * request that got that far should not go on to ask loculus for anything.
 */
export function bearerToken(authorization: string | undefined): string {
  const [scheme, token] = (authorization ?? '').split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedException('No bearer token on this request.');
  }

  return token;
}
