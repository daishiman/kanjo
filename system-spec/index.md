---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 現行Login v2の実装・配信情報

実行時の移行は `migrations/0059_login_v2_better_auth.sql`。以下の章は着手時の確定仕様の履歴を含む。
現行の認証方式・安全な戻し・検証結果は [`設計・実行記録`](../docs/login-v2/design-decisions.md) と
[`認証運用`](../docs/runbooks/account-login-operations.md) を参照する。最新mainの統合前仕様は
`archive/2026-10-31-pre-login-v2-main/` にそのまま保存した。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 金融明細を預かる入口を、テナント管理者に招待された本人だけが、自分で選んだ認証手段 (Google アカウント または メールアドレスとパスワード) で入れる場にする。管理者は他人の秘密 (仮パスワード) を一切持たず、招待はメールのリンクで本人に届き、本人がその場で認証手段を選んで登録を完了する。パスワードを忘れた本人は自分で再設定でき、同じメールアドレスで Google とパスワードの両方を使う本人は、再認証とメール確認を経て 1 つのアカウントに安全に連携できる。パスワードでのログインには TOTP の多要素認証を重ね (管理者は必須)、ログイン画面は『何が守られるか』(暗号化・MFA・不正ログイン対策、認証用途に限った情報利用、認証情報とテナント内データの分離) と、サービスの稼働状況・ヘルプ・プライバシーをログイン前に示す。5 Whys の帰結: (1) なぜログイン画面を変えるか→現行は管理者が一時パスワードを発行して別経路で伝える方式で、管理者が他人の秘密を一度は知ってしまい、伝達経路で漏れうる (2) なぜ問題か→金融データの入口で『本人しか知らない秘密』が成り立っていない (3) なぜ今か→共同利用者 (家族・委託先) に任せる運用が現実になり、招待・再設定・退出が管理者の手作業に集中している (4) なぜ Google か→共同利用者の多くは既に Google アカウントの 2 段階認証を持っており、新しいパスワードを増やすより安全で迷わない (5) 本質→入口の秘密を本人だけが持つ形にし、本人が自力で登録・復旧・連携でき、その保護の中身をログイン前に確かめられる状態にする。
- **ゴール (U3)**: G1=/login を 01-login-v2.png どおりの画面にする。カード上のロゴ (棒グラフのマークと Focus Ledger)、見出し『ログイン』と『登録済みの認証方法でログインしてください。』、『Google でログイン』ボタンと『招待先と同じメールアドレスの Google アカウントを使用してください。』、『または』の区切り、『メールアドレスとパスワードでログイン』のメールアドレス・パスワード (表示切替)・『次回からもログイン状態を保持する』(保持 30 日 / 非保持 12 時間の説明)・『ログイン』ボタン・『パスワードをお忘れの方』、『招待を受けた方』の案内と『招待メールを再送』ボタンと『アカウントはテナント管理者からの招待で作成されます。』、アカウント連携の案内 (連携時は再認証とメール確認が必要)、『安心してご利用いただくために』のセキュリティ・プライバシー・お客様のデータの 3 項目、フッターの『サービス状況』(稼働状態の表示)・『ヘルプ』・『プライバシー』を、既存のデザイントークンと共通部品の上に単一カラムで組む。送信中・認証失敗・ロック中・MFA コード入力・招待再送の受付・パスワード再設定の受付の各状態を持つ。, G2=認証基盤を Better Auth (Hono の Cloudflare Worker + D1) へ全面移行する。メールアドレスとパスワード、Google (OIDC) の 2 つの認証手段と、D1 のセッション表によるセッション管理を Better Auth で行い、ログイン状態の保持 (保持は 30 日、保持しないときはブラウザを閉じるまでで最長 12 時間)・停止した利用者の発行済みセッションの即時失効・/api/* の認証ガードと admin 判定・audit_log の actor_user_id を移行後も同じ契約で満たす。既存利用者は PBKDF2 のハッシュを保ったまま移し、パスワードの再設定を強いない。旧 Cookie kanjo_session と自前の署名・世代照合は撤去する。, G3=利用者の追加を招待メール方式にする。テナント管理者が設定画面でメールアドレスと役割を入力すると、期限付き・1 回限りの招待トークンのリンクがメールで届き、本人がリンク先で Google アカウント (招待先と同じ確認済みメールアドレスのもの) か メールアドレスとパスワードかを選んで登録を完了する。管理者は招待の再送・取消と状態 (未承諾・承諾済み・期限切れ) を確認でき、ログイン画面の『招待メールを再送』は本人がメールアドレスを入れて再送を依頼でき、応答からは招待の有無が分からない。一時パスワードの発行 API・画面・初回変更の強制は撤去し、管理者は他人のパスワードを設定しない。自己登録 (サインアップ) は塞いだままにする。, G4=本人が自力で復旧・連携できるようにする。『パスワードをお忘れの方』からメールアドレスを入れると、期限付き・1 回限りの再設定リンクがメールで届き、新しいパスワードを設定すると、その利用者の既存セッションを全て失効させる。応答からは登録の有無が分からない。同じメールアドレスで Google とパスワードの両方を使う本人は、ログイン済みの状態で既存の認証手段による再認証と、確認メールのリンクによるメール確認を経て、1 つのアカウントに連携できる。確認済みでない Google メールアドレスや、別のメールアドレスの Google アカウントは連携しない。連携の追加・解除は監査に残す。, G5=不正ログイン対策を画面の説明どおりにする。パスワードでのログインに TOTP の多要素認証を重ね、管理者は必須 (未設定の管理者は次回ログインで設定を求める)、一般利用者は設定画面で任意に有効化できる。復旧コードを発行し、TOTP を失った本人が復旧できる。Google でのログインは Google 側の 2 段階認証に委ねる。既存の IP・アカウント単位のレート制限と列挙防止を、ログイン・MFA コード・招待再送・パスワード再設定の各入口に広げる。認証情報 (利用者・セッション・認証手段・招待・MFA) は業務データの表と分けて保持し、ログイン情報は認証と保護の用途に限って使う。, G6=ログイン前に確かめられる公開情報を用意する。フッターの『サービス状況』は認証不要の稼働状態 API から『正常』などを表示し、内部の詳細 (エラー文・構成) は返さない。『ヘルプ』と『プライバシー』は認証不要の静的ページとして、ログインの手順・招待・再設定・連携・MFA の説明と、ログイン情報の利用目的・保存期間・外部送信先 (Google・メール送信事業者) を示す。, G7=既存画面と API の契約を壊さずに移行する。/api/* の認証ガードの mount 順序、admin の判定、有効な管理者が 0 人になる変更の拒否、監査ログの actor 記録、Cloudflare Access のサーバ側検証経路の扱いを移行前と同じ契約テストで確かめ、移行用の migration は追加のみとして、移行の失敗時に旧経路へ戻せる手順を残す。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G3 G5 G7 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G2 G3 G4 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 G5 G6 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G5 G6 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 G3 G6 G7 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 G5 G6 G7 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G4 G6 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G2 G3 G5 G7 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
