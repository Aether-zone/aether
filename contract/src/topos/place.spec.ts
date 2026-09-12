import { createPlaceSchema, placeSchema, updatePlaceSchema } from './place.js';

const valid = {
  id: '7c9e2b41-3a55-4d18-9f02-1b8e6d4a7c33',
  name: 'Het Sieraad',
  description: 'A converted school building.',
  address: 'Postjesweg 1, 1057 DT Amsterdam',
  lat: 52.3676,
  lng: 4.8776,
};

describe('a place', () => {
  it('accepts a complete record', () => {
    expect(placeSchema.parse(valid)).toEqual(valid);
  });

  it('does not need a description', () => {
    // Plenty of places are adequately described by their name.
    const { description: _omitted, ...rest } = valid;

    expect(placeSchema.parse(rest).description).toBeUndefined();
  });

  it('trims the text it is given', () => {
    const parsed = placeSchema.parse({ ...valid, name: '  Het Sieraad  ' });

    expect(parsed.name).toBe('Het Sieraad');
  });

  it('refuses a name or address that is only whitespace', () => {
    expect(placeSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(placeSchema.safeParse({ ...valid, address: '  ' }).success).toBe(
      false,
    );
  });

  it('requires the id to be a uuid', () => {
    expect(placeSchema.safeParse({ ...valid, id: '42' }).success).toBe(false);
  });
});

describe('where it is', () => {
  it('accepts the extremes of both ranges', () => {
    expect(
      placeSchema.safeParse({ ...valid, lat: -90, lng: 180 }).success,
    ).toBe(true);
  });

  it('refuses a latitude that does not exist', () => {
    /*
     * Beyond ±90 there is no such latitude, and the usual cause is a longitude
     * in the wrong field — the commonest way coordinates get entered wrongly,
     * and one of the few a schema can catch.
     */
    expect(placeSchema.safeParse({ ...valid, lat: 4.8776 * 30 }).success).toBe(
      false,
    );
    expect(placeSchema.safeParse({ ...valid, lat: 91 }).success).toBe(false);
  });

  it('refuses a longitude beyond the meridian', () => {
    expect(placeSchema.safeParse({ ...valid, lng: 181 }).success).toBe(false);
  });

  it('says which way round they go', () => {
    const result = placeSchema.safeParse({ ...valid, lat: 100 });

    expect(result.error?.issues[0].message).toMatch(/-90 to 90/);
  });

  it('cannot catch a plausible swap, and does not pretend to', () => {
    // Both values are in range, so this parses — it is simply somewhere in
    // Somalia rather than Amsterdam. Only a map catches that.
    expect(
      placeSchema.safeParse({ ...valid, lat: 4.8776, lng: 52.3676 }).success,
    ).toBe(true);
  });

  it('requires both, since half a coordinate locates nothing', () => {
    const { lat: _lat, ...withoutLat } = valid;

    expect(placeSchema.safeParse(withoutLat).success).toBe(false);
  });

  it('does not accept a number written as a string', () => {
    // No coercion: `"52.3676"` from a form has to be turned into a number by
    // whoever read the form, where the failure is visible.
    expect(placeSchema.safeParse({ ...valid, lat: '52.3676' }).success).toBe(
      false,
    );
  });
});

describe('creating one', () => {
  it('does not let the caller choose the id', () => {
    const parsed = createPlaceSchema.parse({ ...valid });

    expect(parsed).not.toHaveProperty('id');
  });

  it('still requires everything else', () => {
    expect(createPlaceSchema.safeParse({ name: 'Het Sieraad' }).success).toBe(
      false,
    );
  });
});

describe('updating one', () => {
  it('accepts a single field', () => {
    expect(updatePlaceSchema.parse({ name: 'Renamed' })).toEqual({
      name: 'Renamed',
    });
  });

  it('accepts an empty object', () => {
    expect(updatePlaceSchema.parse({})).toEqual({});
  });

  it('still validates what it is given', () => {
    expect(updatePlaceSchema.safeParse({ lat: 200 }).success).toBe(false);
  });
});
