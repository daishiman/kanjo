---
graph_node_id: SYS-MOBFIN-P05
artifact_kind: task
artifact_subtypes: []
title: 全財務figureと高密度表のモバイル体験を実装
project_id: feature-package-feat-mobile-financial-visualization
domain: frontend
status: active
owners: []
tags:
- mobile
- frontend
- financial-figure
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:10Z'
depends_on:
- SYS-MOBFIN-P04
related_nodes:
- spec-mobile-financial-visualization
- arch-mobile-financial-experience
- arch-mobile-financial-frontend
resource_scope:
- packages/web/src/components/FinancialFigure.tsx
- packages/web/src/components/financial-figure-model.ts
- packages/web/src/components/FinancialCharts.tsx
- packages/web/src/components/ReportChart.tsx
- packages/web/src/pages/Overview.tsx
- packages/web/src/pages/Household.tsx
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/analysis/Trends.tsx
- packages/web/src/pages/analysis/Matrix.tsx
- packages/web/src/pages/Statements.tsx
- packages/web/src/styles.css
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P05
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p05.md
template_id: task
template_version: 1.0.0
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluator: system-dev-plan-evaluator
  evidence_ref: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/plan-findings.json
  evaluated_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
source_lineage:
  origin_kind: system-dev-planner
  source_plugin: system-dev-planner
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-05-implementation.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 全財務figureの表示欠落、認知負荷、操作性をpackages/webだけで解消する本体実装。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p05.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.5
  linked_at: '2026-08-30T12:06:10Z'
  sync_state: synced
  github_mirror: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: linked_pr_merged_all
  status: in_progress
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: complete
  missing_sections: []
  checked_at: '2026-08-30T09:44:51Z'
purpose: packages/webの全財務figureを、狭幅でも消えず、結論から正確な表へ低認知負荷で進めるresponsive experienceへ変更する。
goal: 全財務figureと高密度表のモバイル体験を実装を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- packages/web/src/components/FinancialFigure.tsx
- packages/web/src/components/financial-figure-model.ts
- packages/web/src/components/FinancialCharts.tsx
- packages/web/src/components/ReportChart.tsx
- packages/web/src/pages/Overview.tsx
- packages/web/src/pages/Household.tsx
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/analysis/Trends.tsx
- packages/web/src/pages/analysis/Matrix.tsx
- packages/web/src/pages/Statements.tsx
- packages/web/src/styles.css
scope_out:
- accounting calculation、API、auth、D1、R2、Cloudflare、native mobileの変更
- production deploy、commit、push、PR作成
- 実データを用いるfixture、log、screenshot
acceptance:
- 'Automated commands: `pnpm --filter @kanjo/web test -- mobile-financial-visualization.dom.test.tsx
  mobile-financial-layout.test.ts`'
- 'Automated commands: `pnpm --filter @kanjo/web build`'
- 'Required evidence: desktopと各viewportのfigure count、container寸法、document overflow、touch
  target、semantic contentの結果'
architecture_refs:
- arch-mobile-financial-experience
- arch-mobile-financial-frontend
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-05-implementation.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: 全財務figureと高密度表のモバイル体験を実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P05
- phase_ref: P05
- owners: schedulerがlease時に割当
- tags: mobile、frontend、financial-figure
- related_nodes: spec-mobile-financial-visualization、arch-mobile-financial-experience、arch-mobile-financial-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

packages/webの全財務figureを、狭幅でも消えず、結論から正確な表へ低認知負荷で進めるresponsive experienceへ変更する。

## 背景

モバイルではgraph関係が表示されない、canvasが十分な寸法を得ない、高密度表がpage全体を押し広げる問題がある。見た目だけでなく意味情報と操作を同じview-modelから提供する。

## 前提条件

- SYS-MOBFIN-P04のred contractが固定済み
- P02 architectureとP03 reviewがPASS
- 既存未コミット変更を保持し、write scope外を変更しない
- API、認証、会計計算、data、Cloudflare構成は不変

## Workstream applicability

- Frontend: 該当。figure component、route adapter、CSSを実装する。
- Backend: N/A: server logic変更なし。
- API: N/A: response shape変更なし。
- Data: N/A: schemaとmigration変更なし。
- Infrastructure: N/A: deployment変更なし。
- Security: N/A: auth変更なし。匿名fixture境界は維持する。
- Quality: 該当。P04 contractをgreenにする。
- Documentation: N/A:利用手順はP12が所有する。
- Operations: N/A: production rolloutはP13でも実行しない。

## Architecture and deploy unit

- Architecture decisions: 七要素を単一view-modelから派生し、canvasはnon-zero responsive shell、semantic tableは同じ値を使う。
- Deploy unit/environment: packages/web React SPA。
- Compatibility/migration/backfill: route、API type、会計値、desktop semanticsを維持し、migration不要。

## 成果物

- Produced artifacts: packages/web/src/components/FinancialFigure.tsx、packages/web/src/components/financial-figure-model.ts、FinancialCharts.tsx、ReportChart.tsx、対象route adapter、styles.css
- Consumed artifacts: P02 contract、P04 tests、既存format.tsとchart tooltip utilities
- Write scope/touches: packages/web/src/components/FinancialFigure.tsx、packages/web/src/components/financial-figure-model.ts、packages/web/src/components/FinancialCharts.tsx、packages/web/src/components/ReportChart.tsx、packages/web/src/pages/Overview.tsx、Household.tsx、Subscriptions.tsx、analysis/Trends.tsx、analysis/Matrix.tsx、Statements.tsx、packages/web/src/styles.css

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: implementationはfilesだけを更新し、Beads状態収束はdev-graphが行う

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P05 claim後に実装し、長時間test中もheartbeatする
- Parallel safety: P04 doneとwrite scopeにactive leaseがないことを確認する
- Completion projection: default branch reconciliation

## スコープ外

- accounting calculation、API、auth、D1、R2、Cloudflare、native mobileの変更
- production deploy、commit、push、PR作成
- 実データを用いるfixture、log、screenshot

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test -- mobile-financial-visualization.dom.test.tsx mobile-financial-layout.test.ts`
- Automated commands: `pnpm --filter @kanjo/web build`
- Required evidence: desktopと各viewportのfigure count、container寸法、document overflow、touch target、semantic contentの結果

## Rollout and rollback

- Rollout: P04 focused testsをgreenにし、P06 full regression前までlocal変更として保持する。
- Rollback trigger and steps: route消失、会計値差分、API回帰、横overflow再発時はP05 write scope内の変更だけを戻す。

## Handoff

- Executor: React、Chart.js、responsive CSS、accessible data visualizationを扱えるfrontend実行者
- Ready when: P04全testがPASSし、五acceptanceとscope不変を実装差分で説明できる

## 参照情報

- System specification: system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP05の実行正本
- Dependencies: SYS-MOBFIN-P04

## Scope注記 — scope_in の間接カバー (2026-08-31 追記)

`scope_in` に挙げた `packages/web/src/pages/analysis/Matrix.tsx` と
`packages/web/src/pages/Statements.tsx` は実装差分に現れないが、これは未実装ではなく
**共有コンポーネント経由の間接カバー**である。両route は `FinancialCharts.tsx` から
chart component を import しており (`Matrix.tsx:7` = `MatrixMoversChart`、
`Statements.tsx:16` = `BalanceSheetChart` / `CashFlowCharts` / `ProfitAndLossCharts`)、
その component 側を `FinancialFigure` へ移行したことで両routeの出力が移行済みになる。

証跡: `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-10-final-review.md`
の「Addendum (2026-08-31) — indirect coverage of `sys-mobfin-p05` scope_in」。

`scope_in` は「出力が変わらなければならない route」と「編集が必要なファイル」を
同じ欄で表しているため両者が食い違い得る。以後の task spec では
「編集対象」と「検証対象」を分けて列挙すること。
