import { RESOURCE_TYPES } from './resource-type.js';
import {
  createResourceSchema,
  resourceSchema,
  updateResourceSchema,
} from './resource.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'WEB_PAGE',
  title: 'The Twelve-Factor App',
  description: 'Where the config-in-the-environment argument comes from.',
  content: 'I. Codebase\nOne codebase tracked in revision control…',
  source: { type: 'web', id: 'crawler-2', name: 'Web crawler' },
  externalId: 'page-4471',
  url: 'https://12factor.net/',
  metadata: { fetchedBy: 'crawler-2', attempts: 1 },
  createdAt: '2025-12-01T09:00:00.000Z',
  updatedAt: '2025-12-01T09:00:00.000Z',
};

describe('a resource', () => {
  it('accepts a complete record', () => {
    expect(resourceSchema.parse(valid)).toEqual(valid);
  });

  it('needs nothing but an id, a kind and its timestamps', () => {
    /*
     * A resource can be filed the moment it arrives, before anyone has read
     * it or decided what it is for. Requiring a title would mean the arriving
     * thing waits outside until a person gets to it.
     */
    const bare = {
      id: valid.id,
      type: 'FILE',
      createdAt: valid.createdAt,
      updatedAt: valid.updatedAt,
    };

    expect(resourceSchema.safeParse(bare).success).toBe(true);
  });

  it('insists on a kind', () => {
    // Something whose kind is unknown cannot be rendered, indexed or routed.
    const { type: _type, ...rest } = valid;

    expect(resourceSchema.safeParse(rest).success).toBe(false);
  });

  it('refuses a kind outside the list', () => {
    expect(
      resourceSchema.safeParse({ ...valid, type: 'SPREADSHEET' }).success,
    ).toBe(false);
  });

  it('knows every kind that was asked for', () => {
    expect(RESOURCE_TYPES).toEqual([
      'NOTE',
      'DOCUMENT',
      'FILE',
      'WEB_PAGE',
      'EMAIL',
      'CONVERSATION',
      'AUDIO',
      'VIDEO',
    ]);
  });

  it('refuses a url that is not one', () => {
    expect(
      resourceSchema.safeParse({ ...valid, url: 'not a url' }).success,
    ).toBe(false);
  });

  it('carries times as strings, not Dates', () => {
    /*
     * A DTO crosses a process boundary as JSON. A `Date` here would describe a
     * value that only exists on one side of the wire, and the first
     * `.toISOString()` on a parsed response would throw.
     */
    expect(typeof resourceSchema.parse(valid).createdAt).toBe('string');
    expect(
      resourceSchema.safeParse({ ...valid, createdAt: new Date() }).success,
    ).toBe(false);
  });
});

describe('content', () => {
  it('is kept exactly as given', () => {
    // Leading whitespace is meaningful in a transcript or a code sample, so
    // this is the one string field that is not trimmed.
    const indented = '    const x = 1;\n';

    expect(resourceSchema.parse({ ...valid, content: indented }).content).toBe(
      indented,
    );
  });

  it('has no length limit of its own', () => {
    // A cap here would silently truncate the field the resource exists to
    // carry; a limit belongs where it can reject rather than mangle.
    const long = 'x'.repeat(100_000);

    expect(resourceSchema.safeParse({ ...valid, content: long }).success).toBe(
      true,
    );
  });
});

describe('where it came from', () => {
  it('takes an open-ended source', () => {
    /*
     * Not an enum: the set of systems a resource can arrive from is open, and
     * a closed list would need a release of this contract before anything
     * could be filed from a system nobody had thought of.
     */
    const parsed = resourceSchema.parse({
      ...valid,
      source: { type: 'a-system-nobody-has-heard-of' },
    });

    expect(parsed.source?.type).toBe('a-system-nobody-has-heard-of');
  });

  it('insists a source says what it is', () => {
    // A source that cannot name itself tells a reader nothing.
    expect(
      resourceSchema.safeParse({ ...valid, source: { name: 'Somewhere' } })
        .success,
    ).toBe(false);
    expect(
      resourceSchema.safeParse({ ...valid, source: { type: '  ' } }).success,
    ).toBe(false);
  });

  it('keeps the system’s id apart from the record’s', () => {
    /*
     * `source.id` is which mailbox; `externalId` is which message in it. One
     * field for both would make "the same id in two systems" unanswerable.
     */
    const parsed = resourceSchema.parse({
      ...valid,
      source: { type: 'gmail', id: 'work@example.test' },
      externalId: 'msg-4471',
    });

    expect(parsed.source?.id).toBe('work@example.test');
    expect(parsed.externalId).toBe('msg-4471');
  });

  it('lets a source carry its own metadata', () => {
    const parsed = resourceSchema.parse({
      ...valid,
      source: { type: 'notion', metadata: { workspace: 'aether', v: 2 } },
    });

    expect(parsed.source?.metadata).toEqual({ workspace: 'aether', v: 2 });
  });
});

describe('metadata', () => {
  it('takes whatever the source wanted to keep', () => {
    const parsed = resourceSchema.parse({
      ...valid,
      metadata: { nested: { deep: true }, count: 3, tags: ['a', 'b'] },
    });

    expect(parsed.metadata).toEqual({
      nested: { deep: true },
      count: 3,
      tags: ['a', 'b'],
    });
  });

  it('refuses something that is not an object', () => {
    expect(
      resourceSchema.safeParse({ ...valid, metadata: 'anything' }).success,
    ).toBe(false);
  });
});

describe('filing one', () => {
  it('will not let the caller choose the id or the timestamps', () => {
    const created = createResourceSchema.parse({
      ...valid,
      id: '99999999-9999-4999-8999-999999999999',
    });

    expect(created).not.toHaveProperty('id');
    expect(created).not.toHaveProperty('createdAt');
    expect(created).not.toHaveProperty('updatedAt');
  });

  it('needs only a kind', () => {
    expect(createResourceSchema.parse({ type: 'NOTE' })).toEqual({
      type: 'NOTE',
    });
  });
});

describe('changing one', () => {
  it('takes each field on its own', () => {
    expect(updateResourceSchema.parse({ title: 'Renamed' })).toEqual({
      title: 'Renamed',
    });
  });

  it('lets the optional fields be taken back with null', () => {
    // Absent means "leave it alone", so without a null there would be no way
    // to remove a title that was wrong.
    const cleared = updateResourceSchema.parse({
      title: null,
      description: null,
      content: null,
      source: null,
      externalId: null,
      url: null,
      metadata: null,
    });

    expect(cleared.title).toBeNull();
    expect(cleared.metadata).toBeNull();
  });

  it('does not let the kind be removed', () => {
    // A resource always has one, and there is nothing to fall back to.
    expect(updateResourceSchema.safeParse({ type: null }).success).toBe(false);
  });

  it('still holds a nullable field to its rules when given a value', () => {
    expect(updateResourceSchema.safeParse({ url: 'nope' }).success).toBe(false);
    expect(updateResourceSchema.safeParse({ title: '   ' }).success).toBe(
      false,
    );
  });
});
