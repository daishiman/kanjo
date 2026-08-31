---
graph_node_id: SYS-MOBFIN-P08
artifact_kind: task
artifact_subtypes: []
title: figure共通化と互換性境界を整理
project_id: feature-package-feat-mobile-financial-visualization
domain: frontend
status: active
owners: []
tags:
- mobile
- refactoring
- compatibility
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:14Z'
depends_on:
- SYS-MOBFIN-P07
related_nodes:
- SYS-MOBFIN-P05
- SYS-MOBFIN-P07
resource_scope:
- packages/web/src/components/FinancialFigure.tsx
- packages/web/src/components/financial-figure-model.ts
- packages/web/src/components/FinancialCharts.tsx
- packages/web/src/components/ReportChart.tsx
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-08-refactoring-migration.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P08
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p08.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-08-refactoring-migration.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 重複figure契約を安全に共通化し、data migration不要の判断も明示するrequired node。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p08.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.8
  linked_at: '2026-08-30T12:06:14Z'
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
purpose: P05で生じたfigure contractの重複を安全に整理し、route固有の文脈と会計値を保ったまま保守可能な共通境界へ収束させる。
goal: figure共通化と互換性境界を整理を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- packages/web/src/components/FinancialFigure.tsx
- packages/web/src/components/financial-figure-model.ts
- packages/web/src/components/FinancialCharts.tsx
- packages/web/src/components/ReportChart.tsx
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-08-refactoring-migration.md
scope_out:
- 新機能追加、API抽象化、data migration、別featureのcleanup
- testを削除して共通化を通すこと
acceptance:
- 'Automated commands: `pnpm --filter @kanjo/web test`'
- 'Automated commands: `pnpm --filter @kanjo/web build`'
- 'Required evidence: 重複除去理由、残したroute差異、migration N/A理由、before-after acceptance不変'
architecture_refs: []
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-08-refactoring-migration.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: figure共通化と互換性境界を整理

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P08
- phase_ref: P08
- owners: schedulerがlease時に割当
- tags: mobile、refactoring、compatibility
- related_nodes: SYS-MOBFIN-P05、SYS-MOBFIN-P07
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

P05で生じたfigure contractの重複を安全に整理し、route固有の文脈と会計値を保ったまま保守可能な共通境界へ収束させる。

## 背景

P08は省略できないrequired nodeである。data migrationは不要だが、その判断とcompatibilityを証拠化し、拙速な共通化による情報欠落を防ぐ。

## 前提条件

- SYS-MOBFIN-P07が五acceptanceをPASS
- working implementationを小さなrefactor単位で維持する
- APIとdata schemaは変更しない

## Workstream applicability

- Frontend: 該当。共通componentとpure modelの重複を整理する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: schemaとmigrationは不要であることを記録する。
- Infrastructure: N/A: infra変更なし。
- Security: N/A: auth変更なし。
- Quality: 該当。refactorごとにtestを再実行する。
- Documentation: 該当。migration N/Aとcompatibilityを記録する。
- Operations: N/A: rollout操作なし。

## Architecture and deploy unit

- Architecture decisions: responsive shell、semantic summary、table adapterの重複だけを共通化し、route copyはcontextとして残す。
- Deploy unit/environment: packages/web React SPA。
- Compatibility/migration/backfill: data migration N/A。既存URL、API、会計値、desktop表示を維持する。

## 成果物

- Produced artifacts: FinancialFigure.tsx、financial-figure-model.ts、必要最小限のFinancialCharts.tsxとReportChart.tsx整理、phase-08 evidence
- Consumed artifacts: P05 source、P06 tests、P07 acceptance
- Write scope/touches: packages/web/src/components/FinancialFigure.tsx、financial-figure-model.ts、FinancialCharts.tsx、ReportChart.tsx、phase-08-refactoring-migration.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: source refactorだけを所有しtracker mutationはdev-graphへ委ねる

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P08をclaimする
- Parallel safety: P07 doneとcomponent pathのactive lease非競合が必要
- Completion projection: default branch reconciliation

## スコープ外

- 新機能追加、API抽象化、data migration、別featureのcleanup
- testを削除して共通化を通すこと

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test`
- Automated commands: `pnpm --filter @kanjo/web build`
- Required evidence: 重複除去理由、残したroute差異、migration N/A理由、before-after acceptance不変

## Rollout and rollback

- Rollout: 小単位でrefactorし各単位後にfocused testを実行する。
- Rollback trigger and steps: 意味情報またはroute固有contextが失われたらP08変更だけを戻してP05状態を維持する。

## Handoff

- Executor: React component boundaryとfinancial semanticsを理解する実行者
- Ready when: 重複が意図的な境界へ収束し、全testとacceptanceが不変

## 参照情報

- System specification: system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP08の実行正本
- Dependencies: SYS-MOBFIN-P07
