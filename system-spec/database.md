---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G2, G3, G5, G7]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-login-v2-database-web-003。裏付け質疑 (`qa_refs`): `qa-login-v2-database-web-evidence-001`, `qa-login-v2-database-web-002`, `qa-login-v2-decision-001`, `qa-login-v2-decision-004`, `qa-login-v2-database-web-004`, `qa-login-v2-auth-web-evidence-002`, `qa-login-v2-decision-005`, `qa-login-v2-decision-006`, `qa-login-v2-database-web-005` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G5, G7 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、データベースでは端末ごとのプッシュ通知トークンや端末名をセッション表へ持たせるかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、データベースでは共有タブレットの端末識別子をセッション表に記録するかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、データベースではデスクトップ版のローカルに持つリフレッシュトークンの失効記録を D1 に置くかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、データベースではデスクトップ版のオフライン猶予を表す列を認証の表に足すかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、データベースではネイティブ版の端末登録を認証手段の表と分けるかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | ログイン v2 の D1 では、session 表の token と招待・再設定のトークンに一意索引を張り、失効はセッション行の削除で即時に効かせる形へ反映した。停止した利用者の session 行は停止の操作と同じ batch で消す。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | ログイン v2 の移行では、複写の migration を何度流しても同じ結果になるよう INSERT ... SELECT に WHERE NOT EXISTS を付け、途中で止まっても再実行で収束させる形へ反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G5, G7

#### 主たる接地根拠: `qa-login-v2-database-web-003`

**問**

ログイン v2 の データベース に何を求めるか。

**答**

D1 の migration は追加のみとし、認証の表 (利用者・セッション・認証手段・確認用トークン・多要素認証) と招待表を新設する。既存の利用者は新しい表へ複写し、既存のパスワードハッシュは形式ごと移して、既存の行を書き換えない。旧表と列は本サイクルでは削除しない。トークンと復旧コードは平文で保存しない。認証情報の表は業務データの表と分け、業務データの表から認証の表へ外部キーを張り足さない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### 裏付け質疑: `qa-login-v2-database-web-evidence-001`

**問**

データベース 章の裏付けとして、01-login-v2.png と現行実装の差分として何を観測したか。

**答**

migrations/0039_account_login.sql が users 表 (password_hash は pbkdf2-sha256$ の自己記述形式、session_generation、must_change_password、temp_password_expires_at を持つ) と password_login_rate_limits、audit_log を作る。最新の migration は 0047_classify_workbench.sql。セッション表は無く、Cookie の中の世代番号で失効させている。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 8f72ff0) の読取りによる観測。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-database-web-002`

**問**

web のログイン v2 で、データベース について利用者が決めていない具体値を何にするか。

**答**

新表は Better Auth の既定名に接頭辞を付けず user・session・account・verification・twoFactor とし、招待は invitations 表に id・email・role・token_hash・expires_at・accepted_at・revoked_at・invited_by を持たせる。移行の migration は 0048 番とし、既存 users の id を user.id にそのまま使って audit_log の actor_user_id との対応を保つ。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-decision-001`

**問**

Google ログインをどう実装するか (現行はメールとパスワードの自前認証)。

**答**

Better Auth へ全面移行する (提示した推奨は自前認証への Google OIDC 追加)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-21T13:14:00Z)

#### 裏付け質疑: `qa-login-v2-decision-004`

**問**

管理者が一時パスワードを発行する現行方式を、画像の『管理者が仮パスワードを設定することはありません』とどう整合させるか。

**答**

招待リンク方式へ置き換え、一時パスワードの発行 API と画面を撤去する (推奨案)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-21T13:14:00Z)

#### 裏付け質疑: `qa-login-v2-database-web-004`

**問**

ログイン v2 の database を実装するときの具体的な手段と設定値は何か。

**答**

認証の表は Better Auth 既定の user・session・account・verification・twoFactor とし、既存 users からは INSERT ... SELECT で複写、PBKDF2 は account.password へ pbkdf2-sha256$ 形式ごと移す。招待と連携確認のトークンはアプリ独自に発行し、SHA-256 のハッシュだけを保存する。Better Auth 組込みの再設定トークン (verification 表) と 2FA の復旧コードは、公式 docs に保存形式の記述が無いため組込みのまま使い、実装時に D1 の行を読んで平文が無いことを確かめる。平文であれば、復旧コードは 2FA plugin の保存オプションか独自のハッシュ化で、再設定トークンは独自発行へ置き換える。確かめるテスト: 招待・再設定・連携確認のトークンと復旧コードの平文が D1 のどの列にも現れない。

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

#### 裏付け質疑: `qa-login-v2-database-web-005`

**問**

ログイン v2 の database で、決定-005/-006 の MFA 設定と保持なしをどう実現するか。

**答**

MFA 設定トークンはアプリ独自の表 mfa_setup_token に置く: id、user_id (認証の user 表への外部キー、削除で連鎖)、token_hash (SHA-256、一意)、expires_at (発行から 10 分)、consumed_at (未消費は NULL)、created_at。平文のトークンは保存しない。消費は UPDATE ... SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>? の更新行数が 1 のときだけ有効とし、TOTP の有効化とセッションの作成を同じ D1 batch に置く。同じ利用者へ新しいトークンを出すときは未消費の古い行を消費済みにする。期限切れの行は定期処理で消す。認証の文脈の表なので業務データの表からは参照しない。確かめるテスト: 同じトークンの 2 回目、期限切れ、別の利用者のトークンがいずれも拒否され、D1 に平文が残らない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定。決定-005・決定-006 を Better Auth で実現する手段で、database 章の -004 に追加する (完成度再々評価の medium 1: 関門が /sign-in/email にしか無く招待登録の自動ログインを素通りする、medium 2: Google の経路で保持なしの手段が無い、を受けて)。rememberMe:false の Cookie があるとセッションを延長しないことは、評価器が better-auth 1.7.0 のソース (session の getSession) で確認した。固定版 v1.7.5 で同じかと、Google の戻りの処理が dont_remember の Cookie を読むかは、本文末尾のテストで確かめる。 / 回答時刻: 2026-09-21T14:11:35Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 認証基盤を Better Auth (Hono の Cloudflare Worker + D1) へ全面移行する。メールアドレスとパスワード、Google (OIDC) の 2 つの認証手段と、D1 のセッション表によるセッション管理を Better Auth で行い、ログイン状態の保持 (保持は 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間)・停止した利用者の発行済みセッションの即時失効・/api/* の認証ガードと admin 判定・audit_log の actor_user_id を移行後も同じ契約で満たす。既存利用者は PBKDF2 のハッシュを保ったまま移し、パスワードの再設定を強いない。旧 Cookie kanjo_session と自前の署名・世代照合は撤去する。
- **G3**: 利用者の追加を招待メール方式にする。テナント管理者が設定画面でメールアドレスと役割を入力すると、期限付き・1 回限りの招待トークンのリンクがメールで届き、本人がリンク先で Google アカウント (招待先と同じ確認済みメールアドレスのもの) か メールアドレスとパスワードかを選んで登録を完了する。管理者は招待の再送・取消と状態 (未承諾・承諾済み・期限切れ) を確認でき、ログイン画面の『招待メールを再送』は本人がメールアドレスを入れて再送を依頼でき、応答からは招待の有無が分からない。一時パスワードの発行 API・画面・初回変更の強制は撤去し、管理者は他人のパスワードを設定しない。自己登録 (サインアップ) は塞いだままにする。
- **G5**: 不正ログイン対策を画面の説明どおりにする。パスワードでのログインに TOTP の多要素認証を重ね、管理者は必須 (未設定の管理者は次回ログインで設定を求める)、一般利用者は設定画面で任意に有効化できる。復旧コードを発行し、TOTP を失った本人が復旧できる。Google でのログインは Google 側の 2 段階認証に委ねる。既存の IP・アカウント単位のレート制限と列挙防止を、ログイン・MFA コード・招待再送・パスワード再設定の各入口に広げる。認証情報 (利用者・セッション・認証手段・招待・MFA) は業務データの表と分けて保持し、ログイン情報は認証と保護の用途に限って使う。
- **G7**: 既存画面と API の契約を壊さずに移行する。/api/* の認証ガードの mount 順序、admin の判定、有効な管理者が 0 人になる変更の拒否、監査ログの actor 記録、Cloudflare Access のサーバ側検証経路の扱いを移行前と同じ契約テストで確かめ、移行用の migration は追加のみとして、移行の失敗時に旧経路へ戻せる手順を残す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | Better Auth へ移行しても既存の認証契約が保たれる。 | 既存の account-login の契約テスト (未認証の /api/* が 401、停止利用者の既存セッションが 401、非管理者の /api/admin/* が 403、最後の管理者の停止が 409、監査の actor_user_id) を Better Auth 版で緑にし、保持ありでは Set-Cookie の Max-Age が 30 日になり、保持なしでは Max-Age も Expires も持たないセッション Cookie になって、サーバ側のセッションが発行から 12 時間で失効し、途中のアクセスでも延長されない。既存の PBKDF2 ハッシュの利用者が再設定なしでログインできる移行テストが緑。 |
| O3 | Google でのログインが招待済みの確認済みメールアドレスだけを通す。 | ID トークンの email_verified=false、招待・登録の無いメールアドレス、停止中の利用者で Google ログインが拒否され、state / PKCE / nonce の不一致が拒否される統合テストが緑。自己登録の経路が 0 件。 |
| O4 | 招待が一時パスワード無しで完結する。 | 招待作成→メール送信 (送信 API はテストで差し替え)→リンクで Google またはパスワードを選んで登録、の 2 経路の統合テストが緑。トークンは期限切れ・使用済み・取消で拒否され、D1 にはトークンのハッシュだけが残る。一時パスワードの API・列・画面が 0 件。ログイン画面からの再送依頼は、招待の有無にかかわらず同じ応答になる。 |
| O6 | TOTP の多要素認証と不正ログイン対策が効く。 | 管理者はパスワードでのログイン後に TOTP の設定または入力を経ないとセッションが発行されず、一般利用者は有効化した場合だけ求められるテストが緑。復旧コードは 1 回限りでハッシュ保存。ログイン・MFA・再送・再設定の各入口で連続失敗がロックされ、他の利用者を阻害しないテストが緑。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: packages/api に Better Auth のインスタンスを置き、/api/auth/* を Better Auth のハンドラへ向け、authGuard・adminGuard を Better Auth のセッション取得に差し替える。
- **I3**: Better Auth の表 (user・session・account・verification・twoFactor) と招待表を追加のみの migration で作り、既存 users を複写する移行を用意する。PBKDF2 のハッシュは account.password に形式ごと移し、検証関数で読む。
- **I4**: 招待の作成・再送・取消・承諾の API と、設定画面の利用者管理を招待方式に作り直し、一時パスワードの API と画面と初回変更の強制を撤去する。
- **I5**: Resend の送信を 1 か所の関数に閉じ、招待・再設定・連携確認のメール本文を定義し、テストでは送信を差し替える。
- **I6**: TOTP 二要素を有効にし、管理者の必須化、復旧コード、MFA 設定画面を加える。レート制限を新しい入口へ広げる。
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

DDD の Bounded Context と Aggregate をログイン v2 に適用した。認証 (利用者・セッション・認証手段・招待・MFA) を業務データ (明細・分類) と別の bounded context とし、表を分け、業務の表から認証の表へ外部キーを張らない。招待は『期限内・未承諾・未取消の招待 1 件につき利用者 1 人』という不変条件を持つ aggregate とし、承諾 (消費) と利用者作成を同じ D1 batch で行う。新しい表の追加だけで既存 users を複写元として読むため、G7 の戻しは新しい表を無視するだけで済み、migration の巻き戻しを要しない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:42:56Z)

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
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-21T13:28:04Z | 2026-09-21T13:28:04Z |
