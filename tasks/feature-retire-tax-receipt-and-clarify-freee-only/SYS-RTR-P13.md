---
graph_node_id: SYS-RTR-P13
artifact_kind: task
artifact_subtypes: []
title: 反映と反映後の確認
project_id: feature-package-retire-tax-receipt-and-clarify-freee-only
domain: operations
status: active
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags:
- retire-tax-receipt
- release-deploy
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P13.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-13-release-deploy.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P12
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- migrations
- packages/api
- packages/web
- .dev-graph/eval-log
purpose: 0038までの互換Release Aだけを反映し、保持対象の動作と廃止入口の不在を確認して、物理削除は別follow-up featureへ引き渡す。
goal: '- Produced artifacts: Release Aの反映記録、反映後の確認結果、Release B follow-up feature候補。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: migrations / packages/api / packages/web / .dev-graph/eval-log


  ### 受入条件


  - 反映後に改善リクエストのスクリーンショットが保存できる

  - 反映後に夜間バックアップが所定の場所へ書ける

  - 反映後に確定申告と証憑の経路へ到達できない

  - 反映済みmigration headが0038であり、0039と旧専用6テーブルの物理削除を含まない

  - Release Bが、共通`r2_cleanup_jobs`と旧cleanup台帳の残件0・D1復元点・互換アプリ世代を開始条件とする別follow-up featureとして記録されている'
scope_in:
- migrations
- packages/api
- packages/web
- .dev-graph/eval-log
scope_out:
- 新機能の同時投入、および0039と旧専用6テーブルの物理削除。
acceptance:
- 反映後に改善リクエストのスクリーンショットが保存できる
- 反映後に夜間バックアップが所定の場所へ書ける
- 反映後に確定申告と証憑の経路へ到達できない
- 反映済みmigration headが0038であり、0039と旧専用6テーブルの物理削除を含まない
- Release Bが、共通`r2_cleanup_jobs`と旧cleanup台帳の残件0・D1復元点・互換アプリ世代を開始条件とする別follow-up featureとして記録されている
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P13
classification_confidence: 0.95
classification_reason: P13 は 13 phase の release-deploy slot に対応し、成果物は task 1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P13.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-6mc
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

# SYS-RTR-P13 反映と反映後の確認

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-13-release-deploy.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
