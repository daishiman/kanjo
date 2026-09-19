import { type OwnerLabels, resolveOwnerLabels } from '@kanjo/core';
import { eq } from 'drizzle-orm';
import * as s from './db/schema.js';
import type { Db } from './store.js';

/** ルートに依存しない名義表示名の読み取り口。分析・設定・AIが同じ正本を使う。 */
export async function loadOwnerLabels(db: Db, userId: string): Promise<OwnerLabels> {
  const rows = await db.select().from(s.ownerLabels).where(eq(s.ownerLabels.userId, userId));
  return resolveOwnerLabels(Object.fromEntries(rows.map((row) => [row.owner, row.label])));
}
