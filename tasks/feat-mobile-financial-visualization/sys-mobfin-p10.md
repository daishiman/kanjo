---
graph_node_id: SYS-MOBFIN-P10
artifact_kind: task
artifact_subtypes: []
title: 最終コード・UX・scopeを独立レビュー
project_id: feature-package-feat-mobile-financial-visualization
domain: quality
status: active
owners: []
tags:
- mobile
- final-review
- scope
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:17Z'
depends_on:
- SYS-MOBFIN-P09
related_nodes:
- SYS-MOBFIN-P07
- SYS-MOBFIN-P09
resource_scope:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-10-final-review.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P10
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p10.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-10-final-review.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 実装者から分離して全差分、全受入条件、scope逸脱を最終判定する独立gate。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p10.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.10
  linked_at: '2026-08-30T12:06:17Z'
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
purpose: 変更中の全fileをtaskとacceptanceへ逆引きし、コード、UX、test、evidence、scopeの矛盾と対象外変更を独立contextで0件にする。
goal: 最終コード・UX・scopeを独立レビューを、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-10-final-review.md
scope_out:
- review中のsilent fix、対象外fileのcleanup、commit、push、PR
- 高重大度findingを後続文書だけで回避すること
acceptance:
- 'Automated commands: `git status --short`'
- 'Automated commands: `git diff --stat && git diff --check`'
- 'Required evidence: changed file全件のtask mapping、acceptance五項目、P09 gates、scope-out、重大度別finding、独立reviewer記録'
architecture_refs: []
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-10-final-review.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: 最終コード・UX・scopeを独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P10
- phase_ref: P10
- owners: P05実装者とは異なるreviewerをschedulerが割当
- tags: mobile、final-review、scope
- related_nodes: SYS-MOBFIN-P07、SYS-MOBFIN-P09
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

変更中の全fileをtaskとacceptanceへ逆引きし、コード、UX、test、evidence、scopeの矛盾と対象外変更を独立contextで0件にする。

## 背景

最終確認はP05実装者から分離し、見た目の改善だけでなく未コミット変更全体が13 task契約どおりかを判定する必要がある。

## 前提条件

- SYS-MOBFIN-P09がPASS
- reviewerはP05 producerと分離する
- git statusにある全変更を既存user changeも含めて識別し、勝手に戻さない

## Workstream applicability

- Frontend: 該当。source diffとUXをレビューする。
- Backend: N/A: backend diffがあればscope violationとしてFAIL。
- API: N/A: API diffがあればscope violationとしてFAIL。
- Data: N/A: dataとmigration diffがあればFAIL。
- Infrastructure: N/A: infra diffがあればFAIL。
- Security: 該当。privacy境界とsecret非露出を再確認する。
- Quality: 該当。全gateとacceptance traceを監査する。
- Documentation: 該当。最終findingを記録する。
- Operations: N/A: remote stateを変更しない。

## Architecture and deploy unit

- Architecture decisions: P02contractからP09evidenceまで一方向にtraceし、implementationがarchitectureを再定義していないことを確認する。
- Deploy unit/environment: repository-local diff。deployなし。
- Compatibility/migration/backfill: route、API、accounting、auth、data、infraの不変を確認する。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-10-final-review.md
- Consumed artifacts: P01からP09の全成果物、git diff、test results
- Write scope/touches: phase-10-final-review.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: reviewerはverdictだけを発行しtrackerを直接closeしない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P10をclaimする
- Parallel safety: source digest固定後にread-only reviewし実装fileを編集しない
- Completion projection: default branch reconciliation

## スコープ外

- review中のsilent fix、対象外fileのcleanup、commit、push、PR
- 高重大度findingを後続文書だけで回避すること

## Verification and evidence

- Automated commands: `git status --short`
- Automated commands: `git diff --stat && git diff --check`
- Required evidence: changed file全件のtask mapping、acceptance五項目、P09 gates、scope-out、重大度別finding、独立reviewer記録

## Rollout and rollback

- Rollout: PASS verdictだけをP11へ渡す。
- Rollback trigger and steps: findingが一件でも重大または高なら責任phaseへ戻し、review verdictをFAILに保つ。

## Handoff

- Executor: P05と独立したcodeとUX reviewer
- Ready when: changed file全件がin-scope、重大・高finding0、全acceptanceとgateにevidenceがある

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP10の実行正本
- Dependencies: SYS-MOBFIN-P09
