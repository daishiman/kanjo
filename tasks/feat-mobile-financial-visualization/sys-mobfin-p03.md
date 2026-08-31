---
graph_node_id: SYS-MOBFIN-P03
artifact_kind: task
artifact_subtypes: []
title: モバイルUX・アクセシビリティ設計を独立レビュー
project_id: feature-package-feat-mobile-financial-visualization
domain: quality
status: active
owners: []
tags:
- mobile
- design-review
- wcag
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:07Z'
depends_on:
- SYS-MOBFIN-P02
related_nodes:
- arch-mobile-financial-experience
- arch-mobile-financial-frontend
resource_scope:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-03-design-review.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P03
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p03.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-03-design-review.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 実装者と分離してApple HIG、WCAG、Chart.js契約の欠落を検出する品質ゲート。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p03.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.3
  linked_at: '2026-08-30T12:06:07Z'
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
purpose: P02設計をApple HIG、WCAG 2.2、Chart.js responsive contractの観点で独立評価し、実装前に認知負荷とアクセシビリティの欠落を除く。
goal: モバイルUX・アクセシビリティ設計を独立レビューを、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-03-design-review.md
scope_out:
- 実装コードとtest codeの変更
- 設計を暗黙承認すること、高重大度指摘を後続へ持ち越すこと
acceptance:
- 'Automated commands: `rg -n "44|safe-area|focus-visible|200%|semantic|non-zero|overflow"
  .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-02-figure-contract.md`'
- 'Required evidence: 観点、根拠、severity、対象決定、PASSまたはFAIL、reviewer分離の記録'
architecture_refs:
- arch-mobile-financial-experience
- arch-mobile-financial-frontend
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-03-design-review.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: モバイルUX・アクセシビリティ設計を独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P03
- phase_ref: P03
- owners: P02設計者とは異なるreviewerをschedulerが割当
- tags: mobile、design-review、wcag
- related_nodes: arch-mobile-financial-experience、arch-mobile-financial-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

P02設計をApple HIG、WCAG 2.2、Chart.js responsive contractの観点で独立評価し、実装前に認知負荷とアクセシビリティの欠落を除く。

## 背景

設計者自身の確認だけでは、色依存、touch target、focus、safe area、zoom、semantic fallbackの見落としが残る。独立contextでfail-closed判定する。

## 前提条件

- SYS-MOBFIN-P02が完了し、figure contract digestを固定している
- reviewerはP02 producerと分離する
- 参照はApple HIG accessibilityとlayout、WCAG 2.2、Chart.js responsive公式文書に限定する

## Workstream applicability

- Frontend: 該当。設計されたcomponent boundaryを監査する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: data変更なし。
- Infrastructure: N/A: infra変更なし。
- Security: N/A: auth変更なし。ただしprivacy証跡境界は確認する。
- Quality: 該当。独立design gateを発行する。
- Documentation: 該当。指摘と判定をevidenceへ残す。
- Operations: N/A: production変更なし。

## Architecture and deploy unit

- Architecture decisions: P02 contractを変更せず評価し、FAILはP02へ返す。
- Deploy unit/environment: packages/web設計文書。runtime writeなし。
- Compatibility/migration/backfill: desktop、tablet、mobile、200% zoomの情報parityを維持する。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-03-design-review.md
- Consumed artifacts: phase-02-figure-contract.md、specs/mobile-financial-visualization.md
- Write scope/touches: phase-03-design-review.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: reviewerは判定だけを所有し、tracker mutationはdev-graphが行う

## Branch and worktree execution

- Branch: schedulerが登録後に割当
- Worktree lease: SYS-MOBFIN-P03をclaimする
- Parallel safety: P02 digest固定後に読み取り、P02ファイルを直接編集しない
- Completion projection: default branch reconciliation

## スコープ外

- 実装コードとtest codeの変更
- 設計を暗黙承認すること、高重大度指摘を後続へ持ち越すこと

## Verification and evidence

- Automated commands: `rg -n "44|safe-area|focus-visible|200%|semantic|non-zero|overflow" .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-02-figure-contract.md`
- Required evidence: 観点、根拠、severity、対象決定、PASSまたはFAIL、reviewer分離の記録

## Rollout and rollback

- Rollout: PASSだけをP04 entry gateにする。
- Rollback trigger and steps: 不正な根拠または見落としが判明したら判定を撤回しP02へ戻す。

## Handoff

- Executor: P02と独立したdesign reviewer
- Ready when: 重大・高指摘0件、全観点に根拠付きPASSがある

## 参照情報

- System specification: system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP03の実行正本
- Dependencies: SYS-MOBFIN-P02
