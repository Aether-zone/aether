import { createGoalSchema, goalSchema, updateGoalSchema } from './goal.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Ship the console',
  description: 'End to end, with people using it.',
  status: 'ACTIVE',
  startsAt: '2026-01-01T09:00:00.000Z',
  targetAt: '2026-03-31T23:59:00.000Z',
  inspiredBy: [],
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

  it('has exactly the three outcomes', () => {
    for (const status of ['ACTIVE', 'COMPLETED', 'ABANDONED']) {
      expect(goalSchema.safeParse({ ...valid, status }).success).toBe(true);
    }

    // No "not started": a goal you have not begun is still one you are aiming
    // at, and the dates say how long it has sat better than a state would.
    expect(goalSchema.safeParse({ ...valid, status: 'PENDING' }).success).toBe(
      false,
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
    expect(createGoalSchema.parse({ title: 'Ship it' })).toEqual({
      title: 'Ship it',
      inspiredBy: [],
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

    expect(parsed).toEqual({ title: 'Ship it', inspiredBy: [] });
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
