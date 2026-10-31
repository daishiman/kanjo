# ログイン画面 v2 — 設計判断の記録

本書の「現行実装」節と[`アカウント認証運用`](../runbooks/account-login-operations.md)を、稼働中のLogin v2への入口とする。
`specs/spec-login-v2.md`、`.dev-graph/plans/feature-package-feat-login-v2/goal-spec.json`、`architecture/login-v2-*.md`は
実装着手時に凍結した履歴資料であり、現行コードと食い違う場合のruntime正本ではない。
実装 task（SYS-LOGIN-V2-P04 以降）が着手前に読む前提と、各 phase の記録を 1 冊に集める。

- 第1章 着手時ベースラインと前提条件（SYS-LOGIN-V2-P01）
- 第2章 設計判断（SYS-LOGIN-V2-P02）
- 第3章 契約の独立レビュー（SYS-LOGIN-V2-P03）
- 第4章以降 実行記録・検証・監査・レビュー・証跡・配信（P06〜P13）

---

## 現行実装（2026-09-22）

- 認証モードは`resolveAuthMode`の1か所で判定する。Accessは`ACCESS_AUD`と`ACCESS_TEAM_DOMAIN`の対でだけ有効で、
  片側設定はfail-closed。Access時は検証済みassertionで`/api/auth/me`だけを返し、他の`/api/auth/*`は
  `access_mode`で閉じる。deployも同じ対を検査して値を渡す。
- `must_change_password=1`の旧利用者は0059で`user`/`account`の双方から除外し、通常招待へ移す。
- MFA設定完了はtoken消費・user・factorを単一D1 batchに置き、並行消費と途中失敗を統合テストで固定する。
- 招待再送は共通のrotate+delivery処理を使い、配送失敗なら自分が書いたtokenだけを旧値へCAS復元する。
- 本人詳細DTO（`AccountUserDetails`）と管理一覧DTO（`AdminUserSummary`）を分け、MFA部品と公開route方針は
  pageから独立した正本へ置く。

以降のP01/P02は判断の経緯として保持する。運用・復旧・rollbackの安全条件はrunbookを正本とする。

---

## 第1章 着手時ベースラインと前提条件（P01）

### 1.1 入力の固定

| 項目 | 値 |
|---|---|
| goal-spec の readiness_pin | status=complete、system-spec-harness v0.1.14、checked_at 2026-09-21T14:42:36Z |
| readiness_pin の source_digest | `sha256:fa8cf87fa96e8e6da32a9f874722d101d61e8a2f3f7153239d41c9154d29fc40` |
| 取り込んだ main | f0e5a3b（AI分析画面 #66 まで） |
| 固定する依存 | `better-auth@1.7.5`（exact） |

### 1.2 目的（goal-spec purpose の要約）

金融明細を預かる入口を、管理者に招待された本人だけが、自分で選んだ手段（Google、またはメールアドレスとパスワード）で入れる場にする。
管理者は他人の秘密（仮パスワード）を持たない。招待はメールのリンクで本人に届く。
本人はパスワードを自分で再設定できる。同じメールの Google とパスワードは、再認証とメール確認を経て 1 つのアカウントに連携できる。
パスワードでのログインには TOTP を重ねる（管理者は必須、一般は任意）。
保守者に対しては、自前の暗号処理（`kanjo_session` の署名・世代照合・一時パスワード）を撤去し、Better Auth の正規の機能に寄せる。既存 20 画面と API の認証契約（401/403/409・監査の actor）は同じ契約テストで守る。

### 1.3 成功状態 S1〜S7（goal-spec acceptance）

| ID | 検証可能な文 | 対応する AT |
|---|---|---|
| S1 | `/login` に 01-login-v2.png の構成要素がすべて出て、文言は画像と完全一致する。直書き色の lint が 0 件。送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付の 6 状態を持つ。 | AT-01〜03 |
| S2 | 未認証の `/api/*` が 401、停止利用者の既存セッションが 401、非管理者の管理 API が 403、最後の管理者の停止が 409。既存 PBKDF2 の利用者が再設定なしでログインできる。旧 `kanjo_session` の署名経路が 0 件。 | AT-04〜06 |
| S3 | 招待された本人がメールのリンクから Google かパスワードで登録を完了できる。管理者がパスワードを設定する経路が 0 件。再送依頼の応答で招待の有無が分からない。自己登録の経路が 0 件。 | AT-07・08 |
| S4 | 本人がメールで再設定を完了すると既存セッションがすべて失効し、応答から登録の有無が分からない。連携は再認証とメール確認を経たときだけ成立する。 | AT-09 |
| S5 | TOTP 未設定の管理者は、パスワードのログインでも招待のパスワード登録直後でも、設定を終えるまでセッションを得ない。TOTP 設定済みの利用者はコード入力を経てだけ得る。Google の管理者には TOTP を求めない。各入口で連続失敗がロックされる。 | AT-10・11 |
| S6 | 未認証で稼働状態・ヘルプ・プライバシーが見られ、稼働状態の応答に内部情報が含まれない。 | AT-12 |
| S7 | 既存 20 画面の認証ガードと契約テストが緑のまま。migration は既存行を書き換えない。戻し手順が docs にある。既知の逸脱・未実施・一部適合は PASS に数えない。 | AT-13〜15 |

### 1.4 受入条件 AT-01〜AT-15（仕様書 §受入条件）

| ID | PASS と言える条件 | 検証の場 |
|---|---|---|
| AT-01 | `/login` に §7.1 の 10 領域と §7.2 の全文言が完全一致で出る。ロゴはカードの外の上にある。 | DOM |
| AT-02 | 6 状態が出る。 | DOM |
| AT-03 | 直書き色の lint 0 件。lint・typecheck・初期 JS 予算を通す。 | CI |
| AT-04 | 既存 account-login の契約テスト（401・停止 401・403・409・actor）が Better Auth 版で緑。 | API |
| AT-05 | 既存 PBKDF2 の利用者が再設定なしでログインできる。 | API・migration |
| AT-06 | 保持ありは Max-Age=30 日。保持なしは Max-Age も Expires も無く、12 時間後に 401、途中で延長されない。パスワードと Google の両方。 | API |
| AT-07 | Google で `email_verified=false`・招待と登録の無いメール・停止中・state/PKCE/nonce の不一致が拒否される。自己登録の経路が 0 件。 | API |
| AT-08 | 招待作成→メール（差し替え）→Google かパスワードで登録、の 2 経路が完結する。期限切れ・使用済み・取消で拒否。D1 にトークンのハッシュだけ。一時パスワードの API・画面が 0 件。再送依頼の応答が招待の有無で変わらない。 | API・DOM |
| AT-09 | 再設定で既存セッションが全て 401。登録の有無で応答が変わらない。連携は再認証とメール確認の両方を経ないと成立しない。別メール・未確認の Google は連携されない。連携の追加・解除が audit_log に残る。 | API |
| AT-10 | TOTP 未設定の管理者はパスワードのログインでも招待のパスワード登録直後でも session 行 0 件。設定トークンで TOTP を設定・検証すると発行される。Google の管理者は TOTP なしで発行。一般は有効化した場合だけ求められる。 | API |
| AT-11 | 復旧コードは 1 回限りで平文保存されない。ログイン・MFA・再送・再設定・MFA 設定の各入口で連続失敗がロックされ、他の利用者を阻害しない。 | API・D1 |
| AT-12 | 未認証で `GET /api/status` が 200 と `{status}` だけ。`/help`・`/privacy` が未認証で描かれ、プライバシーに外部送信先と利用目的・保存期間が載る。 | API・DOM |
| AT-13 | `/api/*` の mount 順序、Cloudflare Access の経路、`actor_user_id` が移行前と同じ。migration が既存行を 1 行も書き換えない（K-5 の結論に従う）。 | API・migration 検査 |
| AT-14 | 外部への送信先が Google と Resend だけ。ログに秘密が出ない。 | API・ログ検査 |
| AT-15 | 戻し手順・secret・Google・Resend・締め出しからの復旧の手順が docs にある。 | docs |

### 1.5 スコープ

対象（goal-spec scope_in の 10 項目）:

1. `/login` の作り直し（全構成要素と 6 状態、文言は画像と完全一致）
2. 未認証で到達できる `/invite/accept`・`/reset-password`・`/mfa`・`/help`・`/privacy` の新設。公開経路以外の未認証は `/login?next=` へ
3. 設定画面のアカウント欄（連携・MFA）と、招待の作成・再送・取消を持つ利用者管理
4. Better Auth v1.7.5 の導入（メールとパスワード・Google・D1 の session 表・twoFactor・連携）。`createAuthClient` は web の container に閉じる
5. 自前認証の撤去（`kanjo_session` の署名と世代照合、一時パスワード、初回変更の強制、一時パスワードの掃除）
6. migration（既存 users と PBKDF2 ハッシュの複写、招待・MFA 設定トークンの表）
7. 招待・再送依頼・再設定依頼・MFA 設定の開始と完了・`GET /api/status` の API
8. Resend によるメール送信を `sendMail(to, template, params)` の 1 関数に閉じる
9. レート制限と列挙防止の新しい入口への拡張と、新しい監査 action
10. docs の更新（移行と戻し、secret、Google Cloud Console、Resend、締め出しからの復旧、プライバシー）

対象外（goal-spec scope_out の 10 項目）: 自己登録、Google 以外のソーシャルログインと SAML、パスキーと SMS の MFA、trustDevice、複数テナント、外部の状況ページサービス、独自ドメインの取得と DNS 設定そのもの、web 以外の platform、旧表・旧列の削除、Cloudflare Access のサーバ側検証経路の変更。

### 1.6 architecture_refs（9 件）

`architecture/login-v2-ui-ux.md`・`-frontend.md`・`-backend.md`・`-database.md`・`-auth.md`・`-security.md`・`-infrastructure.md`・`-maintenance-ops.md`・`specs/spec-login-v2.md`。9 件とも実在し、goal-spec と `features/feat-login-v2.md` の列挙が一致することを確かめた。

### 1.7 前提条件と未解決事項（P02 へ引き継ぐ）

本章は書き写すだけで、解決は P02 が行う。

| ID | 重さ | 内容 | 解決する phase |
|---|---|---|---|
| K-1 | medium | TOTP 未設定の管理者が設定トークンで TOTP の設定を始める入口が無い。`/two-factor/enable` は sessionMiddleware を要するため使えない。`session.create.before` が拒否すると `/sign-in/email` は `FAILED_TO_CREATE_SESSION`（401）を投げ、設定トークンを応答に載せる手段（APIError の本文か hooks.after か）が未確定。トークン消費・`twoFactorEnabled=true`・セッション作成を同じ D1 batch に置けるかも未確認。 | P02 |
| K-5 | low | `password_login_rate_limits.scope_kind` と `audit_log.action` の CHECK が 0039 で固定されている。新しい scope と action を足すには表の再構築が要り、migration の「追加のみ」（C3）と字面で衝突する。0034・0039 の前例どおり値を変えずに再構築するか、新しい表を足すか。 | P02 |
| reset-token | — | 再設定トークンの発行元が正本内で食い違う。**案 A（backend-002）**: アプリが独自に発行し、専用の表にハッシュで持つ。**案 B（database-004）**: Better Auth 組込みの `requestPasswordReset` と verification 表を使う。 | P02 で一方に決める |
| frontend-002 対 -006 | — | 認証呼出しを `lib/auth-client.ts` の薄い関数で包む（-002）か、`createAuthClient` を container に閉じる（-006）か。**後から置き換えた -006 を優先する**（goal-spec で resolved_precedence_noted）。 | 既定方針として確定 |
| SameSite=Lax | — | Cookie の SameSite を旧 Strict から Lax に変える（Google OAuth の戻りに必要。auth-web-007、agent 推定）。旧仕様のテストの期待値をこの変更に合わせて更新する。 | P04・P05 |
| K-4 | low | Google の戻りが読む `dont_remember` Cookie は Better Auth の secret で署名しないと読まれない。認可開始の hooks.before で `ctx.setSignedCookie` を使う。 | P02・P05 |
| K-6 | low | 招待の消費と利用者作成を同じ D1 batch に置けるかが未確認（作成はアダプタ経由）。パスワードは「作成→条件付き UPDATE→0 行なら作成を消す」、Google は `user.create.after` で条件付き UPDATE、の順で整合を保つ。 | P02・P05 |
| K-7 | low | 復旧コードをハッシュで保存できるかが docs に無い。固定版で D1 の保存形式を確かめ、できなければアプリ側で生成と照合を書く。 | P02・P05 |
| K-9 | low | fetched-references の better-auth はリリースページ 1 件だけ。hooks・databaseHooks・twoFactor・accountLinking・setSignedCookie を固定版のソースで確かめ、テストに固定する。 | P02・P04 |

K-2（G5 と decision-006 の字面の食い違い）・K-3（保持のチェックが Google にも効く）・K-8（decision-005 の記録粒度）は仕様書が既に結論を持つ（AT-10 に招待の登録直後を含める／保持の既定をチェックありにする／影響なし）。本 feature はその結論に従う。

### 1.8 migration 番号

仕様書と task は `0048` を予定番号として書いている。取り込んだ main で `0048_ai_task_stages.sql` と `0049_ai_report_invariants.sql` が使用済みのため、実ファイルは **`migrations/0059_login_v2_better_auth.sql`** とする。
凍結済みの文書（仕様書・architecture・task 仕様書）の `0048` 表記は予定番号として据え置き、書き換えない。本書以降の記録では実ファイル名を使う。

---

## 第2章 設計判断（P02）

判断の根拠は、固定版 `better-auth@1.7.5` の配布物（`node_modules/better-auth/dist` と、依存する `better-call`）で読んだ。行番号は版ごとに変わるので、ファイル名と関数名で示す。P04 では、この章の各項に対応するテストを置き、固定版の挙動をテストで固定する（K-9）。

### 2.1 D1 では対話的トランザクションを使わない（K-1 (b)・K-6）

- 確かめたこと: D1 のアダプタは対話的トランザクションを使えない。アダプタ経由の書込み（`createSession`・`signUpEmail`・`createAccount`）は、アプリが組む D1 batch に入れられない。
- 決定: アダプタ経由の書込みとアプリ独自の表への書込みを、1 つの batch に混ぜない。整合は「条件付き UPDATE の更新行数」と「失敗したときの補償」の順序で保つ。
  - 招待のパスワード登録（K-6）: 招待を引く → `signUpEmail`（`user.create.before` が有効な招待と役割を確かめる）→ `UPDATE invitations … WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL` → 更新が 0 行なら、作った user を削除して拒否する。
  - 招待の Google 登録（K-6）: `user.create.before` が有効な招待を確かめる。`user.create.after` で同じ条件付き UPDATE を行い、0 行なら作った user を削除して callback を失敗させる。
  - MFA 設定の完了（K-1 (b)）: 次の順で処理する。
    1. 初回のコードを検証する。
    2. アプリの D1 batch で、トークンの消費（条件付き UPDATE）、`user.twoFactorEnabled=1`、twoFactor 行の確定をまとめて行う。消費を最初の文に置き、後続文を直前文の`changes()=1`で鎖にする。こうすると並行する2回目の要求では後続文が効かず、途中のSQL失敗はbatch全体がrollbackする。
    3. `internalAdapter.createSession` でセッションを作る。
    3 が失敗しても TOTP は有効になっているので、`/login` から TOTP の経路でセッションを得られる。

### 2.2 関門と、設定トークンを返す手段（Q-1・K-1 (a)）

- 確かめたこと:
  - `databaseHooks.session.create.before` は `(data, ctx)` で呼ばれる。`ctx` はエンドポイントの文脈で、`path`・`body`・`getSignedCookie`・`context` を持つ。`false` を返すと `createSession` は `null` を返し、`/sign-in/email` は 401 `FAILED_TO_CREATE_SESSION` を投げる。
  - エンドポイントが投げた APIError は、`api/dispatch.mjs` で after フックより前に応答へ変わる。hooks.after の戻り値は `context.returned` を置き換える。
  - `better-call` の `toResponse` は、JSON 応答の `status` を初期値の status より優先する。そのため hooks.after で `ctx.json(body, { status: 200 })` を返せば、401 を 200 に置き換えられる。
  - 利用者の hooks.after が先に走り、plugin の after フックが後に走る。
- 決定:
  - 関門は `session.create.before` の 1 か所に置く。判定は core の純関数 `requiresTotpSetup({ role, twoFactorEnabled, path })` にする。`path` は `ctx.path` を使う。
    - 対象: `/sign-in/email`、`/sign-up/email`。
    - 対象外: `/callback/:id`（Google の管理者には TOTP を求めない）。
  - 停止中の利用者（`status='suspended'`）も、この関門で拒否する。
  - MFA 設定が理由で拒否するときは、次のように処理する。
    1. `mfa_setup_token` を発行する。未消費の古い行は消費済みにする。
    2. 要求単位の印を `ctx.context` に置く。`ctx.context` は要求ごとに作られるので、他の要求には漏れない。
  - `/sign-in/email` に一致する hooks.after は、印があれば応答を 200 `{ mfaSetupRequired: true, setupToken }` に置き換える。印が無い 401（`INVALID_EMAIL_OR_PASSWORD`・`FAILED_TO_CREATE_SESSION`）は、本文を `invalid_credentials` にそろえる。
  - 招待のパスワード登録はアプリ独自の経路なので、`signUpEmail` の後に同じ判定を直接呼び、設定トークンを返す。hooks.after は経由しない。
  - TOTP を設定済みの利用者では、既定の挙動になる。セッションがいったん作られ、twoFactor の after フックがそれを消して `twoFactorRedirect` を返す。関門が拒否したときは新しいセッションが無いので、twoFactor の after フックは何もしない。

### 2.3 MFA 設定の開始と復旧コード（K-1・K-7）

- 確かめたこと:
  - twoFactor plugin は、秘密鍵を `generateRandomString(32)` で作り、`symmetricEncrypt({ key: secretConfig, data })` で暗号化して twoFactor 行に置く。
  - 復旧コードは既定で 10 個作る。既定の `storeBackupCodes: "encrypted"` では、JSON 配列を同じ鍵で暗号化して置く。
  - 照合は、復号した一覧に平文のコードを当てる方式である。組込みの照合のままでは、ハッシュで保存できない。
- 決定:
  - `POST /api/auth/mfa-setup/start` はアプリ独自の経路にする。生成と暗号化には `better-auth/crypto` の `generateRandomString` と `symmetricEncrypt` を使い、鍵は `(await auth.$context).secretConfig` を使う。
  - twoFactor 行は未確定の状態で置く。同じトークンでもう一度呼ばれたら、同じ秘密鍵を返す。こうしておけば、設定の完了後に plugin の `verify-totp` と `verify-backup-code` がそのまま読める。
  - K-7: 復旧コードは既定の暗号化保存にする。NFR-03・AT-11 の「平文で保存しない」は、D1 の twoFactor 行に平文のコードが無いことで満たす。O6 の「ハッシュで保存する」は字義どおりには満たさないので、既知の逸脱 DEV-1 として扱う（2.9）。
  - アプリ側で照合を書き直す案は採らない。plugin の `verify-backup-code` を塞いで作り直すことになり、得るものより壊れる範囲のほうが大きい。

### 2.4 保持と期限（K-4・FR-13・BR-07・AT-06）

- 確かめたこと:
  - `createSession(userId, dontRememberMe)` は、保持なしのとき `expiresAt` を発行から **24 時間**にする。仕様の 12 時間とは違う。
  - Google の callback は、`createSession` に保持の指定を渡さない。そのためセッション行は 30 日になる。Cookie だけが署名付きの `dont_remember` を読み、Max-Age を外す。
  - `getSession` が延長を止めるのは、`dont_remember` の Cookie が送られてきたときだけである。Cookie が送られなければ 30 日まで延長し、Max-Age=30 日を付け直す。
- 決定:
  - session に追加の列 `rememberMe`（真偽）を持たせる。
  - 保持の有無は `session.create.before` で決める。
    - `/sign-in/email`: `ctx.body.rememberMe !== false` なら保持あり。
    - Google の callback: 署名付きの `dont_remember` Cookie があれば保持なし。
    - 保持なしのときは、`expiresAt` を発行から 12 時間に上書きする。
  - `session.update.before` では、`ctx.context.session` が保持なしなら `expiresAt` を現在の値のまま返す。こうして延長を止める。
  - Google の認可開始（`/sign-in/social`）の hooks.before では、`remember=0` のときに `ctx.setSignedCookie` で `dont_remember` を付ける（K-4）。Better Auth の secret で署名しないと、`getSignedCookie` は読まない。
  - `session.cookieCache` は使わない（Q-9）。

### 2.5 パスワード再設定のトークン（reset-token の食い違い）

- 確かめたこと:
  - 組込みの `requestPasswordReset` は、verification 行を作る（identifier は `reset-password:<token>`、value は userId、既定の期限は 1 時間）。完了は `resetPassword` が行い、`consumeVerificationValue` でトークンを 1 回限りで消費する。
  - identifier は、`verification.storeIdentifier` の `overrides` を使えば接頭辞ごとに `hashed`（SHA-256）にできる。
  - 組込みの `resetPassword` は、credential の account を持たない利用者（Google だけの人）にも、新しくパスワードの account を作る。
  - `revokeSessionsOnPasswordReset` を真にすると、全セッションを消す。
- 決定: 案 A と案 B を組み合わせる。
  - 依頼はアプリ独自の `POST /api/auth/password-reset/request` で受ける（backend-002）。
    - 常に 202 を返し、登録の有無を応答に出さない。
    - 有効（`status='active'`）で credential の account を持つ利用者にだけ、`internalAdapter.createVerificationValue` で組込みと同じ形の verification 行を作り、メールを送る。
    - 組込みの `/request-password-reset` は 404 で塞ぐ（Q-11）。
  - 完了は組込みの `POST /reset-password` を使う（database-004）。
    - `storeIdentifier: { default: "plain", overrides: { "reset-password:": "hashed" } }` にして、D1 にはトークンのハッシュだけを置く。
    - `revokeSessionsOnPasswordReset: true` にする（AT-09）。
  - 依頼の段階で「credential の account を持つ人」に絞るので、完了のときに新しい account が作られる経路は生じない。念のため hooks.before にも防御を置き、対象の利用者が credential の account を持たなければ 400 にする。

### 2.6 連携と自己登録（AT-07・AT-09）

- 確かめたこと:
  - `accountLinking.disableImplicitLinking === true` のとき、同じメールの既存利用者に Google を黙って紐づけない。
  - 明示の `linkSocial` はセッションが必須で、`accountLinking.enabled` と `allowDifferentEmails` を見る。
  - 最後の 1 つの account を解除できるのは、`allowUnlinkingAll` が真のときだけである。
- 決定:
  - `accountLinking` は `{ enabled: true, disableImplicitLinking: true, allowDifferentEmails: false }` にする。
  - 連携は、アプリ独自の再認証とメール確認（`link_confirmation_token`）を経た後に、セッション付きの `linkSocial` だけで行う。
  - Google の新規作成は `user.create.before` で有効な招待を確かめ、招待が無いメールは拒否する。
  - `email_verified=false` の Google は、`mapProfileToUser` と `user.create.before` の両方で拒否する。
  - `/sign-up/email` は Hono で 404 にする。招待の登録は、サーバ内部から `auth.api.signUpEmail` を呼ぶ。

### 2.7 CHECK の拡張（K-5）

- 確かめたこと:
  - `password_login_rate_limits.scope_kind` と `audit_log.action` は、0039 の CHECK で値が固定されている。
  - Deploy の自動適用の判定（`.github/scripts/plan-auto-migration.mjs`）は、`DROP TABLE`・`DELETE FROM`・`UPDATE … SET`・`ALTER TABLE … RENAME` を含む migration を止める。止まると承認の手続きと手動の Migrate が要る。
- 比較:

| 案 | migration に含む文 | Deploy の自動適用 | C3・AT-13（追加のみ） |
|---|---|---|---|
| (a) 0034・0039 の前例どおり表を作り直す | `CREATE`・`INSERT … SELECT`・`DROP TABLE`・`RENAME` | 止まる | 字面で衝突する |
| (b) 新しい表を足す | `CREATE TABLE`・`CREATE INDEX`・`INSERT … SELECT` | 通る | 字義どおり満たす |

- 決定: **(b) 新しい表を足す**。
  - `auth_audit_log`: 列は `audit_log` と同じ形にする。action の CHECK は、新しい action（MFA・招待・再設定・連携）だけを許す。既存の action（`auth_login`・`auth_login_failed`・`auth_logout`・`admin_user_*`）は、従来どおり `audit_log` に書く。
  - `auth_rate_limits`: Login v2のlogin・MFA・招待・再設定・statusを統合する。`password_login_rate_limits`は旧Workerへの非破壊rollback用に残すが、現行runtime・保守・監視は`auth_rate_limits`だけを使う。
  - 保持期間の掃除（`audit-log.ts`）の対象に `auth_audit_log` を加える。

### 2.8 その他の確定事項

| 項目 | 決定 | 根拠 |
|---|---|---|
| パスワードのハッシュ（Q-8） | `emailAndPassword.password.{hash, verify}` を既存の PBKDF2（`pbkdf2-sha256$…`）に差し替える | 既存の利用者が再設定なしで入れる（AT-05）。戻しても旧経路で読める |
| 複写（C3・Q-15） | `account.accountId = user.id`、`providerId='credential'`、`emailVerified=1` にする。`must_change_password=1` の利用者は user/accountの両方へ複写しない | credential無しのuserが同じメールへの招待を妨げる状態を作らない |
| rateLimit | Better Auth の `rateLimit.enabled=false` にし、既存のレート制限を広げて使う | 入口を 1 つにして、ロックと監査を効かせる |
| 塞ぐ経路（Q-11） | `/sign-up/email`・`/request-password-reset`・`/send-verification-email` と旧 `/api/auth/login` を、Hono で `auth.handler` より前に 404 にする | 仕様書の mount 順序 |
| auth の組立て | 要求ごとに `createAuth(env)` を作る | D1 のバインディングは env から来る。要求単位の印（2.2）が他の要求に漏れない |
| migration の実ファイル | `migrations/0059_login_v2_better_auth.sql` にし、`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を更新する | 1.8 |

### 2.9 P02 の結論

1.7 の各項目は次のとおり決着した。

| ID | 結論 | 節 |
|---|---|---|
| K-1 | 関門は `session.create.before`、トークンは hooks.after で 200 に置き換えて返す。完了は「検証 → アプリの batch → createSession」の順 | 2.1・2.2・2.3 |
| K-4 | 認可開始の hooks.before で `setSignedCookie` を使う。期限の 12 時間と延長の停止は databaseHooks で行う | 2.4 |
| K-5 | (b) 新しい表を足す | 2.7 |
| K-6 | 条件付き UPDATE と補償削除で整合を保つ | 2.1 |
| K-7 | 暗号化保存。ハッシュ保存は逸脱 DEV-1（第3章 3.2 で解消し、ハッシュ保存に改めた） | 2.3・3.2 |
| K-9 | 本章の「確かめたこと」を P04 のテストで固定する | 各節 |
| reset-token | 依頼はアプリ独自、完了は組込み（トークンはハッシュで保存） | 2.5 |
| frontend-002 対 -006 | -006 を採る（1.7 のとおり） | — |
| SameSite=Lax | P04 で旧テストの期待値を更新する | — |

未解決として残るのは次の 1 件だけで、既知の逸脱として扱う。

| ID | 内容 | 扱い |
|---|---|---|
| DEV-1 | 復旧コードをハッシュではなく暗号化で保存する。O6 の字面と異なるが、平文を保存しない条件は満たす | **解消**（第3章 3.2）。`storeBackupCodes` の encrypt/decrypt を差し替え、SHA-256 のハッシュで保存する |

## 第3章 契約の独立レビュー（P03）

第2章の設計を、独立したレビューで固定版 v1.7.5 のソースと突き合わせた。総合の判定は FAIL で、指摘は 12 件あった。本章では、各指摘を確かめた結果と、改めた設計を記録する。第2章と食い違う点は、本章を正とする。

### 3.1 指摘と是正

| ID | 重さ | 指摘 | 確かめた結果 | 是正 |
|---|---|---|---|---|
| R-1 | high | hooks.after では 401 を 200 にできない | 正しい。`api/dispatch.mjs` は handler の APIError を `{response, status}` に変え、after フックが本文を変えても status を保つ | `createAuth(env, scope)` に要求ごとの入れ物 `scope` を渡す。関門が設定トークンを出したら `scope.mfaSetup={setupToken,expiresAt}` を書く。Hono の `/api/auth/sign-in/email` のラッパーが `auth.handler` の後で `scope` を見て、200 `{mfaSetupRequired:true,setupToken,expiresAt}` を返す。HTTP の status が 200 であることを P04 のテストで固定する |
| R-2 | high | 保持なしが、2FA の検証経路と延長の経路で破れる | 正しい。`verify-two-factor` は `createSession(userId, !!dontRememberMe)` を呼び、body を持たない | `session.create.before` の判定を次のようにする。`/sign-in/email` では `body.rememberMe===false`。それ以外の経路（2FA の検証、Google の callback）では、署名付きの `dont_remember` Cookie を `ctx.getSignedCookie` で読む。結果を `rememberMe` 列（0/1）に入れ、保持なしなら `expiresAt` を発行から 12 時間にする。`session.update.before` は、保持なしのとき `expiresAt` を据え置く data を返す（false を返すと `getSession` が 401 になるので返さない）。authGuard は `getSession({returnHeaders:true})` で受け、Set-Cookie は保持ありのときだけ転送する |
| R-3 | medium | 関門を拒否側で書いており、今後増える経路を通してしまう | 正しい | 既定を拒否にする。TOTP 未設定の管理者に許すのは `/callback/google` と、明示の印を持つ `/mfa-setup/complete` だけにする。停止中の利用者は全経路で拒否する。判定は core の `requiresTotpSetup({role,twoFactorEnabled,path})` に置く |
| R-4 | medium | アプリ独自の経路がセッションと Cookie を自前で作ろうとしている | 正しい | mfa-setup/start・complete、invite/inspect・accept・resend-request、password-reset/request を Better Auth の自作 plugin（`createAuthEndpoint`）にする。complete は `internalAdapter.createSession(userId, !rememberMe, {rememberMe})` と `setSessionCookie` を使い、署名付きの Cookie を組込みと同じ形で出す。保持の指定は `mfa_setup_token.remember_me` 列に持つ（3.3） |
| R-5 | medium | 招待の承諾（パスワード）の 409 と next の返し方が仕様と合わない | 正しい | 先に同じメールの user があるかを確かめ、あれば 409 `user_exists`。user と account は `internalAdapter` で作る（`emailVerified=1`、自動ログインしない）。管理者には `next:'mfa_setup'` と設定トークン、一般には `next:'login'` を返す（仕様 §7.11） |
| R-6 | medium | 複写が再実行で重複する | 正しい | `INSERT … SELECT … WHERE NOT EXISTS` にし、id を決定的に作る（account は `'cred-'||users.id`） |
| R-7 | medium | 役割と状態を旧 users から読むと、二重の正本になる（Q-14） | 正しい。旧 users 表への外部キーは migration に 0 件で、参照は `users.ts` だけ | `role`・`status` を Better Auth の user の additionalFields に持つ。authGuard・adminGuard・最後の管理者の 409・actor は、すべて `user` 表で判定する。`users.ts` も `user` 表に向ける |
| R-8 | medium | DEV-1 を逸脱のまま残している | 解消できる。`storeBackupCodes` は `{encrypt, decrypt}` を受け、照合は `codes.includes(ctx.body.code)` | 3.2 |
| R-9 | medium | link-social を再認証とメール確認なしで呼べる | 正しい | hooks.before（`/link-social`）で、有効な一回限りの link grant（`x-kanjo-link-grant` header、query禁止）が無ければ拒否する |
| R-10 | low | 2.5 の「依頼は組込みを通さない」が仕様の字面と違う | 正しい。逸脱である | 依頼はアプリ独自の経路にし、32 バイトのトークンを SHA-256 で保存する（BR-11）。組込みの `/request-password-reset` は塞ぐ。仕様は「組込みを呼んで 202 に包む」とするが、組込みではトークンの長さと保存形式を BR-11 に合わせられない。この差を逸脱ではなく実装方式の選択として記録する（完了の経路は組込みのまま） |
| R-11 | low | AT-09 の「audit_log に残る」と 2.7 の別表が食い違う | 正しい | AT-09 の「audit_log」は、`audit_log` と `auth_audit_log` の和と読む。連携の action は `auth_audit_log` に書き、テストは両表の和で確かめる |
| R-12 | low | user を消したときの account・session の後始末が未検証 | 正しい | FK の `ON DELETE CASCADE` で消えることを P04 のテストで確かめる |

レビューで正しいと確かめられたもの: 関門が `ctx` の文脈を読めること、再設定の完了を組込みに任せること、TOTP の秘密鍵の暗号化、連携の設定値（`disableImplicitLinking`・`allowDifferentEmails=false`）、2.1 の D1 の扱い（対話的トランザクションを使わない）。

### 3.2 復旧コードのハッシュ保存（DEV-1 の解消）

- `twoFactor({ backupCodeOptions: { storeBackupCodes: { encrypt, decrypt } } })` を使う。
  - encrypt: JSON 配列の各コードを `"h:" + sha256hex(code)` にする。既に `h:` で始まるものはそのままにする（消費後の保存し直しで二重にハッシュしないため）。
  - decrypt: 保存値をそのまま返す。
- hooks.before（`/two-factor/verify-backup-code`）で、本文の `code` を `"h:" + sha256hex(code)` に置き換えた `{context:{body}}` を返す。組込みの照合（`includes`）と消費（条件付き更新）はそのまま働く。
- mfa-setup/complete が作る復旧コードも同じ形で保存し、平文は応答で 1 回だけ返す。
- これで O6 の「ハッシュで保存する」と NFR-03 の両方を満たす。逸脱は残らない。

### 3.3 追加の列

| 表 | 列 | 理由 |
|---|---|---|
| `mfa_setup_token` | `remember_me`（INTEGER 0/1、既定 1） | パスワード認証時の保持の指定を complete まで持ち越す（Q-1 の後半）。web から送り直させないので、改ざんで保持を延ばせない |
| `session` | `rememberMe`（INTEGER 0/1） | 延長の停止と Set-Cookie の転送の判定（R-2） |

どちらも追加のみで、既存の行は書き換えない（C3・AT-13）。

### 3.4 P03 の結論

- R-1〜R-12 はすべて是正の方針を決め、P04 のテストに落とす。
- DEV-1 は解消した。残る既知の逸脱は 0 件である。
- Q-14 は「user の additionalFields に持つ」に決めた。

## 第4章 実装と回帰テストの補完（P04・P05、2026-10-31）

既存のcore/API/DOM/migrationテストと実装を維持し、完了監査で見つかった不具合を修正した。
固定版Better Auth 1.7.5は継続し、migrationの実ファイルは `migrations/0059_login_v2_better_auth.sql` である。
着手時の0048という番号は凍結計画の履歴であり、本番に適用する番号ではない。

- Google profile変換は初回登録だけでなく再ログインと連携でも呼ばれるため、既存active利用者には消費済み招待を要求しない。既存DBのrole/statusを返し、新規だけで有効招待を調べる。
- 未確認Googleメール、停止利用者、未招待新規は拒否する。既存利用者への暗黙連携を許す変更はしていない。
- 本番設定helperは旧gh CLIでも動くREST APIに対応した。Variableの値はstdinで渡す。本人が確認したCloudflare Account/TokenをWrangler子プロセス環境へ固定し、読取確認に失敗したまま外部設定を書かない。
- `pnpm run auth:readiness` を追加した。ローカル設定だけを検査し、値を一切出力しない。不足があれば終了コード1と設定名を返す。実Google認証・配送・本番設定の確認とは分離する。

今回のRED→GREEN: Google再ログイン1件失敗→認証境界16件成功、旧gh helper2件失敗→回帰成功、送信元予約サブドメイン1件失敗→回帰成功。
過去のP04全テストが先行REDで作られた履歴は今回再現していないため、その履歴まで確認済みとはしない。

最新mainとの統合では、予算等が0050〜0058を使用済みだったためLogin移行を0059へ改番した。
旧Settings全体へ戻さず、mainの節分割構成のアカウント欄にLogin v2部品を組み込んだ。
保守処理を単純合成すると50 queriesになったことを最悪経路テストで再現したため、
rate-limit掃除は毎日、400日超のauth監査掃除と期限artifact掃除は日替わりとし49 queriesを守る。
artifactの巡回番号も2日単位で進め、8日で全4種類を掃除する。期限の検証は要求時に独立して行う。
変更前の0050版に対する検証と、0059/最新main統合後の最終検証は区別する。

## 第5章 全体検証（P06）

2026-10-31に再実行。前回の全体検証はAPI準備中に中断されており、成功には数えない。
統合前の全件はcore完走後、旧revisionのAPI実行を中断（終了コード130）した。成功には数えない。
最新main統合後の正式な全件検証は同一revisionのCI必須job（静的検査・core/web・API・build）を証跡とし、
ローカルの対象回帰・coverage・previewも別に記録する。未完のCIを成功扱いしない。

| コマンド | 確認結果 |
|---|---|
| `pnpm test` | 統合前: core 981件成功/実データfixture未指定6件skip、APIは中断130。統合後の正式全件はCI確認待ち |
| `pnpm typecheck` | 最新main統合後に成功。preview内の最終web型検査も成功。CIでも確認する |
| `pnpm lint` | 最新main統合後に成功。206 architecture章と公開文書の実データ参照検査も合格 |
| `pnpm build` | 統合直後の初期JS 113.06KiB超過を検出し、業務shellを認証後の遅延読込へ変更。最終web buildは86.40KiB/110KiB、Worker dry-runも成功 |
| `pnpm run test:coverage:account-login` | API 89件・web107件成功。API行94.09%、web行95.45%。全設定threshold成功 |
| `pnpm run preview:smoke` | 一時D1の0059適用→合成招待承諾→ログイン→現金作成/一覧/削除/空一覧→廃止API404が107.57秒で成功 |
| `pnpm run auth:readiness` | 想定どおり終了コード1。Google2項目・Resend・送信元が不足。秘密値の出力なし |
| `node .cloudflare/setup-production.mjs --dry-run` | 成功。外部設定の変更なし |

追加回帰: 保守最悪経路/8日間巡回5件、actor表示2件、設定・Importのfixture32件、
認証と表示契約115件、認証と共通checkbox契約105件が成功。
coverageは統合後のAPIソースと、業務shell遅延読込・共通checkbox化後のwebソースを対象に測定した。
runtimeの実装保存点は `cbfc8f33564411a3d64e55b74a8c50fa15f9d85c`。
表示テストの20px/44px追従とAPI検査枠を含む保存点は `d22b6fab219ba381b0519d4fd839c9ca4b479fc5`（runtimeソースは同一）。
正式全件の結果は [PR #80のChecks](https://github.com/daishiman/kanjo/pull/80/checks) とこのSHAの対応で判定する。
`d22b6fa` の [CI run 41175336641](https://github.com/daishiman/kanjo/actions/runs/41175336641) は、
この証跡整備時点でstatic/build/package/macOSが成功、core-web/API/Windowsは実行中。全件成功とは記録しない。
この後の証跡のみの保存版でも、最新headの必須検査が揃ってからマージ可否を判断する。

CIで見つかった既存画面のfixtureも修正した。新しい本人DTOを設定のテストで型保証し、
Import履歴の30日以内の操作テストは `Date.now` だけをfixture日付へ固定した。実行日が進んだことを、
取込画面の操作欠落として扱わない。公開画面のcheckboxはmainの共通SelectionCheckboxへ統一した。

fresh migrationがローカルの60秒step枠で打ち切られたことを記録し、正常完了する実測に基づき、
移行コマンドだけ120秒へ枠を補正した。全体310秒の上限と以後の失敗検出は維持した。

実ブラウザ受入は [`evidence/browser-acceptance.json`](evidence/browser-acceptance.json) の8項目すべて成功。
MCPのブラウザ接続は利用できなかったため、既存PlaywrightとChrome 156を使うテスト専用の新しい一時profileで実行した。
個人profileや既存ブラウザを使わず、ブラウザの外部URL要求を遮断し、一時D1の合成利用者だけを操作した。
公開画面、375px横はみ出しなし、共通checkbox20px/操作領域44px以上、保護経路からのnext復帰、実フォーム認証、
本人アカウント欄、認証後の業務shell読込、ログアウト、誤パスワード表示を確認した。
初回の受入runnerは冷起動待ちとメニュー項目のrole期待が合わず失敗したが、runtimeを変更せず実際の節ナビ/メニュー操作へ合わせて成功した。
これはローカルの機能受入であり、本番Core Web Vitalsや実Google/実メールの受入ではない。

## 第6章 受入条件との対応（P07）

ここではテストが存在することと、外部環境での受入完了を区別する。下表だけでAT全件PASSを宣言しない。

| AT | ローカルの検証元 | 外部環境に残る確認 |
|---|---|---|
| AT-01・02 | `packages/web/src/account-login.dom.test.tsx`、`design-qa.md`、最新1024/375pxの実Chrome画像と受入8項目 | 実Google/実メールを伴う本番相当の状態遷移 |
| AT-03 | lint・typecheck・web初期JS予算 | 最終差分の全コマンド完走 |
| AT-04・05 | `account-login.test.ts`、`login-v2-migration.test.ts` | 本番既存利用者の移行と認証 |
| AT-06 | `account-login.test.ts`、`auth-boundaries.test.ts` の期限・Cookie・保持分岐 | 実Google callbackを通した保持の確認 |
| AT-07 | `auth-boundaries.test.ts` とBetter Auth固定版のOAuth検証 | 実Googleのstate/PKCE/nonceを含む拒否確認 |
| AT-08 | 招待API統合テスト・DOM・一時D1の本人承諾 | 実メール配送と実Googleによる招待承諾 |
| AT-09 | `login-v2-endpoints.integration.test.ts` の再設定・連携・失効・監査 | 実メールと実Google連携の往復 |
| AT-10・11 | 管理者MFA関門・TOTP・復旧コード・レート制限テスト | 本番相当の本人操作確認 |
| AT-12 | status API統合テスト、help/privacy DOM | 本番の外側403制御の確認 |
| AT-13 | Access境界テスト、migrationの旧行不変テスト | 本番0059適用状態（現在は読取権限不足） |
| AT-14 | 差分レビュー・監査テスト・メールtimeout/非出力 | 本番ログに秘密が出ないこと |
| AT-15 | `../runbooks/account-login-operations.md` と `google-oauth-setup.md` | 実運用者による所有先と復元地点の確認 |

## 第7章 旧経路の読取専用監査（P08）

実装用の `packages/api/src`、`packages/web/src` と `scripts` を対象に、テスト/テスト補助を除いて
`kanjo_session|mustChangePasswordFence|password_change_required|AUTH_PASSWORD|SESSION_SECRET|temporary.password` を検索した。
旧Cookie署名・強制初回変更・一時パスワード発行の実行経路は見つからなかった。
残る `packages/api/src/db/schema.ts` の旧users表の一時パスワード列とindexは、旧表を削除しない移行方針に従う履歴schemaである。

## 第8章 保証確認と外部設定（P09・P12）

公開endpointのallowlist、サーバー認証、停止利用者拒否、link grantの一回消費、MFAの原子的更新、
最後の管理者の保護、秘密を含まない監査、メールtimeout/fail-closedを独立差分レビューで確認した。
詳細は [`final-review.md`](final-review.md) に記録する。依存監査と最終テストは完走結果を追記する。

外部状態の再確認結果（2026-10-31）:

- GitHubのRepository Variableは `APP_URL` のみで、`MAIL_FROM` は未登録。`production` のCloudflare接続secret名2本は存在する。
- 現資格情報ではWorker secret一覧が認証エラー10000、D1 migration一覧が7403で取得できない。本番secret/0059適用状態は「不明」であり、過去の未登録記録から現在の未登録を断定しない。
- 本番の `/login`、`/api/status`、`/api/auth/me` は読み取り確認で403を返した。本番Login v2の受入成功とは数えない。
- Google/Resendの本人による値の取得・安全な登録、実アカウントでの許可/拒否、実メール配送は未完である。

## 第9章 再実行用の証跡索引（P11）

| 目的 | 正本/成果物 | 再実行コマンド |
|---|---|---|
| 全タスクの実行状態 | [`task-status.md`](task-status.md) | 第5章の各検証を実行し結果を追記 |
| 認証の回帰と既存画面への影響 | API/core/webのテスト | `pnpm test` |
| 認証の測定範囲 | package scriptsの明示include | `pnpm run test:coverage:account-login` |
| 型・文書・秘密参照 | 型検査とlint | `pnpm typecheck`、`pnpm lint` |
| 初期JS・Worker bundle | buildとdry-run | `pnpm build` |
| 本番相当の一時D1 | 合成招待・本人承諾・現金記帳 | `pnpm run preview:smoke` |
| 実Chromeの画面/操作 | [`受入8項目`](evidence/browser-acceptance.json)、`evidence/final-login-1024x1536.png`、`evidence/final-login-375x812.png` | 一時Workers上で `/settings`→ログイン→アカウント→ログアウト→誤パスワード、および `/help`・`/privacy` と375px表示を確認 |
| ローカル設定不足 | 設定名だけの診断 | `pnpm run auth:readiness` |
| 設定helper | 対話手順・互換回帰 | `pnpm run auth:readiness:test`、`node .cloudflare/setup-production.mjs --dry-run` |
| 独立レビュー | [`final-review.md`](final-review.md) | 対象差分と固定版ソースを再確認 |
| 仕様グラフの整合 | architecture206章/206ノード一致、描画46ノード/42辺、両feature各0/13、登録receipt一致、外部依存0、入力schema合格 | `node scripts/check-graph-lineage.mjs` とdev-graph rendererのschema/hash照合 |
| 運用・戻し・本人作業 | [`認証運用`](../runbooks/account-login-operations.md)、[`Google設定`](../runbooks/google-oauth-setup.md) | 手順の読取確認後、所有者が安全なTerminalで実施 |

## 第10章 配信状態（P13）

この検証では本番migration、secret登録、Deployを行っていない。変更内容の受入と外部設定が未完である。
既存CI/CDのビルド→migration→Worker公開の順を使い、実認証を確認できないまま配信しない。
既定ブランチへの反映後だけdev-graphの永続完了を収束し、本番の2回確認を記録してからP13を閉じる。

ステージ記録: 追加開発の要件/設計は既存正本を継承。`app-orchestrator`、`mvp-first-development`、
`testing-excellence`、`workers-best-practices` を読み込み、親の認証/品質スキル監査と独立レビューを併用した。
実装差分はローカル検証中、公開ステージは外部設定・受入待ちで未完である。
