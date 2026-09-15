# 支出分析ハブ 最終レビュー (SYS-ANHUB-P10)

> 注記: これは初回導入サイクルの完了記録。2026-09-15 再改善後の現行判断は `architecture-decision.md` を正本とする。

- 実施日: 2026-09-15
- Entry gate: `docs/analysis-hub/assurance.md` (P09) の判定一覧が 6 観点すべて pass
- 突合の軸: `features/feat-analysis-hub.md` の到達状態・受入 S1〜S6 → `requirements-baseline.md` (P01) → `architecture-decision.md` (P02) → `design-review.md` (P03) → テスト (P04) → 実装 (P05) → `test-run.md` (P06) → `acceptance.md` (P07) → `refactoring.md` (P08) → `assurance.md` (P09)
- 最終判定: **pass** (条件 2 件を P12 / P13 へ引継ぎ。下記「引継ぎ」)

## 1. 成果物の所在

| Phase | 成果物 | 所在 | 状態 |
|---|---|---|---|
| P01 | 要件ベースライン | `docs/analysis-hub/requirements-baseline.md` | あり。FR-001..006 / BR-001..005 / AC-001..006 を仕様書と 1 行ずつ突合済み |
| P02 | 設計決定記録 | `docs/analysis-hub/architecture-decision.md` | あり。決定 7 件・未決 2 件 (staleTime 値・invalidate 範囲) |
| P03 | 設計レビュー | `docs/analysis-hub/design-review.md` | あり。再オープン不要、指摘 4 件 (軽微) |
| P04 | 先行テスト | `packages/core/src/analysis-hub.test.ts`、`packages/api/src/analysis-hub.test.ts`、`packages/web/src/analysis-hub.dom.test.tsx` | あり |
| P05 | 実装 | `packages/core/src/analysis-hub.ts`、`packages/api/src/routes/analysis-hub.ts`、`packages/api/src/index.ts`、`packages/web/src/pages/Analysis.tsx`、`packages/web/src/routeMetadata.ts`、`packages/web/src/components/Layout.tsx` | あり |
| P06 | 実行記録 | `docs/analysis-hub/test-run.md` | あり。コード起因の失敗 0、F1 / F2 はコード外 |
| P07 | 受入判定 | `docs/analysis-hub/acceptance.md` | あり。AC-001..005 pass、AC-006 条件付き pass |
| P08 | 重複除去 | `packages/api/src/ai/dataset.ts`、`docs/analysis-hub/refactoring.md` | あり。22,692 通りで等価 |
| P09 | 品質保証 | `docs/analysis-hub/assurance.md` | あり。6 観点 pass |

## 2. 受入 S1〜S6 の最終突合

feature の受入 (S) と要件の受入 (AC) は番号順に一対一で対応する (S1=AC-001 … S6=AC-006)。

| S | 要求 | 実装の所在 | 検証 | 判定 |
|---|---|---|---|---|
| S1 | 画像の構成要素 8 種、トークン・共通 Button / PageShell、直書き色 0 | `Analysis.tsx` (見出し・URL コピー・5 タブ・サマリー・ルート一覧・選択中パネル・読み順・下部バー) | hub dom テスト 3 件、直書き色走査 0 件 (acceptance AC-001) | pass |
| S2 | `?focus=` 再現、`/analysis/:tab` と旧 URL 転送が緑 | `Analysis.tsx` の `focusOf` と `setParams(..., { replace: true })` | hub dom テスト 5 件、analysis-tabs dom テスト (acceptance AC-002) | pass |
| S3 | ハブ表示中は `GET /api/analysis/hub` 1 本、5 API 0 件 | `analysisHubQueryKey` を `routeMetadata.ts` に置き Layout とハブで共有 | hub dom「集約 API 1 本だけを呼び…」、api テスト 4 件 | pass |
| S4 | 前期間比・優先度・正常判定・改善余地を境界値テスト + docs | core `hubPriority` / `matrixIsNormal` / `annualSavings` / `previousPeriod` / `analysisHub` | core describe BR-001..005、mutation M1..M3 赤、docs は requirements-baseline と architecture-decision | pass |
| S5 | 5 タブ短縮名、バッジ = 要確認件数 | `ANALYSIS_TABS[].label`、`Layout.tsx` の `badge danger` | analysis-tabs / navigation-ux / common-shell、hub dom「サイドバーの要確認バッジ」2 件と変異 3 件赤 | pass |
| S6 | test / typecheck / lint / check 系が緑、狭幅で横スクロールなし | — | test・typecheck・check 系 exit 0、ハブ狭幅 8 条件で scrollWidth = clientWidth。lint は F1 / F2 で赤 | 条件付き pass |

## 3. 要件 → 決定 → 実装の一貫性

| 要件 | 決定 (P02) | 実装で確認した事実 | 整合 |
|---|---|---|---|
| FR-001 ハブ描画、転送維持 | decision-001 | `/analysis` はハブ、`/analysis/:tab` はタブ。hub dom「/analysis/:tab は従来どおり…」 | 一致 |
| FR-002 `?focus=` と URL コピー | decision-001 (URL は origin + `/analysis?focus=<id>` のみ) | `Analysis.tsx` の copyUrl がその固定形だけを書く | 一致 (下記 注1) |
| FR-003 core 純関数 + 集約 API + 前期間の移設 | decision-002 / backend-003 | `analysisHub` と `previousPeriod` は core、route は読取りと受渡しのみ、`app.route('/api', analysisHubRoute)` は共通ゲートの後。AI 側は P08 で core 版へ置換し、api 内の定義は 0 件 | 一致 |
| FR-004 規則の docs とテスト | decision-003 | 名前付き関数 3 つ + 境界値テスト、変異で赤 | 一致 |
| FR-005 短縮名とバッジ | decision-004 / frontend-003 | label 5 件を短縮、バッジは要確認 1 件以上の照合・総収支だけ、リンク外の兄弟要素、`enabled: !locked` | 一致 |
| FR-006 静的定義の 3 項目 | — | `ANALYSIS_TABS[].learn / sources / excluded / step` に数字を含まない静的文言 | 一致 |
| BR-004 前期間 | backend-003 | ラベル `前${n}か月`、1 か月でも欠ければ null、全期間は常に null | 一致 |
| BR-005 総収支の再利用 | C4 | `totalCashflowReport` の months と `review.length` を再利用 (core テストで件数一致) | 一致 |
| 非機能: D1 読取り | — | ルート固有 15 文で `/total-cashflow` と同数 (assurance 4) | 一致 |
| 非機能: WCAG AA・URL 最小化・認証 | C2 / C3 / security | assurance 1〜3 | 一致 |
| 情報の優先順位 | ui-ux-005 | 縦の並びは画像どおり。styles.css を触らず既存クラスと CSS 変数の inline style | 一致 |
| C1 集計の重複禁止 | C1 | api / web に同じ計算は無い。P08 で最後の重複 (`previousPeriod`) を除去 | 一致 |

注1: FR-002 の判定文は「URL コピーが現在の URL をクリップボードへ書く」。期間は localStorage に置き URL に載せない (scope_out) ため、ハブの現在の URL で意味を持つ値は `focus` だけで、決定 001 の固定形と同じ内容になる。security 要件 (金額・取引・期間を載せない) を優先した P02 の具体化であり、要件との矛盾ではない。

## 4. スコープの遵守

| 観点 | 結果 |
|---|---|
| scope_out: 5 タブ詳細画面 | `packages/web/src/pages/analysis/` の差分なし |
| scope_out: 支出分析以外の文言 | `routeMetadata.ts` の差分は `ANALYSIS_TABS` と `analysisHubQueryKey` だけ。`APP_ROUTES` の label は無変更 |
| scope_out: 期間の保存先 | `period.tsx` の差分なし。URL に期間を載せない |
| scope_out: D1 スキーマ | `migrations/` の差分なし |
| 配信構成 | `_headers`・`ci.yml`・`deploy.yml`・`migrate.yml`・`wrangler.jsonc` の差分なし |

### task の write scope を越えた変更 (すべて理由付きで記録済み)

| ファイル | 変更 | 理由と記録先 |
|---|---|---|
| `packages/core/src/index.ts` | `export * from './analysis-hub.js'` の 1 行 | core の公開面が再輸出で決まるため。P03 指摘 3 で予告 |
| `packages/web/src/common-shell.dom.test.tsx` | 現在地の期待値 `トータル収支` → `総収支` | 短縮名の波及。P03 指摘 4 で予告。P12 の write scope は `common-shell-routes.dom.test.tsx` で、こちらは別ファイル |
| `packages/web/src/analysis-hub.dom.test.tsx` (P04 の範囲) | W1 / W2 検出の強化 (P06)、サイドバーのバッジ 2 件 (P07) | 変異が生存した / AC-005 を直接見るテストが無かったため。test-run.md・acceptance.md に記録 |
| `packages/web/src/analysis-tabs.dom.test.tsx`・`navigation-ux.dom.test.tsx` | 短縮名とハブ前提へ更新 | P12 の write scope。回帰を止めないため P05〜P06 で先に更新し、P12 で内容を確定する |

## 5. 未決事項の扱い

| 未決 (P01) | 現状 | 判断 |
|---|---|---|
| staleTime の値 | TanStack Query 既定 (0) のまま。共有 queryKey で同一画面の重複取得は 1 本 | 仮の値を置いていない。P02 の記録どおり |
| invalidate の範囲 | 総収支の判定・freee 除外・取込の成功時の `['analysis-hub']` invalidate は未追加 (該当画面が write scope 外) | 既知の制約。遷移時の再取得で古い表示は遷移までに限られる。次サイクルの follow-up |
| 狭幅の折りたたみ等の細部 | 狭幅は flex-wrap の縦積みで横スクロール 0 | inference 由来の細部は未確定のまま、横スクロールしない要件だけを満たした |

## 6. 引継ぎ (最終判定の条件)

1. **P12**: C3 の例外 (ハブ API をサイドバーでも使う) を `docs/ui-decisions.md` に明記する (P02 decision frontend-003 / P03 指摘 2)。現時点の `docs/ui-decisions.md` には未記載で、P12 の責務として残る。
2. **P13 / commit 前**: lint の F1 (`docs/design-system/token-approval.json` の spec-state digest) と F2 (評価記録 4 ファイルのローカル絶対パス) を解消する。どちらも `packages/` 外の仕様・計画成果物が原因で、機能コードの差し戻しは不要。

## 7. 見つかった穴 (follow-up、差し戻しは不要)

| 穴 | 出所 | 推奨 |
|---|---|---|
| api テストが AI 用データの前期間の窓を固定していない | refactoring.md | `buildAgentData` の `period.previous` を固定する api テストを追加 |
| URL コピーのテストが期間を選んでいない状態 (既定期間) で描画している | 本レビュー | 期間を選んだ状態 (localStorage に期間あり) でも `writeText` の引数が `/analysis?focus=<id>` のままであることを検査 |
| check 系の巡回対象に `/analysis` が無い | assurance.md 6 | `check-financial-visuals` / `check-mobile-layout` に `/analysis` を追加 |
| 更新系のあとに `['analysis-hub']` を invalidate していない | architecture-decision.md 未決 | 総収支・freee 除外・取込の mutation 成功時に invalidate |

## 判定

P01〜P09 の成果物はすべて存在し、要件・決定・実装・検証が相互に矛盾しない。受入 S1〜S5 は pass、S6 は lint の 2 段がコード外の成果物に起因する条件付き pass。該当 phase への差し戻しは無し。**最終判定: pass** (上記 6 の 2 件を P12 / P13 で閉じる)。
