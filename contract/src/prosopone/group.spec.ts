import { GROUP_TYPES } from './group-type.js';
import {
  createGroupSchema,
  groupSchema,
  updateGroupSchema,
} from './group.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Aether Zone',
  description: 'The workspace this console is built for.',
  type: 'COMPANY',
  createdAt: '2025-12-01T09:00:00.000Z',
  updatedAt: '2025-12-01T09:00:00.000Z',
};

describe('a group', () => {
  it('accepts a complete record', () => {
    expect(groupSchema.parse(valid)).toEqual(valid);
  });

  it('needs nothing but a name and its timestamps', () => {
    const { description: _d, type: _t, ...rest } = valid;

    expect(groupSchema.safeParse(rest).success).toBe(true);
  });

  it('insists on a name', () => {
    const { name: _name, ...rest } = valid;

    expect(groupSchema.safeParse(rest).success).toBe(false);
    expect(
      groupSchema.safeParse({ ...valid, name: '   ' }).success,
    ).toBe(false);
  });

  it('trims the name, so two spellings are not two groups', () => {
    expect(
      groupSchema.parse({ ...valid, name: '  Aether  ' }).name,
    ).toBe('Aether');
  });

  it('knows the six kinds, and nothing else', () => {
    for (const type of GROUP_TYPES) {
      expect(groupSchema.safeParse({ ...valid, type }).success).toBe(
        true,
      );
    }

    expect(
      groupSchema.safeParse({ ...valid, type: 'CHARITY' }).success,
    ).toBe(false);
  });

  it('has an escape hatch, and it is not a failure', () => {
    /*
     * Six kinds will not cover every group a person deals with, and the
     * alternative to `OTHER` is somebody filing their church under `COMPANY`.
     */
    expect(GROUP_TYPES).toContain('OTHER');
  });

  it('does not insist on a kind at all', () => {
    // "The people I run with on Sundays" is a real group to somebody and not
    // obviously any of the six.
    const { type: _type, ...rest } = valid;

    expect(groupSchema.parse(rest).type).toBeUndefined();
  });

  it('carries times as strings, not Dates', () => {
    /*
     * A DTO crosses a process boundary as JSON. A `Date` here would describe a
     * value that only exists on one side of the wire, and the first
     * `.toISOString()` on a parsed response would throw.
     */
    expect(typeof groupSchema.parse(valid).createdAt).toBe('string');
    expect(
      groupSchema.safeParse({ ...valid, createdAt: new Date() }).success,
    ).toBe(false);
  });

  it('carries no tenant of its own', () => {
    /*
     * The distinction the rename exists to keep: aether's routes are
     * `/organizations/:organizationId/…` and *that* organization is the
     * tenant. A group is a record inside one — it has no bearing on what
     * anybody may read, and the tenant is in the URL rather than the body.
     */
    expect(groupSchema.parse(valid)).not.toHaveProperty('organizationId');
  });
});

describe('recording one', () => {
  it('needs only a name', () => {
    expect(createGroupSchema.parse({ name: 'Aether Zone' })).toEqual({
      name: 'Aether Zone',
    });
  });

  it('will not let the caller choose the id or the timestamps', () => {
    const created = createGroupSchema.parse({
      ...valid,
      id: '99999999-9999-4999-8999-999999999999',
    });

    expect(created).not.toHaveProperty('id');
    expect(created).not.toHaveProperty('createdAt');
    expect(created).not.toHaveProperty('updatedAt');
  });
});

describe('changing one', () => {
  it('takes each field on its own', () => {
    expect(updateGroupSchema.parse({ name: 'Renamed' })).toEqual({
      name: 'Renamed',
    });
  });

  it('lets the kind and the description be taken back with null', () => {
    // A group that turned out not to be a company should be able to stop being
    // one without becoming something else.
    expect(
      updateGroupSchema.parse({ type: null, description: null }),
    ).toEqual({ type: null, description: null });
  });

  it('does not let the name be removed', () => {
    // There is nothing to fall back to: a nameless group cannot be listed.
    expect(updateGroupSchema.safeParse({ name: null }).success).toBe(
      false,
    );
  });

  it('still holds a nullable field to its rules when given a value', () => {
    expect(
      updateGroupSchema.safeParse({ type: 'CHARITY' }).success,
    ).toBe(false);
  });
});
