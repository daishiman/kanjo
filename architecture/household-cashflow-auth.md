---
graph_node_id: "arch-household-cashflow-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "家計収支 — 既存の認証とフェンスの内側に置く 4 経路"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "auth"]
file_path: "architecture/household-cashflow-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "30ba6c0055709da3317723b5e3225f3beb6ac0701fa529a32aad9b60a8fdd496"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "30ba6c0055709da3317723b5e3225f3beb6ac0701fa529a32aad9b60a8fdd496", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/schema-guard.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/settings.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G4"]
---

# Architecture overview

家計収支 — 既存の認証とフェンスの内側に置く 4 経路。`system-spec/auth.md` は承認時入力、本書は認証境界と利用者単位の認可の制約を持つ。経路の契約の正本は `specs/spec-household-cashflow-screen.md` §11。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` の『保護されたAPI』節 (101-114 行付近) で `app.use('/api/*', ...)` により `authGuard()` → `mustChangePasswordFence()` → `runtimeSchemaGuard` → `canonicalMutationFence()` の順に登録し、その後に analyticsRoute・settingsRoute・totalCashflowRoute などを載せている。家計の `GET /api/household` は analyticsRoute に、名義の設定 (`PUT /classification` の institutionOwners) は settingsRoute にあり、いずれも `c.get('userId')` で利用者単位に読み書きしている (qa-household-auth-web-evidence-001)。
- Quality attribute priorities: G4 に資する。OWASP ASVS の authentication (既存のセッション cookie をそのまま効かせる) と security (利用者単位でデータを閉じる) を適用する。
- Constraints: 既存のログイン (セッション cookie) を変えない。新しいログイン手段・長期トークン・管理者専用の権限を設けない。

## Goals and non-goals

- Goals:
  - G4: 家計の API (`GET /api/household`・`GET /api/household/category`) と名義ラベルの API (`GET` / `PUT /api/settings/owner-labels`) を既存の認証・フェンスの並びの内側に置き、利用者単位で閉じる。
- Non-goals:
  - 認証方式・セッションの変更
  - 家計画面のための新しいログイン手段や長期トークン
  - 名義ラベル更新のための管理者権限の新設

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部の認証サービスは使わない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。4 経路とも `c.get('userId')` で絞り、他の利用者の家計や表示名が混ざらない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` | セッション cookie を検証し、未認証は 401 | Hono ミドルウェア | packages/api | Worker |
| `mustChangePasswordFence` | 一時パスワードのままの利用者を止める | Hono ミドルウェア | packages/api | Worker |
| `runtimeSchemaGuard` | 必須表 (`owner_labels` を含む) が無い環境を 503 で止める | Hono ミドルウェア | packages/api | Worker |
| `canonicalMutationFence` | 更新系 (PUT owner-labels を含む) に既存の変更系保護を効かせる | Hono ミドルウェア | packages/api | Worker |
| 家計の 2 経路 | 利用者本人の台帳だけから集計する | analyticsRoute | packages/api | Worker |
| 名義ラベルの 2 経路 | 利用者本人の表示名だけを読み書きする | settingsRoute | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 4 経路とも `/api/*` のミドルウェアの並びの後に載せる。既存の設定 API と同じ並び。
- Errors/resilience: 未認証は 401、一時パスワードは既存のフェンスの応答、未適用のスキーマは 503。
- Observability/audit: N/A: 認証の監査に新しい信号を追加しない。
- Configuration/secrets: 新しい秘密情報・鍵を持たない。
- Compatibility/versioning: 既存のログイン・セッションの契約は不変。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Authentication boundary

認証は既存のセッション cookie による。未認証の要求は `authGuard` が 401 を返し、4 経路のハンドラへ届かない。一時パスワードのままの利用者は `mustChangePasswordFence` が止める。家計画面のための例外経路や公開経路を作らない。

#### Authorization model

認可は利用者単位で、利用者本人のデータだけを読み書きできる。家計集計の入力と `owner_labels` の読み書きはどちらも `c.get('userId')` で絞り、`owner_labels` の主キーは `(user_id, owner)`。名義ラベルの更新は利用者本人の表示設定であり、ロールや管理者権限を追加しない。

#### Credential handling

資格情報の扱いは変えない。家計と名義ラベルの経路は資格情報・トークンを受け取らず、応答にも含めない。

#### Security verification

API 統合テストで 4 経路の未認証 401、`PUT /api/settings/owner-labels` の変更系フェンス違反の拒否、利用者 A の表示名と家計が利用者 B から読めない・書けないことを確かめる。4 経路が `/api/*` の並びの後に登録されていることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-household-auth-web-001 | 4 経路を `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` の内側に置く | 経路ごとに個別の認証を書く | 既存の設定 API と同じ保護を漏れなく受ける | 登録順を変えると保護が外れるため順序をテストで固定する |
| qa-household-auth-web-001 | データを `user_id` で閉じる | 世帯共有のデータとして扱う | 他の利用者の家計や表示名が混ざらない | 表示名の保存も利用者ごとになる |
| dec-household-owner-model | 名義ラベルの更新は利用者本人の表示設定とし、管理者権限を新設しない | 管理者だけが表示名を変えられる | 内部値を変えない表示だけの変更で、権限を増やす理由が無い | 利用者ごとに異なる表示名を持てる |
| qa-household-auth-web-001 | 既存のセッション cookie をそのまま使い、新しいログイン手段・長期トークンを設けない | 家計画面向けの API トークンを発行する | 認証面を増やさずに済み、既存のフェンスがそのまま効く | 家計の API はブラウザのセッション経由でだけ使える |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono)。認証基盤の変更は無い。
- Migration sequence: `owner_labels` の migration 反映 → 必須表への追加 → 4 経路の登録 → API 統合テスト。
- Rollback trigger/procedure: 認可テストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。

## Risks and verification

- Risk/assumption: 新しい経路を並びの前に登録すると認証が効かない。index.ts の登録位置を既存経路と同じにし、未認証 401 のテストで検出する。
- Architecture fitness test: 4 経路のすべてで未認証が 401 になること。`owner_labels` の読み書きが `userId` の条件を必ず含むこと。
- Load/failure/security validation: 一時パスワードの利用者が 4 経路に届かないこと。利用者をまたいだ読み書きが起きないこと。
