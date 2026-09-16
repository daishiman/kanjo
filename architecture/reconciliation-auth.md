---
graph_node_id: "arch-reconciliation-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "照合画面 — 認証ゲート配下の照合 API と操作 id の所有者確認"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "auth"]
file_path: "architecture/reconciliation-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "20f2fb1c3077c7947868fff14a3e48c2704f83ffed4ae43fea33b6794b11eb52"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "20f2fb1c3077c7947868fff14a3e48c2704f83ffed4ae43fea33b6794b11eb52", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/web/src/AuthenticatedApp.tsx"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の auth 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

照合画面 — 認証ゲート配下の照合 API と操作 id の所有者確認。`system-spec/auth.md` は承認時入力、本書は認証制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: packages/api/src/index.ts は authRoute・aiAgentRoute・improvementAgentRoute を先に、その後 /api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を掛けてから adminUsersRoute ほか業務 route (totalCashflowRoute・analysisHubRoute 等) をマウントする。各 route は c.get('userId') で全ての読み書きを絞り、route 内に別の認可判断を持たない (qa-auth-web-rc-observed-001)。
- Quality attribute priorities: G3・G4 に資する。Secure by Design の『既定で拒否し、境界で一度だけ判定する』と、OWASP ASVS の『全ての保護資源で認証を強制する』を適用する。
- Constraints: 新しい認証経路・トークンは足さない。照合 API (qa-backend-web-rc-decision-007) と月次レビュー API を既存ゲートの内側に置く。

## Goals and non-goals

- Goals:
  - G3: 照合 API (GET /api/reconciliation、POST /api/reconciliation/actions、POST /api/reconciliation/actions/:id/undo) を authGuard 配下で本人のデータだけに作用させる。
  - G4: 月次レビュー API を同じ位置にマウントし、本人の完了記録だけを保存・取消する。
- Non-goals:
  - 認証方式・セッション・パスワード変更フローの変更
  - 役割ベースの認可の追加

## System context and boundaries

- Users/external systems: 認証済みの利用者 1 名。外部 IdP は無い。
- Trust/deployment/data boundaries: 未認証の呼出しは route に届かない。route 内の認可は userId での絞り込みだけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard / mustChangePasswordFence | /api/* の未認証・一時パスワード未変更を拒否する | Hono middleware | packages/api | Worker |
| 照合 route | 読み書きを c.get('userId') で絞る | Hono route | packages/api | Worker |
| undo の所有者確認 | reconciliation_actions の user_id 一致を条件にし、他人の id は 404 | Hono route / D1 クエリ | packages/api | Worker |
| 月次レビュー route | 本人の月次レビュー完了だけを保存・取消する | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 既存セッションと authGuard に従う。未認証は 401、一時パスワード未変更は 403 password_change_required。
- Errors/resilience: 他人の操作 id は存在の有無を漏らさず 404。
- Observability/audit: N/A: 認証まわりの信号を追加しない。
- Configuration/secrets: N/A: 秘密情報を追加しない。
- Compatibility/versioning: 既存 route のマウント順を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者本人の照合判断・除外・操作履歴・月次レビュー完了。脅威は未認証の呼出しと、操作 id を推測した他人の取消。

#### Identity and authorization

照合 API と月次レビュー API は /api/* の authGuard → mustChangePasswordFence の後にマウントする。route 内の認可は c.get('userId') で読み書きを絞ることだけに限る。undo は reconciliation_actions の user_id 一致を WHERE 条件に含める。

#### Data and secret protection

他利用者の判断・履歴に触れない。他人の操作 id は 404 にして存在を漏らさない。

#### Application and supply-chain controls

N/A: 本章は認証・認可の配置だけを扱う。入力検証と取込との排他は security 章 (arch-reconciliation-security)。

#### Detection and response

N/A: 新しい検知・通知を追加しない。

#### Security verification

API 統合テストで未認証が 401、他人の操作 id の取消が 404、本人の操作だけが取り消せることを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-backend-web-rc-decision-007 | 照合専用 API を新設し既存ゲート配下にマウントする | 既存 total-cashflow API を拡張 | 認証・認可の配置は既存 route と同じで追加の判断を持たない | undo の所有者確認を route に持つ |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker の既存ゲート列の後に route を足す。
- Migration sequence: route を authGuard 配下にマウント → undo の user_id 条件 → 統合テスト。
- Rollback trigger/procedure: 認証なしで 200 が返る、他人の操作を取り消せる等のテスト失敗で PR を差し戻す。

## Risks and verification

- Risk/assumption: undo 以外の書込 (actions の対象 tx id・freee key) の所有者確認も userId で絞る前提。逐語のクエリは実装 task で確定する。
- Architecture fitness test: 新 route が authGuard より前にマウントされていないこと。
- Load/failure/security validation: 未認証 401・他人の id 404 の統合テストが緑であること。
