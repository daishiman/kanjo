---
graph_node_id: "SYS-ACCTLOGIN-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "AUTH_PASSWORD 廃止と切替手順の適用"
project_id: "feature-package-feat-account-login"
domain: "operations"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:56:09Z"
updated_at: "2026-09-13T05:56:09Z"
depends_on: ["SYS-ACCTLOGIN-P07"]
related_nodes: ["arch-account-login-infrastructure", "arch-account-login-maintenance-ops", "arch-account-login-auth"]
resource_scope: ["packages/api/src", "wrangler.toml"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P08"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-08-refactoring-migration.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P08.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.8", "linked_at": "2026-09-13T07:49:58Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "共有パスワードによる旧経路をコードベースから取り除き、SESSION_SECRET の入れ替えを含む切替手順を適用可能な形にする。"
goal: "active runtimeと必須設定に共有パスワード認証分岐が0件で、SESSION_SECRET 入れ替え手順が再現可能な粒度で用意されている状態。"
scope_in: ["AUTH_PASSWORD を参照するコードの除去", "SESSION_SECRET の入れ替え手順と、入れ替え時に全セッションが失効することの確認手順", "初期管理者アカウントの作成手順"]
scope_out: ["既存の業務データの移行。業務テーブルには触れない。"]
acceptance: ["active runtimeと必須設定に共有パスワード認証分岐が0件である", "SESSION_SECRET の入れ替え手順が、実行者が読んで再現できる粒度で記述されている", "初期管理者アカウントが存在しない状態から運用を開始できる手順が用意されている"]
architecture_refs: ["arch-account-login-infrastructure", "arch-account-login-maintenance-ops", "arch-account-login-auth"]
---

# SYS-ACCTLOGIN-P08 AUTH_PASSWORD 廃止と切替手順の適用

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P08
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P08
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P08.md
- `workstream_kind`: operations
- `build_target_kind`: application-code
- `depends_on`: SYS-ACCTLOGIN-P07

## 目的

共有パスワードによる旧経路をコードベースから取り除き、SESSION_SECRET の入れ替えを含む切替手順を適用可能な形にする。

## 背景

新旧の認証経路が同時に生きている間は、旧経路が迂回路として残り続ける。利用者アカウントが揃った後に旧経路を確実に閉じないと、この feature の目的そのものが達成されない。

## 前提条件

P07 で受入8件が充足と判定されていること。

## Workstream applicability

- 主 workstream: operations
- 副 workstream: backend、infrastructure
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-infrastructure、arch-account-login-maintenance-ops、arch-account-login-auth
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- AUTH_PASSWORD を参照するコードの除去
- SESSION_SECRET の入れ替え手順と、入れ替え時に全セッションが失効することの確認手順
- 初期管理者アカウントの作成手順

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

既存の業務データの移行。業務テーブルには触れない。

## Verification and evidence

- active runtimeと必須設定を検索し、共有パスワード認証分岐が0件であることを確認する
- SESSION_SECRET を入れ替えた状態で既存セッションが全て無効になることを、検証環境で確認する

### 受入条件

- active runtimeと必須設定に共有パスワード認証分岐が0件である
- SESSION_SECRET の入れ替え手順が、実行者が読んで再現できる粒度で記述されている
- 初期管理者アカウントが存在しない状態から運用を開始できる手順が用意されている

## Rollout and rollback

旧経路の除去は専用ブランチで行うため、ブランチを戻せば旧経路が復活する。SESSION_SECRET は入れ替え前の値を保持しない方針とし、戻す場合は全利用者の再ログインを前提とする。

## Handoff

切替手順を P12 の運用文書と P13 のリリース手順へ渡す。

## 参照情報

- architecture/account-login-infrastructure.md
- architecture/account-login-maintenance-ops.md
- architecture/account-login-auth.md
