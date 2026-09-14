---
graph_node_id: "SYS-ACCTLOGIN-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "セキュリティ観点の総点検"
project_id: "feature-package-feat-account-login"
domain: "security"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:56:09Z"
updated_at: "2026-09-13T05:56:09Z"
depends_on: ["SYS-ACCTLOGIN-P08"]
related_nodes: ["arch-account-login-security", "arch-account-login-auth", "arch-account-login-infrastructure"]
resource_scope: [".dev-graph/plans/feature-package-feat-account-login/evidence/phase-09-quality-assurance.json"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P09"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-09-quality-assurance.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P09.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.9", "linked_at": "2026-09-13T07:50:00Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "実装済みの系に対して、P03 で挙げた脅威が実際に防げているかを確認し、受容した指摘の現状を点検する。"
goal: "P03 の脅威一覧の全行に実機での確認結果が付き、ログに資格情報が残らないことが確認された状態。"
scope_in: ["P03 の脅威一覧に対する実機確認結果", "ログ出力に資格情報が含まれないことの確認記録", "ログイン失敗率とロックアウトの監視が機能することの確認記録"]
scope_out: ["外部の侵入テスト事業者による診断の実施。"]
acceptance: ["総当たり抑止が実際に働き、規定回数を超えた試行が拒否されることが確認されている", "ログ・エラー応答・監査記録のいずれにもパスワードとセッション値が含まれないことが確認されている", "audit_log に認証操作が actor_user_id 付きで記録されることが確認されている"]
architecture_refs: ["arch-account-login-security", "arch-account-login-auth", "arch-account-login-infrastructure"]
---

# SYS-ACCTLOGIN-P09 セキュリティ観点の総点検

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P09
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P09
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P09.md
- `workstream_kind`: security
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P08

## 目的

実装済みの系に対して、P03 で挙げた脅威が実際に防げているかを確認し、受容した指摘の現状を点検する。

## 背景

設計時に防げるはずだったことと、実装後に実際に防げていることは別である。特に総当たりの抑止やログ出力の内容は、実装の細部で穴が開きやすい。

## 前提条件

P08 の旧経路除去が完了していること。

## Workstream applicability

- 主 workstream: security
- 副 workstream: quality
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-security、arch-account-login-auth、arch-account-login-infrastructure
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- P03 の脅威一覧に対する実機確認結果
- ログ出力に資格情報が含まれないことの確認記録
- ログイン失敗率とロックアウトの監視が機能することの確認記録

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

外部の侵入テスト事業者による診断の実施。

## Verification and evidence

- P03 の脅威一覧の各行について、実機での確認結果が記録されていることを確認する
- 認証関連のログ出力を実際に採取し、パスワードとセッション値が含まれないことを確認する

### 受入条件

- 総当たり抑止が実際に働き、規定回数を超えた試行が拒否されることが確認されている
- ログ・エラー応答・監査記録のいずれにもパスワードとセッション値が含まれないことが確認されている
- audit_log に認証操作が actor_user_id 付きで記録されることが確認されている

## Rollout and rollback

点検記録だけを生成するため、記録を破棄すれば元に戻る。

## Handoff

点検結果を P10 の最終レビューへ渡す。

## 参照情報

- architecture/account-login-security.md
- architecture/account-login-auth.md
- architecture/account-login-infrastructure.md
