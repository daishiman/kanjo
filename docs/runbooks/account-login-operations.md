# アカウント認証運用（Better Auth）

認証の正本は Better Auth v1.7.5 と D1 の `user` / `session` / `account` / `verification` / `twoFactor` です。
旧 `users`・`kanjo_session`・一時パスワードは新しい要求では使いません。一般のデプロイと D1 migration の手順は
[`CI/CD・本番運用ガイド`](../ci-cd-operations.md) を正本とします。

## 初回切替

1. D1 の復元点を記録し、`0050_login_v2_better_auth.sql` を適用する。
2. 次の secret を Workers の secret store に登録する。値を文書・シェル履歴・ログへ残さない。
   - `BETTER_AUTH_SECRET`（`openssl rand -hex 32` 以上）
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `RESEND_API_KEY`
3. `BETTER_AUTH_URL` と `MAIL_FROM` を配信元・検証済み送信元に設定する。
4. Google Cloud Console の許可済みリダイレクト URI を `https://<配信元>/api/auth/callback/google` に限定する（手順は [`Google ログインの設定`](google-oauth-setup.md)）。
5. migrationで複写された既存利用者が同じパスワードで入れること、旧 `/api/auth/login` が404であることを確認する。

`must_change_password=1` だった旧利用者は、新しい `user` と `account` のどちらにも複写しません。メールを予約した
資格情報なしの行を作らないため、管理者は同じメールへ通常の招待を発行できます。適用前に、`must_change_password=0`
かつ `role='admin'`、`status='active'` の利用者が1人以上いることを確認します。0人ならmigrationを適用せず、本人確認を
完了した管理者の資格情報を先に通常手順で確定します。

Cloudflare Accessを使う場合はRepository Variablesの`ACCESS_AUD`と`ACCESS_TEAM_DOMAIN`を両方設定します。両方空なら
Better Auth、両方ありならAccessで、片方だけの設定はdeployとruntimeの両方が503で閉じます。Access時は
`/api/auth/me`だけが検証済みAccess assertionから本人DTOを返し、それ以外の`/api/auth/*`（password sign-inを含む）は
400 `access_mode`で閉じます。Better Auth sessionは作らず、二重ログインにしません。

## 日常運用

- 利用者追加: 「設定 → 利用者管理」でメールアドレスと役割を指定して招待する。平文パスワードは扱わない。
- 再送: 未承諾または期限切れの招待を再送する。配送成功後は旧リンクが無効になる。配送失敗時は旧tokenへ条件付きで
  戻すため、直前のリンクを失効させない。
- 取消: 未承諾の招待を取消す。承諾済みは取消できない。
- 停止: 利用者を停止すると、その利用者の `session` 行を同時に削除する。
- 最後の有効な管理者の停止・降格は409で拒否される。

本人からの招待再送・パスワード再設定依頼は、アカウントの有無にかかわらず同じ202を返します。メール送信失敗の
調査ではテンプレート名とHTTP状態だけを使い、宛先・URL・tokenをログへ出しません。

## MFA喪失時

管理者のパスワード認証ではTOTPが必須です。復旧コードをまず使います。復旧コードも無い場合だけ、次を保守時間帯に
実行します。

1. 別の責任者が本人確認と対象`user.id`を確定し、変更記録へ承認者・理由・時刻を残す。メール、復旧コード、TOTP
   secretは記録しない。
2. D1 Time Travelの復元地点を記録する。対象IDだけを条件に`role='admin' AND status='active'`、
   `twoFactorEnabled=1`、`twoFactor`が1行であることを確認する。0件・複数件なら中止する。
3. 対象IDの全`session`を削除し、対象の`twoFactor`を削除して、同じ対象の`user.twoFactorEnabled=0`へ更新する。
   各文は対象IDとactive admin条件を持たせ、変更件数が想定と違えば中止して復元地点から戻す。
4. `auth_mfa_disable`として対象ID・操作ID・`operator_recovery: 1`だけを`auth_audit_log`へ記録する。
5. 本人にパスワードで再ログインしてもらい、MFA初回設定・新しい復旧コードの保存・旧sessionが401であることを確認する。

対象IDを確定しない一括UPDATE、TOTP secretや復旧コードの抽出、最後の管理者を新規作成する回避策は禁止です。

## Secretローテーション

`BETTER_AUTH_SECRET` の変更は全session、署名Cookie、暗号化済みTOTP secretに影響します。単独で即時変更せず、
MFA再登録計画と全利用者の再ログイン告知を含む保守作業として扱います。Google/Resend secretは各事業者側で新旧を
重ねられる期間を設け、疎通確認後に旧値を失効させます。

## 定期保守と監査

夜間scheduled処理は次を行います。

- `auth_rate_limits` の期限切れ行を削除する。
- `auth_audit_log` を400日で削除する。
- 既存の業務監査・バックアップ・retentionを継続する。

監査には操作種別・actor/target・結果・件数だけを残します。メールアドレス、Cookie、token、TOTP、復旧コード、
Googleのcode/state、secret値を残しません。

## ローカルで確認してから本番で行うこと

この変更作業ではremote migration・secret登録・deployを行いません。本番作業では、local migration、API統合テスト、
型検査、依存監査を通した同じrevisionを使い、Google実アカウントと検証済みメールドメインで最終確認します。

## rollback境界

0050適用後でも、Login v2の招待承諾・パスワード変更・MFA設定・アカウント連携など、新しい認証状態への書込みがまだ
1件も無いことを監査と表の件数で確認できる場合に限り、Time Travel復元点と旧Workerを組にして戻せます。1件でも
新しい認証状態が作られた後は、旧Workerだけを戻すと新パスワード・session・MFAを読めず利用者を締め出します。この
境界以後は旧版deployをrollbackに使わず、現行schemaのままforward-fixします。例外的な復元は、停止時間・失われる
認証更新・復元点を明示して承認を得た災害復旧としてだけ実行します。
