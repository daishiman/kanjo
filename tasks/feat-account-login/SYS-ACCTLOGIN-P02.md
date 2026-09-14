---
graph_node_id: "SYS-ACCTLOGIN-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "利用者ドメインとセッション境界の設計"
project_id: "feature-package-feat-account-login"
domain: "backend"
status: "active"
owners: []
tags: ["account-login", "auth", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:56:09Z"
updated_at: "2026-09-13T05:56:09Z"
depends_on: ["SYS-ACCTLOGIN-P01"]
related_nodes: ["arch-account-login-database", "arch-account-login-backend", "arch-account-login-auth"]
resource_scope: [".dev-graph/plans/feature-package-feat-account-login/evidence/phase-02-architecture-design.json"]
parent_feature: "feat-account-login"
feature_package_id: "feature-package/feat-account-login"
phase_ref: "P02"
file_path: "tasks/feat-account-login/SYS-ACCTLOGIN-P02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-account-login/plan-findings.json", "evaluated_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52"}
source_lineage: {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner", "source_path": ".dev-graph/plans/feature-package-feat-account-login/task-specs/phase-02-architecture.md", "source_version": "0.1.0", "source_digest": "407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52", "imported_at": "2026-09-13T05:56:09Z"}
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-account-login/SYS-ACCTLOGIN-P02.md", "confidence": 1}]
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-4o5.2", "linked_at": "2026-09-13T07:49:43Z", "sync_state": "synced"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "linked_pr_merged_all", "status": "in_progress", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"checked_at": "2026-09-13T05:45:00Z", "missing_sections": [], "status": "complete"}
purpose: "利用者テーブル・セッション表現・監査ログの3つの持ち物と、既存の業務ロジックとの境界を設計として確定する。"
goal: "users / audit_log の列定義とセッション失効の設計が確定し、既存の業務ロジックに読み書き経路の変更を持ち込まないことが示された状態。"
scope_in: ["users テーブルの列定義 (email / password_hash / role / status / session_generation / must_change_password)", "セッション cookie の構造と失効判定の設計 (session_generation による一括失効を含む)", "audit_log の列定義と、認証操作が残す記録の一覧", "既存の業務ロジック側に一切の読み書き経路変更を持ち込まないことを示す境界図"]
scope_out: ["業務データテーブルへの所有者列の追加。監査は audit_log.actor_user_id だけで行う。"]
acceptance: ["users / audit_log のスキーマが、パスワードを PBKDF2-HMAC-SHA256 で 210,000 回以上反復した派生値としてのみ保持する形になっている", "session_generation の増加だけで、その利用者の既存セッションを全て失効させられることが設計上示されている", "既存20画面が依拠する 401 と 503 の応答契約に変更が無いことが設計上示されている"]
architecture_refs: ["arch-account-login-database", "arch-account-login-backend", "arch-account-login-auth"]
---

# SYS-ACCTLOGIN-P02 利用者ドメインとセッション境界の設計

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P02
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P02
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P02.md
- `workstream_kind`: backend
- `build_target_kind`: application-code
- `depends_on`: SYS-ACCTLOGIN-P01

## 目的

利用者テーブル・セッション表現・監査ログの3つの持ち物と、既存の業務ロジックとの境界を設計として確定する。

## 背景

既存20画面は /api/* の 401 と 503 という応答契約だけを通じて認証へ接している。利用者という主体を導入するとき、この契約を変えずに済ませられるかどうかで影響範囲が一桁変わるため、境界の置き方を設計段階で決める。

## 前提条件

P01 のベースラインが確定し、D1 の現行スキーマ版数と既存 migration の適用状況が読み取れること。

## Workstream applicability

- 主 workstream: backend
- 副 workstream: data、security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-database、arch-account-login-backend、arch-account-login-auth
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- users テーブルの列定義 (email / password_hash / role / status / session_generation / must_change_password)
- セッション cookie の構造と失効判定の設計 (session_generation による一括失効を含む)
- audit_log の列定義と、認証操作が残す記録の一覧
- 既存の業務ロジック側に一切の読み書き経路変更を持ち込まないことを示す境界図

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

業務データテーブルへの所有者列の追加。監査は audit_log.actor_user_id だけで行う。

## Verification and evidence

- 設計した全ての列が、P01 ベースラインのいずれかの受入条件に紐付くことを確認する
- 既存の業務系ハンドラの入出力シグネチャが設計前後で変化しないことを、対象ファイルの一覧突合で確認する

### 受入条件

- users / audit_log のスキーマが、パスワードを PBKDF2-HMAC-SHA256 で 210,000 回以上反復した派生値としてのみ保持する形になっている
- session_generation の増加だけで、その利用者の既存セッションを全て失効させられることが設計上示されている
- 既存20画面が依拠する 401 と 503 の応答契約に変更が無いことが設計上示されている

## Rollout and rollback

設計文書のみを生成するため、文書を破棄すれば元に戻る。migration は本フェーズでは適用しない。

## Handoff

確定した列定義とセッション設計を P03 のレビュー対象とし、P05 の実装入力とする。

## 参照情報

- architecture/account-login-database.md
- architecture/account-login-backend.md
- architecture/account-login-auth.md
