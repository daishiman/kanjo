import { zValidator } from '@hono/zod-validator';
/**
 * FR-02 公私仕分け: 明細一覧・手動編集(公私/科目/名義)・ルールCRUD。
 * 変更(PUT/POST/DELETE/PATCH)は即時に monthly_agg を再生成する(spec §7.3)。
 *
 * 手動編集は tx_edits(同一性キー = MF の ID 列)に取込値とは別枠で保存し、再取込でも保持する。
 */
import { DEFAULT_RULES, type Rule, type TxEdit, resolveTx, ruleMatches, sum } from '@kanjo/core';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { type Db, getDb, loadDataset, ruleFromRow, saveAgg, upsertEdit } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const classifyRoute = new Hono<Ctx>();

async function recompute(db: Db, userId: string): Promise<void> {
  const data = await loadDataset(db, userId);
  await saveAgg(db, userId, data);
}

/** 大項目/中項目の候補 = 取込値に現れた組み合わせ ∪ 登録した候補 */
export async function loadCandidates(
  db: Db,
  userId: string,
  txs: { big: string; mid: string }[],
): Promise<{ majors: string[]; mids: Record<string, string[]> }> {
  const opts = await db.select().from(s.categoryOptions).where(eq(s.categoryOptions.userId, userId));
  const pairs = new Map<string, Set<string>>();
  const add = (big: string, mid: string) => {
    if (!big) return;
    pairs.set(big, pairs.get(big) ?? new Set());
    if (mid) pairs.get(big)?.add(mid);
  };
  txs.forEach((t) => add(t.big, t.mid));
  opts.forEach((o) => add(o.major, o.mid));
  const majors = [...pairs.keys()].sort((a, b) => a.localeCompare(b, 'ja'));
  const mids: Record<string, string[]> = {};
  for (const m of majors) mids[m] = [...(pairs.get(m) ?? [])].sort((a, b) => a.localeCompare(b, 'ja'));
  return { majors, mids };
}

classifyRoute.get('/transactions', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  const month = c.req.query('month') ?? null;
  const cls = c.req.query('cls') ?? '';
  const owner = c.req.query('owner') ?? '';
  const q = (c.req.query('q') ?? '').toUpperCase();
  const manualOnly = c.req.query('manual') === '1';

  const months = [...new Set(data.mfTx.map((t) => t.m))].sort();
  const m = month && months.includes(month) ? month : (months[months.length - 1] ?? null);

  const txs = data.mfTx.filter((t) => t.m === m);
  const resolved = txs.map((t) => ({ t, r: resolveTx(t, data.rules, data.edits, data.institutionOwners) }));
  const rows = resolved
    .map(({ t, r }) => {
      const e = data.edits[t.id];
      return {
        id: t.id,
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
      if (owner === 'self' || owner === 'spouse') {
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
      self: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'self'),
      spouse: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'spouse'),
      unset: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === null),
    },
    editedCount: resolved.filter((x) => x.r.edited).length,
    conflictCount: resolved.filter((x) => x.r.conflict).length,
    /** 保有金融機関が無い明細数(旧取込。MF再取込で埋まる) */
    noInstitutionCount: txs.filter((t) => !t.inst).length,
  };
  const candidates = await loadCandidates(db, userId, data.mfTx);
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
  owner: z.enum(['self', 'spouse']).nullable().optional(),
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
  }
  await upsertEdit(db, userId, txId, next);
  await recompute(db, userId);
  const after = await loadDataset(db, userId);
  const r = resolveTx(tx, after.rules, after.edits, after.institutionOwners);
  return c.json({ ok: true, txId, resolved: r, edit: after.edits[txId] ?? null });
});

/* -------- ルールCRUD(表示順=評価順・先勝ち) -------- */

async function listRules(db: Db, userId: string) {
  return db.select().from(s.rules).where(eq(s.rules.userId, userId)).orderBy(asc(s.rules.sortOrder));
}

/** 初回のルール追加時は既定ルール(HTML版)を実体化する */
async function materializeDefaults(db: Db, userId: string): Promise<void> {
  const existing = await listRules(db, userId);
  if (existing.length) return;
  for (let i = 0; i < DEFAULT_RULES.length; i++) {
    await db
      .insert(s.rules)
      .values({ userId, keyword: DEFAULT_RULES[i].k, cls: DEFAULT_RULES[i].cls, sortOrder: i + 1 });
  }
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
  owner: z.enum(['self', 'spouse']).nullable().optional(),
};
const hasAttr = (b: {
  cls?: string | null;
  big?: string | null;
  mid?: string | null;
  owner?: string | null;
}) => !!(b.cls || b.big || b.mid || b.owner);
const ruleSchema = z.object({ ...ruleBody, top: z.boolean().optional() });

classifyRoute.post('/rules', zValidator('json', ruleSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (!hasAttr(b))
    return c.json(
      { error: { code: 'empty_rule', message: '公私・大項目・中項目・名義のいずれかを指定してください' } },
      400,
    );
  await materializeDefaults(db, userId);
  const rows = await listRules(db, userId);
  const sortOrder = b.top ? (rows[0]?.sortOrder ?? 1) - 1 : (rows[rows.length - 1]?.sortOrder ?? 0) + 1;
  const [rec] = await db
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
    .returning({ id: s.rules.id });
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
  await db
    .update(s.rules)
    .set({
      keyword: b.keyword,
      cls: b.cls ?? null,
      categoryMajor: b.big || null,
      categoryMid: b.mid || null,
      owner: b.owner ?? null,
    })
    .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id)));
  await recompute(db, userId);
  return c.json({ ok: true });
});

classifyRoute.delete('/rules/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  await db.delete(s.rules).where(and(eq(s.rules.userId, userId), eq(s.rules.id, id)));
  await recompute(db, userId);
  return c.json({ ok: true });
});

const reorderSchema = z.object({ order: z.array(z.number().int()).max(200) });

classifyRoute.patch('/rules', zValidator('json', reorderSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { order } = c.req.valid('json');
  for (let i = 0; i < order.length; i++) {
    await db
      .update(s.rules)
      .set({ sortOrder: i })
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, order[i])));
  }
  await recompute(db, userId);
  return c.json({ ok: true });
});
