---
graph_node_id: SYS-RTR-P09
artifact_kind: task
artifact_subtypes: []
title: 型検査と静的検査と運用予算の整合
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
- quality-assurance
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P09.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-09-quality-assurance.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P08
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core
- packages/api
- packages/web
purpose: 型検査と静的検査を通し、定期ジョブの問い合わせ本数の予算表が実態と一致していることを確かめる。
goal: '- Produced artifacts: 型検査と静的検査の出力、再宣言後の予算表、テスト総数の増減記録。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core / packages/api / packages/web


  ### 受入条件


  - 型検査と静的検査がいずれも成功で終了する

  - 参照できない識別子が 0 件である

  - 予算表の合計が宣言された上限と一致する

  - 全パッケージのテストが緑で終了する

  - 削除前後のテスト件数の差分が、削除した証憑のテストと退避した独立テストの内訳で説明されている'
scope_in:
- packages/core
- packages/api
- packages/web
scope_out:
- 予算上限そのものの引き上げ。
acceptance:
- 型検査と静的検査がいずれも成功で終了する
- 参照できない識別子が 0 件である
- 予算表の合計が宣言された上限と一致する
- 全パッケージのテストが緑で終了する
- 削除前後のテスト件数の差分が、削除した証憑のテストと退避した独立テストの内訳で説明されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P09
classification_confidence: 0.95
classification_reason: P09 は 13 phase の quality-assurance slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P09.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-fdt
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

# SYS-RTR-P09 型検査と静的検査と運用予算の整合

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-09-quality-assurance.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
