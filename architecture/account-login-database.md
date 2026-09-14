---
graph_node_id: "arch-account-login-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "アカウントログイン — データモデルと移行"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "database", "migration"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-backend", "arch-account-login-auth", "arch-account-login-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/db"]
purpose: "利用者・一時パスワード・監査 actor を D1 のスキーマとして定め、既存行を壊さずに移行する。"
goal: "users に現在の一時資格情報を集約し、rate limit を送信元・account独立キーへ拡張し、audit_log に actor_user_id を後方互換で追加した状態にする。"
scope_in: ["users テーブル (email UNIQUE、status/role の CHECK、一時資格情報期限)", "password_login_rate_limits の二軸キー", "audit_log.actor_user_id の追加 (NULL 許容)", "初期管理者1件の seed"]
scope_out: ["業務データ (明細・取引・カテゴリ) への所有者列追加", "既存 audit_log 行の actor 遡及書き込み", "パスワードハッシュの R2/KV への複製"]
acceptance: ["migration が前方のみで既存行を壊さない", "email に UNIQUE 制約が存在する", "audit_log.actor_user_id が NOT NULL 制約を持たない", "平文パスワードを保持するカラムが0件である"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-database.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "00abc361f6eec2d76efcfb2bbfaaf02fafad615b51a30f2b29dafa28bd9e71b6"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "8b5a6ca7ceb1209e2dede267354cc274c54bdca70dc6daa616e0d5e8836e6d6b", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "永続データの構造と移行順序を定めるため architecture / data subtype として取り込む。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G1, G3]
---

# アカウントログイン — データモデルと移行

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/database.md`。

## Architecture overview

D1 (`kanjo-db`) に `0039_account_login.sql` で追加する。追加は (a) 現在の一時資格情報も同じ行に持つ `users`、(b) `password_login_rate_limits` の送信元・account独立キー、(c) `audit_log.actor_user_id` の3点。

## Context and drivers

既存データは単一テナント前提で作られ、所有者列を持たず `userId` は `'default'` 固定である。ここへ利用者を導入するとき、既存行に所有者を書き込むか否かが移行の分岐点になる。

## Goals and non-goals

- Goal: 利用者・一時パスワード・監査 actor を持つスキーマへ、既存行を壊さず前進する。
- Non-goal: 業務データへの所有者列追加、既存 audit_log 行の actor 遡及。

## System context and boundaries

パスワードハッシュと一時パスワードハッシュは D1 にのみ置き、R2 や KV へ複製しない。境界は `migrations/` と D1 スキーマに閉じる。

## Container and component view

- `users`: id / email (UNIQUE・正規化済み) / password_hash / role (CHECK admin|member) / status (CHECK active|suspended) / session_generation / must_change_password / created_at / updated_at / last_login_at
- `users.temporary_password_expires_at`: 現在の `password_hash` が一時資格情報の場合の有効期限。通常パスワードへの変更でNULLへ戻す
- `password_login_rate_limits`: キーをメールアドレス単位へ拡張
- `audit_log`: `actor_user_id` を NULL 許容で追加

## Cross-cutting contracts

全 migration は前方のみとし、既存行を壊さない。適用後に初期管理者を1件作成する単一のbootstrap seed手順を伴い、共有パスワードは同じ切替作業で廃止する。

## Subtype architecture

**data**: `audit_log.actor_user_id` の NULL は欠測ではなく「識別不能な時代の操作である」という意味を持つ値として扱う。共有パスワード経路では操作者を識別する情報をそもそも記録していないため、遡って埋めることは「特定できた」と誤って主張することになる。この判断が NOT NULL 制約を付けない理由である。

## Architecture decisions

1. 既存行の `actor_user_id` は NULL のまま保持する — 観測していない事実を移行で書き込まない。
2. 業務データへ所有者列を追加しない (利用者決定 `qa-c8-owner-linkage-001`) — 実質的に単独運用であり、細粒度の権限設計を対象外としている以上、使われない列だけが残るため。
3. パスワードハッシュを D1 に限定する — 複製先が増えるほど漏洩面が広がる。

## Delivery, migration and rollback

migration 適用後、共有パスワードを撤去する前にbootstrap seedで初期管理者を作成し、資格情報を運用者へ引き渡す。これらは1回の切替作業として連続実行し、共有パスワードとアカウントを定常的に併存させない (併存は最弱経路が実効的な認証強度になるため)。rollback は行わず前方修正とする。

## Risks and verification

- リスク: email 正規化の不一致による重複登録 → UNIQUE 制約と、保存前の正規化 (空白除去 + 小文字化) の双方で担保する。
- 検証: migration 適用後のスキーマに `password_hash` / `salt` / 反復回数が存在し、平文カラムが0件であることを検査する。
