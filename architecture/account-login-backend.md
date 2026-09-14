---
graph_node_id: "arch-account-login-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "アカウントログイン — API とドメイン"
project_id: "kanjo"
domain: "account-login"
status: "active"
owners: []
tags: ["account-login", "backend", "api"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-13T05:02:52Z"
updated_at: "2026-09-13T05:02:52Z"
depends_on: ["spec-account-login"]
related_nodes: ["arch-account-login-auth", "arch-account-login-database", "arch-account-login-security"]
resource_scope: ["packages/api/src/routes", "packages/api/src/index.ts", "packages/api/src/schemas"]
purpose: "利用者をドメインの主体として新設し、認証・本人操作・管理操作の API 契約を定める。"
goal: "認証系4本と管理系5本のエンドポイントが、既存のエラー形状と authGuard 契約を保ったまま提供される状態にする。"
scope_in: ["user ドメインの新設", "POST /api/auth/login|logout, GET /api/auth/me, POST /api/auth/password", "admin 限定の /api/admin/users 系", "zod による入力検証"]
scope_out: ["明細データへの所有者列追加", "既存 20 画面の呼出し契約の変更", "自己サインアップ用エンドポイント"]
acceptance: ["/api/* の authGuard 適用範囲と 401/503 応答契約が現行のまま維持される", "エラー形状が { error: { code, message } } を踏襲する", "管理系エンドポイントが admin 以外に403を返す", "GET /api/auth/me が id・email・role・must_change_password を返す"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/account-login-backend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "46b9eb7aab90a1b6460283ca46c4292e397894ca4c564adc874842079d5ff2db"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "a2b45a3f2b11521fedccf7f55a17247310aa093040f39cbf7ac3780b943e93bc", "imported_at": "2026-09-13T05:02:52Z"}
classification_confidence: 1.0
classification_reason: "ドメイン境界と API 契約を定めるため architecture / backend subtype として取り込む (API 契約の正本は specs/spec-account-login.md の API契約節)。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/account-login-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T05:02:52Z"}
serves_goals: [G1, G3, G5]
---

# アカウントログイン — API とドメイン

規範は `specs/spec-account-login.md`、内容の正本は `system-spec/backend.md`。

## Architecture overview

ドメインに「利用者 (user)」を新設する。属性は id / email (一意・正規化済み) / password_hash / role (admin|member) / status (active|suspended) / session_generation / must_change_password / created_at / updated_at / last_login_at。既存の全業務データは単一テナント前提のまま変更せず、利用者は認証と監査の主体としてのみ導入する。

## Context and drivers

既存 20 画面は現行の `api()` ラッパと 401/503 契約に依存している。利用者の導入がこの契約を変えると、認証と無関係な画面まで巻き込む。したがって本章の設計は「追加はするが、既存の呼出し契約は動かさない」ことを制約として受ける。

## Goals and non-goals

- Goal: 認証系・本人操作・管理操作の API を Hono 上に追加する。
- Non-goal: 業務データの所有者化、既存契約の変更、自己サインアップ。

## System context and boundaries

- 認証系: `POST /api/auth/login` (email, password, remember) / `POST /api/auth/logout` / `GET /api/auth/me` / `POST /api/auth/password` (現行パスワード必須)
- 管理系 (admin 限定): `GET|POST /api/admin/users` / `PATCH /api/admin/users/:id` / `POST /api/admin/users/:id/password-reset`。退出は停止・再開へ一本化し、監査主体を失う物理DELETEは提供しない。

## Container and component view

Hono の route 層、zod による入力検証層、認証・認可ミドルウェア、D1 アクセス層。エラー形状は現行の `{ error: { code, message } }` を踏襲する。

## Cross-cutting contracts

`/api/*` の `authGuard` 適用範囲と 401/503 の応答契約は現行のまま維持する。`authGuard` は共有業務tenantの `userId='default'` と、検証済み実利用者の `actor` を別contextへ載せる。

## Subtype architecture

**backend**: 利用者を認証と監査の主体に限定することで、業務ロジック側の読み書き経路を一切変えずに済む。招待 (`POST /api/admin/users`) は一時パスワード発行と同じ操作であり、別エンドポイントに分けない。

## Architecture decisions

1. U7 scope.in の「既存データの所有者紐付け」は、業務データへの所有者列ではなく `audit_log.actor_user_id` を指すものとして狭く読む (`qa-backend-web-002`、利用者決定 `qa-c8-owner-linkage-001` で追認)。
2. 管理系を `/api/admin/*` に集約する — 認可の適用範囲を path で一意にし、個別 route の付け忘れを構造で防ぐ。

## Delivery, migration and rollback

エンドポイントの追加は既存契約を変えないため、段階的に投入できる。未捕捉500だけは既存の
`code` / `message` に任意の `requestId` を加え、運用ログと照合できるよう後方互換で拡張する。
ただし `AUTH_PASSWORD` の撤去は認証系の全面切替と同時であり、分割しない。

## Risks and verification

- リスク: 管理系 route への認可付け忘れ → path 単位のミドルウェア適用と、member による全管理系 API 呼出しの 403 テストで検証する。
- 検証: 既存 20 画面の呼出しが 401/503 契約の変更なしに動作することを回帰で確認する。
