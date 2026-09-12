import 'server-only';

import {
  classify,
  createApiClient,
  type ApiErrorBody,
  type ApiFailure as DaimonApiFailure,
  type ApiResult as DaimonApiResult,
  type TargetResolver,
} from '@aether-zone/daimon';

import { getSession } from './auth';
import { activeOrganization } from './organizations';

const API_URL = process.env.AETHER_API_URL ?? 'http://localhost:3040';

/**
 * The aether api, called with the session's access token.
 *
 * Every route on it is guarded: organon's `PistisAuthModule` registers its JWT
 * guard as an `APP_GUARD`, so the default is closed and a controller is
 * authenticated because nobody opted it out. `/health` is the exception, and
 * deliberately so — an orchestrator without credentials still has to be able
 * to read it.
 *
 * This pointed at `LOCULUS_API_URL` and port 3111 until the api existed, which
 * is what a file copied from loculus says before anyone reconnects it. Note
 * the port has to agree with `api/.env`; the workspace reserves **3040** for
 * this api and 3042 for the console.
 */

/**
 * `noOrganization` is signed in but a member of nothing — distinct from
 * `unauthenticated`, because signing in again would not help. Someone has to
 * add them to an organization in pistis.
 */
export type ApiFailure = DaimonApiFailure<'noOrganization'>;
export type ApiResult<T> = DaimonApiResult<T, 'noOrganization'>;

/**
 * Resolves a path against the organization the person is working in.
 *
 * Every route on the api is mounted under `/organizations/:organizationId`, so
 * `apiGet('/users')` reaches `/organizations/<active>/users`. Doing it here
 * rather than at each call site is deliberate: the organization is not
 * something thirty callers should each remember to add, and the api answers
 * 403 — not 404 — for one the token does not carry, so a forgotten prefix
 * would surface as a puzzling permission error rather than a bad URL.
 *
 * Annotated rather than left to inference, so `noOrganization` is the only
 * reason added to daimon's base four.
 */
const resolve: TargetResolver<'noOrganization'> = async (path) => {
  const session = await getSession();

  if (!session) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const organization = await activeOrganization();

  if (!organization) {
    // Signed in, but pistis says they belong to nowhere. Nothing in aether
    // exists outside an organization, so there is no request to make.
    return { ok: false, reason: 'noOrganization' };
  }

  return {
    ok: true,
    url: `${API_URL}/organizations/${organization.id}${path}`,
    accessToken: session.accessToken,
  };
};

const client = createApiClient(resolve);

export const apiGet = client.get;
export const apiPost = client.post;
export const apiDelete = client.del;

/**
 * PATCH, which daimon's client does not have — it offers GET, POST, PUT,
 * DELETE and the raw escape hatch, so this is built on the last one.
 *
 * Worth keeping rather than switching the api to PUT: PUT means *replace*, and
 * a caller changing one field would then have to send the whole record back or
 * silently clear whatever it left out. That is the difference the api's
 * `updateUserSchema.partial()` exists to express.
 *
 * If a second resource needs this, it belongs in daimon rather than here.
 */
export async function apiPatch<T>(
  path: string,
  payload: unknown,
): Promise<ApiResult<T>> {
  const result = await client.raw(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return result;
  }

  const { response } = result;

  // `raw` treats any status as reached, so the status still has to be read.
  if (!response.ok) {
    return {
      ok: false,
      reason: classify(response.status),
      message: undefined,
      body: (await response.json().catch(() => null)) as ApiErrorBody | null,
    } as ApiFailure;
  }

  return { ok: true, data: (await response.json()) as T };
}
