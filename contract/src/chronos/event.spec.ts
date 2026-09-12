import {
  createEventSchema,
  eventSchema,
  updateEventSchema,
} from './event.js';

const ada = {
  id: '3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: '+31612345678',
};

const sieraad = {
  id: '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33',
  name: 'Het Sieraad',
  address: 'Postjesweg 1, 1057 DT Amsterdam',
  lat: 52.3676,
  lng: 4.8776,
};

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Quarterly planning',
  description: 'Where the next three months get decided.',
  startsAt: '2026-01-01T09:00:00.000Z',
  endsAt: '2026-01-01T10:00:00.000Z',
  location: sieraad,
  type: 'MEETING',
  status: 'SCHEDULED',
  organizerId: '22222222-2222-4222-8222-222222222222',
  attendees: [ada],
  createdAt: '2025-12-01T09:00:00.000Z',
  updatedAt: '2025-12-01T09:00:00.000Z',
};

describe('an event', () => {
  it('accepts a complete record', () => {
    expect(eventSchema.parse(valid)).toEqual(valid);
  });

  it('does not need a description, a location or an organizer', () => {
    const {
      description: _d,
      location: _l,
      organizerId: _o,
      ...rest
    } = valid;

    expect(eventSchema.safeParse(rest).success).toBe(true);
  });

  it('needs attendees to be present, even when empty', () => {
    // A meeting with nobody in it is strange but legitimate; a *missing* array
    // is just a caller who forgot.
    expect(
      eventSchema.safeParse({ ...valid, attendees: [] }).success,
    ).toBe(true);

    const { attendees: _omitted, ...without } = valid;

    expect(eventSchema.safeParse(without).success).toBe(false);
  });

  it('embeds people, and validates them as people', () => {
    // The nested schema is prosopone's, so a bad phone number fails here too
    // rather than arriving as a person nothing else would accept.
    const result = eventSchema.safeParse({
      ...valid,
      attendees: [{ ...ada, phoneNumber: '0612345678' }],
    });

    expect(result.success).toBe(false);
  });

  it('embeds the place, and validates it as a place', () => {
    expect(
      eventSchema.safeParse({
        ...valid,
        location: { ...sieraad, lat: 200 },
      }).success,
    ).toBe(false);
  });

  it('refuses a status it does not have', () => {
    expect(eventSchema.safeParse({ ...valid, status: 'RECORDED' }).success).toBe(
      false,
    );
  });

  it('refuses a type it does not have', () => {
    expect(eventSchema.safeParse({ ...valid, type: 'BIRTHDAY' }).success).toBe(
      false,
    );
  });

  it('requires a type, so nothing arrives as an unspecified occasion', () => {
    const { type: _omitted, ...without } = valid;

    expect(eventSchema.safeParse(without).success).toBe(false);
  });
});

describe('when it happens', () => {
  it('takes ISO strings, not Dates', () => {
    /*
     * A DTO crosses a process boundary as JSON, where a Date arrives as a
     * string anyway — typing it as a Date would make every consumer's value
     * disagree with its own type.
     */
    expect(
      eventSchema.safeParse({
        ...valid,
        startsAt: new Date('2026-01-01T09:00:00.000Z'),
      }).success,
    ).toBe(false);
  });

  it('refuses one that ends before it starts', () => {
    const result = eventSchema.safeParse({
      ...valid,
      startsAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T09:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/end after it starts/);
  });

  it('refuses one that ends exactly when it starts', () => {
    // Zero-length is not a span; it is a mistake that looks like one. A kind
    // that really is a moment omits `endsAt` instead.
    expect(
      eventSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success,
    ).toBe(false);
  });

  it('compares them as strings, which is exact for ISO in UTC', () => {
    // The format is ordered lexicographically by design, so this needs no
    // parsing and cannot drift with a timezone.
    expect(
      eventSchema.safeParse({
        ...valid,
        startsAt: '2026-01-01T23:59:59.000Z',
        endsAt: '2026-01-02T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('putting one in the calendar', () => {
  const request = {
    type: 'MEETING' as const,
    title: 'Quarterly planning',
    startsAt: '2026-01-01T09:00:00.000Z',
    endsAt: '2026-01-01T10:00:00.000Z',
    locationId: sieraad.id,
    attendeeIds: [ada.id],
  };

  it('names people and place by id, not by value', () => {
    /*
     * The caller has ids and nothing else, and sending whole objects would let
     * a stale copy of a person overwrite what prosopone knows.
     */
    expect(createEventSchema.parse(request)).toMatchObject({
      locationId: sieraad.id,
      attendeeIds: [ada.id],
    });
  });

  it('does not let the caller choose the id, the status or the timestamps', () => {
    const parsed = createEventSchema.parse({
      ...request,
      id: 'chosen',
      status: 'COMPLETED',
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('createdAt');
  });

  it('defaults the attendees to nobody', () => {
    const { attendeeIds: _omitted, ...without } = request;

    expect(createEventSchema.parse(without).attendeeIds).toEqual([]);
  });

  it('still refuses one that ends before it starts', () => {
    expect(
      createEventSchema.safeParse({
        ...request,
        endsAt: '2026-01-01T08:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('changing one', () => {
  it('accepts a single field', () => {
    expect(updateEventSchema.parse({ status: 'CANCELLED' })).toEqual({
      status: 'CANCELLED',
    });
  });

  it('accepts an empty object', () => {
    expect(updateEventSchema.parse({})).toEqual({});
  });

  it('tells "nowhere" from "leave it alone"', () => {
    // The one place the distinction is needed: clearing a location is a real
    // instruction, and absence must not perform it.
    expect(updateEventSchema.parse({ locationId: null })).toEqual({
      locationId: null,
    });
    expect(updateEventSchema.parse({})).not.toHaveProperty('locationId');
  });

  it('does not compare the times it was given', () => {
    /*
     * A partial update may carry one of them, and comparing it against a value
     * this schema cannot see would either reject valid changes or pass invalid
     * ones. That check belongs in the service, where both are known.
     */
    expect(
      updateEventSchema.safeParse({ endsAt: '2020-01-01T00:00:00.000Z' })
        .success,
    ).toBe(true);
  });

  it('still validates what it is given', () => {
    expect(updateEventSchema.safeParse({ startsAt: 'soon' }).success).toBe(
      false,
    );
  });
});

describe('kinds that are a moment rather than a span', () => {
  const deadline = {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'DEADLINE' as const,
    title: 'Tax return due',
    startsAt: '2026-01-31T23:59:00.000Z',
    status: 'SCHEDULED' as const,
    attendees: [],
    createdAt: '2025-12-01T09:00:00.000Z',
    updatedAt: '2025-12-01T09:00:00.000Z',
  };

  it('may have no end at all', () => {
    /*
     * Giving a deadline an end would mean inventing one, and every reader
     * would then have to know it was invented.
     */
    expect(eventSchema.safeParse(deadline).success).toBe(true);
  });

  it('is still checked when an end is given', () => {
    expect(
      eventSchema.safeParse({
        ...deadline,
        endsAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('may have nobody in it', () => {
    // A reminder normally does. The empty array is the honest answer, and
    // it is required so that "nobody" and "the caller forgot" stay distinct.
    expect(
      eventSchema.safeParse({ ...deadline, type: 'REMINDER' }).success,
    ).toBe(true);
  });
});

describe('the kinds themselves', () => {
  it('accepts each one', () => {
    for (const type of [
      'MEETING',
      'APPOINTMENT',
      'CALL',
      'DEADLINE',
      'REMINDER',
      'OUT_OF_OFFICE',
    ] as const) {
      expect(eventSchema.safeParse({ ...valid, type }).success).toBe(true);
    }
  });

  it('is required on create, and not defaulted to MEETING', () => {
    /*
     * A default would make the commonest kind the silent one, so a caller that
     * forgot the field and a caller that meant a meeting would be
     * indistinguishable — and the first is worth catching.
     */
    const { type: _omitted, ...without } = {
      type: 'MEETING' as const,
      title: 'x',
      startsAt: '2026-01-01T09:00:00.000Z',
      endsAt: '2026-01-01T10:00:00.000Z',
    };

    expect(createEventSchema.safeParse(without).success).toBe(false);
  });

  it('can be changed, because a call moved into a room is the same occasion', () => {
    // Cancelling and re-creating it would lose everyone's acceptance.
    expect(updateEventSchema.parse({ type: 'MEETING' })).toEqual({
      type: 'MEETING',
    });
  });
});
