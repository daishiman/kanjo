---
graph_node_id: "feat-analysis-hub"
artifact_kind: "feature"
artifact_subtypes: []
title: "支出分析ハブ (03-analysis-hub) の UI/UX 改善と集約 API"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "feature"]
file_path: "features/feat-analysis-hub.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6e1542b3438e1de3e5c76782e98faadf8de20c524449a4f97173973ed4578b56"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-analysis-hub.md", "source_version": "0.1.11", "source_digest": "dd3ff9c2d4332accf021195961dd8d855e4d7c687823fe1a6c124c57f0584c16", "imported_at": "2026-09-14T12:45:01Z"}
created_at: "2026-09-14T12:45:01Z"
updated_at: "2026-09-14T12:45:01Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "design/FINAL-UI/images/03-analysis-hub.png", "design/FINAL-UI/spec/AUDIT.md", "design/FINAL-UI/spec/DESIGN-SYSTEM.md", "design/FINAL-UI/spec/FUNCTION-MATRIX.md", "docs/ui-decisions.md", "migrations", "package.json", "packages/api/src/ai/dataset.ts", "packages/api/src/auth.ts", "packages/api/src/d1-limits.ts", "packages/api/src/index.ts", "packages/api/src/routes/analysis-hub.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/store.ts", "packages/api/wrangler.jsonc", "packages/core/src/analysis-hub.ts", "packages/core/src/analysis.ts", "packages/core/src/expense-projection.ts", "packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/web/package.json", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/scripts/check-mobile-layout.mjs", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/analysis-tabs.dom.test.tsx", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/navigation-ux.dom.test.tsx", "packages/web/src/pages/Analysis.tsx", "packages/web/src/pages/analysis", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts"]
purpose: "支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。利用者が支出分析を開いた時点で、期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、差異を消す→全体を掴む→偏りを見る→変化を追う→行動を決める の読み順で改善行動まで迷わず進める状態にする。"
goal: "/analysis が 03-analysis-hub.png の全構成要素をトークンと共通部品で描画し、?focus= で選択状態が再現され、ハブ表示中の通信は GET /api/analysis/hub の 1 本だけで、前期間比・優先度・正常判定・改善余地の規則が core の境界値テストと docs で固定され、5 タブ名が短縮形になりサイドバー子行の件数バッジが要確認件数と一致し、既存の test / typecheck / lint / check 系が緑のままの状態。"
scope_in: ["/analysis のハブ画面 (03-analysis-hub.png の全構成要素) の新設と、/analysis から照合タブへの転送の廃止", "選択中の分析の URL 保持 (?focus=) と URL コピー", "packages/core のハブ集計純関数 (期間合計・前期間比・5 視点の状態・優先度・改善余地) と、前期間計算 (previousPeriod) の api/ai/dataset.ts から core への移設", "packages/api の集約エンドポイント GET /api/analysis/hub", "判定規則の docs 記載と境界値テスト", "5 タブ名の短縮形化とサイドバー支出分析子行の件数バッジ、それに伴う既存 DOM テストの文言更新"]
scope_out: ["5 タブ各詳細画面 (照合・総収支・マトリクス・推移・診断) の中身の作り直し (各画面のサイクル)", "支出分析以外のサイドバー文言 (明細仕分け・累計収支など) と月次クローズ進捗 3/4 チェックリストの形", "期間選択の保存先の変更 (期間は既存どおり localStorage で全画面共有し URL に載せない)", "D1 スキーマ・migration の変更", "スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)"]
acceptance: ["S1 (G1): /analysis で 03-analysis-hub.png の構成要素 (問いの見出し・URL コピー・5 タブ・収支サマリー・分析ルート一覧・選択中の分析パネル・読み順・下部バー) がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。", "S2 (G2): ?focus= の値でハブの選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑である。", "S3 (G3): ハブ表示中のネットワーク呼出しは GET /api/analysis/hub の 1 本で、既存 5 API の呼出しが 0 件である。", "S4 (G3, G4): core テストが前期間比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている。", "S5 (G5): 5 タブ名が短縮形で表示され、サイドバー子行の件数バッジが要確認件数と一致する。", "S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) が緑のままで、狭幅 (68px アイコンレール・下部タブ) でもハブが横スクロールしない。"]
architecture_refs: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "FR-001..FR-006 は同じハブ集計 (core 純関数→集約 API→ハブ画面・バッジ) を起点に連鎖する 1 つの価値単位で、API だけ・画面だけでは利用者に届く『1 画面で判断できる入口』を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-analysis-hub.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-lci", "linked_at": "2026-09-14T14:18:15Z", "sync_state": "synced"}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:45:01Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# 目的

支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。利用者が支出分析を開いた時点で、期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、差異を消す→全体を掴む→偏りを見る→変化を追う→行動を決める の読み順で改善行動まで迷わず進める状態にする。

規範 (要件・判定条件・確定意思決定) の正本は `specs/spec-analysis-hub.md` と、そこから参照する仕様章である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/analysis が 03-analysis-hub.png の全構成要素をトークンと共通部品で描画し、?focus= で選択状態が再現され、ハブ表示中の通信は GET /api/analysis/hub の 1 本だけで、前期間比・優先度・正常判定・改善余地の規則が core の境界値テストと docs で固定され、5 タブ名が短縮形になりサイドバー子行の件数バッジが要確認件数と一致し、既存の test / typecheck / lint / check 系が緑のままの状態。

## スコープ

- スコープ内:
  - /analysis のハブ画面 (03-analysis-hub.png の全構成要素) の新設と、/analysis から照合タブへの転送の廃止
  - 選択中の分析の URL 保持 (?focus=) と URL コピー
  - packages/core のハブ集計純関数 (期間合計・前期間比・5 視点の状態・優先度・改善余地) と、前期間計算 (previousPeriod) の api/ai/dataset.ts から core への移設
  - packages/api の集約エンドポイント GET /api/analysis/hub
  - 判定規則の docs 記載と境界値テスト
  - 5 タブ名の短縮形化とサイドバー支出分析子行の件数バッジ、それに伴う既存 DOM テストの文言更新
- スコープ外:
  - 5 タブ各詳細画面 (照合・総収支・マトリクス・推移・診断) の中身の作り直し (各画面のサイクル)
  - 支出分析以外のサイドバー文言 (明細仕分け・累計収支など) と月次クローズ進捗 3/4 チェックリストの形
  - 期間選択の保存先の変更 (期間は既存どおり localStorage で全画面共有し URL に載せない)
  - D1 スキーマ・migration の変更
  - スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)

## 受入

- [ ] S1 (G1): /analysis で 03-analysis-hub.png の構成要素 (問いの見出し・URL コピー・5 タブ・収支サマリー・分析ルート一覧・選択中の分析パネル・読み順・下部バー) がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。
- [ ] S2 (G2): ?focus= の値でハブの選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑である。
- [ ] S3 (G3): ハブ表示中のネットワーク呼出しは GET /api/analysis/hub の 1 本で、既存 5 API の呼出しが 0 件である。
- [ ] S4 (G3, G4): core テストが前期間比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている。
- [ ] S5 (G5): 5 タブ名が短縮形で表示され、サイドバー子行の件数バッジが要確認件数と一致する。
- [ ] S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) が緑のままで、狭幅 (68px アイコンレール・下部タブ) でもハブが横スクロールしない。

## アーキテクチャ参照

- `architecture_refs`: `arch-analysis-hub-ui-ux`, `arch-analysis-hub-frontend`, `arch-analysis-hub-backend`, `arch-analysis-hub-database`, `arch-analysis-hub-auth`, `arch-analysis-hub-security`, `arch-analysis-hub-infrastructure`, `arch-analysis-hub-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/analysis-hub-ui-ux.md`, `architecture/analysis-hub-frontend.md`, `architecture/analysis-hub-backend.md`, `architecture/analysis-hub-database.md`, `architecture/analysis-hub-auth.md`, `architecture/analysis-hub-security.md`, `architecture/analysis-hub-infrastructure.md`, `architecture/analysis-hub-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-analysis-hub` (feature ノードへの依存は無い)
- 依存理由: 前期間の定義 (previousPeriod・1 か月でも欠けたら null)、優先度・正常判定・改善余地の規則、queryKey 共有とハブ API の C3 例外が確定仕様として固定されていないと、core の型と API 応答の形が実装中に揺れるため。デザインシステム基盤 (トークン正本・共通 Button・PageShell、PR #49) は main に取り込み済みで、未完了の feature に依存しない。
- 後続: 5 タブ各詳細画面の中身を FINAL-UI どおりに作り直す feature は本 feature の完了に依存する次サイクル候補であり、本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-analysis-hub` が active/confirmed) のため、`/dev-graph plan --feature-id feat-analysis-hub --feature-context features/feat-analysis-hub.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-analysis-hub` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。

## 実装で確定した結果 (2026-09-15)

- P01..P13 の成果物と最終回帰は `docs/analysis-hub/` (evidence.md が索引、close-out.md が判断と仕様反映の受領書) に記録した。
- 受入 S1〜S6 の evidence は揃い、lint / typecheck / test は緑。feature の done rollup は main への merge evidence が揃ってから行う。
- 次サイクル候補は close-out.md 6 節 (5 タブ詳細画面の作り直し、invalidate 範囲の仕様 reopen ほか)。
