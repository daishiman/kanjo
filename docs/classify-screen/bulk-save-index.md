# 一括保存と取引一覧の改善 — 記録の索引 (SYS-CLASSIFY-BULK-P11)

記録: 2026-10-02T17:00:49Z (`date -u` の実測)

2026-10-31 の再開後: [PR #79](https://github.com/daishiman/kanjo/pull/79) を draft として作成した。
最新の検証・監査・残課題は evidence の「2026-10-31 の再確認」、commit の基準と判断待ちは
decisions の「リリース準備の再開」を参照する。13 task は merge 前なので完了確定していない。

`specs/spec-classify-bulk-save.md` を実装した feature (feat-classify-bulk-save) の記録の入口。
設計・テスト・受入・品質・レビューの記録は 4 つの文書に分かれている。ここから全部の節へ辿れる。
前のサイクル (feat-classify-screen) の記録は [`design-decisions.md`](design-decisions.md) にあり、本書からは参照するだけで書き換えない。

リンクは文書へのリンクと節の名前で書く。見出しを直してもリンクが切れないように、節のアンカーは使わない。

## 1. 文書

| 文書 | 担当 task | 中身 |
|---|---|---|
| [`bulk-save-decisions.md`](bulk-save-decisions.md) | P01・P02・P03・P05・P12 | 設計の決定。要求の担当、解決関数、上限の定数、対応表、『カテゴリなし』、OI の依頼文と閉じ方 |
| [`bulk-save-evidence.md`](bulk-save-evidence.md) | P04・P06・P08・P09・P13 | テストと品質ゲートの記録。旧実装で落ちること、verify:full、旧い定義の削除、migration の突き合わせ |
| [`bulk-save-acceptance.md`](bulk-save-acceptance.md) | P07 | 受入の確認。AC-01〜AC-30 の根拠、sel に 50 件を選んだ状態の再現、1264px と 1280px の実測 |
| [`bulk-save-review.md`](bulk-save-review.md) | P10 | 独立したレビューの指摘と、差分の分類 |
| 本書 | P11 | 記録の索引 |
| [`design-decisions.md`](design-decisions.md) | 前のサイクル | 参照だけ。本 feature の記録は書き足していない |

## 2. task から節へ

| task | 文書 | 節 |
|---|---|---|
| P01 範囲と契約の境界 | decisions | 「文書の担当と進め方」「§1 要求の担当と契約の境界 (P01)」 |
| P02 実装の設計 | decisions | 「§2 実装の設計 (P02)」 |
| P03 既存コードとの照合 | decisions | 「§3 既存コードとの照合 (P03)」 |
| P04 先に書くテスト | evidence | 「P04 テストの移し替えと新しい契約のテスト (SYS-CLASSIFY-BULK-P04)」 |
| P05 実装 | decisions | 「§4 実装で決めた細部 (P05)」 |
| P06 品質ゲートの通し | evidence | 「P06 品質ゲートの通し (SYS-CLASSIFY-BULK-P06)」 |
| P07 受入の確認 | acceptance | 「1. AC-01〜AC-30 の根拠」「2. sel に 50 件を選んだ状態の再現」「3. 1264px と 1280px (AC-22)」「4. 自動のコマンド」 |
| P08 旧い定義の削除と migration | evidence | 「P08 旧い定義の削除と migration の突き合わせ (SYS-CLASSIFY-BULK-P08)」 |
| P09 品質ゲート | evidence | 「P09 品質ゲート (SYS-CLASSIFY-BULK-P09)」。中に「受け入れ条件と結果」「初期 JS 予算」「内容の安全検査」 |
| P10 レビュー | review | 「0. 判定」「1. 走らせたテスト」「2. 指摘の一覧」「3. 観点ごとの確認」「4. 追加: core の値の解決関数 — 指摘 D」「5. 差分の範囲」「6. 再レビュー」「7. 確かめられなかったこと・推測」 |
| P11 索引 | 本書 | — |
| P12 文書の同期 | decisions | 「§5 未決事項の閉じ方の記録 (P12)」。追記先は 6 章 |
| P13 リリース前の最終確認 | evidence | 「P13 リリース前の最終確認 (SYS-CLASSIFY-BULK-P13)」。merge の前に確かめた事項だけを書く |

## 3. 問いから記録へ

| 知りたいこと | 記録 |
|---|---|
| ある AC を何が確かめたか | acceptance「1. AC-01〜AC-30 の根拠」。テスト名は `describe` と `it` の名前で書いてある |
| ある要求 (FR・NFR・BR) をどの task が受け持ったか | decisions「要求 id の担当表」 |
| 未決事項 (OI-1〜OI-8) がどう閉じたか | decisions「未決事項と open item の対応」→「OI-1 の依頼文」「OI-4 の依頼文」「OI-6・OI-3・OI-8 の結果」→「§5 未決事項の閉じ方の記録 (P12)」 |
| 新しいテストが旧実装で落ちること | evidence「新しい契約のテストが旧実装で落ちること」、decisions「画面のテストが旧実装で落ちること」 |
| 一括保存の書き込みと D1 の上限 | decisions「D1 の上限の定数 (NFR 上限の定数)」「一括保存の書き込みと予算 (FR-06・AC-27・AC-28・OI-8)」 |
| 『カテゴリなし』の扱い | decisions「『カテゴリなし』の予約の値 (FR-18・BR-04・OI-3)」「復元で『カテゴリなし』が戻ること (§2 の宿題)」、review「観点 6: 予約の値『カテゴリなし』」 |
| 実装の途中で見つけた不具合と修正 | acceptance「修正の前の結果 (不具合の発見)」「差し戻しと修正」「修正の後の結果」、decisions「レビューの差し戻しで直したこと (P10 → P05)」「§5 未決事項の閉じ方の記録 (P12)」の不具合の表 |
| 旧い定義が残っていないこと | evidence「P08 旧い定義の削除と migration の突き合わせ」の「消した定義」 |
| migration の番号と承認 | evidence「migration の突き合わせ (OI-6)」 |
| レビューで何を指摘されたか | review「2. 指摘の一覧」(8 件の表)→「3. 観点ごとの確認」(指摘ごとの全文と直した後)→「4. 追加: core の値の解決関数 — 指摘 D」→「6. 再レビュー」 |
| 宣言した書き込み範囲の外を触ったファイル | review「5. 差分の範囲」の「宣言外の 7 件」 |

## 4. 画面検査の記録

/classify の実描画検査は、匿名の明細を検査スクリプトの中で作って描く。実データも `samples/` も使わない。

| 記録 | 中身 |
|---|---|
| acceptance「3. 1264px と 1280px (AC-22)」 | 解決関数を直した後の実測。列の幅、パネルの開閉、横のはみ出し、フォーカスの見え方、一括バーの高さ |
| evidence「1264px と 1280px (AC-22)」 | P06 の通しでの同じ実測 |
| decisions「画面の実描画検査 (AC-22・FR-13)」 | 検査の作り。何をどの幅で測り、何を失敗にするか |
| `packages/web/scripts/check-financial-visuals.mjs` | 検査の本体。1577 行から匿名の明細、2615 行から /classify の段 |

再現は `pnpm --filter @kanjo/web run check:classify-screen`。
スクリーンショット (`classify-*.png`) は `KANJO_VISUAL_OUTPUT_DIR` の場所 (指定しなければ OS の一時ディレクトリの `kanjo-financial-review`) に出る。
コマンドを走らせれば同じものが作れるので、リポジトリには置かない。

## 5. 再現のコマンド

| 対象 | コマンド |
|---|---|
| 全部の通し | `pnpm run verify:full` |
| core (解決関数・『カテゴリなし』・集計) | `pnpm --filter @kanjo/core test` |
| api (一括保存・D1 の上限・対応表・migration) | `pnpm --filter @kanjo/api test` |
| web (画面のテスト・バックアップの復元) | `pnpm --filter @kanjo/web test` |
| 型 | `pnpm typecheck` |
| 直書きの色・用語・graph lineage・migration の承認 | `pnpm lint` |
| 初期 JS の予算 (110KiB) | `pnpm --filter @kanjo/web run build:bundle && pnpm --filter @kanjo/web run check:js-budget` |
| 公開文書の実データ | `pnpm run security:content` |
| /classify の実描画 | `pnpm --filter @kanjo/web run check:classify-screen` |
| migration の承認の検査 | `pnpm run github-scripts:test` |

## 6. 仕様と設計の文書

| 文書 | 本 feature との関係 |
|---|---|
| `specs/spec-classify-bulk-save.md` | 画面の仕様。受け入れ条件 AC-01〜AC-30 の正本 |
| `architecture/classify-bulk-save-*.md` (8 本) | 認証・backend・database・frontend・infrastructure・保守運用・security・UI/UX の設計 |
| `tasks/feat-classify-bulk-save/sys-classify-bulk-p01.md`〜`p13.md` | 13 task の仕様書 |
| `docs/data-schema.md` | P12 が対応表 (`tax_account_map`) と設定の変更履歴の対象の列を追記した |
| `architecture/classify-bulk-save-database.md`・`classify-bulk-save-backend.md` | P12 が実装の結果を末尾に追記した |

## 7. 実データと secrets

本 feature のテストと記録は、匿名サンプル (samples/) と、テストや検査スクリプトの中で作る架空の明細だけを使う。

| 検査 | 結果 (本書の記録の時刻に実測) |
|---|---|
| `pnpm run security:content` (公開文書にある個人ホームの絶対パスと、Downloads・data 配下のデータファイルの参照) | 「公開文書の実データ参照チェック: OK」、exit 0 |
| 同じ規則の写しで、当たったファイルと規則の名前だけを出すもの (`<scratchpad>/` に置き、リポジトリには入れていない) | 当たり 0 件 |
| 差分の中の `data/`・ローカル secrets・鍵や token の形 | review「ローカル secrets・`data/`・実データ」。`data/` とローカル secrets は 0 件。鍵や token の形の当たりは、どれも統合テストの架空の利用者 |
| `samples/` | 変えていない (同じ節) |

git の操作は `scripts/hooks/guard-real-data.sh` が PreToolUse フックで検査する。本 feature の作業でフックの止めた操作を回避したことはない。
