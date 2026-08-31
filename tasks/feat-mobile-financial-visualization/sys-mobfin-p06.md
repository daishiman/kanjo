---
graph_node_id: SYS-MOBFIN-P06
artifact_kind: task
artifact_subtypes: []
title: unit・DOM・実Chrome・build回帰を実行
project_id: feature-package-feat-mobile-financial-visualization
domain: quality
status: active
owners: []
tags:
- mobile
- regression
- build
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:11Z'
depends_on:
- SYS-MOBFIN-P05
related_nodes:
- SYS-MOBFIN-P04
- SYS-MOBFIN-P05
resource_scope:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-06-test-results.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P06
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p06.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-06-test-run.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: P04契約と既存web回帰を実行し、P05実装の機械的品質を確定する作業。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p06.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.6
  linked_at: '2026-08-30T12:06:11Z'
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
purpose: P05の変更をfocused contract、packages/web全test、typecheck、build、実Chromeで検証し、既存routeと会計表示に回帰がない状態を確定する。
goal: unit・DOM・実Chrome・build回帰を実行を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-06-test-results.md
scope_out:
- failing testの削除、skip化、threshold緩和
- production API、database、real user accountへの接続
acceptance:
- 'Automated commands: `pnpm --filter @kanjo/web test`'
- 'Automated commands: `pnpm --filter @kanjo/web typecheck`'
- 'Automated commands: `pnpm --filter @kanjo/web build`'
- 'Required evidence: command、開始時source digest、exit code、pass count、Chrome path、失敗0件の記録'
architecture_refs: []
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-06-test-run.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: unit・DOM・実Chrome・build回帰を実行

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P06
- phase_ref: P06
- owners: schedulerがlease時に割当
- tags: mobile、regression、build
- related_nodes: SYS-MOBFIN-P04、SYS-MOBFIN-P05
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

P05の変更をfocused contract、packages/web全test、typecheck、build、実Chromeで検証し、既存routeと会計表示に回帰がない状態を確定する。

## 背景

focused testだけでは共通CSSやchart componentが別routeへ与える影響を検出できない。web packageの全gateを同じsource digestに対して実行する。

## 前提条件

- SYS-MOBFIN-P05がfocused testsをgreenにしている
- Google ChromeまたはCHROME_PATHが利用可能
- test dataは合成fixtureのみ

## Workstream applicability

- Frontend: 該当。全route回帰の対象。
- Backend: N/A: backend testはsource変更がないため対象外。
- API: N/A: API contractはfrontend mockとtypecheckで不変確認する。
- Data: N/A: migrationなし。
- Infrastructure: N/A: dry buildだけでdeployしない。
- Security: N/A: auth変更なし。secret-free testだけ確認する。
- Quality: 該当。全自動gateを実行する。
- Documentation: 該当。exit codeと結果をevidence化する。
- Operations: N/A: productionを操作しない。

## Architecture and deploy unit

- Architecture decisions: focused、full、type、bundle、real layoutを独立commandで実行する。
- Deploy unit/environment: packages/web local build output。
- Compatibility/migration/backfill: current Nodeとpnpm lockを使用し依存追加なし。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-06-test-results.md
- Consumed artifacts: P04 tests、P05 source diff、package scripts
- Write scope/touches: phase-06-test-results.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: test runnerは結果を記録しtracker mutationを行わない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P06をclaimする
- Parallel safety: P05 done、source digest固定、test output以外のwriteなし
- Completion projection: default branch reconciliation

## スコープ外

- failing testの削除、skip化、threshold緩和
- production API、database、real user accountへの接続

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test`
- Automated commands: `pnpm --filter @kanjo/web typecheck`
- Automated commands: `pnpm --filter @kanjo/web build`
- Required evidence: command、開始時source digest、exit code、pass count、Chrome path、失敗0件の記録

## Rollout and rollback

- Rollout: 全gate PASSだけをP07へ渡す。
- Rollback trigger and steps: 一件でもFAILならP05へ戻し、evidenceをPASS扱いにしない。

## Handoff

- Executor: local test環境を再現できるquality実行者
- Ready when: focusedとfull test、typecheck、build、実Chromeが同一digestで全PASS

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP06の実行正本
- Dependencies: SYS-MOBFIN-P05
