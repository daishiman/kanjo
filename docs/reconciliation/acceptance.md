# 照合画面 受入検証 AC-001..AC-006 / S1..S6 (SYS-RECON-P07)

`specs/spec-reconciliation.md` の受入基準 AC-001..AC-006 を、1 件ずつ検証コマンドと結果に対応づけた記録です。
AC-00n は goal-spec の Sn と 1 対 1 で対応します (AC-001 = S1 … AC-006 = S6)。
実行記録の全体は [`test-run.md`](test-run.md) にあります。

| AC / S | 基準 (要約) | 検証コマンド | 検証箇所 | 結果 |
|---|---|---|---|---|
| AC-001 / S1 | `04-reconciliation.png` の構成要素をすべて描画し、直書き色の lint が 0 件 | `pnpm --filter @kanjo/web exec vitest run src/reconciliation.dom.test.tsx` / `pnpm lint` (`check-design-tokens`) / `check:financial-routes` | DOM `describe('照合画面の構成')` の 8 件 (KPI 4 枚・絞り込み・対応キュー 4 行・候補一覧 8 列・詳細パネル・下段 2 区画)、`check-design-tokens` の色の直書き検査、実描画の `Reconciliation` (`.recon-kpis`) | 合格 |
| AC-002 / S2 | 5 状態・`actionRequiredCount`・期間投影が仕様正本と境界値テストで固定される | `pnpm --filter @kanjo/core exec vitest run test/reconciliation.test.ts` / `pnpm --filter @kanjo/api exec vitest run test/reconciliation.integration.test.ts` | 照合ページ=ハブ (同期間)、サイドバー=月次クローズ (全期間) を検証 | 合格 |
| AC-003 / S3 | 照合 / 別取引 / 除外 / 一括照合が再読込後も残り、元に戻すで操作前に戻る | 上記 api 統合テストと DOM テスト | api `部分成功: 実在する明細だけを保存し…`、`MF 除外の取り消しで要確認が戻り…`、`新しく外した freee 取引の取り消しは…`、`25 件の実書き込みは文を分けて全件保存し、一括で取り消せる`、`…action_stale で後の変更を消さない`。DOM `一括照合は候補のある未解消行だけを…`、`直前の操作を出し、元に戻すで取り消しを送る` | 合格 |
| AC-004 / S4 | サイドバー文言と件数バッジ、月次クローズ 3/4、ヘッダーとフッターが画像どおりで、既存ルートと旧 URL のテストが緑 | `pnpm --filter @kanjo/web test` | shell / analysis-hub / navigation の DOM テストで `actionRequiredCount` と共通シェルを確認 | 合格 |
| AC-005 / S5 | 画像のアイコンがすべて表示され、絵柄の重複検査が緑 | `pnpm --filter @kanjo/web exec vitest run src/route-icon-distinct.test.tsx` | `docs/reconciliation-icons.md` の対応表 (RouteIcon / UiIcon の登録名) とテストの突き合わせ、`2つのiconが同一の図形集合になっていない`、`片方のiconがもう片方の図形をすべて含んでいない`、`docs の登録名一覧が UiIcon の登録と一致し…` | 合格 |
| AC-006 / S6 | test / typecheck / lint と web の check 系がすべて緑で、狭幅でも 3 カラムが縦積みになり横スクロールしない | `pnpm test` / `pnpm typecheck` / `pnpm lint` / `build:bundle` → `check:js-budget` / `check:mobile-layout` / `check:financial-routes` | 全コマンド exit 0。js 予算 109.33 KiB / 110 KiB。`check:financial-routes` は Reconciliation を 360 / 375 / 390 / 641 / 768 / 900 / 1023 / 1024 / 1280px と rail-zoom200 で描き、本体幅 = ビューポート幅。縦積みは `reconciliation.css` の `@media (max-width: 1099px)` | 合格 |

## 判定

AC-001..AC-006 (S1..S6) はすべて合格で、全体判定は **合格** です。

## 補足: 仕様から変えた点

受入に影響する判断は `architecture-decision.md` §7 に記録しています。受入の読み方に関わるものだけを挙げます。

- 月次クローズの照合ステップとサイドバーは、仕様正本どおり全期間の `actionRequiredCount` を使います (§7 #5)。
- 90 日より古い操作記録の削除は、夜間 cron ではなく `POST /api/reconciliation/actions` の batch の中で行います (`design-review.md` R4)。
- migration の番号は仕様の 0040 ではなく 0041 です (`design-review.md` R2)。
