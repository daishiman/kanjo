---
graph_node_id: SYS-RTR-P04
artifact_kind: task
artifact_subtypes: []
title: 退避テストと受入テストの設計
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
- test-design
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P04.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-04-test-design.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P03
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/api/test
- packages/core/test
- packages/web/test
- .dev-graph/eval-log
purpose: 削除で失われる保証を独立テストへ退避する設計と、削除完了を件数で判定する受入テストの設計を確定する。
goal: '- Produced artifacts: 退避テストの設計、受入テストの一覧と各テストが落ちる条件、削除着手前のパッケージ別テスト件数の記録。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/api/test / packages/core/test / packages/web/test / .dev-graph/eval-log


  ### 受入条件


  - 削除着手前のパッケージ別テスト件数が記録され、後続 phase が突合できる形で保存されている

  - 夜間バックアップの R2 書き込みを検証する独立テストの配置先と内容が決まっている

  - 予算表の再宣言後に合計が上限と一致することを検証する手順が決まっている

  - 各受入テストについて、旧実装のままなら落ちることが説明されている'
scope_in:
- packages/api/test
- packages/core/test
- packages/web/test
- .dev-graph/eval-log
scope_out:
- 証憑機能そのものの新規テスト追加。
acceptance:
- 削除着手前のパッケージ別テスト件数が記録され、後続 phase が突合できる形で保存されている
- 夜間バックアップの R2 書き込みを検証する独立テストの配置先と内容が決まっている
- 予算表の再宣言後に合計が上限と一致することを検証する手順が決まっている
- 各受入テストについて、旧実装のままなら落ちることが説明されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P04
classification_confidence: 0.95
classification_reason: P04 は 13 phase の test-design slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P04.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-rul
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

# SYS-RTR-P04 退避テストと受入テストの設計

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-04-test-design.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
