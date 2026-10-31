---
graph_node_id: "arch-login-v2-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "ログイン v2 — 認証の表・招待・MFA 設定トークンを追加のみの migration で業務データから分けて置く"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "database"]
file_path: "architecture/login-v2-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "97ea39db385a3a25db26a59937488b68cefd4f95b997cf3ef6278e2fe2544e7c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "97ea39db385a3a25db26a59937488b68cefd4f95b997cf3ef6278e2fe2544e7c", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/users.ts", "packages/api/src/audit-log.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/deletion-full-reset.ts", "docs/data-schema.md"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G2", "G3", "G5", "G7"]
---

# Architecture overview

ログイン v2 — 認証の表・招待・MFA 設定トークンを追加のみの migration で業務データから分けて置く。`system-spec/database.md` (確定セル database.web、主根拠 qa-login-v2-database-web-003) が承認時入力で、本書は認証の表の置き場所・既存 users の複写・トークンの保存形式・1 回限りの消費の整合の制約を持つ。仕様ノード `spec-login-v2` が本書の上流である。

凡例: 「(agent 推定・利用者未確認、根拠 qa-…)」を付けた値は正本章で `agent-inference` と宣言された実装手段で、付けていない到達点は利用者決定 (user-decision) または観測事実 (evidence) である。

## Context and drivers

- Business/technical context (観測事実、qa-login-v2-database-web-evidence-001): `migrations/0039_account_login.sql` が `users` 表 (`password_hash` は `pbkdf2-sha256$` の自己記述形式、`session_generation`・`must_change_password`・`temp_password_expires_at` を持つ) と `password_login_rate_limits`、`audit_log` を作る。セッション表は無く、Cookie の中の世代番号で失効させている。最新の migration は `0047_classify_workbench.sql` で、`packages/api/src/schema-guard.ts` の `EXPECTED_D1_MIGRATION` も同じ値。業務データの表 (`packages/api/src/db/schema.ts`) は `user_id` 列を持つが、利用者の表への外部キーは張られていない。
- 旧世代との差分: 旧世代 (`architecture/account-login-database.md`) は `users` 1 表にハッシュ・世代・一時パスワードの期限を同居させた。v2 は Better Auth の表へ認証情報を移し、招待・MFA 設定トークンを別表に置き、旧 `users` と旧列は本サイクルでは残す。
- Quality attribute priorities: G2・G3・G5・G7 に資する。追加のみの schema 変更で直前版の Worker と共存させる (C3)。セッションと招待・再設定のトークンに一意索引を張り、失効はセッション行の削除で即時に効かせる (`system-spec/database.md` 上流指針 data-access)。複写の migration を何度流しても同じ結果にする (同 reliability)。
- Constraints: Cloudflare D1 (SQLite) + Drizzle。1 要求あたりのバインド変数は `packages/api/src/d1-limits.ts` の上限に従う。トークンと復旧コードは平文で保存しない。業務データの表から認証の表へ外部キーを張り足さない (qa-login-v2-database-web-003)。

## Goals and non-goals

- Goals:
  - G2: Better Auth 既定名の `user`・`session`・`account`・`verification`・`twoFactor` を新設し、既存 `users` を `INSERT ... SELECT` で複写する。既存の `users.id` を `user.id` にそのまま使い、`audit_log.actor_user_id` との対応を保つ。PBKDF2 ハッシュは `account.password` へ `pbkdf2-sha256$` 形式ごと移し、再設定を強いない (agent 推定・利用者未確認、根拠 qa-login-v2-database-web-002・-004)。
  - G3: 招待表を新設し、トークンは SHA-256 のハッシュだけを持つ。
  - G5: MFA 設定トークンの表 `mfa_setup_token` を新設し、1 回限りの消費を条件付き UPDATE で保証する (agent 推定・利用者未確認、根拠 qa-login-v2-database-web-005)。認証の表を業務データの表と分ける。
  - G7: migration は追加のみで、旧表・旧列を削除せず、旧経路へ戻せる状態を残す。
- Non-goals:
  - 既存行を書き換える migration (`UPDATE`・列の型変更・`DROP`)
  - 旧 `users` 表・`session_generation`・`must_change_password`・`temp_password_expires_at` の削除 (本サイクルでは行わない、C3)
  - 業務データの表への外部キーの追加
  - 複数テナントの表

## System context and boundaries

- Users/external systems: Better Auth (認証の表の読み書き)、api の招待・MFA 設定・連携確認の route (アプリ独自の表)、`audit-log.ts`。web は API 越しにしか触れない。
- Trust/deployment/data boundaries: 認証の文脈 (利用者・セッション・認証手段・確認用トークン・MFA・招待・MFA 設定トークン) と業務データの文脈を表で分ける。業務データの表は認証の表を参照せず、認証の表どうしの参照 (`mfa_setup_token.user_id` → `user`) は認証の文脈の中に閉じる。migration の反映は既存の `migrate.yml` が行う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 追加 migration (番号は 0048 を予定、着手時に確定) | 認証の 5 表・招待表・`mfa_setup_token` 表の作成と、既存 `users` の複写 | SQL | migrations | D1 |
| `user` / `session` / `account` / `verification` / `twoFactor` | Better Auth 既定の認証の表 | Better Auth adapter | Better Auth (packages/api) | D1 |
| `invitations` | 招待 (宛先・役割・トークンのハッシュ・期限・承諾・取消・招待者) | Drizzle | packages/api | D1 |
| `mfa_setup_token` | 管理者の MFA 設定トークン (10 分・1 回限り) | Drizzle | packages/api | D1 |
| 連携確認トークンの表 | 連携の確認メールのトークンのハッシュと期限 (置き場所は plan で決める) | Drizzle | packages/api | D1 |
| `schema-guard.ts` | `EXPECTED_D1_MIGRATION` を新しい migration に上げ、未適用なら 503 | Hono ミドルウェア | packages/api | Worker |
| 定期処理 (`scheduled-maintenance-budget.ts` の枠内) | 期限切れの `mfa_setup_token` の行を消す | cron | packages/api | Worker |

(migration の番号・招待表の列・定期処理の置き場所は agent 推定・利用者未確認。番号の根拠は qa-login-v2-database-web-002 の「0048」で、正本の観測時点の最新が 0047 であることに拠る。main の進み方で変わるため確定させない)

## Cross-cutting contracts

- Identity/access: 認証の表は Better Auth とアプリの認証 route だけが書く。業務の route は認証の表を読まない (セッションは `authGuard` が渡す)。詳細は `architecture/login-v2-auth.md`。
- Errors/resilience: 一意制約 (セッションのトークン、招待・MFA 設定トークンのハッシュ) の違反は再発行で解く。migration 未適用は `runtimeSchemaGuard` の 503。
- Observability/audit: `audit_log.actor_user_id` は既存 `users.id` と同じ値の `user.id` を指し、過去の監査行の意味を変えない。招待の作成と監査を同じ D1 batch に入れる (`architecture/login-v2-backend.md`)。
- Configuration/secrets: N/A: 表に秘密の平文を置かない。TOTP の秘密鍵は Better Auth の対称暗号で暗号化されて `twoFactor` に置かれる前提 (保存形式は plan で確かめる)。
- Compatibility/versioning: 追加の表だけで、旧 `users` を読む直前版の Worker が新しい schema の上でそのまま動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/login-v2-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/login-v2-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/login-v2-security.md`)

### Data architecture

#### Data domains and ownership

- Domains/entities/source of truth: 利用者 (`user`、移行後の正本)・セッション (`session`)・認証手段 (`account`、パスワードのハッシュと Google の連携)・確認用トークン (`verification`、再設定など Better Auth 組込み)・MFA (`twoFactor`)・招待 (`invitations`)・MFA 設定トークン (`mfa_setup_token`)。旧 `users` は移行元として残し、移行後は書かない。
- Data ownership/stewardship: Better Auth の表は Better Auth、招待・MFA 設定トークン・連携確認トークンはアプリの認証 route。
- Classification/residency: 認証情報 (メールアドレス・ハッシュ・TOTP の秘密・セッション)。認証と保護の用途に限って使う (G5)。D1 の既存の保管場所から動かさない。

#### Logical and physical model

- Conceptual/logical model: 以下は agent 推定・利用者未確認 (根拠 qa-login-v2-database-web-002・-004・-005)。
  - 認証の 5 表: Better Auth 既定名に接頭辞を付けない。列は Better Auth v1.7.5 の既定 schema に従う。
  - `invitations`: `id`・`email`・`role`・`token_hash`・`expires_at`・`accepted_at`・`revoked_at`・`invited_by`。状態 (未承諾・承諾済み・期限切れ・取消) は列から core が導き、保存しない。
  - `mfa_setup_token`: `id`・`user_id` (認証の `user` 表への外部キー、削除で連鎖)・`token_hash` (SHA-256、一意)・`expires_at` (発行から 10 分)・`consumed_at` (未消費は NULL)・`created_at`。平文のトークンは保存しない。
- Physical store/engine/version: Cloudflare D1 (SQLite)。Drizzle の schema 定義 (`schema.ts`) と migration の SQL を同じ変更で揃える。
- Schema/index/partition decisions: `session` のトークン、`invitations.token_hash`、`mfa_setup_token.token_hash` に一意索引。パーティションは行わない。

#### Access and consistency

- Query/access patterns: トークンは平文から SHA-256 を計算してハッシュ列の一意索引で引く。招待の再送依頼は宛先のメールで有効な招待を引く。
- Transaction/consistency/idempotency: 
  - MFA 設定トークンの消費は `UPDATE ... SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?` の更新行数が 1 のときだけ有効とする。同じ利用者へ新しいトークンを出すときは未消費の古い行を消費済みにする。正本章は「TOTP の有効化とセッションの作成を同じ D1 batch に置く」とするが、セッションの書込は Better Auth のアダプタ経由のため同じ batch に入るかは未確認 (Risks and verification)。
  - 招待の消費 (承諾済みへの更新) と利用者作成を同じ D1 batch に置く (qa-login-v2-backend-web-004)。
  - 停止した利用者の `session` 行は停止の操作と同じ batch で消す。再設定の完了でその利用者の `session` 行を全て消す。
  - 複写の migration は `INSERT ... SELECT ... WHERE NOT EXISTS` にし、途中で止まっても再実行で収束させる (`system-spec/database.md` 上流指針 reliability)。
- Cache/replica/search consistency: N/A: キャッシュ・レプリカ・検索索引を持たない。

#### Lifecycle and governance

- Retention/archival/deletion: 期限切れの `mfa_setup_token` の行は定期処理で消す (qa-login-v2-database-web-005)。招待・`session`・`verification` の期限切れ行の扱いは正本章に定めが無く、plan で決める。
- Privacy/audit/lineage: 既存 `users.id` を `user.id` に引き継ぎ、監査の lineage を切らない。招待・連携・再設定・MFA の変更は `audit_log` の新しい action に残す。
- Data quality/contracts: トークンと復旧コードの平文が D1 のどの列にも現れないこと。Better Auth 組込みの再設定トークン (`verification`) と 2FA の復旧コードは公式 docs に保存形式の記述が無いため組込みのまま使い、実装時に D1 の行を読んで平文が無いことを確かめる。平文であれば、復旧コードは 2FA plugin の保存オプションか独自のハッシュ化で、再設定トークンは独自発行へ置き換える (agent 推定・利用者未確認、根拠 qa-login-v2-database-web-004)。

#### Migration and recovery

- Migration/backfill/dual-write/cutover: 追加のみの migration で表を作り、既存 `users` を複写する (C3)。旧行は書き換えない。一時パスワード状態 (`must_change_password`) の利用者は複写せず招待を出し直すか、複写したうえで利用させないかは plan で決める (dec-login-v2-onboarding の注意「一時パスワード状態の利用者には招待を出し直す」)。`EXPECTED_D1_MIGRATION` を同じ変更で上げる。
- Backup/restore/RPO/RTO: 既存の D1 の Time Travel と JSON バックアップに従う。認証の表をバックアップと全削除 (`deletion-full-reset.ts`) の対象に含めるかは正本章に無く、plan で決める。
- Rollback/forward-fix: 新表は残したまま、Worker を旧 `users` で動く版へ戻す (qa-login-v2-maintenance-ops-web-002)。schema は戻さず forward-fix にする。

#### Data verification

migration を空の D1 と 0047 まで適用した D1 の両方に当て、既存行が変わらないこと、2 回流しても行数が変わらないことを確かめる。既存の PBKDF2 ハッシュの利用者が再設定なしでログインできる移行テスト (O2)。招待・再設定・連携確認のトークンと復旧コードの平文が D1 のどの列にも現れないテスト (O4・O6)。同じ MFA 設定トークンの 2 回目・期限切れ・別の利用者のトークンがいずれも拒否され、D1 に平文が残らないテスト (qa-login-v2-database-web-005)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-database-web-003 | 追加のみの migration で認証の表と招待表を新設し、旧表・旧列を残す | 旧 `users` を改修する / 旧表を削除する | 直前版の Worker と共存でき、戻しが Worker の差し戻しで済む | 旧表と新表が並存し、正本は新表になる |
| qa-login-v2-database-web-003 | 認証の表を業務データの表と分け、業務の表から外部キーを張り足さない | 業務の表の `user_id` を認証の `user` へ参照させる | 認証の移行・戻しが業務データに波及しない | 業務の `user_id` の整合は DB で保証しない |
| qa-login-v2-database-web-002 (agent 推定) | 既存 `users.id` を `user.id` にそのまま使う | 新しい id を振り対応表を持つ | `audit_log.actor_user_id` の意味が変わらない | 複写は id を保つ `INSERT ... SELECT` |
| qa-login-v2-database-web-004 (agent 推定) | PBKDF2 を `account.password` へ形式ごと移し、検証関数で読む | 全員に再設定を強いる | 既存利用者の手間が無い (C4) | 検証関数が 2 形式を読む |
| qa-login-v2-database-web-005 (agent 推定) | MFA 設定トークンを `mfa_setup_token` に SHA-256 で保存し、条件付き UPDATE で 1 回だけ消費する | Better Auth の `verification` 表に載せる / 平文で持つ | 1 回限りと期限を DB の更新行数で保証できる | 期限切れ行の定期削除が要る |
| qa-login-v2-decision-006 | TOTP 設定前の管理者セッションを作らず、設定トークンを別表に置く | 登録直後にセッションを出し次回ログインで設定させる | 設定前の管理者セッションが 0 件になる | 設定トークンの表と消費の整合が要る |

## Delivery, migration and rollback

- Build/deploy topology: `migrate.yml` で D1 へ反映してから `deploy.yml` で Worker を配信する既存の順。
- Migration sequence: `origin/main` の fetch と番号確認 (予定 0048) → migration の SQL と `schema.ts` の追加 → `EXPECTED_D1_MIGRATION` の更新 → ローカル D1 への適用と 2 回適用の検算 → Migrate → Deploy。
- Rollback trigger/procedure: Deploy 後に不具合が出たら Worker を旧 `users` で動く版へ戻す。schema は追加のみなので戻さない。Migrate だけ通って Deploy が止まった場合は Deploy を再実行する。

## Risks and verification

- Risk/assumption (評価の既知課題 medium、`system-spec/completeness-findings.json` findings[0]): `mfa_setup_token` の消費と TOTP の有効化とセッションの作成を同じ D1 batch に置けるかは未確認。セッションは `internalAdapter.createSession` がアダプタ経由で書く。評価器の修正案は「トークンの消費と `twoFactorEnabled=true` を 1 batch にし、セッションはそのあと作り、途中で失敗しても再試行できる順序にする」。あわせて、MFA 設定を始める入口 (`/api/auth/mfa-setup/start` 相当) が秘密鍵を `twoFactor` 表 (未有効) に暗号化保存する前提も未定義で、sign-in が 401 `FAILED_TO_CREATE_SESSION` のとき設定トークンを返す手段も未定。plan で解決し、`/mfa-setup/*` をレート制限の入口に加える。
- Risk/assumption: 長い作業の間に main 側で別の migration が 0048 を使うと、git の衝突に出ずに番号が重なる。着手時と PR 前に `origin/main` を fetch して番号を確定する。
- Risk/assumption: Better Auth の `user` 表名は旧 `users` と 1 文字違いで、取り違えた SQL が旧表を読んでも型では検出できない。新旧の表名を schema テストで固定する。
- Risk/assumption: 一時パスワード状態の既存利用者の扱いと、認証の表のバックアップ・全削除の対象が正本章に無い。plan で決め、テストで確かめる。
- Architecture fitness test: migration に `UPDATE`・`DROP`・列の型変更が無いこと。業務データの表から認証の表への外部キーが 0 件。トークン・復旧コードの平文を持つ列が 0 件。`EXPECTED_D1_MIGRATION` が最新の migration と一致すること。
- Load/failure/security validation: 同じ MFA 設定トークンを並行に 2 回使っても成功が 1 回だけになること。
