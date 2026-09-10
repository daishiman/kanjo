---
graph_node_id: SYS-RTR-P08
artifact_kind: task
artifact_subtypes: []
title: 残存参照の整理とデータ移行
project_id: feature-package-retire-tax-receipt-and-clarify-freee-only
domain: data
status: active
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags:
- retire-tax-receipt
- refactoring-migration
file_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P08.md
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
  source_path: .dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-08-refactoring-migration.md
  source_plugin: system-dev-planner
  source_version: 0.1.0
created_at: '2026-09-08T08:27:24Z'
updated_at: '2026-09-09T16:14:10Z'
depends_on:
- SYS-RTR-P07
related_nodes:
- spec-total-cashflow-system
- arch-total-cashflow-system
resource_scope:
- packages/core/src
- packages/api/src
- packages/web/src
- migrations
purpose: 証憑に依存していた列と再輸出、および参照されなくなったオブジェクトの後始末を行い、他機能への影響がないことを確かめる。
goal: '- Produced artifacts: 共通cleanupへ移行する0038 SQL、参照整理後のソース、防御宣言と監査対象宣言の更新差分。

  - Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md
  / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md

  - Write scope/touches: packages/core/src / packages/api/src / packages/web/src /
  migrations


  ### 受入条件


  - バックアップの取得対象宣言から証憑テーブルが外れている

  - 書き換え可能な資源の防御宣言と監査記録の対象宣言から証憑由来の項目が外れている

  - 証憑用に置かれたオブジェクトの利用が終了しており、FILES バインディング自体は残っている

  - 0038で全旧添付keyと旧取込原本削除intentが共通`r2_cleanup_jobs`へ退避され、旧Workerの遅延writeも再処理できる

  - 取込原本は active・30日以内・processing/partial のいずれかなら共通guardで保護され、期限超過した inactive 原本だけが削除対象になる

  - 現行migration headが0038で、0039と旧専用6テーブルの物理削除がこのfeature packageに含まれていない'
scope_in:
- packages/core/src
- packages/api/src
- packages/web/src
- migrations
scope_out:
- R2 バケットと FILES バインディングの廃止。改善リクエストと夜間バックアップが使用中のため対象外とする。
- 0039の作成・適用と旧専用6テーブルの物理削除。別follow-up featureが担う。
acceptance:
- バックアップの取得対象宣言から証憑テーブルが外れている
- 書き換え可能な資源の防御宣言と監査記録の対象宣言から証憑由来の項目が外れている
- 証憑用に置かれたオブジェクトの利用が終了しており、FILES バインディング自体は残っている
- 0038で全旧添付keyと旧取込原本削除intentが共通`r2_cleanup_jobs`へ退避され、旧Workerの遅延writeも再処理できる
- 取込原本は active・30日以内・processing/partial のいずれかなら共通guardで保護され、期限超過した inactive 原本だけが削除対象になる
- 現行migration headが0038で、0039と旧専用6テーブルの物理削除がこのfeature packageに含まれていない
architecture_refs:
- arch-total-cashflow-system
parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only
phase_ref: P08
classification_confidence: 0.95
classification_reason: P08 は 13 phase の refactoring-migration slot に対応し、成果物は task
  1 件である
classification_candidates:
- artifact_kind: task
  candidate_path: tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P08.md
  confidence: 0.95
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-djk
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

# SYS-RTR-P08 残存参照の整理とデータ移行

この node の仕様書の正本は promoted package の中にある。ここは入口であって本文ではない。

- 正本: `.dev-graph/plans/feature-package-retire-tax-receipt-and-clarify-freee-only/task-specs/phase-08-refactoring-migration.md`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`

正本は promotion 時点で凍結されている。内容を変えるには plan verb を再実行し、新しい digest で promotion をやり直す。このファイルを編集しても仕様は変わらない。
