---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G2, G3, G4, G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-login-v2-auth-web-006。裏付け質疑 (`qa_refs`): `qa-login-v2-auth-web-evidence-001`, `qa-login-v2-decision-001`, `qa-login-v2-decision-003`, `qa-login-v2-decision-004`, `qa-login-v2-auth-web-evidence-002`, `qa-login-v2-decision-005`, `qa-login-v2-decision-006`, `qa-login-v2-auth-web-007` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、認証(ログイン)では生体認証によるアプリのロック解除とセッショントークンの端末保存をどうするかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、認証(ログイン)では家族で共有されやすいタブレットで『ログイン状態を保持』の既定をどうするかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、認証(ログイン)ではWindows の資格情報マネージャーにセッションを保存するかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、認証(ログイン)ではSecret Service が無い環境でのセッション保存の代替を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、認証(ログイン)ではキーチェーンへのセッション保存とパスキーの併用を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | ログイン v2 では、パスワードでのログインに TOTP を重ね管理者は必須とし、Google は email_verified と招待済みメールの一致を必須とする形へ反映した (NIST SP 800-63B の複数要素)。連携には再認証を求め、乗っ取ったセッションだけで認証手段を足せないようにした。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | ログイン v2 の認証では、招待・再設定・確認メールのトークンを 1 回限りかつ期限付きにし、保存はハッシュだけにする形へ反映した。再設定の完了と利用者の停止は、その利用者の全セッションの削除と同時に行う。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5

#### 主たる接地根拠: `qa-login-v2-auth-web-006`

**問**

ログイン v2 の 認証(ログイン) に何を求めるか。

**答**

認証手段はメールとパスワード、Google の 2 つとし、Better Auth で扱う。Google は招待先と同じ確認済みメールアドレスのときだけ通し、停止中の利用者は拒否する。既存のパスワードは再設定を強いずにそのまま使えるようにする。多要素認証 (TOTP) はパスワードでの認証に掛け、管理者は必須、一般は任意とし、1 回限りの復旧コードを発行する。TOTP を設定していない管理者には、ログインでも招待からの登録直後でも、TOTP の設定を終えるまでセッションを発行しない。Google でのログインは Google 側の 2 段階認証に委ね、管理者にも TOTP を求めない。連携はログイン済みで既存手段による再認証と確認メールのリンクを経たときだけ成立させ、サインインのついでに自動で連携することはしない。別メールの Google は連携しない。パスワード再設定の完了で既存セッションを全て失効させる。ログイン状態は、保持するとき 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間とし、Google でのログインでも同じにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の到達点の書き直し。auth-web-003 の内容に、決定-005 (保持しないときはブラウザを閉じるまで・最長 12 時間、管理者は TOTP 設定前にセッションを発行しない、Google の管理者は TOTP 不要) と決定-006 (招待からのパスワード登録でも登録直後に TOTP の設定を求める) を反映した。新しい判断は加えていない。 / 回答時刻: 2026-09-21T14:11:35Z)

#### 裏付け質疑: `qa-login-v2-auth-web-evidence-001`

**問**

認証(ログイン) 章の裏付けとして、01-login-v2.png と現行実装の差分として何を観測したか。

**答**

packages/api/src/auth.ts (317 行) が PBKDF2-SHA256 10 万回のハッシュと、HMAC で署名した kanjo_session Cookie (userId.expiresAt.generation) を扱い、保持ありで 30 日、なしで 12 時間の Max-Age を返す。停止や再設定は users.session_generation を進めて既存の Cookie を無効にする。管理者の一時パスワードは 16 文字・72 時間で、must_change_password により初回変更を強制する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 8f72ff0) の読取りによる観測。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-decision-001`

**問**

Google ログインをどう実装するか (現行はメールとパスワードの自前認証)。

**答**

Better Auth へ全面移行する (提示した推奨は自前認証への Google OIDC 追加)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-21T13:14:00Z)

#### 裏付け質疑: `qa-login-v2-decision-003`

**問**

画像の『MFA と不正ログイン対策で保護』を事実にするため、MFA の範囲をどうするか。

**答**

TOTP を使い、管理者は必須、一般利用者は任意とする (推奨案)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-21T13:14:00Z)

#### 裏付け質疑: `qa-login-v2-decision-004`

**問**

管理者が一時パスワードを発行する現行方式を、画像の『管理者が仮パスワードを設定することはありません』とどう整合させるか。

**答**

招待リンク方式へ置き換え、一時パスワードの発行 API と画面を撤去する (推奨案)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-21T13:14:00Z)

#### 裏付け質疑: `qa-login-v2-auth-web-evidence-002`

**問**

Better Auth の既定の動きは、承認済みゴール (G3 招待だけの登録・G4 再認証とメール確認を経た連携・G5 管理者の MFA 必須・O2 非保持 12 時間) とどこで食い違うか。

**答**

(1) アカウント連携は既定で有効で、provider がメールの確認済みを示すか trustedProviders に入っていれば、サインイン時に自動で連携する。accountLinking.disableImplicitLinking を true にすると、同じメールの OAuth サインインは account_not_linked で拒否され、連携はログイン済みセッションからの linkSocial() だけになる。allowDifferentEmails は別メールの連携を許す設定。(2) provider の disableSignUp はその provider での新規利用者作成を全て止める。disableImplicitSignUp は、signIn.social を requestSignUp: true で呼んだときだけ新規作成を許す。(3) session.expiresIn は既定 7 日のインスタンス全体の設定で、updateAge (既定 1 日) に達するたびに延長される。session-management の docs にはログインごとに期限を変える設定の記述が無い。(4) 2FA plugin の docs には役割ごとに 2FA を強制する設定の記述が無い。資格情報でのサインインで 2FA が有効な利用者には twoFactorRedirect: true が返る。trustDevice を渡すとその端末は 30 日間 2FA を求められない。復旧コードは DB に保存されるとあるが、保存形式 (平文かハッシュか) の記述は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: WebFetch で公式 docs を取得して確かめた観測事実 (取得は本 qa の answered_at より前): https://www.better-auth.com/docs/concepts/users-accounts 、https://www.better-auth.com/docs/concepts/oauth 、https://www.better-auth.com/docs/concepts/session-management 、https://www.better-auth.com/docs/plugins/2fa (fetched-references の better-auth v1.7.5 と同じ公式 host)。 / 回答時刻: 2026-09-21T13:42:56Z)

#### 裏付け質疑: `qa-login-v2-decision-005`

**問**

訂正後の比較を踏まえて認証基盤をどうするか。MFA 未設定の管理者のログイン、Google でログインした管理者の TOTP、保持しないログインの実現方法をどうするか。

**答**

Better Auth を継続する。MFA 未設定の管理者には、O6 のとおり TOTP の設定を終えるまでセッションを発行しない。Google でログインした管理者には TOTP を求めず、Google 側の 2 段階認証に委ねる。ログイン状態を保持しないときは、ブラウザを閉じるまで、かつ最長 12 時間とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion で 4 問に回答 (2026-09-21T13:58:57.447Z、transcript の回答行の実測)。1 問目では 13:14Z の比較根拠の誤りと訂正後の 3 つの事実を提示した。 / 回答時刻: 2026-09-21T13:58:57Z)

#### 裏付け質疑: `qa-login-v2-decision-006`

**問**

招待リンクからメールとパスワードで登録した管理者に、登録直後の時点で TOTP の設定を求めるか。

**答**

求める。招待からのパスワード登録では自動でログインさせず、管理者は TOTP の設定を終えてから初めてセッションを得る。TOTP を設定する前に管理者のセッションが存在する経路は 0 件にする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion で回答 (2026-09-21T14:10:28.965Z、transcript の回答行の実測)。完成度再々評価の medium 1 を受けた 1 問。 / 回答時刻: 2026-09-21T14:10:28Z)

#### 裏付け質疑: `qa-login-v2-auth-web-007`

**問**

ログイン v2 の auth を実装するときの具体的な手段と設定値は何か (決定-006 反映後)。

**答**

連携: account.accountLinking.disableImplicitLinking=true、allowDifferentEmails=false、trustedProviders は設定しない。連携はログイン済みで既存手段の再認証とアプリ独自の確認メール (1 回限り・期限付き、SHA-256 ハッシュ保存) を経たあとだけ linkSocial を許す。既存 PBKDF2 は emailAndPassword.password.verify を差し替えて読む。管理者の MFA 関門は許可側で書く: databaseHooks.session.create.before で、利用者が管理者かつ twoFactorEnabled が偽のとき、許すのは Google の戻り (/callback/google) と MFA 設定の完了処理が作るセッションだけで、それ以外の経路 (/sign-in/email、/sign-up/email、今後増える経路) は全て拒否する。emailAndPassword.autoSignIn=false とし、招待の承諾でパスワードを登録した直後にはセッションを作らない。承諾またはパスワードでのログインが管理者で TOTP 未設定のときは、10 分・1 回限りの MFA 設定トークンを返し、TOTP の設定と初回コードの検証に成功したときにだけトークンを消費してセッションを発行する。一般利用者は招待の承諾後にパスワードでログインし直す。TOTP 設定済みの利用者は 2FA plugin の twoFactorRedirect を経て /mfa でコードを入力したあとにだけ発行される。trustDevice は使わない。保持: 保持ありは session.expiresIn=30 日・updateAge=1 日。保持なしは、パスワードでは signIn.email を rememberMe:false で呼び、Google では認可開始の API が Better Auth の dont_remember の Cookie (接頭辞 kanjo) を先に付けてから Google へ送り、戻りの処理に同じ Cookie を読ませる。どちらも session.create.before でセッション行の expiresAt を発行から 12 時間にし、Cookie は Max-Age を持たない。Cookie は Secure・HttpOnly・SameSite=Lax。確かめるテスト: パスワードと Google のそれぞれで、保持なしの Set-Cookie に Max-Age も Expires も無く、12 時間を過ぎたアクセスが 401、途中のアクセスで expiresAt が延びない (O2)。同じメールの Google サインインが account_not_linked (O5)。TOTP 未設定の管理者は、パスワードでのログインでも招待のパスワード登録直後でも session 行が 0 件でセッション Cookie が無く、設定トークンで TOTP を設定・検証すると発行される。Google でログインした管理者は TOTP なしで発行される (O6)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定。決定-005・決定-006 を Better Auth で実現する手段で、同じ章の -005 を置き換える (完成度再々評価の medium 1: 関門が /sign-in/email にしか無く招待登録の自動ログインを素通りする、medium 2: Google の経路で保持なしの手段が無い、を受けて)。rememberMe:false の Cookie があるとセッションを延長しないことは、評価器が better-auth 1.7.0 のソース (session の getSession) で確認した。固定版 v1.7.5 で同じかと、Google の戻りの処理が dont_remember の Cookie を読むかは、本文末尾のテストで確かめる。 / 回答時刻: 2026-09-21T14:11:35Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 認証基盤を Better Auth (Hono の Cloudflare Worker + D1) へ全面移行する。メールアドレスとパスワード、Google (OIDC) の 2 つの認証手段と、D1 のセッション表によるセッション管理を Better Auth で行い、ログイン状態の保持 (保持は 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間)・停止した利用者の発行済みセッションの即時失効・/api/* の認証ガードと admin 判定・audit_log の actor_user_id を移行後も同じ契約で満たす。既存利用者は PBKDF2 のハッシュを保ったまま移し、パスワードの再設定を強いない。旧 Cookie kanjo_session と自前の署名・世代照合は撤去する。
- **G3**: 利用者の追加を招待メール方式にする。テナント管理者が設定画面でメールアドレスと役割を入力すると、期限付き・1 回限りの招待トークンのリンクがメールで届き、本人がリンク先で Google アカウント (招待先と同じ確認済みメールアドレスのもの) か メールアドレスとパスワードかを選んで登録を完了する。管理者は招待の再送・取消と状態 (未承諾・承諾済み・期限切れ) を確認でき、ログイン画面の『招待メールを再送』は本人がメールアドレスを入れて再送を依頼でき、応答からは招待の有無が分からない。一時パスワードの発行 API・画面・初回変更の強制は撤去し、管理者は他人のパスワードを設定しない。自己登録 (サインアップ) は塞いだままにする。
- **G4**: 本人が自力で復旧・連携できるようにする。『パスワードをお忘れの方』からメールアドレスを入れると、期限付き・1 回限りの再設定リンクがメールで届き、新しいパスワードを設定すると、その利用者の既存セッションを全て失効させる。応答からは登録の有無が分からない。同じメールアドレスで Google とパスワードの両方を使う本人は、ログイン済みの状態で既存の認証手段による再認証と、確認メールのリンクによるメール確認を経て、1 つのアカウントに連携できる。確認済みでない Google メールアドレスや、別のメールアドレスの Google アカウントは連携しない。連携の追加・解除は監査に残す。
- **G5**: 不正ログイン対策を画面の説明どおりにする。パスワードでのログインに TOTP の多要素認証を重ね、管理者は必須 (未設定の管理者は次回ログインで設定を求める)、一般利用者は設定画面で任意に有効化できる。復旧コードを発行し、TOTP を失った本人が復旧できる。Google でのログインは Google 側の 2 段階認証に委ねる。既存の IP・アカウント単位のレート制限と列挙防止を、ログイン・MFA コード・招待再送・パスワード再設定の各入口に広げる。認証情報 (利用者・セッション・認証手段・招待・MFA) は業務データの表と分けて保持し、ログイン情報は認証と保護の用途に限って使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | Better Auth へ移行しても既存の認証契約が保たれる。 | 既存の account-login の契約テスト (未認証の /api/* が 401、停止利用者の既存セッションが 401、非管理者の /api/admin/* が 403、最後の管理者の停止が 409、監査の actor_user_id) を Better Auth 版で緑にし、保持ありでは Set-Cookie の Max-Age が 30 日になり、保持なしでは Max-Age も Expires も持たないセッション Cookie になって、サーバ側のセッションが発行から 12 時間で失効し、途中のアクセスでも延長されない。既存の PBKDF2 ハッシュの利用者が再設定なしでログインできる移行テストが緑。 |
| O3 | Google でのログインが招待済みの確認済みメールアドレスだけを通す。 | ID トークンの email_verified=false、招待・登録の無いメールアドレス、停止中の利用者で Google ログインが拒否され、state / PKCE / nonce の不一致が拒否される統合テストが緑。自己登録の経路が 0 件。 |
| O4 | 招待が一時パスワード無しで完結する。 | 招待作成→メール送信 (送信 API はテストで差し替え)→リンクで Google またはパスワードを選んで登録、の 2 経路の統合テストが緑。トークンは期限切れ・使用済み・取消で拒否され、D1 にはトークンのハッシュだけが残る。一時パスワードの API・列・画面が 0 件。ログイン画面からの再送依頼は、招待の有無にかかわらず同じ応答になる。 |
| O5 | パスワード再設定とアカウント連携が本人確認を経て完結する。 | 再設定リンクで新パスワードを設定すると既存セッションが全て 401 になり、登録の有無で応答が変わらないテストが緑。連携は再認証とメール確認の両方を経ないと成立せず、別メールや未確認の Google アカウントは連携されないテストが緑。連携の追加・解除が audit_log に残る。 |
| O6 | TOTP の多要素認証と不正ログイン対策が効く。 | 管理者はパスワードでのログイン後に TOTP の設定または入力を経ないとセッションが発行されず、一般利用者は有効化した場合だけ求められるテストが緑。復旧コードは 1 回限りでハッシュ保存。ログイン・MFA・再送・再設定の各入口で連続失敗がロックされ、他の利用者を阻害しないテストが緑。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: packages/api に Better Auth のインスタンスを置き、/api/auth/* を Better Auth のハンドラへ向け、authGuard・adminGuard を Better Auth のセッション取得に差し替える。
- **I3**: Better Auth の表 (user・session・account・verification・twoFactor) と招待表を追加のみの migration で作り、既存 users を複写する移行を用意する。PBKDF2 のハッシュは account.password に形式ごと移し、検証関数で読む。
- **I4**: 招待の作成・再送・取消・承諾の API と、設定画面の利用者管理を招待方式に作り直し、一時パスワードの API と画面と初回変更の強制を撤去する。
- **I5**: Resend の送信を 1 か所の関数に閉じ、招待・再設定・連携確認のメール本文を定義し、テストでは送信を差し替える。
- **I6**: TOTP 二要素を有効にし、管理者の必須化、復旧コード、MFA 設定画面を加える。レート制限を新しい入口へ広げる。

### 本章に効く確定意思決定

- **dec-login-v2-auth-foundation**: Google ログイン・連携・MFA をどの認証基盤で実装するか。
  - 採択: Better Auth へ全面移行 (`opt-better-auth`)
  - 目的適合: Google・パスワード・アカウント連携・TOTP 二要素と復旧コードを 1 つの基盤で賄え、G2/G4/G5 の機能を部品として得られる。
- **dec-login-v2-mail-delivery**: 招待・パスワード再設定・連携確認のメールをどの基盤で送るか。
  - 採択: Resend など外部 API (`opt-resend`)
  - 目的適合: HTTP の fetch だけで Workers から送れ、招待・再設定・連携確認の量は無料枠に収まる。
- **dec-login-v2-mfa-scope**: 画像の『MFA と不正ログイン対策で保護』を事実にするため、MFA の範囲をどうするか。
  - 採択: TOTP・管理者は必須、一般は任意 (`opt-totp-admin-required`)
  - 目的適合: 画像の説明を事実にしつつ、一般利用者の初回の手間を増やさない。
- **dec-login-v2-onboarding**: 管理者が一時パスワードを発行する現行方式を、画像の『管理者が仮パスワードを設定することはありません』とどう整合させるか。
  - 採択: 招待リンク方式へ置換し一時パスワードを撤去 (`opt-invite-link`)
  - 目的適合: 画像の文言と一致し、本人が自分で認証手段を選んで登録する。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Least privilege と resource ownership の card をログイン v2 に適用した。管理者の権限は MFA を経たセッションでだけ有効にし、招待・停止・役割変更の API は管理者のセッションに限る。本人の連携・MFA・パスワードの変更は本人のセッションだけが行え、管理者も他人の認証手段を設定できない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:27:06Z)

### Secure by Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/secure-by-design.md`

#### 目的

利用者の注意や運用後のpatchへ安全性を押し付けず、systemのdefault、architecture、development lifecycleに安全な結果を組み込み、被害可能性と復旧費を下げる。

#### 解決する問題

- 認証・認可・data protectionが後付けで、business flowと矛盾する。
- defaultが過大権限/公開状態で、利用者の完全な設定に安全性が依存する。
- 単一防御の突破で全面侵害になり、検知・封じ込め・復旧の証拠が無い。
- dependency、secret、build、releaseの供給chain riskが製品境界外として放置される。

#### 適用条件

- identity、個人/機密data、金銭、外部入力、admin操作、multi-tenant boundaryを扱う全system。
- compromise時の影響がgoal、法規、信頼、運用継続を損なう。
- vendor/serviceを使う場合も、共有責任とfailure/exit planを明示できる。

#### 非適用条件

- security自体が不要なsystemは原則ない。asset/threatが極小ならcontrolを軽量化できるが、根拠付きrisk acceptanceが必要。
- controlがthreatを減らさず、accessibility/availability/safetyを重大に損なう場合はそのcontrolを採用しない。代替・補償統制を設計する。
- checklist準拠だけでproject固有のtrust boundaryとabuse caseを置き換えない。

#### トレードオフ・失敗モード

- friction、latency、delivery費、運用負荷が増えるため、risk reductionと明示的に釣り合わせる。
- security theaterとしてcontrol数だけ増やし、owner、evidence、responseを持たない。
- fail closedを無差別適用してavailability/safety incidentを起こす。degraded modeとbreak-glass監査が必要。
- secretを隠しても過大権限や長期credentialを残す、暗号化してもkey lifecycleを設計しない等の局所最適。
- free tier製品を価格だけで選び、audit、export、retention、MFA、incident support不足を見落とす。

#### goalへの寄与

- stakeholderの安全・信頼・継続性をsuccess criteriaへ変換し、threat/control/evidenceをgoalへトレースする。
- security controlは「導入済み」ではなく、阻止/検知/復旧時間、権限範囲、data exposureで効果を測る。
- 予算0制約でも、secure default、最小data、短命credential、標準機能、open-source検査を優先し、残余riskを隠さない。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| google-openid-connect | 2026-06-15 | Google for Developers (developers.google.com) | https://developers.google.com/identity/openid-connect/openid-connect | 2026-09-21T13:28:04Z | 2026-09-21T13:28:04Z |
