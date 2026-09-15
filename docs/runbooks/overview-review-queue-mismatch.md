# 概況の未処理件数ずれの切り分け

概況のサイドバーのバッジ・未処理カード・固定アクションバーで件数が合わない、
または他の画面の数字と違って見えるときの切り分け手順です。
機能の見取り図は [`概況画面`](../overview-screen.md)、仕様は `specs/spec-overview-screen.md`
(BR-002 / BR-004 / BR-005) が正本で、ここへ転記しません。

## 前提となる仕組み

- 3 か所は **同じ 1 本の応答** (`GET /api/review-queue`、react-query キー `['review-queue']`) を読みます。部品ごとに数え方を持っていません。
- 件数は **全期間** です。期間 (1年 / 3年) を切り替えても変わりません。期間で変わるのは「優先して確認する明細」の表だけです。
- 「後で確認」にした明細は件数から外れ、カードの「後で確認にした明細」に並びます。明細の金額・日付・内容が変わると指紋が合わなくなり、自動で件数に戻ります。
- 概況の「仕分けの確認」は、仕分け画面の「未確認」と **母数が違います** (現金の記帳を含めない・分割は親で 1 件・照合待ちの明細は照合側で数える)。この差は意図したものです ([`final-review.md` F12](../overview-screen/final-review.md))。

## 1. まず症状を分類する

| 症状 | 最初に見る節 |
|---|---|
| 3 か所のうちどれかだけ数字が違う | §2 (DOM / 画面) |
| 3 か所は同じだが、期待より多い・少ない | §3 (API) → §4 (core) |
| 仕分け画面・照合画面の件数と合わない | 前提の「母数が違う」を確認し、§4 |
| 期間を変えたら件数が変わった | §2 (期間がキーに混入していないか) |
| 「後で確認」したのに減らない / 勝手に戻った | §3 の snoozes と指紋 |
| 画面によって崩れて数字が読めない | §5 (描画) |

## 2. 画面 (DOM 系統)

1. ブラウザの開発者ツールの Network で、`/api/review-queue` が **1 回の読み込みにつき 1 本**だけ呼ばれていることを見ます。期間を変えたときに `?span=` 付きで呼ばれていたら、キーに期間が混入しています。
2. 同じ応答の `total` と、3 か所の表示を突き合わせます。0 件は「未処理なし」と表示されます。
3. 再現できたら DOM テストで固定します。

   ```bash
   pnpm --filter @kanjo/web exec vitest run src/overview-review-queue.dom.test.tsx
   ```

   このテストは 3 か所の一致、後で確認で同時に減ること、解除で同時に戻ること、1年→3年 で不変なことを検査しています。

## 3. API 系統

ローカルでは、ログイン後のブラウザで次の応答を直接開きます。

```text
http://127.0.0.1:<vite port>/api/review-queue
```

| フィールド | 見ること |
|---|---|
| `total` | `counts` の合計と一致するか |
| `counts` | `classification` / `reconciliation` / `import` の内訳 |
| `snoozedCount` / `snoozedItems` | 後で確認で外れた件数と明細 |
| `items[].month` | 期間の表で絞る元。件数には使わない |

「後で確認したのに減らない」ときは、`PUT /api/review-queue/snoozes/:kind/:itemKey` の応答を見ます。
404 `review_item_not_found` は対象がキューに無い (すでに直された) ことを、409 `canonical_write_busy` は取込中であることを示します。
「勝手に戻った」ときは、その明細が編集・再取込で内容が変わっていないかを確かめます。指紋が変われば仕様どおり件数に戻ります (BR-004)。

API の契約はテストで固定しています。

```bash
pnpm --filter @kanjo/api exec vitest run src/overview.test.ts
```

## 4. core 系統

件数の数え方は `packages/core/src/overview.ts` の `buildReviewQueue` / `applyReviewSnoozes` / `reviewQueueCounts` にあります。
月次クローズのステップ判定 (`monthlyCloseStatus`) は保留中の明細も未完了として数えるので、
**件数が 0 でも仕分けステップが未完了**になることがあります (BR-005)。これは不具合ではありません。

```bash
pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts
```

## 5. 描画系統

狭い幅でカードやアクションバーが重なって数字が読めない場合は、描画検査で 8 幅を確認します。

```bash
KANJO_VISUAL_BASE_URL=http://127.0.0.1:<vite port> node packages/web/scripts/check-financial-visuals.mjs
```

## 6. 本番で起きたとき

- 本番 D1 を直接書き換えて件数を合わせません。`review_snoozes` / `monthly_close_reviews` は利用者の判断の記録です。
- 利用者には、画面の「後で確認にした明細」から解除できることを案内します。
- 表示の不具合で Worker を戻す手順は [`close-out.md`](../overview-screen/close-out.md) にあります。2 表は残したまま戻せます。
