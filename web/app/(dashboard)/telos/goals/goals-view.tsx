'use client';

import { Button, EmptyState, Text } from '@aether-zone/kosmos';
import type { GoalDTO, GoalStatus, UserDTO } from '@aether/contract';
import { useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';

import { GoalCard } from './goal-card';
import { NewGoalDialog } from './new-goal-dialog';
import { BOARD_ORDER, STATUSES } from './statuses';

/**
 * The goals board, grouped by state.
 *
 * Grouped rather than sorted, and that is the whole design. A goal's state is
 * not one attribute among several — it decides whether the goal is a question
 * for today at all, and a single ordered list makes the reader do that sorting
 * in their head on every visit. The counts are in the headings because "how
 * many am I actually running" is the thing a person opens this page to find
 * out, and it is not a number a list of cards gives up easily.
 *
 * An empty state prints no heading. A board of four headings and one card
 * would read as mostly-empty rather than mostly-done.
 */
export function GoalsView({
  goals,
  people,
}: {
  goals: GoalDTO[];
  people: UserDTO[];
}) {
  const [setting, setSetting] = useState(false);

  const grouped = new Map<GoalStatus, GoalDTO[]>(
    BOARD_ORDER.map((status) => [
      status,
      goals.filter((goal) => goal.status === status),
    ]),
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setSetting(true)}>
          <IoAddOutline className="size-4" aria-hidden />
          New goal
        </Button>
      </div>

      <NewGoalDialog people={people} open={setting} onOpenChange={setSetting} />

      {goals.length === 0 ? (
        <EmptyState
          title="Nothing to aim at yet"
          description="A goal is the second step in the chain: an idea becomes a goal, a goal is pursued by a project, and a project is done through tasks."
        />
      ) : (
        BOARD_ORDER.map((status) => {
          const inGroup = grouped.get(status) ?? [];

          if (inGroup.length === 0) {
            return null;
          }

          return (
            <section key={status} className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {STATUSES[status].label}
                <span aria-hidden>·</span>
                <span>{inGroup.length}</span>
              </h2>

              <ul className="grid gap-4 md:grid-cols-2">
                {inGroup.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} people={people} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Text tone="muted" size="body-small">
        {goals.length === 1 ? '1 goal' : `${goals.length} goals`}
      </Text>
    </div>
  );
}
