import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_AVAILABILITY_CONCURRENCY,
  ATTACHMENT_AVAILABILITY_MAX_CANDIDATES,
  resolveAttachmentAvailability,
} from './attachment-availability.js';

const candidates = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    r2Key: `attachments/default/2026-08/synthetic-${index}.jpg`,
    objectDeletedAt: null,
  }));

describe('attachment response-time availability', () => {
  it('900 exact-key HEADを最大4並列に制限しbucket listを呼ばない', async () => {
    let active = 0;
    let peak = 0;
    let headCalls = 0;
    let listCalls = 0;
    const bucket = new Proxy({} as R2Bucket, {
      get(_target, property) {
        if (property === 'head')
          return async () => {
            headCalls += 1;
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 2));
            active -= 1;
            return {} as R2Object;
          };
        if (property === 'list')
          return async () => {
            listCalls += 1;
            throw new Error('bucket scan must not run');
          };
        return undefined;
      },
    });

    const result = await resolveAttachmentAvailability(
      bucket,
      candidates(ATTACHMENT_AVAILABILITY_MAX_CANDIDATES),
    );
    expect(ATTACHMENT_AVAILABILITY_CONCURRENCY).toBe(4);
    expect(peak).toBe(4);
    expect(headCalls).toBe(900);
    expect(listCalls).toBe(0);
    expect([...result.values()].every(Boolean)).toBe(true);
  });

  it('object_deleted_at済みkeyはHEADせずavailability falseを維持する', async () => {
    let headCalls = 0;
    const bucket = {
      head: async () => {
        headCalls += 1;
        return null;
      },
    } as unknown as R2Bucket;
    const availability = await resolveAttachmentAvailability(bucket, [
      { r2Key: 'attachments/default/2026-08/deleted.jpg', objectDeletedAt: '2026-08-27T00:00:00.000Z' },
    ]);
    expect(availability.get('attachments/default/2026-08/deleted.jpg')).toBe(false);
    expect(headCalls).toBe(0);
  });

  it('901 unique active候補はHEAD前にstructured 503相当でfail closedする', async () => {
    let headCalls = 0;
    const bucket = {
      head: async () => {
        headCalls += 1;
        return null;
      },
    } as unknown as R2Bucket;
    await expect(
      resolveAttachmentAvailability(bucket, candidates(ATTACHMENT_AVAILABILITY_MAX_CANDIDATES + 1)),
    ).rejects.toMatchObject({ reason: 'candidate_limit' });
    expect(headCalls).toBe(0);
  });
});
