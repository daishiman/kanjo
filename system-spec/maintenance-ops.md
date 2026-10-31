---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G2, G3, G5, G7]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-login-v2-maintenance-ops-web-001。裏付け質疑 (`qa_refs`): `qa-login-v2-maintenance-ops-web-evidence-001`, `qa-login-v2-maintenance-ops-web-002`, `qa-login-v2-decision-001`, `qa-login-v2-decision-003`, `qa-login-v2-decision-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G5, G7 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、保守運用ではOS の版ごとに Google 認可の戻り先が壊れていないかを確かめる端末検証の手順を持つ必要があった。本サイクルは web のみを対象とするため該当しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、保守運用ではタブレットの画面幅でログイン画面を確かめる実機の検証手順を持つ必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、保守運用ではWindows 版の配布後にログイン不具合を回収するクラッシュ報告の運用を持つ必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、保守運用ではディストリビューションごとのログイン不具合の切り分け手順を持つ必要があった。本サイクルは web のみを対象とするため該当しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、保守運用ではmacOS の版上げでキーチェーンの扱いが変わったときの回帰確認の手順を持つ必要があった。本サイクルは web のみを対象とするため該当しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | ログイン v2 の保守運用では、runbook の一時パスワードの章を招待の再送・取消と MFA 喪失の復旧の章へ置き換える形へ反映した。移行の release-record には既存契約テストの結果と戻しの確認を残す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G5, G7

#### 主たる接地根拠: `qa-login-v2-maintenance-ops-web-001`

**問**

ログイン v2 の 保守運用 に何を求めるか。

**答**

docs に、Better Auth への移行と戻しの手順、secret の設定手順、Google Cloud Console と Resend の設定手順、管理者が締め出されたとき (最後の管理者の停止・MFA 喪失) の復旧手順を置く。runbook の一時パスワードの手順は招待の再送と取消の手順に置き換える。既存の account-login の契約テストを Better Auth 版で緑にし、招待・再設定・連携・MFA・稼働状態の統合テストを加える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/01-login-v2.png と、利用者承認 (appr-foundation-login-v2-001) の U1-U9、決定 qa-login-v2-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-maintenance-ops-web-evidence-001`

**問**

保守運用 章の裏付けとして、01-login-v2.png と現行実装の差分として何を観測したか。

**答**

docs/runbooks/account-login-operations.md が現行の一時パスワードの発行と管理者の復旧の手順を持ち、docs/account-login/ に release-record.md がある。テストは packages/api/src/account-login.test.ts と packages/web/src/account-login.dom.test.tsx が認証の契約を固定している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 8f72ff0) の読取りによる観測。 / 回答時刻: 2026-09-21T13:27:06Z)

#### 裏付け質疑: `qa-login-v2-maintenance-ops-web-002`

**問**

web のログイン v2 で、保守運用 について利用者が決めていない具体値を何にするか。

**答**

戻し手順は『Better Auth の route を外し旧 authRoute と authGuard を戻す commit を revert で作る』形とし、新表は残したまま旧 users で動かす。管理者の MFA 喪失は scripts の seed で twoFactor の行を消して次回ログインで再設定させる。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-21T13:27:06Z)

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

Clean Code の Executable examples と Explicit effects をログイン v2 の運用に適用した。移行の合否は既存の account-login の契約テストを Better Auth 版で緑にすることで判定し、招待・再設定・連携・MFA・稼働状態の振る舞いは観測できる結果 (応答・Cookie・D1 の行) で固定する。メール送信と時刻は境界の 1 か所に寄せてテストで差し替え、締め出しからの復旧は seed スクリプト 1 本で行う手順として runbook に書く。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:42:56Z)

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-rollbacks | 2026-07-15 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/ | 2026-09-21T13:28:04Z | 2026-09-21T13:28:04Z |
