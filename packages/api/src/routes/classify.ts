import { zValidator } from '@hono/zod-validator';
/**
 * FR-02 公私仕分け: 明細一覧・手動編集(公私/科目/名義)・ルールCRUD。
 * 変更(PUT/POST/DELETE/PATCH)は即時に monthly_agg を再生成する(spec §7.3)。
 *
 * 手動編集は tx_edits(同一性キー = MF の ID 列)に取込値とは別枠で保存し、再取込でも保持する。
 */
import {
  type Candidates,
  DEFAULT_RULES,
  OWNER_VALUES,
  type Rule,
  type TxEdit,
  buildCandidates,
  categoryAllowed,
  categoryRejectReason,
  countableMfTxs,
  parseMfAttachmentTarget,
  resolveTx,
  ruleMatches,
  sum,
} from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import {
  type Db,
  getDb,
  loadDataset,
  loadOrderedRuleRows,
  ruleFromRow,
  saveAgg,
  upsertEdit,
} from '../store.js';
import { loadAttachmentCounts } from './attachments.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const classifyRoute = new Hono<Ctx>();
const ownerSchema = z.enum(OWNER_VALUES);

async function recompute(db: Db, userId: string): Promise<void> {
  const data = await loadDataset(db, userId);
  await saveAgg(db, userId, data);
}

/**
 * 科目候補(二系統): 事業 = freee 取引に実在する勘定科目、個人 = MF 明細に実在する大項目/中項目。
 * それぞれに設定画面で追加した候補(category_options.scope)を合わせる。科目を推測で作らない。
 */
export async function loadCandidates(
  db: Db,
  userId: string,
  txs: { big: string; mid: string }[],
): Promise<Candidates> {
  const [opts, deals] = await Promise.all([
    db.select().from(s.categoryOptions).where(eq(s.categoryOptions.userId, userId)),
    db
      .selectDistinct({ account: s.freeeDeals.accountRaw })
      .from(s.freeeDeals)
      .where(eq(s.freeeDeals.userId, userId)),
  ]);
  return buildCandidates(
    deals.map((d) => d.account ?? '').filter(Boolean),
    txs,
    opts.map((o) => ({ scope: o.scope, major: o.major, mid: o.mid })),
  );
}

const invalidCategory = (cls: 'biz' | 'per') => ({
  error: { code: 'invalid_category', message: categoryRejectReason(cls) },
});

classifyRoute.get('/transactions', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  const month = c.req.query('month') ?? null;
  const cls = c.req.query('cls') ?? '';
  const owner = c.req.query('owner') ?? '';
  const q = (c.req.query('q') ?? '').toUpperCase();
  const manualOnly = c.req.query('manual') === '1';

  // 仕分けの対象は収支集計に載る明細だけ。MFの振替・計算対象外はDBには残すが
  // 一覧にも summary にも入れない(入れると家計/事業の集計と合計が食い違う)
  const countable = countableMfTxs(data.mfTx);
  const months = [...new Set(countable.map((t) => t.m))].sort();
  const m = month && months.includes(month) ? month : (months[months.length - 1] ?? null);

  const txs = countable.filter((t) => t.m === m);
  /** 同月に取り込まれたが集計対象外だった件数(振替・計算対象=0)。取込漏れとの取り違えを防ぐため件数だけ返す */
  const nonCountableCount = data.mfTx.filter((t) => t.m === m).length - txs.length;
  const attachmentTargets = txs
    .map((t) => parseMfAttachmentTarget(t.id))
    .filter((target): target is NonNullable<typeof target> => target !== null);
  const [candidates, attachmentCounts] = await Promise.all([
    loadCandidates(db, userId, data.mfTx),
    // 証憑バッジ用。表示中の月の明細だけを引く
    loadAttachmentCounts(db, c.env.FILES, userId, attachmentTargets),
  ]);
  const resolved = txs.map((t) => ({ t, r: resolveTx(t, data.rules, data.edits, data.institutionOwners) }));
  const rows = resolved
    .map(({ t, r }) => {
      const e = data.edits[t.id];
      return {
        id: t.id,
        idStable: t.idStable === true,
        date: t.d,
        description: t.c,
        amount: t.a,
        institution: t.inst ?? null,
        /** 取込値(MFの大項目/中項目) */
        csvBig: t.big,
        csvMid: t.mid,
        /** 有効値 */
        big: r.big,
        mid: r.mid,
        catSrc: r.catSrc,
        cls: r.cls,
        src: r.clsSrc,
        owner: r.owner,
        ownerSrc: r.ownerSrc,
        edited: r.edited,
        conflict: r.conflict,
        /** 手動の科目が現在の公私の系統に無い(公私を後から変えた等) */
        scopeMismatch: r.catSrc === '手動' && !categoryAllowed(candidates, r.cls, r.big, r.mid),
        /** 添付されている証憑の件数(0 = 未添付) */
        attachmentCount: attachmentCounts[t.id] ?? 0,
        edit: e
          ? {
              cls: e.cls ?? null,
              big: e.big ?? null,
              mid: e.mid ?? null,
              owner: e.owner ?? null,
              updatedAt: e.updatedAt ?? null,
            }
          : null,
      };
    })
    .filter((r) => {
      if ((cls === 'biz' || cls === 'per') && r.cls !== cls) return false;
      if (OWNER_VALUES.some((value) => value === owner)) {
        if (r.owner !== owner) return false;
      } else if (owner === 'unset' && r.owner !== null) return false;
      if (manualOnly && !r.edited) return false;
      if (
        q &&
        !`${r.description}|${r.big}|${r.mid}|${r.csvBig}|${r.csvMid}|${r.institution ?? ''}`
          .toUpperCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const pick = (f: (x: { t: (typeof txs)[number]; r: ReturnType<typeof resolveTx> }) => boolean) =>
    sum(resolved.filter(f).map((x) => x.t.a));
  const summary = {
    month: m,
    count: txs.length,
    totalIncome: pick((x) => x.t.a > 0),
    bizIncome: pick((x) => x.r.cls === 'biz' && x.t.a > 0),
    personalIncome: pick((x) => x.r.cls === 'per' && x.t.a > 0),
    totalExpense: -pick((x) => x.t.a < 0),
    bizExpense: -pick((x) => x.r.cls === 'biz' && x.t.a < 0),
    personalExpense: -pick((x) => x.r.cls === 'per' && x.t.a < 0),
    /** 個人収入の名義別 */
    incomeByOwner: {
      business: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'business'),
      spouse: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'spouse'),
      family: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'family'),
      unset: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === null),
    },
    editedCount: resolved.filter((x) => x.r.edited).length,
    conflictCount: resolved.filter((x) => x.r.conflict).length,
    /** 保有金融機関が無い明細数(旧取込。MF再取込で埋まる) */
    noInstitutionCount: txs.filter((t) => !t.inst).length,
    /** 取り込んだが集計対象外だった明細数(MFの振替・計算対象=0)。0なら注記を出さない */
    nonCountableCount,
  };
  return c.json({ months, month: m, summary, transactions: rows, candidates });
});

/* -------- 手動編集(公私・大項目・中項目・名義) -------- */

const clsSchema = z.object({ cls: z.enum(['biz', 'per']).nullable() });

/** 互換: 公私だけを変える */
classifyRoute.put('/transactions/:txId/class', zValidator('json', clsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const { cls } = c.req.valid('json');
  const data = await loadDataset(db, userId);
  const cur = data.edits[txId] ?? {};
  await upsertEdit(db, userId, txId, { ...cur, cls, updatedAt: new Date().toISOString() });
  await recompute(db, userId);
  return c.json({ ok: true, txId, cls });
});

const editSchema = z.object({
  cls: z.enum(['biz', 'per']).nullable().optional(),
  big: z.string().max(60).nullable().optional(),
  mid: z.string().max(60).nullable().optional(),
  owner: ownerSchema.nullable().optional(),
  note: z.string().max(200).nullable().optional(),
  /** true: 全属性を取込値に戻す(編集行を消す) */
  reset: z.boolean().optional(),
});

/**
 * 属性ごとの編集。送られた属性だけ更新し、null は「その属性の編集を外す(取込値/ルールに戻す)」。
 * 科目を編集したときは現在の取込値を base_* に控え、再取込で取込値が変わったことを検知できるようにする。
 */
classifyRoute.put('/transactions/:txId/edit', zValidator('json', editSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const b = c.req.valid('json');
  const data = await loadDataset(db, userId);
  const tx = data.mfTx.find((t) => t.id === txId);
  if (!tx) return c.json({ error: { code: 'not_found', message: '明細が見つかりません' } }, 404);
  const cur: TxEdit = data.edits[txId] ?? {};
  const next: TxEdit = b.reset ? {} : { ...cur };
  if (!b.reset) {
    if (b.cls !== undefined) next.cls = b.cls;
    if (b.owner !== undefined) next.owner = b.owner;
    if (b.note !== undefined) next.note = b.note;
    if (b.big !== undefined || b.mid !== undefined) {
      if (b.big !== undefined) next.big = b.big || null;
      if (b.mid !== undefined) next.mid = b.mid || null;
      // 科目編集が残るなら取込値を控える。外れたら控えも消す
      if (next.big || next.mid) {
        next.baseBig = tx.big;
        next.baseMid = tx.mid;
      } else {
        next.baseBig = null;
        next.baseMid = null;
      }
    }
    next.updatedAt = new Date().toISOString();
    if (next.big || next.mid) {
      // 会計上あり得ない組み合わせのガード: 編集後の公私(手動 > ルール > 既定)に対する候補で判定する
      const probe = { ...data.edits, [txId]: { ...next, big: null, mid: null } };
      const effCls = resolveTx(tx, data.rules, probe, data.institutionOwners).cls;
      const cands = await loadCandidates(db, userId, data.mfTx);
      if (!categoryAllowed(cands, effCls, next.big ?? null, next.mid ?? null))
        return c.json(invalidCategory(effCls), 400);
    }
  }
  await upsertEdit(db, userId, txId, next);
  await recompute(db, userId);
  const after = await loadDataset(db, userId);
  const r = resolveTx(tx, after.rules, after.edits, after.institutionOwners);
  return c.json({ ok: true, txId, resolved: r, edit: after.edits[txId] ?? null });
});

/* -------- ルールCRUD(表示順=評価順・先勝ち) -------- */

async function listRules(db: Db, userId: string) {
  return loadOrderedRuleRows(db, userId);
}

/** 初回のルール追加時は既定ルール(HTML版)を実体化する */
async function materializeDefaults(db: Db, userId: string): Promise<void> {
  const existing = await listRules(db, userId);
  if (existing.length) return;
  const inserts = DEFAULT_RULES.map((rule, index) =>
    db.insert(s.rules).values({ userId, keyword: rule.k, cls: rule.cls, sortOrder: index + 1 }),
  );
  if (inserts.length)
    await db.batch([inserts[0], ...inserts.slice(1), invalidateJsonSnapshotQuery(db, userId, 'rules')]);
}

classifyRoute.get('/rules', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await listRules(db, userId);
  const data = await loadDataset(db, userId);
  // ルール誤爆対策: 各ルールの影響件数(キーワードが最初に当たる明細数)
  const hitCount = new Map<number, number>();
  const rules: Rule[] = rows.map(ruleFromRow);
  for (const t of data.mfTx) {
    for (let i = 0; i < rules.length; i++) {
      if (ruleMatches(t, rules[i])) {
        hitCount.set(rows[i].id, (hitCount.get(rows[i].id) ?? 0) + 1);
        break;
      }
    }
  }
  return c.json({
    rules: rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      cls: r.cls ?? null,
      big: r.categoryMajor ?? null,
      mid: r.categoryMid ?? null,
      owner: r.owner ?? null,
      sortOrder: r.sortOrder,
      hits: hitCount.get(r.id) ?? 0,
    })),
    usingDefaults: rows.length === 0,
  });
});

const ruleBody = {
  keyword: z.string().min(1).max(100),
  cls: z.enum(['biz', 'per']).nullable().optional(),
  big: z.string().max(60).nullable().optional(),
  mid: z.string().max(60).nullable().optional(),
  owner: ownerSchema.nullable().optional(),
};
const hasAttr = (b: {
  cls?: string | null;
  big?: string | null;
  mid?: string | null;
  owner?: string | null;
}) => !!(b.cls || b.big || b.mid || b.owner);
const ruleSchema = z.object({ ...ruleBody, top: z.boolean().optional() });

/** ルールの科目ガード: 科目を指定するなら公私も指定し、その系統の候補にあること */
async function ruleCategoryError(
  db: Db,
  userId: string,
  b: { cls?: string | null; big?: string | null; mid?: string | null },
) {
  if (!b.big && !b.mid) return null;
  if (b.cls !== 'biz' && b.cls !== 'per')
    return {
      error: {
        code: 'rule_needs_cls',
        message: '科目を指定するルールは、先に公私(事業/個人)を選んでください',
      },
    };
  const data = await loadDataset(db, userId);
  const cands = await loadCandidates(db, userId, data.mfTx);
  return categoryAllowed(cands, b.cls, b.big ?? null, b.mid ?? null) ? null : invalidCategory(b.cls);
}

classifyRoute.post('/rules', zValidator('json', ruleSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (!hasAttr(b))
    return c.json(
      { error: { code: 'empty_rule', message: '公私・大項目・中項目・名義のいずれかを指定してください' } },
      400,
    );
  const catErr = await ruleCategoryError(db, userId, b);
  if (catErr) return c.json(catErr, 400);
  await materializeDefaults(db, userId);
  const rows = await listRules(db, userId);
  const sortOrder = b.top ? (rows[0]?.sortOrder ?? 1) - 1 : (rows[rows.length - 1]?.sortOrder ?? 0) + 1;
  const [inserted] = await db.batch([
    db
      .insert(s.rules)
      .values({
        userId,
        keyword: b.keyword,
        cls: b.cls ?? null,
        categoryMajor: b.big || null,
        categoryMid: b.mid || null,
        owner: b.owner ?? null,
        sortOrder,
      })
      .returning({ id: s.rules.id }),
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
  ]);
  const [rec] = inserted;
  await recompute(db, userId);
  return c.json({ ok: true, id: rec.id }, 201);
});

classifyRoute.put('/rules/:id', zValidator('json', z.object(ruleBody)), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const b = c.req.valid('json');
  if (!hasAttr(b))
    return c.json(
      { error: { code: 'empty_rule', message: '公私・大項目・中項目・名義のいずれかを指定してください' } },
      400,
    );
  const catErr = await ruleCategoryError(db, userId, b);
  if (catErr) return c.json(catErr, 400);
  await db.batch([
    db
      .update(s.rules)
      .set({
        keyword: b.keyword,
        cls: b.cls ?? null,
        categoryMajor: b.big || null,
        categoryMid: b.mid || null,
        owner: b.owner ?? null,
      })
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id))),
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
  ]);
  await recompute(db, userId);
  return c.json({ ok: true });
});

classifyRoute.delete('/rules/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  await db.batch([
    db.delete(s.rules).where(and(eq(s.rules.userId, userId), eq(s.rules.id, id))),
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
  ]);
  await recompute(db, userId);
  return c.json({ ok: true });
});

const reorderSchema = z.object({ order: z.array(z.number().int()).max(200) });

classifyRoute.patch('/rules', zValidator('json', reorderSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { order } = c.req.valid('json');
  const rows = await loadOrderedRuleRows(db, userId);
  const expected = new Set(rows.map((row) => row.id));
  if (
    order.length !== rows.length ||
    new Set(order).size !== order.length ||
    order.some((id) => !expected.has(id))
  ) {
    return c.json(
      { error: { code: 'invalid_rule_order', message: 'ルール全件を重複なく並べてください' } },
      400,
    );
  }
  const updates = order.map((id, i) =>
    db
      .update(s.rules)
      .set({ sortOrder: i })
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id))),
  );
  if (updates.length)
    await db.batch([updates[0], ...updates.slice(1), invalidateJsonSnapshotQuery(db, userId, 'rules')]);
  await recompute(db, userId);
  return c.json({ ok: true });
});
