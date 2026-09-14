# アカウントログイン運用

メールアドレスとパスワードによるログインの運用手順です。
デプロイ順序・secret の登録方法・D1 migration の一般則は
[`CI/CD・本番運用ガイド`](../ci-cd-operations.md) が正本で、ここへ転記しません。
この文書は「アカウントという主体を扱うときだけ必要になる操作」に限ります。

設計の根拠は `architecture/account-login-auth.md`、`architecture/account-login-security.md`、
`architecture/account-login-maintenance-ops.md` にあります。

## 前提となる仕組み

- パスワードは PBKDF2-HMAC-SHA256 (210,000 回) のハッシュだけを保存します。平文はどこにも残りません。
- セッションは `users.session_generation` と紐づきます。この値が進むと、**発行済みの Cookie が一斉に無効**になります。
- 世代が進むのは次の3つです。(a) ログアウト (b) パスワード変更・一時パスワード再発行 (c) アカウント停止。
- `SESSION_SECRET` を入れ替えると、世代とは無関係に**全利用者**が再ログインになります。

## 1. 初期管理者を作る (アカウントが1件も無い状態から)

招待は管理者だけが行えるため、最初の1件だけは外から入れます。
migration には置けません。保存するのはハッシュであり、SQL では作れないためです。

**ローカル:**

```bash
pnpm run db:migrate:local
node scripts/seed-admin.mjs
```

引数を省くと `admin@kanjo.local` の検証用管理者1件を作ります。一般利用者はログイン後に
「設定 → 利用者管理」から追加し、初期投入経路を二重化しません。
`--force-change` を付けると初回ログイン時にパスワード変更を要求する状態で作れます。

**本番:** 同じ SQL を生成して、内容を目視してから流します。実行は手作業に限ります。

```bash
read -rs 'KANJO_SEED_PASSWORD?初期パスワード: '; print
print -r -- "$KANJO_SEED_PASSWORD" | \
  node scripts/seed-admin.mjs --print-sql --mode bootstrap --email owner@example.com --password-stdin > /tmp/seed-admin.sql
unset KANJO_SEED_PASSWORD
# 中身を確認する (平文パスワードは含まれず、ハッシュだけが入っていること)
pnpm --filter @kanjo/api exec wrangler d1 execute kanjo-db --remote --file /tmp/seed-admin.sql
rm /tmp/seed-admin.sql
```

このSQLは`users`が0件のときだけINSERTし、既存行をDELETE・上書きしません。identityと過去の監査actor参照を保ちます。
作成後、資格情報を運用者へ引き渡し、**引き渡しの完了を確認してから**次の作業へ進みます。
本番SQLは初期管理者1件だけを作り、初期パスワードは72時間後に失効します。引き渡す値は初回ログイン後に本人が変更します。

## 2. 日常運用

設定画面の「利用者管理」から行います。この節は admin にだけ表示されます。
サーバ側の制約は次のとおりです。

| 操作 | 画面の操作 | サーバ側の保証 |
|---|---|---|
| 招待 | 「利用者を追加」 | 一時パスワードを**発行直後の1度だけ**表示。再表示は不可。72時間で失効 |
| 停止 | 「停止する」 | 停止と同時に世代が進み、その人の全端末が即座に切れる |
| 再開 | 「再開する」 | 状態を戻すだけ。パスワードは停止前のまま |
| 一時パスワード再発行 | 「一時パスワード再発行」 | 旧パスワードは即座に無効。次回ログイン時に変更を強制 |
| 権限変更 | 権限のプルダウン | 最後の admin を member へ落とす操作は 409 で拒否 |

一時パスワードを再表示する手段はありません。控え損ねたら再発行します。
最初のログイン成功で一時パスワードは消費済みになり、変更前でも同じ値での再ログインはできません。初回セッションでそのまま変更し、閉じた場合はadminが再発行します。

## 3. 本番を共有パスワードから切り替える

旧`AUTH_PASSWORD`を先に消すと旧Workerのログイン経路まで失われるため、所有者が次の順序で実施します。このローカル改善ではsecret操作を行いません。

1. 0039適用前のD1 Time Travel復元点と互換アプリ世代を対で記録する。
2. pendingが`0039_account_login.sql`だけで、`0040_drop_tax_and_receipt_tables.sql`を含まないことを確認し、0039を適用する。
3. `--mode bootstrap`で初期adminを1件作成し、一時パスワードを引き渡す。
4. `SESSION_SECRET`を入れ替え、新Workerを反映する。全旧セッションの失効は意図した結果とする。
5. 新adminのログイン、強制パスワード変更、利用者一覧を確認する。
6. 新Workerが旧secretを参照しないことを確認した後にだけ、`wrangler secret delete AUTH_PASSWORD`で削除する。
7. 旧共有パスワードでログインできないことと、主要画面の401/503契約を確認する。

コードrollbackで`AUTH_PASSWORD`を復活させません。障害時は復元点+互換アプリ、またはforward-fixを使います。

## 4. SESSION_SECRET を入れ替える

鍵の漏洩が疑われるとき、または定期ローテーション時に行います。
**入れ替えた瞬間に全利用者がログアウトされます**。業務時間外に行ってください。

```bash
# 1. 新しい値を生成する (画面に出さず、そのまま貼り付ける)
openssl rand -hex 32

# 2. 登録する。プロンプトへ 1. の値を貼る
pnpm --filter @kanjo/api exec wrangler secret put SESSION_SECRET

# 3. 反映を待ち、自分のブラウザで再ログインできることを確認する
```

確認すること: 入れ替え前に開いていたタブを再読み込みすると、ログイン画面へ戻ること。
戻らない場合は反映が済んでいません。数十秒おいて再確認します。

## 5. 全 admin がログイン不能になったとき (最終手段)

最後の admin を失う操作はサーバ側が拒否しますが、パスワード紛失など画面外の原因では起こり得ます。
このときだけ、D1 を直接書き換えます。

```bash
# 1. 復旧させたい利用者の id を確認する
pnpm --filter @kanjo/api exec wrangler d1 execute kanjo-db --remote \
  --command "SELECT id, email, role, status FROM users ORDER BY created_at"

# 2. 新しいハッシュと、世代を1つ進める UPDATE 文を作る
read -rs 'KANJO_SEED_PASSWORD?復旧用パスワード: '; print
print -r -- "$KANJO_SEED_PASSWORD" | \
  node scripts/seed-admin.mjs --print-sql --mode reset-admin --user-id <復旧対象のid> --password-stdin > /tmp/recover.sql
unset KANJO_SEED_PASSWORD

# 3. 指定adminへのUPDATEだけで、DELETE/INSERTを含まないことを確認してから流す
pnpm --filter @kanjo/api exec wrangler d1 execute kanjo-db --remote --file /tmp/recover.sql
rm /tmp/recover.sql
```

`reset-admin`はemail/role/id/created_atを変えず、指定idが既存adminに一致するときだけハッシュ・停止状態・一時期限・セッション世代を更新します。

作業後は `audit_log` に記録が残らない経路であるため、実施日時と対象を運用記録へ手で残します。

## 6. 監査と監視

`audit_log` に次の action が積まれます。`actor_user_id` が「誰が」にあたります。

- `auth_login` / `auth_login_failed` / `auth_logout` / `auth_password_change`
- `admin_user_invite` / `admin_user_update` / `admin_user_suspend` / `admin_user_password_reset`

```bash
# 直近のログイン失敗を数える
pnpm --filter @kanjo/api exec wrangler d1 execute kanjo-db --remote \
  --command "SELECT occurred_at, actor_user_id, result FROM audit_log
             WHERE action='auth_login_failed' ORDER BY occurred_at DESC LIMIT 50"
```

`counts_json.lockStarted` は新しく成立したロック、`lockRejected` はロック中に拒否した試行の件数です。

認証成功前のログイン失敗は操作者を確定できないため`actor_user_id=NULL`とします。登録済みaccountが対象なら`scope=account:<id>`で分離し、targetをactorとして記録しません。旧共有パスワード時代のNULLも遡って埋めません。

ログイン失敗は同一メールアドレスに対して 15 分間で 5 回までで、超えると 15 分ロックされます。
特定の1アカウントだけロックが続く場合は、そのメールアドレスが狙われている可能性を疑います。
