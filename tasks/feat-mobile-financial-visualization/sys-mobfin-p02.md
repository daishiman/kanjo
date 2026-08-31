---
graph_node_id: SYS-MOBFIN-P02
artifact_kind: task
artifact_subtypes: []
title: 同一view-modelとresponsive figureアーキテクチャを確定
project_id: feature-package-feat-mobile-financial-visualization
domain: frontend
status: active
owners: []
tags:
- mobile
- responsive-chart
- view-model
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:06Z'
depends_on:
- SYS-MOBFIN-P01
related_nodes:
- spec-mobile-financial-visualization
- arch-mobile-financial-experience
- arch-mobile-financial-frontend
resource_scope:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-02-figure-contract.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P02
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p02.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-02-architecture.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: figureの意味モデル、描画container、semantic fallback、局所scrollを実装前に固定する設計作業。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p02.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.2
  linked_at: '2026-08-30T12:06:06Z'
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
purpose: 財務figureの意味情報とresponsive描画を一つの契約へまとめ、狭幅でもcanvas有無に依存せず同じ結論を読めるfrontend設計を確定する。
goal: 同一view-modelとresponsive figureアーキテクチャを確定を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-02-figure-contract.md
scope_out:
- route固有会計計算の再設計
- API、auth、D1、R2、Cloudflare構成、native appの変更
acceptance:
- 'Automated commands: `rg -n "responsive: true|maintainAspectRatio|chart-shell|semantic"
  packages/web/src`'
- 'Required evidence: component責務、view-model field、container contract、scroll例外、route
  adapter、rollback境界の図とdecision log'
architecture_refs:
- arch-mobile-financial-experience
- arch-mobile-financial-frontend
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-02-architecture.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: 同一view-modelとresponsive figureアーキテクチャを確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P02
- phase_ref: P02
- owners: schedulerがlease時に割当
- tags: mobile、responsive-chart、view-model
- related_nodes: arch-mobile-financial-experience、arch-mobile-financial-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

財務figureの意味情報とresponsive描画を一つの契約へまとめ、狭幅でもcanvas有無に依存せず同じ結論を読めるfrontend設計を確定する。

## 背景

Chart.jsのcanvasだけを縮めても0寸法や判読不能は防げない。結論から詳細へ進む順序、semantic table、局所scrollを同一view-modelとcontainer contractへ接地する必要がある。

## 前提条件

- SYS-MOBFIN-P01のinventoryが完了している
- feature digest、repository identity、readinessはP01と同じ
- architecture二文書のAPI、data、auth不変境界を守る

## Workstream applicability

- Frontend: 該当。figure component、view-model、responsive containerの境界を定義する。
- Backend: N/A: server logicは設計対象外。
- API: N/A: response shapeは現行のまま消費する。
- Data: N/A: persisted schemaは変更しない。
- Infrastructure: N/A: web buildとhosting構成は変更しない。
- Security: N/A: auth contractは変更しない。
- Quality: 該当。0寸法、overflow、意味情報parityを検査可能にする。
- Documentation: 該当。architecture evidenceを固定する。
- Operations: N/A: runtime operationを変更しない。

## Architecture and deploy unit

- Architecture decisions: 七要素を単一view-modelから描画し、canvasはposition relative、width 100%、非0 min-heightのcontainer内だけに置く。
- Deploy unit/environment: packages/web React SPA。共通figure componentとroute adapterの二層。
- Compatibility/migration/backfill: 既存API typeと会計値を維持し、段階移行はroute単位、data migrationは不要。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-02-figure-contract.md
- Consumed artifacts: phase-01-figure-inventory.md、architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Write scope/touches: phase-02-figure-contract.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: beads authorityのため設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: 登録と外部状態更新はdev-graphが所有する

## Branch and worktree execution

- Branch: registration後にschedulerが割当
- Worktree lease: SYS-MOBFIN-P02をclaimしてから編集する
- Parallel safety: SYS-MOBFIN-P01 doneとresource scope非競合が必要
- Completion projection: default branch reconciliation

## スコープ外

- route固有会計計算の再設計
- API、auth、D1、R2、Cloudflare構成、native appの変更

## Verification and evidence

- Automated commands: `rg -n "responsive: true|maintainAspectRatio|chart-shell|semantic" packages/web/src`
- Required evidence: component責務、view-model field、container contract、scroll例外、route adapter、rollback境界の図とdecision log

## Rollout and rollback

- Rollout: P04 test designとP05 implementationが参照するcontractとして発行する。
- Rollback trigger and steps: scope逸脱または検査不能な決定があればP01 inventoryへ戻してcontractだけ更新する。

## Handoff

- Executor: frontend architectureを理解するdev-graph実行者
- Ready when: 七要素、0寸法防止、overflow、44px、200% zoomが機械検査へ写像できる

## 参照情報

- System specification: system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP02の実行正本
- Dependencies: SYS-MOBFIN-P01
