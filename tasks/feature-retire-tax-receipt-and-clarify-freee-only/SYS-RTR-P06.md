---
graph_node_id: SYS-RTR-P06
artifact_kind: task
artifact_subtypes: []
title: テスト実行
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
- test-run
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P06.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-06-test-run.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P05
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core/test
- packages/api/test
- packages/web/test
purpose: 削除後のコードに対して単体、契約、結合の各テストを実行し、保持対象の保証が生きていることを確かめる。
goal: '- Produced artifacts: テスト実行ログ。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core/test / packages/api/test / packages/web/test


  ### 受入条件


  - 取り込んだ freee 取引の分割が過不足なく成り立つことを見る契約テストが実行され緑である

  - matched 行の除外操作と excluded 機能の回帰テストが実行され緑である

  - 取込原本の active・recent・processing 保護と期限超過 inactive 削除の回帰テストが実行され緑である

  - 現金記帳のライフサイクル回帰テストが実行され緑である

  - 交通費記帳のライフサイクル回帰テストが実行され緑である

  - 退避した夜間バックアップのテストが実行され緑である

  - 予算表の合計一致テストが実行され緑である'
scope_in:
- packages/core/test
- packages/api/test
- packages/web/test
scope_out:
- 新機能に対するテストの追加。
acceptance:
- 取り込んだ freee 取引の分割が過不足なく成り立つことを見る契約テストが実行され緑である
- matched 行の除外操作と excluded 機能の回帰テストが実行され緑である
- 取込原本の active・recent・processing 保護と期限超過 inactive 削除の回帰テストが実行され緑である
- 現金記帳のライフサイクル回帰テストが実行され緑である
- 交通費記帳のライフサイクル回帰テストが実行され緑である
- 退避した夜間バックアップのテストが実行され緑である
- 予算表の合計一致テストが実行され緑である
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P06
classification_confidence: 0.95
classification_reason: P06 は 13 phase の test-run slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P06.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-rkc
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

# SYS-RTR-P06 テスト実行

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-06-test-run.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
