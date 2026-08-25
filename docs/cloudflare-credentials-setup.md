# Cloudflare認証情報セットアップ手順

この手順は、GitHub ActionsからCloudflare Workersの`kanjo-console`をデプロイできる状態にするための作業票です。上から順番に実行し、各「完了条件」を確認してください。

対象:

- GitHubリポジトリ: `daishiman/kanjo`
- GitHub Environment: `production`
- Cloudflare Worker: `kanjo-console`
- Cloudflare D1: `kanjo-db`
- Cloudflare R2: `kanjo-files`

2026年8月25日時点のCloudflare公式画面と公式ドキュメントで確認しています。画面名が変わった場合は、各節の公式リンクから開いてください。

## 1. 最終的に用意するもの

| 値 | 作成・取得する場所 | 登録先 | 秘密か |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Account API tokens | GitHub `production` Environment secret | 秘密 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account Home | GitHub `production` Environment secret | 機密性は低いがsecretとして管理 |
| `APP_URL` | WorkerのDomains画面 | GitHub Repository variable | 公開情報 |
| `AUTH_PASSWORD` | 自分のパスワードマネージャーで生成 | Cloudflare Worker secret | 秘密 |
| `SESSION_SECRET` | ローカルで安全に生成 | Cloudflare Worker secret | 秘密 |

この構成では次の値は不要です。取得・登録しないでください。

- Global API Key（権限が広すぎる旧方式）
- Origin CA Key
- Zone ID（現在は`workers.dev`で公開しており、Zone routeを使わないため）
- R2 API Token（WorkerはR2 binding経由でアクセスするため）
- `CLOUDFLARE_EMAIL` / `CLOUDFLARE_API_KEY`（旧認証方式）

CloudflareもGlobal API KeyよりAPI Tokenを推奨しています。詳細は[Cloudflare API Get started](https://developers.cloudflare.com/fundamentals/api/get-started/)を参照してください。

## 2. 作業前チェック

- [ ] Cloudflareへログインできる
- [ ] `kanjo-console`を所有するCloudflareアカウントを判別できる
- [ ] GitHubの`daishiman/kanjo`で管理者権限がある
- [ ] ターミナルで`gh auth status`が成功する
- [ ] 作業場所が`daishiman/kanjo`であることを確認した
- [ ] パスワードマネージャーを開いた

ターミナルで確認します。

```bash
gh auth status
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

2つ目の出力が次であることを確認します。

```text
daishiman/kanjo
```

違うリポジトリ名が出た場合は、そこで作業を止めてリポジトリのディレクトリへ移動してください。

### 2.1 Wranglerのネイティブ依存を確認する

このリポジトリはApple Silicon上のarm64 NodeとRosetta上のx64 Nodeの両方を許容します。最初に依存関係とWranglerの起動を確認します。

```bash
pnpm install --frozen-lockfile
node -p '`${process.platform} ${process.arch} ${process.version}`'
pnpm --filter @kanjo/api exec wrangler --version
```

`You installed workerd on another platform`、`workerd-darwin-64`、`workerd-darwin-arm64`のいずれかを含むエラーになった場合は、現在のOS向けにx64・arm64両方の任意依存を入れ直します。

```bash
pnpm install --force --frozen-lockfile
pnpm --filter @kanjo/api exec wrangler --version
```

`pnpm-workspace.yaml`の`supportedArchitectures`により、現在のOSについて両CPU向けネイティブ依存がインストールされます。`node_modules`を別のMacやDockerイメージからコピーしないでください。lockfileの削除や別パッケージマネージャーへの切り替えは不要です。設定の根拠は[pnpm 10のsupportedArchitectures](https://pnpm.io/10.x/settings#supportedarchitectures)です。

## 3. Cloudflare Account IDを取得する

公式手順: [Find account and zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)

### 3.1 対象アカウントを確定する

1. [Cloudflare Account Home](https://dash.cloudflare.com/?to=/:account/home)を開く。
2. 複数アカウントが表示された場合は、`kanjo-console`を所有するアカウントを選ぶ。
3. 左側の`Workers & Pages`を開く。
4. Worker一覧に`kanjo-console`があることを確認する。
5. `D1`で`kanjo-db`が同じアカウントにあることを確認する。
6. `R2 object storage`を開き、`kanjo-files`があることを確認する。

`kanjo-console`または`kanjo-db`が存在しない場合は、別アカウントを選んでいないか確認してください。異なるアカウントのIDをGitHubへ登録すると、Wranglerは`code 7003`などの対象不一致エラーになります。

#### R2一覧に`kanjo-files`が見えない場合

画面上部のアカウント選択が、`kanjo-console`を所有するアカウントになっているか最初に確認します。そのうえで、リポジトリのルートから次を実行してください。

```bash
pnpm --filter @kanjo/api exec wrangler whoami
pnpm --filter @kanjo/api exec wrangler r2 bucket list
```

`whoami`に表示されるAccount IDと、ブラウザで選択したCloudflareアカウントのAccount IDを照合します。`bucket list`に`kanjo-files`が表示される場合、バケットはWranglerのOAuth接続先に既に存在します。ブラウザでも同じアカウントを選び直し、`R2 object storage`を再読み込みしてください。重複作成は不要です。

`bucket list`にも`kanjo-files`がない場合だけ、次を実行して空のバケットを作ります。

```bash
pnpm --filter @kanjo/api exec wrangler r2 bucket create kanjo-files
pnpm --filter @kanjo/api exec wrangler r2 bucket info kanjo-files
```

Wranglerが未認証の場合は、先に次を実行して、`kanjo-console`を所有するアカウントで認証します。

```bash
pnpm --filter @kanjo/api exec wrangler login
```

作成時にロケーションやストレージクラスを指定しない場合、Cloudflareの現行既定値であるAutomaticロケーションとStandardストレージクラスが使われます。バケット名とバケットは既定で非公開です。`packages/api/wrangler.jsonc`の`FILES` bindingからWorker経由で利用するため、`r2.dev`公開URLやカスタムドメインを有効にしないでください。

非公開状態は次で確認できます。

```bash
pnpm --filter @kanjo/api exec wrangler r2 bucket dev-url get kanjo-files
pnpm --filter @kanjo/api exec wrangler r2 bucket domain list kanjo-files
```

1つ目が`Public access ... is disabled`、2つ目がカスタムドメインなしを示せば完了です。確認目的で実データやサンプルオブジェクトをアップロードしないでください。

公式手順:

- [R2バケットを作成する](https://developers.cloudflare.com/r2/buckets/create-buckets/)
- [R2のWranglerコマンド](https://developers.cloudflare.com/r2/reference/wrangler-commands/)
- [R2の公開アクセス](https://developers.cloudflare.com/r2/buckets/public-buckets/)

### 3.2 Account IDをコピーする

最短手順:

1. Cloudflareダッシュボードを開いた状態で`Command + K`（Windowsは`Ctrl + K`）を押す。
2. 検索欄へ`Copy account ID`と入力する。
3. 表示された`Copy account ID`を選ぶ。
4. クリップボードへコピーされたことを確認する。

代替手順:

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)を開く。
2. Overviewの`Account Details`を探す。
3. `Account ID`の横にあるコピーボタンを押す。

Account IDは通常、空白やハイフンを含まない32文字の英数字です。Zone IDと取り違えないでください。

### 3.3 GitHubへ登録する

ターミナルで次を実行します。

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
```

入力待ちになったら、先ほどコピーしたAccount IDを貼り付けて確定します。値をコマンド行へ直接書かないため、シェル履歴に残りません。

完了条件:

```bash
gh secret list --env production
```

一覧に`CLOUDFLARE_ACCOUNT_ID`が表示されること。値が表示されないのはGitHubの正常なsecret仕様です。

## 4. Cloudflare API Tokenを作成する

公式手順: [GitHub ActionsからWorkersへデプロイする](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

この手順では、特定の個人に依存せずCI/CD用のサービス主体として使えるaccount-owned tokenを作ります。CloudflareもCI/CDのような継続利用にはaccount-owned tokenを案内しており、Workers・D1・R2はいずれもaccount-owned tokenに対応しています。作成には対象アカウントのSuper Administrator権限が必要です。詳細は[Account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)を参照してください。

`Create Token`が表示されない場合はGlobal API Keyで代用せず、対象アカウントのSuper Administratorへ作成を依頼してください。やむを得ずuser tokenを使う場合は`My Profile > API Tokens`から作成し、4.3の権限と4.4の単一アカウント制限を同じように設定します。

API Tokenの秘密値は作成完了画面で1回だけ表示されます。この章の画面操作と4.7のGitHub登録はリポジトリ所有者本人が実行し、tokenをIssue・PR・チャットへ貼らないでください。

### 4.1 API Token画面を開く

最短で間違いが少ない方法は、Cloudflare公式仕様のtemplate URLで、このプロジェクトに必要な4権限を事前入力する方法です。

1. [kanjo用Account API Token作成画面（4権限を事前入力）](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_r2%22%2C%22type%22%3A%22edit%22%7D%5D&name=kanjo-github-actions-production)を開く。
2. アカウント選択が出たら、3章で確定した`kanjo-console`所有アカウントを選ぶ。
3. 画面の見出しが`Account API Tokens`であることを確認する。URLが`/profile/api-tokens`ならuser token画面なので戻る。
4. Token nameが`kanjo-github-actions-production`になっていることを確認する。
5. Permission policiesに4.3の4権限が入っていることを確認する。事前入力されなかった場合は、次の手動手順を使う。

上のリンクはtokenを作成せず、名前と権限を作成フォームへ事前入力するだけです。アカウントIDや秘密値はURLに含みません。仕組みは[Cloudflare API token template URLs](https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/)に準拠しています。

#### 手動で開く場合

1. [Cloudflare Account Home](https://dash.cloudflare.com/?to=/:account/home)を開き、`kanjo-console`所有アカウントを選ぶ。
2. 左側の`Manage Account`を開き、`Account API Tokens`を選ぶ。画面幅によっては`Manage Account > API Tokens`と表示される。
3. `Create Token`を選ぶ。
4. `Permission policies`の現在値`Custom`を開き、スターターとして`Edit Cloudflare Workers`を選ぶ。
5. Token nameと権限編集フォームが表示されたら、4.2と4.3へ進む。

画面がテンプレート一覧形式の場合は、`Edit Cloudflare Workers`行の`Use template`を選びます。`Create Custom Token`と`Get started`が表示される画面では、それを選んで4.3の4行を手動追加しても構いません。

`Edit Cloudflare Workers`は完成形ではなくスターターです。2026年8月時点の標準テンプレートにはWorkers Scripts・R2などが入りますが、`Migrate`に必要なD1権限は含まれません。4.3でD1を追加し、不要権限を削除するまで`Continue to summary`へ進まないでください。

次の画面を開いていたら導線が違います。

| 表示 | 判断 |
|---|---|
| `My Profile > API Tokens` / URLが`/profile/api-tokens` | user-owned token画面。今回は`Manage Account > Account API Tokens`へ戻る |
| `Global API Key`と`View` | 旧方式の鍵。選ばずに戻る |
| `R2 API Tokens` | S3互換API用。WorkersのCI/CD用ではないため戻る |
| `Create Token`がない | アカウント違い、またはSuper Administrator権限不足を確認する |

Cloudflare公式の現行GitHub Actions手順も、`Account API tokens > Create Token > Permission policies > Edit Cloudflare Workers`の導線を案内しています。

### 4.2 Token名を入力する

Token nameへ次を入力します。4.1の事前入力リンクを使った場合は、同じ値が入っていることを確認します。

```text
kanjo-github-actions-production
```

用途と環境が一覧だけで判別できる名前にします。token名にtokenの値や個人情報を入れないでください。

### 4.3 Permissionを最小権限へ調整する

Permission policiesの各行は、左から`Resource`、`Permission`、`Level`を選びます。`Add more`、`+ Add`、`Add permission`のいずれかで行を追加し、削除アイコンで不要行を消します。最終的な`Account`権限を次の4行だけにしてください。

| Resource | Permission | Level | 用途 |
|---|---|---|---|
| Account | Account Settings | Read | Wranglerが対象アカウント情報を確認する |
| Account | Workers Scripts | Edit | `wrangler deploy`でWorkerを更新する |
| Account | D1 | Edit | `Migrate`でD1 migrationを適用する |
| Account | Workers R2 Storage | Edit | R2 bindingを含むWorkerを扱う |

Cloudflare画面で`Edit`ではなく`Write`と表示される場合があります。その場合は同じ権限の`Write`を選びます。現行権限名は[API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)で確認できます。

選択時の注意:

- `Workers Scripts`は`Account`権限です。`Zone > Workers Routes`と取り違えない。
- `D1`は標準の`Edit Cloudflare Workers`テンプレートに含まれないため、必ず追加する。
- `Workers R2 Storage`はR2 bindingの管理権限です。`R2 API Token`を別途作る必要はない。
- `Account Settings`は`Read`にし、`Edit`へ広げない。

`Edit Cloudflare Workers`テンプレートから始めた場合は、次の対応表どおりに調整します。

| テンプレートの行 | 操作 | 理由 |
|---|---|---|
| Account Settings Read | 残す | Wranglerの対象アカウント確認 |
| Workers Scripts Edit / Write | 残す | Workerデプロイ |
| Workers R2 Storage Edit / Write | 残す | `FILES` binding |
| D1 Edit / Write | **新しく追加する** | 手動`Migrate`ワークフロー |
| Workers KV Storage Edit / Write | 削除 | このリポジトリはKV未使用 |
| Workers Tail Read | 削除 | GitHub Actionsからtailしない |
| Zone > Workers Routes Edit / Write | 削除 | 現在はZone route未使用 |
| User Details Read | 削除 | account-owned tokenでは不要 |
| User Memberships Read | 削除 | account-owned tokenでは不要 |

将来Custom DomainやZone routeを追加する場合だけ、`Zone > Workers Routes > Edit`を対象Zone1件に限定して追加します。

### 4.4 Account Resourcesを1アカウントに限定する

account-owned tokenでは、token作成画面を開いたアカウント自体が対象になるため、`Account Resources`欄が表示されない場合があります。その場合は、画面上部のアカウント名が`kanjo-console`を所有するアカウントであることを確認します。

`Account Resources`欄が表示される場合:

1. 1つ目を`Include`にする。
2. 2つ目を`Specific account`または対象アカウント名にする。
3. `kanjo-console`を所有するアカウントだけを選ぶ。
4. `All accounts`になっていないことを確認する。

Zone権限をすべて削除した場合、`Zone Resources`は不要です。Zone権限を追加した場合は`All zones`にせず、対象Zone1件だけを選びます。

このプロジェクトの現在の完成形ではZone権限が0件なので、Summaryに`All zones`や`Workers Routes`が表示されたら4.3へ戻って削除します。

### 4.5 IP制限と有効期限を判断する

GitHub-hosted runnerの送信元IPは固定ではないため、`Client IP Address Filtering`は空欄にします。固定IPを推測して設定するとGitHub Actionsだけ認証に失敗します。

有効期限を設定する場合:

1. 失効日の30日前に更新する予定をカレンダーへ登録する。
2. 失効前に新tokenを作る。
3. GitHub secretを新tokenへ更新する。
4. Deploy成功後に旧tokenを削除する。

更新運用を用意できない場合は、期限切れで突然デプロイが止まらないよう、無期限にして定期ローテーションします。

### 4.6 Summaryを確認してtokenを作る

1. `Continue to summary`を選ぶ。
2. Account Resourcesが対象1アカウントだけであることを確認する。
3. Permissionが4.3の4種類だけであることを確認する。
4. `Create Token`を選ぶ。
5. 表示されたtokenをコピーする。

2026年に新規作成したaccount-owned tokenは通常`cfat_`で始まります。`cfut_`で始まる場合はuser-owned token画面で作成しているため、意図した方式かを確認してから使用してください。Global API Keyの`cfk_`は使用しません。

token値が完全な形で表示されるのはこの画面だけです。次へ移動する前に、次の4.7でGitHubへ登録してください。Issue、PR、チャット、メモ帳、スクリーンショットには保存しません。保管が必要ならパスワードマネージャーを使います。token形式の根拠は[Cloudflare token formats](https://developers.cloudflare.com/fundamentals/api/get-started/token-formats/)です。

### 4.7 GitHubへtokenを登録する

この操作はtokenを見られるリポジトリ所有者本人が行います。tokenをコピーしたまま、別のターミナルで次を実行します。

```bash
gh secret set CLOUDFLARE_API_TOKEN --env production
```

入力待ちになったらtokenを貼り付けて確定します。次の4.8を実行する場合はCloudflareのtoken表示画面を開いたままにし、確認後に閉じます。

完了条件:

```bash
gh secret list --env production
```

次の2つの名前が表示されることを確認します。

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

### 4.8 tokenがactiveか確認する（任意）

Cloudflare画面を閉じる前にaccount-owned token自体を確認したい場合は、公式の[Account token Verify API](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/verify/)を使います。tokenとAccount IDをコマンド履歴へ直接書かないよう、次の順で実行します。

```bash
printf 'Cloudflare Account IDを貼り付けてEnter: '
IFS= read -r KANJO_CF_ACCOUNT_ID
printf 'Cloudflare API tokenを貼り付けてEnter: '
IFS= read -rs KANJO_CF_TOKEN
printf '\n'
curl --silent --show-error \
  "https://api.cloudflare.com/client/v4/accounts/${KANJO_CF_ACCOUNT_ID}/tokens/verify" \
  --header "Authorization: Bearer ${KANJO_CF_TOKEN}" \
  | jq '{success, status: .result.status, errors}'
unset KANJO_CF_ACCOUNT_ID KANJO_CF_TOKEN
```

期待する結果:

```json
{
  "success": true,
  "status": "active",
  "errors": []
}
```

token値そのものを`echo`したり、検証結果へ含めたりしないでください。

## 5. APP_URLを取得する

`APP_URL`はデプロイ後のスモークテストでアクセスする、固定の本番URLです。preview URLではありません。

公式説明: [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

### 5.1 Workerの本番URLをコピーする

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)を開く。
2. `kanjo-console`を選ぶ。
3. `Domains`タブを開く。表示されない場合は`Settings > Domains & Routes`を開く。
4. 有効になっている`workers.dev` URLを探す。
5. production URLをコピーする。

URLは通常、次の形です。

```text
https://kanjo-console.<YOUR_ACCOUNT_SUBDOMAIN>.workers.dev
```

次は使用しません。

- `<version-id>-kanjo-console...`のようなpreview URL
- Cloudflareダッシュボード自体のURL
- `/api/...`まで含むURL
- URL末尾に個別画面のパスが付いたもの

Custom Domainを本番として運用している場合は、`Domains`に表示される固定のCustom Domainを使用します。

### 5.2 URLを手元で確認する

ブラウザのシークレットウィンドウでURLを開き、収支統合管理のログイン画面が表示されることを確認します。

ターミナルでも確認できます。

```bash
APP_URL="https://取得した本番URL" pnpm run smoke
```

この時点の本番が古く、現在のスモークテスト条件を満たしていない場合は失敗することがあります。その場合でも、DNSエラーや404ではなく対象Workerへ接続できていることを確認します。

### 5.3 GitHub Repository Variableへ登録する

`APP_URL`は公開情報なのでsecretではなくRepository Variableへ登録します。

```bash
gh variable set APP_URL --body "https://取得した本番URL"
gh variable list
```

`APP_URL`が一覧に表示され、値がコピーした本番URLと一致することを確認します。`production` Environment variableではなく、リポジトリ全体のRepository Variableとして登録します。

GitHub画面から登録する場合は、`daishiman/kanjo > Settings > Secrets and variables > Actions > Variables > New repository variable`を開き、Nameへ`APP_URL`、Valueへ本番URLを入力して`Add variable`を選びます。

## 6. GitHubのproduction Environmentを確認する

GitHub画面で確認する場合:

1. `daishiman/kanjo`を開く。
2. `Settings`を開く。
3. 左側の`Environments`を開く。
4. `production`を選ぶ。
5. `Environment secrets`にAPI tokenとAccount IDの2件があることを確認する。
6. `Deployment branches and tags`が`main`だけを許可していることを確認する。

CLIを使わずsecretを登録する場合は、同じ`production`画面の`Environment secrets > Add secret`を選びます。NameとValueを1件ずつ入力し、次の2件を作ります。

- `CLOUDFLARE_API_TOKEN`: 4章で作成したtoken
- `CLOUDFLARE_ACCOUNT_ID`: 3章でコピーしたAccount ID

GitHub CLIで確認する場合:

```bash
gh secret list --env production
gh variable list
gh api repos/daishiman/kanjo/environments/production/deployment-branch-policies \
  --jq '{branches:[.branch_policies[].name]}'
```

期待する状態:

- Environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Repository variable: `APP_URL`
- production許可ブランチ: `main`

GitHub Environmentの公式仕様は[Managing environments for deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)を参照してください。

## 7. Worker実行用secretを設定する

ここからはGitHub Actionsの認証情報ではなく、デプロイされたアプリが実行時に使うsecretです。Cloudflare API Tokenと同じ値を流用してはいけません。

### 7.1 ローカルWranglerのログインを確認する

```bash
pnpm --filter @kanjo/api exec wrangler whoami
```

表示されたアカウント名・Account IDが3章で確認した対象と一致することを確認します。違う場合はsecretを設定せず、正しいアカウントでログインし直してください。

未ログインなら次を実行し、ブラウザで対象Cloudflareアカウントを承認します。

```bash
pnpm --filter @kanjo/api exec wrangler login
```

### 7.2 AUTH_PASSWORDを作成・登録する

1. パスワードマネージャーで20文字以上のランダムパスワードを生成する。
2. 名前を`kanjo production AUTH_PASSWORD`として保存する。
3. 次を実行する。

```bash
pnpm --filter @kanjo/api exec wrangler secret put AUTH_PASSWORD
```

入力待ちになったらパスワードを貼り付けて確定します。GitHub secretや`.dev.vars`の値を流用しません。

この操作は本番Workerのsecretを直ちに更新します。既存の`AUTH_PASSWORD`を変更すると、それまでのログインパスワードは使えなくなります。

### 7.3 SESSION_SECRETを生成・登録する

次のコマンドは32バイトの乱数を64文字の16進数にし、画面へ表示せずWranglerへ渡します。

```bash
openssl rand -hex 32 | pnpm --filter @kanjo/api exec wrangler secret put SESSION_SECRET
```

`SESSION_SECRET`はログインセッションの署名に使います。`AUTH_PASSWORD`と同じ値にしないでください。

この操作は本番Workerのsecretを直ちに更新します。既存の`SESSION_SECRET`を変更すると、それまでのログインセッションは無効になります。

### 7.4 Worker secret名を確認する

```bash
pnpm --filter @kanjo/api exec wrangler secret list
```

次の2つが表示されることを確認します。

```text
AUTH_PASSWORD
SESSION_SECRET
```

secretの値が表示されないのは正常です。

## 8. Deployを再実行する

すべて登録できたら、失敗したDeployを再実行します。

1. 直近のDeploy runを確認する。

```bash
gh run list --workflow Deploy --limit 5
```

2. 失敗したrunのIDを指定して再実行する。

```bash
gh run rerun <run-id>
gh run watch <run-id> --exit-status
```

またはGitHubの`Actions > Deploy > Run workflow`から`main`を選んで実行します。作業ブランチを選ばないでください。

完了条件:

- `本番設定を検証`が成功する
- `Workerをデプロイ`が成功する
- 30秒後の1回目スモークテストが成功する
- さらに90秒後の2回目スモークテストが成功する
- Cloudflareのdeployment履歴へ新しいバージョンが追加される

```bash
pnpm --filter @kanjo/api exec wrangler deployments list
```

## 9. エラー別の確認先

| エラー・症状 | 確認すること |
|---|---|
| `CLOUDFLARE_API_TOKENが未登録` | GitHub `production` Environment secretの名前とスコープ |
| `CLOUDFLARE_ACCOUNT_IDが未登録` | GitHub `production` Environment secretの名前とスコープ |
| `APP_URLが未登録` | Repository Variableとして登録したか |
| `You installed workerd on another platform` | 2.1の`pnpm install --force --frozen-lockfile`を実行し、x64・arm64両方のネイティブ依存を入れ直す |
| Authentication error / code 10000 | tokenがactiveか、期限切れでないか、API Key方式と混同していないか |
| code 7003 / object identifier invalid | Account IDが`kanjo-console`所有アカウントのものか |
| D1 permission error | `Account > D1 > Edit`があるか |
| R2 permission error | `Account > Workers R2 Storage > Edit`があるか |
| R2画面に`kanjo-files`がない | 3.1の`whoami`と`r2 bucket list`でブラウザとCLIの接続先アカウントを照合する。本当にない場合だけ作成する |
| Worker upload permission error | `Account > Workers Scripts > Edit`があるか |
| required secret missing | Worker secretの`AUTH_PASSWORD` / `SESSION_SECRET`を登録したか |
| スモークテストで404 | `APP_URL`がpreviewや個別パスではなく固定のproduction URLか |
| tokenを紛失 | 値の再表示はできないため、新tokenを作成してGitHub secretを更新する |

失敗ログだけを確認する:

```bash
gh run view <run-id> --log-failed
```

tokenの値を確認するためにActionsログへ出力してはいけません。

## 10. Tokenの更新・漏えい時対応

通常の更新:

1. 4章と同じ権限で新tokenを作る。
2. `gh secret set CLOUDFLARE_API_TOKEN --env production`でGitHubを更新する。
3. Deployを手動実行し、2回のスモークテストまで成功させる。
4. Cloudflare Account API tokensで旧tokenを削除する。
5. token更新日と次回確認日を運用記録へ残す。token値は残さない。

漏えいが疑われる場合:

1. Cloudflareで該当tokenを即時無効化・削除する。
2. GitHub Actionsの実行を一時停止する。
3. Cloudflare Audit LogsとWorkers deployment履歴を確認する。
4. 新tokenを作りGitHub secretを更新する。
5. 不審なdeploymentがあれば正常バージョンへrollbackする。
6. tokenがcommitされた場合は、履歴修正より先にtokenを失効させる。

## 11. 最終チェックリスト

- [ ] `daishiman/kanjo`で作業している
- [ ] 現在のNode環境で`wrangler --version`が成功する
- [ ] Account IDは`kanjo-console`を所有するアカウントから取得した
- [ ] `kanjo-files`が同じアカウントに存在する
- [ ] `kanjo-files`の`r2.dev`公開は無効で、カスタムドメインもない
- [ ] Global API KeyではなくAPI Tokenを作った
- [ ] tokenのAccount Resourcesは対象1アカウントだけ
- [ ] Account Settings Readを付けた
- [ ] Workers Scripts Editを付けた
- [ ] D1 Editを付けた
- [ ] Workers R2 Storage Editを付けた
- [ ] 不要なKV・全Zone・全Account権限を外した
- [ ] `CLOUDFLARE_API_TOKEN`を`production` Environment secretへ登録した
- [ ] `CLOUDFLARE_ACCOUNT_ID`を`production` Environment secretへ登録した
- [ ] 固定のproduction URLを`APP_URL` Repository Variableへ登録した
- [ ] `production` Environmentは`main`だけを許可している
- [ ] Worker secretの`AUTH_PASSWORD`を登録した
- [ ] Worker secretの`SESSION_SECRET`を登録した
- [ ] Deployの設定検証が成功した
- [ ] Workerのデプロイが成功した
- [ ] 30秒後・90秒後のスモークテストが両方成功した
