import { createUserSchema, updateUserSchema, userSchema } from './user.js';

const valid = {
  id: '3f1a7c22-8f4a-4c3e-9b21-6d5e0a7f1c88',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: '+31612345678',
};

describe('a user', () => {
  it('accepts a complete record', () => {
    expect(userSchema.parse(valid)).toEqual(valid);
  });

  it('requires the id to be a uuid', () => {
    // The api assigns it, so anything else means a client invented one.
    expect(userSchema.safeParse({ ...valid, id: '42' }).success).toBe(false);
  });

  it('trims the names it is given', () => {
    // A trailing space is not part of anybody's name, and it makes two
    // records that look identical sort and compare differently.
    const parsed = userSchema.parse({ ...valid, firstName: '  Ada  ' });

    expect(parsed.firstName).toBe('Ada');
  });

  it('refuses a name that is only whitespace', () => {
    expect(userSchema.safeParse({ ...valid, firstName: '   ' }).success).toBe(
      false,
    );
  });

  it('lowercases the email', () => {
    // Otherwise `Ada@Example.com` and `ada@example.com` are two people, and
    // nothing can join them back together afterwards.
    const parsed = userSchema.parse({ ...valid, email: 'Ada@Example.COM' });

    expect(parsed.email).toBe('ada@example.com');
  });

  it('refuses something that is not an address', () => {
    expect(userSchema.safeParse({ ...valid, email: 'ada@' }).success).toBe(
      false,
    );
  });

  it('requires the phone number in international format', () => {
    // `0612345678` means something only if you already know the country, and
    // a number crossing a service boundary has left that context behind.
    expect(userSchema.safeParse({ ...valid, phoneNumber: '+31612345678' }).success).toBe(true);
    expect(userSchema.safeParse({ ...valid, phoneNumber: '0612345678' }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, phoneNumber: '06-1234 5678' }).success).toBe(false);
  });

  it('says what is wrong in words a form can show', () => {
    const result = userSchema.safeParse({ ...valid, phoneNumber: '0612345678' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/international format/);
  });
});

describe('creating one', () => {
  it('does not let the caller choose the id', () => {
    // A client that could pick an id could overwrite someone else's record by
    // guessing one. zod strips unknown keys rather than failing, so the id is
    // dropped rather than honoured.
    const parsed = createUserSchema.parse({ ...valid });

    expect(parsed).not.toHaveProperty('id');
  });

  it('still requires everything else', () => {
    expect(createUserSchema.safeParse({ firstName: 'Ada' }).success).toBe(false);
  });
});

describe('updating one', () => {
  it('accepts a single field', () => {
    // An absent field means "leave it alone", so a caller need not read the
    // record back and send it whole to change one thing.
    expect(updateUserSchema.parse({ lastName: 'Byron' })).toEqual({
      lastName: 'Byron',
    });
  });

  it('accepts an empty object', () => {
    expect(updateUserSchema.parse({})).toEqual({});
  });

  it('still validates the fields it is given', () => {
    expect(updateUserSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});
