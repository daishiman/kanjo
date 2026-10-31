---
graph_node_id: "arch-login-v2-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "ログイン v2 — Better Auth 継続、招待だけの利用者作成、許可側で書く管理者 MFA 関門と保持 30 日 / 非保持 12 時間"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "auth"]
file_path: "architecture/login-v2-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "7a69f92e77e282c4368aba6fc630e6a6b0f65c6179f4bfcff14291e7223c6464"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "7a69f92e77e282c4368aba6fc630e6a6b0f65c6179f4bfcff14291e7223c6464", "imported_at": "2026-09-21T14:22:03Z"}
created_at: "2026-09-21T14:22:03Z"
updated_at: "2026-09-21T14:22:03Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/src/routes/auth.ts", "packages/api/src/index.ts", "packages/api/src/users.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/login-rate-limit.ts", "packages/api/src/audit-log.ts", "packages/api/src/db/schema.ts", "packages/api/src/account-login.test.ts", "packages/api/src/auth.test-support.ts", "packages/api/src/password-hash-workerd.test.ts", "packages/api/package.json", "migrations/"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/login-v2-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:22:03Z"}
serves_goals: ["G2", "G3", "G4", "G5"]
---

# Architecture overview

ログイン v2 — Better Auth 継続、招待だけの利用者作成、許可側で書く管理者 MFA 関門と保持 30 日 / 非保持 12 時間。`system-spec/auth.md` (digest `7a69f92e…6464`) は承認時入力、本書は認証方式・セッション・利用者作成・連携・多要素認証の境界の制約を持つ。上位概念の正本は `system-spec/00-requirements-definition.md` (U3 G2〜G5 / U4 O2〜O6)、旧世代の認証機構は `architecture/account-login-auth.md`。

本書の根拠の性質は 3 種に分けて書く。**確定** = 利用者決定 (user-decision) の `qa-login-v2-auth-web-006` と `qa-login-v2-decision-001`〜`006`。**観測** = 現行実装や公式 docs の観測 (`qa-login-v2-auth-web-evidence-001` / `-002`)。**推定** = 利用者未確認の agent-inference (`qa-login-v2-auth-web-007`、`qa-login-v2-security-web-004`、`qa-login-v2-backend-web-004` / `-005`、`qa-login-v2-database-web-004` / `-005`)。推定は正本が agent-inference と書いたものをそのまま推定として扱い、実装時のテストで確かめる。

## Context and drivers

- Business/technical context (観測、qa-login-v2-auth-web-evidence-001): `packages/api/src/auth.ts` (317 行) は PBKDF2-SHA256 10 万回のハッシュと、HMAC で署名した `kanjo_session` Cookie (`userId.expiresAt.generation`) を扱い、保持ありで 30 日、なしで 12 時間の Max-Age を返す。セッション表は無く、停止と再設定は `users.session_generation` を進めて既存 Cookie を無効にする。管理者は 16 文字・72 時間の一時パスワードを発行し、`must_change_password` で初回変更を強制する (`mustChangePasswordFence`、`packages/api/src/index.ts` 106 行)。`/api/*` は `authGuard()` → `mustChangePasswordFence()` → `runtimeSchemaGuard` → `canonicalMutationFence()` の順に登録されている (index.ts 104-108 行)。Cloudflare Access の JWT 検証経路が auth.ts 184 行以降に残る。Better Auth は現時点で依存に無い。
- Better Auth の既定と承認済みゴールの食い違い (観測、qa-login-v2-auth-web-evidence-002): 既定では確認済みメールの OAuth サインインで自動連携する。`session.expiresIn` はインスタンス全体の設定でログインごとに変えられない。2FA plugin に役割ごとの強制は無い。`trustDevice` は 30 日 2FA を省く。復旧コードの保存形式は docs に無い。本書の設定値の多くは、この食い違いを埋めるためにある。
- Quality attribute priorities: G2・G3・G4・G5 に資する。上流指針は OWASP ASVS + Secrets Management Cheat Sheet (authentication / security)。NIST SP 800-63B の複数要素を、パスワードでのログインへの TOTP (管理者必須) として反映する (`system-spec/auth.md`「上流指針」)。
- Constraints: 認証基盤は Better Auth (Hono の Worker + D1) で、バージョンを固定する (C1、決定 qa-login-v2-decision-001 / -005)。既存の PBKDF2 ハッシュ (`pbkdf2-sha256$` 形式) を再設定なしで読む (C4)。migration は追加のみで既存行を書き換えない (C3)。Cloudflare Access のサーバ側検証経路は残置する (C9)。単一テナント `default` を維持する (U7 out)。

## Goals and non-goals

- Goals:
  - G2 (確定、qa-login-v2-auth-web-006 / decision-005): 認証手段はメールとパスワード、Google の 2 つとし、Better Auth で扱う。Better Auth は**継続**する (decision-005 で訂正後の比較を見たうえで再選択)。ログイン状態は保持するとき 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間とし、Google でのログインでも同じにする。既存のパスワードは再設定を強いない。旧 Cookie `kanjo_session` と自前の署名・世代照合は撤去する。
  - G3 (確定): Google は招待先と同じ確認済みメールアドレスのときだけ通し、停止中の利用者は拒否する。自己登録 (サインアップ) の経路は 0 件のままにする。
  - G4 (確定): 連携はログイン済みで既存手段による再認証と確認メールのリンクを経たときだけ成立させ、サインインのついでの自動連携はしない。別メールの Google は連携しない。パスワード再設定の完了で既存セッションを全て失効させる。
  - G5 (確定、decision-003 / -005 / -006): TOTP はパスワードでの認証に掛け、管理者は必須、一般は任意、1 回限りの復旧コードを発行する。TOTP を設定していない管理者には、ログインでも招待からの登録直後でも、設定を終えるまでセッションを発行しない (TOTP 設定前の管理者のセッションが存在する経路は 0 件)。Google でログインした管理者には TOTP を求めず、Google 側の 2 段階認証に委ねる。
- Non-goals:
  - Google 以外のソーシャルログイン・SAML などの企業 SSO、パスキー・SMS による MFA (U7 out)
  - 複数テナント機構 (`TENANT_ID='default'` を維持)
  - 信頼端末 (`trustDevice`) による 2FA の省略
  - 旧表・旧列の削除 (本サイクルでは行わない、C3)

## System context and boundaries

- Users/external systems: 招待された本人 (管理者・一般利用者)。外部は Google (OIDC の認可と ID トークンの検証) と Resend (招待・再設定・連携確認のメール) だけ (C7)。Cloudflare Access は既存の検証経路として残る。
- Trust/deployment/data boundaries: 信頼境界は Worker の入口。未認証で到達できるのは Better Auth のハンドラ (`/api/auth/*`)、招待の承諾・再送依頼・再設定依頼、MFA 設定の完了、稼働状態 API だけ。それ以外の `/api/*` は Better Auth のセッションを持つ要求だけが通る。認証の表 (user・session・account・verification・twoFactor・招待・`mfa_setup_token`) は業務データの表と分け、業務データの表から認証の表へ外部キーを張り足さない (G5、`architecture/login-v2-database.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Better Auth インスタンス | メールとパスワード・Google・セッション・TOTP 二要素・連携を担う。`/api/auth/*` を処理する | `auth.handler` / `auth.api.*` | packages/api | Worker |
| パスワード検証の差し替え | 既存 `pbkdf2-sha256$` ハッシュを `emailAndPassword.password.verify` で読む (推定、auth-web-007) | Better Auth 設定 | packages/api | Worker |
| 利用者作成の関門 | `databaseHooks.user.create.before` で、有効な招待 (期限内・未承諾・未取消) の無いメールの作成を拒否する (推定、backend-web-004) | Better Auth databaseHooks | packages/api | Worker |
| セッション発行の関門 | `databaseHooks.session.create.before` で、TOTP 未設定の管理者のセッション作成を許可側で絞り、保持なしのセッションの期限を 12 時間にする (推定、auth-web-007) | Better Auth databaseHooks | packages/api | Worker |
| MFA 設定の完了処理 | 10 分・1 回限りの設定トークンと TOTP の初回コードを検証し、パスワード側で唯一セッションを発行する (推定、backend-web-005 の `POST /api/auth/mfa-setup/complete`) | アプリ独自 API | packages/api | Worker |
| Google の認可開始 | 保持の指定を受け、保持しないときは Better Auth の `dont_remember` Cookie を署名付きで先に付けてから Google へ送る (推定、auth-web-007 / backend-web-005) | アプリ独自 API | packages/api | Worker |
| `authGuard` / `adminGuard` | 名前と mount 順を保ったまま、`auth.api.getSession` でセッションと役割を取る (推定、backend-web-004) | Hono ミドルウェア | packages/api | Worker |
| レート制限 | 既存の IP・アカウント 2 軸を MFA コード・招待再送・再設定の入口へ広げる (`architecture/login-v2-security.md`) | `login-rate-limit.ts` | packages/api | Worker |

既存実装との差分:

| 既存 | 扱い | 根拠 |
|---|---|---|
| `kanjo_session` の HMAC 署名・`issueSession` / `verifySession` / `clearSession` | 撤去し Better Auth のセッション表と Cookie に置き換える | G2 |
| `users.session_generation` による一括失効 | 撤去し、停止・再設定はその利用者のセッション行の全削除で行う | G2 / G4、doctrine security の反映 |
| `mustChangePasswordFence` と一時パスワードの発行・`must_change_password` | 撤去 (旧列は残すが参照しない) | G3、decision-004 |
| PBKDF2 のハッシュ関数 | 検証側として残し、`password.verify` から呼ぶ | C4 |
| `authGuard` / `adminGuard` の名前・mount 順・401/403/409 の契約 | 残し、中身だけ差し替える | G7 / O2 |
| `audit_log.actor_user_id` への認証系の記録 | 残し、連携の追加・解除などの action を足す | G4 / O5 |
| Cloudflare Access の JWT 検証経路 | 残置 | C9 |
| `TENANT_ID='default'` | 残す | U7 out |
| 新規パスワードのハッシュ形式 | 正本に定めが無い。plan で決める | — |

## Cross-cutting contracts

- Identity/access: 利用者 id と役割は Better Auth のセッションからだけ取る。`/api/*` の mount 順 (`authGuard` が業務 route より前) を保つ。管理者の権限は、パスワードでログインした管理者では TOTP を経たセッションでだけ有効になる。
- Session (確定値 + 推定の手段): 保持ありは `session.expiresIn=30 日`・`updateAge=1 日`。保持なしは、パスワードでは `signIn.email` を `rememberMe:false` で呼び、Google では認可開始 API が `dont_remember` Cookie (接頭辞 `kanjo`) を先に付け、戻りの処理に同じ Cookie を読ませる。どちらも `session.create.before` でセッション行の `expiresAt` を発行から 12 時間にし、Cookie は Max-Age も Expires も持たない。途中のアクセスでも延長しない。Cookie は `Secure`・`HttpOnly`・`SameSite=Lax` (推定、auth-web-007)。
- Errors/resilience: 未認証 401、非管理者の管理 API 403、最後の管理者の停止 409 を保つ (O2)。同じメールの Google サインインは `account_not_linked` で拒否される。ログイン失敗は利用者の有無で応答が変わらない (C6)。
- Observability/audit: 招待・連携の追加と解除・再設定・MFA の変更を `audit_log` に `actor_user_id` 付きで残す (G4、SH4)。
- Configuration/secrets: Better Auth の secret・Google の Client ID / Secret・Resend の API キーを wrangler secret で持つ (C2。secret 名は `architecture/login-v2-security.md`)。Better Auth の配信元設定を本番の配信元に合わせる (`architecture/login-v2-infrastructure.md`)。
- Compatibility/versioning: Better Auth は固定版 (fetched-references の v1.7.5) を使う。1.7.0 のソースで確かめた挙動 (`autoSignIn=false` でセッションを作らない、`dont_remember` の読取り、`rememberMe:false` で延長しない) が v1.7.5 でも同じかはテストで確かめる。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/login-v2-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/login-v2-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/login-v2-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/login-v2-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 利用者のパスワードハッシュ・セッション・連携済みの Google アカウント・TOTP の秘密鍵と復旧コード・招待と再設定と連携確認と MFA 設定のトークン。これらが守る先は金融明細そのもの。
- Actors/adversaries/abuse cases: 確認済みメールの Google アカウントだけを持つ第三者が既存アカウントへ入る (自動連携)。招待の無いメールで Google やパスワードから利用者を作る (自己登録)。パスワードだけを盗んだ者が管理者として入る。招待からのパスワード登録の自動ログインで TOTP を素通りする。乗っ取ったセッションだけで認証手段を足す。信頼端末の 30 日で MFA を省く。
- Trust boundaries/data flows: ブラウザ → `/api/auth/*` (Better Auth) → databaseHooks (利用者作成・セッション作成の関門) → D1 の認証表。Google へはページ遷移だけで往復し、戻りは Better Auth の callback が受ける。

#### Identity and authorization

- Authentication/session/federation:
  - 連携 (推定、auth-web-007 / security-web-004): `account.accountLinking.disableImplicitLinking=true`、`allowDifferentEmails=false`、`trustedProviders` は設定しない。連携は、ログイン済みで既存手段の再認証と、アプリ独自の確認メール (1 回限り・期限付き、SHA-256 ハッシュ保存) を経たあとの `linkSocial` だけで成立させる。
  - 利用者作成 (推定、backend-web-004): 自己登録の封鎖は `databaseHooks.user.create.before` の 1 か所に一本化し、有効な招待の無いメールの作成を拒否する。Google provider は `disableSignUp` を使わず (招待からの Google 登録まで止まるため) `disableImplicitSignUp=true` とし、招待承諾画面だけが `signIn.social` を `requestSignUp: true` で呼ぶ。Google は `email_verified` と招待済みメールの一致を必須にする (O3)。
  - 管理者 MFA 関門 (推定、auth-web-007。決定 -005 / -006 の実現手段): `databaseHooks.session.create.before` で、利用者が管理者かつ `twoFactorEnabled` が偽のとき、**許すのは Google の戻り (`/callback/google`) と MFA 設定の完了処理が作るセッションだけ**で、それ以外の経路 (`/sign-in/email`、`/sign-up/email`、今後増える経路) は全て拒否する。拒否側の列挙では書かない。
  - 招待からの登録 (推定、auth-web-007 / backend-web-005): `emailAndPassword.autoSignIn=false` とし、招待の承諾でパスワードを登録した直後にはセッションを作らない。承諾またはパスワードでのログインが TOTP 未設定の管理者なら、10 分・1 回限りの MFA 設定トークンを返し、TOTP の設定と初回コードの検証に成功したときだけトークンを消費してセッションを発行する。一般利用者は承諾後にパスワードでログインし直す。
  - TOTP 設定済みの利用者: 2FA plugin の `twoFactorRedirect` を経て `/mfa` でコードを入力したあとにだけセッションを発行する。`trustDevice` は使わない (security-web-004: 管理者の必須を信頼端末の 30 日で素通りさせないため)。
- Authorization model and deny-by-default rules: 管理 API は管理者のセッションだけ。本人の連携・MFA・パスワードの変更は本人のセッションだけが行え、管理者も他人の認証手段を設定できない (`system-spec/auth.md`「適用された設計知識」、推定)。
- Tenant/resource ownership enforcement: 単一テナント `default` のまま。利用者 id は Better Auth のセッションから取り、本文・URL から受け取らない。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: HTTPS と D1 の保管に従う。Cookie は Secure・HttpOnly・SameSite=Lax。
- Secret source/rotation/redaction: 招待・連携確認・MFA 設定のトークンはアプリ独自に発行し SHA-256 のハッシュだけを保存する。Better Auth 組込みの再設定トークン (verification 表) と復旧コードは保存形式が docs に無いため、実装時に D1 の行を読んで平文が無いことを確かめ、平文なら置き換える (推定、database-web-004)。`mfa_setup_token` 表の形は `architecture/login-v2-database.md` (database-web-005)。
- Retention/deletion/privacy requests: 再設定の完了と利用者の停止は、その利用者の全セッションの削除と同時に行う (doctrine security の反映)。

#### Application and supply-chain controls

- Input/output validation and injection defenses: Google の認可は state・PKCE・nonce を検証する (O3)。入力検証と応答の一本化は `architecture/login-v2-security.md`。
- Dependency/artifact provenance/signing/SBOM: Better Auth を固定版で追加する。破壊的変更はライブラリ更新時の契約テストで検出する。
- CI/CD branch/review/environment protections: 既存の CI とデプロイ手順に従う。

#### Detection and response

- Audit events/security telemetry/alerts: 連携の追加・解除、MFA の有効化・無効化、再設定の完了を `audit_log` の action として足す。
- Incident response/revocation/recovery: 停止は利用者のセッション行の全削除で即時失効させる。管理者の MFA 喪失・最後の管理者の停止は復旧コードと seed スクリプトで戻す (C8、`architecture/login-v2-maintenance-ops.md`)。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

`system-spec/auth.md` の qa-login-v2-auth-web-007 末尾のテストを API 統合テストとして置く。パスワードと Google のそれぞれで、保持なしの Set-Cookie に Max-Age も Expires も無く、12 時間を過ぎたアクセスが 401、途中のアクセスで `expiresAt` が延びない (O2)。保持ありの Max-Age が 30 日。同じメールの Google サインインが `account_not_linked` (O5)。TOTP 未設定の管理者は、パスワードでのログインでも招待のパスワード登録直後でも session 行が 0 件でセッション Cookie が無く、設定トークンで TOTP を設定・検証すると発行される。Google でログインした管理者は TOTP なしで発行される (O6)。招待の無いメールで `signUp.email` と Google の新規サインインを試み、どちらでも利用者が作られない (O3)。既存の account-login の契約テストを Better Auth 版で緑にし、既存 PBKDF2 利用者が再設定なしでログインできる (O2)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-login-v2-decision-001 / qa-login-v2-decision-005 | Better Auth へ移行し、訂正後の比較を見たうえで継続する | 自前認証に Google OIDC を追加 (AI 推奨) / Cloudflare Access に委ねる | Google・パスワード・連携・TOTP・復旧コードを 1 基盤で得る | 既定の自動連携・全体一律の期限・役割ごとの強制なしを設定と hooks で埋める必要がある |
| qa-login-v2-auth-web-006 | 連携は再認証と確認メールを経た `linkSocial` だけ。自動連携と別メール連携はしない | Better Auth 既定の自動連携 | 確認済みメールの Google を持つだけの第三者を入れない | `disableImplicitLinking=true`・`allowDifferentEmails=false`・`trustedProviders` 不使用 (推定、auth-web-007) |
| qa-login-v2-decision-003 / qa-login-v2-decision-005 / qa-login-v2-decision-006 | TOTP 未設定の管理者には、ログインでも招待の登録直後でも設定完了までセッションを出さない。Google の管理者は TOTP 不要 | 次回ログインで設定を求める (セッションは出す) | TOTP 前の管理者セッションを 0 件にする | 関門を `session.create.before` の許可側で書き、`autoSignIn=false` と 10 分 1 回限りの設定トークンを置く (推定、auth-web-007) |
| qa-login-v2-auth-web-006 / qa-login-v2-decision-005 | 保持あり 30 日、保持なしはブラウザを閉じるまでかつ最長 12 時間。Google も同じ | 保持なしを Max-Age 12 時間の Cookie にする | 共有端末で閉じたら終わる | サーバ 12 時間・Max-Age なし、Google は署名付き `dont_remember` Cookie (推定、auth-web-007) |
| qa-login-v2-decision-004 | 一時パスワードと初回変更の強制を撤去し招待リンク方式にする | 一時パスワードと併存 | 管理者が他人の秘密を持たない | `mustChangePasswordFence` を撤去する |
| qa-login-v2-security-web-004 | `trustDevice` を使わない (推定) | 信頼端末で 30 日 2FA を省く | 管理者の必須を素通りさせない | TOTP 設定済みの利用者はログインのたびにコードを入れる |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) の中に Better Auth を置く。追加の外部サービスは Google と Resend だけ。
- Migration sequence: 追加のみの migration で認証表と招待表・`mfa_setup_token` を作る → 既存 users を INSERT ... SELECT で複写し PBKDF2 を `account.password` へ形式ごと移す → Better Auth と関門を載せ、`authGuard` / `adminGuard` を差し替える → 契約テストと関門のテストを緑にする → 旧 Cookie の経路と `mustChangePasswordFence` を撤去する。一時パスワードのままの利用者には招待を出し直す (dec-login-v2-onboarding の注意)。
- Rollback trigger/procedure: 契約テストか関門のテストが落ちたら差し戻す。配信済みなら Worker を直前版へ戻す。旧表・旧列は削除していないので旧経路に戻せる。手順は docs に置く (G7、`architecture/login-v2-maintenance-ops.md`)。

## Risks and verification

- Risk (medium、評価の既知課題 — plan で解決する): MFA 設定を**始める**入口が未定義。セッションを持たない管理者へ TOTP の秘密鍵・`totpURI`・復旧コードを出す API (`/api/auth/mfa-setup/start` 相当) が無い。better-auth 1.7.0 の `/two-factor/enable` は sessionMiddleware を掛けており使えないため、秘密鍵の生成・twoFactor 表への暗号化保存・復旧コードの生成をアプリ側で書く必要がある。あわせて (a) `session.create.before` が偽を返すと `/sign-in/email` は `FAILED_TO_CREATE_SESSION` (401) を投げるので、設定トークンを応答に載せる手段 (APIError の本文か hooks.after での置き換え) が未定、(b) database-web-005 の「トークンの消費・TOTP 有効化・セッション作成を同じ D1 batch」は、セッションが `internalAdapter.createSession` 経由で書かれるため batch に入るか未確認。評価の修正案は、消費と `twoFactorEnabled=true` を 1 batch にし、セッションはそのあと作り、途中失敗でも再試行できる順序にすること。関門が拒否するので TOTP 前のセッションという穴にはならないが、決定 -006 で必須になった経路が完結しない (`system-spec/completeness-findings.json` の medium)。
- Risk (low、評価の既知課題): `dont_remember` Cookie は Better Auth の secret で署名したもの (`ctx.setSignedCookie`) でなければ戻りの処理が読まない (`getSignedCookie`)。認可開始 (`/sign-in/social` の hooks.before など) で署名付きで付けること。
- Risk (low、評価の既知課題): G5・O6 の「未設定の管理者は次回ログインで設定を求める」の字面が決定 -006 (登録直後もセッションを出さない) と未整合で、O6 の測定は招待の登録直後を含まない。本書は決定 -006 に従い、テストは登録直後を含める。
- Risk/assumption: 1.7.0 で確かめた挙動が固定版 v1.7.5 で変わっていると、保持なしの延長・Google の保持なし・自動ログインの抑止のどれかが崩れる。上のテストで固定する。
- Risk/assumption: アプリ独自の `/api/auth/mfa-setup/*` などは Better Auth の `/api/auth/*` ハンドラと同じ接頭辞に載るため、登録順を誤るとハンドラに吸われる (推定)。登録順をテストで確かめる。
- Architecture fitness test: 利用者作成の経路が `user.create.before` を通らないものが 0 件。TOTP 未設定の管理者で `/callback/google` と MFA 設定の完了以外の経路からの session 行が 0 件。`kanjo_session` の署名経路と `mustChangePasswordFence` が 0 件。
- Load/failure/security validation: 停止した利用者の既存セッションが 401。再設定の完了で既存セッションが全て 401。非管理者の `/api/admin/*` が 403、最後の管理者の停止が 409。
