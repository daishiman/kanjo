import { zValidator } from '@hono/zod-validator';
/**
 * 事業と家計を合わせたトータル収支の画面と、重複の「同じ / 違う」判断の保存。
 *
 * 集計はすべて `@kanjo/core` の純関数に委譲し、ここでは読み込みと整形だけを行う。
 * 保存するのは利用者の判断と、その判断を元に戻すための履歴だけで、
 * 月次の合計・件数・トレンド・前年同期比は要求のたびに導出する (AD-002)。
 */
import {
  EXCLUSION_MEMO_MAX,
  EXCLUSION_REASON_CODES,
  type FreeeExclusion,
  type ReconcileReview,
  STABLE_KEY_VERSION,
  fullRange,
  mfStableKey,
  totalCashflowScreen,
} from '@kanjo/core';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import { D1_MAX_BOUND_PARAMS } from '../d1-limits.js';
import * as s from '../db/schema.js';
import { dealFromRow, getDb } from '../store.js';
import { loadScoped } from './analytics.js';
import { bindDuplicateVerdicts } from './duplicate-verdict-bindings.js';
import {
  type ExclusionOpItem,
  UndoRejected,
  type VerdictOpItem,
  latestUndoable,
  recordOperation,
  undoOperation,
} from './total-cashflow-operations.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const totalCashflowRoute = new Hono<Ctx>();

/** 除外行から core が要る形へ。reason は表示用、reasonCode は集計用 (0041) */
const toExclusion = (row: typeof s.freeeDealExclusions.$inferSelect): FreeeExclusion => ({
  freeeKey: row.freeeKey,
  reason: row.reason,
  reasonCode: row.reasonCode ?? undefined,
  memo: row.memo ?? undefined,
});

/**
 * 要確認1件を画面の形へ。
 *
 * mf と candidates をそのまま渡す。要確認は「理由を告げる」ためではなく
 * 「利用者が同じ取引か判断する」ために出しており、判断材料は画面まで届かないと意味がない。
 */
const toReviewView = (item: ReconcileReview) => ({
  txId: item.mfTxId,
  reason: item.reason,
  mf: item.mf,
  candidates: item.candidates,
});

/**
 * 画面が要る値をまとめて返す。
 *
 * 期間の解決は分析APIと同じ `loadScoped` を通す。ここで別の解き方をすると、
 * 同じ ?from=&to= でも画面ごとに違う月が出る。
 *
 * 合計・月次系列・判定作業・自動一致は `totalCashflowScreen` の1回の呼び出しから取る (AD-001)。
 * 画面の数値ごとに別々の関数を呼ぶと、同じ画面の中で合計と内訳が食い違いうる。
 */
totalCashflowRoute.get('/total-cashflow', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { all, period } = await loadScoped(c);

  const [dealRows, verdictRows, exclusionRows, lastOperation] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
    latestUndoable(db, userId),
  ]);
  const deals = dealRows.map(dealFromRow);
  const verdicts = bindDuplicateVerdicts(verdictRows, all.mfTx);
  const exclusions = exclusionRows.map(toExclusion);

  // 期間の指定が無ければデータ全体。取込前で1か月も無いときだけ range が null になる
  const range = period.applied ?? fullRange(all);
  if (!range) {
    return c.json({
      months: [],
      review: [],
      matched: [],
      freeeOnly: [],
      excluded: [],
      coverage: { freeeTotal: 0, matched: 0, freeeOnly: 0, excluded: 0, mfReview: 0 },
      summary: null,
      series: [],
      workbench: null,
      autoMatches: [],
      lastOperation: null,
      period,
    });
  }

  const screen = totalCashflowScreen(all, deals, verdicts, exclusions, range);
  const { report } = screen;
  return c.json({
    months: report.months,
    // mf と candidates をそのまま渡す。要確認は「理由を告げる」ためではなく
    // 「利用者が同じ取引か判断する」ために出しており、判断材料は画面まで届かないと意味がない。
    review: report.review.map(toReviewView),
    // 一致した組・相手のいない freee・外した freee の三つを全部返す。
    // 「抜け漏れはないか」に答えられるのは、freee 全件がこの三つのどれかに必ず入る形だけである。
    matched: report.matched,
    freeeOnly: report.freeeOnly,
    excluded: report.excluded,
    coverage: report.coverage,
    // 0041: 画像の構成 (期間サマリ・月次系列・判定作業・自動一致・取消) に対応する追加分
    summary: screen.summary,
    series: screen.series,
    // core の `mfTxId` を API では `txId` に揃える。同じ「MF 明細の id」が
    // 応答の中で2つの名前を持つと、画面側がどちらを送るかを毎回確かめる必要が出る
    workbench: {
      duplicates: screen.workbench.duplicates.map(toReviewView),
      needsReview: screen.workbench.needsReview.map(toReviewView),
      excluded: screen.workbench.excluded,
      progress: screen.workbench.progress,
    },
    autoMatches: screen.autoMatches.map(({ mfTxId, ...rest }) => ({ txId: mfTxId, ...rest })),
    lastOperation,
    period,
  });
});

const verdictItemSchema = z.object({
  txId: z.string().trim().min(1).max(120),
  verdict: z.enum(['same', 'different']),
  /**
   * どの freee 取引と同じかの名指し。候補が1件しかないときは省ける。
   * 上限を長めに取るのは、鍵の材料に支払先名や勘定科目名がそのまま入るため。
   */
  freeeKey: z.string().trim().min(1).max(2_000).optional(),
});

/**
 * 1 件だけの判断と、選択したぶんをまとめた判断の両方を受ける。
 *
 * まとめて送れるようにするのは画面の都合ではない。1 件ずつ送ると件数分の往復になり、
 * そのたびに期間解決 (`loadScoped`) を丸ごとやり直す。
 * D1 のクエリ数は 1 invocation あたりで数えられるので、往復を減らすことがそのまま
 * 上限に触れない唯一の方法になる (取込を 1 ファイルずつに割ったのと同じ理由の裏返し)。
 */
/** 1 リクエストで受ける判断の上限。多重 VALUES の 1 文に収まる範囲に留める */
const MAX_VERDICT_ITEMS = 200;

const verdictSchema = z.union([
  verdictItemSchema,
  z.object({ items: z.array(verdictItemSchema).min(1).max(MAX_VERDICT_ITEMS) }),
]);

/** 保存できない理由。単票なら HTTP status、まとめてなら件ごとの理由として返す */
type VerdictReject = { txId: string; reason: string };

/**
 * 重複の判断を保存する。同じ明細への再判断は行を増やさず上書きする。
 *
 * 明細が実在するかを保存の前に確かめる。存在しない tx_id を受け付けると、
 * 誰の明細にも当たらない判断が溜まり、要確認キューが減らない理由が追えなくなる。
 *
 * まとめて送られた場合も、書き込みは多重 VALUES の 1 文に畳む。件数に比例して
 * クエリが増える書き方にすると、選ぶ件数によって成否が変わる保存になってしまう。
 */
totalCashflowRoute.post('/total-cashflow/verdicts', zValidator('json', verdictSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const payload = c.req.valid('json');
  const bulk = 'items' in payload;
  const items = bulk ? payload.items : [payload];

  const { all } = await loadScoped(c);
  const now = new Date().toISOString();
  const existing = await db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId));

  const rejected: VerdictReject[] = [];
  const rows: (typeof s.duplicateVerdicts.$inferInsert)[] = [];
  const claimed = new Set<string>();

  for (const { txId, verdict, freeeKey } of items) {
    const tx = all.mfTx.find((row) => row.id === txId);
    if (!tx) {
      rejected.push({ txId, reason: '対象の明細が見つかりません' });
      continue;
    }
    const stableKey = mfStableKey(tx);
    // 識別子が不安定で、かつ stable_key も他の明細と衝突する明細は、再取込後に引き直せない。
    // 保存できたように見せて次の取込で消えるより、保存できないことをその場で言う。
    if (!tx.idStable && all.mfTx.filter((row) => mfStableKey(row) === stableKey).length > 1) {
      rejected.push({ txId, reason: 'この明細は再取込後に見分けられないため、判断を保存できません' });
      continue;
    }
    // tx_id が振り直されていても、同じ stable_key の行があればそれを書き換える(行を増やさない)
    const target =
      existing.find((row) => row.txId === txId) ??
      existing.find(
        (row) =>
          row.stableKey === stableKey &&
          (row.fingerprintVersion ?? STABLE_KEY_VERSION) === STABLE_KEY_VERSION,
      );
    // 同じ既存行を 2 件が取り合うと、1 文の中で同じ行を二度更新することになり SQLite が拒む。
    // 先に取った側へ譲り、後から来た側は自分の tx_id で新しい行を持つ。
    const rowTxId = target && !claimed.has(target.txId) ? target.txId : txId;
    if (claimed.has(rowTxId)) continue;
    claimed.add(rowTxId);
    rows.push({
      userId,
      txId: rowTxId,
      verdict,
      stableKey,
      fingerprintVersion: STABLE_KEY_VERSION,
      // 「違う」の名指しは意味を持たない。持たせると、後で「同じ」に変えたとき古い相手が復活する
      freeeKey: verdict === 'same' ? (freeeKey ?? null) : null,
      decidedAt: now,
      updatedAt: now,
    });
  }

  if (!bulk && rejected.length > 0) {
    const reason = rejected[0]!.reason;
    return c.json({ error: reason }, reason.includes('見つかりません') ? 404 : 409);
  }

  // 書き込む前に「今の値」を控える。書いた後に読むと、上書きした値しか残っていない
  const before: VerdictOpItem[] = rows.map((row) => {
    const prev = existing.find((e) => e.txId === row.txId);
    return {
      txId: row.txId,
      before: prev
        ? {
            verdict: prev.verdict,
            freeeKey: prev.freeeKey ?? null,
            stableKey: prev.stableKey ?? null,
            fingerprintVersion: prev.fingerprintVersion ?? null,
            decidedAt: prev.decidedAt ?? null,
          }
        : null,
    };
  });

  if (rows.length > 0) {
    await db
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
      });
  }
  const operationId = await recordOperation(db, userId, 'verdict', before);
  return bulk
    ? c.json({ ok: true, saved: rows.length, rejected, operationId })
    : c.json({ ok: true, operationId });
});

/**
 * freee 側の二重登録を、理由を付けて総額から外す / 戻す。
 *
 * 突合 (MF と freee のどちらを正とするか) とは別の入口にしてある。既定はあくまで freee が正で、
 * ここに置いた鍵だけが事業費・事業収入から落ちる。理由を必須にするのは、後から金額の差を
 * 追うときに「なぜ外したか」が読めないと元へ戻す判断ができないため。
 */
const freeeKeyField = z.string().trim().min(1).max(2_000);

/** 1 リクエストで外せる件数の上限。一致した組が数百件でも 1 往復で送れる幅を取る */
const MAX_EXCLUSION_ITEMS = 200;

/** 除外行の列数 (user_id / freee_key / reason / reason_code / memo / created_at / updated_at) */
const EXCLUSION_COLUMNS = 7;

/**
 * 1 文の多重 VALUES に載せられる行数。D1 は 1 文あたりのバインドを 100 に制限するので、
 * 列数で割った数を超えたら文を分ける。件数が増えた日にだけ落ちる書き方にしない。
 *
 * 0041 で列が 5 から 7 に増えている。定数を割り算で出しているので、
 * 列を足したときに分割数も自動で縮む (20 行 → 14 行)。
 */
const EXCLUSION_ROWS_PER_STATEMENT = Math.floor(D1_MAX_BOUND_PARAMS / EXCLUSION_COLUMNS);

/**
 * 1 件だけの除外と、選択したぶんをまとめた除外の両方を受ける。
 *
 * まとめて送れるようにするのは画面の都合ではない。一致した組は 1 か月で十数件あり、
 * 1 件ずつ送るとそのたびに往復する。理由は選んだ全件で同じことが多い (「日付と金額が
 * 一致するので二重登録」) ので、理由は 1 つだけ受け取り、鍵の配列に同じ理由を書く。
 */
const reasonFields = {
  reason: z.string().trim().min(1).max(200),
  /** 0041: 数えられる理由。旧い画面からの要求を弾かないよう任意にする */
  reasonCode: z.enum(EXCLUSION_REASON_CODES).optional(),
  memo: z.string().trim().max(EXCLUSION_MEMO_MAX).optional(),
};

const exclusionSchema = z.union([
  z.object({ freeeKey: freeeKeyField, ...reasonFields }),
  z.object({
    freeeKeys: z.array(freeeKeyField).min(1).max(MAX_EXCLUSION_ITEMS),
    ...reasonFields,
  }),
]);

totalCashflowRoute.post(
  '/total-cashflow/freee-exclusions',
  zValidator('json', exclusionSchema),
  async (c) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    const payload = c.req.valid('json');
    const bulk = 'freeeKeys' in payload;
    // 同じ鍵が 2 回来ても 1 文の中で同じ行を二度更新することはできない (SQLite が拒む)。
    // 受け取った時点で畳んでおき、選び方によって保存の成否が変わらないようにする。
    const keys = [...new Set(bulk ? payload.freeeKeys : [payload.freeeKey])];
    const now = new Date().toISOString();

    // 上書きになる鍵の「今の理由」を先に控える。後から読むと新しい理由しか残っていない
    const existing = await db
      .select()
      .from(s.freeeDealExclusions)
      .where(eq(s.freeeDealExclusions.userId, userId));
    const before: ExclusionOpItem[] = keys.map((freeeKey) => {
      const prev = existing.find((row) => row.freeeKey === freeeKey);
      return {
        freeeKey,
        before: prev
          ? {
              reason: prev.reason,
              reasonCode: prev.reasonCode ?? null,
              memo: prev.memo ?? null,
              createdAt: prev.createdAt ?? null,
            }
          : null,
      };
    });

    const rows = keys.map((freeeKey) => ({
      userId,
      freeeKey,
      reason: payload.reason,
      reasonCode: payload.reasonCode ?? null,
      memo: payload.memo ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    for (let at = 0; at < rows.length; at += EXCLUSION_ROWS_PER_STATEMENT) {
      await db
        .insert(s.freeeDealExclusions)
        .values(rows.slice(at, at + EXCLUSION_ROWS_PER_STATEMENT))
        .onConflictDoUpdate({
          target: [s.freeeDealExclusions.userId, s.freeeDealExclusions.freeeKey],
          // createdAt は最初の値を保つ。理由の書き直しで「いつ外したか」を失わない
          set: {
            reason: sql`excluded.reason`,
            reasonCode: sql`excluded.reason_code`,
            memo: sql`excluded.memo`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
    const operationId = await recordOperation(db, userId, 'exclude', before);
    return bulk ? c.json({ ok: true, saved: rows.length, operationId }) : c.json({ ok: true, operationId });
  },
);

totalCashflowRoute.delete(
  '/total-cashflow/freee-exclusions',
  zValidator('json', z.object({ freeeKey: z.string().trim().min(1).max(2_000) })),
  async (c) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    const { freeeKey } = c.req.valid('json');
    const where = and(eq(s.freeeDealExclusions.userId, userId), eq(s.freeeDealExclusions.freeeKey, freeeKey));
    // 消す前に中身を控える。消した後では「何を戻せばよいか」がどこにも残らない
    const [prev] = await db.select().from(s.freeeDealExclusions).where(where);
    await db.delete(s.freeeDealExclusions).where(where);
    const operationId = prev
      ? await recordOperation(db, userId, 'restore', [
          {
            freeeKey,
            before: {
              reason: prev.reason,
              reasonCode: prev.reasonCode ?? null,
              memo: prev.memo ?? null,
              createdAt: prev.createdAt ?? null,
            },
          },
        ])
      : null;
    return c.json({ ok: true, operationId });
  },
);

/**
 * 直前の操作を元に戻す (BR-008)。
 *
 * 失敗の理由を code で返し分ける。画面は `stale_operation` のときだけ再読込を促し、
 * それ以外は選択を保ったまま同じ操作をやり直せる。ひとまとめの 409 では
 * 「もう一度押せばよいのか、読み直すべきか」を利用者が判断できない。
 */
const UNDO_STATUS: Record<string, 404 | 409> = {
  not_found: 404,
  already_undone: 409,
  not_undoable: 409,
  stale_operation: 409,
};

const UNDO_MESSAGE: Record<string, string> = {
  not_found: 'この操作は見つかりませんでした',
  already_undone: 'この操作はすでに元に戻されています',
  not_undoable: '取り消しそのものは元に戻せません',
  stale_operation: '別の更新と重なりました。もう一度お試しください',
};

totalCashflowRoute.post('/total-cashflow/operations/:id/undo', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  try {
    const undone = await undoOperation(db, userId, c.req.param('id'));
    return c.json({ ok: true, operation: undone });
  } catch (error) {
    if (!(error instanceof UndoRejected)) throw error;
    return c.json(
      { error: { code: error.code, message: UNDO_MESSAGE[error.code] } },
      UNDO_STATUS[error.code] ?? 409,
    );
  }
});
