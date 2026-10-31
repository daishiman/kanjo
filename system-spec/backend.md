---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4, G5, G6, G7]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-login-v2-backend-web-003。裏付け質疑 (`qa_refs`): `qa-login-v2-backend-web-evidence-001`, `qa-login-v2-backend-web-002`, `qa-login-v2-decision-001`, `qa-login-v2-decision-002`, `qa-login-v2-decision-003`, `qa-login-v2-decision-004`, `qa-login-v2-backend-web-004`, `qa-login-v2-auth-web-evidence-002`, `qa-login-v2-decision-005`, `qa-login-v2-decision-006`, `qa-login-v2-backend-web-005` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5, G6, G7 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、バックエンドではネイティブアプリ向けに Cookie ではなく Bearer のセッショントークンを返す API をどう分けるかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、バックエンドでは複数端末からの同時ログインに対するセッションの上限と失効の API を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、バックエンドではデスクトップ版の OAuth ループバック先を許可するリダイレクト URI の検証を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、バックエンドでは古い版のデスクトップ版が旧 Cookie 方式で呼んだときの互換 API を残すかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、バックエンドではネイティブ版のためのデバイス登録と招待承諾の API を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | ログイン v2 では依存方向を core (招待の状態・期限・MFA 要否の判定) ← api (Better Auth のインスタンス・招待と再設定の route・送信関数) ← web の一方向へ反映した。Better Auth の型は api の外へ出さず、web へは自前の応答型で返す。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | ログイン v2 の api では、招待の作成と監査の記録を同じ D1 batch に入れ、招待だけ作られて監査が欠ける状態を作らない形へ反映した。Better Auth の表への読み書きは Better Auth に任せ、route から直接 SQL で触らない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5, G6, G7

#### 主たる接地根拠: `qa-login-v2-backend-web-003`

**問**

ログイン v2 の バックエンド に何を求めるか。

**答**

/api/auth/* を Better Auth に向け、既存の認証ガードと管理者判定は、mount 順序・401/403/409 の契約・監査ログの操作者記録を保ったまま Better Auth のセッションで判定する。初回パスワード変更の強制は撤去する。招待 (作成・一覧・再送・取消・承諾)、再送依頼、再設定依頼の API を加え、承諾では招待と同じ確認済みメールアドレスの Google アカウントか、メールとパスワードでだけ登録を完了する。招待を経ない利用者作成 (自己登録) の経路は 0 件にする。メール送信は Resend を呼ぶ 1 か所に閉じ、テストでは差し替える。TOTP は管理者に必須、一般は任意とし、連携は再認証と確認メールを経たときだけ成立させる。認証不要の稼働状態 API を加える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### 裏付け質疑: `qa-login-v2-backend-web-evidence-001`

**問**

バックエンド 章の裏付けとして、01-login-v2.png と現行実装の差分として何を観測したか。

**答**

packages/api/src/index.ts の 87〜95 行目で /api/auth/* に 16KiB の bodyLimit を掛けて authRoute を置き、104〜108 行目で /api/* に authGuard・mustChangePasswordFence・runtimeSchemaGuard・canonicalMutationFence を順に掛ける。routes/auth.ts (292 行) がログイン・ログアウト・パスワード変更を、routes/admin-users.ts (150 行) が利用者の追加・停止・一時パスワードの発行を持つ。login-rate-limit.ts は IP とアカウントの 2 軸で 15 分に 5 回の失敗で 15 分ロックする。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 8f72ff0) の読取りによる観測。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-backend-web-002`

**問**

web のログイン v2 で、バックエンド について利用者が決めていない具体値を何にするか。

**答**

招待トークンと再設定トークンは 32 バイトの乱数を base64url にし、D1 には SHA-256 のハッシュだけを置く。招待の有効期限は 72 時間 (現行の一時パスワードの期限と同じ)、再設定は 1 時間とする。再送依頼・再設定依頼は宛先の有無にかかわらず 202 と同じ本文を返し、送信は waitUntil で応答の後に行って所要時間の差を消す。GET /api/status は {status: 'normal' | 'degraded'} だけを返し、D1 への SELECT 1 の成否で決める。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-decision-001`

**問**

Google ログインをどう実装するか (現行はメールとパスワードの自前認証)。

**答**

Better Auth へ全面移行する (提示した推奨は自前認証への Google OIDC 追加)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-21T13:14:00Z)

#### 裏付け質疑: `qa-login-v2-decision-002`

**問**

招待・パスワード再設定・連携確認のメールを送る基盤をどうするか。

**答**

Resend など外部 API で送る (提示した推奨は Cloudflare Email Service)。

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

#### 裏付け質疑: `qa-login-v2-backend-web-004`

**問**

ログイン v2 の backend を実装するときの具体的な手段と設定値は何か。

**答**

/api/auth/* は auth.handler へ向け、authGuard と adminGuard は auth.api.getSession でセッションを取る。mustChangePasswordFence は撤去する。自己登録の封鎖は provider ごとの disableSignUp ではなく、利用者作成の 1 か所に一本化する: databaseHooks.user.create.before で、作成しようとするメールアドレスに有効な (期限内・未承諾・未取消の) 招待が無ければ拒否する。disableSignUp を Google に掛けると招待からの Google 登録 (G3) まで止まるため使わず、Google provider は disableImplicitSignUp=true とし、招待承諾画面だけが signIn.social を requestSignUp: true で呼ぶ。招待の消費 (承諾済みへの更新) と利用者作成は同じ D1 batch に置く。メール送信は sendMail(to, template, params) の 1 関数に閉じる。GET /api/status は認証ガードより前に mount する。確かめるテスト: 招待の無いメールで signUp.email と Google の新規サインインを試み、どちらでも利用者が作られない (O3)。招待のあるメールでは Google とパスワードの両方で承諾が完了する (O4)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定。-001 から外した実装手段と、完成度評価 (medium 1-3・low 2) が指摘した Better Auth の既定の動きと承認済みゴールの食い違いを埋める設定値。公式 docs で確かめた事実は qa-login-v2-auth-web-evidence-002 に分けた。docs に記述の無い組み合わせを含むため、本文末尾のテストで実装時に確かめる。 / 回答時刻: 2026-09-21T13:42:56Z)

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

#### 裏付け質疑: `qa-login-v2-backend-web-005`

**問**

ログイン v2 の backend で、決定-005/-006 の MFA 設定と保持なしをどう実現するか。

**答**

招待の承諾は、パスワードを選んだ場合 emailAndPassword.autoSignIn=false の signUp.email で利用者を作り、招待の消費と同じ D1 batch に置く。承諾した利用者が管理者なら MFA 設定トークンを返し、一般利用者ならログイン画面への案内だけを返す (セッションは出さない)。MFA 設定の完了 API (POST /api/auth/mfa-setup/complete) は設定トークンと TOTP の初回コードを受け取り、auth.ts の関門が許す唯一のパスワード側のセッション発行元にする。Google の認可開始 API は保持の指定を受け取り、保持しないときは dont_remember の Cookie を付けてから Google へ送る。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定。決定-005・決定-006 を Better Auth で実現する手段で、backend 章の -004 に追加する (完成度再々評価の medium 1: 関門が /sign-in/email にしか無く招待登録の自動ログインを素通りする、medium 2: Google の経路で保持なしの手段が無い、を受けて)。rememberMe:false の Cookie があるとセッションを延長しないことは、評価器が better-auth 1.7.0 のソース (session の getSession) で確認した。固定版 v1.7.5 で同じかと、Google の戻りの処理が dont_remember の Cookie を読むかは、本文末尾のテストで確かめる。 / 回答時刻: 2026-09-21T14:11:35Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 認証基盤を Better Auth (Hono の Cloudflare Worker + D1) へ全面移行する。メールアドレスとパスワード、Google (OIDC) の 2 つの認証手段と、D1 のセッション表によるセッション管理を Better Auth で行い、ログイン状態の保持 (保持は 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間)・停止した利用者の発行済みセッションの即時失効・/api/* の認証ガードと admin 判定・audit_log の actor_user_id を移行後も同じ契約で満たす。既存利用者は PBKDF2 のハッシュを保ったまま移し、パスワードの再設定を強いない。旧 Cookie kanjo_session と自前の署名・世代照合は撤去する。
- **G3**: 利用者の追加を招待メール方式にする。テナント管理者が設定画面でメールアドレスと役割を入力すると、期限付き・1 回限りの招待トークンのリンクがメールで届き、本人がリンク先で Google アカウント (招待先と同じ確認済みメールアドレスのもの) か メールアドレスとパスワードかを選んで登録を完了する。管理者は招待の再送・取消と状態 (未承諾・承諾済み・期限切れ) を確認でき、ログイン画面の『招待メールを再送』は本人がメールアドレスを入れて再送を依頼でき、応答からは招待の有無が分からない。一時パスワードの発行 API・画面・初回変更の強制は撤去し、管理者は他人のパスワードを設定しない。自己登録 (サインアップ) は塞いだままにする。
- **G4**: 本人が自力で復旧・連携できるようにする。『パスワードをお忘れの方』からメールアドレスを入れると、期限付き・1 回限りの再設定リンクがメールで届き、新しいパスワードを設定すると、その利用者の既存セッションを全て失効させる。応答からは登録の有無が分からない。同じメールアドレスで Google とパスワードの両方を使う本人は、ログイン済みの状態で既存の認証手段による再認証と、確認メールのリンクによるメール確認を経て、1 つのアカウントに連携できる。確認済みでない Google メールアドレスや、別のメールアドレスの Google アカウントは連携しない。連携の追加・解除は監査に残す。
- **G5**: 不正ログイン対策を画面の説明どおりにする。パスワードでのログインに TOTP の多要素認証を重ね、管理者は必須 (未設定の管理者は次回ログインで設定を求める)、一般利用者は設定画面で任意に有効化できる。復旧コードを発行し、TOTP を失った本人が復旧できる。Google でのログインは Google 側の 2 段階認証に委ねる。既存の IP・アカウント単位のレート制限と列挙防止を、ログイン・MFA コード・招待再送・パスワード再設定の各入口に広げる。認証情報 (利用者・セッション・認証手段・招待・MFA) は業務データの表と分けて保持し、ログイン情報は認証と保護の用途に限って使う。
- **G6**: ログイン前に確かめられる公開情報を用意する。フッターの『サービス状況』は認証不要の稼働状態 API から『正常』などを表示し、内部の詳細 (エラー文・構成) は返さない。『ヘルプ』と『プライバシー』は認証不要の静的ページとして、ログインの手順・招待・再設定・連携・MFA の説明と、ログイン情報の利用目的・保存期間・外部送信先 (Google・メール送信事業者) を示す。
- **G7**: 既存画面と API の契約を壊さずに移行する。/api/* の認証ガードの mount 順序、admin の判定、有効な管理者が 0 人になる変更の拒否、監査ログの actor 記録、Cloudflare Access のサーバ側検証経路の扱いを移行前と同じ契約テストで確かめ、移行用の migration は追加のみとして、移行の失敗時に旧経路へ戻せる手順を残す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | Better Auth へ移行しても既存の認証契約が保たれる。 | 既存の account-login の契約テスト (未認証の /api/* が 401、停止利用者の既存セッションが 401、非管理者の /api/admin/* が 403、最後の管理者の停止が 409、監査の actor_user_id) を Better Auth 版で緑にし、保持ありでは Set-Cookie の Max-Age が 30 日になり、保持なしでは Max-Age も Expires も持たないセッション Cookie になって、サーバ側のセッションが発行から 12 時間で失効し、途中のアクセスでも延長されない。既存の PBKDF2 ハッシュの利用者が再設定なしでログインできる移行テストが緑。 |
| O3 | Google でのログインが招待済みの確認済みメールアドレスだけを通す。 | ID トークンの email_verified=false、招待・登録の無いメールアドレス、停止中の利用者で Google ログインが拒否され、state / PKCE / nonce の不一致が拒否される統合テストが緑。自己登録の経路が 0 件。 |
| O4 | 招待が一時パスワード無しで完結する。 | 招待作成→メール送信 (送信 API はテストで差し替え)→リンクで Google またはパスワードを選んで登録、の 2 経路の統合テストが緑。トークンは期限切れ・使用済み・取消で拒否され、D1 にはトークンのハッシュだけが残る。一時パスワードの API・列・画面が 0 件。ログイン画面からの再送依頼は、招待の有無にかかわらず同じ応答になる。 |
| O5 | パスワード再設定とアカウント連携が本人確認を経て完結する。 | 再設定リンクで新パスワードを設定すると既存セッションが全て 401 になり、登録の有無で応答が変わらないテストが緑。連携は再認証とメール確認の両方を経ないと成立せず、別メールや未確認の Google アカウントは連携されないテストが緑。連携の追加・解除が audit_log に残る。 |
| O6 | TOTP の多要素認証と不正ログイン対策が効く。 | 管理者はパスワードでのログイン後に TOTP の設定または入力を経ないとセッションが発行されず、一般利用者は有効化した場合だけ求められるテストが緑。復旧コードは 1 回限りでハッシュ保存。ログイン・MFA・再送・再設定の各入口で連続失敗がロックされ、他の利用者を阻害しないテストが緑。 |
| O7 | 公開の稼働状態・ヘルプ・プライバシーが認証なしで見られ、内部情報を出さない。 | 未認証で稼働状態 API が 200 と状態値 (normal / degraded など) だけを返し、エラー文や構成を含まないテストが緑。ヘルプとプライバシーの画面が未認証で描画され、プライバシーに外部送信先 (Google・メール送信事業者) と利用目的・保存期間が載る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: packages/api に Better Auth のインスタンスを置き、/api/auth/* を Better Auth のハンドラへ向け、authGuard・adminGuard を Better Auth のセッション取得に差し替える。
- **I3**: Better Auth の表 (user・session・account・verification・twoFactor) と招待表を追加のみの migration で作り、既存 users を複写する移行を用意する。PBKDF2 のハッシュは account.password に形式ごと移し、検証関数で読む。
- **I4**: 招待の作成・再送・取消・承諾の API と、設定画面の利用者管理を招待方式に作り直し、一時パスワードの API と画面と初回変更の強制を撤去する。
- **I5**: Resend の送信を 1 か所の関数に閉じ、招待・再設定・連携確認のメール本文を定義し、テストでは送信を差し替える。
- **I6**: TOTP 二要素を有効にし、管理者の必須化、復旧コード、MFA 設定画面を加える。レート制限を新しい入口へ広げる。
- **I7**: 認証不要の GET /api/status と、/help・/privacy の公開ページを加え、ログイン画面のフッターから辿れるようにする。
- **I8**: docs に移行・戻し・secret・Google Cloud Console・Resend の手順とプライバシーの記載を置く。

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

Clean Architecture の Dependency Rule をログイン v2 に適用した。招待の状態 (未承諾・承諾済み・期限切れ・取消) の判定、トークンの期限計算、管理者に MFA を求めるかの判定は入出力を持たない計算なので core に置き、api の route は Better Auth と D1 から組んだ値を渡して結果を書くだけにする。Better Auth はアダプタとして api 層に閉じ、core は Better Auth を知らない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:27:06Z)

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| better-auth | v1.7.5 | Better Auth (github.com) | https://github.com/better-auth/better-auth/releases/tag/v1.7.5 | 2026-09-21T13:28:04Z | 2026-09-21T13:28:04Z |
