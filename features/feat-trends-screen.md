---
graph_node_id: "feat-trends-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "推移画面 (07-trends) の比較・要因分析と指標の登録制"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "feature"]
file_path: "features/feat-trends-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a01d36578c3ce33fa0a1db7d23dca6d289fd0cbe1477f95fba7ae6b1ebe6c0a5"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-trends-screen.md", "source_version": "0.1.11", "source_digest": "b3951e2fe1dcd99a5109bae047584d1682033de282894c34bf7ecc73145d4b17", "imported_at": "2026-09-16T10:19:11Z"}
created_at: "2026-09-16T10:19:11Z"
updated_at: "2026-09-16T10:19:11Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/deploy.yml", "design/FINAL-UI/images/07-trends.png", "design/FINAL-UI/spec/AUDIT.md", "docs", "docs/trends-screen.md", "packages/api/src/dataset.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/wrangler.jsonc", "packages/core/src/analysis-hub.ts", "packages/core/src/index.ts", "packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/trend-metrics.ts", "packages/core/src/trend.ts", "packages/core/test/trend-comparison.test.ts", "packages/core/test/trend-contract.test.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/src/components/Button.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/lib/api.ts", "packages/web/src/lib/charts.ts", "packages/web/src/lib/period.ts", "packages/web/src/pages/Classify.tsx", "packages/web/src/pages/analysis/Trends.tsx", "packages/web/src/pages/analysis/trends-scope.dom.test.tsx", "packages/web/src/pages/analysis/trends-screen.dom.test.tsx", "packages/web/src/styles", "packages/web/src/test-support/chart-test-doubles.tsx"]
purpose: "収支が『いつ・なぜ』変わったかを、推移画面の 1 画面で掴めるようにする。利用者が推移を開いた時点で、選んだ期間の収入・支出・純収支の月次推移と、前期間または前年との差が総合/事業/家計で読め、最も変化が大きい月の増減要因 (どのカテゴリのどの取引先がいくら動いたか) が根拠の明細まで辿れる状態にする。指標は登録制にして、収支以外の推移もあとから同じ画面の型で追えるようにする。"
goal: "/analysis/trends が 07-trends.png の全構成要素をトークンと共通 Button/PageShell/chart の共通設定で描画し、総合/事業/家計×収入・支出・純収支×前期間・前年の KPI・チャート・カテゴリ表と取引先の展開行・パレート・上位 3 が、総収支と同じ取引集合から数えた core の値と一致して総合=事業+家計・純収支=収入-支出が成り立ち、要確認の明細は数値に含めず件数と金額を注記し、指標は定義 1 件の追加で画面と API に現れ、選択月の詳細と選択バーから MF 由来は /classify の月・範囲・カテゴリ・取引先の絞込へ、freee 由来は総収支画面へ辿れて条件は URL から復元され、既存の傾向判定は MF の明細だけを基準とする旨を明記した開閉部分に残り、計算規則と説明文の規則が docs/trends-screen.md と境界値テストで固定され、既存の test / typecheck / lint / 視覚検査が緑のままの状態。"
scope_in: ["推移タブ (07-trends.png) の情報階層を共通シェル上に構築: 条件帯・KPI・意味付き推移チャート・詳細・カテゴリ・符号付きパレート・上位 3・選択バー、旧傾向判定の固有部分だけを開閉化", "packages/core の推移集計の拡張と指標定義の登録制 (収入・支出・純収支)", "GET /api/trends の条件 (範囲・指標・比較対象・選択月・カテゴリ side) と返却の拡張", "明細画面 /classify のカテゴリ・取引先の絞込クエリ", "計算規則と説明文の規則の docs とテスト"]
scope_out: ["収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)", "取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)", "AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)", "共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う", "照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う", "web 以外の platform (専用アプリ)"]
acceptance: ["S1 (G1): /analysis/trends で 07-trends.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell/chart の共通設定経由で、直書き色の lint が 0 件である。", "S2 (G2, G3): 3 指標×3 範囲×2 比較対象のどの組合せでも、画面の KPI・チャート・表の値が core の返却値と一致し、総合=事業+家計・純収支=収入-支出が成り立つ。総合・事業・家計の期間合計は同じ期間の総収支画面の値と一致する。", "S3 (G2): 指標定義を 1 件足すだけで画面と API に新しい指標が現れ、画面と API のコードに指標 id の分岐が無い。", "S4 (G4): 詳細パネルと選択バーからの遷移で、/classify が月・範囲・カテゴリ・取引先で絞り込んだ明細だけを表示し、推移の条件は URL から復元される。", "S5 (G5): 計算規則と説明文の規則が docs に書かれ、境界値テストを含む vitest が通り、既存の傾向判定のテスト (trend-contract.test.ts) も壊れていない。", "S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (視覚検査を含む) が全て緑のままである。"]
architecture_refs: ["arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "S2 (総収支と同じ取引集合での値の一致と恒等式) と S3 (指標定義 1 件の追加で画面と API に現れる) は、core の指標定義と推移集計・GET /api/trends の条件と返却・画面の意味ブロックと URL 状態を同じ受入で貫くため、層ごとに分けると 1 つの受入が複数 feature にまたがる。/classify の絞込も推移の導線の受け側で、単独では価値にならない。migration は無く、旧傾向判定は固有の『手を打つ順番』だけを開閉部分へ残し、新画面と重複する図は削除する。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-trends-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:19:11Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# 目的

収支が『いつ・なぜ』変わったかを、推移画面の 1 画面で掴めるようにする。利用者が推移を開いた時点で、選んだ期間の収入・支出・純収支の月次推移と、前期間または前年との差が総合/事業/家計で読め、最も変化が大きい月の増減要因 (どのカテゴリのどの取引先がいくら動いたか) が根拠の明細まで辿れる状態にする。指標は登録制にして、収支以外の推移もあとから同じ画面の型で追えるようにする。

規範 (要件・判定条件・確定意思決定) の正本は `specs/spec-trends-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/analysis/trends が 07-trends.png の全構成要素をトークンと共通 Button/PageShell/chart の共通設定で描画し、総合/事業/家計×収入・支出・純収支×前期間・前年の KPI・チャート・カテゴリ表と取引先の展開行・パレート・上位 3 が、総収支と同じ取引集合から数えた core の値と一致して総合=事業+家計・純収支=収入-支出が成り立ち、要確認の明細は数値に含めず件数と金額を注記し、指標は定義 1 件の追加で画面と API に現れ、選択月の詳細と選択バーから MF 由来は /classify の月・範囲・カテゴリ・取引先の絞込へ、freee 由来は総収支画面へ辿れて条件は URL から復元され、既存の傾向判定は MF の明細だけを基準とする旨を明記した開閉部分に残り、計算規則と説明文の規則が docs/trends-screen.md と境界値テストで固定され、既存の test / typecheck / lint / 視覚検査が緑のままの状態。

## スコープ

- スコープ内:
  - 推移タブ (07-trends.png) の情報階層を共通シェル上に構築: 条件帯・KPI・意味付き推移チャート・詳細・カテゴリ・符号付きパレート・上位 3・選択バー、旧傾向判定の固有部分だけを開閉化
  - packages/core の推移集計の拡張と指標定義の登録制 (収入・支出・純収支)
  - GET /api/trends の条件 (範囲・指標・比較対象・選択月) と返却の拡張
  - 明細画面 /classify のカテゴリ・取引先の絞込クエリ
  - 計算規則と説明文の規則の docs とテスト
  - 実装中に確定した追加分 (2026-09-17 の最終レビューで仕様へ反映): 保存値が無い初回期間を直近1年にする (FR13)、カテゴリ表8列の並べ替えと、全画面の表の並べ替え部品の共通化
- スコープ外:
  - 収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)
  - 取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)
  - AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)
  - 共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う
  - 照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う
  - web 以外の platform (専用アプリ)

## 受入

- [ ] S1 (G1): /analysis/trends で 07-trends.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell/chart の共通設定経由で、直書き色の lint が 0 件である。
- [ ] S2 (G2, G3): 3 指標×3 範囲×2 比較対象のどの組合せでも、画面の KPI・チャート・表の値が core の返却値と一致し、総合=事業+家計・純収支=収入-支出が成り立つ。総合・事業・家計の期間合計は同じ期間の総収支画面の値と一致する。
- [ ] S3 (G2): 指標定義を 1 件足すだけで画面と API に新しい指標が現れ、画面と API のコードに指標 id の分岐が無い。
- [ ] S4 (G4): 詳細パネルと選択バーからの遷移で、/classify が月・範囲・カテゴリ・取引先で絞り込んだ明細だけを表示し、推移の条件は URL から復元される。
- [ ] S5 (G5): 計算規則と説明文の規則が docs に書かれ、境界値テストを含む vitest が通り、既存の傾向判定のテスト (trend-contract.test.ts) も壊れていない。
- [ ] S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (視覚検査を含む) が全て緑のままである。

## アーキテクチャ参照

- `architecture_refs`: `arch-trends-screen-ui-ux`, `arch-trends-screen-frontend`, `arch-trends-screen-backend`, `arch-trends-screen-database`, `arch-trends-screen-auth`, `arch-trends-screen-security`, `arch-trends-screen-infrastructure`, `arch-trends-screen-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/trends-screen-ui-ux.md`, `architecture/trends-screen-frontend.md`, `architecture/trends-screen-backend.md`, `architecture/trends-screen-database.md`, `architecture/trends-screen-auth.md`, `architecture/trends-screen-security.md`, `architecture/trends-screen-infrastructure.md`, `architecture/trends-screen-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-trends-screen` (feature ノードへの依存は無い)
- 依存理由: 数値の出所 (総収支と同じ取引集合)、要確認の明細の扱い、傾向の判定の基準、比較期間と全期間の扱い、指標定義の形、/classify の payee の完全一致、クエリの既定値への倒し方が確定仕様として固定されていないと、core の型・API 応答・URL 状態の形が実装中に揺れるため。
- 前提 (依存辺にしない): 消し込みの判定と totalCashflowReport の月次 reviewCount・reviewAmount は `feat-total-cashflow` と `feat-total-cashflow-screen` (PR #55)、previousPeriod と支出分析ハブは `feat-analysis-hub` (PR #50)、トークン・共通 Button・PageShell は `feat-design-system-foundation` (PR #49) で、いずれも main に取り込み済みのため未完了の feature への依存にはならない。
- 後続: 収入・支出・純収支以外の指標 (件数・口座別残高など) の追加と、マトリクス・診断タブの作り直しは各サイクルの候補であり、本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-trends-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-trends-screen --feature-context features/feat-trends-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-trends-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 計画時に拾う点: `trend-contract.test.ts` の値を維持し、`trends-scope.dom.test.tsx` は残した旧傾向判定の固有契約へ絞ること、要確認を総収支 API と突き合わせる契約テスト、口座が空の freee 行、/classify の month・cls と category・payee の組合せ。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
