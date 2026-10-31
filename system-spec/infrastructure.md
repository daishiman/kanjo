---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G2, G3, G6, G7]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-login-v2-infrastructure-web-003。裏付け質疑 (`qa_refs`): `qa-login-v2-infrastructure-web-evidence-001`, `qa-login-v2-infrastructure-web-002`, `qa-login-v2-decision-001`, `qa-login-v2-decision-002`, `qa-login-v2-infrastructure-web-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G6, G7 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、インフラではアプリストア配布と、招待メールのリンクをアプリで開くユニバーサルリンクの設定を持つ必要があった。本サイクルは web のみを対象とするため該当しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、インフラではタブレット版のストア審査でログイン必須アプリのデモアカウントをどう用意するかを決める必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、インフラではWindows 版のインストーラと更新配信の置き場を用意する必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、インフラではLinux 版のパッケージリポジトリの運用を用意する必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、インフラではmacOS 版の公証と更新配信の基盤を用意する必要があった。本サイクルは web のみを対象とするため該当しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | ログイン v2 のインフラでは、Resend が落ちても既存利用者のログインは止まらないよう、メール送信をログインの経路から外す形へ反映した。送信の失敗は招待の状態に残し、管理者が再送で回復できる。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | ログイン v2 のインフラでは、新しい 4 つの secret を secrets.required に載せ、欠けたまま deploy できないようにする形へ反映した。Google と Resend の設定は利用者の作業として手順書に分け、コードの deploy と切り離した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G6, G7

#### 主たる接地根拠: `qa-login-v2-infrastructure-web-003`

**問**

ログイン v2 の インフラ に何を求めるか。

**答**

Better Auth は Worker の中に置き、追加の外部サービスは Google (OIDC) と Resend だけにする。認証に要る秘密は Workers の secret として必須にし、Better Auth の配信元の設定を本番の配信元に合わせる。Google Cloud Console の OAuth 設定、Resend の送信ドメイン認証 (SPF / DKIM)、独自ドメインの用意は利用者の作業として手順を docs に切り出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めた到達点だけを書き起こした要件。同じ章の -001 はライブラリ API 名・secret 名・経路名など利用者が決めていない実装手段をuser-decision の中に含めていたため (完成度評価 medium 5)、それらを除いて本 qa に置き直し、実装手段は -004 (agent-inference) へ移した。 / 回答時刻: 2026-09-21T13:42:56Z)

#### 裏付け質疑: `qa-login-v2-infrastructure-web-evidence-001`

**問**

インフラ 章の裏付けとして、01-login-v2.png と現行実装の差分として何を観測したか。

**答**

packages/api/wrangler.jsonc は Worker 名 kanjo-console、compatibility_flags に nodejs_compat を持ち、D1 (kanjo-db) と R2 (kanjo-files) を束ねる。配信は workers.dev で独自ドメインは無い。認証切替後の必須secretは `BETTER_AUTH_SECRET`・Google Client ID/Secret・`RESEND_API_KEY`で、公開固定値は`BETTER_AUTH_URL`・検証済み`MAIL_FROM`である。旧`SESSION_SECRET`はruntimeから撤去する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 8f72ff0) の読取りによる観測。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-infrastructure-web-002`

**問**

web のログイン v2 で、インフラ について利用者が決めていない具体値を何にするか。

**答**

Resend の送信元は利用者が用意する独自ドメインのサブドメイン (例: mail.<domain>) とし、ドメインが用意できるまではステージングだけ Resend の検証用アドレスで送る。Google の承認済みリダイレクト URI は本番とステージングの 2 つを登録する。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

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

#### 裏付け質疑: `qa-login-v2-infrastructure-web-004`

**問**

ログイン v2 の infrastructure を実装するときの具体的な手段と設定値は何か。

**答**

nodejs_compat は Better Auth の AsyncLocalStorage に要り、wrangler.jsonc で既に有効。wrangler.jsonc の secrets.required に BETTER_AUTH_SECRET・GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET・RESEND_API_KEY を加え、Better Auth の baseURL と trustedOrigins を配信元に合わせる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定。-001 から外した実装手段と、完成度評価 (medium 1-3・low 2) が指摘した Better Auth の既定の動きと承認済みゴールの食い違いを埋める設定値。公式 docs で確かめた事実は qa-login-v2-auth-web-evidence-002 に分けた。docs に記述の無い組み合わせを含むため、本文末尾のテストで実装時に確かめる。 / 回答時刻: 2026-09-21T13:42:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 認証基盤を Better Auth (Hono の Cloudflare Worker + D1) へ全面移行する。メールアドレスとパスワード、Google (OIDC) の 2 つの認証手段と、D1 のセッション表によるセッション管理を Better Auth で行い、ログイン状態の保持 (保持は 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間)・停止した利用者の発行済みセッションの即時失効・/api/* の認証ガードと admin 判定・audit_log の actor_user_id を移行後も同じ契約で満たす。既存利用者は PBKDF2 のハッシュを保ったまま移し、パスワードの再設定を強いない。旧 Cookie kanjo_session と自前の署名・世代照合は撤去する。
- **G3**: 利用者の追加を招待メール方式にする。テナント管理者が設定画面でメールアドレスと役割を入力すると、期限付き・1 回限りの招待トークンのリンクがメールで届き、本人がリンク先で Google アカウント (招待先と同じ確認済みメールアドレスのもの) か メールアドレスとパスワードかを選んで登録を完了する。管理者は招待の再送・取消と状態 (未承諾・承諾済み・期限切れ) を確認でき、ログイン画面の『招待メールを再送』は本人がメールアドレスを入れて再送を依頼でき、応答からは招待の有無が分からない。一時パスワードの発行 API・画面・初回変更の強制は撤去し、管理者は他人のパスワードを設定しない。自己登録 (サインアップ) は塞いだままにする。
- **G6**: ログイン前に確かめられる公開情報を用意する。フッターの『サービス状況』は認証不要の稼働状態 API から『正常』などを表示し、内部の詳細 (エラー文・構成) は返さない。『ヘルプ』と『プライバシー』は認証不要の静的ページとして、ログインの手順・招待・再設定・連携・MFA の説明と、ログイン情報の利用目的・保存期間・外部送信先 (Google・メール送信事業者) を示す。
- **G7**: 既存画面と API の契約を壊さずに移行する。/api/* の認証ガードの mount 順序、admin の判定、有効な管理者が 0 人になる変更の拒否、監査ログの actor 記録、Cloudflare Access のサーバ側検証経路の扱いを移行前と同じ契約テストで確かめ、移行用の migration は追加のみとして、移行の失敗時に旧経路へ戻せる手順を残す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | Better Auth へ移行しても既存の認証契約が保たれる。 | 既存の account-login の契約テスト (未認証の /api/* が 401、停止利用者の既存セッションが 401、非管理者の /api/admin/* が 403、最後の管理者の停止が 409、監査の actor_user_id) を Better Auth 版で緑にし、保持ありでは Set-Cookie の Max-Age が 30 日になり、保持なしでは Max-Age も Expires も持たないセッション Cookie になって、サーバ側のセッションが発行から 12 時間で失効し、途中のアクセスでも延長されない。既存の PBKDF2 ハッシュの利用者が再設定なしでログインできる移行テストが緑。 |
| O3 | Google でのログインが招待済みの確認済みメールアドレスだけを通す。 | ID トークンの email_verified=false、招待・登録の無いメールアドレス、停止中の利用者で Google ログインが拒否され、state / PKCE / nonce の不一致が拒否される統合テストが緑。自己登録の経路が 0 件。 |
| O4 | 招待が一時パスワード無しで完結する。 | 招待作成→メール送信 (送信 API はテストで差し替え)→リンクで Google またはパスワードを選んで登録、の 2 経路の統合テストが緑。トークンは期限切れ・使用済み・取消で拒否され、D1 にはトークンのハッシュだけが残る。一時パスワードの API・列・画面が 0 件。ログイン画面からの再送依頼は、招待の有無にかかわらず同じ応答になる。 |
| O7 | 公開の稼働状態・ヘルプ・プライバシーが認証なしで見られ、内部情報を出さない。 | 未認証で稼働状態 API が 200 と状態値 (normal / degraded など) だけを返し、エラー文や構成を含まないテストが緑。ヘルプとプライバシーの画面が未認証で描画され、プライバシーに外部送信先 (Google・メール送信事業者) と利用目的・保存期間が載る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: packages/api に Better Auth のインスタンスを置き、/api/auth/* を Better Auth のハンドラへ向け、authGuard・adminGuard を Better Auth のセッション取得に差し替える。
- **I3**: Better Auth の表 (user・session・account・verification・twoFactor) と招待表を追加のみの migration で作り、既存 users を複写する移行を用意する。PBKDF2 のハッシュは account.password に形式ごと移し、検証関数で読む。
- **I4**: 招待の作成・再送・取消・承諾の API と、設定画面の利用者管理を招待方式に作り直し、一時パスワードの API と画面と初回変更の強制を撤去する。
- **I5**: Resend の送信を 1 か所の関数に閉じ、招待・再設定・連携確認のメール本文を定義し、テストでは送信を差し替える。
- **I7**: 認証不要の GET /api/status と、/help・/privacy の公開ページを加え、ログイン画面のフッターから辿れるようにする。
- **I8**: docs に移行・戻し・secret・Google Cloud Console・Resend の手順とプライバシーの記載を置く。

### 本章に効く確定意思決定

- **dec-login-v2-auth-foundation**: Google ログイン・連携・MFA をどの認証基盤で実装するか。
  - 採択: Better Auth へ全面移行 (`opt-better-auth`)
  - 目的適合: Google・パスワード・アカウント連携・TOTP 二要素と復旧コードを 1 つの基盤で賄え、G2/G4/G5 の機能を部品として得られる。
- **dec-login-v2-mail-delivery**: 招待・パスワード再設定・連携確認のメールをどの基盤で送るか。
  - 採択: Resend など外部 API (`opt-resend`)
  - 目的適合: HTTP の fetch だけで Workers から送れ、招待・再設定・連携確認の量は無料枠に収まる。
- **dec-login-v2-onboarding**: 管理者が一時パスワードを発行する現行方式を、画像の『管理者が仮パスワードを設定することはありません』とどう整合させるか。
  - 採択: 招待リンク方式へ置換し一時パスワードを撤去 (`opt-invite-link`)
  - 目的適合: 画像の文言と一致し、本人が自分で認証手段を選んで登録する。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

この章に割り当てられる設計知識 card は 0 件 (curated catalog に実行基盤の構成を扱う card が無い)。そのため card ではなく、公式出典 (Workers の secret と rollback) に直接よって判断した。認証の状態は D1 に、秘密は Workers の secret に置き、Worker の外に新しい実行基盤を足さない。外部依存は Google と Resend の 2 つに限り、どちらも fetch 1 本の境界で差し替えられるようにした。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:42:56Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-secrets | 2026-07-03 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/configuration/secrets/ | 2026-09-21T13:28:33Z | 2026-09-21T13:28:33Z |
