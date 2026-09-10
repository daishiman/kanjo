---
graph_node_id: SYS-RTR-P05
artifact_kind: task
artifact_subtypes: []
title: 証憑機能の削除と freeeOnly 行の操作除去
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
- implementation
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P05.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-05-implementation.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P04
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core/src
- packages/api/src
- packages/web/src
purpose: 確定申告の入口、証憑の登録から取得までの経路、関連する DB 定義を取り除き、あわせて一致にも除外にも入らない freee の残余一覧から二重登録として外す操作を除き、その見出しと説明を全分割の残余として読める表現へ変更する。
goal: '- Produced artifacts: 削除後のソース、退避済みの独立テスト、是正後の一覧見出しと説明文。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core/src / packages/api/src / packages/web/src


  ### 受入条件


  - active runtime surface（route登録・API route登録・現行DB schema・navigation・scheduled job・public export）に、確定申告と証憑の画面、経路、および専用スキーマ定義が残っていない (実データベースへの適用は後続 phase が担う)

  - 一致にも除外にも入らない freee の残余行に二重登録として外す操作が出ない

  - その一覧の見出しと説明が、取り込んだ freee 取引の全分割における残余であることを述べる表現になっている

  - 退避先の独立テストが追加され、単体で緑になる'
scope_in:
- packages/core/src
- packages/api/src
- packages/web/src
scope_out:
- 突合済み行に出ている同じ操作の扱い、および excluded 機能そのもの。
acceptance:
- active runtime surface（route登録・API route登録・現行DB schema・navigation・scheduled job・public export）に、確定申告と証憑の画面、経路、および専用スキーマ定義が残っていない (実データベースへの適用は後続 phase が担う)
- 一致にも除外にも入らない freee の残余行に二重登録として外す操作が出ない
- その一覧の見出しと説明が、取り込んだ freee 取引の全分割における残余であることを述べる表現になっている
- 退避先の独立テストが追加され、単体で緑になる
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P05
classification_confidence: 0.95
classification_reason: P05 は 13 phase の implementation slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P05.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-4t0
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

# SYS-RTR-P05 証憑機能の削除と freeeOnly 行の操作除去

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-05-implementation.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
