---
graph_node_id: "arch-settings-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "設定 — 既存の認証と 4 層の内側に置き、書込みだけをフェンスへ登録し更新者をセッションから決める"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "auth"]
file_path: "architecture/settings-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "1968df8fa1eed625d5ba1376decf22c7c0a3e636d0e0ecda927fce14049294ff"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "1968df8fa1eed625d5ba1376decf22c7c0a3e636d0e0ecda927fce14049294ff", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/schema-guard.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/imports.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/pages/settings/"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G3", "G5"]
---

# Architecture overview

設定 — 既存の認証と 4 層の内側に置き、書込みだけをフェンスへ登録し更新者をセッションから決める。`system-spec/auth.md` は承認時入力、本書は認証境界・書込みフェンスへの登録の区分・更新者の決め方・復元の権限の制約を持つ。確定内容の正本は qa-settings-auth-web-003 と決定 qa-settings-decision-001〜010。経路の契約の正本は `specs/spec-settings-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` で `app.use('/api/*', ...)` により `authGuard()` → `mustChangePasswordFence()` → `runtimeSchemaGuard` → `canonicalMutationFence()` の順に掛かり、その後に各 route を載せる (既存の設定の経路は `settingsRoute`)。`authGuard` (`packages/api/src/auth.ts`) は Access JWT かセッション Cookie (`kanjo_session`、SameSite=Strict) を検証し、`userId` (単一テナントの `default`) と `actor` を set する。`adminGuard` がある。既存の `PUT /api/settings` は `CANONICAL_MUTATION_ROUTES` に登録済み。既存の全データ置換 `POST /api/restore` (`routes/imports.ts`) は admin 限定ではなく、フェンスでは `self-managed-import` として取込と同じ lease を自前で取る (qa-settings-auth-web-evidence-001)。
- Quality attribute priorities: G3・G5 に資する。OWASP ASVS の authentication (新しい設定 API をすべて既存のセッション検証とパスワード変更強制の内側に置き、未認証は 401) と security (設定の保存と復元を書込みフェンスへ登録し、復元の権限は既存の `/restore` と同じに留める、ASVS V8 認可) を適用する (https://owasp.org/www-project-application-security-verification-standard/)。
- Constraints: 新しい認証方式を作らない。単一テナント (`TENANT_ID=default`) の前提を変えない (C5)。画像外の既存機能 (パスワード変更・利用者管理) の権限を変えない (qa-settings-auth-web-003)。

## Goals and non-goals

- Goals:
  - G5: 設定系の新 API をすべて `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` の内側に置き、未認証は 401 にする (qa-settings-auth-web-003)。
  - G5: 書込み API (全節の保存・設定の復元・バックアップからの設定の復元) はすべて `CANONICAL_MUTATION_ROUTES` に登録し、読むだけの API (画面の取得・元に戻す用の直前値・書き出し・差分プレビュー・比較・一覧) は登録しない (qa-settings-auth-web-003)。
  - G3: 変更履歴の更新者をセッションの `actor` から決め、要求本文の値を使わない。復元や移行で入った値の更新者は『システム』とする (qa-settings-decision-008)。
- Non-goals:
  - 認証方式・セッション・`session_generation` の変更
  - 設定の復元のための新しい権限 (管理者限定化を含む) やロール
  - 複数テナント化 (U7 対象外)
  - パスワード変更・利用者管理の権限の変更

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人 (同じテナントの家族を含む)。外部の認証サービスは既存の Access JWT 以外に使わない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。認可の単位はテナント (`c.get('userId')`)、更新者の記録は `c.get('actor')`。設定 JSON のファイルとバックアップ本文は信頼境界の外から来る入力として扱う (`architecture/settings-security.md`)。端末の下書きは localStorage に閉じる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` | セッション Cookie か Access JWT を検証し、未認証は 401。`userId` と `actor` を set する | Hono ミドルウェア | packages/api | Worker |
| `mustChangePasswordFence` | 一時パスワードのままの利用者を設定の取得・保存・復元に届かせない | Hono ミドルウェア | packages/api | Worker |
| `runtimeSchemaGuard` | 追加 migration が未適用の環境を 503 で止める | Hono ミドルウェア | packages/api | Worker |
| `canonicalMutationFence` | 設定の書込み 3 種を取込の洗替えと直列化する (登録の詳細は下記と `architecture/settings-security.md`) | Hono ミドルウェア | packages/api | Worker |
| 設定の route (`routes/settings.ts` の拡張) | 画面の取得・保存・直前値・書き出し・復元・プレビュー・一覧・比較をテナントの行だけで処理する | Hono route | packages/api | Worker |
| 変更履歴の追記 | 更新者を `actor` から、復元・移行では『システム』として書く | D1 batch 内の INSERT | packages/api | Worker |
| ログアウト (`Layout.tsx`) | 設定の下書きを含む端末の下書きを消す | React | packages/web | ブラウザ |

## Cross-cutting contracts

- Identity/access: 新しい route は `index.ts` のミドルウェアの並びの後に載せる。テナントは `c.get('userId')`、更新者は `c.get('actor')` だけから取り、本文・URL から受け取らない。
- 書込みフェンスの区分: 登録する = `PUT /api/settings/screen`・`POST /api/settings/restore`・`POST /api/backups/:date/restore`。登録しない = `GET /api/settings/screen`・`GET /api/settings/history`・`GET /api/settings/export`・`POST /api/settings/restore/preview`・`GET /api/backups`・`GET /api/backups/:date/compare`・`POST /api/backups/:date/restore/preview`。区分は確定 (qa-settings-auth-web-003)、パスの字面は agent 推定・利用者未確認 (根拠 qa-settings-backend-web-004)。差分プレビューは POST だが読むだけなので登録しない (agent 推定・利用者未確認、根拠 qa-settings-auth-web-004)。
- Errors/resilience: 未認証は 401、一時パスワードは既存のフェンスの応答、未適用のスキーマは 503、フェンスの競合は 409 `canonical_write_busy`。
- Observability/audit: 設定の変更は追記のみの変更履歴に更新者・日時つきで残す (qa-settings-decision-008)。認証の監査信号は増やさない。
- Configuration/secrets: 新しい秘密情報・鍵を持たない。
- Compatibility/versioning: 既存の `PUT /api/settings`・`/api/settings/owner-labels`・`POST /api/restore` の認可とフェンスの扱いは互換のため変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/settings-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/settings-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 設定 (集計ルール・名義の表示名・統計の最小月数・現金上書き) と、その変更履歴 (変更前・変更後・更新者・日時)。取引データは設定の復元の対象外だが、集計ルールの誤りは集計の前提を黙って壊しうる。
- Actors/adversaries/abuse cases: 未ログインの第三者が設定 API を直打ちする。一時パスワードのままの利用者が設定を書く・戻す。家族の 1 人が古い画面から保存して他の人の更新を上書きする (baseSavedAt の 409 で防ぐ、`architecture/settings-backend.md`)。本文に更新者名を入れて履歴を偽る。
- Trust boundaries/data flows: ブラウザ → `/api/*` (4 層) → 設定の route → D1 (設定の表と変更履歴)。バックアップからの復元は R2 → 設定の route → D1。

#### Identity and authorization

- Authentication/session/federation: 既存の `kanjo_session` Cookie と Access JWT をそのまま使う。設定の経路のための例外経路・公開経路・長期トークンを作らない。
- Authorization model and deny-by-default rules: ログイン済みでパスワード変更の済んだ利用者が、同じテナントの設定を読み書き・復元できる。設定の復元とバックアップからの設定の復元の権限は既存の `/restore` と同じに留め、管理者限定にしない (agent 推定・利用者未確認、根拠 qa-settings-auth-web-004)。利用者管理 (`adminGuard`) の権限は変えない。
- Tenant/resource ownership enforcement: 設定の新表は主キーの先頭を利用者 (テナント) にし (`architecture/settings-database.md`)、route の SQL は `WHERE user_id = ?` を必ず付ける。本文にテナントや更新者の欄を持たせない。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: 既存の HTTPS・D1・R2 の保管に従う。新しい鍵を持たない。
- Secret source/rotation/redaction: 設定の経路は資格情報・トークンを受け取らず、応答・書き出し・変更履歴にも含めない。
- Retention/deletion/privacy requests: 更新者の表示名は `actor` のメールアドレスのローカル部とする (agent 推定・利用者未確認、根拠 qa-settings-auth-web-002)。下書きのキーは `kanjo:settings:draft:{userId}` とし、ログアウトで消す (agent 推定・利用者未確認、根拠 qa-settings-frontend-web-002・-004)。

#### Application and supply-chain controls

- Input/output validation and injection defenses: 本文の検証・本文上限・復元の厳密検証は `architecture/settings-security.md` に従う。
- Dependency/artifact provenance/signing/SBOM: 認証のための新しい依存を足さない。
- CI/CD branch/review/environment protections: 既存の CI とデプロイの手順に従う。

#### Detection and response

- Audit events/security telemetry/alerts: 設定の変更は変更履歴に残る。認証の監査信号は追加しない。
- Incident response/revocation/recovery: セッションの無効化は既存の `session_generation` の更新で行う。誤った設定は『元に戻す』か設定 JSON の復元で直す (`architecture/settings-maintenance-ops.md`)。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

API 統合テストで、設定系の新 API のすべてで未認証が 401 になること、一時パスワードの利用者が保存・復元に届かないこと、書込み 3 種が `classifyCanonicalMutation` で `canonical-mutation`、読むだけの 7 種が `not-canonical-mutation` に分類されることを確かめる。本文に更新者名を入れても変更履歴の更新者が `actor` 由来になり、復元で入った行の更新者が『システム』になることを確かめる。DOM テストでログアウト後に設定の下書きが残らないことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-auth-web-003 | 設定系の新 API を 4 層の内側に置き、未認証は 401 | 経路ごとに個別の認証を書く | 既存の設定の経路と同じ保護を漏れなく受ける | 登録順を変えると保護が外れるため、未認証 401 のテストで固定する |
| qa-settings-auth-web-003 | 書込み 3 種だけを `CANONICAL_MUTATION_ROUTES` に登録し、読むだけの API は登録しない | 設定の経路をすべて登録する | 読取りが取込の lease を待たず、登録漏れは書込みの一覧で見つかる | 書込みの経路を足すときは登録とテストを同じ変更で更新する |
| qa-settings-decision-008 | 更新者はセッションの `actor`、復元・移行は『システム』 | 本文の更新者名を使う | 履歴の更新者を偽れない | 本文に更新者の欄を持たない |
| qa-settings-auth-web-004 | 復元の権限は既存の `/restore` と同じ (agent 推定・利用者未確認) | 管理者限定にする | 単一テナントで家族が同じ設定を使う現状に合う | 復元前の自動退避と差分プレビューで誤操作を戻せるようにする |
| qa-settings-auth-web-004 | 差分プレビューは POST だがフェンスに登録しない (agent 推定・利用者未確認) | POST をすべて登録する | 何も書かない要求が取込の間に 409 で止まらない | プレビューの route が書込みを持たないことをテストで固定する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono)。認証基盤の変更は無い。
- Migration sequence: 追加 migration の反映 → 設定の新 route を並びの後に登録 → `CANONICAL_MUTATION_ROUTES` に書込み 3 種を追加し登録ルート数のテストを更新 → ログアウトでの設定の下書き消去 → 認可の API 統合テストと DOM テスト。
- Rollback trigger/procedure: 認可テストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。追加 migration は残しても既存の経路に影響しない。

## Risks and verification

- Risk/assumption: `/api/backups/:date/restore` を登録し忘れると、バックアップからの設定の復元が取込の洗替えと重なる。書込み 3 種の分類テストで検出する。
- Risk/assumption: 登録は正規表現で照合するため、`/restore` の登録を `$` で閉じないと `/restore/preview` (読むだけ) まで書込みとして 409 に巻き込む。既存の `POST /api/restore` は完全一致の `self-managed-import` で、新しい経路とは分けたまま残す。
- Risk/assumption: 更新者の表示名にメールアドレスのローカル部を使うと、画面にメールの一部が出る。単一テナント内の表示に留まる前提で、実装時に利用者へ確かめる。
- Architecture fitness test: 設定系の新 API のすべてで未認証が 401 になること。書込み 3 種だけがフェンスに登録されていること。
- Load/failure/security validation: 一時パスワードの利用者が保存・復元に届かないこと。更新者が本文から決まらないこと。
