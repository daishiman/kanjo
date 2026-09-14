---
graph_node_id: "SYS-ACCTLOGIN-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "セキュリティと画面設計のレビュー"
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
depends_on: ["SYS-ACCTLOGIN-P02"]
related_nodes: ["arch-account-login-security", "arch-account-login-ui-ux", "arch-account-login-frontend"]
resource_scope: [".dev-graph/plans/feature-package-feat-account-login/evidence/phase-03-design-review.json"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P03"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-03-design-review.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P03.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.3", "linked_at": "2026-09-13T07:49:45Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "P02 の設計を、脅威側の視点と参照画像 01-login.png を正とする画面側の視点の両方から通し、実装着手前に破綻を潰す。"
goal: "脅威と防御の対応表に未対応行が0件で、参照画像との差分に判断記録の無い未解消行が0件である状態。"
scope_in: ["脅威一覧と、各脅威に対する防御の対応表 (総当たり・資格情報の詰め込み・セッション固定・列挙攻撃を含む)", "参照画像と設計画面の差分表 (単一カラムのカード1枚・安心3項目はカード内・アイコンとラベルの併記)", "レビュー指摘と、その解消または受容の判断記録"]
scope_out: ["外部の脅威モデリング手法の導入や、本 feature の範囲を超える既存画面の再設計。"]
acceptance: ["ログイン画面にヘッダー・フッター・サイドバーを描画せず、脇に置いた要素が枠として知覚されることも避ける方針が、レビュー結果として確認されている", "Cloudflare Access からのログインを促す表示が画面設計に存在しないことが確認されている", "ログイン失敗時の応答が、登録済みメールアドレスか否かを区別できない形になっていることが確認されている"]
architecture_refs: ["arch-account-login-security", "arch-account-login-ui-ux", "arch-account-login-frontend"]
---

# SYS-ACCTLOGIN-P03 セキュリティと画面設計のレビュー

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P03
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P03
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P03.md
- `workstream_kind`: security
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P02

## 目的

P02 の設計を、脅威側の視点と参照画像 01-login.png を正とする画面側の視点の両方から通し、実装着手前に破綻を潰す。

## 背景

ログイン画面は攻撃者が最初に触れる面であり、同時に利用者が最初に触れる面でもある。守りの設計と伝わり方の設計は互いに削り合うことがあるため、実装に入る前に両方を同じ机の上で突き合わせる必要がある。

## 前提条件

P02 の設計が確定し、design/FINAL-UI/images/01-login.png と architecture の ui-ux 章が参照できること。

## Workstream applicability

- 主 workstream: security
- 副 workstream: frontend、quality
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-security、arch-account-login-ui-ux、arch-account-login-frontend
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 脅威一覧と、各脅威に対する防御の対応表 (総当たり・資格情報の詰め込み・セッション固定・列挙攻撃を含む)
- 参照画像と設計画面の差分表 (単一カラムのカード1枚・安心3項目はカード内・アイコンとラベルの併記)
- レビュー指摘と、その解消または受容の判断記録

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

外部の脅威モデリング手法の導入や、本 feature の範囲を超える既存画面の再設計。

## Verification and evidence

- 脅威一覧の各行に防御が対応し、対応の無い行が0件であることを確認する
- 参照画像との差分表に、判断記録の無い未解消行が0件であることを確認する

### 受入条件

- ログイン画面にヘッダー・フッター・サイドバーを描画せず、脇に置いた要素が枠として知覚されることも避ける方針が、レビュー結果として確認されている
- Cloudflare Access からのログインを促す表示が画面設計に存在しないことが確認されている
- ログイン失敗時の応答が、登録済みメールアドレスか否かを区別できない形になっていることが確認されている

## Rollout and rollback

レビュー記録のみを生成するため、記録を破棄すれば元に戻る。

## Handoff

解消済みの指摘を P05 の実装制約として渡し、受容した指摘を P09 の品質保証の確認対象に含める。

## 参照情報

- architecture/account-login-security.md
- architecture/account-login-ui-ux.md
- architecture/account-login-frontend.md
