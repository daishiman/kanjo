# 推移画面 証跡索引 (SYS-TRENDS-P11)

| 成功基準 | 証跡 (文書) | 証跡 (テスト・コマンド) |
|---|---|---|
| S1 | `assurance.md` 実描画 | `trends-screen.dom.test.tsx`、`pnpm --filter @kanjo/web run check:financial-routes`、`pnpm lint` |
| S2 | `docs/trends-screen.md` 数値の出所 | `trend-metrics-contract.test.ts`、`trends-screen.integration.test.ts` |
| S3 | `docs/trends-screen.md` 指標の足し方、`refactoring.md` | `trend-metrics-contract.test.ts`、指標 id の grep |
| S4 | `docs/trends-screen.md` URL の状態・遷移先 | `trends-screen.dom.test.tsx`、`analysis-mutation-invalidation.dom.test.tsx`、`classify-trends-filter.dom.test.tsx` |
| S5 | `docs/trends-screen.md` | `trend-comparison.test.ts`、`trend-contract.test.ts` |
| S6 | `test-run.md`、`assurance.md` | package 全件、typecheck、lint、build / Worker dry-run、分割実描画、preview smoke |

phase 文書の一覧:

| phase | 文書 |
|---|---|
| P01 | `requirements-baseline.md` |
| P02 | `architecture-decision.md` |
| P03 | `design-review.md` |
| P04〜P05 | テスト 5 本と実装 (`final-review.md` の FR 表) |
| P06 | `test-run.md` |
| P07 | `acceptance.md` |
| P08 | `refactoring.md` |
| P09 | `assurance.md` |
| P10 | `final-review.md` |
| P11 | 本書 |
| P12 | `docs/trends-screen.md`、`design/FINAL-UI/spec/AUDIT.md` の 07 行 |
| P13 | `close-out.md` |
