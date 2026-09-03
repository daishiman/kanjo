import type { AuthEnv } from './auth.js';

/** 改善要望の画像prefix外に置き、自分自身を孤児判定へ混ぜない。 */
export const IMPROVEMENT_ORPHAN_CHECKPOINT_KEY = 'maintenance/improvement-orphan-sweep.v1.json';
export const IMPROVEMENT_ORPHAN_GRACE_MS = 5 * 60_000;

/**
 * 1回の孤児照合で触るR2 object数。R2 keyは最大1024 bytesで、全byteがJSONで6 bytesへ
 * escapeされる最悪時も `300 * (6 * 1024 + quotes/comma) + brackets = 1,844,101`
 * bytesとなり、D1 string value上限2,000,000 bytesへ155,899 bytesの余白を残す。
 */
export const IMPROVEMENT_ORPHAN_SCAN_LIMIT = 300;
export const IMPROVEMENT_ORPHAN_LOOKUP_MAX_BYTES = 2_000_000;

const IMPROVEMENT_ORPHAN_CHECKPOINT_VERSION = 1;
const IMPROVEMENT_ORPHAN_CHECKPOINT_MAX_BYTES = 64 * 1024;

interface ImprovementOrphanCheckpoint {
  version: typeof IMPROVEMENT_ORPHAN_CHECKPOINT_VERSION;
  cursor: string;
}

export interface ImprovementOrphanSweepResult {
  removed: number;
  scanned: number;
  deferredRecent: number;
  hasMore: boolean;
  cycleCompleted: boolean;
}

/** D1へbindする直前にも実UTF-8 byte数を検査し、platform/fixture逸脱をfail-closedにする。 */
export function serializeImprovementOrphanLookupKeys(keys: readonly string[]): string {
  const serialized = JSON.stringify(keys);
  if (new TextEncoder().encode(serialized).byteLength >= IMPROVEMENT_ORPHAN_LOOKUP_MAX_BYTES)
    throw new Error('improvement_orphan_lookup_payload_too_large');
  return serialized;
}

const checkpointError = (): Error => new Error('invalid_improvement_orphan_checkpoint');

function parseCheckpoint(raw: string): ImprovementOrphanCheckpoint {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw checkpointError();
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== IMPROVEMENT_ORPHAN_CHECKPOINT_VERSION ||
    !('cursor' in value) ||
    typeof value.cursor !== 'string' ||
    value.cursor.length === 0
  )
    throw checkpointError();
  return { version: IMPROVEMENT_ORPHAN_CHECKPOINT_VERSION, cursor: value.cursor };
}

async function loadCheckpoint(files: R2Bucket): Promise<ImprovementOrphanCheckpoint | undefined> {
  const object = await files.get(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY);
  if (!object) return undefined;
  if (object.size > IMPROVEMENT_ORPHAN_CHECKPOINT_MAX_BYTES) throw checkpointError();
  const raw = await object.text();
  if (new TextEncoder().encode(raw).byteLength > IMPROVEMENT_ORPHAN_CHECKPOINT_MAX_BYTES)
    throw checkpointError();
  return parseCheckpoint(raw);
}

async function saveCheckpoint(files: R2Bucket, cursor: string): Promise<void> {
  const payload = JSON.stringify({ version: IMPROVEMENT_ORPHAN_CHECKPOINT_VERSION, cursor });
  if (new TextEncoder().encode(payload).byteLength > IMPROVEMENT_ORPHAN_CHECKPOINT_MAX_BYTES)
    throw checkpointError();
  await files.put(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY, payload, {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * R2の1 pageだけを掃除し、opaque cursorを次の夜間実行へ引き継ぐ。
 * checkpoint更新はD1照合と全R2削除の後に行うため、途中失敗時は同じpageを再試行する。
 */
export async function sweepImprovementOrphans(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  nowMs: number,
): Promise<ImprovementOrphanSweepResult> {
  const checkpoint = await loadCheckpoint(env.FILES);
  const listed = await env.FILES.list({
    prefix: 'improvements/',
    limit: IMPROVEMENT_ORPHAN_SCAN_LIMIT,
    ...(checkpoint ? { cursor: checkpoint.cursor } : {}),
  });
  const listedKeys = listed.objects.map((object) => object.key);
  let live = new Set<string>();
  if (listedKeys.length) {
    // guardはD1 prepare/deleteより前。超過時はobjectを一切消さずjob-level rejectへする。
    const serializedKeys = serializeImprovementOrphanLookupKeys(listedKeys);
    const rows = await env.DB.prepare(
      `SELECT screenshot_key
         FROM improvement_requests
        WHERE screenshot_key IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
    )
      .bind(serializedKeys)
      .all<{ screenshot_key: string }>();
    live = new Set(rows.results.map((row) => row.screenshot_key));
  }

  let deferredRecent = 0;
  const removeKeys: string[] = [];
  for (const object of listed.objects) {
    if (live.has(object.key)) continue;
    const uploadedMs = object.uploaded.getTime();
    // 不正なtimestampは古いと推測して消さず、次回も検査できる状態を保つ。
    if (!Number.isFinite(uploadedMs) || nowMs - uploadedMs < IMPROVEMENT_ORPHAN_GRACE_MS) {
      deferredRecent += 1;
      continue;
    }
    removeKeys.push(object.key);
  }
  // R2は最大1000 keyを1 callで消せる。page上限300なので1 subrequestに収まる。
  if (removeKeys.length) await env.FILES.delete(removeKeys);

  if (listed.truncated) {
    await saveCheckpoint(env.FILES, listed.cursor);
  } else if (checkpoint) {
    await env.FILES.delete(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY);
  }

  return {
    removed: removeKeys.length,
    scanned: listed.objects.length,
    deferredRecent,
    hasMore: listed.truncated,
    cycleCompleted: !listed.truncated,
  };
}
