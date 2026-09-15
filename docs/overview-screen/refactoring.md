# 概況画面 migration 0040 とバックアップ/復元の整合点検 (SYS-OVERVIEW-P08)

migration 0040 で `review_snoozes` (後で確認) と `monthly_close_reviews` (月次レビュー) を追加しました。
この文書は、2 表の追加が「前進のみ」であり、バックアップ/復元の経路へ漏れなく載っていることを点検した記録です。
仕様の正本は `specs/spec-overview-screen.md` のデータモデル節、設計の根拠は
`architecture/overview-screen-database.md` と `architecture/overview-screen-infrastructure.md` です。

## 1. migration 0040 は前進のみか

| 観点 | 確認内容 | 結果 |
|---|---|---|
| 文の種類 | `migrations/0040_review_snoozes_and_monthly_close_reviews.sql` は `CREATE TABLE IF NOT EXISTS` 2 文だけ | 適合 |
| 破壊的変更 | `DROP` / `RENAME` / `ALTER` / `DELETE` / `UPDATE` を含まない | 適合 |
| 自動適用判定 | `.github/scripts/plan-auto-migration.mjs` の `destructiveFindings()` にこの SQL を渡すと `[]` (破壊的所見なし) | 自動適用対象 |
| バックフィル | 既存行を持たない新表のみ。既存データの書換は不要 | 不要 |
| 平文の混入防止 | `fingerprint` は `CHECK (length(fingerprint) = 64)`。明細本文の写しは持たない | 適合 |
| 冪等性 | `monthly_close_reviews` は `PRIMARY KEY (user_id, month)`。API は `onConflictDoNothing` で初回の `reviewed_at` を保つ | 適合 |
| ローカル適用 | `pnpm run db:migrate:local` で 0001〜0040 がすべて適用済み (0040 は ✅) | 適合 |

## 2. バックアップ/復元の経路

`packages/api/src/store.ts` の `BACKUP_SNAPSHOT_SQL` は、利用者ごとの全表を 1 本の `UNION ALL` で読みます。
表を足したのに placeholder だけ、または `UNION ALL` だけが増えると、D1 はバインド数不一致で失敗します。

| 項目 | 変更前 (HEAD) | 変更後 | 一致確認 |
|---|---|---|---|
| `BACKUP_SNAPSHOT_SQL` の `?` placeholder | 15 | 17 | 数え上げ |
| `BACKUP_SNAPSHOT_SQL` の `UNION ALL` | 14 | 16 | 数え上げ (枝数 17 = placeholder 17) |
| `loadBackupSourceSnapshot` のパラメータ | `Array.from({ length: 15 })` | `Array.from({ length: 17 })` | placeholder と一致 |
| 復元時の解析 (`routes/imports.ts`) | なし | `reviewSnoozes` / `monthlyCloseReviews` を解析。キーが無い旧バックアップは `null` 扱い | 旧形式と互換 |
| 月次レビューの監査列 | なし | `reviewed_at` と `reviewed_by_user_id` をバックアップに含める。`reviewed_by_user_id` はログイン中の利用者 (`c.get('actor').id`) で、復元時の schema でも必須 (欠けた行は 400。テナント鍵で埋めない) | 適合 |
| 重複扱いの回避 | なし | 保留・レビューの書込時に `invalidateJsonSnapshotQuery` でスナップショット指紋を落とす | 適合 |

旧バックアップ (2 表のキーを持たない JSON) を復元すると、2 表は空のまま復元されます。
「後で確認」を取り消した状態と同じで、未処理件数が多めに見えるだけです。データは失われません。

## 3. テスト

| コマンド | 対象 | 結果 |
|---|---|---|
| `pnpm --filter @kanjo/api test` | `src/overview.test.ts` の `AC-004 バックアップ → 全消去 → 復元` 3 件を含む API 全体 | 40 files / 549 tests pass (レビュー者が actor id で往復することの検査を含む) |
| `pnpm run github-scripts:test` | `plan-auto-migration.test.mjs` を含む | 42 / 42 pass |

## 4. 結論

migration 0040 は CREATE のみの前進 migration で、deploy.yml の自動適用経路に乗ります。
バックアップ/復元は placeholder・`UNION ALL`・パラメータ数が 17 で一致し、往復テストが緑です。
`store.ts` への追加の整理は不要と判断しました (P05 実装時点で整合が取れていたため)。
