# 総収支画面 証跡索引 (SYS-TCSCREEN-P11)

AC と FR から証跡を引くための索引。
月次クローズの判定規則は後から見直されやすいので、
「どの規則を、どの証跡で固定したか」を 1 か所から辿れるようにする。

## 1. 受入条件 (AC) から引く

| AC | 内容 | 証跡 |
|---|---|---|
| AC-001 | 画像の構成要素が全て描画され、色の直書きが 0 件 | `acceptance.md` §AC-001 / `total-cashflow-table.dom.test.tsx` / `check:financial-figure` |
| AC-002 | KPI が core と一致し、総合 = 事業 + 家計 | `acceptance.md` §AC-002 / `total-cashflow-screen-rules.test.ts` |
| AC-003 | 単票・複数選択の 同じ/別/除外 と判定後の総額 | `acceptance.md` §AC-003 / `total-cashflow-verdict.integration.test.ts` |
| AC-004 | 取消で総額と件数が一致、再送は 1 回分、再読込後は導線なし | `acceptance.md` §AC-004 / `total-cashflow-operations.integration.test.ts` |
| AC-005 | 規則が docs と境界値テストで固定、サイドバーの現在地と照合バッジ | `acceptance.md` §AC-005 / `docs/total-cashflow-screen.md` / `analysis-hub.dom.test.tsx` |
| AC-006 | test / typecheck / lint と check 系が緑 | `test-run.md` / `assurance.md` §8 |

## 2. 機能要件 (FR) から引く

| FR | 証跡 |
|---|---|
| FR-001 画面の構成要素 | `acceptance.md` §AC-001 の表 / `final-review.md` §1 |
| FR-002 core の集計と 1 回の取得 | `total-cashflow-screen-rules.test.ts` / `architecture-decision.md` |
| FR-003 3 ペインの判定作業 | `assurance.md` §4 / `total-cashflow-verdict.integration.test.ts` |
| FR-004 除外の理由区分とメモ | `refactoring.md` §2 / `total-cashflow-backup.integration.test.ts` の `移行 0042 より前に保存された除外 (FR-004)` |
| FR-005 操作履歴と取消 | `docs/runbooks/total-cashflow-undo-conflict.md` / `total-cashflow-operations.integration.test.ts` |
| FR-006 3 表のバックアップ保護 | `refactoring.md` §3 §4 / `total-cashflow-backup.integration.test.ts` の `復元 バックアップと総収支の判断 (FR-006)` / `import-lifecycle-pure.test.ts` の `総収支の判断3表を積んだ復元が、白紙の移行先で上限未満に収まる` |
| FR-007 自動一致の候補一覧 | `docs/total-cashflow-screen.md` BR-003 / `total-cashflow-verdict.integration.test.ts` |
| FR-008 規則の docs 化と check 系 | `docs/total-cashflow-screen.md` / `assurance.md` §4 §5 |

## 3. 業務規則 (BR) から引く

| BR | 正本 (コード) | 規則 docs | 固定しているテスト |
|---|---|---|---|
| BR-001 一致度 | `duplicateMatchScore()` / `MATCH_SCORE_*` | `docs/total-cashflow-screen.md` BR-001 | `total-cashflow-screen-rules.test.ts` |
| BR-002 判定作業 3 区分 | `totalCashflowWorkbench()` | 同 BR-002 | 同上 |
| BR-003 自動一致の候補 | `nearCandidates()` / `REVIEW_NEAR_DAYS` / `REVIEW_MAX_CANDIDATES` | 同 BR-003 | 同上 |
| BR-004 セグメント | `totalCashflowSummary()` / `EXCLUSION_REASON_CODES` | 同 BR-004 | 同上 + `total-cashflow-verdict.integration.test.ts` の集計語テスト |
| BR-005 除外後の数え方 | `reconcileBizDuplicates()` の review ループ | 同 BR-005 | `total-cashflow-screen-rules.test.ts` |
| BR-006 前年同期比 | `previousYearPeriod()` | 同 BR-006 | 同上 |
| BR-007 判定進捗 | web 側 (core の件数から導く) | 同 BR-007 | `total-cashflow-table.dom.test.tsx` の `選んだ区分の「N 件中 M 件」を出し、区分を変えると数も変わる` |
| BR-008 取消 | `undoOperation()` / `UNDO_STATUS` | 同 BR-008 | `total-cashflow-operations.integration.test.ts` |
| BR-009 消し込み不変条件 | 既存 (変更なし) | 同 BR-009 | `total-cashflow-verdict.integration.test.ts` の `3 つの内訳を足すと freee の総数になる` |

## 4. 入力境界から引く

| 境界 | 定数 | テスト |
|---|---|---|
| `reasonCode` 5 語 | `EXCLUSION_REASON_CODES` | `集計語は許可した 5 語だけを受け、知らない語は弾く` |
| `memo` 200 字 | `EXCLUSION_MEMO_MAX` | `メモは 200 字ちょうどまで受け、201 字は弾く` |
| 一括 200 件 | `MAX_EXCLUSION_ITEMS` / `MAX_VERDICT_ITEMS` | `一括は 200 件ちょうどまで受け、201 件は弾く` |
| D1 クエリ 49 本 | `D1_FREE_QUERY_LIMIT = 50` | `総収支の判断3表を積んだ復元が、白紙の移行先で上限未満に収まる` |

## 5. 文書一覧

| phase | 文書 | 内容 |
|---|---|---|
| P01 | `requirements-baseline.md` | AC-001..006 と規則の実装単位への割り当て |
| P02 | `architecture-decision.md` | 層の分け方と API 境界の決定 |
| P03 | `design-review.md` | 画面構成のレビュー |
| P06 | `test-run.md` | test / typecheck / lint の実測値 (1 回目の lint 赤 6 件と直し方を含む) |
| P07 | `acceptance.md` | AC ごとの判定と根拠、画像との構成差分 |
| P08 | `refactoring.md` | 規則の core 集約、移行、D1 予算の不具合 |
| P09 | `assurance.md` | A11y / CSP / JS 予算 / 狭幅 / 入力境界 |
| P10 | `final-review.md` | FR と差分の対応、スコープ外 0 件の確認 |
| P11 | `evidence.md` | 本書 |
| P12 | `../total-cashflow-screen.md`、`../runbooks/total-cashflow-undo-conflict.md` | 規則 docs と runbook |
| P13 | `close-out.md` | 配信の記録 (commit `2e60d3e` / push / draft PR #55 まで実施。merge は未実施) |

## 6. 再検証のコマンド

```bash
# 規則 (core)
pnpm --filter @kanjo/core test

# API の境界と取消と復元
pnpm --filter @kanjo/api test

# 単体で見たいとき
npx vitest run --root packages/api test/total-cashflow-verdict.integration.test.ts
npx vitest run --root packages/api test/total-cashflow-operations.integration.test.ts
npx vitest run --root packages/api test/total-cashflow-backup.integration.test.ts
npx vitest run --root packages/core test/total-cashflow-screen-rules.test.ts

# 画面 (DOM)
pnpm --filter @kanjo/web test

# 視覚と狭幅
pnpm --filter @kanjo/web run check:financial-routes
pnpm --filter @kanjo/web run check:mobile-layout

# JS 予算 (build:bundle の直後に実行すること。build:artifact は manifest を消す)
pnpm --filter @kanjo/web run build:bundle && pnpm --filter @kanjo/web run check:js-budget

# 実データの混入
pnpm run security:content

# まとめて
pnpm test && pnpm typecheck && pnpm lint
```

## 7. 未達の証跡

| 項目 | 状態 |
|---|---|
| PR の CI が緑 | 確認中 (draft PR https://github.com/daishiman/kanjo/pull/55) |
| migration 0042 の本番適用 | **未実施** (merge 後) |
| 本番 `/analysis/total-cashflow` の表示確認 | **未実施** (merge 後) |

いずれも merge を待つもの。詳細は `close-out.md`。
仕様・設計への反映判断は `spec-reflection-receipt.md` に記録している。
