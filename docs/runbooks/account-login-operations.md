# アカウントログイン運用

メールアドレスとパスワードによるログインの運用手順です。
デプロイ順序・secret の登録方法・D1 migration の一般則は
[`CI/CD・本番運用ガイド`](../ci-cd-operations.md) が正本で、ここへ転記しません。
この文書は「アカウントという主体を扱うときだけ必要になる操作」に限ります。

設計の根拠は `architecture/account-login-auth.md`、`architecture/account-login-security.md`、
`architecture/account-login-maintenance-ops.md` にあります。

## 前提となる仕組み

- パスワードは PBKDF2-HMAC-SHA256 (100,000 回。本番 Workers の上限) のハッシュだけを保存します。平文はどこにも残りません。
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

**本番:** 専用スクリプトで流します。実行は運用者の端末での手作業に限ります。

```bash
bash docs/runbooks/scripts/admin-credential-remote.sh bootstrap --email owner@example.com
```

スクリプトは次の順で進み、途中で失敗すれば書き込まずに止まります。

1. パスワードを聞く前に、本番 D1 へ読み取り (`SELECT 1`) で届くかを確かめる。
2. パスワードを2回、画面に出さずに受け取り、stdin だけで `seed-admin.mjs --print-sql` へ渡す。
3. SQL が `INSERT INTO users` で始まり、DELETE/DROP を含まないことを確かめてから流す。
4. 作成した行を、ハッシュの先頭21文字 (`pbkdf2-sha256$100000$`) だけ表示して確認する。

手作業の `--file` や `pnpm exec` を使わない理由は §5 末尾の表にあります。

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
node node_modules/wrangler/bin/wrangler.js d1 execute kanjo-db --remote \
  --command "SELECT id, email, role, status FROM users ORDER BY created_at"

# 2. 新しいハッシュを作り、その admin への UPDATE だけを流して確認する
bash docs/runbooks/scripts/admin-credential-remote.sh reset-admin --user-id <復旧対象のid>
```

`reset-admin`はemail/role/id/created_atを変えず、指定idが既存adminに一致するときだけハッシュ・停止状態・一時期限・セッション世代を更新します。
成功すると確認表が `must_change_password=1`、1つ進んだ `session_generation`、`hash_head=pbkdf2-sha256$100000$` になり、
次回ログインでパスワード変更 (12文字以上) を求められます。

作業後は `audit_log` に記録が残らない経路であるため、実施日時と対象を運用記録へ手で残します。

### 手作業で流さない理由 (2026-09-15 の実施で踏んだ失敗)

| 以前の手順 | 起きたこと | スクリプトでの扱い |
|---|---|---|
| `wrangler d1 execute --file` | 本番で `/import` の認証エラー (code 10000) になり、流れない | `--command` で流す |
| `pnpm --filter @kanjo/api exec wrangler` | 7403 で失敗したとき、pnpm がハッシュ入りの SQL を丸ごと表示した | wrangler を直接呼び、出力のハッシュを伏せ字にする。7403 は1回だけ再試行する |
| SQL を `/tmp` へ書き出す | ハッシュがディスクに残る | SQL はシェル変数にだけ置き、書き込み後に消す |
| 反復 210,000 回のハッシュ | 本番 Workers の WebCrypto が 100,000 回を超える PBKDF2 を拒否し、ログインが 500 になった (#52) | `seed-admin.mjs` が 100,000 回で作る |

出力にハッシュが表示されてしまったら、そのパスワードは使わずに作り直します。
複数の Cloudflare アカウントにログインしている wrangler では、`CLOUDFLARE_ACCOUNT_ID` を環境変数で渡します。

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
