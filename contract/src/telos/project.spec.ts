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
    expect(createProjectSchema.parse({ title: 'Rebuild it' })).toEqual({
      title: 'Rebuild it',
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

    expect(parsed).toEqual({ title: 'Rebuild it' });
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
