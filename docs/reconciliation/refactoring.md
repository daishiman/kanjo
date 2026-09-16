# 照合画面 migration とバックアップ/復元の整合点検 (SYS-RECON-P08)

migration 0041 で `mf_tx_exclusions` (MF 明細の除外) と `reconciliation_actions` (直前の操作の記録) を追加した。照合の判断は既存の `duplicate_verdicts` (0036) と `freee_deal_exclusions` (0037) を共用する。

この文書は、次の 3 点を点検した記録である。

- 追加した migration が「前進のみ」であること。
- 判断表 3 件 (`duplicate_verdicts` / `freee_deal_exclusions` / `mf_tx_exclusions`) と操作記録 1 件が、バックアップ・復元・保持期間の削除と矛盾しないこと。
- 取込・復元と同時に書き込まれないこと。

仕様では migration の番号を 0040 と書いていたが、0040 は概況画面が使用済みのため 0041 にした (`design-review.md` R2)。

## 1. migration 0041 は前進のみか

| 観点 | 確認内容 | 結果 |
|---|---|---|
| 文の種類 | `migrations/0041_reconciliation_tables.sql` は `CREATE TABLE IF NOT EXISTS` 2 文と `CREATE INDEX IF NOT EXISTS` 2 文だけ | 適合 |
| 破壊的変更 | `DROP` / `RENAME` / `ALTER` / `DELETE` / `UPDATE` を含まない。既存の `duplicate_verdicts` と `freee_deal_exclusions` の列は変えない | 適合 |
| 自動適用の判定 | `.github/scripts/plan-auto-migration.mjs` の `destructiveFindings()` にこの SQL を渡すと `[]` を返す (破壊的所見なし) | 自動適用の対象 |
| バックフィル | 既存行を持たない新表だけで、既存データの書き換えは要らない | 不要 |
| 平文の混入防止 | 明細本文の写しを持たない。持つのは tx_id・鍵・判断・理由だけ。長さを CHECK で制限する (tx_id 1〜120、reason 1〜200、target_count 1〜200) | 適合 |
| 値の制約 | `action` は CHECK で `same` / `different` / `exclude-mf` / `exclude-freee` の 4 値に限る | 適合 |
| スキーマ版 | `schema-guard.ts` の `EXPECTED_D1_MIGRATION` と `deletion-schema.test.ts` の期待値を、同じ差分で `0041_reconciliation_tables.sql` に更新した | 適合 |

## 2. バックアップ/復元の扱い

`packages/api/src/store.ts` の `BACKUP_SNAPSHOT_SQL` は、利用者ごとの全表を 1 本の `UNION ALL` で読む。今回はこの SQL を変えていない。

| 項目 | 実測 | 判断 |
|---|---|---|
| `BACKUP_SNAPSHOT_SQL` の `?` placeholder | 17 (変更なし) | - |
| `BACKUP_SNAPSHOT_SQL` 内の `UNION ALL` | 16 (枝の数 17 = placeholder 17) | 一致 |
| `loadBackupSourceSnapshot` のパラメータ | `Array.from({ length: 17 })` | placeholder と一致 |
| `store.ts`・`import-lifecycle.ts`・`routes/imports.ts` で判断表 3 件と操作記録を参照している箇所 | 0 件 | 変更なしで整合 |

### 判断表 3 件をバックアップに載せない理由

判断表 3 件は、既存の 2 表 (0036 / 0037) を追加したときの前例に従い、JSON バックアップに入れない。復元でも消さず、stable_key で結び直す。

| 観点 | 内容 |
|---|---|
| 再取込で結び直せる | 判断は tx_id と現行版の stable_key を持ち、明細を取り込み直しても `bindDuplicateVerdicts` / `bindMfExclusions` が同じ明細に結び付ける。結び付かない判断は件数に影響しない (無視されるだけ) |
| 復元で消えない | 復元は明細・分類など write-set の表を置き換えるが、判断表には触れない。判断は復元の前後で残る |
| 概況画面との違い | 概況の P08 では `review_snoozes` / `monthly_close_reviews` をバックアップに載せた。前者は明細の内容から作る指紋で結び付くため、復元で明細が変わると結び付きが切れる。後者は利用者の監査記録である。照合の判断は stable_key で再取込後も結び直せるので、同じ扱いは要らない |

### 操作記録 `reconciliation_actions`

| 観点 | 内容 |
|---|---|
| 性質 | 直前の操作を取り消すための 90 日の一時記録。帳簿の正本ではない |
| バックアップ | 対象外。復元後に古い操作を取り消すと、復元した判断を上書きしてしまうため、載せないほうが安全 |
| 保持期間の削除 | `POST /reconciliation/actions` の batch の中で、90 日より古い記録を消す。夜間 cron の D1 予算 (`SCHEDULED_D1_QUERY_PLAN_MAX = 47`、実測 47/47) を使わない。記録は操作したときだけ増えるので、件数は有界に留まる |
| 検査 | API 統合テスト `90 日より古い記録は次の操作で消え、90 日以内は残る` |

## 3. 取込・復元との並行

| 経路 | 確認 | 結果 |
|---|---|---|
| `POST /api/reconciliation/actions`、`POST /api/reconciliation/actions/:id/undo` | `CANONICAL_MUTATION_ROUTES` に登録し、取込・復元の lease 中は 409 | 適合 |
| `POST /api/total-cashflow/verdicts`、`POST` / `DELETE /api/total-cashflow/freee-exclusions` | 同上。これまで fence の外にあったものを今回追加した | 適合 |
| 登録漏れの検出 | `import-lifecycle-pure.test.ts` の `canonical mutation lease predicate` が、`routes/reconciliation.ts` と `routes/total-cashflow.ts` の書き込みルートを走査して、fence との一致を検査する | 適合 |

## 4. テスト

| コマンド | 対象 | 結果 |
|---|---|---|
| `pnpm --filter @kanjo/api test` | 照合の統合テスト、`deletion-schema.test.ts`、`import-lifecycle-pure.test.ts`、`scheduled-maintenance-budget.test.ts` を含む API 全体 | 43 files / 569 tests pass |
| `pnpm run github-scripts:test` | `plan-auto-migration.test.mjs` を含む | 42 / 42 pass |

## 5. 結論

- migration 0041 は CREATE だけの前進 migration で、`destructiveFindings` は `[]`。deploy.yml の自動適用経路に乗る。
- 判断表と操作記録はバックアップ SQL の外にあり、placeholder・`UNION ALL`・パラメータ数は 17 のままで整合している。
- `store.ts` の変更は不要と判断した。
- 是正未了は 0 件。
