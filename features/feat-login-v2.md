---
graph_node_id: "feat-login-v2"
artifact_kind: "feature"
artifact_subtypes: []
title: "ログイン画面 v2 (01-login-v2) の作り直しと Better Auth への移行 (Google・招待・再設定・連携・TOTP)"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["login-v2", "auth", "better-auth", "mfa", "invite", "feature"]
file_path: "features/feat-login-v2.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fa8cf87fa96e8e6da32a9f874722d101d61e8a2f3f7153239d41c9154d29fc40"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-login-v2.md", "source_version": "0.1.11", "source_digest": "8ffdbded85951b5f951f9be6d9ccba7736fef504463004bc973f33f696ce9778", "imported_at": "2026-09-21T14:42:36Z"}
created_at: "2026-09-21T14:42:36Z"
updated_at: "2026-09-21T14:42:36Z"
depends_on: ["spec-login-v2"]
related_nodes: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", "design/FINAL-UI/images/01-login-v2.png", "docs/data-schema.md", "docs/design-system.md", "docs/runbooks/account-login-operations.md", "docs/ui-decisions.md", "migrations", "packages/api/package.json", "packages/api/src/account-login.test.ts", "packages/api/src/audit-log.ts", "packages/api/src/auth.test-support.ts", "packages/api/src/auth.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.test.ts", "packages/api/src/index.ts", "packages/api/src/login-rate-limit.test.ts", "packages/api/src/login-rate-limit.ts", "packages/api/src/password-hash-workerd.test.ts", "packages/api/src/public-validation.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/routes/auth.ts", "packages/api/src/routes/settings.ts", "packages/api/src/schema-guard.ts", "packages/api/src/users.ts", "packages/api/wrangler.jsonc", "packages/core/src/improvement.ts", "packages/web/package.json", "packages/web/src/App.tsx", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/account-login.dom.test.tsx", "packages/web/src/api-client.ts", "packages/web/src/api.ts", "packages/web/src/components/UserAdmin.tsx", "packages/web/src/main.tsx", "packages/web/src/pages/Login.tsx", "packages/web/src/pages/PasswordChange.tsx", "packages/web/src/pages/Settings.tsx", "packages/web/src/routeMetadata.ts", "specs/spec-login-v2.md"]
purpose: "金融明細を預かる入口を、テナント管理者に招待された本人だけが、自分で選んだ認証手段 (Google アカウント、またはメールアドレスとパスワード) で入れる場にする。管理者は他人の秘密 (仮パスワード) を一切持たず、招待はメールのリンクで本人に届く。本人はパスワードを自分で再設定でき、同じメールアドレスの Google とパスワードは再認証とメール確認を経て 1 つのアカウントに連携でき、パスワードでのログインには TOTP を重ねる (管理者は必須、一般は任意)。ログイン画面は何が守られるかと稼働状況・ヘルプ・プライバシーをログイン前に示す。保守者に対しては、認証を Better Auth の正規の機能に寄せて自前の暗号処理 (kanjo_session の署名・世代照合・一時パスワード) を撤去し、既存 20 画面と API の認証契約 (401/403/409・監査の actor 記録) を同じ契約テストで守る。"
goal: "/login が 01-login-v2.png の全構成要素 (ロゴと見出し・説明・Googleでログイン・区切り・メールとパスワードのフォーム (表示切替・保持のチェック・パスワードをお忘れの方)・招待の囲み・連携の囲み・安心 3 項目・フッター (稼働状況・ヘルプ・プライバシー)) を画像と完全一致の文言でトークンと共通部品により描画し、送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付の 6 状態を持ち、未認証で /invite/accept・/reset-password・/mfa・/help・/privacy に到達でき、認証基盤が Better Auth v1.7.5 (メールとパスワード・Google・D1 の session 表・TOTP と復旧コード・連携) へ移って自前の署名と一時パスワードと初回変更の強制が 0 件になり、既存の PBKDF2 利用者が再設定なしでログインでき、TOTP 未設定の管理者はパスワードでのログインでも招待の登録直後でも設定を終えるまでセッションを得ず、招待・再送・再設定・MFA の各入口にレート制限と列挙防止が効き、migration 0048 が既存行を書き換えず、既存 20 画面の認証ガードと契約テスト (401/403/409・actor) が緑のままの状態。"
scope_in: ["/login の作り直し (01-login-v2.png の全構成要素と、送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付の 6 状態)。文言は画像と完全一致", "未認証で到達できる画面の新設: /invite/accept・/reset-password・/mfa (設定と入力)・/help・/privacy。公開経路以外の未認証は /login?next= へ", "設定画面のアカウント欄に連携 (追加・解除) と MFA (有効化・無効化・復旧コードの再発行) を置き、利用者管理を招待の作成・再送・取消と状態表示に作り直す", "Better Auth (v1.7.5 固定) の導入: メールとパスワード・Google (OIDC)・D1 の session 表・twoFactor (TOTP と復旧コード)・アカウント連携。createAuthClient は web の container に閉じる", "自前認証の撤去: kanjo_session の署名と世代照合、一時パスワードの発行、初回変更の強制 (mustChangePasswordFence・PasswordChange の forced 表示・403 password_change_required)、一時パスワードの掃除", "migration 0048: 既存 users と PBKDF2 ハッシュの Better Auth の表への複写 (既存行を書き換えない)、招待・MFA 設定トークンの表", "招待の API、ログイン画面からの再送依頼・再設定依頼、MFA 設定の開始と完了の API、稼働状態 API (GET /api/status)", "Resend によるメール送信 (招待・再設定・連携確認) を sendMail(to, template, params) の 1 関数に閉じ、テストで差し替える", "レート制限と列挙防止の新しい入口 (MFA・再送・再設定・MFA 設定) への拡張と、監査ログの新しい action", "docs の更新: 移行と戻し、secret、Google Cloud Console、Resend、締め出し (最後の管理者の停止・MFA 喪失) からの復旧、プライバシー"]
scope_out: ["自己登録 (サインアップ)。招待制だけを保つ (U7)", "Google 以外のソーシャルログインと SAML などの企業 SSO", "パスキー (WebAuthn) と SMS の MFA。MFA は TOTP だけ (decision-003)", "信頼端末 (trustDevice)。管理者の MFA 必須を素通りさせないため使わない (security-web-004)", "複数テナント (既存の単一テナント 'default' の管理者を指す)", "外部の状況ページサービスとの連携 (稼働状態は自前の GET /api/status)", "独自ドメインの取得と DNS 設定そのもの (手順だけを docs に書く)", "web 以外のプラットフォーム", "旧表 (users・旧 audit の列など) の削除 (本サイクルでは消さない。C3)", "Cloudflare Access のサーバ側検証経路の変更 (2026-09-11 の利用者決定どおり残置。C9)"]
acceptance: ["S1 (G1): /login に 01-login-v2.png の構成要素がすべて出て、文言は画像と完全一致、色・余白・部品はトークンと共通部品経由で直書き色の lint が 0 件。送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付の 6 状態を持つ。", "S2 (G2/G7): Better Auth へ移しても、未認証の /api/* が 401、停止利用者の既存セッションが 401、非管理者の管理 API が 403、最後の管理者の停止が 409。既存の PBKDF2 利用者が再設定なしでログインできる。旧 kanjo_session の署名経路が 0 件。", "S3 (G3): 招待された本人がメールのリンクから Google かパスワードを選んで登録を完了できる。管理者がパスワードを設定する経路が 0 件。再送依頼の応答で招待の有無が分からない。自己登録の経路が 0 件。", "S4 (G4): 本人がメールで再設定を完了すると既存セッションが全て失効し、応答から登録の有無が分からない。連携は再認証とメール確認を経たときだけ成立する。", "S5 (G5): TOTP 未設定の管理者は、パスワードでのログインでも招待のパスワード登録直後でも TOTP の設定を終えるまでセッションを得ない。TOTP 設定済みの利用者はコード入力を経てだけ得る。Google でログインした管理者には TOTP を求めない。各入口で連続失敗がロックされる。", "S6 (G6): 未認証で稼働状態・ヘルプ・プライバシーが見られ、稼働状態の応答に内部情報が含まれない。", "S7 (G7): 既存 20 画面の認証ガードと契約テストが緑のまま。migration は既存行を書き換えない。旧経路への戻し手順が docs にある。既知の逸脱・未実施・一部適合は PASS に数えない。"]
architecture_refs: ["arch-login-v2-ui-ux", "arch-login-v2-frontend", "arch-login-v2-backend", "arch-login-v2-database", "arch-login-v2-auth", "arch-login-v2-security", "arch-login-v2-infrastructure", "arch-login-v2-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "画面・Better Auth への移行・招待と再設定と MFA の API・migration 0048 は、同じ認証契約 (誰がどの手段でいつセッションを得るか、401/403/409 と actor) を起点に連鎖する 1 つの価値単位で、画面だけ・基盤だけでは『招待された本人だけが自分の手段で入れ、管理者が他人の秘密を持たない』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-login-v2.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:42:36Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]
---

# 目的

金融明細を預かる入口を、テナント管理者に招待された本人だけが、自分で選んだ認証手段 (Google アカウント、またはメールアドレスとパスワード) で入れる場にする。管理者は他人の秘密 (仮パスワード) を一切持たず、招待はメールのリンクで本人に届く。本人はパスワードを自分で再設定でき、同じメールアドレスの Google とパスワードは再認証とメール確認を経て 1 つのアカウントに連携でき、パスワードでのログインには TOTP を重ねる (管理者は必須、一般は任意)。ログイン画面は何が守られるかと稼働状況・ヘルプ・プライバシーをログイン前に示す。

保守者に対しては、認証を Better Auth の正規の機能に寄せて自前の暗号処理 (`kanjo_session` の署名・世代照合・一時パスワード) を撤去し、既存 20 画面と API の認証契約 (401/403/409・監査の actor 記録) を同じ契約テストで守る。

規範 (要件・画面の文言・認証フロー・確定意思決定・API 契約・migration) の正本は `specs/spec-login-v2.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/login が 01-login-v2.png の全構成要素を画像と完全一致の文言でトークンと共通部品により描画し、6 状態を持ち、未認証で `/invite/accept`・`/reset-password`・`/mfa`・`/help`・`/privacy` に到達できる。認証基盤は Better Auth v1.7.5 へ移り、自前の署名・一時パスワード・初回変更の強制が 0 件になる。既存の PBKDF2 利用者は再設定なしでログインでき、TOTP 未設定の管理者はパスワードでのログインでも招待の登録直後でも設定を終えるまでセッションを得ない。招待・再送・再設定・MFA の各入口にレート制限と列挙防止が効き、migration 0048 は既存行を書き換えず、既存 20 画面の認証ガードと契約テストは緑のままである。

## スコープ

- スコープ内:
  - `/login` の作り直し (画像の全構成要素と 6 状態、文言は画像と完全一致)
  - 未認証で到達できる画面の新設 (`/invite/accept`・`/reset-password`・`/mfa`・`/help`・`/privacy`)。公開経路以外の未認証は `/login?next=` へ
  - 設定画面のアカウント欄 (連携と MFA) と、利用者管理の招待方式への作り直し
  - Better Auth (v1.7.5 固定) の導入と、`createAuthClient` の container への封じ込め
  - 自前認証の撤去 (`kanjo_session` の署名と世代照合、一時パスワード、`mustChangePasswordFence`、一時パスワードの掃除)
  - migration 0048 (既存 users と PBKDF2 ハッシュの複写、招待・MFA 設定トークンの表)
  - 招待・再送・再設定・MFA 設定の開始と完了・稼働状態の API
  - `sendMail(to, template, params)` による Resend 送信 (テストで差し替える)
  - 新しい入口へのレート制限と列挙防止の拡張、監査ログの新しい action
  - docs (移行と戻し、secret、Google Cloud Console、Resend、締め出しからの復旧、プライバシー)
- スコープ外:
  - 自己登録、Google 以外のソーシャルログイン、企業 SSO
  - パスキーと SMS の MFA、信頼端末 (trustDevice)
  - 複数テナント、外部の状況ページサービス、独自ドメインと DNS の設定そのもの
  - web 以外のプラットフォーム
  - 旧表・旧列の削除 (C3)、Cloudflare Access の検証経路の変更 (C9)

## 受入

- [ ] S1 (G1): /login に画像の構成要素がすべて出て文言は完全一致、直書き色の lint が 0 件。6 状態を持つ。
- [ ] S2 (G2/G7): 未認証の `/api/*` が 401、停止利用者の既存セッションが 401、非管理者の管理 API が 403、最後の管理者の停止が 409。既存の PBKDF2 利用者が再設定なしでログインできる。旧 `kanjo_session` の署名経路が 0 件。
- [ ] S3 (G3): 招待された本人がメールのリンクから Google かパスワードで登録を完了できる。管理者がパスワードを設定する経路・自己登録の経路が 0 件。再送依頼の応答で招待の有無が分からない。
- [ ] S4 (G4): 再設定の完了で既存セッションが全て失効し、応答から登録の有無が分からない。連携は再認証とメール確認を経たときだけ成立する。
- [ ] S5 (G5): TOTP 未設定の管理者は、パスワードでのログインでも招待の登録直後でも設定を終えるまでセッションを得ない。Google でログインした管理者には TOTP を求めない。各入口で連続失敗がロックされる。
- [ ] S6 (G6): 未認証で稼働状態・ヘルプ・プライバシーが見られ、稼働状態の応答に内部情報が含まれない。
- [ ] S7 (G7): 既存 20 画面の認証ガードと契約テストが緑のまま。migration は既存行を書き換えない。旧経路への戻し手順が docs にある。

受入の詳細 (AT-01〜AT-15) は `specs/spec-login-v2.md` の「テストと受入条件」を正本とし、本書へ複製しない。

## アーキテクチャ参照

- `architecture_refs`: `arch-login-v2-ui-ux`, `arch-login-v2-frontend`, `arch-login-v2-backend`, `arch-login-v2-database`, `arch-login-v2-auth`, `arch-login-v2-security`, `arch-login-v2-infrastructure`, `arch-login-v2-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/login-v2-*.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-login-v2` (feature ノードへの依存は無い)
- 依存理由: Better Auth の設定 (連携は再認証と確認メールを経た linkSocial だけ、自己登録の封鎖、管理者の MFA 関門、保持の 30 日と 12 時間) と、招待・再設定・MFA 設定のトークンの寿命と保存形式が確定していないと、API 応答・migration の列・セッションの発行条件・テストの期待値が実装中に揺れるため。
- 既存 feature との関係: `feat-account-login` (旧ログイン、01-login.png、自前認証) を本 feature が置き換える。旧 feature の成果 (PBKDF2 ハッシュ・レート制限・列挙防止・401/403/409 の契約) は本 feature の「残す」側として契約テストで引き継ぎ、一時パスワード・初回変更の強制・`kanjo_session` は本 feature が撤去する。旧 feature は実装済みで、本 feature はその完了を前提にするだけなので graph の `depends_on` 辺は張らない (旧 feature の completion_evidence が open のままでも本 feature を ready に保つため)。機能は重複させない。
- 後続: 無し。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-login-v2` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-login-v2 --feature-context features/feat-login-v2.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-login-v2` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S7 の evidence が揃う場合だけ done にする。
- 前提条件として持ち越す既知の課題 (`specs/spec-login-v2.md` の「既知の課題」が正本):
  - K-1 (medium): TOTP 未設定の管理者が設定トークンで TOTP の設定を始める入口 (`POST /api/auth/mfa-setup/start` 案)、`FAILED_TO_CREATE_SESSION` (401) のときに設定トークンを返す手段 (Q-1)、トークンの消費とセッション作成を同じ D1 batch に置けるか。MFA の関門を実装する task の前提条件とし、固定版 v1.7.5 で hooks.after が応答を置き換えられるかを先に確かめる。
  - K-4: Google の保持なしは `/sign-in/social` の hooks.before で `ctx.setSignedCookie` により Better Auth の secret で署名した `dont_remember` を付ける。AT-06 で確かめる。
  - K-5: `password_login_rate_limits.scope_kind` と `audit_log.action` の CHECK 拡張は表の再構築になり「追加のみ」と字面で衝突する。0034・0039 の前例どおり値を変えずに再構築するか新しい表を足すかを、migration の task で決める。
  - K-6: 招待の消費と利用者作成の整合 (アダプタ経由の作成を batch に入れられるか)。K-1 (b) と同じ順序設計で解く。
  - K-7: 復旧コードをハッシュで保存できるかを固定版の D1 の行で確かめ、できなければ生成と照合をアプリ側で書く。
  - K-9: 使う Better Auth の API (hooks・databaseHooks・twoFactor・accountLinking・setSignedCookie) を実装前に固定版のソースか docs で確かめ、テストに固定する。
  - K-2・K-3・K-8 は system-spec 側の記録の揃えで、実装を止めない。
- 正本内の食い違い (plan で片側に寄せる):
  - 再設定トークン: backend-002 は独自に発行、database-004 は Better Auth の verification 表を使う。どちらに寄せるかを backend と database の task で揃える。
  - frontend-web-002 (`lib/auth-client.ts` の薄い関数) と frontend-web-006 (`createAuthClient` を container に閉じる) は、後から置き換えた -006 に従う。
  - Cookie の SameSite は旧 Strict から Lax へ変わる (OAuth の戻りに要る)。旧仕様のテストの期待値を更新する。
- 未決事項 Q-1〜Q-17 は `specs/spec-login-v2.md` の「未決事項 (plan で決める)」を正本とし、本書の案の値 (Q-17 の agent 推定値を含む) で実装を進める。利用者が別の値を選んだら system-spec を直してから spec を直す。
- resource_scope の引き方: 認証の撤去は `auth.ts`・`users.ts`・`routes/auth.ts`・`routes/admin-users.ts` だけでなく、`kanjo_session` や `mustChangePassword` を参照するテストと core (`packages/core/src/improvement.ts`) にも及ぶため、先に scope へ含めた。plan では各 task の scope について、export 名の呼び出し元・import している側・型で結ばれた宣言を同じ手順で引くこと。
- リリース順: secret の設定 → Migrate (0048) → Deploy。移行後は全利用者が 1 回ログインし直す。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
