import { NotFoundException } from '@nestjs/common';
import type { Actor } from '@aether-zone/organon';

import { TestDatabase } from '../../test-database';
import { StoredFile } from './file.entity';
import { FileService } from './file.service';

/**
 * A loculus that answers without a network.
 *
 * The client is stubbed rather than the `fetch` beneath it: what these tests
 * are about is the row aether writes and when, and a stub at the seam keeps
 * that readable. `loculus.client.spec.ts` is where the HTTP itself belongs.
 */
class FakeLoculus {
  readonly asked: { request: unknown; token: string }[] = [];
  readonly removed: string[] = [];
  failing = false;

  createUpload(request: unknown, accessToken: string) {
    this.asked.push({ request, token: accessToken });

    if (this.failing) {
      return Promise.reject(new Error('the object store is unreachable'));
    }

    return Promise.resolve({
      objectKey: 'aether/org-1/a-file.pdf',
      uploadUrl: 'https://store.test/put',
      expiresAt: new Date('2026-01-01T09:00:00.000Z'),
    });
  }

  createDownload() {
    return Promise.resolve({
      objectKey: 'aether/org-1/a-file.pdf',
      downloadUrl: 'https://store.test/get',
      expiresAt: new Date('2026-01-01T09:00:00.000Z'),
    });
  }

  remove(objectKey: string) {
    this.removed.push(objectKey);

    return Promise.resolve();
  }
}

const actorIn = (organizationId: string): Actor =>
  ({
    id: 'caller-1',
    clientId: 'aether',
    scopes: [],
    organizations: {},
    organizationId,
    role: 'member',
    organizationName: 'Test',
  }) as Actor;

const lokal = actorIn('org-1');
const other = actorIn('org-2');

const upload = {
  fileName: 'intake-spec.pdf',
  contentType: 'application/pdf',
  size: 4096,
};

let database: TestDatabase;
let loculus: FakeLoculus;
let files: FileService;

beforeEach(async () => {
  database = await TestDatabase.open(StoredFile);
  loculus = new FakeLoculus();
  files = new FileService(database.repository(StoredFile), loculus as never);
});

afterEach(() => database.close());

describe('preparing an upload', () => {
  it('answers with somewhere to put it and a row that expects it', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    expect(prepared.uploadUrl).toBe('https://store.test/put');
    expect(prepared.fileId).toHaveLength(36);
  });

  it('starts the row INITIAL, because nothing has arrived', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    expect((await files.get(lokal, prepared.fileId)).status).toBe('INITIAL');
  });

  it('relays the caller’s token', async () => {
    // aether can obtain nothing from loculus that the person could not have
    // obtained themselves.
    await files.prepare(lokal, upload, 'a-token');

    expect(loculus.asked[0].token).toBe('a-token');
  });

  it('takes the organization from the actor, not the request', async () => {
    /*
     * Provenance dictated by the thing being recorded is worth nothing. A
     * caller that names somebody else's organization is ignored rather than
     * refused — there is nothing to refuse, since the field was never theirs.
     */
    await files.prepare(
      lokal,
      { ...upload, organizationId: '99999999-9999-4999-8999-999999999999' },
      'a-token',
    );

    expect(loculus.asked[0].request).toMatchObject({
      organizationId: 'org-1',
    });
  });

  it('writes no row when the store cannot be reached', async () => {
    /*
     * The row goes in after loculus answers. The other order would leave a row
     * behind every time the store was down, and those would be
     * indistinguishable from uploads somebody abandoned.
     */
    loculus.failing = true;

    await expect(files.prepare(lokal, upload, 'a-token')).rejects.toThrow();

    expect(await database.repository(StoredFile).count()).toBe(0);
  });
});

describe('claiming an upload', () => {
  it('records that the bytes arrived', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    expect((await files.markUploaded(lokal, prepared.fileId)).status).toBe(
      'UPLOADED',
    );
  });

  it('refuses one from another organization', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    await expect(files.markUploaded(other, prepared.fileId)).rejects.toThrow(
      NotFoundException,
    );
  });
});

/*
 * The other way in, for loculus's `object.uploaded`. No actor and no id: an
 * event has neither, and the key is loculus's own — see the method.
 */
describe('claiming an upload on the store’s word', () => {
  it('records that the bytes arrived', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    const settled = await files.markUploadedByKey(prepared.objectKey);

    expect(settled?.status).toBe('UPLOADED');
    expect((await files.get(lokal, prepared.fileId)).status).toBe('UPLOADED');
  });

  it('has nothing to say about a key it never handed out', async () => {
    // Another service's object in the shared bucket. Ordinary, not an error.
    await expect(
      files.markUploadedByKey('akouo/org-1/someone-elses.wav'),
    ).resolves.toBeNull();
  });

  it('leaves a settled row alone rather than touching it again', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');
    const first = await files.markUploadedByKey(prepared.objectKey);

    const again = await files.markUploadedByKey(prepared.objectKey);

    /*
     * At-least-once delivery means this runs more than once for one upload.
     * Saving again would move `updatedAt` and make the file look freshly
     * changed every time the broker repeated itself.
     */
    expect(again?.updatedAt).toBe(first?.updatedAt);
  });
});

describe('what the api hands back', () => {
  it('keeps the key and the backend to itself', async () => {
    /*
     * They are how aether finds the bytes, not anything a client should hold:
     * a client that knew the key would start building URLs from it, and those
     * URLs are loculus's to sign.
     */
    const prepared = await files.prepare(lokal, upload, 'a-token');
    const file = await files.get(lokal, prepared.fileId);

    expect(file).not.toHaveProperty('key');
    expect(file).not.toHaveProperty('backend');
    expect(file).not.toHaveProperty('organizationId');
  });

  it('says what was uploaded', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    expect(await files.get(lokal, prepared.fileId)).toMatchObject({
      originalName: 'intake-spec.pdf',
      mimeType: 'application/pdf',
      size: 4096,
    });
  });
});

describe('removing one', () => {
  it('deletes the object before the row', async () => {
    /*
     * The other order can leave bytes nobody can name or reach. This one can
     * at worst leave a row whose object is gone, which reads as a broken file
     * rather than as silent cost.
     */
    const prepared = await files.prepare(lokal, upload, 'a-token');

    await files.remove(lokal, prepared.fileId, 'a-token');

    expect(loculus.removed).toEqual(['aether/org-1/a-file.pdf']);
    expect(await database.repository(StoredFile).count()).toBe(0);
  });

  it('answers 404 for one this organization does not have', async () => {
    const prepared = await files.prepare(lokal, upload, 'a-token');

    await expect(
      files.remove(other, prepared.fileId, 'a-token'),
    ).rejects.toThrow(NotFoundException);
  });
});
