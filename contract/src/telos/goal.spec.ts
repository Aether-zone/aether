import { createGoalSchema, goalSchema, updateGoalSchema } from './goal.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Ship the console',
  description: 'End to end, with people using it.',
  status: 'ACTIVE',
  startsAt: '2026-01-01T09:00:00.000Z',
  targetAt: '2026-03-31T23:59:00.000Z',
  inspiredBy: [],
  progress: 0,
  involves: [],
  realizedBy: [],
  sources: [],
  scheduled: [],
  createdAt: '2025-12-01T09:00:00.000Z',
  updatedAt: '2025-12-01T09:00:00.000Z',
};

describe('a goal', () => {
  it('accepts a complete record', () => {
    expect(goalSchema.parse(valid)).toEqual(valid);
  });

  it('needs nothing but a title and a status', () => {
    const { description: _d, startsAt: _s, targetAt: _t, ...rest } = valid;

    expect(goalSchema.safeParse(rest).success).toBe(true);
  });

  it('refuses a title that is only whitespace', () => {
    expect(goalSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
  });

  it('knows the four states, and nothing else', () => {
    for (const status of ['PLANNED', 'ACTIVE', 'COMPLETED', 'ABANDONED']) {
      expect(goalSchema.safeParse({ ...valid, status }).success).toBe(true);
    }

    expect(goalSchema.safeParse({ ...valid, status: 'PENDING' }).success).toBe(
      false,
    );
  });

  it('separates what is planned from what is live', () => {
    /*
     * The distinction a board is read for: "what am I working on" and "what
     * have I merely agreed to" are two different piles, and the dates cannot
     * tell them apart — a goal can be scheduled and untouched at once.
     */
    expect(goalSchema.parse({ ...valid, status: 'PLANNED' }).status).toBe(
      'PLANNED',
    );
  });

  it('takes ISO strings, not Dates', () => {
    expect(
      goalSchema.safeParse({ ...valid, targetAt: new Date() }).success,
    ).toBe(false);
  });
});

describe('the dates', () => {
  it('allows a target with no start', () => {
    // The common case: "by the end of the quarter" says everything that
    // matters.
    const { startsAt: _omitted, ...rest } = valid;

    expect(goalSchema.safeParse(rest).success).toBe(true);
  });

  it('allows a start with no target', () => {
    // A commitment without a deadline — real, and slightly uncomfortable to
    // record, which is the point of allowing it.
    const { targetAt: _omitted, ...rest } = valid;

    expect(goalSchema.safeParse(rest).success).toBe(true);
  });

  it('refuses a target before the start, when both are given', () => {
    const result = goalSchema.safeParse({
      ...valid,
      targetAt: '2025-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/due before it starts/);
  });

  it('refuses a target exactly at the start', () => {
    expect(
      goalSchema.safeParse({ ...valid, targetAt: valid.startsAt }).success,
    ).toBe(false);
  });

  it('compares them as strings, which is exact for ISO in UTC', () => {
    expect(
      goalSchema.safeParse({
        ...valid,
        startsAt: '2026-01-01T23:59:59.000Z',
        targetAt: '2026-01-02T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('setting one', () => {
  it('needs only a title', () => {
    // `inspiredBy` comes back defaulted, which is the point of defaulting it:
    // a caller that named no ideas still gets a well-formed list.
    // Both list fields come back defaulted, which is the point of defaulting
    // them: a caller that named nobody still gets well-formed lists.
    expect(createGoalSchema.parse({ title: 'Ship it' })).toEqual({
      title: 'Ship it',
      inspiredBy: [],
      involves: [],
      sources: [],
      scheduled: [],
    });
  });

  it('lets the caller set nothing the api owns', () => {
    /*
     * Setting a goal you have already abandoned is not a thing anyone does,
     * and a caller able to choose could record one completed before any work
     * existed.
     */
    const parsed = createGoalSchema.parse({
      title: 'Ship it',
      id: 'chosen',
      status: 'COMPLETED',
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    expect(parsed).toEqual({
      title: 'Ship it',
      inspiredBy: [],
      involves: [],
      sources: [],
      scheduled: [],
    });
  });

  it('still refuses a target before the start', () => {
    expect(
      createGoalSchema.safeParse({
        title: 'Ship it',
        startsAt: '2026-03-01T00:00:00.000Z',
        targetAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('changing one', () => {
  it('accepts a single field', () => {
    expect(updateGoalSchema.parse({ status: 'COMPLETED' })).toEqual({
      status: 'COMPLETED',
    });
  });

  it('tells "remove the deadline" from "leave it alone"', () => {
    expect(updateGoalSchema.parse({ targetAt: null })).toEqual({
      targetAt: null,
    });
    expect(updateGoalSchema.parse({})).not.toHaveProperty('targetAt');
  });

  it('does not compare the dates it was given', () => {
    /*
     * A partial update may carry one and not the other, and comparing against
     * a value this schema cannot see would either reject valid changes or pass
     * invalid ones. The service does it, where both are known.
     */
    expect(
      updateGoalSchema.safeParse({ targetAt: '2020-01-01T00:00:00.000Z' })
        .success,
    ).toBe(true);
  });

  it('still validates what it is given', () => {
    expect(updateGoalSchema.safeParse({ startsAt: 'soon' }).success).toBe(false);
  });
});

describe('what inspired a goal', () => {
  const ideaId = '55555555-5555-4555-8555-555555555555';

  it('is a list of idea ids', () => {
    expect(
      goalSchema.parse({ ...valid, inspiredBy: [ideaId] }).inspiredBy,
    ).toEqual([ideaId]);
  });

  it('is required on the read shape, possibly empty', () => {
    // Plenty of goals come from nowhere in particular; an empty array says
    // that where a missing one would only say the caller forgot.
    const { inspiredBy: _omitted, ...without } = valid;

    expect(goalSchema.safeParse(without).success).toBe(false);
  });

  it('can be named when the goal is set', () => {
    /*
     * This side owns the link: a goal is written down *from* ideas, so naming
     * them as it is created is the one write that matches how it happens.
     */
    expect(
      createGoalSchema.parse({ title: 'Ship it', inspiredBy: [ideaId] })
        .inspiredBy,
    ).toEqual([ideaId]);
  });

  it('defaults to nothing, so a goal from nowhere need not send an empty list', () => {
    expect(createGoalSchema.parse({ title: 'Ship it' }).inspiredBy).toEqual([]);
  });

  it('replaces the whole set when changed', () => {
    // An idea missing from the list is unlinked; sending a partial set would
    // make "remove one" impossible to express.
    expect(updateGoalSchema.parse({ inspiredBy: [] })).toEqual({
      inspiredBy: [],
    });
  });

  it('refuses anything that is not an id', () => {
    expect(
      goalSchema.safeParse({ ...valid, inspiredBy: ['not-an-id'] }).success,
    ).toBe(false);
  });
});

describe('how far along', () => {
  it('starts at nothing and is always stated', () => {
    /*
     * Required rather than optional: a board with no sense of movement is a
     * list of intentions, and an absent progress would render as an empty bar
     * that might mean "none" or might mean "nobody said".
     */
    expect(goalSchema.parse(valid).progress).toBe(0);

    const { progress: _omitted, ...without } = valid;

    expect(goalSchema.safeParse(without).success).toBe(false);
  });

  it('is a percentage, and refuses to be outside one', () => {
    expect(goalSchema.parse({ ...valid, progress: 100 }).progress).toBe(100);
    expect(goalSchema.safeParse({ ...valid, progress: 101 }).success).toBe(
      false,
    );
    expect(goalSchema.safeParse({ ...valid, progress: -1 }).success).toBe(false);
  });

  it('refuses decimals, which claim a precision an estimate has not', () => {
    expect(goalSchema.safeParse({ ...valid, progress: 42.5 }).success).toBe(
      false,
    );
  });

  it('is not the caller’s to set, at any point', () => {
    /*
     * Counted from the tasks in the projects pursuing this goal. A caller able
     * to send it could claim a goal was 80% done while every task under it sat
     * untouched — two answers to one question, with nothing to say which was
     * right.
     */
    expect(
      createGoalSchema.parse({ title: 'Ship it', progress: 80 }),
    ).not.toHaveProperty('progress');

    expect(updateGoalSchema.parse({ progress: 40 })).not.toHaveProperty(
      'progress',
    );
  });
});

describe('who a goal is about', () => {
  const ALICE = '55555555-5555-4555-8555-555555555555';

  it('records them, the same way an idea does', () => {
    // "Help Alice find a job" is Alice's goal as much as anyone's.
    expect(goalSchema.parse({ ...valid, involves: [ALICE] }).involves).toEqual([
      ALICE,
    ]);
  });

  it('can be set when the goal is', () => {
    expect(
      createGoalSchema.parse({ title: 'Help Alice', involves: [ALICE] })
        .involves,
    ).toEqual([ALICE]);
  });

  it('is replaced as a whole set on update', () => {
    expect(updateGoalSchema.parse({ involves: [] }).involves).toEqual([]);
  });
});

describe('how much a goal matters', () => {
  it('uses the one scale telos ranks everything by', () => {
    expect(goalSchema.parse({ ...valid, priority: 1 }).priority).toBe(1);
    expect(goalSchema.safeParse({ ...valid, priority: 6 }).success).toBe(false);
  });

  it('is optional, because an unranked goal is the normal case', () => {
    expect(goalSchema.parse(valid).priority).toBeUndefined();
  });

  it('can be un-ranked with null', () => {
    expect(updateGoalSchema.parse({ priority: null }).priority).toBeNull();
  });
});

describe('what a goal draws on', () => {
  const RESOURCE = '99999999-9999-4999-8999-999999999999';
  const EVENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('cites its sources', () => {
    /*
     * Owned by the goal, unlike the projects realizing it. A project is
     * started *for* a goal and knows it; a document does not know what it will
     * end up justifying, so the reader of the goal is who decides.
     */
    expect(goalSchema.parse({ ...valid, sources: [RESOURCE] }).sources).toEqual(
      [RESOURCE],
    );
  });

  it('records what has been booked for it', () => {
    expect(
      goalSchema.parse({ ...valid, scheduled: [EVENT] }).scheduled,
    ).toEqual([EVENT]);
  });

  it('has both lists always, so "none" and "unsaid" stay distinct', () => {
    const { sources: _s, scheduled: _sc, ...without } = valid;

    expect(goalSchema.safeParse(without).success).toBe(false);
    expect(goalSchema.parse(valid).sources).toEqual([]);
  });

  it('replaces each as a whole set on update', () => {
    expect(
      updateGoalSchema.parse({ sources: [RESOURCE], scheduled: [] }),
    ).toEqual({ sources: [RESOURCE], scheduled: [] });
  });

  it('reads the projects realizing it, but cannot be told them', () => {
    /*
     * Derived from `Project.pursues`, so the two directions can never
     * disagree — the same arrangement an idea has with its goals. A caller
     * that could send it could claim a goal was being worked on by a project
     * that has never heard of it.
     */
    const project = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    expect(
      goalSchema.parse({ ...valid, realizedBy: [project] }).realizedBy,
    ).toEqual([project]);

    expect(
      createGoalSchema.parse({ title: 'Ship it', realizedBy: [project] }),
    ).not.toHaveProperty('realizedBy');
    expect(
      updateGoalSchema.parse({ realizedBy: [project] }),
    ).not.toHaveProperty('realizedBy');
  });
});
