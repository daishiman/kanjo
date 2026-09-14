---
graph_node_id: "SYS-ACCTLOGIN-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "本番反映と切替の実施"
project_id: "feature-package-feat-account-login"
domain: "infrastructure"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:56:09Z"
updated_at: "2026-09-13T05:56:09Z"
depends_on: ["SYS-ACCTLOGIN-P12"]
related_nodes: ["arch-account-login-infrastructure", "arch-account-login-maintenance-ops", "arch-account-login-database"]
resource_scope: ["wrangler.toml", "migrations"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P13"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-13-release-deploy.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P13.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.13", "linked_at": "2026-09-13T07:50:06Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "migration の適用、secret の入れ替え、初期管理者の作成を含む本番反映を、戻せる形で実施する。"
goal: "本番 D1 に users と audit_log が作成され、旧経路が閉じられ、管理者アカウントで実際にログインできる状態。"
scope_in: ["本番 D1 への migration 適用記録", "SESSION_SECRET 入れ替えと AUTH_PASSWORD 削除の実施記録", "初期管理者アカウントの作成記録", "反映後の疎通確認記録"]
scope_out: ["本 feature の範囲外の設定変更や、他機能の同時リリース。"]
acceptance: ["本番 D1 に users と audit_log が作成され、スキーマ版数が記録されている", "AUTH_PASSWORD が本番環境から削除され、旧経路でのログインが成立しない", "作成した管理者アカウントでログインでき、設定画面から利用者を追加できる"]
architecture_refs: ["arch-account-login-infrastructure", "arch-account-login-maintenance-ops", "arch-account-login-database"]
---

# SYS-ACCTLOGIN-P13 本番反映と切替の実施

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P13
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P13
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P13.md
- `workstream_kind`: infrastructure
- `build_target_kind`: application-code
- `depends_on`: SYS-ACCTLOGIN-P12

## 目的

migration の適用、secret の入れ替え、初期管理者の作成を含む本番反映を、戻せる形で実施する。

## 背景

この反映は認証の主体そのものを切り替えるため、途中で止まると誰もログインできない状態になりうる。適用順序と、各段階で戻せるかどうかを事前に固定して実施する。

## 前提条件

P10 でリリース可と判定され、P12 の運用手順が整っていること。

## Workstream applicability

- 主 workstream: infrastructure
- 副 workstream: operations、security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-infrastructure、arch-account-login-maintenance-ops、arch-account-login-database
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 本番 D1 への migration 適用記録
- SESSION_SECRET 入れ替えと AUTH_PASSWORD 削除の実施記録
- 初期管理者アカウントの作成記録
- 反映後の疎通確認記録

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

本 feature の範囲外の設定変更や、他機能の同時リリース。

## Verification and evidence

- 反映後に、作成した管理者アカウントで実際にログインできることを確認する
- 既存20画面が反映後も 401 と 503 の応答契約どおりに動作することを確認する

### 受入条件

- 本番 D1 に users と audit_log が作成され、スキーマ版数が記録されている
- AUTH_PASSWORD が本番環境から削除され、旧経路でのログインが成立しない
- 作成した管理者アカウントでログインでき、設定画面から利用者を追加できる

## Rollout and rollback

0039は`password_login_rate_limits`と`audit_log`を変更・再構築するため、reverse migrationや旧Worker単体のrollbackは行わない。障害時は適用前のD1 Time Travel復元点と互換アプリ世代を一体で戻す。その組を使えない場合は、旧`AUTH_PASSWORD`経路を復活させずforward-fixする。

## Handoff

反映記録を feature の完了根拠へ加え、以降の運用を P12 の手順書へ引き継ぐ。

## 参照情報

- architecture/account-login-infrastructure.md
- architecture/account-login-maintenance-ops.md
- architecture/account-login-database.md
