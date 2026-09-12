import { PRIORITY_MAX, PRIORITY_MIN } from '@aether/contract';

/**
 * Telos's 1–5 rank, said in words.
 *
 * The scale is five steps because five is enough to order a list and few
 * enough that people use them consistently. Words are what a *row* can carry —
 * "4" on its own means nothing without the scale beside it, where "LOW" means
 * something to someone who has never seen the field before.
 *
 * Four words over five numbers, not three: 1 and 2 are not the same claim. A
 * scale whose top step reads the same as its second has no top step, and
 * "everything urgent" is exactly what happens to a list that cannot say it.
 * The remaining pair, 4 and 5, share a word because the bottom of a scale is
 * where the distinctions stop being made carefully.
 *
 * This is a reading of the number, not a replacement for it: the number stays
 * the stored value, and this is how a row says it.
 */
export type PriorityWord = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export function priorityWord(priority: number): PriorityWord {
  if (priority <= PRIORITY_MIN) {
    return 'URGENT';
  }

  if (priority === PRIORITY_MIN + 1) {
    return 'HIGH';
  }

  return priority >= PRIORITY_MAX - 1 ? 'LOW' : 'MEDIUM';
}

/** How many of the four bars are lit. */
export function priorityBars(priority: number): number {
  return { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[priorityWord(priority)];
}

/** "September 2026" — a goal's target is a month, not a day. */
export function formatMonth(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }

  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? null
    : at.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
