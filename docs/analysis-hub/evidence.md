# 支出分析ハブ 証跡索引 (SYS-ANHUB-P11)

> 注記: 本表のテスト件数と未解決表は初回導入サイクルの記録。再改善の現行仕様は `architecture-decision.md`、最新の実行結果は作業報告を正とする。

- 作成日: 2026-09-15
- Entry gate: `docs/analysis-hub/final-review.md` (P10) が最終判定 pass を記録している
- 対象 feature: `feat-analysis-hub` (Beads epic `kanjo-lci`、task `kanjo-lci.1`〜`kanjo-lci.13`)
- 基準コミット: `2162fd2` (origin/main と同一) + 本 feature の未コミット変更
- 本書の役割: P12 / P13 が参照する証跡の入口。証跡の本文は各記録にあり、ここには場所と要点だけを置く。

## 1. phase 別の成果物

| Phase | Beads | 記録 | 主な証跡 | 判定 |
|---|---|---|---|---|
| P01 要件 | kanjo-lci.1 | [requirements-baseline.md](requirements-baseline.md) | FR / BR / AC を `specs/spec-analysis-hub.md` と突合 | 完了 |
| P02 設計 | kanjo-lci.2 | [architecture-decision.md](architecture-decision.md) | 決定 7 件、未決 2 件、C1..C4 | 完了 |
| P03 設計レビュー | kanjo-lci.3 | [design-review.md](design-review.md) | 観点 13 件適合・判定可能、再オープン不要 | 完了 |
| P04 テスト設計 | kanjo-lci.4 | `packages/core/src/analysis-hub.test.ts`<br>`packages/api/src/analysis-hub.test.ts`<br>`packages/web/src/analysis-hub.dom.test.tsx` | 実装前に失敗するテスト | 完了 |
| P05 実装 | kanjo-lci.5 | `packages/core/src/analysis-hub.ts`<br>`packages/api/src/routes/analysis-hub.ts`<br>`packages/api/src/index.ts`<br>`packages/web/src/pages/Analysis.tsx`<br>`packages/web/src/routeMetadata.ts`<br>`packages/web/src/components/Layout.tsx` | P04 のテストが緑 | 完了 |
| P06 実行 | kanjo-lci.6 | [test-run.md](test-run.md) | test / typecheck / lint の exit code、F1 / F2 の切り分け、mutation M1..M3・W1..W2 | 完了 |
| P07 受入 | kanjo-lci.7 | [acceptance.md](acceptance.md) | AC-001..006 の判定とテスト名 | AC-006 条件付き pass |
| P08 リファクタリング | kanjo-lci.8 | [refactoring.md](refactoring.md)<br>`packages/api/src/ai/dataset.ts` | 22,692 通りの等価比較と陰性対照 | 完了 |
| P09 品質保証 | kanjo-lci.9 | [assurance.md](assurance.md) | WCAG AA、URL 最小化、認証、D1 15 文、配信構成無変更、check 系 exit 0 | 6 観点 pass |
| P10 最終レビュー | kanjo-lci.10 | [final-review.md](final-review.md) | S1〜S6 と FR / 決定 / 実装の突合、write scope 越えの一覧 | pass (条件 2 件) |

## 2. 受入条件 → 証跡

| 受入 | 判定記録 | 検証の所在 |
|---|---|---|
| S1 / AC-001 画面構成・トークン | acceptance.md AC-001 | `analysis-hub.dom.test.tsx`「/analysis はタブへ転送せず、ハブの構成要素を描く」ほか 2 件、直書き色走査 0 件 |
| S2 / AC-002 focus と既存 URL | acceptance.md AC-002 | `analysis-hub.dom.test.tsx` 5 件、`analysis-tabs.dom.test.tsx`「統合前のURLは行き先を失わない」 |
| S3 / AC-003 API 1 本 | acceptance.md AC-003 | `analysis-hub.dom.test.tsx`「ハブ表示中は集約 API 1 本だけを呼び、5 タブの API を呼ばない」、`packages/api/src/analysis-hub.test.ts` 4 件 |
| S4 / AC-004 規則 | acceptance.md AC-004 | `packages/core/src/analysis-hub.test.ts` の describe BR-001..BR-005、test-run.md mutation M1..M3 |
| S5 / AC-005 短縮名とバッジ | acceptance.md AC-005 | `routeMetadata.ts` ANALYSIS_TABS、`analysis-hub.dom.test.tsx`「サイドバーの要確認バッジ」2 件と変異 3 件 |
| S6 / AC-006 ゲートと狭幅 | acceptance.md AC-006、assurance.md 5・6 | 下記 3 の実行結果、ハブ狭幅 8 条件の実描画検査 |

## 3. コマンド実行結果

ログの本文は作業端末の一時領域に置き、repo には残していない (ローカル絶対パスを公開文書へ書かない規則のため)。exit code と要約は各記録を正とする。

| コマンド | exit | 要約 | 記録 |
|---|---|---|---|
| `pnpm -r test` | 0 | core 579 passed・6 skipped / api 529 / web 551 (バッジ 2 件追加後) | test-run.md、acceptance.md |
| `pnpm --filter @kanjo/api test` (P08 後) | 0 | 40 files / 529 tests | refactoring.md |
| `pnpm typecheck` | 0 | core / api / web | test-run.md、refactoring.md |
| `biome check .` | 0 | 389 files | test-run.md、refactoring.md |
| `pnpm lint` | 1 | `check-design-tokens` (F1) と `security:content` (F2) のみ赤。他 8 段は緑 | test-run.md |
| `pnpm --filter @kanjo/web run check:thead` / `check:financial-figure` | 0 | 合格 | acceptance.md AC-006 |
| `pnpm --filter @kanjo/web run check:mobile-layout` | 0 | すべて合格 | assurance.md 6 |
| `pnpm --filter @kanjo/web run check:financial-routes` | 0 | すべて合格 (本 worktree の vite を 4185 で起動) | assurance.md 6 |
| `pnpm --filter @kanjo/web run build:bundle` → `check:js-budget` | 0 | 初期 JS 107.24KiB / 110KiB | assurance.md 5 |
| `test -f docs/analysis-hub/final-review.md` | 0 | P10 の検証コマンド | final-review.md |

## 4. 検証の強さ (テストが実装を縛っていることの証跡)

| 変異 | 対象 | 結果 | 記録 |
|---|---|---|---|
| M1 `count > 0` → `count > 1` | core hubPriority | 赤 | test-run.md |
| M2 年換算 `* 12` → `* 1` | core annualSavings | 赤 | test-run.md |
| M3 前期間の開始月を 1 か月ずらす | core previousPeriod | 赤 | test-run.md |
| W1 focus の許可リスト検証を外す | web Analysis.tsx | 強化後に赤 | test-run.md |
| W2 行選択の replace を外す | web Analysis.tsx | 強化後に赤 | test-run.md |
| バッジを 0 件でも出す / 全視点に出す / 件数固定 | web Layout.tsx | 3 件とも赤 | acceptance.md AC-005 |
| api 前期間の窓を 1 か月ずらす | core previousPeriod 経由の catalog.test.ts | **緑のまま (穴)** | refactoring.md follow-up |

## 5. 未解決・引継ぎ

| 事項 | 種別 | 閉じる先 | 出所 |
|---|---|---|---|
| C3 例外を `docs/ui-decisions.md` に明記 | 条件 | P12 | final-review.md 6-1 |
| F1 トークン承認記録の spec-state digest | 解決済み | 2026-09-15 最終レビュー | close-out.md 3-1 (archive へ付け替え) |
| F2 評価記録 4 ファイルのローカル絶対パス | 解決済み | 2026-09-15 最終レビュー | close-out.md 3-1 (匿名化) |
| api の前期間の窓を固定するテスト | follow-up | 次サイクル | refactoring.md |
| URL コピーを期間選択状態で検査 | follow-up | 次サイクル | final-review.md 7 |
| check 系に `/analysis` を追加 | follow-up | 次サイクル | assurance.md 6 |
| 更新系の成功時に `['analysis-hub']` を invalidate | 解決済み | 2026-09-15 再改善 | `invalidateAnalysisDerived` / `invalidateAnalysisHub` と mutation 結合テスト |
| write scope を越えた変更 5 件 (P13 で `check-financial-visuals.mjs` を追加) | 記録 | P13 close-out | final-review.md 4、close-out.md 4-1 |
