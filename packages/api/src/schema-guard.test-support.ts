/** Wrangler経由ではなくSQLを直接適用する統合テスト用のmigration ledger。 */
export async function recordTestMigrationHead(database: D1Database, migrationNames: string[]): Promise<void> {
  const head = [...migrationNames].sort().at(-1);
  if (!head) return;
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS d1_migrations (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT UNIQUE,
         applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
       )`,
    )
    .run();
  await database.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind(head).run();
}

export const isApplicationTableForTestReset = (name: string): boolean => name !== 'd1_migrations';
