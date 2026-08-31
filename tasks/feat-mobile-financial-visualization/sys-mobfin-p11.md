---
graph_node_id: SYS-MOBFIN-P11
artifact_kind: task
artifact_subtypes: []
title: 匿名で再現可能な検証証跡を固定
project_id: feature-package-feat-mobile-financial-visualization
domain: quality
status: active
owners: []
tags:
- mobile
- evidence
- reproducibility
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:18Z'
depends_on:
- SYS-MOBFIN-P10
related_nodes:
- SYS-MOBFIN-P06
- SYS-MOBFIN-P07
- SYS-MOBFIN-P10
resource_scope:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-11-reproducible-evidence.md
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/mobile-viewport-results.json
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P11
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p11.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-11-evidence.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 第三者が匿名fixtureと固定commandで同じ判定を再現できる証跡を作る作業。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p11.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.11
  linked_at: '2026-08-30T12:06:18Z'
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
purpose: 第三者が同じcommand、anonymous fixture、viewportで同じPASSを再現できる証跡bundleをsource digestへpinして固定する。
goal: 匿名で再現可能な検証証跡を固定を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-11-reproducible-evidence.md
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/mobile-viewport-results.json
scope_out:
- raw production logs、real account screenshot、secret valueの保存
- 実行していないcommandをPASSとして記録すること
acceptance:
- 'Automated commands: `pnpm --filter @kanjo/web test && pnpm --filter @kanjo/web
  build`'
- 'Automated commands: `rg -n "data/|dev.vars|token|secret" .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence`'
- 'Required evidence: source digest、environment、Chrome path、viewport、route、expected、actual、exit
  code、timestamp'
architecture_refs: []
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-11-evidence.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: 匿名で再現可能な検証証跡を固定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P11
- phase_ref: P11
- owners: schedulerがlease時に割当
- tags: mobile、evidence、reproducibility
- related_nodes: SYS-MOBFIN-P06、SYS-MOBFIN-P07、SYS-MOBFIN-P10
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

第三者が同じcommand、anonymous fixture、viewportで同じPASSを再現できる証跡bundleをsource digestへpinして固定する。

## 背景

口頭の確認や一時的なterminal outputでは、後からどのversionを何で検証したか判断できない。機械可読結果と人間向け再現手順を対で残す。

## 前提条件

- SYS-MOBFIN-P10が独立PASS
- testとacceptanceは同一source digestに対する結果
- 実データ、secret、token、個人を識別できるscreenshotは禁止

## Workstream applicability

- Frontend: 該当。viewportとrouteの結果を記録する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: anonymous fixtureのみ。
- Infrastructure: N/A: local実行のみ。
- Security: 該当。evidenceのprivacyを検査する。
- Quality: 該当。commandとexit codeを固定する。
- Documentation: 該当。再現手順を作る。
- Operations: N/A: remote storageへuploadしない。

## Architecture and deploy unit

- Architecture decisions: human-readable Markdownとmachine-readable JSONを同一source digestで結ぶ。
- Deploy unit/environment: repository-local evidence bundle。
- Compatibility/migration/backfill: 既存evidenceを上書きせずcurrent run pathへ保存する。

## 成果物

- Produced artifacts: phase-11-reproducible-evidence.md、mobile-viewport-results.json
- Consumed artifacts: P06 test results、P07 acceptance、P10 final review
- Write scope/touches: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-11-reproducible-evidence.mdとmobile-viewport-results.json

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: evidence producerはtracker stateを直接変更しない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P11をclaimする
- Parallel safety: P10 digest固定後にevidence pathだけへwriteする
- Completion projection: default branch reconciliation

## スコープ外

- raw production logs、real account screenshot、secret valueの保存
- 実行していないcommandをPASSとして記録すること

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test && pnpm --filter @kanjo/web build`
- Automated commands: `rg -n "data/|dev.vars|token|secret" .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence`
- Required evidence: source digest、environment、Chrome path、viewport、route、expected、actual、exit code、timestamp

## Rollout and rollback

- Rollout: verified bundleをP12とP13へhandoffする。
- Rollback trigger and steps: digest不一致やprivacy riskがあればbundleをauthorityから外し、current digestで再生成する。

## Handoff

- Executor: reproducible test evidenceを扱えるquality実行者
- Ready when: 記載commandの再実行がPASSし、machine結果とMarkdownが一致しprivacy violationが0件

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP11の実行正本
- Dependencies: SYS-MOBFIN-P10
