---
graph_node_id: SYS-MOBFIN-P12
artifact_kind: task
artifact_subtypes: []
title: ローカル画面テスト手順と引継ぎを整備
project_id: feature-package-feat-mobile-financial-visualization
domain: documentation
status: active
owners: []
tags:
- mobile
- documentation
- handover
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:19Z'
depends_on:
- SYS-MOBFIN-P11
related_nodes:
- SYS-MOBFIN-P11
resource_scope:
- docs/runbooks/mobile-financial-visualization-test.md
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-12-handover.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P12
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p12.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-12-documentation-operations.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 利用者がlocalhostと匿名sampleで同じ画面確認を行える運用引継ぎ作業。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p12.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.12
  linked_at: '2026-08-30T12:06:19Z'
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
purpose: 初見の利用者がpnpmでlocalhostを起動し、anonymous sampleとlocal-only test identityでmobile
  figureを詳細に確認し、終了まで安全に行えるrunbookを作る。
goal: ローカル画面テスト手順と引継ぎを整備を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- docs/runbooks/mobile-financial-visualization-test.md
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-12-handover.md
scope_out:
- production credential共有、real financial dataのseed、public fileへのpassword保存
- deploy、commit、push、PR作成
acceptance:
- 'Automated commands: `pnpm preview:smoke`'
- 'Automated commands: `git status --short --ignored`'
- 'Required evidence: runbookを上から一度通した結果、localhost URL、anonymous seed、local-only identity入手法、viewport別期待、shutdown'
architecture_refs: []
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-12-documentation-operations.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: ローカル画面テスト手順と引継ぎを整備

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P12
- phase_ref: P12
- owners: schedulerがlease時に割当
- tags: mobile、documentation、handover
- related_nodes: SYS-MOBFIN-P11
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

初見の利用者がpnpmでlocalhostを起動し、anonymous sampleとlocal-only test identityでmobile figureを詳細に確認し、終了まで安全に行えるrunbookを作る。

## 背景

自動testだけでは利用者が手元の画面で検証できない。public repositoryのため、実データとcredentialをtracked fileへ置かない手順が不可欠である。

## 前提条件

- SYS-MOBFIN-P11のreproducible evidenceがPASS
- repository既存preview、seed、auth手順を確認して存在するcommandだけを書く
- local secretはpackages/api/.dev.varsなどignore対象に限定しGit操作へ含めない

## Workstream applicability

- Frontend: 該当。routeとviewportのmanual test手順を書く。
- Backend: N/A: backend変更なし。既存local startupだけ説明する。
- API: N/A: API変更なし。
- Data: N/A: anonymous samplesを利用しschema変更なし。
- Infrastructure: N/A: local processだけ。
- Security: 該当。test identityとsecretのlocal-only境界を明記する。
- Quality: 該当。期待結果とtroubleshootingを書く。
- Documentation: 該当。runbookが主成果物。
- Operations: 該当。startup、health、shutdownを説明する。

## Architecture and deploy unit

- Architecture decisions: setup、seed、login、viewport別scenario、期待結果、diagnosis、shutdownの順で書く。
- Deploy unit/environment: localhostのwebと必要なlocal APIだけ。
- Compatibility/migration/backfill: production accountとproduction dataは一切使わない。

## 成果物

- Produced artifacts: docs/runbooks/mobile-financial-visualization-test.md、phase-12-handover.md
- Consumed artifacts: P11 evidence、package scripts、既存local setup documentation
- Write scope/touches: docs/runbooks/mobile-financial-visualization-test.mdとphase-12-handover.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: documentationだけを更新しtest credential valueをGitへ保存しない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P12をclaimする
- Parallel safety: P11 doneとrunbook pathのlease非競合を確認する
- Completion projection: default branch reconciliation

## スコープ外

- production credential共有、real financial dataのseed、public fileへのpassword保存
- deploy、commit、push、PR作成

## Verification and evidence

- Automated commands: `pnpm preview:smoke`
- Automated commands: `git status --short --ignored`
- Required evidence: runbookを上から一度通した結果、localhost URL、anonymous seed、local-only identity入手法、viewport別期待、shutdown

## Rollout and rollback

- Rollout: 検証済みrunbookを利用者へhandoffしlocal serverは要求に従い稼働維持する。
- Rollback trigger and steps: commandやURLが再現しなければrunbookだけを修正し、credentialをtracked fileへ移さない。

## Handoff

- Executor: local development setupを安全に案内できるdocumentation実行者
- Ready when: fresh local flowで再現でき、test dataは匿名、credentialはlocal-only、手順に曖昧さがない

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-experience.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP12の実行正本
- Dependencies: SYS-MOBFIN-P11
