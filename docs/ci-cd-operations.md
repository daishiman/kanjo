# CI/CD・本番運用ガイド

この文書は、収支統合管理システムをGitHub ActionsからCloudflare Workersへ安全に公開するための設定と運用手順をまとめたものです。認証情報の値は記載せず、GitHubとCloudflareの保護された領域にだけ登録します。

## 1. 全体フロー

```text
通常の変更
  作業ブランチ → PR → CI: verify → squash merge
                                      ↓
                                mainのCI成功
                                      ↓
                                   Deploy
                                      ↓
                         30秒後確認 → 90秒後確認

DB構造を変える変更
  migrationだけのPR → main → Migrateを手動実行(APPLY)
                                ↓
                         アプリ側のPRをmerge
                                ↓
                              Deploy
```

重要な原則は次の3点です。

1. `main`へ直接pushせず、必ずPRとCIを経由する。
2. D1の構造変更は自動デプロイに混ぜず、`Migrate`を先に手動実行する。
3. Cloudflareへの公開はGitHub Actionsへ一本化し、Cloudflare Workers BuildsのGit連携を併用しない。

## 2. ワークフロー構成

| ワークフロー | ファイル | 起動条件 | 主な処理 | 外部への影響 |
|---|---|---|---|---|
| CI | `.github/workflows/ci.yml` | PR、`main`へのpush、手動 | 依存導入、Env型生成、lint、型検査、テスト、依存監査 | なし |
| Deploy | `.github/workflows/deploy.yml` | `main`のCI成功後、または手動 | Webビルド、Worker公開、2回のスモークテスト | 本番アプリを更新 |
| Migrate | `.github/workflows/migrate.yml` | `APPLY`入力付きの手動実行のみ | D1 Time Travel情報確認、リモートmigration適用 | 本番DBの構造を更新 |

共通設定:

- ランナー: `ubuntu-latest`
- アプリのNode.js: 22
- GitHub公式Actions: Node.js 24対応版
- CIタイムアウト: 10分
- Deploy / Migrateタイムアウト: 20分
- 権限: `contents: read`のみ
- `concurrency`で重複実行を制御
- 依存監査のhigh以上はログへ警告するが、上流修正待ちで全開発を止めない

`verify`はCIワークフロー内のジョブ名であり、`main`の必須ステータスチェック名でもあります。

## 3. GitHubの設定

### 3.1 Production Environment

GitHubの `Settings > Environments` に `production` を作成し、Deployment branchesを`main`だけに制限します。PRブランチや任意の作業ブランチから本番Environmentは使用できません。

期待する状態:

| 項目 | 値 |
|---|---|
| Environment名 | `production` |
| 許可ブランチ | `main`のみ |
| Environment secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Repository variable | `APP_URL` |

設定確認:

```bash
gh secret list --env production
gh variable list
gh api repos/{owner}/{repo}/environments/production/deployment-branch-policies \
  --jq '{branches:[.branch_policies[].name]}'
```

### 3.2 mainのブランチ保護

`main`には次の保護を設定します。

| 項目 | 値 | 理由 |
|---|---|---|
| 必須チェック | `verify` | CIに失敗した変更を止める |
| 最新mainでの再検証 | 有効（strict） | 古い結果のままmergeしない |
| 管理者にも適用 | 有効 | CIの迂回を防ぐ |
| 承認レビュー数 | 0 | 個人開発のため自己承認を要求しない |

設定確認:

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --jq '{strict:.required_status_checks.strict,contexts:.required_status_checks.contexts,enforce_admins:.enforce_admins.enabled,review_rules:.required_pull_request_reviews}'
```

## 4. 初回設定（リポジトリ所有者が実行）

### 4.1 GitHub ActionsからCloudflareへ接続する値

APIトークンなどの認証情報は、リポジトリ所有者本人が登録します。チャット、Issue、PR本文、コミット、Actionsログには貼り付けません。

```bash
gh secret set CLOUDFLARE_API_TOKEN --env production
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
gh variable set APP_URL --body "https://本番URL"
```

Cloudflare APIトークンは対象アカウント1つに限定し、必要な権限だけを付与します。

| 権限 | 用途 |
|---|---|
| Workers Scripts: Edit | Workerのデプロイ |
| D1: Edit | `Migrate`によるmigration適用 |
| Workers R2 Storage: Edit | R2を使う処理 |

`APP_URL`は公開URLなのでGitHub Variable、APIトークンとAccount IDは`production` Environment secretsとして扱います。

### 4.2 Workerが実行時に使う秘密値

次の値はGitHub Actions用の認証情報とは別物です。Cloudflare Workerのsecretとして登録します。

```bash
pnpm --filter @kanjo/api exec wrangler secret put AUTH_PASSWORD
pnpm --filter @kanjo/api exec wrangler secret put SESSION_SECRET
```

ローカル開発では`packages/api/.dev.vars`を使います。このファイルをgit操作に含めたり、`.gitignore`を強制追加で回避したりしてはいけません。

### 4.3 二重デプロイを防ぐ

Cloudflareダッシュボードで、このWorkerに対するWorkers BuildsのGit連携が無効であることを確認します。GitHub ActionsとCloudflare Buildsを同時に有効にすると、同じ変更で2回デプロイされ、どちらが本番か判断できなくなります。

## 5. 通常リリース

1. `main`から作業ブランチを作る。
2. 変更をcommitし、`main`向けPRを作る。
3. PRの`verify`が成功するまでmergeしない。
4. PRをsquash mergeする。
5. `main`のCI成功後に`Deploy`が自動起動したことを確認する。
6. 30秒後と、さらに90秒後のスモークテストが両方成功したことを確認する。
7. 必要なリリースでは、本番確認後にタグを付ける。

確認コマンド:

```bash
gh pr checks <PR番号>
gh run list --workflow CI --limit 5
gh run list --workflow Deploy --limit 5
gh run watch <run-id> --exit-status
pnpm --filter @kanjo/api exec wrangler deployments list
```

`Deploy`の手動実行は、同じ`main`コミットの再実行や緊急復旧に限定します。手動実行前にも、そのコミットのCI成功を確認してください。

## 6. D1の構造を変えるリリース

### 6.1 列・テーブルを追加する場合（expand）

1. 前方互換なmigrationだけのPRをmergeする。
2. GitHub Actionsの`Migrate`を開く。
3. 対象ブランチが`main`であることを確認する。
4. 確認欄へ`APPLY`と入力して実行する。
5. Time Travel情報確認とmigration適用が成功したことを確認する。
6. 新しいDB構造を使うアプリ側のPRをmergeする。
7. 自動デプロイと本番スモークテストを確認する。

CLIから起動する場合:

```bash
gh workflow run Migrate --ref main -f confirm=APPLY
```

### 6.2 列を削除する場合（contract）

削除は1回のリリースで行いません。

1. 旧列を参照しないコードを先にデプロイする。
2. 本番ログと主要操作を確認し、旧列が不要になったことを確認する。
3. 削除migrationを別PRで追加する。
4. 明示的な承認後に`Migrate`を実行する。

`DROP TABLE`、本番D1の手動`UPDATE` / `DELETE`、Time Travel restoreは、必ず対象と影響を確認してから実行します。

## 7. スモークテスト

`.github/scripts/smoke.sh`は次を確認します。

- 本番URLの`/`がHTTP 200で取得できる
- HTMLに`<title>収支統合管理</title>`がある
- 未認証の`/api/not-found`がHTTP 401を返す

手元での確認:

```bash
APP_URL="https://本番URL" pnpm run smoke
```

Cloudflare Workersは公開直後に旧実行環境が残る場合があるため、ワークフローでは30秒後と、その90秒後の2回確認します。どちらかが失敗した場合、デプロイは成功扱いにしません。

## 8. デプロイが起動しないとき

次の順で確認します。

1. PRのbaseが`main`だったか。
2. 対象commitが本当に`origin/main`へ入っているか。
3. `main`へのpushで`CI`が起動し、成功したか。
4. `Deploy`ワークフローがdefault branchの`main`に存在するか。
5. `workflow_run`の対象名が`CI`と一致しているか。
6. `production` Environmentが`main`を許可しているか。
7. 必要なsecretと`APP_URL`が登録されているか。

```bash
git fetch origin
git log origin/main --oneline -5
git branch -r --contains <commit>
gh run list --limit 10
gh run view <run-id> --log-failed
gh secret list --env production
gh variable list
```

この構成では、PR上のCI成功からはデプロイしません。`main`へのpushとして実行されたCIが成功した場合だけ、自動デプロイします。

## 9. 失敗時の切り分け

| 症状 | 主な確認先 |
|---|---|
| CIが失敗 | frozen lockfile、Env型生成、Linuxでの大文字小文字、未commitファイルへの依存 |
| Deployが認証エラー | Environment secret名、APIトークン期限、Workers/D1/R2権限 |
| Deployは成功したが画面が古い | 30秒・90秒後の結果、対象deployment、`APP_URL` |
| 本番でDBエラー | migrationがコードより先に適用されたか |
| スモークテスト失敗 | `/`の200、title、未認証APIの401、本番ログ |

```bash
gh run view <run-id> --log-failed
pnpm --filter @kanjo/api exec wrangler deployments list
pnpm --filter @kanjo/api exec wrangler tail kanjo-console
```

Actionsログにsecretの値を出して調査してはいけません。

## 10. ロールバックと復旧

### 10.1 アプリだけを戻す

まずdeployment履歴を確認し、人が戻すバージョンを決めます。

```bash
pnpm --filter @kanjo/api exec wrangler deployments list
pnpm --filter @kanjo/api exec wrangler rollback <version-id>
```

緊急rollback後は、該当PRのsquash commitを`git revert`した修正PRを作り、リポジトリと本番の状態を再び一致させます。`git reset --hard`やforce pushは使用しません。

### 10.2 D1を戻す

アプリのrollbackではD1は戻りません。Time Travelの復元可能範囲とbookmarkを確認し、影響範囲について承認を得てからrestoreします。

```bash
pnpm --filter @kanjo/api exec wrangler d1 time-travel info kanjo-db
pnpm --filter @kanjo/api exec wrangler d1 time-travel restore kanjo-db --bookmark="<bookmark>"
```

本番D1のrestore、手動`UPDATE` / `DELETE`、リソース削除は通常運用に含めず、実行前に必ず対象と影響を確認します。

## 11. 導入・変更時チェックリスト

- [ ] CIを意図的に1回失敗させ、`verify`が赤くなってmergeを止めることを確認した
- [ ] 正常化後の`verify`が成功した
- [ ] `main`の必須チェックが`verify`で、strictと管理者適用が有効
- [ ] `production` Environmentが`main`だけを許可している
- [ ] Cloudflare APIトークンを最小権限・単一アカウントに限定した
- [ ] GitHub secretsと`APP_URL`をリポジトリ所有者本人が登録した
- [ ] Worker secretsの`AUTH_PASSWORD` / `SESSION_SECRET`を登録した
- [ ] Cloudflare Workers BuildsのGit連携を無効にした
- [ ] D1 migrationが手動実行で、コードデプロイより先に適用される
- [ ] 30秒後・90秒後のスモークテストが両方成功する
- [ ] `wrangler deployments list`で公開履歴を確認できる
- [ ] アプリrollbackとD1 Time Travelの判断手順を確認した

## 12. 関連ファイル

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/migrate.yml`
- `.github/scripts/smoke.sh`
- `packages/api/wrangler.jsonc`
- `migrations/`
