# 照合画面 リリースと巻き戻しの計画 (SYS-RECON-P13)

照合画面の改善を本番へ出すときの単位、経路、確認、巻き戻しをまとめます。

> **現状:** 本書の時点では commit・push・PR 作成を行っていません。変更は作業ツリーに未コミットのまま置いてあり、下記は PR を作成して main へ merge した後の計画です。

## 1. 配信単位

1 本の PR で出します。migration 0041、API、core の判定、web の画面、テスト、文書は互いに依存しています。
たとえば `EXPECTED_D1_MIGRATION` を 0041 にした Worker は、0041 が無い D1 では `behind` になります。そのため分割しません。

## 2. 本番への経路 (`.github/workflows/deploy.yml`)

main への merge 後、CI が通ると deploy が次の順に動きます。

1. `pnpm --filter @kanjo/web build:artifact`: 本番に触らない build を、不可逆な migration より前に行う。
2. `node .github/scripts/plan-auto-migration.mjs`: 0041 は `CREATE TABLE IF NOT EXISTS` と `CREATE INDEX IF NOT EXISTS` だけで、`DROP TABLE`・`DROP COLUMN`・`RENAME` を含まないため `apply` になる。
   - 実測 (2026-09-15、本番 D1 には接続しない): 同スクリプトの `planAutoMigration` に、実リポジトリの `migrations/` と「pending は `0041_reconciliation_tables.sql` の 1 件」という wrangler 出力を渡した結果は `{"decision":"apply","filenames":["0041_reconciliation_tables.sql"],"blockers":[]}`。`destructiveFindings(0041 の本文)` は `[]`。
   - 前提: 本番の pending が 0041 だけであること。merge 時点で本番に未適用の破壊的な migration が他にあれば、deploy は `blocked` で止まり、手動の Migrate workflow が必要になる。
3. `pnpm run db:checkpoint`: Time Travel の復元地点を記録する。
4. `pnpm run db:migrate:remote`: 0041 を適用する。
5. `node .github/scripts/check-d1-migrations.mjs`: 未適用が無いことを検査する。
6. `pnpm --filter @kanjo/api exec wrangler deploy`: `EXPECTED_D1_MIGRATION = '0041_reconciliation_tables.sql'` の Worker を出す。
7. `sleep 30 && pnpm run smoke` と `sleep 90 && pnpm run smoke` で 2 回確認する。

## 3. リリース前の確認 (PR 上)

- [ ] `pnpm test`・`pnpm typecheck`・`pnpm lint` が exit 0 ([`test-run.md`](test-run.md))
- [ ] `build:bundle` 直後の `check:js-budget` が 110 KiB 以内 (実測 109.33 KiB)。deploy は予算を検査しないため、PR の CI で守る
- [ ] `build:artifact` が exit 0、`github-scripts:test` が 42 / 42
- [ ] `check:mobile-layout`・`check:financial-routes` が exit 0
- [ ] migration は 0041 の 1 本で、既存表 (`duplicate_verdicts`・`freee_deal_exclusions`) の列を変えていない
- [ ] PR 本文の範囲を `git log origin/main..HEAD` と差分全体から書く

## 4. 巻き戻し

### 4.1 Worker だけを戻す (第一選択)

画面や API に不具合があれば、Cloudflare の deployment から直前の version へ Worker を rollback します。
D1 の `mf_tx_exclusions` と `reconciliation_actions` は消さずに残します。月次レビューは 0040 の `monthly_close_reviews` をそのまま使っており、本 PR では表を足していないので、巻き戻しの対象外です。
単一 PR なので、1 回の Worker の切り戻しで画面と API がそろって戻ります。

- 旧 Worker の schema guard は「適用済みの版が期待より新しければ `ready`」と判定するため (`schema-guard.ts` の `appliedVersion > expectedVersion`)、0041 が適用された D1 でも旧 Worker は動きます。
- 状態 (未処理・MFのみ など) は表に持たず GET のたびに導出するため、Worker を戻せば件数の数え方も旧版に戻ります。D1 側で直すものはありません。
- 旧 Worker は新しい 2 表を読みません。MF 除外は照合の相手探しから外すだけで、総収支の総額は変わらないため、残っても旧画面の件数は壊れません。
- 再び前進するときは、同じ D1 のまま新 Worker を deploy すれば記録がそのまま使えます。

### 4.2 D1 を戻す (原則不要)

0041 は追加だけで、既存の行を変えません。Time Travel での restore は、restore 地点より後の取込や判断も失うため、原則として行いません。
どうしても必要な場合は [`../runbooks/prod-d1-schema-recovery.md`](../runbooks/prod-d1-schema-recovery.md) の手順に従い、3. で記録した復元地点と Worker の version を対で扱います。

## 5. リリース後の確認

- [ ] deploy の smoke 2 回が成功した
- [ ] 本番で `/analysis/reconciliation` が開き、schema guard が `behind` を返していない
- [ ] サイドバー、分析ハブ、照合 KPI、月次クローズで、全期間の `actionRequiredCount` が一致する
- [ ] 1 件を照合して「元に戻す」で戻せる
- [ ] 件数のずれや取り消しの 409 が出たら [`../runbooks/reconciliation-mismatch.md`](../runbooks/reconciliation-mismatch.md) で切り分ける

## 6. 残す判断

- 月次クローズの照合件数は全期間で数える (`architecture-decision.md` §7 #5)。
- 90 日削除は夜間 cron ではなく、操作時の batch で行う (`design-review.md` R4)。
- 本番規模のデータで Worker の CPU 時間は測っていない ([`final-review.md`](final-review.md) §2)。
