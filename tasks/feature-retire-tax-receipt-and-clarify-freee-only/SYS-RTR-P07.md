---
graph_node_id: SYS-RTR-P07
artifact_kind: task
artifact_subtypes: []
title: 受入判定
project_id: feature-package-retire-tax-receipt-and-clarify-freee-only
domain: quality
status: active
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags:
- retire-tax-receipt
- acceptance
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P07.md
template_id: task
template_version: 1.0.0
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluated_digest: 439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810
  evaluator: system-dev-plan-evaluator
  evidence_ref: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/plan-findings.json
source_lineage:
  imported_at: '2026-09-09T16:14:10Z'
  origin_kind: system-dev-planner
  source_digest: 439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-07-acceptance.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P06
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core
- packages/api
- packages/web
- migrations
purpose: feature の受入条件 11 件のうち、この時点で判定材料が揃っている条件を機械的に判定し、残る条件は判定を担う後続 phase を明示して引き渡す。
goal: '- Produced artifacts: 受入条件ごとの判定結果表と、後続 phase へ引き渡す条件の一覧。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core / packages/api / packages/web / migrations


  ### 受入条件


  - この時点で判定可能な受入条件がすべて判定され、未達が 0 件である

  - 判定を後続 phase へ引き渡す条件について、引き渡し先の phase が条件ごとに明記されている

  - 受入条件 11 件のいずれもが、判定済みか引き渡し済みのどちらかに分類されている'
scope_in:
- packages/core
- packages/api
- packages/web
- migrations
scope_out:
- 受入条件そのものの改定。移行適用後にしか判定できない条件と、型検査および予算表に関する条件の判定。
acceptance:
- この時点で判定可能な受入条件がすべて判定され、未達が 0 件である
- 判定を後続 phase へ引き渡す条件について、引き渡し先の phase が条件ごとに明記されている
- 受入条件 11 件のいずれもが、判定済みか引き渡し済みのどちらかに分類されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P07
classification_confidence: 0.95
classification_reason: P07 は 13 phase の acceptance slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P07.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-liy
  linked_at: '2026-09-08T10:08:57Z'
  sync_state: synced
github_publication:
  labels: []
  milestone: null
  mode: local_only
  project_aliases: []
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  completed_at: null
  evidence_refs: []
  policy: linked_pr_merged_all
  reconciled_at: null
  source: null
  status: in_progress
implementation_readiness:
  checked_at: '2026-09-08T08:23:38Z'
  missing_sections: []
  status: complete
---

# SYS-RTR-P07 受入判定

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-07-acceptance.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
