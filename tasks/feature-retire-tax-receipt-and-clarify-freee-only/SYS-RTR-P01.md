---
graph_node_id: SYS-RTR-P01
artifact_kind: task
artifact_subtypes: []
title: 廃止範囲と保持範囲の要件確定
project_id: feature-package-retire-tax-receipt-and-clarify-freee-only
domain: documentation
status: active
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags:
- retire-tax-receipt
- requirements
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P01.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-01-requirements.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on: []
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core/src
- packages/api/src
- packages/web/src
- migrations
purpose: 確定申告と証憑に属する機能をどこまで消し、どの機能を必ず残すかを、件数で判定できる形の要件として確定させる。
goal: '- Produced artifacts: 廃止対象と保持対象の対照表、受入条件 11 件の判定手順。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core/src / packages/api/src / packages/web/src /
  migrations


  ### 受入条件


  - 廃止対象の能力が 9 項目すべて列挙され、各項目に判定コマンドが対応している

  - 保持能力として FILES バインディング、改善リクエスト、夜間バックアップ、取込原本、現金記帳、交通費記帳、matched 行の除外、excluded 機能の 8 項目が明記されている'
scope_in:
- packages/core/src
- packages/api/src
- packages/web/src
- migrations
scope_out:
- excluded 機能そのものの廃止、消し込みと合算のロジック変更、R2 バケットと FILES バインディングの廃止。
acceptance:
- 廃止対象の能力が 9 項目すべて列挙され、各項目に判定コマンドが対応している
- 保持能力として FILES バインディング、改善リクエスト、夜間バックアップ、取込原本、現金記帳、交通費記帳、matched 行の除外、excluded 機能の 8 項目が明記されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P01
classification_confidence: 0.95
classification_reason: P01 は 13 phase の requirements slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P01.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-m7t
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

# SYS-RTR-P01 廃止範囲と保持範囲の要件確定

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-01-requirements.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
