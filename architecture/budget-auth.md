---
graph_node_id: "arch-budget-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "予算 — 既存の認証とフェンスの内側に置く取得・保存と利用者単位の区切り"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "auth"]
file_path: "architecture/budget-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8bac5a1830455e332c0527f6ffc5c1aa3d6d49387e3d8b3ec611a14c17fd101f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "8bac5a1830455e332c0527f6ffc5c1aa3d6d49387e3d8b3ec611a14c17fd101f", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/schema-guard.ts", "packages/api/src/routes/budget-plans.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/pages/budget/"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G3"]
---

# Architecture overview

予算 — 既存の認証とフェンスの内側に置く取得・保存と利用者単位の区切り。`system-spec/auth.md` は承認時入力、本書は認証境界・利用者単位の認可・端末の下書きの消去の制約を持つ。経路の契約の正本は `specs/spec-budget-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` の 104〜108 行目で `app.use('/api/*', ...)` により `authGuard()` → `mustChangePasswordFence()` → `runtimeSchemaGuard` → `canonicalMutationFence()` の順に掛かり、その後に各 route を載せる (既存の予算の経路は 121 行目の `settingsRoute`)。セッションは `kanjo_session` Cookie で、`users.session_generation` の更新で無効化される。既存の予算の route は `c.get('userId')` で利用者を取り、SQL を `user_id` で絞る。テナントは単一 (qa-budget-auth-web-evidence-001)。ログアウトは `packages/web/src/components/Layout.tsx` の `logout` (143 行目) で、決算書の負債の下書きを `clearAllLiabilityDrafts()` で消している。
- Quality attribute priorities: G3 に資する。OWASP ASVS の authentication (既存のセッション Cookie にそのまま乗せる) と security (予算の取得と保存の全 SQL を利用者で区切り、利用者 id を本文から受け取らない) を適用する。
- Constraints: 新しい認証方式を作らない。利用者 id はセッションから取り、要求の本文や URL からは受け取らない (qa-budget-auth-web-001)。

## Goals and non-goals

- Goals:
  - G3: 画面用の取得 (`GET /api/budget-screen`) と予算の保存 (`PUT /api/budget-plans`) を `/api/*` の認証とフェンスの並びの内側に置き、パスワード変更が必要な利用者は `mustChangePasswordFence` で保存に届かない状態にする。
  - G3: `budget_plans` の読み書きを `user_id` で区切り、他の利用者の予算を読めない・書けない状態にする。
  - G3: 端末の下書き (`kanjo:budget:draft:` で始まるキー) を保存成功とログアウトで消し、共有端末に他人の入力を残さない (qa-budget-decision-001)。
- Non-goals:
  - 認証方式・セッションの変更
  - 予算画面のための新しいログイン手段・長期トークン・API キー
  - 予算を利用者間・世帯で共有する権限モデル
  - 下書きのサーバ保存

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部の認証サービスは使わない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。新経路は `c.get('userId')` で絞る。端末の localStorage は信頼境界の外にあり、サーバはその内容を保存操作の本文としてだけ受け取る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` | セッション Cookie と `session_generation` を検証し、未認証は 401 | Hono ミドルウェア | packages/api | Worker |
| `mustChangePasswordFence` | 一時パスワードのままの利用者を予算の取得・保存に届かせない | Hono ミドルウェア | packages/api | Worker |
| `runtimeSchemaGuard` | 追加 migration が未適用の環境を 503 で止める | Hono ミドルウェア | packages/api | Worker |
| `canonicalMutationFence` | 予算の保存を取込の洗替えと直列化する (登録の詳細は `architecture/budget-security.md`) | Hono ミドルウェア | packages/api | Worker |
| 予算の route (`budget-plans.ts` 予定) | 画面用の取得と予算の保存を利用者本人の行だけで処理する | Hono route | packages/api | Worker |
| ログアウト (`Layout.tsx`) | 予算の下書きを含む端末の下書きを消す | React | packages/web | ブラウザ |
| 端末の下書き | 予算対象ごとの入力途中の値 (計画による調整の理由を含む) を保持する | localStorage | 利用者の端末 | ブラウザ |

## Cross-cutting contracts

- Identity/access: 新しい route は `index.ts` のミドルウェアの並びの後に載せる。利用者 id は `c.get('userId')` だけから取る。
- Errors/resilience: 未認証は 401、一時パスワードは既存のフェンスの応答、未適用のスキーマは 503。他の利用者の予算は存在しないものとして扱い、読取りは空の予算 (初期値) を返し、書込みは自分の dirty 行だけを差分更新する。
- Observability/audit: N/A: 認証の監査に新しい信号を追加しない。
- Configuration/secrets: 新しい秘密情報・鍵を持たない。
- Compatibility/versioning: 既存のログイン・セッション・`session_generation` の契約は不変。旧 `/api/budgets` 系の認可も不変。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/budget-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 利用者の事業の予算 (科目別の年額・計画による調整額・調整の理由) と、算出の入力になる取込データ。調整の理由には採用・値上げなど事業の計画が入りうる。
- Actors/adversaries/abuse cases: ログイン済みの別の利用者が予算対象の開始月を変えて他人の予算を読む・上書きする。一時パスワードのままの利用者が予算を書く。共有端末の次の利用者が前の利用者の下書き (調整の理由) を読む。
- Trust boundaries/data flows: ブラウザ → `/api/*` (認証・フェンス) → 予算の route → D1。下書きはブラウザの localStorage に閉じ、保存操作でだけサーバへ送る。

#### Identity and authorization

- Authentication/session/federation: 既存の `kanjo_session` Cookie と `session_generation` による無効化をそのまま使う。予算の経路のための例外経路・公開経路を作らない。
- Authorization model and deny-by-default rules: 利用者本人の予算だけを読み書きできる。ロールや管理者権限を追加しない。
- Tenant/resource ownership enforcement: `budget_plans` は `user_id` を主キーの先頭に持ち、route の SQL は必ず `WHERE user_id = ?` を付ける。保存の DELETE も `user_id` と予算対象の開始月の両方で絞り、他人の行を消せない。本文に利用者 id の欄を持たせない。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: 既存の HTTPS と D1 の保管に従う。新しい鍵を持たない。
- Secret source/rotation/redaction: 予算の経路は資格情報・トークンを受け取らず、応答にも含めない。
- Retention/deletion/privacy requests: 下書きは保存成功とログアウトで消す。ログアウトでは `kanjo:budget:draft:` で始まるキーをすべて消す (agent 推定・利用者未確認、根拠 qa-budget-auth-web-002)。下書きは 30 日で捨てる (`architecture/budget-frontend.md`)。

#### Application and supply-chain controls

- Input/output validation and injection defenses: 利用者 id を本文・URL から受け取らない。入力検証と長さ・行数の上限は `architecture/budget-security.md` に従う。
- Dependency/artifact provenance/signing/SBOM: 認証のための新しい依存を追加しない。
- CI/CD branch/review/environment protections: 既存の CI とデプロイの手順に従う。

#### Detection and response

- Audit events/security telemetry/alerts: N/A: 認証の監査信号を追加しない。
- Incident response/revocation/recovery: セッションの無効化は既存の `session_generation` の更新で行う。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

API 統合テストで、`GET /api/budget-screen` と `PUT /api/budget-plans` の未認証が 401 になること、一時パスワードの利用者が保存に届かないこと、利用者 A の予算が利用者 B から読めない (B には初期値が返る)・上書きできないことを確かめる。DOM テストでログアウト後に予算の下書きが残らないことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-auth-web-001 | 予算の経路を `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` の内側に置く | 経路ごとに個別の認証を書く | 既存の予算の経路と同じ保護を漏れなく受ける | 登録順を変えると保護が外れるため、未認証 401 のテストで固定する |
| qa-budget-auth-web-001 | 利用者 id はセッションからだけ取り、本文・URL から受け取らない | 本文に利用者 id を載せる | なりすましの入口を作らない | 利用者をまたぐ保存は構造的にできない |
| qa-budget-auth-web-001 | `budget_plans` を利用者で区切る (主キーの先頭に `user_id`) | 世帯で共有する | 他の利用者の予算が混ざらない | 予算は利用者ごとに持つ |
| qa-budget-auth-web-002 | 他人の予算は存在しないものとして扱い、読取りは初期値、書込みは自分の行だけ (agent 推定・利用者未確認) | 403 を返す | 存在を漏らさず、取得の形を 1 つに保てる | 予算の無い利用者と他人の予算を指した利用者の応答が同じになる |
| qa-budget-decision-001 | 下書きは端末の localStorage に置き、保存成功とログアウトで消す | 下書きを D1 に置く | サーバの書込を増やさず、共有端末に残し続けない | 下書きは端末をまたがない |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono)。認証基盤の変更は無い。
- Migration sequence: 追加 migration の反映 → 予算の route を並びの後に登録 → ログアウトでの下書き消去 → 認可の API 統合テストと DOM テスト。
- Rollback trigger/procedure: 認可テストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。追加 migration は残しても既存の経路に影響しない。

## Risks and verification

- Risk/assumption: 新しい route ファイルを `index.ts` のミドルウェアの並びより前に登録すると認証が効かない。未認証 401 のテストで検出する。
- Risk/assumption: ログアウトの下書き消去を予算画面の中に置くと、予算画面を開かずにログアウトしたときに消えない。消去は `Layout.tsx` の `logout` から呼ぶ。
- Architecture fitness test: 予算の経路のすべてで未認証が 401 になること。`budget_plans` への読み書きが `user_id` の条件を必ず含むこと。
- Load/failure/security validation: 一時パスワードの利用者が予算の保存に届かないこと。利用者をまたいだ読み書きが起きないこと。
