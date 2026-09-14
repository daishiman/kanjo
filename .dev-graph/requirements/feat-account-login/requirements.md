# アカウントログイン (メールアドレス + パスワード) — 実装要件

- Feature: `feat-account-login`
- Package: `feature-package/feat-account-login`
- Handoff target: `task-graph`
- Snapshot: `sha256:98d05e3c0c15ea60d3543e3ff7877c19b44a4119e98e38fc4121a1281c4ea6b9`
- System plan: `sha256:407646ac620bfedde6dd5de03b3d9aa5816c761d2cb2da85d9bc3c59743fcd52`
- Readiness: **PASS**（missing sections 0）

## 目的

金融明細を扱う権限を共有された1つの秘密から個人に帰属するアカウントへ移し、失効・追跡・権限限定を利用者単位で効かせられるようにする。

## 到達状態

利用者がメールアドレスとパスワードで本人として認証でき、管理者が設定画面から招待・停止・パスワード再発行を完結でき、既存20画面と /api/* 認証ガードの契約が壊れていない状態。

## 実装要件

### REQ-AUTH-001 個人アカウントによる認証の成立

未認証で保護画面へアクセスするとログイン画面へ遷移し、メールアドレスとパスワードで本人として認証が成功する。共有 secret ではなく利用者行が認証主体になる。

- 担当 task: `SYS-ACCTLOGIN-P01`、`SYS-ACCTLOGIN-P02`、`SYS-ACCTLOGIN-P05`、`SYS-ACCTLOGIN-P06`、`SYS-ACCTLOGIN-P07`
- 受入対応: feature acceptance #1
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-SEC-002 復元不能なパスワード保存

パスワードは PBKDF2-HMAC-SHA256 / 210,000 回以上で保存し、平文・可逆暗号・ログ出力のいずれにも残さない。

- 担当 task: `SYS-ACCTLOGIN-P02`、`SYS-ACCTLOGIN-P03`、`SYS-ACCTLOGIN-P05`、`SYS-ACCTLOGIN-P09`
- 受入対応: feature acceptance #2
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-ADMIN-003 管理者による利用者ライフサイクル管理

管理者は設定画面から利用者の追加・停止・一時パスワード再発行を完結でき、一時パスワードは発行直後の1度だけ表示される。自己サインアップは持たない。

- 担当 task: `SYS-ACCTLOGIN-P02`、`SYS-ACCTLOGIN-P05`、`SYS-ACCTLOGIN-P07`、`SYS-ACCTLOGIN-P12`
- 受入対応: feature acceptance #3
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-SESSION-004 ログイン状態保持の明示的な帰結

保持 ON で30日・OFF で12時間のセッション期限とし、既定 (ON) の帰結をチェックボックス脇に明示する。セッションは利用者単位で失効できる。

- 担当 task: `SYS-ACCTLOGIN-P02`、`SYS-ACCTLOGIN-P05`、`SYS-ACCTLOGIN-P07`
- 受入対応: feature acceptance #4
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-UI-005 参照画像を正とするログイン画面

ログイン画面の DOM に header/footer/サイドバーのナビゲーション要素を0件とし、アイコンは常にテキストラベルと併記する。構成は 01-login.png を正とする。

- 担当 task: `SYS-ACCTLOGIN-P03`、`SYS-ACCTLOGIN-P05`、`SYS-ACCTLOGIN-P07`
- 受入対応: feature acceptance #5
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-AUTHZ-006 role による管理面の遮断

role=member は /api/admin/* の全エンドポイントに対して 403 を受け取る。画面側の非表示だけに依存しない。

- 担当 task: `SYS-ACCTLOGIN-P02`、`SYS-ACCTLOGIN-P04`、`SYS-ACCTLOGIN-P05`、`SYS-ACCTLOGIN-P06`、`SYS-ACCTLOGIN-P09`
- 受入対応: feature acceptance #6
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-COMPAT-007 既存20画面の契約非破壊

既存20画面の呼出しが 401/503 の応答契約を変更せずに動作する。認証主体の変更を既存画面側の改修に波及させない。

- 担当 task: `SYS-ACCTLOGIN-P04`、`SYS-ACCTLOGIN-P06`、`SYS-ACCTLOGIN-P07`、`SYS-ACCTLOGIN-P10`
- 受入対応: feature acceptance #7
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

### REQ-MIGRATE-008 共有パスワードの廃止と切替

active runtimeと必須設定に共有パスワード認証分岐が0件であり、SESSION_SECRET ローテーションを含む切替手順が本番へ適用されている。

- 担当 task: `SYS-ACCTLOGIN-P08`、`SYS-ACCTLOGIN-P09`、`SYS-ACCTLOGIN-P13`
- 受入対応: feature acceptance #8
- Source: `features/feat-account-login.md`、`specs/spec-account-login.md`

## 非機能要件

- 認証操作 (成功・失敗・停止・再発行) を audit_log へ actor_user_id 付きで記録し、ログイン失敗率とロックアウトを監視対象にする。
- 資格情報 (パスワード・一時パスワード・セッション token) をアプリケーションログへ出力しない。
- 配信は Cloudflare Workers (packages/api) と React SPA (packages/web)、永続化は Cloudflare D1 `kanjo-db` を前提にする。
- 外部 IdP / SSO / MFA / メール送信基盤は本 feature のスコープ外とし、導入時も上記の受入契約を壊さない拡張点として扱う。

## スコープ外

- Cloudflare Access 経由のログイン導線
- 自己サインアップ (利用者自身による新規登録)
- メール送信基盤による自動パスワードリセット
- ログイン画面のヘッダー・フッター・サイドバーの描画
- 業務データへの所有者列の追加 (監査は audit_log.actor_user_id のみ)
- 外部 IdP / SSO / MFA

## 受入と証跡

- 受入8件の充足判定は `SYS-ACCTLOGIN-P07`、最終可否は `SYS-ACCTLOGIN-P10`、証跡の確定は `SYS-ACCTLOGIN-P11` が負う。
- 本 feature を done にできるのは exact 13 task が全て done で、P07/P10/P11 の evidence が上記 REQ-AUTH-001..REQ-MIGRATE-008 を満たす場合だけとする。

## Readiness

- C11 snapshot validation: PASS
- C02 saved state (feature/13 task): PASS (confirmed / pass / complete)
- validate-system-plan.py: PASS (P01..P13 exact 13、violations 0)
- C08 implementation readiness: complete (missing sections 0)
- 本 skill が生成した実装 code file: 0 件
