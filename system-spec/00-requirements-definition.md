---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

金融明細を預かる入口を、テナント管理者に招待された本人だけが、自分で選んだ認証手段 (Google アカウント または メールアドレスとパスワード) で入れる場にする。管理者は他人の秘密 (仮パスワード) を一切持たず、招待はメールのリンクで本人に届き、本人がその場で認証手段を選んで登録を完了する。パスワードを忘れた本人は自分で再設定でき、同じメールアドレスで Google とパスワードの両方を使う本人は、再認証とメール確認を経て 1 つのアカウントに安全に連携できる。パスワードでのログインには TOTP の多要素認証を重ね (管理者は必須)、ログイン画面は『何が守られるか』(暗号化・MFA・不正ログイン対策、認証用途に限った情報利用、認証情報とテナント内データの分離) と、サービスの稼働状況・ヘルプ・プライバシーをログイン前に示す。5 Whys の帰結: (1) なぜログイン画面を変えるか→現行は管理者が一時パスワードを発行して別経路で伝える方式で、管理者が他人の秘密を一度は知ってしまい、伝達経路で漏れうる (2) なぜ問題か→金融データの入口で『本人しか知らない秘密』が成り立っていない (3) なぜ今か→共同利用者 (家族・委託先) に任せる運用が現実になり、招待・再設定・退出が管理者の手作業に集中している (4) なぜ Google か→共同利用者の多くは既に Google アカウントの 2 段階認証を持っており、新しいパスワードを増やすより安全で迷わない (5) 本質→入口の秘密を本人だけが持つ形にし、本人が自力で登録・復旧・連携でき、その保護の中身をログイン前に確かめられる状態にする。

## U2 背景 (background)

現行のログイン (packages/web/src/pages/Login.tsx、packages/api/src/routes/auth.ts・auth.ts・users.ts) は、メールアドレスとパスワードだけの自前認証である。PBKDF2-SHA256 (100,000 回) でハッシュを保存し、Cookie kanjo_session は userId.expiresAt.generation を HMAC で署名する。セッション表は無く、users.session_generation を進めて一括失効させる。ログイン状態の保持は既定 ON で、ON なら 30 日、OFF なら 12 時間である。レート制限は IP とアカウントの 2 軸 (15 分に 5 回失敗で 15 分ロック)、列挙防止 (未登録・停止・誤パスワードを同じ 401・同じ所要時間で返す)、audit_log.actor_user_id への認証系の記録が動いている。一方、利用者の追加と再発行は管理者が設定画面で 16 文字・72 時間の一時パスワードを発行し、別経路で伝える方式で、『パスワードをお忘れの方』は管理者への連絡を案内するモーダルだけである。Google ログイン・招待メール・再送・メールでの再設定・アカウント連携・メール確認・MFA・サービス状況の公開はどの層にも無く、メール送信基盤も無い (wrangler の必須 secret は SESSION_SECRET だけ、配信は workers.dev で独自ドメインが無い)。ログインカードにはロゴが無く、ブランド名 Focus Ledger は認証後のサイドバーにしか出ない。これらは 2026-09-11 の利用者決定 (メール送信なし・SSO なし・MFA なし・一時パスワード方式) に基づいていたが、2026-09-21 に参照 UI design/FINAL-UI/images/01-login-v2.png が提示され、利用者は画像を正として (1) 認証基盤を Better Auth へ全面移行 (2) メール送信は Resend などの外部 API (3) MFA は TOTP で管理者必須・一般任意 (4) 一時パスワードを撤去して招待リンク方式へ置換、と決定した。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | /login を 01-login-v2.png どおりの画面にする。カード上のロゴ (棒グラフのマークと Focus Ledger)、見出し『ログイン』と『登録済みの認証方法でログインしてください。』、『Google でログイン』ボタンと『招待先と同じメールアドレスの Google アカウントを使用してください。』、『または』の区切り、『メールアドレスとパスワードでログイン』のメールアドレス・パスワード (表示切替)・『次回からもログイン状態を保持する』(保持 30 日 / 非保持 12 時間の説明)・『ログイン』ボタン・『パスワードをお忘れの方』、『招待を受けた方』の案内と『招待メールを再送』ボタンと『アカウントはテナント管理者からの招待で作成されます。』、アカウント連携の案内 (連携時は再認証とメール確認が必要)、『安心してご利用いただくために』のセキュリティ・プライバシー・お客様のデータの 3 項目、フッターの『サービス状況』(稼働状態の表示)・『ヘルプ』・『プライバシー』を、既存のデザイントークンと共通部品の上に単一カラムで組む。送信中・認証失敗・ロック中・MFA コード入力・招待再送の受付・パスワード再設定の受付の各状態を持つ。 |
| G2 | 認証基盤を Better Auth (Hono の Cloudflare Worker + D1) へ全面移行する。メールアドレスとパスワード、Google (OIDC) の 2 つの認証手段と、D1 のセッション表によるセッション管理を Better Auth で行い、ログイン状態の保持 (保持は 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間)・停止した利用者の発行済みセッションの即時失効・/api/* の認証ガードと admin 判定・audit_log の actor_user_id を移行後も同じ契約で満たす。既存利用者は PBKDF2 のハッシュを保ったまま移し、パスワードの再設定を強いない。旧 Cookie kanjo_session と自前の署名・世代照合は撤去する。 |
| G3 | 利用者の追加を招待メール方式にする。テナント管理者が設定画面でメールアドレスと役割を入力すると、期限付き・1 回限りの招待トークンのリンクがメールで届き、本人がリンク先で Google アカウント (招待先と同じ確認済みメールアドレスのもの) か メールアドレスとパスワードかを選んで登録を完了する。管理者は招待の再送・取消と状態 (未承諾・承諾済み・期限切れ) を確認でき、ログイン画面の『招待メールを再送』は本人がメールアドレスを入れて再送を依頼でき、応答からは招待の有無が分からない。一時パスワードの発行 API・画面・初回変更の強制は撤去し、管理者は他人のパスワードを設定しない。自己登録 (サインアップ) は塞いだままにする。 |
| G4 | 本人が自力で復旧・連携できるようにする。『パスワードをお忘れの方』からメールアドレスを入れると、期限付き・1 回限りの再設定リンクがメールで届き、新しいパスワードを設定すると、その利用者の既存セッションを全て失効させる。応答からは登録の有無が分からない。同じメールアドレスで Google とパスワードの両方を使う本人は、ログイン済みの状態で既存の認証手段による再認証と、確認メールのリンクによるメール確認を経て、1 つのアカウントに連携できる。確認済みでない Google メールアドレスや、別のメールアドレスの Google アカウントは連携しない。連携の追加・解除は監査に残す。 |
| G5 | 不正ログイン対策を画面の説明どおりにする。パスワードでのログインに TOTP の多要素認証を重ね、管理者は必須 (未設定の管理者は次回ログインで設定を求める)、一般利用者は設定画面で任意に有効化できる。復旧コードを発行し、TOTP を失った本人が復旧できる。Google でのログインは Google 側の 2 段階認証に委ねる。既存の IP・アカウント単位のレート制限と列挙防止を、ログイン・MFA コード・招待再送・パスワード再設定の各入口に広げる。認証情報 (利用者・セッション・認証手段・招待・MFA) は業務データの表と分けて保持し、ログイン情報は認証と保護の用途に限って使う。 |
| G6 | ログイン前に確かめられる公開情報を用意する。フッターの『サービス状況』は認証不要の稼働状態 API から『正常』などを表示し、内部の詳細 (エラー文・構成) は返さない。『ヘルプ』と『プライバシー』は認証不要の静的ページとして、ログインの手順・招待・再設定・連携・MFA の説明と、ログイン情報の利用目的・保存期間・外部送信先 (Google・メール送信事業者) を示す。 |
| G7 | 既存画面と API の契約を壊さずに移行する。/api/* の認証ガードの mount 順序、admin の判定、有効な管理者が 0 人になる変更の拒否、監査ログの actor 記録、Cloudflare Access のサーバ側検証経路の扱いを移行前と同じ契約テストで確かめ、移行用の migration は追加のみとして、移行の失敗時に旧経路へ戻せる手順を残す。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | ログイン画面が画像の全構成要素と各状態を描画する。 | DOM テストで、ロゴ・見出しと説明・Google ボタンと注記・区切り・メールとパスワード欄と表示切替・保持のチェックと 30 日 / 12 時間の説明・ログインボタン・再設定リンク・招待の案内と再送ボタン・連携の案内・安心 3 項目・フッター 3 リンクと稼働表示が描画され、送信中・失敗・ロック・MFA コード入力・再送受付・再設定受付の状態テストが緑である。色は design-tokens 由来だけで直書き色の lint が 0 件。 |
| O2 | Better Auth へ移行しても既存の認証契約が保たれる。 | 既存の account-login の契約テスト (未認証の /api/* が 401、停止利用者の既存セッションが 401、非管理者の /api/admin/* が 403、最後の管理者の停止が 409、監査の actor_user_id) を Better Auth 版で緑にし、保持ありでは Set-Cookie の Max-Age が 30 日になり、保持なしでは Max-Age も Expires も持たないセッション Cookie になって、サーバ側のセッションが発行から 12 時間で失効し、途中のアクセスでも延長されない。既存の PBKDF2 ハッシュの利用者が再設定なしでログインできる移行テストが緑。 |
| O3 | Google でのログインが招待済みの確認済みメールアドレスだけを通す。 | ID トークンの email_verified=false、招待・登録の無いメールアドレス、停止中の利用者で Google ログインが拒否され、state / PKCE / nonce の不一致が拒否される統合テストが緑。自己登録の経路が 0 件。 |
| O4 | 招待が一時パスワード無しで完結する。 | 招待作成→メール送信 (送信 API はテストで差し替え)→リンクで Google またはパスワードを選んで登録、の 2 経路の統合テストが緑。トークンは期限切れ・使用済み・取消で拒否され、D1 にはトークンのハッシュだけが残る。一時パスワードの API・列・画面が 0 件。ログイン画面からの再送依頼は、招待の有無にかかわらず同じ応答になる。 |
| O5 | パスワード再設定とアカウント連携が本人確認を経て完結する。 | 再設定リンクで新パスワードを設定すると既存セッションが全て 401 になり、登録の有無で応答が変わらないテストが緑。連携は再認証とメール確認の両方を経ないと成立せず、別メールや未確認の Google アカウントは連携されないテストが緑。連携の追加・解除が audit_log に残る。 |
| O6 | TOTP の多要素認証と不正ログイン対策が効く。 | 管理者はパスワードでのログイン後に TOTP の設定または入力を経ないとセッションが発行されず、一般利用者は有効化した場合だけ求められるテストが緑。復旧コードは 1 回限りでハッシュ保存。ログイン・MFA・再送・再設定の各入口で連続失敗がロックされ、他の利用者を阻害しないテストが緑。 |
| O7 | 公開の稼働状態・ヘルプ・プライバシーが認証なしで見られ、内部情報を出さない。 | 未認証で稼働状態 API が 200 と状態値 (normal / degraded など) だけを返し、エラー文や構成を含まないテストが緑。ヘルプとプライバシーの画面が未認証で描画され、プライバシーに外部送信先 (Google・メール送信事業者) と利用目的・保存期間が載る。 |

## U5 成功基準 (success_criteria)

- S1 (G1): /login で 01-login-v2.png の構成要素がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件である。
- S2 (G2/G7): Better Auth 移行後も、未認証の /api/* が 401、停止利用者の発行済みセッションが 401、非管理者の管理 API が 403、最後の管理者の停止が 409 になり、既存の PBKDF2 利用者がパスワード再設定なしでログインできる。旧 Cookie kanjo_session の署名経路は 0 件である。
- S3 (G3): 招待された本人が、メールのリンクから Google またはパスワードを選んで自分で登録を完了でき、管理者がパスワードを設定する経路が 0 件である。ログイン画面からの再送依頼の応答で招待の有無が分からない。
- S4 (G4): 本人がメールで再設定を完了すると既存セッションが全て失効し、応答から登録の有無が分からない。同じメールの Google とパスワードは再認証とメール確認を経たときだけ 1 アカウントに連携される。
- S5 (G5): 管理者はパスワードでのログインで TOTP を必ず求められ、一般利用者は任意で有効化できる。各入口で連続失敗がロックされ、認証情報は業務データの表と分かれている。
- S6 (G6): 未認証で稼働状態・ヘルプ・プライバシーが見られ、稼働状態の応答に内部情報が含まれない。
- S7 (G7): 既存 20 画面の認証ガードと契約テストが緑のまま、移行の migration は追加のみで、旧経路への戻し手順が docs にある。

## U6 ステークホルダー (stakeholders)

- SH1 利用者本人 (事業と家計を 1 人で見ている運営者、兼テナント管理者): 月次を締めようとする状況で、迷わずログインしたい。家族や委託先を招待するときに、他人のパスワードを自分が知ってしまう運用をやめたい。自分の管理者アカウントは MFA で守りたい。
- SH2 招待される共同利用者 (家族・委託先): 招待メールを受け取った状況で、普段使っている Google アカウントか、自分だけが知るパスワードのどちらかを選んで登録したい。パスワードを忘れても管理者に頼まず自分で戻りたい。
- SH3 初見でログイン画面を開く人: 金融データを預ける前に、何が守られるのか、今サービスが動いているのか、困ったときにどこを見ればよいのかを知りたい。
- SH4 事後の調査主体 (事故や誤操作の後に運営者自身が担う): 招待・連携・再設定・MFA の変更が、いつ誰の操作で起きたかを追いたい。
- SH5 保守者 (同一人物、および Claude Code などのコーディングエージェント): 認証をライブラリ (Better Auth) の正規の機能に寄せ、自前の暗号処理を減らしたい。移行で既存 20 画面と API の契約を壊したくない。

## U7 スコープ (scope)

- **対象 (in)**: ログイン画面 (01-login-v2.png の全構成要素と各状態) の作り直しと、招待の承諾・パスワード再設定・MFA の設定と入力・アカウント連携の各画面, Better Auth (メールとパスワード、Google、セッション、TOTP 二要素、アカウント連携) の導入と、自前認証 (kanjo_session・署名・世代照合・一時パスワード) の撤去, 既存 users と PBKDF2 ハッシュの Better Auth の表への移行 (追加のみの migration と移行スクリプト、再設定を強いない), 招待 (作成・送信・再送・取消・状態表示・承諾) の API と管理画面、ログイン画面からの再送依頼, Resend によるメール送信 (招待・再設定・連携確認) と、送信 API のテスト用の差し替え, IP・アカウント単位のレート制限と列挙防止の新しい入口への拡張、監査ログの新しい action, 認証不要の稼働状態 API とヘルプ・プライバシーの公開ページ, docs (移行と戻し手順・secret の設定手順・Google Cloud Console の設定手順・プライバシーの記載) の更新
- **対象外 (out)**: 自己登録 (サインアップ): 金融明細を扱うため、招待制のみを維持する, Google 以外のソーシャルログイン・SAML などの企業 SSO: 画像に無く、利用者の決定は Google のみ, パスキー (WebAuthn)・SMS による MFA: 利用者の決定は TOTP, 複数テナント (テナントの新設・切替): 画像の『テナント管理者』は現行の単一テナント 'default' の管理者を指し、テナント機構そのものは作らない, 外部の状況ページサービス (Statuspage など) との連携: 稼働状態は自前の API で表示する, 独自ドメインの取得・DNS 設定そのもの: 利用者が用意する前提で、手順だけを docs に書く, web 以外のプラットフォーム (mobile / tablet / desktop-windows / desktop-linux / desktop-macos): 専用アプリを提供しておらず、対象を web のみとする

## U8 制約 (constraints)

- C1 技術: pnpm monorepo (core は依存ゼロの純関数、api は Hono の Cloudflare Worker と D1/Drizzle、web は React 18 + react-router-dom 7 + TanStack Query 5)。Better Auth は Hono と D1 の組み合わせで動かし、バージョンを固定する。
- C2 secret: `BETTER_AUTH_SECRET`・Google の Client ID / Secret・Resend の API キーを wrangler secret で持ち、旧 `SESSION_SECRET` は認証切替と同時に廃止する。値はリポジトリ・ログ・応答に出さない。Google Cloud Console の OAuth 設定と Resend の送信ドメイン認証は利用者の作業として手順を切り出す。
- C3 migration: D1 の migration は追加のみ (新表・新カラム) とし、既存 users からの移し替えは INSERT ... SELECT の新表への複写で行い、既存の行を書き換えない。旧表の削除は本サイクルでは行わない。
- C4 移行の互換: 既存の PBKDF2 ハッシュ (pbkdf2-sha256$ の自己記述形式) を Better Auth のパスワード検証で読めるようにし、既存利用者にパスワードの再設定を強いない。
- C5 デザイン: docs/design-system.md に従い、色は design-tokens.ts 由来のトークンだけ、共通部品 (Button・ConfirmDialog・UiIcon) を使う。ログイン画面はアプリ枠 (サイドバー・ヘッダー) の外に置く。
- C6 列挙防止: ログイン・再送依頼・再設定依頼の応答 (本文・ステータス・所要時間) から、利用者や招待の有無を推測できてはならない。
- C7 外部送信: 外部へ出るのは Google (OIDC の認可と ID トークンの検証) と Resend (宛先メールアドレスと本文) だけで、業務データ (明細・金額) は送らない。
- C8 運用: 実質 1 人の運用者で回る手順にする。管理者が自分を締め出して復旧不能になる状態 (最後の管理者の停止・MFA 喪失) を、復旧コードと seed スクリプトで戻せるようにする。
- C9 対象: web のみ。Cloudflare Access のサーバ側検証経路は利用者決定 2026-09-11 を維持して残置する。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | Login.tsx を features/auth/ 配下へ分割し、ロゴ・見出し・Google ボタン・区切り・メールとパスワードのフォーム・招待の案内と再送・連携の案内・安心 3 項目・フッターの構成に作り直す。招待承諾・再設定・MFA の画面を加える。 | G1 |
| I2 | packages/api に Better Auth のインスタンスを置き、/api/auth/* を Better Auth のハンドラへ向け、authGuard・adminGuard を Better Auth のセッション取得に差し替える。 | G2, G7 |
| I3 | Better Auth の表 (user・session・account・verification・twoFactor) と招待表を追加のみの migration で作り、既存 users を複写する移行を用意する。PBKDF2 のハッシュは account.password に形式ごと移し、検証関数で読む。 | G2, G3, G7 |
| I4 | 招待の作成・再送・取消・承諾の API と、設定画面の利用者管理を招待方式に作り直し、一時パスワードの API と画面と初回変更の強制を撤去する。 | G3 |
| I5 | Resend の送信を 1 か所の関数に閉じ、招待・再設定・連携確認のメール本文を定義し、テストでは送信を差し替える。 | G3, G4 |
| I6 | TOTP 二要素を有効にし、管理者の必須化、復旧コード、MFA 設定画面を加える。レート制限を新しい入口へ広げる。 | G5 |
| I7 | 認証不要の GET /api/status と、/help・/privacy の公開ページを加え、ログイン画面のフッターから辿れるようにする。 | G6 |
| I8 | docs に移行・戻し・secret・Google Cloud Console・Resend の手順とプライバシーの記載を置く。 | G7 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-login-v2-002`

完成度再評価 (high 2 / medium) を受けた AskUserQuestion (2026-09-21T13:58:57.447Z、transcript 実測) で利用者が選択: (1) 訂正後の比較 (Better Auth は既定で同じメールの自動連携・役割ごとの MFA 強制なし・ログインごとの期限なし) を見たうえで Better Auth を継続、(2) O6 どおり MFA 未設定の管理者にはセッションを発行しない、(3) Google でログインした管理者に TOTP を求めず Google 側に委ねる (G5 のまま)、(4) 保持しないログインはブラウザを閉じるまで+最長 12 時間とし、O2 を『Max-Age なし、サーバ側で 12 時間』に書き直す (選択肢の説明に O2 の書き直しを明記して提示)。本承認は O2 の測定と G2 の保持の書き方の変更だけを対象とし、appr-foundation-login-v2-001 の他の内容は変えない。basis=user-decision。

### 承認: `appr-foundation-login-v2-001`

ログイン画面 v2 サイクルの上位概念 U1-U9 (G1〜G7) を利用者が承認。画像 design/FINAL-UI/images/01-login-v2.png を正本とする。先立つ決定 (同日 AskUserQuestion): 認証基盤は Better Auth へ全面移行 / メール送信は Resend など外部 API / MFA は TOTP で管理者必須・一般任意 / 一時パスワードを撤去し招待リンク方式へ置換。選択肢は『この内容で承認 / 修正して再提示』で利用者は承認を選択 (2026-09-21T13:17:48Z、承認直後の date -u 実測)。basis=user-decision。

#### この承認を名指ししている質疑: `qa-login-v2-target-platforms-001`

**問**

ログイン v2 サイクルで、web 以外 (スマートフォン・タブレット・Windows / Linux / macOS のデスクトップ) の専用アプリを対象にするか。

**答**

対象にしない。上位概念の範囲外 (scope.out) に『web 以外のプラットフォーム (専用アプリを提供しておらず、対象を web のみとする)』を置いた U1-U9 要約を、利用者が『この内容で承認』で承認した (appr-foundation-login-v2-001)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / U1-U9 承認 (scope.out に web 以外を明記) / 回答時刻: 2026-09-21T13:17:41Z)

#### この承認を名指ししている質疑: `qa-login-v2-ui-ux-web-001`

**問**

ログイン v2 の UI-UX に何を求めるか。

**答**

/login を画像どおりの単一カラムにする。上から、ロゴ (棒グラフのマークと Focus Ledger)、見出し『ログイン』と説明、『Google でログイン』と注記、『または』、メールアドレス・パスワード (表示切替)・保持のチェック (保持 30 日 / 非保持 12 時間の説明)・『ログイン』・『パスワードをお忘れの方』、『招待を受けた方』の案内と『招待メールを再送』、連携の案内、『安心してご利用いただくために』の 3 項目、フッターの『サービス状況』(稼働表示)・『ヘルプ』・『プライバシー』。task 頻度が最も高い『既存の手段でログインする』を最上段に置き、失敗コストが高い再送・再設定・連携は下段の説明付きの入口にする。状態は送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付の 6 つを持ち、失敗と受付の文言から利用者や招待の有無が分からないようにする。招待承諾・再設定・MFA 設定・連携の画面も同じカードの型で作る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:27:06Z)

#### この承認を名指ししている質疑: `qa-login-v2-maintenance-ops-web-001`

**問**

ログイン v2 の 保守運用 に何を求めるか。

**答**

docs に、Better Auth への移行と戻しの手順、secret の設定手順、Google Cloud Console と Resend の設定手順、管理者が締め出されたとき (最後の管理者の停止・MFA 喪失) の復旧手順を置く。runbook の一時パスワードの手順は招待の再送と取消の手順に置き換える。既存の account-login の契約テストを Better Auth 版で緑にし、招待・再設定・連携・MFA・稼働状態の統合テストを加える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:27:06Z)

#### この承認を名指ししている質疑: `qa-login-v2-auth-web-003`

**問**

ログイン v2 の 認証(ログイン) に何を求めるか。

**答**

認証手段はメールとパスワード、Google の 2 つとし、Better Auth で扱う。Google は招待先と同じ確認済みメールアドレスのときだけ通し、停止中の利用者は拒否する。既存のパスワードは再設定を強いずにそのまま使えるようにする。多要素認証 (TOTP) はパスワードでのログインに掛け、管理者は必須 (未設定なら次回ログインで設定を求める)、一般は任意とし、1 回限りの復旧コードを発行する。Google ログインは Google 側の 2 段階認証に委ねる。連携はログイン済みで既存手段による再認証と確認メールのリンクを経たときだけ成立させ、サインインのついでに自動で連携することはしない。別メールの Google は連携しない。パスワード再設定の完了で既存セッションを全て失効させる。ログイン状態は保持するとき 30 日、保持しないとき 12 時間とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### この承認を名指ししている質疑: `qa-login-v2-backend-web-003`

**問**

ログイン v2 の バックエンド に何を求めるか。

**答**

/api/auth/* を Better Auth に向け、既存の認証ガードと管理者判定は、mount 順序・401/403/409 の契約・監査ログの操作者記録を保ったまま Better Auth のセッションで判定する。初回パスワード変更の強制は撤去する。招待 (作成・一覧・再送・取消・承諾)、再送依頼、再設定依頼の API を加え、承諾では招待と同じ確認済みメールアドレスの Google アカウントか、メールとパスワードでだけ登録を完了する。招待を経ない利用者作成 (自己登録) の経路は 0 件にする。メール送信は Resend を呼ぶ 1 か所に閉じ、テストでは差し替える。TOTP は管理者に必須、一般は任意とし、連携は再認証と確認メールを経たときだけ成立させる。認証不要の稼働状態 API を加える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### この承認を名指ししている質疑: `qa-login-v2-database-web-003`

**問**

ログイン v2 の データベース に何を求めるか。

**答**

D1 の migration は追加のみとし、認証の表 (利用者・セッション・認証手段・確認用トークン・多要素認証) と招待表を新設する。既存の利用者は新しい表へ複写し、既存のパスワードハッシュは形式ごと移して、既存の行を書き換えない。旧表と列は本サイクルでは削除しない。トークンと復旧コードは平文で保存しない。認証情報の表は業務データの表と分け、業務データの表から認証の表へ外部キーを張り足さない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### この承認を名指ししている質疑: `qa-login-v2-security-web-003`

**問**

ログイン v2 の セキュリティ に何を求めるか。

**答**

ログイン・MFA コード・招待の再送・パスワード再設定の各入口に IP とアカウントの 2 軸のレート制限を掛け、応答の本文・ステータス・所要時間から利用者や招待の有無が分からないようにする。認証に要る秘密 (署名鍵、Google の OAuth クライアント、メール送信の API キー) は Workers の secret で持ち、リポジトリ・ログ・応答に出さない。Google の認可は state・PKCE・nonce を検証する。サインインのついでの自動連携はさせない。外部へ出るのは Google (認可と ID トークンの検証) と Resend (宛先メールアドレスと本文) だけで、業務データは送らない。稼働状態 API はエラー文や構成を返さない。プライバシーページに外部送信先と利用目的・保存期間を載せる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### この承認を名指ししている質疑: `qa-login-v2-infrastructure-web-003`

**問**

ログイン v2 の インフラ に何を求めるか。

**答**

Better Auth は Worker の中に置き、追加の外部サービスは Google (OIDC) と Resend だけにする。認証に要る秘密は Workers の secret として必須にし、Better Auth の配信元の設定を本番の配信元に合わせる。Google Cloud Console の OAuth 設定、Resend の送信ドメイン認証 (SPF / DKIM)、独自ドメインの用意は利用者の作業として手順を docs に切り出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### この承認を名指ししている質疑: `qa-login-v2-frontend-web-003`

**問**

ログイン v2 の フロントエンド に何を求めるか。

**答**

ログイン画面を部品に分けて画像どおりに作り直す (ロゴ・見出し・Google ボタン・区切り・フォーム・招待の案内と再送・連携の案内・安心の 3 項目・フッター)。招待承諾・パスワード再設定・MFA (設定と入力)・ヘルプ・プライバシーを未認証で到達できる画面として加え、設定画面のアカウント欄に連携と MFA の管理を置く。利用者管理は招待の作成・再送・取消と状態表示に作り直し、一時パスワードの発行と初回変更の強制の画面を撤去する。既存のデザイントークンと共通部品の上に組む。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

- この承認を名指ししているが**現在どの決着済みセルからも参照されていない質疑**: `qa-login-v2-frontend-web-001`, `qa-login-v2-backend-web-001`, `qa-login-v2-database-web-001`, `qa-login-v2-auth-web-001`, `qa-login-v2-security-web-001`, `qa-login-v2-infrastructure-web-001` — R4-reopen で差し替えられた旧版であり、接地根拠としては効いていない (本文と基準は spec-state.json の qa_log と reopen_log に残る)

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| dec-login-v2-auth-foundation | Google ログイン・連携・MFA をどの認証基盤で実装するか。 | confirmed | opt-self-oidc:自前認証に Google OIDC を追加 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': 'ライブラリ費用なし。Authorization Code + PKCE・ID トークン検証・連携・TOTP・復旧コードを自前で書き、保守し続ける費用が要る。'} / free=外部の有料サービスを使わない。Workers と D1 の既存の無料枠内。 / fit=既存の users・セッション世代・監査にそのまま載り差分は最小。ただし連携・MFA を全部自作する。 / pros=既存の契約テストを壊さない, 依存が増えない / cons=連携と MFA の実装量が大きい / risks=OIDC 検証の自作ミス / lock-in=なし / ops=中 / evidence=https://developers.google.com/identity/openid-connect/openid-connect<br>opt-better-auth:Better Auth へ全面移行 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': 'OSS でライセンス費なし。認証表の移行と既存契約テストの作り直しが一度きりの費用、以後はライブラリ更新の追従費。'} / free=OSS。自前の D1 に表を置くため外部の課金枠は無い。Workers では nodejs_compat (AsyncLocalStorage) が要る。 / fit=Google・パスワード・アカウント連携・TOTP 二要素と復旧コードを 1 つの基盤で賄え、G2/G4/G5 の機能を部品として得られる。 / pros=連携・MFA・再設定の機能が揃う, Hono の /api/auth/* に載る / cons=セッション方式と認証表が入れ替わり移行が大きい, 既存 PBKDF2 は password.verify の差し替えで読む必要がある / risks=移行中に認証ガードの契約を落とす, ライブラリの破壊的変更 / lock-in=中 (Better Auth の表構造と API に依存) / ops=中 / evidence=https://www.better-auth.com/docs/integrations/hono, https://www.better-auth.com/docs/authentication/email-password, https://www.better-auth.com/docs/concepts/users-accounts, https://www.better-auth.com/docs/concepts/oauth, https://www.better-auth.com/docs/concepts/session-management, https://www.better-auth.com/docs/plugins/2fa<br>opt-managed-idp:外部 IdP (Cloudflare Access) に委ねる / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': 'Zero Trust Free は 50 ユーザーまで無料。ログイン画面そのものが IdP 側になり、画像の画面は作れない。'} / free=Cloudflare Zero Trust Free: 50 users。 / fit=画像のログイン画面・招待・MFA の表示を自アプリに持てず G1 と合わない。 / pros=認証の実装が不要 / cons=画像の画面を再現できない / risks=利用者数の上限 / lock-in=高 (Cloudflare Access) / ops=低 / evidence=https://developers.cloudflare.com/cloudflare-one/ | opt-self-oidc — 既存の認証契約を最も壊さずに Google ログインを足せるため、AI としては自前 OIDC 追加を推奨として提示した。 (注意: 利用者は Better Auth を選択したため、移行時に既存契約テストを Better Auth 版で緑にする (O2), PBKDF2 ハッシュは password.verify の差し替えで読み、再設定を強いない (C4), Better Auth は docs 上、役割ごとの 2FA 強制とログインごとのセッション期限を持たないため、管理者の MFA 必須と非保持 12 時間はアプリ側 (session.create.before の関門と rememberMe:false) で実装し、テストで確かめる (qa-login-v2-auth-web-005)。, 公式 docs の再確認 (2026-09-21T13:40:00Z 以前) で訂正: 当初の比較根拠『Better Auth は確認済みメールでだけ連携する既定』は G4 と逆向きで、既定は確認済みメールによる自動連携だった (qa-login-v2-auth-web-evidence-002)。訂正後の比較を 2026-09-21T13:58:57Z に利用者へ再提示し、利用者は Better Auth の継続を選んだ (qa-login-v2-decision-005)。; confidence=medium; checked=2026-09-21T13:40:00Z) | opt-better-auth @ 2026-09-21T13:58:57Z | G2, G4, G5, G7 |
| dec-login-v2-mail-delivery | 招待・パスワード再設定・連携確認のメールをどの基盤で送るか。 | confirmed | opt-cf-email-service:Cloudflare Email Service / cost={'category': 'low-cost', 'amount': 5, 'currency': 'USD', 'billing_period': 'month', 'tco': '任意宛先への送信は Workers Paid (月 5 USD) が前提で、月 3,000 通を含み超過は 1,000 通あたり 0.35 USD。ドメインを Cloudflare に置く作業が要る。'} / free=Workers Paid: 3,000 通/月を含む。検証済み宛先への送信だけは全プラン無料。 / fit=API キー無しで送れ、外部事業者を増やさない。ただしドメインの Cloudflare 移管と有料プランが前提。 / pros=API キーが不要, 外部送信先が増えない / cons=Workers Paid が必須, ドメインを Cloudflare に置く必要 / risks=ドメイン準備が済むまで送れない / lock-in=中 (send_email binding) / ops=低 / evidence=https://developers.cloudflare.com/email-service/platform/pricing/, https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/<br>opt-resend:Resend など外部 API / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': 'Free プランで月 3,000 通・日 100 通・3 ドメイン。超えたら Pro 月 20 USD。送信関数 1 か所の保守費。'} / free=Resend Free: 3,000 emails/month、100 emails/day、3 domains。 / fit=HTTP の fetch だけで Workers から送れ、招待・再設定・連携確認の量は無料枠に収まる。 / pros=無料枠で足りる, 実装が fetch 1 本 / cons=外部事業者へ宛先が渡る / risks=API キーの漏えい, 日 100 通の上限 / lock-in=低 (送信関数を差し替えれば移れる) / ops=低 / evidence=https://resend.com/pricing, https://resend.com/docs/api-reference/emails/send-email<br>opt-mail-disabled:ドメイン準備まで送信を無効化 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '費用なし。ただし本番で招待と再設定が送れず、機能としては成立しない。'} / free=外部サービスを使わない。 / fit=送信のインターフェースだけを作り、G3/G4 は本番で満たせない。 / pros=費用と外部依存が無い / cons=本番で招待・再設定が届かない / risks=利用者が自力で復旧できない / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/configuration/secrets/ | opt-cf-email-service — 外部事業者を増やさず API キーも不要なため Cloudflare Email Service を推奨として提示した。 (注意: 利用者は Resend を選択したため、宛先メールアドレスが Resend へ渡ることをプライバシーページに明記する (G6/C7), 送信は 1 関数に閉じ、テストでは差し替える (I5); confidence=medium; checked=2026-09-21T13:21:10Z) | opt-resend @ 2026-09-21T13:14:00Z | G3, G4 |
| dec-login-v2-mfa-scope | 画像の『MFA と不正ログイン対策で保護』を事実にするため、MFA の範囲をどうするか。 | confirmed | opt-totp-admin-required:TOTP・管理者は必須、一般は任意 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': 'Better Auth の twoFactor plugin で賄え追加費用なし。管理者の必須化と復旧コードの画面の実装費。'} / free=OSS の plugin。外部サービスを使わない。 / fit=画像の説明を事実にしつつ、一般利用者の初回の手間を増やさない。 / pros=管理者の乗っ取りを防ぐ, 一般利用者の負担が小さい / cons=一般利用者は無効のままになり得る / risks=管理者の MFA 喪失による締め出し / lock-in=低 / ops=中 / evidence=https://www.better-auth.com/docs/plugins/2fa, https://datatracker.ietf.org/doc/html/rfc6238<br>opt-totp-all-required:TOTP を全員必須 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '追加費用なし。全員の初回設定とサポートの手間が増える。'} / free=OSS の plugin。 / fit=安全側だが、利用者の初回の手間が増える。 / pros=一律に強い / cons=初回の手間が増える / risks=端末紛失時の復旧依頼が増える / lock-in=低 / ops=高 / evidence=https://www.better-auth.com/docs/plugins/2fa<br>opt-no-mfa:MFA は作らず文言を変える / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '費用なし。画像の文言を改める。'} / free=外部サービスを使わない。 / fit=画像との差異が残り G1/G5 を満たさない。 / pros=実装が不要 / cons=画像と一致しない / risks=パスワード漏えいで即乗っ取り / lock-in=なし / ops=低 / evidence=https://pages.nist.gov/800-63-4/sp800-63b.html | opt-totp-admin-required — 権限の大きい管理者だけを必須にし、画像の説明を事実にしつつ一般利用者の負担を抑えられる。 (注意: 管理者の MFA 喪失は復旧コードと seed スクリプトで戻せるようにする (C8); confidence=high; checked=2026-09-21T13:21:10Z) | opt-totp-admin-required @ 2026-09-21T13:14:00Z | G5 |
| dec-login-v2-onboarding | 管理者が一時パスワードを発行する現行方式を、画像の『管理者が仮パスワードを設定することはありません』とどう整合させるか。 | confirmed | opt-invite-link:招待リンク方式へ置換し一時パスワードを撤去 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': '招待表と送信 (Resend 無料枠内) の実装費。一時パスワードの API と画面の撤去費。'} / free=D1 Free: rows written 100,000 / day。メール送信は Resend Free の 3,000 通/月の枠内。 / fit=画像の文言と一致し、本人が自分で認証手段を選んで登録する。 / pros=画像と一致する, 管理者が秘密を扱わない / cons=メールが届かないと登録できない / risks=招待トークンの漏えい / lock-in=なし / ops=低 / evidence=https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html, https://developers.cloudflare.com/d1/platform/pricing/<br>opt-coexist:当面は一時パスワードと併存 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': '両方の経路を保守し続ける費用。'} / free=D1 Free: rows written 100,000 / day。 / fit=メール不達の予備になるが、画像の文言と矛盾が残る。 / pros=メール不達時の予備がある / cons=画像と矛盾する, 経路が 2 本になる / risks=一時パスワードの受け渡しでの漏えい / lock-in=なし / ops=中 / evidence=https://developers.cloudflare.com/d1/platform/pricing/ | opt-invite-link — 画像の文言を事実にし、管理者が他人の秘密を扱う経路を無くせる。 (注意: 既存の一時パスワード状態の利用者には招待を出し直す, メール不達時は管理者が招待を再送する; confidence=high; checked=2026-09-21T13:21:10Z) | opt-invite-link @ 2026-09-21T13:14:00Z | G3 |
