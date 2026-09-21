# 概況画面

概況 (`/`) は、収支の全体像と「今月まだ確認が要る明細」を 1 画面で見るための画面です。
仕様の正本は `specs/spec-overview-screen.md`、設計の根拠は `architecture/overview-screen-*.md` と
[`overview-screen/architecture-decision.md`](overview-screen/architecture-decision.md) にあり、ここへ転記しません。
この文書は、機能の見取り図と、運用・調査のときに最初に読む場所をまとめます。
見た目は [`../design/FINAL-UI/images/02-overview.png`](../design/FINAL-UI/images/02-overview.png)、物理的な表示順は [`../system-spec/ui-ux.md#表示順の正本`](../system-spec/ui-ux.md#表示順の正本) を参照し、ここへ重複転記しません。

## 前提となる仕組み

- **4 要素は同じ月別系列から出ます。** KPI・推移・年次比較・支出内訳は core の `overviewAggregate` が 1 本の `ScopeMonth[]` から計算します。どれかだけ数字が違うことは起きません (AC-001)。
- **未処理の件数は全期間で数えます。** サイドバーのバッジ・未処理カード・画面下の固定アクションバーは、`GET /api/review-queue` の同じ結果 (react-query のキー `['review-queue']`) を読みます。期間を 1年→3年 に切り替えても件数は変わりません (BR-002)。期間で絞るのは「優先して確認する明細」の表示だけです。
- **「後で確認」は内容指紋に結びつきます。** 保留は明細の金額・日付・内容から作る SHA-256 指紋と一緒に保存し、明細が変わると保留が外れて再び数えられます。月が変わっても自動では外れません (BR-004)。
- **有効な保留はキューと月次クローズで共通です。** 内容指紋が一致する明細は未処理件数と対象月の仕分け・照合ステップの両方から外します。指紋が古くなった保留は無効になり、再び未処理に数えます (BR-005)。

## 1. 画面の構成

| 部品 | 内容 | 実装 |
|---|---|---|
| 期間と範囲 | 1年 / 3年 / 全期間、事業 / 家計 | `usePeriod` / `GET /api/overview?span=&scope=` |
| KPI・推移・年次比較・内訳 | 直近 12 か月の窓。前期は暦で連続した同じ月数のときだけ出す | `packages/core/src/overview.ts` `overviewAggregate` |
| 防衛ラインの見通し | caution / warn とも role=alert。強さは見出しと色 | `pages/Overview.tsx` `DefenseForecastPanel` |
| 未処理カード | 種別ごとの件数、「未処理なし」、後で確認にした明細と解除ボタン | `ReviewSummaryCard` / `components/ReviewQueue.tsx` `SnoozedReviewList` |
| 優先して確認する明細 | 期間内の明細を優先順に並べ、選ぶと推奨と根拠を表示 | `PriorityTable` / `ReviewDetailPanel` (1280px 以上は右パネル、未満はモーダルドロワー) |
| 月次クローズ | 取込 / 仕分け / 照合 / レビューの 4 ステップ | core `monthlyCloseStatus` / `PUT /api/monthly-close/:month/review` |
| 固定アクションバー | 件数を `<output aria-live="polite">` で読み上げ | `ReviewActionBar` |

## 2. API

| メソッドとパス | 役割 | 主なエラー |
|---|---|---|
| `GET /api/overview` | 4 要素・防衛ライン・月次クローズ | 400 `invalid_scope` |
| `GET /api/review-queue` | `{ total, counts, snoozedCount, snoozedItems, items }` | — |
| `PUT /api/review-queue/snoozes/:kind/:itemKey` | 後で確認。指紋はサーバで計算 | 400 `invalid_kind` / `invalid_item_key`、404 `review_item_not_found`、409 `canonical_write_busy` |
| `DELETE /api/review-queue/snoozes/:kind/:itemKey` | 後で確認の解除 (204) | 400、409 |
| `PUT /api/monthly-close/:month/review` | 月次レビュー済みにする。初回の `reviewed_at` を保ち、レビュー者はログイン中の利用者 id | 400 `invalid_month`、409 |
| `DELETE /api/monthly-close/:month/review` | 月次レビューの取り消し (204) | 400、409 |

すべて `/api/*` の認証ガード配下で、未ログインは 401 です。

## 3. データ

migration `0040_review_snoozes_and_monthly_close_reviews.sql` が 2 表を追加します (CREATE のみ)。

| 表 | 主キー | 列 | 備考 |
|---|---|---|---|
| `review_snoozes` | `(user_id, item_kind, item_key)` | `fingerprint` (64 桁)、`snoozed_at` | 明細本文の写しは持たない |
| `monthly_close_reviews` | `(user_id, month)` | `reviewed_at`、`reviewed_by_user_id` | `user_id` はテナント鍵、`reviewed_by_user_id` はレビューした利用者 |

どちらもバックアップ JSON (`reviewSnoozes` / `monthlyCloseReviews`) に含まれ、復元で往復します。
キーの無い旧バックアップは既存行を残し、`reviewedByUserId` の欠けた行は 400 で拒みます。
点検の記録は [`overview-screen/refactoring.md`](overview-screen/refactoring.md) にあります。

## 4. 検査の置き場所

検査は 4 系統に分けています。件数ずれの調査もこの順で進めます。

| 系統 | ファイル | 見ているもの |
|---|---|---|
| core | `packages/core/test/overview-close-status.test.ts` | 総額差 0、指紋、4 ステップ判定表、推奨の決定論、暦の前期 |
| DOM | `packages/web/src/overview-review-queue.dom.test.tsx`、`src/defense-forecast.dom.test.tsx` | 3 か所の件数一致、後で確認と解除、期間での表の絞り込み、フォーカス、role |
| API | `packages/api/src/overview.test.ts` | 認証、エラー形、バックアップ往復、レビュー者 |
| 描画 | `packages/web/scripts/check-financial-visuals.mjs` | Overview の表示順・広幅グリッド・8 幅の横はみ出し |

## 5. 困ったとき

- 件数が 3 か所で合わない、仕分け画面と数字が違う: [`runbooks/overview-review-queue-mismatch.md`](runbooks/overview-review-queue-mismatch.md)
- 受入と証跡: [`overview-screen/acceptance.md`](overview-screen/acceptance.md)、[`overview-screen/evidence.md`](overview-screen/evidence.md)
- リリースと巻き戻し: [`overview-screen/close-out.md`](overview-screen/close-out.md)
- main 取り込み時の仕様反映の判断: [`overview-screen/spec-reflection-receipt.md`](overview-screen/spec-reflection-receipt.md)
