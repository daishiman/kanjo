---
graph_node_id: "SYS-ACCTLOGIN-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "テスト実行と失敗経路の確認"
project_id: "feature-package-feat-account-login"
domain: "quality"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:56:09Z"
updated_at: "2026-09-13T05:56:09Z"
depends_on: ["SYS-ACCTLOGIN-P05"]
related_nodes: ["arch-account-login-security", "arch-account-login-auth"]
resource_scope: [".dev-graph/plans/feature-package-feat-account-login/evidence/phase-06-test-run.json"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P06"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-06-test-run.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P06.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.6", "linked_at": "2026-09-13T07:49:55Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "P04 で設計し P05 で実装したテストを実行し、緑であることと、旧実装では赤であったことの両方を記録する。"
goal: "P04 設計分のテストが全件成功し、旧実装に対して落ちたことが実行記録として残っている状態。"
scope_in: ["テスト実行結果 (件数・成功・失敗の内訳)", "旧実装に対する実行結果と、落ちたケースの一覧", "失敗経路ケースの実行記録"]
scope_out: ["テスト内容の変更。緑にするために判定条件を緩める修正は行わない。"]
acceptance: ["P04 で設計した全テストが実行され、失敗が0件である", "旧実装に対する実行で、受入に対応するテストが落ちたことが記録されている", "失敗経路のケースが期待どおりの応答を返すことが記録されている"]
architecture_refs: ["arch-account-login-security", "arch-account-login-auth"]
---

# SYS-ACCTLOGIN-P06 テスト実行と失敗経路の確認

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P06
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P06
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P06.md
- `workstream_kind`: quality
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P05

## 目的

P04 で設計し P05 で実装したテストを実行し、緑であることと、旧実装では赤であったことの両方を記録する。

## 背景

緑になったという事実だけでは、テストが何かを検算したのか、単に何も調べていないのかを区別できない。旧実装に対して落ちることを併せて確認して初めて、テストが受入の代理になる。

## 前提条件

P05 の実装が完了し、テストが実装済みであること。

## Workstream applicability

- 主 workstream: quality
- 副 workstream: security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-security、arch-account-login-auth
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- テスト実行結果 (件数・成功・失敗の内訳)
- 旧実装に対する実行結果と、落ちたケースの一覧
- 失敗経路ケースの実行記録

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

テスト内容の変更。緑にするために判定条件を緩める修正は行わない。

## Verification and evidence

- テスト件数が P04 の設計件数と一致し、失敗が0件であることを確認する
- 旧実装に対して、受入に対応する各テストが落ちたことを実行記録で確認する

### 受入条件

- P04 で設計した全テストが実行され、失敗が0件である
- 旧実装に対する実行で、受入に対応するテストが落ちたことが記録されている
- 失敗経路のケースが期待どおりの応答を返すことが記録されている

## Rollout and rollback

実行と記録だけを行うため、記録を破棄すれば元に戻る。

## Handoff

実行記録を P07 の受入確認と P11 の証跡整備へ渡す。

## 参照情報

- architecture/account-login-security.md
- architecture/account-login-auth.md
