---
graph_node_id: "arch-login-v2-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "ログイン v2 — Better Auth を /api/auth/* に載せ、招待・MFA 設定・再設定を許可側の関門と 1 か所の送信関数で束ねる"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "backend"]
file_path: "architecture/login-v2-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7f9867e1cbf2d6eda0a9b43b558b18737df233f02ee8e44fc234d735661d8bfa"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "7f9867e1cbf2d6eda0a9b43b558b18737df233f02ee8e44fc234d735661d8bfa", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/routes/auth.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/users.ts", "packages/api/src/login-rate-limit.ts", "packages/api/src/audit-log.ts", "packages/api/src/public-validation.ts", "packages/api/src/account-login.test.ts", "packages/core/src/index.ts", "packages/core/src/invitation.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G2", "G3", "G4", "G5", "G6", "G7"]
---

# Architecture overview

ログイン v2 — Better Auth を `/api/auth/*` に載せ、招待・MFA 設定・再設定を許可側の関門と 1 か所の送信関数で束ねる。`system-spec/backend.md` (確定セル backend.web、主根拠 qa-login-v2-backend-web-003) が承認時入力で、本書は認証の経路・ガード・招待と MFA 設定の流れ・メール送信の置き場所の制約を持つ。認証の設定値の逐語は `system-spec/auth.md` の qa-login-v2-auth-web-007、表の列は `architecture/login-v2-database.md` を正本とする。仕様ノード `spec-login-v2` が本書の上流である。

凡例: 「(agent 推定・利用者未確認、根拠 qa-…)」を付けた値は正本章で `agent-inference` と宣言された実装手段で、付けていない到達点は利用者決定 (user-decision) または観測事実 (evidence) である。

## Context and drivers

- Business/technical context (観測事実、qa-login-v2-backend-web-evidence-001・qa-login-v2-auth-web-evidence-001): `packages/api/src/index.ts` の 87〜95 行目が `/api/auth/*` に 16KiB の `bodyLimit` を掛けて `authRoute` を置き、104〜108 行目が `/api/*` に `authGuard`・`mustChangePasswordFence`・`runtimeSchemaGuard`・`canonicalMutationFence` を順に掛ける。`packages/api/src/routes/auth.ts` (292 行) がログイン・ログアウト・パスワード変更を、`packages/api/src/routes/admin-users.ts` (150 行) が利用者の追加・停止・一時パスワード (16 文字・72 時間) の発行を持つ。`packages/api/src/auth.ts` (317 行) は PBKDF2-SHA256 10 万回と、HMAC で署名した `kanjo_session` Cookie (`userId.expiresAt.generation`) を扱い、保持ありで 30 日・なしで 12 時間の Max-Age を返す。`packages/api/src/login-rate-limit.ts` は IP とアカウントの 2 軸で 15 分に 5 回の失敗で 15 分ロックする。`auth.ts` の 248〜253 行目には Cloudflare Access の JWT を検証する経路がある。
- 旧世代との差分: 旧世代の設計 (`architecture/account-login-backend.md`) はセッション表を持たず `users.session_generation` を進めて一括失効させ、利用者追加は一時パスワードと初回変更の強制 (`mustChangePasswordFence`) で成り立っていた。v2 はセッションを D1 のセッション表 (Better Auth) へ移し、一時パスワードと初回変更の強制を撤去し、招待リンク・自己再設定・連携・TOTP を加える。
- Quality attribute priorities: G2〜G7 に資する。Clean Architecture の Dependency Rule を core (招待の状態・期限・MFA 要否の判定) ← api (Better Auth のインスタンス・招待と再設定の route・送信関数) ← web の一方向で適用し、Better Auth の型は api の外へ出さない (`system-spec/backend.md` 上流指針 application-architecture)。招待の作成と監査の記録を同じ D1 batch に入れ、Better Auth の表は route から直接 SQL で触らない (同 data-access)。
- Constraints: Cloudflare Workers (Hono) + D1/Drizzle、Better Auth は v1.7.5 に固定 (`system-spec/backend.md` 最新ドキュメント出典)。既存の 401/403/409 契約・mount 順序・監査の `actor_user_id` を変えない (G7)。自己登録は 0 件 (G3)。

## Goals and non-goals

- Goals:
  - G2: `/api/auth/*` を Better Auth のハンドラへ向け、`authGuard`・`adminGuard` を Better Auth のセッション取得へ差し替える (qa-login-v2-backend-web-003)。旧 `kanjo_session` の署名・世代照合と `mustChangePasswordFence` を撤去する。既存 PBKDF2 ハッシュは再設定を強いずに読む。
  - G3: 招待 (作成・一覧・再送・取消・承諾)・ログイン画面からの再送依頼の API を加え、承諾は招待と同じ確認済みメールアドレスの Google か、メールとパスワードでだけ完了させる。招待を経ない利用者作成を 0 件にする。一時パスワードの発行 API を撤去する。
  - G4: 再設定依頼と再設定の API を加え、再設定の完了で当該利用者の既存セッションを全て失効させる。連携は再認証と確認メールを経たときだけ成立させる。
  - G5: TOTP を管理者に必須、一般に任意で掛け、MFA 未設定の管理者には設定を終えるまでセッションを発行しない (qa-login-v2-decision-005・-006)。レート制限と列挙防止を新しい入口へ広げる。
  - G6: 認証不要の `GET /api/status` を加え、内部の詳細を返さない。
  - G7: 既存の account-login の契約 (未認証 401・停止利用者 401・非管理者 403・最後の管理者 409・監査の actor) を Better Auth 版で保つ。
- Non-goals:
  - 自己登録 (サインアップ)、Google 以外のソーシャルログイン・企業 SSO、パスキー・SMS の MFA (`system-spec/00-requirements-definition.md` U7 対象外)
  - 複数テナントの機構
  - web 以外の platform 向け API (Bearer トークン・ループバック redirect など。`system-spec/backend.md` の対象外セル)
  - Cloudflare Access のサーバ側検証経路の撤去 (C9 により残置)

## System context and boundaries

- Users/external systems: web (ログイン・招待承諾・再設定・MFA・連携・設定の利用者管理)。外部は Google (OIDC の認可と ID トークンの検証) と Resend (宛先メールアドレスと本文) だけで、業務データは送らない (C7)。
- Trust/deployment/data boundaries: 未認証で到達できるのは `/api/auth/*`・`/api/status`・既存のエージェント用トークン経路だけ。Better Auth はアダプタとして api 層に閉じ、core は Better Auth を知らない。認証の表は業務データの表から参照しない (`architecture/login-v2-database.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Better Auth インスタンス | メールとパスワード・Google・セッション・2FA (TOTP と復旧コード)・連携を扱い、`/api/auth/*` を `auth.handler` で受ける | Better Auth API / Hono handler | packages/api | 同一 Worker |
| 関門 (`databaseHooks.session.create.before`) | 管理者かつ TOTP 未設定のとき、Google の戻りと MFA 設定の完了処理以外のセッション作成を全て拒否する。保持なしのセッションの `expiresAt` を発行から 12 時間にする | Better Auth hook | packages/api | 同一 Worker |
| 利用者作成の封鎖 (`databaseHooks.user.create.before`) | 作成しようとするメールに有効な (期限内・未承諾・未取消の) 招待が無ければ拒否する | Better Auth hook | packages/api | 同一 Worker |
| 招待 route | 作成・一覧・再送・取消・承諾、ログイン画面からの再送依頼 | Hono route | packages/api | Worker |
| MFA 設定の完了 (`POST /api/auth/mfa-setup/complete`) | 設定トークンと TOTP の初回コードを受け、パスワード側でセッションを発行する唯一の経路 | Hono route | packages/api | Worker |
| 再設定依頼・再設定 | 期限付き・1 回限りのリンクを送り、完了で既存セッションを全て消す | Better Auth API + Hono route | packages/api | Worker |
| 連携 | 再認証と確認メールの後だけ `linkSocial` を許す | Better Auth API + Hono route | packages/api | Worker |
| 送信関数 `sendMail(to, template, params)` | Resend を呼ぶ唯一の場所。テストで差し替える | 関数 | packages/api | Worker |
| `authGuard` / `adminGuard` (差し替え) | `auth.api.getSession` でセッションと役割を得て、既存の 401/403 を返す | Hono middleware | packages/api | Worker |
| `GET /api/status` | `{status: 'normal' \| 'degraded'}` だけを返す | Hono route | packages/api | Worker |
| core 招待・MFA 要否の判定 (`packages/core/src/invitation.ts` 予定) | 招待の状態 (未承諾・承諾済み・期限切れ・取消)・期限計算・管理者に MFA を求めるかの判定 | 純関数 | packages/core | 同一 Worker |
| レート制限 (`login-rate-limit.ts` 拡張) | ログイン・MFA コード・MFA 設定・招待再送・再設定の各入口に IP とアカウントの 2 軸を掛ける | 関数 | packages/api | Worker |

(core のファイル名は agent 推定・利用者未確認。根拠は `system-spec/backend.md` 適用された設計知識の本章での適用)

## Cross-cutting contracts

- Identity/access: `authGuard` は Better Auth のセッションを取り、無ければ既存どおり 401。停止した利用者のセッション行は停止の操作と同じ D1 batch で消し、発行済みセッションを即時に 401 にする (`system-spec/database.md` 上流指針 data-access)。`adminGuard` の 403、有効な管理者が 0 人になる変更の 409 は変えない。Cloudflare Access の JWT 検証経路は残す (C9)。認証の詳細は `architecture/login-v2-auth.md`。
- Errors/resilience: 再送依頼・再設定依頼は宛先の有無にかかわらず 202 と同じ本文を返し、送信は `waitUntil` で応答の後に行って所要時間の差を消す (agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-002)。同じメールの Google サインインは `account_not_linked` で拒否される (qa-login-v2-auth-web-evidence-002)。エラー応答に内部の SQL・スタック・構成を含めない。
- Observability/audit: 招待の作成・再送・取消・承諾、連携の追加・解除、再設定、MFA の有効化・無効化を `audit_log` の新しい action として残し、`actor_user_id` の意味 (操作した利用者の id) を変えない。招待の作成と監査は同じ D1 batch に入れる。
- Configuration/secrets: `BETTER_AUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`RESEND_API_KEY` を Workers の secret で持つ (agent 推定・利用者未確認、根拠 qa-login-v2-infrastructure-web-004)。応答・ログに出さない。置き場所は `architecture/login-v2-infrastructure.md`。
- Compatibility/versioning: web へは自前の応答型で返し、Better Auth の型を漏らさない。Better Auth の版を上げるときは本書の hook と関門の契約テストを通してからにする。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/login-v2-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/login-v2-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: N/A: 本章の関心外 (`architecture/login-v2-security.md`)

### Backend architecture

#### Runtime and architecture pattern

- Runtime/framework/version: 既存の Cloudflare Workers + Hono + zod + Drizzle (D1)。Better Auth v1.7.5 (固定)。`nodejs_compat` (AsyncLocalStorage) は既存の `wrangler.jsonc` で有効。
- Pattern: Better Auth をアダプタとして api 層に閉じ、招待の状態・期限・MFA 要否は core の純関数で判定する層構造。関門は「許可する経路を列挙し、それ以外を全て拒否する」許可側の記述にし、今後 Better Auth に増える経路も既定で拒否されるようにする (`system-spec/completeness-findings.json` design_knowledge_reflection)。
- Selection rationale and rejected alternatives: 利用者は Better Auth への全面移行を選び (qa-login-v2-decision-001)、既定の自動連携・役割ごとの MFA 強制なし・ログインごとの期限なしという訂正後の比較を見たうえで継続を選んだ (qa-login-v2-decision-005)。自前認証への Google OIDC 追加 (推奨として提示) と Cloudflare Access 委任は採らない (`system-spec/00-requirements-definition.md` dec-login-v2-auth-foundation)。

#### Domain and module boundaries

- Bounded contexts/modules: 認証 (セッション・認証手段・MFA、Better Auth が所有)、招待 (アプリ所有)、MFA 設定トークン (アプリ所有)、連携確認 (アプリ所有)、公開情報 (稼働状態)。業務データの文脈とは表も参照も分ける。
- Dependency direction: core ← api ← web の一方向。core は Better Auth・D1・Hono の型を参照しない。
- Public/internal interfaces: Better Auth の設定は次のとおり (いずれも agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-004・-005、qa-login-v2-auth-web-007。公式 docs で確かめた既定の動きは qa-login-v2-auth-web-evidence-002)。
  - 連携: `account.accountLinking.disableImplicitLinking=true`・`allowDifferentEmails=false`・`trustedProviders` は設定しない。連携はログイン済みで既存手段の再認証とアプリ独自の確認メール (1 回限り・期限付き、SHA-256 ハッシュ保存) を経たあとだけ `linkSocial` を許す。サインインのついでの自動連携はしない。
  - 自己登録の封鎖: provider ごとの `disableSignUp` は使わず (Google に掛けると招待からの Google 登録まで止まる)、`databaseHooks.user.create.before` の 1 か所で有効な招待の無い作成を拒否する。Google provider は `disableImplicitSignUp=true` とし、招待承諾画面だけが `signIn.social` を `requestSignUp: true` で呼ぶ。
  - 自動ログインの停止: `emailAndPassword.autoSignIn=false`。招待の承諾でパスワードを登録した直後にセッションを作らない。
  - 既存ハッシュ: `emailAndPassword.password.verify` を差し替えて `pbkdf2-sha256$` 形式を読む。
  - 管理者の MFA 関門: `databaseHooks.session.create.before` で、利用者が管理者かつ `twoFactorEnabled` が偽のとき、許すのは Google の戻り (`/callback/google`) と MFA 設定の完了処理が作るセッションだけで、`/sign-in/email`・`/sign-up/email`・今後増える経路は全て拒否する。Google でログインした管理者には TOTP を求めない (qa-login-v2-decision-005)。
  - TOTP 設定済みの利用者は 2FA plugin の `twoFactorRedirect` を経て `/mfa` でコードを入力したあとにだけセッションを得る。`trustDevice` は使わない (使うとその端末が 30 日間 2FA を免れる)。

#### API and service contracts

- Protocol/style/versioning: 同一オリジンの REST (JSON)。`/api/auth/*` は Better Auth のハンドラ。アプリ独自の `/api/auth/mfa-setup/*` は Better Auth の catch-all より先に mount する (mount の順は agent 推定・利用者未確認)。招待・再送依頼・再設定依頼の経路名は正本章に無く、plan で決める。
- Request lifecycle: `/api/status` (認証ガードより前に mount) → `/api/auth/*` (bodyLimit → Better Auth / アプリの MFA 設定 route) → 保護された `/api/*` (`authGuard` → `runtimeSchemaGuard` → `canonicalMutationFence`)。`mustChangePasswordFence` は撤去する。
- 招待の承諾の流れ (agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-004・-005):
  1. 利用者がリンクのトークンで招待を開く。トークンの SHA-256 で招待を引き、期限内・未承諾・未取消を core で判定する。
  2. パスワードを選んだ場合は `autoSignIn=false` の `signUp.email` で利用者を作り、招待の消費 (承諾済みへの更新) と利用者作成を同じ D1 batch に置く。Google を選んだ場合は `signIn.social` を `requestSignUp: true` で呼び、確認済みで招待と同じメールのときだけ `user.create.before` が通す。
  3. 承諾した利用者が管理者なら 10 分・1 回限りの MFA 設定トークンを返す。一般利用者にはログイン画面への案内だけを返し、セッションは出さない (一般はパスワードでログインし直す)。
- MFA 設定の流れ: パスワードでのログインまたは承諾が管理者で TOTP 未設定のとき設定トークンを返し、`POST /api/auth/mfa-setup/complete` が設定トークンと TOTP の初回コードを受け取って、TOTP の設定と初回コードの検証に成功したときにだけトークンを消費してセッションを発行する。これが関門の許す唯一のパスワード側のセッション発行元である。設定を始める入口 (秘密鍵・totpURI・復旧コードの発行) は未定義で、Risks and verification に置く。
- 保持: 保持ありは `session.expiresIn=30 日`・`updateAge=1 日`。保持なしは、パスワードでは `signIn.email` を `rememberMe:false` で呼び、Google では認可開始の API が保持の指定を受け取り、保持しないときは Better Auth の `dont_remember` Cookie (接頭辞 `kanjo`) を付けてから Google へ送り、戻りの処理に同じ Cookie を読ませる。どちらも `session.create.before` でセッション行の `expiresAt` を発行から 12 時間にし、Cookie は Max-Age を持たない (ブラウザを閉じるまで)。途中のアクセスでも延長しない。Cookie は Secure・HttpOnly・SameSite=Lax (agent 推定・利用者未確認、根拠 qa-login-v2-auth-web-007。到達点は qa-login-v2-decision-005)。
- Error taxonomy: 未認証 401、非管理者 403、最後の管理者 409、検証違反 400、ロック中は既存の `login-rate-limit` の応答、同じメールの Google サインインは `account_not_linked`。関門で拒否されたパスワードのサインインは Better Auth が `FAILED_TO_CREATE_SESSION` (401) を投げる (評価器の観測、better-auth 1.7.0 `sign-in.mjs` 353〜356 行)。

#### Data and transaction behavior

- Repository/data owner: Better Auth の表 (user・session・account・verification・twoFactor) は Better Auth が読み書きし、route から直接 SQL で触らない。招待・MFA 設定トークン・連携確認トークンの表はアプリの route が書く。
- Transaction/idempotency/concurrency: 招待の消費と利用者作成を同じ D1 batch に置く。招待の作成と監査を同じ D1 batch に置く。MFA 設定トークンの消費は条件付き UPDATE (`consumed_at IS NULL AND expires_at > ?`) の更新行数が 1 のときだけ有効とし、1 回限りを DB で保証する (`architecture/login-v2-database.md`)。停止の操作とその利用者のセッション行の削除を同じ batch に置く。
- Cache consistency/invalidation: 正本章に定めが無い。停止・再設定の即時失効 (O2・O5) を崩さないよう、Better Auth のセッションの cookie cache を有効にするかは plan で決め、有効にするなら失効のテストで確かめる (本書の推定)。
- トークン: 招待と連携確認のトークンは 32 バイトの乱数を base64url にし、D1 には SHA-256 のハッシュだけを置く。招待の期限は 72 時間 (現行の一時パスワードと同じ)、再設定は 1 時間 (agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-002)。再設定トークンは Better Auth 組込み (verification 表) を使い、平文で保存されていないことを実装時に確かめる (qa-login-v2-database-web-004)。

#### Async processing

- Queue/event/scheduler: キューを追加しない。再送依頼・再設定依頼のメール送信は `waitUntil` で応答の後に行う (agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-002)。期限切れの MFA 設定トークンの削除は既存の定期処理に載せる (`architecture/login-v2-database.md`)。
- Delivery/order/dedup/retry/DLQ: 送信の失敗は再試行せず、利用者が再送を依頼し直す。管理者は招待を再送できる。送信の成否は応答に出さない (列挙防止)。

#### Security and resilience

- Authn/authz/input validation: 入力は zod で検証する。Google の認可は state・PKCE・nonce を検証し、ID トークンの `email_verified=false`・招待と登録の無いメール・停止中の利用者を拒否する (O3)。詳細は `architecture/login-v2-auth.md` と `architecture/login-v2-security.md`。
- Timeout/retry/circuit breaker/load shedding: ログイン・MFA コード・招待再送・再設定の各入口に IP とアカウントの 2 軸のレート制限 (15 分に 5 回の失敗で 15 分ロック、既存値) を掛け、他の利用者を阻害しない (O6)。MFA 設定 (`/api/auth/mfa-setup/*`) も入口に加える (評価の既知課題による)。

#### Operations and verification

- Logs/metrics/traces/health/readiness: `GET /api/status` は D1 への `SELECT 1` の成否で `normal` / `degraded` を返し、エラー文や構成を返さない (agent 推定・利用者未確認、根拠 qa-login-v2-backend-web-002)。ログにトークン・秘密・パスワードを出さない。
- Unit/contract/integration/load/failure tests: 既存の `packages/api/src/account-login.test.ts` の契約を Better Auth 版で緑にする (O2)。招待の無いメールで `signUp.email` と Google の新規サインインを試み、どちらでも利用者が作られない (O3)。招待のあるメールでは Google とパスワードの両方で承諾が完了する (O4)。TOTP 未設定の管理者は、パスワードでのログインでも招待のパスワード登録直後でも session 行が 0 件で、設定トークンで TOTP を設定・検証すると発行される。Google でログインした管理者は TOTP なしで発行される (O6)。パスワードと Google のそれぞれで、保持なしの Set-Cookie に Max-Age も Expires も無く、12 時間を過ぎたアクセスが 401、途中のアクセスで `expiresAt` が延びない (O2)。同じメールの Google サインインが `account_not_linked` (O5)。再設定の完了で既存セッションが全て 401 (O5)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-decision-001 / qa-login-v2-decision-005 | Better Auth へ全面移行し、訂正後の比較を見たうえで継続する | 自前認証に Google OIDC を追加 / Cloudflare Access に委ねる | Google・パスワード・連携・TOTP と復旧コードを 1 つの基盤で賄える | 既定の自動連携・MFA 強制なし・期限固定を設定と hook で埋める |
| qa-login-v2-decision-002 | メール送信を Resend にし、`sendMail` の 1 関数に閉じる | Cloudflare Email Service / 送信の無効化 | fetch 1 本で送れ、無料枠に収まる。差し替えでテストできる | 宛先が Resend へ渡ることをプライバシーに書く |
| qa-login-v2-decision-003 / qa-login-v2-decision-005 | TOTP は管理者必須・一般任意、Google でログインした管理者は Google 側に委ねる | 全員必須 / MFA を作らない | 管理者の乗っ取りを防ぎ一般の手間を増やさない | 関門は Google の戻りを許可側に含める |
| qa-login-v2-decision-006 | 招待のパスワード登録では自動ログインさせず、管理者は TOTP 設定後に初めてセッションを得る | G5 を文字どおり「次回ログインで設定」と読む | TOTP 設定前の管理者セッションが存在しない | `autoSignIn=false` と MFA 設定トークンの流れが要る |
| qa-login-v2-decision-004 | 一時パスワードの発行 API と初回変更の強制を撤去し、招待リンクへ置き換える | 当面併存 | 管理者が他人の秘密を扱う経路が無くなる | 一時パスワード状態の既存利用者には招待を出し直す |
| qa-login-v2-backend-web-004 (agent 推定) | 自己登録の封鎖を `user.create.before` の 1 か所に一本化し、Google は `disableImplicitSignUp` | provider ごとの `disableSignUp` | 招待からの Google 登録を止めずに招待外の作成を全経路で止める | 招待の有効性の判定が hook に集まる |
| qa-login-v2-auth-web-007 (agent 推定) | 管理者の MFA 関門を `session.create.before` の許可側で書く | 拒否する経路を列挙する | 今後増える経路も既定で拒否される | 許可する 2 経路の識別を hook の文脈で行う |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: 追加 migration の反映 (`architecture/login-v2-database.md`) → Better Auth のインスタンスと PBKDF2 の検証差し替え → `/api/auth/*` の付け替えと `authGuard`・`adminGuard` の差し替え (旧契約テストを Better Auth 版で緑に) → 関門と利用者作成の封鎖 → 招待・承諾・MFA 設定の経路 → 再設定と連携 → レート制限の入口の拡張 → `GET /api/status` → 一時パスワードの API・`mustChangePasswordFence`・旧 `kanjo_session` の署名と世代照合の撤去。
- Rollback trigger/procedure: 契約テストが落ちたら差し戻す。配信後の不具合は、Better Auth の route を外して旧 `authRoute` と `authGuard` を戻す commit を revert で作り、新表は残したまま旧 users で動かす (agent 推定・利用者未確認、根拠 qa-login-v2-maintenance-ops-web-002。手順は `architecture/login-v2-maintenance-ops.md`)。

## Risks and verification

- Risk/assumption (評価の既知課題 medium、`system-spec/completeness-findings.json` findings[0]): MFA 設定を始める入口が定義されていない。セッションを持たない管理者に TOTP の秘密鍵・totpURI・復旧コードを発行する `/api/auth/mfa-setup/start` 相当が無く、2FA plugin の `/two-factor/enable` は sessionMiddleware を掛けているため使えない (better-auth 1.7.0 `plugins/two-factor/index.mjs` 76 行、評価器の観測)。秘密鍵の生成・twoFactor 表への暗号化保存・復旧コードの生成をアプリ側で書く必要がある。plan で解決する。
- Risk/assumption (同上): `session.create.before` が拒否すると `/sign-in/email` は `FAILED_TO_CREATE_SESSION` (401) を投げるため、設定トークンを応答に載せる手段 (APIError の本文に載せるか、`hooks.after` で置き換えるか) が未定。plan で解決する。
- Risk/assumption (同上): 「トークンの消費と TOTP の有効化とセッションの作成を同じ D1 batch に置く」は、セッションが `internalAdapter.createSession` 経由でアダプタが書くため、アプリの D1 batch に入れられるか未確認。評価器の修正案は「トークンの消費と `twoFactorEnabled=true` を 1 batch にし、セッションはそのあと `createSession` で作り、途中で失敗しても再試行できる順序にする」。plan で解決する。
- Risk/assumption: `/api/auth/mfa-setup/*` をレート制限の入口 (O6) に加える。確かめるテストとして、トークン無しの start・complete、トークンの 2 回目の使用、TOTP 検証の失敗が 401 またはロックになることを加える。
- Risk/assumption: Google の戻りの処理が `dont_remember` Cookie を読むことは公式 docs で確かめられず、評価器が better-auth 1.7.0 のソース (`cookies/index.mjs` 168〜169 行、`callback.mjs` 248 行) で確かめた。固定版 v1.7.5 でも同じかをテストで確かめる (low)。
- Risk/assumption: G5 の「未設定の管理者は次回ログインで設定を求める」は decision-006 と字面で食い違う (low、正本の要件定義に残る)。本書は decision-006 (登録直後にも求める) に従う。
- Architecture fitness test: `/api/*` の mount 順序 (`/api/status` と `/api/auth/*` が `authGuard` より前) が契約テストで固定されていること。`mustChangePasswordFence`・一時パスワードの API・`kanjo_session` の署名経路の参照が 0 件。Resend の呼出しが `sendMail` の 1 か所だけ。core が Better Auth の型を参照しないこと。
- Load/failure/security validation: 各入口の連続失敗がロックされ他の利用者を阻害しないこと。再送依頼・再設定依頼の応答の本文・ステータスが宛先の有無で変わらないこと。
