# 概況画面 証跡索引 (SYS-OVERVIEW-P11)

AC-001..AC-007 を、第三者がリポジトリ直下から再実行して同じ結果を得られる形で索引化したものです。
判定の根拠は [`acceptance.md`](acceptance.md)、保証は [`assurance.md`](assurance.md)、指摘の是正は [`final-review.md`](final-review.md) にあります。

## 1. AC 別の再実行コマンドと成果物

| AC | 再実行コマンド | 期待結果 | 証跡の場所 |
|---|---|---|---|
| AC-001 | `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts -t "AC-001"` | pass | `packages/core/test/overview-close-status.test.ts` / `packages/core/src/overview.ts` (`overviewAggregate`) |
| AC-002 | `pnpm --filter @kanjo/web exec vitest run src/overview-review-queue.dom.test.tsx` | 10 pass | `packages/web/src/overview-review-queue.dom.test.tsx` / `packages/web/src/components/ReviewQueue.tsx` / `packages/web/src/pages/Overview.tsx` |
| AC-003 | `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts -t "AC-003"` | pass | 同上 core テスト (`applyReviewSnoozes`) |
| AC-004 | `pnpm --filter @kanjo/api exec vitest run src/overview.test.ts` と `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts -t "AC-004"` | pass | `packages/api/src/overview.test.ts` / `packages/api/src/store.ts` (`BACKUP_SNAPSHOT_SQL`) / `packages/api/src/routes/imports.ts` / `migrations/0040_review_snoozes_and_monthly_close_reviews.sql` / [`refactoring.md`](refactoring.md) |
| AC-005 | 下記 §2 の手順でローカルを起動し `KANJO_VISUAL_BASE_URL=http://127.0.0.1:<vite port> node packages/web/scripts/check-financial-visuals.mjs` | 表示順・広幅グリッド・横はみ出しを検査して8幅で exit 0 | `packages/web/scripts/check-financial-visuals.mjs`。強化後の再実行は未完了。スクリーンショットは `KANJO_VISUAL_OUTPUT_DIR` に出力 (リポジトリには置かない) |
| AC-006 | `pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts -t "AC-006"` | pass | core テスト (`recommendationFor`) |
| AC-007 | `pnpm typecheck` / `pnpm test` / `pnpm lint` / `pnpm --filter @kanjo/web run build:bundle && pnpm --filter @kanjo/web run check:js-budget` / `pnpm --filter @kanjo/api exec vitest run src/index.test.ts` | 全コマンド exit 0 | 現状は `pnpm test` / `pnpm lint` が既知の 3 件で exit 1 のため不合格。詳細は [`test-run.md`](test-run.md) |

`check:js-budget` は `build:bundle` の直後に実行します。`build:artifact` は manifest を取り除くため、その後では予算を測れません。

## 2. AC-005 のためのローカル起動

実データは使いません。seed は決定的な擬似乱数で架空の明細を作ります。

```bash
test -f packages/api/.dev.vars || cp packages/api/.dev.vars.example packages/api/.dev.vars
pnpm run db:migrate:local
node scripts/seed-admin.mjs                     # admin@kanjo.local を作る (ローカル専用)
pnpm --filter @kanjo/api exec wrangler dev      # 127.0.0.1:8787
node scripts/seed-local.mjs                     # 別端末。架空サンプルを取り込む
pnpm --filter @kanjo/web exec vite --host 127.0.0.1 --port <vite port>
```

## 3. 今回の実行値

| 項目 | 値 |
|---|---|
| core | 588 pass / 6 skipped |
| api | 40 files / 549 pass |
| web | 74 files / 550 pass |
| js 予算 | 109.63 KiB / 110 KiB |
| 描画 | Overview 320 / 360 / 375 / 390 / 768 / 1280 / 1600px / zoom200 すべて本体幅 = ビューポート幅 |
| github-scripts | 42 / 42 pass |
