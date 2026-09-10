import {
  DESCRIPTION_MAX,
  createIdeaSchema,
  ideaSchema,
  updateIdeaSchema,
} from './idea.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Let the console remember a search',
  description: 'So a reader can come back to what they were looking at.',
  status: 'CAPTURED',
  priority: 2,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
  createdBy: '22222222-2222-4222-8222-222222222222',
  inspired: [],
};

describe('an idea', () => {
  it('accepts a complete record', () => {
    expect(ideaSchema.parse(valid)).toEqual(valid);
  });

  it('needs nothing but a title to be worth keeping', () => {
    // An idea that has to be filled in properly is an idea nobody writes down.
    const { description: _d, priority: _p, ...rest } = valid;

    expect(ideaSchema.safeParse(rest).success).toBe(true);
  });

  it('refuses a title that is only whitespace', () => {
    expect(ideaSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
  });

  it('trims the text it is given', () => {
    expect(ideaSchema.parse({ ...valid, title: '  An idea  ' }).title).toBe(
      'An idea',
    );
  });

  it('requires who wrote it down', () => {
    // Unlike an event's organizer: every idea here was captured by somebody
    // using this api, and the value comes from their token.
    const { createdBy: _omitted, ...without } = valid;

    expect(ideaSchema.safeParse(without).success).toBe(false);
  });

  it('refuses a status it does not have', () => {
    expect(ideaSchema.safeParse({ ...valid, status: 'DONE' }).success).toBe(
      false,
    );
  });

  it('takes ISO strings, not Dates', () => {
    expect(
      ideaSchema.safeParse({ ...valid, createdAt: new Date() }).success,
    ).toBe(false);
  });
});

describe('priority', () => {
  it('accepts the whole scale', () => {
    for (const priority of [1, 2, 3, 4, 5]) {
      expect(ideaSchema.safeParse({ ...valid, priority }).success).toBe(true);
    }
  });

  it('refuses a number outside it', () => {
    /*
     * A scale nobody agreed on is not a scale: with an open range one person
     * writes 1 for urgent and another writes 100, and sorting produces an
     * order that means nothing.
     */
    expect(ideaSchema.safeParse({ ...valid, priority: 0 }).success).toBe(false);
    expect(ideaSchema.safeParse({ ...valid, priority: 100 }).success).toBe(
      false,
    );
  });

  it('refuses a fraction, so 2.5 cannot sit between two ranks', () => {
    expect(ideaSchema.safeParse({ ...valid, priority: 2.5 }).success).toBe(
      false,
    );
  });

  it('says which way round the scale runs', () => {
    const result = ideaSchema.safeParse({ ...valid, priority: 9 });

    expect(result.error?.issues[0].message).toMatch(/1 to 5/);
  });

  it('is optional, because an unranked idea is the normal case', () => {
    const { priority: _omitted, ...without } = valid;

    expect(ideaSchema.parse(without).priority).toBeUndefined();
  });
});

describe('capturing one', () => {
  it('needs only a title', () => {
    expect(createIdeaSchema.parse({ title: 'A thought' })).toEqual({
      title: 'A thought',
    });
  });

  it('lets the caller set nothing the api owns', () => {
    /*
     * `createdBy` above all: it comes from the token, never the body, or
     * anyone could write an idea under somebody else's name.
     */
    const parsed = createIdeaSchema.parse({
      title: 'A thought',
      id: 'chosen',
      status: 'PROMOTED',
      createdBy: '33333333-3333-4333-8333-333333333333',
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    expect(parsed).toEqual({ title: 'A thought' });
  });

  it('still validates the priority it is given', () => {
    expect(
      createIdeaSchema.safeParse({ title: 'A thought', priority: 9 }).success,
    ).toBe(false);
  });
});

describe('changing one', () => {
  it('accepts a single field', () => {
    expect(updateIdeaSchema.parse({ status: 'PROMOTED' })).toEqual({
      status: 'PROMOTED',
    });
  });

  it('accepts an empty object', () => {
    expect(updateIdeaSchema.parse({})).toEqual({});
  });

  it('tells "un-rank it" from "leave the ranking alone"', () => {
    // "No longer important enough to rank" is a real thing to say.
    expect(updateIdeaSchema.parse({ priority: null })).toEqual({
      priority: null,
    });
    expect(updateIdeaSchema.parse({})).not.toHaveProperty('priority');
  });

  it('still refuses a priority off the scale', () => {
    expect(updateIdeaSchema.safeParse({ priority: 0 }).success).toBe(false);
  });
});

describe('what an idea led to', () => {
  const goalId = '44444444-4444-4444-8444-444444444444';

  it('is a list of goal ids', () => {
    expect(ideaSchema.parse({ ...valid, inspired: [goalId] }).inspired).toEqual([
      goalId,
    ]);
  });

  it('is required, so "nothing yet" and "nobody said" stay distinct', () => {
    const { inspired: _omitted, ...without } = valid;

    expect(ideaSchema.safeParse(without).success).toBe(false);
  });

  it('cannot be sent when capturing one', () => {
    /*
     * Derived from the goals that name this idea, so there is nothing to send
     * — and a caller that could send it could claim an idea inspired a goal
     * that has never heard of it.
     */
    const parsed = createIdeaSchema.parse({
      title: 'A thought',
      inspired: [goalId],
    });

    expect(parsed).not.toHaveProperty('inspired');
  });

  it('cannot be sent when changing one either', () => {
    expect(updateIdeaSchema.parse({ inspired: [goalId] })).not.toHaveProperty(
      'inspired',
    );
  });

  it('holds ids rather than whole goals', () => {
    // A goal points back at the idea, so embedding either side would make the
    // two types mutually recursive and the JSON never bottom out.
    expect(
      ideaSchema.safeParse({
        ...valid,
        inspired: [{ id: goalId, title: 'A goal' }],
      }).success,
    ).toBe(false);
  });
});

describe('taking a description back', () => {
  it('accepts null, which is how it is removed', () => {
    // Distinct from leaving the key out: that means "leave it alone", and a
    // field which could be added but never cleared would strand a first draft
    // on the record forever.
    expect(updateIdeaSchema.parse({ description: null }).description).toBeNull();
  });

  it('still holds a description to its limit', () => {
    expect(
      updateIdeaSchema.safeParse({ description: 'x'.repeat(DESCRIPTION_MAX + 1) })
        .success,
    ).toBe(false);
  });
});
