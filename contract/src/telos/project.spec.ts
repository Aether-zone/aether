import {
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
} from './project.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Rebuild the console',
  description: 'Every screen, on the shared design system.',
  status: 'PLANNED',
  pursues: [],
  involves: [],
  tasks: { done: 0, total: 0 },
  startsAt: '2026-01-01T09:00:00.000Z',
  targetAt: '2026-03-31T22:59:00.000Z',
  createdAt: '2025-12-01T09:00:00.000Z',
  updatedAt: '2025-12-01T09:00:00.000Z',
};

describe('a project', () => {
  it('accepts a complete record', () => {
    expect(projectSchema.parse(valid)).toEqual(valid);
  });

  it('needs nothing but a title and a status', () => {
    const { description: _d, startsAt: _s, targetAt: _t, ...rest } = valid;

    expect(projectSchema.safeParse(rest).success).toBe(true);
  });

  it('has a PLANNED state, which a goal deliberately does not', () => {
    /*
     * Work can be scoped and scheduled without having started — that is what
     * planning is. A goal has no equivalent: you are aiming at it from the
     * moment you set it.
     */
    for (const status of ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']) {
      expect(projectSchema.safeParse({ ...valid, status }).success).toBe(true);
    }
  });

  it('is cancelled rather than abandoned', () => {
    // Work is called off; an aim is given up. The words are not
    // interchangeable and neither are the states.
    expect(
      projectSchema.safeParse({ ...valid, status: 'ABANDONED' }).success,
    ).toBe(false);
  });

  it('takes ISO strings, not Dates', () => {
    expect(
      projectSchema.safeParse({ ...valid, targetAt: new Date() }).success,
    ).toBe(false);
  });
});

describe('the dates', () => {
  it('allows a deadline with no start', () => {
    const { startsAt: _omitted, ...rest } = valid;

    expect(projectSchema.safeParse(rest).success).toBe(true);
  });

  it('allows a start with no deadline', () => {
    const { targetAt: _omitted, ...rest } = valid;

    expect(projectSchema.safeParse(rest).success).toBe(true);
  });

  it('refuses a deadline before the start, when both are given', () => {
    const result = projectSchema.safeParse({
      ...valid,
      targetAt: '2025-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/due before it starts/);
  });

  it('refuses a deadline exactly at the start', () => {
    expect(
      projectSchema.safeParse({ ...valid, targetAt: valid.startsAt }).success,
    ).toBe(false);
  });
});

describe('starting one', () => {
  it('needs only a title', () => {
    // `pursues` comes back defaulted: a project started without saying what
    // larger thing it is for still gets a well-formed list.
    // Both list fields come back defaulted; `tasks` is not here at all,
    // because it is counted rather than sent.
    expect(createProjectSchema.parse({ title: 'Rebuild it' })).toEqual({
      title: 'Rebuild it',
      pursues: [],
      involves: [],
    });
  });

  it('lets the caller set nothing the api owns', () => {
    // Writing a project down is planning it; a caller able to choose could
    // record work as completed before any of it existed.
    const parsed = createProjectSchema.parse({
      title: 'Rebuild it',
      id: 'chosen',
      status: 'COMPLETED',
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    expect(parsed).toEqual({
      title: 'Rebuild it',
      pursues: [],
      involves: [],
    });
  });

  it('still refuses a deadline before the start', () => {
    expect(
      createProjectSchema.safeParse({
        title: 'Rebuild it',
        startsAt: '2026-03-01T00:00:00.000Z',
        targetAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('changing one', () => {
  it('accepts a single field', () => {
    expect(updateProjectSchema.parse({ status: 'ACTIVE' })).toEqual({
      status: 'ACTIVE',
    });
  });

  it('tells "remove the deadline" from "leave it alone"', () => {
    expect(updateProjectSchema.parse({ targetAt: null })).toEqual({
      targetAt: null,
    });
    expect(updateProjectSchema.parse({})).not.toHaveProperty('targetAt');
  });

  it('does not compare the dates it was given', () => {
    expect(
      updateProjectSchema.safeParse({ targetAt: '2020-01-01T00:00:00.000Z' })
        .success,
    ).toBe(true);
  });

  it('still validates what it is given', () => {
    expect(updateProjectSchema.safeParse({ startsAt: 'soon' }).success).toBe(
      false,
    );
  });
});

describe('what a project is for', () => {
  const GOAL = '77777777-7777-4777-8777-777777777777';

  it('names the goals it pursues', () => {
    expect(projectSchema.parse({ ...valid, pursues: [GOAL] }).pursues).toEqual([
      GOAL,
    ]);
  });

  it('takes more than one, since work can serve two aims', () => {
    const second = '88888888-8888-4888-8888-888888888888';

    expect(
      projectSchema.parse({ ...valid, pursues: [GOAL, second] }).pursues,
    ).toHaveLength(2);
  });

  it('is required on the record, so "for nothing" and "unsaid" differ', () => {
    const { pursues: _omitted, ...without } = valid;

    expect(projectSchema.safeParse(without).success).toBe(false);
  });

  it('can be set when the project is started', () => {
    // "What is this for" is usually the reason it is being started at all.
    expect(
      createProjectSchema.parse({ title: 'Rebuild it', pursues: [GOAL] })
        .pursues,
    ).toEqual([GOAL]);
  });

  it('detaches from every goal when sent an empty list', () => {
    expect(updateProjectSchema.parse({ pursues: [] }).pursues).toEqual([]);
  });
});

describe('how much of it is done', () => {
  it('is counted, and cannot be told to the api', () => {
    /*
     * A project is done through tasks, so the tasks already know. A number
     * somebody types can disagree with them, and when it does there is nothing
     * to say which is right — which is exactly the trap a goal's `progress`
     * fell into.
     */
    expect(projectSchema.parse({ ...valid, tasks: { done: 3, total: 7 } }).tasks)
      .toEqual({ done: 3, total: 7 });

    expect(
      createProjectSchema.parse({
        title: 'Rebuild it',
        tasks: { done: 9, total: 9 },
      }),
    ).not.toHaveProperty('tasks');
    expect(
      updateProjectSchema.parse({ tasks: { done: 9, total: 9 } }),
    ).not.toHaveProperty('tasks');
  });

  it('allows no tasks at all, which is a real state', () => {
    // A project can be planned before it is broken down.
    expect(
      projectSchema.parse({ ...valid, tasks: { done: 0, total: 0 } }).tasks
        .total,
    ).toBe(0);
  });

  it('refuses counts that could not be counts', () => {
    expect(
      projectSchema.safeParse({ ...valid, tasks: { done: -1, total: 3 } })
        .success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ ...valid, tasks: { done: 1.5, total: 3 } })
        .success,
    ).toBe(false);
  });

  it('is required, so "no tasks" and "not counted" stay distinct', () => {
    const { tasks: _omitted, ...without } = valid;

    expect(projectSchema.safeParse(without).success).toBe(false);
  });
});

describe('who a project is for, and how much it matters', () => {
  const ALICE = '55555555-5555-4555-8555-555555555555';

  it('records the people, the same way a goal does', () => {
    expect(
      projectSchema.parse({ ...valid, involves: [ALICE] }).involves,
    ).toEqual([ALICE]);
  });

  it('can be set when the project is started', () => {
    expect(
      createProjectSchema.parse({ title: 'Rebuild it', involves: [ALICE] })
        .involves,
    ).toEqual([ALICE]);
  });

  it('uses the one scale telos ranks everything by', () => {
    expect(projectSchema.parse({ ...valid, priority: 1 }).priority).toBe(1);
    expect(projectSchema.safeParse({ ...valid, priority: 6 }).success).toBe(
      false,
    );
  });

  it('can be un-ranked with null', () => {
    expect(updateProjectSchema.parse({ priority: null }).priority).toBeNull();
  });
});
