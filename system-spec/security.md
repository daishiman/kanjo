---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G4, G5, G6]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-login-v2-security-web-003。裏付け質疑 (`qa_refs`): `qa-login-v2-security-web-evidence-001`, `qa-login-v2-security-web-002`, `qa-login-v2-decision-001`, `qa-login-v2-decision-002`, `qa-login-v2-decision-003`, `qa-login-v2-security-web-004`, `qa-login-v2-auth-web-evidence-002`, `qa-login-v2-decision-005`, `qa-login-v2-decision-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5, G6 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、セキュリティでは端末紛失時に遠隔でセッションを失効させる手段と、画面キャプチャの抑止を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、セキュリティでは共有端末に残る MFA の復旧コード表示をどう隠すかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、セキュリティではデスクトップ版の自動更新の署名検証と、改ざんされた版からのログインの遮断を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、セキュリティでは配布リポジトリの署名鍵と改ざん検知を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、セキュリティでは公証とハードンドランタイムの下でのキーチェーンへのアクセス権を決める必要があった。本サイクルは web のみを対象とするため該当しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | ログイン v2 のセキュリティでは、新しい 4 つの入口 (MFA・再送・再設定・連携確認) を既存のレート制限の表に scope として足し、同じロックの規則を当てる形へ反映した (OWASP ASVS V2)。CSP は connect-src 'self' を保ち、Google への遷移はページ遷移だけで行ってスクリプトからの外部接続を増やさない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5, G6

#### 主たる接地根拠: `qa-login-v2-security-web-003`

**問**

ログイン v2 の セキュリティ に何を求めるか。

**答**

ログイン・MFA コード・招待の再送・パスワード再設定の各入口に IP とアカウントの 2 軸のレート制限を掛け、応答の本文・ステータス・所要時間から利用者や招待の有無が分からないようにする。認証に要る秘密 (署名鍵、Google の OAuth クライアント、メール送信の API キー) は Workers の secret で持ち、リポジトリ・ログ・応答に出さない。Google の認可は state・PKCE・nonce を検証する。サインインのついでの自動連携はさせない。外部へ出るのは Google (認可と ID トークンの検証) と Resend (宛先メールアドレスと本文) だけで、業務データは送らない。稼働状態 API はエラー文や構成を返さない。プライバシーページに外部送信先と利用目的・保存期間を載せる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### 裏付け質疑: `qa-login-v2-security-web-evidence-001`

**問**

セキュリティ 章の裏付けとして、01-login-v2.png と現行実装の差分として何を観測したか。

**答**

packages/api/src/index.ts の secureHeaders により CSP (default-src 'self'、connect-src 'self'、form-action 'self'、frame-ancestors 'none') と X-Frame-Options DENY を掛ける。認証入口は`auth-rate-limit.ts`でIP/確定accountの軸を使い分け、ログイン失敗の応答はアカウントの有無で変えない。wrangler.jsoncの必須secretは`BETTER_AUTH_SECRET`・Google Client ID/Secret・`RESEND_API_KEY`であり、旧`SESSION_SECRET`は使わない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 8f72ff0) の読取りによる観測。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-security-web-002`

**問**

web のログイン v2 で、セキュリティ について利用者が決めていない具体値を何にするか。

**答**

再送依頼・再設定依頼・MFA コード入力のレート制限は、既存と同じ 15 分に 5 回・15 分ロックの値を使い、scope_kind に 'invite_resend'・'password_reset'・'mfa' を加えて分ける。稼働状態 API は IP 単位で 1 分に 60 回までとする。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

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

#### 裏付け質疑: `qa-login-v2-security-web-004`

**問**

ログイン v2 の security を実装するときの具体的な手段と設定値は何か。

**答**

secret 名は BETTER_AUTH_SECRET・GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET・RESEND_API_KEY。自動連携を止める (disableImplicitLinking=true) のは、確認済みメールの Google アカウントを持つだけの者が既存アカウントへ入れてしまう経路を閉じ、連携を ASVS の再認証の要件に合わせるため。trustDevice を使わないのは、管理者の MFA 必須を信頼端末の 30 日で素通りさせないため。

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

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 本人が自力で復旧・連携できるようにする。『パスワードをお忘れの方』からメールアドレスを入れると、期限付き・1 回限りの再設定リンクがメールで届き、新しいパスワードを設定すると、その利用者の既存セッションを全て失効させる。応答からは登録の有無が分からない。同じメールアドレスで Google とパスワードの両方を使う本人は、ログイン済みの状態で既存の認証手段による再認証と、確認メールのリンクによるメール確認を経て、1 つのアカウントに連携できる。確認済みでない Google メールアドレスや、別のメールアドレスの Google アカウントは連携しない。連携の追加・解除は監査に残す。
- **G5**: 不正ログイン対策を画面の説明どおりにする。パスワードでのログインに TOTP の多要素認証を重ね、管理者は必須 (未設定の管理者は次回ログインで設定を求める)、一般利用者は設定画面で任意に有効化できる。復旧コードを発行し、TOTP を失った本人が復旧できる。Google でのログインは Google 側の 2 段階認証に委ねる。既存の IP・アカウント単位のレート制限と列挙防止を、ログイン・MFA コード・招待再送・パスワード再設定の各入口に広げる。認証情報 (利用者・セッション・認証手段・招待・MFA) は業務データの表と分けて保持し、ログイン情報は認証と保護の用途に限って使う。
- **G6**: ログイン前に確かめられる公開情報を用意する。フッターの『サービス状況』は認証不要の稼働状態 API から『正常』などを表示し、内部の詳細 (エラー文・構成) は返さない。『ヘルプ』と『プライバシー』は認証不要の静的ページとして、ログインの手順・招待・再設定・連携・MFA の説明と、ログイン情報の利用目的・保存期間・外部送信先 (Google・メール送信事業者) を示す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O5 | パスワード再設定とアカウント連携が本人確認を経て完結する。 | 再設定リンクで新パスワードを設定すると既存セッションが全て 401 になり、登録の有無で応答が変わらないテストが緑。連携は再認証とメール確認の両方を経ないと成立せず、別メールや未確認の Google アカウントは連携されないテストが緑。連携の追加・解除が audit_log に残る。 |
| O6 | TOTP の多要素認証と不正ログイン対策が効く。 | 管理者はパスワードでのログイン後に TOTP の設定または入力を経ないとセッションが発行されず、一般利用者は有効化した場合だけ求められるテストが緑。復旧コードは 1 回限りでハッシュ保存。ログイン・MFA・再送・再設定の各入口で連続失敗がロックされ、他の利用者を阻害しないテストが緑。 |
| O7 | 公開の稼働状態・ヘルプ・プライバシーが認証なしで見られ、内部情報を出さない。 | 未認証で稼働状態 API が 200 と状態値 (normal / degraded など) だけを返し、エラー文や構成を含まないテストが緑。ヘルプとプライバシーの画面が未認証で描画され、プライバシーに外部送信先 (Google・メール送信事業者) と利用目的・保存期間が載る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I5**: Resend の送信を 1 か所の関数に閉じ、招待・再設定・連携確認のメール本文を定義し、テストでは送信を差し替える。
- **I6**: TOTP 二要素を有効にし、管理者の必須化、復旧コード、MFA 設定画面を加える。レート制限を新しい入口へ広げる。
- **I7**: 認証不要の GET /api/status と、/help・/privacy の公開ページを加え、ログイン画面のフッターから辿れるようにする。

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

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

OWASP ASVS の認証・セッション管理の card をログイン v2 に適用した。列挙防止は応答の本文だけでなく所要時間まで揃え、送信は応答の後に回す。トークンの保存はハッシュに限り、漏えいしても D1 の中身から招待や再設定を再現できないようにする。

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
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release | 2026-09-21T13:28:33Z | 2026-09-21T13:28:33Z |
