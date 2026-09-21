---
graph_node_id: "arch-classify-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "明細仕分け — 既存の認証とフェンスの内側に置く新経路と利用者単位の区切り"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "auth"]
file_path: "architecture/classify-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0380be1d0882724cbfb1302956f76a9aeb05544ee6c9dfb8f71fa2fb42f9c186"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "0380be1d0882724cbfb1302956f76a9aeb05544ee6c9dfb8f71fa2fb42f9c186", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/schema-guard.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/deletions.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G3", "G5"]
---

# Architecture overview

明細仕分け — 既存の認証とフェンスの内側に置く新経路と利用者単位の区切り。`system-spec/auth.md` は承認時入力、本書は認証境界と利用者単位の認可の制約を持つ。経路の契約の正本は `specs/spec-classify-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` の 102-106 行で `app.use('/api/*', ...)` により `authGuard()` → `mustChangePasswordFence()` → `runtimeSchemaGuard` → `canonicalMutationFence()` の順に登録し、その後 115 行で `classifyRoute` を、112 行で `deletionsRoute` を載せている。セッションは `kanjo_session` Cookie で、`users.session_generation` の更新で無効化される。既存の classify route は `c.get('userId')` で利用者を取り、全ての SQL を `user_id` で絞っている。テナントは `TENANT_ID='default'` の単一 (qa-classify-auth-web-evidence-001)。
- Quality attribute priorities: G3・G5 に資する。OWASP ASVS の authentication (既存のセッション Cookie にそのまま乗せる) と security (利用者単位でデータを閉じ、所有していない行は存在しないものとして扱う) を適用する。
- Constraints: 新しい認証方式を作らない。利用者 id はセッションから取り、要求の本文や URL からは受け取らない (qa-classify-auth-web-001)。

## Goals and non-goals

- Goals:
  - G3: 一括保存・ルールのプレビューと適用を `/api/*` の認証とフェンスの並びの内側に置き、パスワード変更が必要な利用者は `mustChangePasswordFence` で届かない状態にする。
  - G5: 保存フィルタ・取引の履歴・ルールの読み書きを `user_id` で区切り、他の利用者の行を読めない・書けない状態にする。下書きは端末の localStorage に置き、保存成功で消して共有端末に残し続けない (qa-classify-decision-004)。
- Non-goals:
  - 認証方式・セッションの変更
  - 仕分け画面のための新しいログイン手段・長期トークン・API キー
  - 保存フィルタやルールを利用者間で共有する権限モデル
  - 下書きのサーバ保存

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部の認証サービスは使わない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。新経路 (一括保存・ルールのプレビューと適用・保存フィルタ・履歴) はすべて `c.get('userId')` で絞る。端末の localStorage は信頼境界の外にあり、サーバはその内容を受け取らない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` | セッション Cookie と `session_generation` を検証し、未認証は 401 | Hono ミドルウェア | packages/api | Worker |
| `mustChangePasswordFence` | 一時パスワードのままの利用者を一括保存やルール適用に届かせない | Hono ミドルウェア | packages/api | Worker |
| `runtimeSchemaGuard` | 追加 migration が未適用の環境を 503 で止める | Hono ミドルウェア | packages/api | Worker |
| `canonicalMutationFence` | 変更系の新経路を取込の洗替えと直列化する (登録の詳細は `architecture/classify-security.md`) | Hono ミドルウェア | packages/api | Worker |
| classify route の新経路 | 一括保存・ルールのプレビューと適用・保存フィルタ・履歴を利用者本人の行だけで処理する | classifyRoute | packages/api | Worker |
| 既存の削除と取消 | 明細の削除と元に戻すを既存の `/data/deletions`・`/data/undo/:operationId` で行う | deletionsRoute | packages/api | Worker |
| 端末の下書き | 編集パネルの入力途中の値を明細単位で保持する | localStorage | 利用者の端末 | ブラウザ |

## Cross-cutting contracts

- Identity/access: 新経路はすべて `/api/*` のミドルウェアの並びの後 (`classifyRoute` の中) に載せる。利用者 id は `c.get('userId')` だけから取る。
- Errors/resilience: 未認証は 401、一時パスワードは既存のフェンスの応答、未適用のスキーマは 503。他の利用者の保存フィルタや明細を id で指したときは存在を漏らさないため 404 を返し、一括保存では明細単位の失敗 (`not_found`) として返して要求全体は止めない (agent 推定・利用者未確認、根拠 qa-classify-auth-web-002)。
- Observability/audit: N/A: 認証の監査に新しい信号を追加しない。明細の変更の記録は取引の履歴 (`architecture/classify-database.md`) が担う。
- Configuration/secrets: 新しい秘密情報・鍵を持たない。
- Compatibility/versioning: 既存のログイン・セッション・`session_generation` の契約は不変。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/classify-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 利用者の明細の手当て (区分・カテゴリ・所有者・支払方法・メモ)・分割・ルール・保存フィルタ・取引の履歴。いずれも個人の家計と事業の取引内容で、利用者本人だけが読める。
- Actors/adversaries/abuse cases: ログイン済みの別の利用者が明細 id・フィルタ id・ルール id を推測して他人の行を読む・書く。一時パスワードのままの利用者が一括保存で大量に書く。共有端末の次の利用者が前の利用者の下書きを読む。
- Trust boundaries/data flows: ブラウザ → `/api/*` (認証・フェンス) → classify route → D1。下書きはブラウザの localStorage に閉じ、サーバへ送らない。

#### Identity and authorization

- Authentication/session/federation: 既存の `kanjo_session` Cookie と `session_generation` による無効化をそのまま使う。新経路のための例外経路・公開経路を作らない。
- Authorization model and deny-by-default rules: 利用者本人のデータだけを読み書きできる。ロールや管理者権限を追加しない。所有していない行は存在しないものとして扱う。
- Tenant/resource ownership enforcement: 新しい表 (`saved_filters`・`tx_history`) は `user_id` を主キーか索引の先頭に持ち、route の SQL は必ず `WHERE user_id = ?` を付ける。一括保存では明細ごとに同じ規則を当て、他人の明細 id はその明細だけの `not_found` にする (agent 推定・利用者未確認、根拠 qa-classify-auth-web-002)。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: 既存の HTTPS と D1 の保管に従う。新しい鍵を持たない。
- Secret source/rotation/redaction: 新経路は資格情報・トークンを受け取らず、応答にも含めない。
- Retention/deletion/privacy requests: 下書きは保存成功で消し、端末に残し続けない (qa-classify-decision-004)。保存フィルタは利用者が削除できる。

#### Application and supply-chain controls

- Input/output validation and injection defenses: 利用者 id を本文・URL から受け取らない。入力検証と長さの上限は `architecture/classify-security.md` に従う。
- Dependency/artifact provenance/signing/SBOM: 認証のための新しい依存を追加しない。
- CI/CD branch/review/environment protections: 既存の CI とデプロイの手順に従う。

#### Detection and response

- Audit events/security telemetry/alerts: N/A: 認証の監査信号を追加しない。
- Incident response/revocation/recovery: セッションの無効化は既存の `session_generation` の更新で行う。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

API 統合テストで、新経路のすべてで未認証が 401 になること、一時パスワードの利用者が一括保存・ルール適用に届かないこと、利用者 A の保存フィルタ・履歴・ルール・明細が利用者 B から読めない・書けないこと (id 指定は 404、一括保存では明細単位の `not_found`) を確かめる。新経路が `index.ts` の並びの後に登録されていることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-auth-web-001 | 新経路を `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` の内側 (`classifyRoute`) に置く | 経路ごとに個別の認証を書く | 既存の classify 経路と同じ保護を漏れなく受ける | 登録順を変えると保護が外れるため、未認証 401 のテストで固定する |
| qa-classify-auth-web-001 | 利用者 id はセッションからだけ取り、本文・URL から受け取らない | 本文に利用者 id を載せる | なりすましの入口を作らない | 利用者をまたぐ操作は構造的にできない |
| qa-classify-auth-web-001 | 保存フィルタ・履歴・ルールを `user_id` で区切る | 世帯で共有する | 他の利用者の作業状態が混ざらない | 保存フィルタは利用者ごとに持つ |
| qa-classify-auth-web-002 | 他人の行の id 指定は 403 ではなく 404、一括保存では明細単位の `not_found` (agent 推定・利用者未確認) | 403 を返す / 要求全体を 403 で止める | 存在を漏らさず、部分失敗の契約 (G3) とも揃う | 一括保存の応答に `not_found` が混ざりうる |
| qa-classify-decision-004 | 下書きは端末の localStorage に置き、保存成功で消す | 下書きを D1 に置く | サーバに書込が増えず、共有端末に残し続けない | 下書きは端末をまたがない |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono)。認証基盤の変更は無い。
- Migration sequence: 追加 migration の反映 → 新経路の `classifyRoute` への登録 → 認可の API 統合テスト。
- Rollback trigger/procedure: 認可テストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。追加 migration は残しても既存の経路に影響しない。

## Risks and verification

- Risk/assumption: 新しい route ファイルを作って `index.ts` の並びの前に登録すると認証が効かない。新経路は既存の `classifyRoute` か、並びの後に載せる route に置き、未認証 401 のテストで検出する。
- Risk/assumption: 一括保存で明細 id を `IN (...)` でまとめて読むとき、`user_id` の条件を落とすと他人の明細が成功扱いになる。明細ごとの結果を返す前に所有を確かめる。
- Architecture fitness test: 新経路のすべてで未認証が 401 になること。`saved_filters`・`tx_history`・`rules` への読み書きが `user_id` の条件を必ず含むこと。
- Load/failure/security validation: 一時パスワードの利用者が新経路に届かないこと。利用者をまたいだ読み書きが起きないこと。
