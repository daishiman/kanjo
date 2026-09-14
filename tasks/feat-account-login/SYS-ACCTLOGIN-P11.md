---
graph_node_id: "SYS-ACCTLOGIN-P11"
artifact_kind: "task"
artifact_subtypes: []
title: "証跡の収集と feature 完了根拠の確定"
project_id: "feature-package-feat-account-login"
domain: "documentation"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:56:09Z"
updated_at: "2026-09-13T05:56:09Z"
depends_on: ["SYS-ACCTLOGIN-P10"]
related_nodes: ["arch-account-login-maintenance-ops", "arch-account-login-security"]
resource_scope: [".dev-graph/plans/feature-package-feat-account-login/evidence/phase-11-evidence.json"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P11"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P11.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-11-evidence.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P11.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.11", "linked_at": "2026-09-13T07:50:03Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "受入8件の充足を後から第三者が再確認できる形で証跡としてまとめ、feature の完了根拠にする。"
goal: "受入8件すべてに再確認可能な証跡がひも付き、参照先の digest が一致している状態。"
scope_in: ["受入8件それぞれの証跡ファイルと、その所在一覧", "証跡が指す実行記録の digest", "feature 完了判定に使う根拠の索引"]
scope_out: ["証跡の内容の作り直し。既に記録された判定を書き換えない。"]
acceptance: ["受入8件の全てに再確認可能な証跡がひも付いている", "証跡の参照先が全て実在し、digest が一致している", "feature の完了判定に必要な根拠が索引から一意にたどれる"]
architecture_refs: ["arch-account-login-maintenance-ops", "arch-account-login-security"]
---

# SYS-ACCTLOGIN-P11 証跡の収集と feature 完了根拠の確定

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P11
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P11
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P11.md
- `workstream_kind`: documentation
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P10

## 目的

受入8件の充足を後から第三者が再確認できる形で証跡としてまとめ、feature の完了根拠にする。

## 背景

金融明細を扱う権限の変更は、後から誰が何を確認したのかを問われうる。判定の根拠が手元の記憶にしか無い状態を残さない。

## 前提条件

P07 の受入判定と P09 の点検、P10 のレビュー結果が揃っていること。

## Workstream applicability

- 主 workstream: documentation
- 副 workstream: quality
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-maintenance-ops、arch-account-login-security
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 受入8件それぞれの証跡ファイルと、その所在一覧
- 証跡が指す実行記録の digest
- feature 完了判定に使う根拠の索引

## Tracker publication and completion

- `tracker_binding_intent`: beads
- `github_publication.mode`: local_only
- `pr_completion_policy`: linked_pr_merged_all
- 完了は、ひも付いた pull request が既定ブランチへ全て取り込まれた時点で投影する。

## Branch and worktree execution

- `strategy`: one-task-one-branch
- `worktree_lease_required`: true
- `completion_projection`: default-branch-reconciliation
- `assignment_owner`: dev-graph-scheduler
- 着手時に worktree lease を claim し、完了時に release する。

## スコープ外

証跡の内容の作り直し。既に記録された判定を書き換えない。

## Verification and evidence

- 受入8件の全てに証跡が対応し、対応の無い受入が0件であることを確認する
- 各証跡が参照する実行記録が実在し、digest が一致することを確認する

### 受入条件

- 受入8件の全てに再確認可能な証跡がひも付いている
- 証跡の参照先が全て実在し、digest が一致している
- feature の完了判定に必要な根拠が索引から一意にたどれる

## Rollout and rollback

証跡索引だけを生成するため、索引を破棄すれば元に戻る。参照先の実行記録は変更しない。

## Handoff

証跡索引を P12 の運用文書と feature の完了判定へ渡す。

## 参照情報

- architecture/account-login-maintenance-ops.md
- architecture/account-login-security.md
