# Google ログインの設定（Google Cloud Console）

Focus Ledger の「Googleでログイン」「招待をGoogleで承諾」「設定画面でGoogleを連携」を使えるようにするための手順です。
Google Cloud Console で OAuth クライアントを作り、その Client ID / Client Secret を
ローカルは `packages/api/.dev.vars`、本番は Cloudflare Worker secret へ登録します。

- 対象コード: Better Auth v1.7.5 の Google provider（`packages/api/src/better-auth.ts` の `createAuth`）
- Google 側の画面名・規則の確認日: 2026-09-22（下記「参照した公式資料」を同日に確認）
- 値（Client Secret 等）は文書・issue・PR・チャット・シェル履歴に書かない

## 現在の入口（2026-10-31 再確認）

ローカル設定の不足は `pnpm run auth:readiness` で確認します。値を表示せず、設定名と充足状態だけを返します。
Google/メールの4項目（`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`RESEND_API_KEY`、`MAIL_FROM`）はローカルで未設定です。
GitHub Repository Variableは `APP_URL` のみ、`MAIL_FROM` は未登録です。`production` EnvironmentのCloudflare接続用secret名2本は存在します。
現在のCloudflare資格情報ではWorker secret一覧が認証エラー10000、D1一覧が権限エラー7403になるため、本番secretと0059適用状態は確認できていません。
下の9月23日の記録を、現在の本番状態と読み替えないでください。

配信は次の順で行います。必須secretが未確認のまま `main` に入れると自動Deployが止まるため、設定を先に整えます。

1. Google OAuthクライアントとResendの検証済み送信元を本人が用意し、§4〜§6に従ってローカルで実Google認証とメール配送を確認します。秘密値はチャットへ貼りません。
2. [`Cloudflare設定ガイド`](../cloudflare-credentials-setup.md)に従って、既存Workerを所有するAccountのTokenを用意し、`node .cloudflare/setup-production.mjs` を対話Terminalで実行します。helperはこのAccount/Tokenを子プロセスの環境に固定し、読み取り確認ができる前に設定を書きません。既存Worker secretは明示的な置換指定なしに変更しません。
3. 本番secret名・`MAIL_FROM`・既存利用者の移行条件・D1復元地点を確認してから変更内容を受け入れ、本番への反映を進めます。既存の自動配信経路はビルド→D1 migration→Workerの順です。
4. Googleでの初回登録と2回目ログイン、招待メール・再設定メール、既存セッション失効を本番で確認し、時間を空けた2回の確認結果を配信記録に残します。

実測の索引と未完条件は [`タスク実行状態`](../login-v2/task-status.md) を参照してください。

## 過去の記録（2026-09-23 実測）

この節は「いま何が終わっていて、何が残っているか」のスナップショットです。設定が進んだら更新します。
判定に使ったコマンドは各行に書いてあるので、いつでも測り直せます。

### 済んでいること

| 事項 | 確かめ方 |
|---|---|
| ✅ Google ログインの実装（provider 設定・招待必須・連携/解除・失敗時の画面） | `packages/api/src/better-auth.ts`、`packages/web/src/features/auth/` |
| ✅ ローカルの `BETTER_AUTH_SECRET` と `BETTER_AUTH_URL`（`http://localhost:4175`） | `packages/api/.dev.vars` |
| ✅ `.dev.vars.example` に Google の2行が用意されている | `packages/api/.dev.vars.example` |
| ✅ GitHub Repository Variable `APP_URL`（末尾 `/` 付きだが無害。§0 の注記を参照） | `gh variable list` |
| ✅ GitHub Environment `production` の `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` | `gh secret list --env production` |
| ✅ 本手順書 | このファイル |

### まだ設定が要ること

上から順に進めます。**1〜3 はローカルで閉じ、4 以降は本番の切り替え作業**です。

| # | やること | いまの状態 | 参照 |
|---|---|---|---|
| 1 | Google Cloud プロジェクトと同意画面（Branding / Audience）を用意する | 未実施（ローカルにクライアントの値が無いため） | §2・§3 |
| 2 | OAuth クライアント（ローカル用）を作り、リダイレクト URI を登録する | 未実施 | §4.1 |
| 3 | `packages/api/.dev.vars` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を入れ、動作確認する | **未設定**（`sed -n 's/^\([A-Z_]*\)=.*/\1/p' packages/api/.dev.vars` に Google の2行が無い。API は 503 `google_auth_not_configured`） | §5.1・§6 |
| 4 | OAuth クライアント（本番用）を作る | 未実施 | §4.2 |
| 5 | 本番 Worker に `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `RESEND_API_KEY` を登録する | **4つとも未登録**（`wrangler secret list` に旧実装の `AUTH_PASSWORD` と `SESSION_SECRET` しか無い） | §5.2 |
| 6 | GitHub Variable `MAIL_FROM` を設定する | **未設定**（`deploy.yml` が `--var MAIL_FROM:"$MAIL_FROM"` で空文字を渡している。招待メールと再設定メールの送信元が空になる） | [`CI/CD・本番運用ガイド`](../ci-cd-operations.md) |
| 7 | GitHub Variable `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` の要否を決める | 未設定（同じく空文字で渡る。Cloudflare Access を使わないなら「使わない」と決めて記録する） | 同上 |

### 当時の順番についての注意（現行手順は上の入口を参照）

本番（4〜7）は、**新しいログイン実装が main へ入ってから**行います。いまの本番 Worker は旧実装（`SESSION_SECRET` を使う版）が動いており、
Google の Secret だけ先に登録しても使われません。ローカル（1〜3）は今すぐ進められます。

## 0. 全体像と、決めておくこと

| 項目 | このアプリでの値 | 根拠 |
|---|---|---|
| アプリケーションの種類 | ウェブ アプリケーション | サーバ（Worker）が Client Secret を持って code を交換する |
| 要求するスコープ | `openid` `email` `profile` のみ | Better Auth の既定値。追加スコープは要求しない |
| 承認済みのリダイレクト URI | `<BETTER_AUTH_URL>/api/auth/callback/google` | `AUTH_BASE_PATH='/api/auth'` と provider id `google` |
| 承認済みの JavaScript 生成元 | 不要（登録しても害はない） | ブラウザから Google API を直接呼ばない。リダイレクト方式のみ |
| アカウント選択 | 毎回選ばせる（`prompt=select_account`） | 招待先と違うアカウントの誤選択を防ぐ |
| 新規作成 | 有効な招待があるメールだけ（`disableImplicitSignUp`） | 招待のない Google アカウントは 401 と同じ扱いで拒否 |

`<BETTER_AUTH_URL>` は **ブラウザのアドレスバーに出る origin** です。API の内部 port ではありません。

| 環境 | `<BETTER_AUTH_URL>` の決まり方 | 登録するリダイレクト URI の例 |
|---|---|---|
| ローカル（`pnpm run preview`、Wrangler が画面も配信） | `.dev.vars` の `BETTER_AUTH_URL` | `http://localhost:8787/api/auth/callback/google` |
| ローカル（Vite の画面 + Wrangler の API を proxy） | `.dev.vars` の `BETTER_AUTH_URL`（Vite 側の origin にする） | `http://localhost:4175/api/auth/callback/google` |
| 本番 | GitHub Repository Variable `APP_URL`（deploy が `--var BETTER_AUTH_URL:"$APP_URL"` で渡す） | `https://<配信元>/api/auth/callback/google` |

Google はリダイレクト URI を **文字列の完全一致** で比べます。`localhost` と `127.0.0.1`、port の有無、
末尾の `/`、`http` と `https` はすべて別物です。

`BETTER_AUTH_URL` の末尾に `/` が付いていても、Better Auth が落としてから `/api/auth` を継ぐため、
リダイレクト URI は `//api/auth/...` にはなりません（`withPath()` の挙動）。Google へ登録するのは
スラッシュを重ねない形の1本だけです。

**推奨: OAuth クライアントを「ローカル用」と「本番用」の2つに分ける。** 本番クライアントに
`http://localhost` を残さないためです。同じ Google Cloud プロジェクト内に2つ作れば、同意画面の設定は共有されます。

## 1. 事前に用意するもの

- [ ] Google アカウント（Google Cloud Console にログインできるもの）
- [ ] 同意画面の「ユーザー サポートメール」と「デベロッパーの連絡先」に使うメールアドレス
- [ ] 本番の配信元 origin（GitHub Repository Variable `APP_URL` と同じ値）
- [ ] ローカル: この worktree で `pnpm install` 済み、`packages/api/.dev.vars` がある（無ければ `.dev.vars.example` を写す）
- [ ] 本番: [`Cloudflare 認証情報の設定`](../cloudflare-credentials-setup.md) の §4 まで完了している
- [ ] ログインを試す Google アカウントのメールアドレス宛てに、アプリ側で招待を作れる（§6）

## 2. Google Cloud プロジェクトを用意する

1. <https://console.cloud.google.com/projectcreate> を開く。
2. 「プロジェクト名」に識別しやすい名前（例: `focus-ledger-auth`）を入れ、「作成」を押す。
   組織に属するアカウントなら「場所」に組織を選ぶ。個人アカウントなら「組織なし」のままでよい。
3. 画面上部のプロジェクト選択で、作ったプロジェクトが選ばれていることを確認する。
   以降の URL はすべて「今選んでいるプロジェクト」に対して開く。

既存プロジェクトを使う場合は 2 を飛ばし、3 の確認だけ行う。

## 3. Google Auth Platform の初期設定（同意画面）

1. <https://console.cloud.google.com/auth/overview> を開く。
   未設定なら「Google Auth Platform はまだ構成されていません」と出るので「開始」を押す。
2. **アプリ情報**
   - 「アプリ名」: 利用者の同意画面に出る名前（例: `Focus Ledger`）。`Google` `Gmail` など Google のブランド名を含めない。
   - 「ユーザー サポートメール」: 自分の Google アカウントのメール、または自分が管理する Google グループ。
3. **対象（Audience）**
   - 個人アカウント、または組織外の家族も使う → 「外部」
   - Google Workspace 組織内の利用者だけが使う → 「内部」（組織に属するプロジェクトでのみ選べる）
4. **連絡先情報**: Google から重要な通知を受けるメールアドレスを入れる。
5. 「Google API サービス: ユーザーデータに関するポリシー」に同意して「作成」を押す。

### 3.1 ブランディング（<https://console.cloud.google.com/auth/branding>）

最低限は §3 で入った値のままで動きます。本番を「本番環境」で公開する前に、次を確認します。

| 項目 | 入れる値 | 必須か |
|---|---|---|
| アプリのロゴ | 120×120px・1MB 以下の JPG/PNG/BMP | 任意。**入れるとブランド確認が必要になる**ので、不要なら入れない |
| アプリのホームページ | `https://<配信元>/` | 外部公開時に推奨 |
| プライバシー ポリシー | `https://<配信元>/privacy`（アプリ内の公開ページ。Google から受け取る情報の扱いを記載済み） | 外部公開時に推奨 |
| 利用規約 | 規約ページがあればその URL（無ければ空欄） | 任意 |
| 承認済みドメイン | 配信元のトップ プライベート ドメイン（下の注意を参照） | リダイレクト URI やリンクにドメインを使うなら必要 |
| デベロッパーの連絡先情報 | §3 の 4 と同じでよい | 必須 |

承認済みドメインの注意: 配信元が `*.workers.dev` のような共有ドメインの場合、Console が受け付ける単位は
Public Suffix List に従います。登録が拒否されたら、配信元を自分の独自ドメインにしてからそのドメインを登録してください。
ロゴを入れない・スコープが `openid email profile` だけの構成なら、同意画面にはアプリ名の代わりにドメインが表示されることがありますが、
ログインの動作には影響しません。

### 3.2 データアクセス（<https://console.cloud.google.com/auth/scopes>）

何も追加しなくて構いません。Better Auth は `openid` `email` `profile` を認可リクエストで要求し、
これらは Google の分類で「機密性の低いスコープ」なので、ここへの登録や審査は不要です。
明示しておきたい場合は「スコープを追加または削除」で次の3つだけを選び「更新」→「保存」します。

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

**それ以外のスコープ（Drive・Gmail 等）は追加しない。** 追加すると審査対象になり、本アプリのコードも使いません。

### 3.3 対象と公開ステータス（<https://console.cloud.google.com/auth/audience>）

「外部」を選んだ場合、作成直後の公開ステータスは「テスト中」です。

| ステータス | ログインできる人 | 使いどころ |
|---|---|---|
| テスト中 | 「テストユーザー」に追加した Google アカウントだけ（最大100） | ローカル検証・本番の初回確認 |
| 本番環境 | すべての Google アカウント（ただしアプリ側で招待が必要） | 本番運用 |

- テスト中に試す場合: 「テストユーザー」→「+ Add users」で、試す Google アカウントのメールを追加して「保存」。
  追加していないアカウントは Google 側の「アクセスをブロック」画面で止まり、アプリまで戻ってきません。
- 本番運用に移る場合: 「アプリを公開」→ 確認ダイアログで「確認」。スコープが `openid email profile` だけなら
  スコープの審査は求められません（ロゴを入れた場合はブランド確認が必要）。
- 「内部」の場合はこの設定は無く、組織内のアカウントだけがログインできます。

アプリ側でも招待が無ければ作成されないので、「本番環境」にしても第三者が勝手に利用者になることはありません。

## 4. OAuth クライアントを作る

### 4.1 ローカル用

1. <https://console.cloud.google.com/auth/clients> を開き、「+ クライアントを作成」を押す。
2. 「アプリケーションの種類」: **ウェブ アプリケーション**
3. 「名前」: `Focus Ledger local`（Console 内の識別用。利用者には出ない）
4. 「承認済みの JavaScript 生成元」: 空のままでよい。
5. 「承認済みのリダイレクト URI」→「+ URI を追加」で、使う起動方法の分だけ追加する。

   ```text
   http://localhost:8787/api/auth/callback/google
   http://localhost:4175/api/auth/callback/google
   ```

   別の port で起動する worktree があれば、その origin も同じ形で追加する。`http` を使えるのは `localhost` だけです。
6. 「作成」を押す。
7. 表示されたダイアログで **Client ID と Client Secret を控える**（「JSON をダウンロード」でもよい）。
   **Client Secret が全文表示されるのは作成時だけ** です。閉じた後は末尾4文字しか見えません。
   控え損ねたら §8.1 の手順で新しい Secret を追加します。
   ダウンロードした JSON はリポジトリの外に置き、`.dev.vars` へ写したら削除します。

### 4.2 本番用

§4.1 と同じ手順で、次だけを変えて作成します。

- 「名前」: `Focus Ledger production`
- 「承認済みのリダイレクト URI」: 次の1件だけ（`localhost` を入れない）

  ```text
  https://<配信元>/api/auth/callback/google
  ```

  `<配信元>` は GitHub Repository Variable `APP_URL` と同じ origin（`https://` から始まり、末尾 `/` なし）。

Client Secret は、そのまま §5.2 の対話入力へ貼るか、パスワードマネージャーへ保存します。

Console の表示どおり、クライアントの作成や URI の変更が Google 側に反映されるまで数分かかることがあります。
直後に `redirect_uri_mismatch` が出た場合は、値を確認したうえで数分待ってから再試行します。

## 5. アプリへ登録する

### 5.1 ローカル: `packages/api/.dev.vars`

`.dev.vars` は `.gitignore` 済みです。エディタで開き、次の2行を追加します（値は §4.1 で控えたもの）。
`BETTER_AUTH_URL` は §4.1 で登録したリダイレクト URI の origin と **完全に同じ** にします。

```dotenv
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=<Client ID>
GOOGLE_CLIENT_SECRET=<Client Secret>
```

- Vite（4175）経由で画面を開くなら `BETTER_AUTH_URL=http://localhost:4175` にする。
- `echo ... >> .dev.vars` のようなコマンドで書かない（シェル履歴に残る）。
- `.dev.vars` は起動時に読まれるので、書き換えたら `wrangler dev` を止めて起動し直す。

起動後の確認（ログイン前でも実行できる）:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8787/api/auth/sign-in/social \
  -H 'content-type: application/json' -H 'origin: http://localhost:8787' \
  -d '{"provider":"google","callbackURL":"/"}'
```

`200` なら設定が読まれています。`503` で本文が `google_auth_not_configured` なら、2つの値のどちらかが読まれていません
（変数名の綴り、行頭の空白、再起動忘れを確認）。

### 5.2 本番: Cloudflare Worker secret

本番の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` は **Worker secret** に置きます。GitHub secret や `wrangler.jsonc` の `vars` には置きません。

初回はリポジトリのルートで helper を実行し、案内に従って §4.2 の値を非表示入力します
（詳細は [`Cloudflare 認証情報の設定`](../cloudflare-credentials-setup.md) §4.4・§7.1）。

```bash
node .cloudflare/setup-production.mjs
```

helper は未登録の secret だけを尋ねます。すでに登録済みの値を差し替えるときは次のどちらかを使います。

```bash
# helper で差し替える（Google と Resend の3値を尋ね直す）
node .cloudflare/setup-production.mjs --replace-provider-secrets

# 1つずつ差し替える（値はプロンプトに貼る。引数に書かない）
pnpm --dir packages/api exec wrangler secret put GOOGLE_CLIENT_ID
pnpm --dir packages/api exec wrangler secret put GOOGLE_CLIENT_SECRET
```

名前だけを確認します（値は表示されない）。

```bash
pnpm --dir packages/api exec wrangler secret list
```

`GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` の両方が並んでいれば合格です。Worker secret は登録した時点で
稼働中の Worker に反映されるため、再 deploy は不要です。`BETTER_AUTH_URL` は deploy 時に `APP_URL` から渡されるので、
`APP_URL` とリダイレクト URI の origin が一致していることもここで確認します。

## 6. 動作確認

Google で利用者を作れるのは **そのメールアドレス宛ての有効な招待があるとき** だけです。招待を先に作ります。

- ローカル: `node scripts/seed-admin.mjs --email <試すGoogleアカウントのメール> --role member`
  （`--origin` は `BETTER_AUTH_URL` と同じにする。例: `--origin http://localhost:4175`）
- 本番: 管理者で「設定 → 利用者管理」から招待する。

確認項目:

1. [ ] 招待の承諾画面で「Googleで登録」→ Google のアカウント選択画面が出る。
2. [ ] 招待先と同じアカウントを選ぶ → アプリへ戻り、ログイン済みになる。
3. [ ] ログアウトし、ログイン画面の「Googleでログイン」で同じアカウントを選ぶ → ログインできる。
4. [ ] 招待の無い別の Google アカウントを選ぶ → `/login?error=google` へ戻り、
      「Googleでログインできませんでした。招待先と同じメールアドレスの…」が表示される。
5. [ ] パスワードで登録済みの利用者が、ログイン後に「設定」→ Google を連携 → 次回から Google でも入れる。
6. [ ] 管理者の場合: Google でログインしても、TOTP 未設定なら TOTP の設定へ進み、設定済みなら6桁コードを求められる
      （TOTP の関門は認証手段に関係なく管理者に掛かる）。

## 7. うまくいかないとき

| 症状 | 原因 | 対処 |
|---|---|---|
| 画面に「認証が未設定です。管理者にお問い合わせください」、API が 503 `google_auth_not_configured` | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` のどちらかが未登録 | ローカルは §5.1、本番は §5.2 の `wrangler secret list` で名前を確認 |
| Google の画面で「エラー 400: redirect_uri_mismatch」 | 登録したリダイレクト URI と `<BETTER_AUTH_URL>/api/auth/callback/google` が不一致 | エラー画面の「エラーの詳細」に出る `redirect_uri` をそのまま §4 に登録（`localhost`/`127.0.0.1`・port・`http(s)` を確認） |
| Google の画面で「アクセスをブロック: … はテスト中です」 | 公開ステータスが「テスト中」で、テストユーザーに未追加 | §3.3 でテストユーザーに追加、または「アプリを公開」 |
| Google の画面で「エラー 403: org_internal」 | 対象が「内部」なのに組織外のアカウントを選んだ | 組織内のアカウントを使う、または §3.3 で「外部」に変更 |
| Google の画面で「エラー 401: invalid_client」 | Client ID と Secret の組が違う・Secret を削除した | 同じクライアントの ID と有効な Secret を登録し直す |
| アプリへ戻ったが「Googleでログインできませんでした…」 | 招待が無い・期限切れ・取り消し済み／別アカウントを選んだ／Google 側でメール未確認 | §6 の招待を作り直し、招待先と同じアカウントを選ぶ |
| アプリへ戻ったが 403 `MISSING_OR_NULL_ORIGIN` / `INVALID_ORIGIN` | 開いている画面の origin と `BETTER_AUTH_URL` が不一致 | アドレスバーの origin と `BETTER_AUTH_URL` を揃える（ローカルは再起動） |

## 8. 運用

### 8.1 Client Secret のローテーション

1. <https://console.cloud.google.com/auth/clients> で本番クライアントを開き、「Client secrets」の「Add secret」で新しい Secret を追加する（旧 Secret はまだ消さない）。
2. §5.2 の `wrangler secret put GOOGLE_CLIENT_SECRET` で新しい値を登録する。
3. §6 の 3 で Google ログインを確認する。
4. 確認後、Console で旧 Secret を「Disable」→「Delete」する。

漏えいが疑われる場合は 1→2→4 を直ちに行い、3 を後で確認します。

### 8.2 配信元（`APP_URL`）を変えるとき

1. 本番クライアントに新しい `https://<新しい配信元>/api/auth/callback/google` を **追加**（旧 URI は残す）。
2. GitHub Repository Variable `APP_URL` を更新し、deploy する。
3. 新しい配信元で §6 の 3 を確認してから、旧 URI を削除する。

### 8.3 やらないこと

- Client Secret を文書・issue・PR・チャット・ログ・シェル履歴に書かない。
- 本番クライアントに `http://localhost` のリダイレクト URI を残さない。
- `openid` `email` `profile` 以外のスコープを追加しない。
- ローカル用クライアントの値を本番の Worker secret に入れない（逆も同じ）。

## 参照した公式資料（2026-09-22 確認）

- Google Auth Platform: OAuth クライアントの作成と URI の規則 — <https://support.google.com/cloud/answer/15549257>
- Google Auth Platform: 対象（外部/内部、テスト中/本番環境、テストユーザー） — <https://support.google.com/cloud/answer/15549945>
- Google Auth Platform: ブランディングとブランド確認 — <https://support.google.com/cloud/answer/15549049>
- Better Auth: Google provider（リダイレクト URI `/api/auth/callback/google`、`prompt`） — <https://www.better-auth.com/docs/authentication/google>

## 関連文書

- [`Cloudflare 認証情報の設定`](../cloudflare-credentials-setup.md) — Worker secret の初回登録（§4.4・§7.1）
- [`アカウント認証運用（Better Auth）`](account-login-operations.md) — 招待・停止・secret ローテーション全般
- [`CI/CD・本番運用ガイド`](../ci-cd-operations.md) — deploy と `APP_URL`
