import { priorityBars, priorityWord } from '@/lib/goal-priority';

/**
 * Telos's 1–5 rank, as three bars and a word.
 *
 * Bars *and* a word, not one or the other: the bars are what the eye picks out
 * when scanning a column of rows, and the word is what makes it unambiguous
 * for anyone who has not learnt that four bars means urgent. The exact number
 * is in the tooltip, since the scale is the api's business and not the
 * reader's.
 *
 * Only the top two ranks are coloured, and only one of them is red. If every
 * level had a colour the column would be a traffic light, and the eye would
 * have to read all of them to find the one that matters.
 */
export function PriorityBars({ priority }: { priority: number }) {
  const lit = priorityBars(priority);
  const word = priorityWord(priority);
  const urgent = word === 'URGENT';
  const loud = urgent || word === 'HIGH';

  const tone = urgent
    ? 'text-destructive'
    : loud
      ? 'text-warning'
      : 'text-muted-foreground';
  const fill = urgent
    ? 'bg-destructive'
    : loud
      ? 'bg-warning'
      : 'bg-muted-foreground';

  return (
    <span
      className="inline-flex items-center gap-2"
      title={`Priority ${priority} of 5`}
    >
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={[
              'w-0.5 rounded-sm',
              bar === 1 && 'h-1.5',
              bar === 2 && 'h-2',
              bar === 3 && 'h-2.5',
              bar === 4 && 'h-3',
              bar <= lit ? fill : 'bg-border',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </span>
      <span className={`font-mono text-xs tracking-wide ${tone}`}>{word}</span>
    </span>
  );
}
