---
graph_node_id: "arch-subscriptions-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "サブスク画面 — 新設 4 経路を既存 authGuard の内側に置き userId と組で引く"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "auth"]
file_path: "architecture/subscriptions-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "bbbdb0f3f20821bab23f4630cf52590be216844fc88f52cdfc9b298128b2af5c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "bbbdb0f3f20821bab23f4630cf52590be216844fc88f52cdfc9b298128b2af5c", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/routes/subs.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/subs-vendor-scope.test.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G2", "G5"]
---
# Architecture overview

サブスク画面 — 新設 4 経路を既存 authGuard の内側に置き userId と組で引く。`system-spec/auth.md` は承認時入力、本書は security (認証・認可) 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts:102` が `/api/*` に `authGuard()`、:104 が `mustChangePasswordFence()` を掛け、その後で `analyticsRoute` (:114) と `subsRoute` (:118) をマウントしている。既存のサブスク経路 (`packages/api/src/routes/subs.ts`) は全て `c.get('userId')` を条件に含め、`PUT /sub-vendors/:id` は userId の一覧から id を探して無ければ 404 (:117-119)、`DELETE` は `and(userId, id)` の削除件数 0 で 404 (:142-149) を返す。スコープの回帰は `packages/api/src/subs-vendor-scope.test.ts` が持つ。本サイクルが足すのは GET /api/subscriptions/vendors/:key、POST /api/sub-vendors/:id/aliases、POST / DELETE /api/subscriptions/review-decisions の 4 経路と、PUT /api/sub-vendors/:id の category であり、利用者の識別・資格情報・セッションの扱いは増えない。
- Quality attribute priorities: G2・G5 に資する。OWASP ASVS の『全ての保護資源で認証を強制する』とアクセス制御 (他利用者のデータに触れない、オブジェクト単位の認可) を適用する。
- Constraints: 単独利用者の個人事業主向け。外部 IdP を追加しない。PBKDF2 など既存の資格情報処理に触れない。

## Goals and non-goals

- Goals:
  - G2: 詳細パネルの取得と統合・確認・カテゴリ変更の操作 (spec §6, §10, §13) を、既存の認証と userId 絞りの内側で提供する。
  - G5: 旧 UI の操作 (登録・別名・対象科目・見直し・除外) を移しても、同じ認可の境界を保つ。
- Non-goals:
  - 認証方式・セッション・パスワード変更フローの変更
  - 共有・複数利用者向けの権限モデル

## System context and boundaries

- Users/external systems: 単独の利用者。外部 IdP を追加しない。
- Trust/deployment/data boundaries: `/subscriptions` と新設 4 経路は保護対象。未ログイン時は既存のログイン画面へ送り、一時パスワードのままなら業務データへ触らせない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard (`/api/*`) | 未認証の拒否と userId の確定 | Hono middleware | packages/api | Worker |
| mustChangePasswordFence (`/api/*`) | 一時パスワードのままの業務データ操作を拒否 | Hono middleware | packages/api | Worker |
| analyticsRoute | GET /api/subscriptions、GET /api/subscriptions/vendors/:key、review-decisions (配置は backend の判断に従う) | Hono route | packages/api | Worker |
| subsRoute | PUT /api/sub-vendors/:id (category)、POST /api/sub-vendors/:id/aliases、既存の登録・除外 | Hono route | packages/api | Worker |
| userId 絞りの読み書き | `:id` / `:key` を userId と組で引く | Drizzle 条件 | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 新設経路は既存 subsRoute / analyticsRoute に足し、`index.ts:102,104` の guard の後でマウントされる位置から動かさない。全ての読み書きの条件に `c.get('userId')` を含める。`:id` / `:key` を利用者の同定に使わない。
- Errors/resilience: 他利用者の `:id` / `:key` と存在しない `:id` / `:key` は同じ 404 を返し、存在の有無を応答の差から推測させない。
- Observability/audit: 認証に関する監査項目を増やさない。
- Configuration/secrets: 資格情報・秘密情報を追加しない。
- Compatibility/versioning: 既存経路の認可の扱い (userId 絞り・404) を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Authentication boundary

新設 4 経路と PUT の拡張は、既存 `/api/*` の authGuard と mustChangePasswordFence の内側に置く。新しい route インスタンスを作らず、既存の subsRoute / analyticsRoute に足すことで、マウント位置の誤りで guard の外へ出る余地を作らない。

#### Authorization model

オブジェクト単位の認可は userId との組で行う。`POST /api/sub-vendors/:id/aliases` は userId の登録ベンダーから `:id` を探し、無ければ 404。`GET /api/subscriptions/vendors/:key` は userId の明細・登録だけから詳細を作り、当たらなければ 404。review-decisions は `(user_id, vendor_key)` で upsert / 削除し、他利用者の行に触れない。未登録候補の採用 (POST /api/sub-vendors) と除外 (POST /api/sub-vendors/exclusions) は既存の経路と認可をそのまま使う。

#### Credential handling

本サイクルは資格情報を扱わない。

#### Security verification

API テストで、新設 4 経路が未認証で拒否されること、一時パスワードのままで拒否されること、他利用者の `:id` / `:key` が 404 になることを確かめる (`subs-vendor-scope.test.ts` と同じ形)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-subs-auth-web-004 | 新設 4 経路を既存 subsRoute / analyticsRoute に足し、authGuard と mustChangePasswordFence の内側に置く | 新しい route を別にマウント | マウント位置の誤りで guard の外へ出る余地を作らない | 経路の置き場所が既存 2 ファイルに限られる |
| qa-subs-auth-web-004 | `:id` / `:key` は userId と組で引き、見つからなければ 404 | 403 と 404 を分ける | 存在の有無を応答の差から推測させない | 他利用者と不在を区別しない |
| dec-subs-persistence | 保存先は既存表の延長と判断表で、全て user_id を持つ | 共有表 | 既存の userId 絞りの形をそのまま使える | 判断表も `(user_id, vendor_key)` 一意 |
| dec-subs-category | カテゴリの上書きは userId の登録ベンダーにだけ書く | 利用者横断の辞書を書き換える | 他利用者の表示に影響させない | 既定辞書は core の定数で、利用者から書き換えない |
| dec-subs-legacy-ui | 旧 UI の操作を詳細パネルへ移しても、呼ぶ経路と認可は既存のまま | 移設時に経路を作り直す | 認可の回帰を増やさない | 旧テストの認可ケースを引き継ぐ |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。認証構成の変更なし。
- Migration sequence: 既存 route への経路追加 (guard の内側) → userId との組による `:id` / `:key` の解決 → 404 の応答契約 → スコープのテスト追加。
- Improvement (既存実装の是正): `:id` の検査が経路ごとに揃っていない (`subs.ts:223` の POST /:id/review だけが `Number.isInteger` で 400、PUT :115 と DELETE :141 は `Number()` の NaN のまま検索して 404)。新設の aliases 経路は 400 の検査を持たせ、既存経路も同じ扱いへ揃える。
- Rollback trigger/procedure: 認証・スコープのテストが落ちたら差し戻し。資格情報に触れないためデータの巻き戻しは不要。

## Risks and verification

- Risk/assumption: 新設経路を guard の前にマウントすると、明細や取引名が無認証で露出する。既存 route に足す方針とマウント位置のテストで塞ぐ。
- Risk/assumption: `:key` は照合キー (正規化したベンダー名) なので推測できる。userId との組で引く限り他利用者のデータには届かない。
- Architecture fitness test: 新設 4 経路が authGuard と mustChangePasswordFence の内側にあること。全ての条件式に userId が含まれていること。
- Load/failure/security validation: 未認証リクエストが拒否されること。他利用者の `:id` / `:key` が 404 であること。既存ログインの回帰テストが緑であること。
