/**
 * 仕分け画面の「保存したフィルタ」(spec-classify-screen の saved-filters API)。
 *
 * 条件そのものは JSON 1 列で持つ。画面の都合で項目が増減するため列に割らない。
 * 代わりに、読み書きの両方でここの zod を通し、未知のキーを落とす。
 */
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { getDb } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const savedFiltersRoute = new Hono<Ctx>();

/** 利用者ひとりが持てるフィルタの数 (BR-14) */
const MAX_SAVED_FILTERS = 20;
/** 条件 JSON の長さの上限。migration の CHECK と同じ値 */
const MAX_QUERY_JSON = 2000;

/**
 * 保存する条件。期間は含めない。
 * 期間を含めると「先月の条件」を今月呼び出したときに何も出ない、という驚きが起きる。
 */
const querySchema = z
  .object({
    status: z.array(z.enum(['unsorted', 'review', 'manual', 'done'])).optional(),
    category: z.string().max(60).optional(),
    owner: z.string().max(40).optional(),
    method: z.enum(['cash', 'card', 'account', 'unknown']).optional(),
    manual: z.boolean().optional(),
    q: z.string().max(100).optional(),
    sort: z.enum(['date_desc', 'date_asc']).optional(),
  })
  .strip();

const createSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(40)),
  query: querySchema,
});

const err = (code: string, message: string) => ({ error: { code, message } });

savedFiltersRoute.get('/saved-filters', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.savedFilters)
    .where(eq(s.savedFilters.userId, userId))
    .orderBy(asc(s.savedFilters.createdAt), asc(s.savedFilters.id));
  const items = rows.flatMap((r) => {
    // 読めない行は落とす。1 行が壊れているせいで一覧ごと出ないほうが困る
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.queryJson);
    } catch {
      return [];
    }
    const query = querySchema.safeParse(parsed);
    if (!query.success) return [];
    return [{ id: r.id, name: r.name, query: query.data, createdAt: r.createdAt, updatedAt: r.updatedAt }];
  });
  return c.json({ items });
});

savedFiltersRoute.post('/saved-filters', zValidator('json', createSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { name, query } = c.req.valid('json');
  const queryJson = JSON.stringify(query);
  if (queryJson.length > MAX_QUERY_JSON) return c.json(err('invalid_body', '条件が長すぎます'), 400);

  const existing = await db.select().from(s.savedFilters).where(eq(s.savedFilters.userId, userId));
  if (existing.some((row) => row.name === name))
    return c.json(err('duplicate_name', '同じ名前のフィルタがあります'), 409);
  if (existing.length >= MAX_SAVED_FILTERS)
    return c.json(err('limit_reached', `保存できるフィルタは${MAX_SAVED_FILTERS}件までです`), 409);

  const now = new Date().toISOString();
  const item = { id: crypto.randomUUID(), name, queryJson, createdAt: now, updatedAt: now };
  await db.insert(s.savedFilters).values({ ...item, userId });
  return c.json({ item: { id: item.id, name, query, createdAt: now, updatedAt: now } }, 201);
});

savedFiltersRoute.delete('/saved-filters/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  const found = await db
    .select({ id: s.savedFilters.id })
    .from(s.savedFilters)
    .where(and(eq(s.savedFilters.userId, userId), eq(s.savedFilters.id, id)));
  if (found.length === 0) return c.json(err('not_found', 'フィルタが見つかりません'), 404);
  await db.delete(s.savedFilters).where(and(eq(s.savedFilters.userId, userId), eq(s.savedFilters.id, id)));
  return c.json({ ok: true, id });
});
