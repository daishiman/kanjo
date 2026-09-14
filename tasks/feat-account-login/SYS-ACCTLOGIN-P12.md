---
graph_node_id: "SYS-ACCTLOGIN-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "運用手順と利用者向け案内の整備"
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
depends_on: ["SYS-ACCTLOGIN-P11"]
related_nodes: ["arch-account-login-maintenance-ops", "arch-account-login-infrastructure", "arch-account-login-ui-ux"]
resource_scope: ["docs"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P12"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-12-documentation-operations.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P12.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.12", "linked_at": "2026-09-13T07:50:04Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "管理者が日常的に行う利用者の追加・停止・パスワード再発行と、利用者がパスワードを忘れた際の流れを文書として整える。"
goal: "管理者が手順書だけで利用者の追加・停止・一時パスワード再発行を完了でき、監視手順が閾値とともに記述された状態。"
scope_in: ["管理者向け手順書 (招待・停止・一時パスワード再発行・初期管理者の作成)", "利用者向けの案内 (パスワードを忘れた場合の連絡先と流れ)", "ログイン失敗率とロックアウトの監視手順"]
scope_out: ["手順を自動化するツールの実装。本フェーズは文書化に限る。"]
acceptance: ["管理者が手順書だけを見て、利用者の追加・停止・一時パスワード再発行を完了できる", "パスワードを忘れた利用者が案内に従って管理者へ到達できる流れが記述されている", "ログイン失敗率とロックアウトの監視手順が、確認すべき閾値とともに記述されている"]
architecture_refs: ["arch-account-login-maintenance-ops", "arch-account-login-infrastructure", "arch-account-login-ui-ux"]
---

# SYS-ACCTLOGIN-P12 運用手順と利用者向け案内の整備

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P12
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P12
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P12.md
- `workstream_kind`: documentation
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P11

## 目的

管理者が日常的に行う利用者の追加・停止・パスワード再発行と、利用者がパスワードを忘れた際の流れを文書として整える。

## 背景

自己サインアップもメール送信も持たない構成では、利用者の増減とパスワードの再発行は管理者の手作業になる。手順が文書化されていないと、運用が属人化して権限管理そのものが緩む。

## 前提条件

P08 の切替手順と P11 の証跡が揃っていること。

## Workstream applicability

- 主 workstream: documentation
- 副 workstream: operations
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-maintenance-ops、arch-account-login-infrastructure、arch-account-login-ui-ux
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 管理者向け手順書 (招待・停止・一時パスワード再発行・初期管理者の作成)
- 利用者向けの案内 (パスワードを忘れた場合の連絡先と流れ)
- ログイン失敗率とロックアウトの監視手順

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

手順を自動化するツールの実装。本フェーズは文書化に限る。

## Verification and evidence

- 手順書の各操作について、実際に検証環境で実行して記述どおりに完了できることを確認する
- 利用者向け案内の記述が、画面上の案内ダイアログの文言と矛盾しないことを確認する

### 受入条件

- 管理者が手順書だけを見て、利用者の追加・停止・一時パスワード再発行を完了できる
- パスワードを忘れた利用者が案内に従って管理者へ到達できる流れが記述されている
- ログイン失敗率とロックアウトの監視手順が、確認すべき閾値とともに記述されている

## Rollout and rollback

文書のみを追加するため、文書を削除すれば元に戻る。

## Handoff

整備した運用手順を P13 のリリース手順へ渡す。

## 参照情報

- architecture/account-login-maintenance-ops.md
- architecture/account-login-infrastructure.md
- architecture/account-login-ui-ux.md
