import { zValidator } from '@hono/zod-validator';
/**
 * 照合画面の読み込み・まとめた判断・直前の操作の取り消し。
 *
 * 状態 (未処理・要確認・照合済み・MFのみ・除外) は `@kanjo/core` の reconciliationReport が毎回導出する。
 * ここで保存するのは利用者の判断 (同じ / 違う / MF 除外 / freee 除外) と、その 1 回ぶんの直前の行だけ。
 * 判断の表は総収支の画面と共有するので、どちらで判断しても同じ明細に効く。
 */
import {
  type Dataset,
  type DuplicateVerdict,
  type FreeeDeal,
  type FreeeExclusion,
  type MfTx,
  STABLE_KEY_VERSION,
  freeeDealKeys,
  isPairableFreee,
  mfStableKey,
  reconcileBizDuplicates,
  reconciliationReport,
} from '@kanjo/core';
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import { D1_MAX_BOUND_PARAMS } from '../d1-limits.js';
import * as s from '../db/schema.js';
import { type Db, dealFromRow, getDb } from '../store.js';
import { loadScoped } from './analytics.js';
import { bindDuplicateVerdicts, bindMfExclusions } from './duplicate-verdict-bindings.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const reconciliationRoute = new Hono<Ctx>();

export const RECONCILIATION_ACTIONS = ['same', 'different', 'exclude-mf', 'exclude-freee'] as const;
export type ReconciliationAction = (typeof RECONCILIATION_ACTIONS)[number];

/** 1 回にまとめて判断できる件数。画面の「すべて選択」が 1 往復で届く幅 */
export const MAX_RECONCILIATION_TARGETS = 200;

/** 操作の記録を残す日数。直前の操作を戻す以外に使わないので、これより古い行は読まない */
export const RECONCILIATION_ACTION_RETENTION_DAYS = 90;

/** 照合画面から外したときの理由。後から総収支の画面で見ても、どこで外したかが読める */
const EXCLUDE_REASON = '照合画面で除外';

type VerdictRow = typeof s.duplicateVerdicts.$inferSelect;
type MfExclusionRow = typeof s.mfTxExclusions.$inferSelect;
type FreeeExclusionRow = typeof s.freeeDealExclusions.$inferSelect;

/** 取り消しで書き戻す直前の行。null は「その行は無かった」= 取り消しで消す */
interface ActionSnapshot {
  verdicts: Array<{ txId: string; row: VerdictRow | null }>;
  mfExclusions: Array<{ txId: string; row: MfExclusionRow | null }>;
  freeeExclusions: Array<{ freeeKey: string; row: FreeeExclusionRow | null }>;
}

/** 操作が書いた直後の状態。取り消しの前に、今の行がこのままかを確かめる */
interface ActionOutcome {
  verdicts: Array<{ txId: string; verdict: string; freeeKey: string | null }>;
  mfExclusions: Array<{ txId: string }>;
  mfExclusionDeletes: string[];
  freeeExclusions: Array<{ freeeKey: string }>;
}

const apiError = (code: string, message: string) => ({ error: { code, message } });

/**
 * 1 文の多重 VALUES に載せられる行数。D1 は 1 文あたりのバインドを 100 に制限するので、
 * 列数で割った数を超えたら文を分ける (総収支の除外と同じ規則)。
 */
const rowsPerStatement = (columns: number) => Math.floor(D1_MAX_BOUND_PARAMS / columns);
/** IN 句に並べられる鍵の数。user_id の 1 個を差し引く */
const KEYS_PER_DELETE = D1_MAX_BOUND_PARAMS - 1;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < items.length; at += size) out.push(items.slice(at, at + size));
  return out;
}

/** 直前の操作。同じミリ秒に 2 件入っても rowid で後の方を取る */
async function latestAction(db: Db, userId: string) {
  const [row] = await db
    .select()
    .from(s.reconciliationActions)
    .where(eq(s.reconciliationActions.userId, userId))
    .orderBy(desc(s.reconciliationActions.createdAt), desc(sql`rowid`))
    .limit(1);
  return row ?? null;
}

reconciliationRoute.get('/reconciliation', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { data, all, period } = await loadScoped(c);

  const [dealRows, verdictRows, exclusionRows, mfExclusionRows, last] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
    db.select().from(s.mfTxExclusions).where(eq(s.mfTxExclusions.userId, userId)),
    latestAction(db, userId),
  ]);
  const freeeExclusions: FreeeExclusion[] = exclusionRows.map((row) => ({
    freeeKey: row.freeeKey,
    reason: row.reason,
  }));

  // 消し込みは全期間で行い、表示だけを期間の月に絞る。先に期間で切ると月境界 (±3 日) の組が割れ、
  // 期間を問わない未処理キュー・月次クローズ・ハブの件数とずれる
  const report = reconciliationReport({
    data: all,
    deals: dealRows.map(dealFromRow),
    verdicts: bindDuplicateVerdicts(verdictRows, all.mfTx),
    freeeExclusions,
    mfExclusions: bindMfExclusions(mfExclusionRows, all.mfTx),
    months: data.months,
  });
  return c.json({
    period,
    ...report,
    // 取り消し済みの操作は「元に戻す」を出さない。その前の操作までは遡らない (取り消しは 1 段だけ)
    lastAction:
      last && !last.undoneAt
        ? { id: last.id, action: last.action, targetCount: last.targetCount, createdAt: last.createdAt }
        : null,
  });
});

const targetSchema = z
  .object({
    txId: z.string().trim().min(1).max(120).optional(),
    /** 上限を長めに取るのは、鍵の材料に支払先名や勘定科目名がそのまま入るため */
    freeeKey: z.string().trim().min(1).max(2_000).optional(),
  })
  .refine((target) => target.txId !== undefined || target.freeeKey !== undefined, {
    message: 'txId か freeeKey のどちらかが必要です',
  });

const actionSchema = z.object({
  action: z.enum(RECONCILIATION_ACTIONS),
  targets: z.array(targetSchema).min(1).max(MAX_RECONCILIATION_TARGETS),
});

type TargetResult = { txId: string | null; freeeKey: string | null; ok: boolean; reason?: string };

type VerdictPlan = {
  /** results の何番目の応答か。組めないと分かったら、ここを失敗に書き換える */
  resultIndex: number;
  tx: MfTx;
  rowTxId: string;
  decision: 'same' | 'different';
  verdict: VerdictRow | null;
  mfExclusion: MfExclusionRow | null;
  freeeKey: string | null;
};

/**
 * 「同じ」を保存したら、本当に照合済みになるかを判定器で試す。組めない件と理由を返す。
 *
 * 形の検査 (相手がある・向きと日付が合う) を通っても、相手の freee が除外済みだったり、
 * 同額同日の別の明細や同じ回の別の選択に先に取られていたりすると、判定器は組ませない。
 * それを ok と返すと、利用者は「照合した」のに一覧から消えない行を前に打つ手を失う。
 * 落とした件を外すと残りの組み方が変わり得るので、結果が動かなくなるまで試し直す。
 */
function unmatchableSamePlans(input: {
  data: Dataset;
  deals: readonly FreeeDeal[];
  verdicts: readonly DuplicateVerdict[];
  freeeExclusions: readonly FreeeExclusion[];
  mfExcludedTxIds: readonly string[];
  plans: readonly VerdictPlan[];
}): Map<VerdictPlan, string> {
  const failed = new Map<VerdictPlan, string>();
  const excludedKeys = new Set(input.freeeExclusions.map((row) => row.freeeKey));
  let live = [...input.plans];
  while (live.length > 0) {
    const proposed = new Map(live.map((plan) => [plan.tx.id, plan.freeeKey]));
    const verdicts: DuplicateVerdict[] = [
      ...input.verdicts.filter((v) => !proposed.has(v.txId)),
      ...[...proposed].map(([txId, freeeKey]) => ({ txId, verdict: 'same' as const, freeeKey })),
    ];
    // 「同じ」と判断した明細は除外を解いて保存するので、試すときも除外から外す
    const mfExcluded = input.mfExcludedTxIds.filter((txId) => !proposed.has(txId));
    const { matched } = reconcileBizDuplicates(
      input.data,
      input.deals,
      verdicts,
      input.freeeExclusions,
      mfExcluded,
    );
    const pairedKeyByTx = new Map(matched.map((m) => [m.mfTxId, m.freeeKey]));
    const pairedKeys = new Set(matched.map((m) => m.freeeKey));
    const round = live.filter((plan) => pairedKeyByTx.get(plan.tx.id) !== plan.freeeKey);
    if (round.length === 0) break;
    for (const plan of round) {
      const key = plan.freeeKey!;
      failed.set(
        plan,
        excludedKeys.has(key)
          ? 'freee_excluded'
          : pairedKeys.has(key)
            ? 'freee_already_matched'
            : 'not_matchable',
      );
    }
    live = live.filter((plan) => !failed.has(plan));
  }
  return failed;
}

/**
 * 選んだ明細へ同じ判断をまとめて適用する。
 *
 * 保存できない明細 (見つからない・鍵が足りない) は件ごとに理由を返し、残りは保存する。
 * 1 件の不備で全件を突き返すと、200 件選んだ利用者は原因の 1 件を探す手段を持たない。
 * 書き込みは判断・除外・操作の記録を 1 回の batch に畳み、途中で落ちても半分だけ残らないようにする。
 */
reconciliationRoute.post('/reconciliation/actions', zValidator('json', actionSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { action, targets } = c.req.valid('json');
  const { all } = await loadScoped(c);

  const [dealRows, verdictRows, mfExclusionRows, freeeExclusionRows] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.mfTxExclusions).where(eq(s.mfTxExclusions.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
  ]);
  const deals = dealRows.map(dealFromRow);
  const dealByKey = new Map(freeeDealKeys(deals).map((key, index) => [key, deals[index]!]));
  const txById = new Map(all.mfTx.map((tx) => [tx.id, tx]));
  const verdicts = bindDuplicateVerdicts(verdictRows, all.mfTx);
  const mfExclusions = bindMfExclusions(mfExclusionRows, all.mfTx);
  const freeeExclusions: FreeeExclusion[] = freeeExclusionRows.map((row) => ({
    freeeKey: row.freeeKey,
    reason: row.reason,
  }));
  const currentReport = reconciliationReport({
    data: all,
    deals,
    verdicts,
    freeeExclusions,
    mfExclusions,
  });
  /**
   * 書き込み可否も読み取りと同じ report に聞く。MFのみ・自動照合済み・家計明細へ
   * 古い画面の選択を送れても、現在は対応不要の明細に判断や除外を残さない。ただし、MF 除外を解いて
   * 「同じ / 違う」へ判断し直す既存経路は残すため、MF 除外だけを外したときに要確認 / 未処理へ戻る行も対象とする。
   */
  const actionableReport =
    mfExclusions.length === 0
      ? currentReport
      : reconciliationReport({
          data: all,
          deals,
          verdicts,
          freeeExclusions,
          mfExclusions: [],
        });
  const actionableRows = new Map(
    actionableReport.rows
      .filter((row) => row.status === 'review' || row.status === 'unprocessed')
      .map((row) => [row.txId, row] as const),
  );
  const actionableFreeeKeys = new Set(currentReport.unmatchedFreee.map((row) => row.freeeKey));
  const stableKeyCount = new Map<string, number>();
  for (const tx of all.mfTx) {
    const key = mfStableKey(tx);
    stableKeyCount.set(key, (stableKeyCount.get(key) ?? 0) + 1);
  }
  const currentVersion = (
    row: { stableKey: string | null; fingerprintVersion: number | null },
    key: string,
  ) => row.stableKey === key && (row.fingerprintVersion ?? STABLE_KEY_VERSION) === STABLE_KEY_VERSION;

  const now = new Date().toISOString();
  const results: TargetResult[] = [];
  const before: ActionSnapshot = { verdicts: [], mfExclusions: [], freeeExclusions: [] };
  const verdictWrites: (typeof s.duplicateVerdicts.$inferInsert)[] = [];
  const mfExclusionWrites: (typeof s.mfTxExclusions.$inferInsert)[] = [];
  const mfExclusionDeletes: string[] = [];
  const freeeExclusionWrites: (typeof s.freeeDealExclusions.$inferInsert)[] = [];
  /** 同じ行を 1 文の中で二度書くと SQLite が拒むので、行の鍵ごとに 1 回だけ書く */
  const claimed = new Set<string>();
  /** 同じ / 違う の判断。「同じ」は判定器で試してから書くので、いったん計画として貯める */
  const verdictPlans: VerdictPlan[] = [];

  for (const target of targets) {
    const result = (ok: boolean, reason?: string): TargetResult => ({
      txId: target.txId ?? null,
      freeeKey: target.freeeKey ?? null,
      ok,
      ...(reason ? { reason } : {}),
    });

    if (action === 'exclude-freee') {
      const freeeKey = target.freeeKey;
      if (!freeeKey) {
        results.push(result(false, 'freee_key_required'));
        continue;
      }
      if (!dealByKey.has(freeeKey)) {
        results.push(result(false, 'not_found'));
        continue;
      }
      if (!actionableFreeeKeys.has(freeeKey)) {
        results.push(result(false, 'target_not_actionable'));
        continue;
      }
      // 同じ明細を 1 回に二度送った件は、先の件だけを保存する。後の件を ok と返すと件数が合わない
      if (claimed.has(`freee:${freeeKey}`)) {
        results.push(result(false, 'duplicate_target'));
        continue;
      }
      results.push(result(true));
      claimed.add(`freee:${freeeKey}`);
      const existing = freeeExclusionRows.find((row) => row.freeeKey === freeeKey) ?? null;
      before.freeeExclusions.push({ freeeKey, row: existing });
      freeeExclusionWrites.push({
        userId,
        freeeKey,
        reason: existing?.reason ?? EXCLUDE_REASON,
        // いつ外したかは最初の値を保つ
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      continue;
    }

    const tx = target.txId ? txById.get(target.txId) : undefined;
    if (!target.txId || !tx) {
      results.push(result(false, target.txId ? 'not_found' : 'tx_id_required'));
      continue;
    }
    const actionableRow = actionableRows.get(tx.id);
    if (!actionableRow) {
      results.push(result(false, 'target_not_actionable'));
      continue;
    }
    // 「別の取引」は、画面に見えている freee 候補との関係を否定する判断。
    // 候補の無い要確認 (取込月と表示月の不一致など) に保存すると、再導出後に MFのみに落ちて
    // 成功と返した操作の意味が失われるため、同じ取引と同様に候補必須とする。
    if (
      action === 'different' &&
      !actionableRow.freee?.freeeKey &&
      actionableRow.candidateKeys.length === 0
    ) {
      results.push(result(false, 'no_candidate'));
      continue;
    }
    const stableKey = mfStableKey(tx);
    // 識別子が不安定で stable_key も衝突する明細は、再取込後に引き直せない。保存できたように見せない
    if (!tx.idStable && (stableKeyCount.get(stableKey) ?? 0) > 1) {
      results.push(result(false, 'unstable_identity'));
      continue;
    }
    if (action === 'same') {
      // 相手の無い「同じ」を保存しても照合済みにはならない。保存できたように見せず、理由を返す
      const partner = target.freeeKey ? dealByKey.get(target.freeeKey) : undefined;
      if (!target.freeeKey) {
        results.push(result(false, 'no_candidate'));
        continue;
      }
      if (!partner) {
        results.push(result(false, 'freee_not_found'));
        continue;
      }
      // 向き違い・±3 日の外の相手は照合の規則で組めない (core の isPairableFreee と同じ規則)
      if (!isPairableFreee(tx, partner)) {
        results.push(result(false, 'freee_not_pairable'));
        continue;
      }
    }

    // tx_id が振り直されていても、同じ stable_key の既存行があればそれを書き換える (行を増やさない)
    const mfExclusion =
      mfExclusionRows.find((row) => row.txId === tx.id) ??
      mfExclusionRows.find((row) => currentVersion(row, stableKey)) ??
      null;

    if (action === 'exclude-mf') {
      const rowTxId = mfExclusion?.txId ?? tx.id;
      if (claimed.has(`mf:${rowTxId}`)) {
        results.push(result(false, 'duplicate_target'));
        continue;
      }
      results.push(result(true));
      claimed.add(`mf:${rowTxId}`);
      before.mfExclusions.push({ txId: rowTxId, row: mfExclusion });
      mfExclusionWrites.push({
        userId,
        txId: rowTxId,
        stableKey,
        fingerprintVersion: STABLE_KEY_VERSION,
        reason: mfExclusion?.reason ?? EXCLUDE_REASON,
        createdAt: mfExclusion?.createdAt ?? now,
      });
      continue;
    }

    const verdict =
      verdictRows.find((row) => row.txId === tx.id) ??
      verdictRows.find((row) => currentVersion(row, stableKey)) ??
      null;
    const rowTxId = verdict?.txId ?? tx.id;
    if (claimed.has(`verdict:${rowTxId}`)) {
      results.push(result(false, 'duplicate_target'));
      continue;
    }
    claimed.add(`verdict:${rowTxId}`);
    verdictPlans.push({
      resultIndex: results.length,
      tx,
      rowTxId,
      decision: action,
      verdict,
      mfExclusion,
      // 「違う」の名指しは意味を持たない。持たせると、後で「同じ」に変えたとき古い相手が復活する
      freeeKey: action === 'same' ? (target.freeeKey ?? null) : null,
    });
    results.push(result(true));
  }

  const unmatchable =
    action === 'same'
      ? unmatchableSamePlans({
          data: all,
          deals,
          verdicts,
          freeeExclusions,
          mfExcludedTxIds: mfExclusions.map((row) => row.txId),
          plans: verdictPlans,
        })
      : new Map<VerdictPlan, string>();
  for (const plan of verdictPlans) {
    const reason = unmatchable.get(plan);
    if (reason) {
      results[plan.resultIndex] = { ...results[plan.resultIndex]!, ok: false, reason };
      claimed.delete(`verdict:${plan.rowTxId}`);
      continue;
    }
    before.verdicts.push({ txId: plan.rowTxId, row: plan.verdict });
    verdictWrites.push({
      userId,
      txId: plan.rowTxId,
      verdict: plan.decision,
      stableKey: mfStableKey(plan.tx),
      fingerprintVersion: STABLE_KEY_VERSION,
      freeeKey: plan.freeeKey,
      decidedAt: plan.verdict?.decidedAt ?? now,
      updatedAt: now,
    });
    // 同じ / 違うと判断した明細は、もう突合から外しておく理由が無い。除外を解いて判断を効かせる
    const { mfExclusion } = plan;
    if (mfExclusion && !claimed.has(`mf:${mfExclusion.txId}`)) {
      claimed.add(`mf:${mfExclusion.txId}`);
      before.mfExclusions.push({ txId: mfExclusion.txId, row: mfExclusion });
      mfExclusionDeletes.push(mfExclusion.txId);
    }
  }

  const saved = claimed.size - mfExclusionDeletes.length;
  if (saved === 0) return c.json({ results, saved: 0, action: null });

  const id = crypto.randomUUID();
  const statements: BatchItem<'sqlite'>[] = [
    ...chunks(verdictWrites, rowsPerStatement(8)).map((rows) =>
      db
        .insert(s.duplicateVerdicts)
        .values(rows)
        .onConflictDoUpdate({
          target: [s.duplicateVerdicts.userId, s.duplicateVerdicts.txId],
          set: {
            verdict: sql`excluded.verdict`,
            stableKey: sql`excluded.stable_key`,
            fingerprintVersion: sql`excluded.fingerprint_version`,
            freeeKey: sql`excluded.freee_key`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    ...chunks(mfExclusionWrites, rowsPerStatement(6)).map((rows) =>
      db
        .insert(s.mfTxExclusions)
        .values(rows)
        .onConflictDoUpdate({
          target: [s.mfTxExclusions.userId, s.mfTxExclusions.txId],
          set: {
            stableKey: sql`excluded.stable_key`,
            fingerprintVersion: sql`excluded.fingerprint_version`,
          },
        }),
    ),
    ...chunks(mfExclusionDeletes, KEYS_PER_DELETE).map((txIds) =>
      db
        .delete(s.mfTxExclusions)
        .where(and(eq(s.mfTxExclusions.userId, userId), inArray(s.mfTxExclusions.txId, txIds))),
    ),
    ...chunks(freeeExclusionWrites, rowsPerStatement(5)).map((rows) =>
      db
        .insert(s.freeeDealExclusions)
        .values(rows)
        .onConflictDoUpdate({
          target: [s.freeeDealExclusions.userId, s.freeeDealExclusions.freeeKey],
          set: { updatedAt: sql`excluded.updated_at` },
        }),
    ),
    db.insert(s.reconciliationActions).values({
      id,
      userId,
      action,
      targetCount: saved,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify({
        verdicts: verdictWrites.map((row) => ({
          txId: row.txId,
          verdict: row.verdict,
          freeeKey: row.freeeKey ?? null,
        })),
        mfExclusions: mfExclusionWrites.map((row) => ({ txId: row.txId })),
        mfExclusionDeletes,
        freeeExclusions: freeeExclusionWrites.map((row) => ({ freeeKey: row.freeeKey })),
      } satisfies ActionOutcome),
      createdAt: now,
    }),
    // 90 日より古い操作の記録を同じ batch で消す。夜間 cron の D1 予算 (47/47) を使わずに保持期間を守る。
    // 記録が増えるのは操作したときだけなので、操作のたびに掃除すれば行数は有界に留まる
    db
      .delete(s.reconciliationActions)
      .where(
        and(
          eq(s.reconciliationActions.userId, userId),
          lt(
            s.reconciliationActions.createdAt,
            new Date(Date.parse(now) - RECONCILIATION_ACTION_RETENTION_DAYS * 86_400_000).toISOString(),
          ),
        ),
      ),
  ];
  await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
  return c.json({ results, saved, action: { id, action, targetCount: saved, createdAt: now } });
});

const snapshotSchema = z.object({
  verdicts: z.array(z.object({ txId: z.string(), row: z.unknown() })).default([]),
  mfExclusions: z.array(z.object({ txId: z.string(), row: z.unknown() })).default([]),
  freeeExclusions: z.array(z.object({ freeeKey: z.string(), row: z.unknown() })).default([]),
});

const outcomeSchema = z.object({
  verdicts: z
    .array(z.object({ txId: z.string(), verdict: z.string(), freeeKey: z.string().nullable() }))
    .default([]),
  mfExclusions: z.array(z.object({ txId: z.string() })).default([]),
  mfExclusionDeletes: z.array(z.string()).default([]),
  freeeExclusions: z.array(z.object({ freeeKey: z.string() })).default([]),
});

/** 保存した JSON を読む。壊れた記録は 500 にせず、呼び出し側で「読めない記録」として扱う */
function parseStored<S extends z.ZodTypeAny>(schema: S, json: string): z.output<S> | null {
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * 今の行が、操作の直後に書いた状態のままか。
 *
 * 違っていれば、その後に総収支の画面での判断・復元・別の保存が同じ行を書き換えている。
 * そのまま操作前の行で上書きすると後の変更が黙って消えるので、取り消さない。
 */
function outcomeStillCurrent(
  outcome: ActionOutcome,
  current: { verdicts: VerdictRow[]; mfExclusions: MfExclusionRow[]; freeeExclusions: FreeeExclusionRow[] },
): boolean {
  const verdictByTxId = new Map(current.verdicts.map((row) => [row.txId, row]));
  const mfExcluded = new Set(current.mfExclusions.map((row) => row.txId));
  const freeeExcluded = new Set(current.freeeExclusions.map((row) => row.freeeKey));
  return (
    outcome.verdicts.every((entry) => {
      const row = verdictByTxId.get(entry.txId);
      return row !== undefined && row.verdict === entry.verdict && (row.freeeKey ?? null) === entry.freeeKey;
    }) &&
    outcome.mfExclusions.every((entry) => mfExcluded.has(entry.txId)) &&
    outcome.mfExclusionDeletes.every((txId) => !mfExcluded.has(txId)) &&
    outcome.freeeExclusions.every((entry) => freeeExcluded.has(entry.freeeKey))
  );
}

/** 操作 id は POST が crypto.randomUUID で振る。形の違う値は照会せずに 400 で返す */
const actionIdSchema = z.string().uuid();

/**
 * 直前の操作を 1 段だけ取り消す。
 *
 * 取り消せるのは最新の操作だけにする。古い操作を取り消すと、その後の操作が書いた行を
 * 古い直前の行で上書きし、後の判断が黙って消える。
 */
reconciliationRoute.post('/reconciliation/actions/:id/undo', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  if (!actionIdSchema.safeParse(id).success) {
    return c.json(apiError('invalid_action_id', '操作の指定が正しくありません'), 400);
  }

  const [target] = await db
    .select()
    .from(s.reconciliationActions)
    .where(and(eq(s.reconciliationActions.id, id), eq(s.reconciliationActions.userId, userId)));
  // 他人の操作 id は「存在しない」と同じ応答にする。有無そのものを教えない
  if (!target) return c.json(apiError('action_not_found', '操作が見つかりません'), 404);
  if (target.undoneAt) return c.json(apiError('action_already_undone', 'この操作は取り消し済みです'), 409);
  const latest = await latestAction(db, userId);
  if (latest?.id !== target.id) {
    return c.json(apiError('action_not_latest', '取り消せるのは直前の操作だけです'), 409);
  }

  const snapshot = parseStored(snapshotSchema, target.beforeJson) as ActionSnapshot | null;
  const outcome = parseStored(outcomeSchema, target.afterJson);
  if (!snapshot || !outcome) {
    return c.json(apiError('action_snapshot_invalid', '操作の記録を読めません'), 409);
  }

  const [verdictRows, mfExclusionRows, freeeExclusionRows] = await Promise.all([
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.mfTxExclusions).where(eq(s.mfTxExclusions.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
  ]);
  if (
    !outcomeStillCurrent(outcome, {
      verdicts: verdictRows,
      mfExclusions: mfExclusionRows,
      freeeExclusions: freeeExclusionRows,
    })
  ) {
    return c.json(
      apiError('action_stale', 'この操作の後に同じ明細の判断が変わったため、元に戻せません'),
      409,
    );
  }

  const restoreVerdicts = snapshot.verdicts.flatMap((entry) => (entry.row ? [entry.row] : []));
  const dropVerdicts = snapshot.verdicts.filter((entry) => !entry.row).map((entry) => entry.txId);
  const restoreMf = snapshot.mfExclusions.flatMap((entry) => (entry.row ? [entry.row] : []));
  const dropMf = snapshot.mfExclusions.filter((entry) => !entry.row).map((entry) => entry.txId);
  const restoreFreee = snapshot.freeeExclusions.flatMap((entry) => (entry.row ? [entry.row] : []));
  const dropFreee = snapshot.freeeExclusions.filter((entry) => !entry.row).map((entry) => entry.freeeKey);
  const now = new Date().toISOString();

  const statements: BatchItem<'sqlite'>[] = [
    ...chunks(dropVerdicts, KEYS_PER_DELETE).map((txIds) =>
      db
        .delete(s.duplicateVerdicts)
        .where(and(eq(s.duplicateVerdicts.userId, userId), inArray(s.duplicateVerdicts.txId, txIds))),
    ),
    ...chunks(restoreVerdicts, rowsPerStatement(8)).map((rows) =>
      db
        .insert(s.duplicateVerdicts)
        .values(rows.map((row) => ({ ...row, userId })))
        .onConflictDoUpdate({
          target: [s.duplicateVerdicts.userId, s.duplicateVerdicts.txId],
          set: {
            verdict: sql`excluded.verdict`,
            stableKey: sql`excluded.stable_key`,
            fingerprintVersion: sql`excluded.fingerprint_version`,
            freeeKey: sql`excluded.freee_key`,
            decidedAt: sql`excluded.decided_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    ...chunks(dropMf, KEYS_PER_DELETE).map((txIds) =>
      db
        .delete(s.mfTxExclusions)
        .where(and(eq(s.mfTxExclusions.userId, userId), inArray(s.mfTxExclusions.txId, txIds))),
    ),
    ...chunks(restoreMf, rowsPerStatement(6)).map((rows) =>
      db
        .insert(s.mfTxExclusions)
        .values(rows.map((row) => ({ ...row, userId })))
        .onConflictDoUpdate({
          target: [s.mfTxExclusions.userId, s.mfTxExclusions.txId],
          set: {
            stableKey: sql`excluded.stable_key`,
            fingerprintVersion: sql`excluded.fingerprint_version`,
            reason: sql`excluded.reason`,
            createdAt: sql`excluded.created_at`,
          },
        }),
    ),
    ...chunks(dropFreee, KEYS_PER_DELETE).map((keys) =>
      db
        .delete(s.freeeDealExclusions)
        .where(and(eq(s.freeeDealExclusions.userId, userId), inArray(s.freeeDealExclusions.freeeKey, keys))),
    ),
    ...chunks(restoreFreee, rowsPerStatement(5)).map((rows) =>
      db
        .insert(s.freeeDealExclusions)
        .values(rows.map((row) => ({ ...row, userId })))
        .onConflictDoUpdate({
          target: [s.freeeDealExclusions.userId, s.freeeDealExclusions.freeeKey],
          set: {
            reason: sql`excluded.reason`,
            createdAt: sql`excluded.created_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    db
      .update(s.reconciliationActions)
      .set({ undoneAt: now })
      .where(and(eq(s.reconciliationActions.id, id), isNull(s.reconciliationActions.undoneAt))),
  ];
  await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
  return c.json({
    ok: true,
    action: { id: target.id, action: target.action, targetCount: target.targetCount, undoneAt: now },
  });
});
