---
graph_node_id: SYS-MOBFIN-P09
artifact_kind: task
artifact_subtypes: []
title: 品質・アクセシビリティ・運用安全性を保証
project_id: feature-package-feat-mobile-financial-visualization
domain: quality
status: active
owners: []
tags:
- mobile
- quality-assurance
- privacy
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:15Z'
depends_on:
- SYS-MOBFIN-P08
related_nodes:
- SYS-MOBFIN-P06
- SYS-MOBFIN-P08
resource_scope:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-09-quality-assurance.md
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P09
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p09.md
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
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-09-quality-assurance.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: a11y、privacy、性能、運用の非機能条件をリリース判断前に一括保証する作業。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p09.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.9
  linked_at: '2026-08-30T12:06:15Z'
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
purpose: アクセシビリティ、privacy、performance、operational safetyの非機能条件を監査し、高重大度の欠陥と実データ露出がない状態を確定する。
goal: 品質・アクセシビリティ・運用安全性を保証を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-09-quality-assurance.md
scope_out:
- lint rule、test threshold、bundle budgetを緩める変更
- secretや実データを検査例として出力すること
acceptance:
- 'Automated commands: `pnpm lint`'
- 'Automated commands: `pnpm --filter @kanjo/web test && pnpm --filter @kanjo/web
  build`'
- 'Automated commands: `git diff --check && git status --short`'
- 'Required evidence: 44px、focus-visible、200% zoom、色非依存、reduced motion、safe area、privacy、JS
  budgetの各PASS'
architecture_refs: []
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-09-quality-assurance.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: 品質・アクセシビリティ・運用安全性を保証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P09
- phase_ref: P09
- owners: schedulerがlease時に割当
- tags: mobile、quality-assurance、privacy
- related_nodes: SYS-MOBFIN-P06、SYS-MOBFIN-P08
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

アクセシビリティ、privacy、performance、operational safetyの非機能条件を監査し、高重大度の欠陥と実データ露出がない状態を確定する。

## 背景

表示が直ってもtouch target、focus、色依存、zoom、safe area、bundle regression、証跡への個人情報混入が残れば安全に引き渡せない。

## 前提条件

- SYS-MOBFIN-P08が完了しsource digestを固定している
- P06全testとP07acceptanceがPASS
- public repository data policyとguard hookを順守する

## Workstream applicability

- Frontend: 該当。CSSとDOM semanticsを監査する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: data変更なし。実データ非露出だけを監査する。
- Infrastructure: N/A: deploy構成変更なし。
- Security: 該当。secret、個人情報、real transaction exposureを監査する。
- Quality: 該当。lint、test、build、diff checkを実行する。
- Documentation: 該当。品質matrixを記録する。
- Operations: 該当。rollback可能性とlocal server終了を確認する。

## Architecture and deploy unit

- Architecture decisions: WCAGとApple HIG観点をfigure acceptanceへ直接traceする。
- Deploy unit/environment: packages/web local buildとrepository diff。
- Compatibility/migration/backfill: initial JS budgetと既存browser behaviorを維持する。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-09-quality-assurance.md
- Consumed artifacts: P06 test results、P07 acceptance、P08 refactor evidence
- Write scope/touches: phase-09-quality-assurance.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: quality verdictだけを所有しtracker stateはdev-graphが収束させる

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P09をclaimする
- Parallel safety: P08 done後にread-only gateを実行し、他task evidenceへ書かない
- Completion projection: default branch reconciliation

## スコープ外

- lint rule、test threshold、bundle budgetを緩める変更
- secretや実データを検査例として出力すること

## Verification and evidence

- Automated commands: `pnpm lint`
- Automated commands: `pnpm --filter @kanjo/web test && pnpm --filter @kanjo/web build`
- Automated commands: `git diff --check && git status --short`
- Required evidence: 44px、focus-visible、200% zoom、色非依存、reduced motion、safe area、privacy、JS budgetの各PASS

## Rollout and rollback

- Rollout: 全quality gate PASSだけをP10へhandoffする。
- Rollback trigger and steps: FAILを導入phaseへ返し、gateを弱めず再検証する。

## Handoff

- Executor: accessibility、frontend quality、public-repo privacyを評価できる実行者
- Ready when: 重大・高指摘0件、secretと実データ露出0件、全自動gate PASS

## 参照情報

- System specification: system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP09の実行正本
- Dependencies: SYS-MOBFIN-P08
