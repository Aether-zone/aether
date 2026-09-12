import 'server-only';

import type { CreateEventDTO, EventDTO } from '@aether/contract';

import { apiGet, apiPost, type ApiResult } from './api';

/**
 * What is in the calendar.
 *
 * The types come from `@aether/contract`, which is what the api validates
 * against — so a field renamed there stops compiling here rather than becoming
 * an `undefined` the console renders as blank.
 */

const EVENTS = '/events';

export function listEvents(): Promise<ApiResult<EventDTO[]>> {
  return apiGet<EventDTO[]>(EVENTS);
}

export function createEvent(
  event: CreateEventDTO,
): Promise<ApiResult<EventDTO>> {
  return apiPost<EventDTO>(EVENTS, event);
}
