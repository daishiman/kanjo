---
graph_node_id: "arch-statements-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "決算書 — 2 経路を既存の authGuard と一時パスワードの fence の内側に置き、user_id と組で引く"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "auth"]
file_path: "architecture/statements-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7bce6415965c0d792d7b8bbda988ffddefcfe679591e6adf72713134c21314e1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "7bce6415965c0d792d7b8bbda988ffddefcfe679591e6adf72713134c21314e1", "imported_at": "2026-09-19T22:38:08Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T22:38:08Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/routes/balances.ts", "packages/api/src/routes/analytics.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

決算書画面 — 2 経路を既存の authGuard と一時パスワードの fence の内側に置き、user_id と組で引く。`system-spec/auth.md` は承認時入力、本書は auth 制約を持つ。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` は認証エンドポイントの後に `app.use('/api/*', authGuard())` と `mustChangePasswordFence()` を掛ける (102 行付近)。`packages/api/src/auth.ts` はセッション Cookie を sameSite 'Strict'・httpOnly・secure で発行し (129 行)、ログアウトで maxAge 0 にする (136 行)。`migrations/0039_account_login.sql` が users と audit_log の actor_user_id を導入している。
- Quality attribute priorities: G4・G5 に資する。OWASP ASVS の認証・セッション。
- Constraints: 新しい認証方式・役割は足さない。

## Goals and non-goals

- Goals:
  - G5: 決算書の閲覧と負債の保存を、認証済みで一時パスワードでない利用者の自分のデータに限る。
  - G4: 同じブラウザで別の利用者に前の利用者の下書きが見えない。
- Non-goals:
  - 役割・共有・閲覧権限の追加
  - 認証方式の変更

## System context and boundaries

- Users/external systems: 利用者 1 名 (アカウントごとに分離)。
- Trust/deployment/data boundaries: user_id はセッションから取り、本文・クエリから受けない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard | `/api/*` の未認証を 401 | Hono middleware | packages/api | Worker |
| mustChangePasswordFence | 一時パスワードの利用者を止める | Hono middleware | packages/api | Worker |
| GET /api/statements・PUT /api/balances/liabilities | 上記の内側で user_id と組で読み書き | HTTP | packages/api | Worker |
| ログアウト処理 (web) | `kanjo.statements.liabilityDraft.<userId>.` 接頭辞の下書きを消す | 関数 | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: セッション Cookie (HttpOnly・Secure・SameSite=Strict)。
- Errors/resilience: 未認証 401。セッション切れで保存が 401 になったら下書きは残し、再ログイン後に復元できる (同じ userId のとき)。
- Observability/audit: liability_audit_log.actor_user_id に操作者を残す。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の認証の流れを変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Threat model and trust boundaries

脅威は (1) 未認証の保存、(2) 他人の user_id の読み書き、(3) 共有端末での下書きの漏えい。境界はセッション Cookie と authGuard。

#### Identity, authentication and authorization

既存のアカウントログインをそのまま使う。認可は『自分の user_id のデータだけ』で、追加の役割は無い。

#### Data protection and secrets

下書きのキーに userId を含め、ログアウトで接頭辞一括削除する。

#### Input, API and dependency security

N/A: 入力検証は `architecture/statements-security.md` が持つ。

#### Security monitoring and response

liability_audit_log の actor_user_id。

#### Security verification

API テスト: 未認証の GET / PUT が 401。別の利用者の行が応答に混ざらないこと。DOM テスト: ログアウトで下書きキーが消えること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-auth-web-002 | 既存の authGuard と fence の内側に置き、新しい認証を足さない | 保存に再認証を要求 | 負債の保存は既存の他の保存と同じ重みで、再認証は操作を重くする | 既存のセッションの強さがそのまま上限になる |
| qa-statements-auth-web-002 | 下書きキーに userId を含め、ログアウトで消す | キーに userId を含めない | 共有端末で前の利用者の下書きが見えない | ログアウトせずに閉じた場合は同じ利用者にだけ残る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web ビルド。
- Migration sequence: 下書きストア (キーに userId) → ログアウト処理に下書き削除を追加。
- Rollback trigger/procedure: 認証の流れは変えないので、戻すのは下書き削除の追加だけ。

## Risks and verification

- Risk/assumption: userId を web が知らない状態で下書きを書くと、キーが `undefined` になり利用者間で共有される。userId が無いときは下書きを書かない。
- Architecture fitness test: 決算書と負債の経路が `/api/*` の authGuard の後に登録されていること。
- Load/failure/security validation: 未認証 401 のテスト。
