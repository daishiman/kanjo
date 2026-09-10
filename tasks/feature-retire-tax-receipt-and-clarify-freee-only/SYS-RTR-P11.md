---
graph_node_id: SYS-RTR-P11
artifact_kind: task
artifact_subtypes: []
title: 再現可能な証跡の収集
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
- evidence
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P11.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-11-evidence.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P10
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- .dev-graph/eval-log
purpose: 受入と検査の結果を、後から同じ手順で再現できる形で保存する。
goal: '- Produced artifacts: 実行コマンドと出力を対にした証跡ファイル。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: .dev-graph/eval-log


  ### 受入条件


  - 受入条件 11 件それぞれについてコマンドと出力が保存されている

  - 保存された各コマンドが再実行可能な形で記録されている'
scope_in:
- .dev-graph/eval-log
scope_out:
- 証跡の外部公開。
acceptance:
- 受入条件 11 件それぞれについてコマンドと出力が保存されている
- 保存された各コマンドが再実行可能な形で記録されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P11
classification_confidence: 0.95
classification_reason: P11 は 13 phase の evidence slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P11.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-nzp
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

# SYS-RTR-P11 再現可能な証跡の収集

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-11-evidence.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
