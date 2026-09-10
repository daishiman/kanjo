---
graph_node_id: SYS-RTR-P02
artifact_kind: task
artifact_subtypes: []
title: 削除後の依存グラフと層境界の設計
project_id: feature-package-retire-tax-receipt-and-clarify-freee-only
domain: backend
status: active
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags:
- retire-tax-receipt
- architecture
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P02.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-02-architecture.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P01
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core/src
- packages/api/src
- packages/web/src
purpose: 証憑に属するモジュールを取り除いた後の core / api / web の依存関係を設計し、削除順序と切断点を決める。
goal: '- Produced artifacts: 削除順序を持つ依存グラフ、re-export とライフサイクル呼び出しの切断点一覧。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core/src / packages/api/src / packages/web/src


  ### 受入条件


  - 添付親の収束処理を呼ぶ箇所がすべて特定され、削除後の代替挙動が決まっている

  - core の re-export から証憑シンボルを外した際に壊れる利用側が列挙されている'
scope_in:
- packages/core/src
- packages/api/src
- packages/web/src
scope_out:
- 証憑以外のドメインロジックの再設計。
acceptance:
- 添付親の収束処理を呼ぶ箇所がすべて特定され、削除後の代替挙動が決まっている
- core の re-export から証憑シンボルを外した際に壊れる利用側が列挙されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P02
classification_confidence: 0.95
classification_reason: P02 は 13 phase の architecture slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P02.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-vma
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

# SYS-RTR-P02 削除後の依存グラフと層境界の設計

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-02-architecture.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
