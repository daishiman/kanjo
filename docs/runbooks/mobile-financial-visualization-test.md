# モバイル財務グラフのローカル画面テスト

この手順は、本番のアカウントや実際の金融データを使わず、Workersと同じ
ランタイムのlocalhostで、モバイル向けグラフを目視確認するためのものです。

## 1. 前提

- Node.js 22系とpnpm 10系を使う。
- リポジトリ直下で `pnpm install` が完了している。
- Chromeを使う。自動検査の基準パスは
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` である。
- `data/`、実際のCSV/Excel、本番のログイン情報は使わない。

## 2. ローカル専用identityの用意

このアプリのローカル認証はメールアドレスとパスワードです。業務データの
`default`は共有tenantキーであり、ログイン主体ではありません。

1. 初回はignore対象の設定を作る。

   ```sh
   test -f packages/api/.dev.vars || cp packages/api/.dev.vars.example packages/api/.dev.vars
   ```

2. `packages/api/.dev.vars` の `BETTER_AUTH_SECRET` に次で作った値を入れる。

   ```sh
   openssl rand -hex 32
   ```

3. `ACCESS_AUD` と `ACCESS_TEAM_DOMAIN` は空のままにする。値はチャット、
   画面キャプチャ、tracked fileのどこにも貼らない。

ローカルidentityは、preview起動後に招待から本人登録します。

| 項目 | ローカルテスト値 |
|---|---|
| URL | `http://localhost:8787/` |
| メールアドレス | `admin@kanjo.local` |
| パスワード | 招待承諾画面で自分が決めた値 |

`packages/api/.dev.vars` はGitのignore対象です。読み上げや画面共有をせず、
このマシンだけで使います。

## 3. Workers previewを起動

リポジトリ直下で次を実行します。

```sh
pnpm run preview
```

このcommandはローカルD1 migration、web build、`wrangler dev --local`を順に
実行します。terminalに `http://localhost:8787` が表示されるまで待ちます。
8787が他のprocessで使われている場合は、Wranglerが表示した実際のURLを以後の
`localhost URL`とします。

別のterminalで起動を確認できます。ログイン前のAPIが401なのは正常です。

```sh
curl -sS -o /dev/null -w 'SPA %{http_code}\n' http://localhost:8787/
curl -sS -o /dev/null -w 'auth %{http_code}\n' http://localhost:8787/api/auth/me
```

期待値は `SPA 200`、`auth 401`です。

## 4. ローカル招待を承諾し、匿名テストデータを投入

起動したterminalはそのままにし、別のterminalでローカル専用の招待を作ります。
このscriptは初期パスワードや利用者行を作らず、D1にハッシュ済みの招待tokenだけを保存します。
管理者はTOTPを通すまでセッションが出ないため、データ投入には member の招待を別に作ります。

```sh
node scripts/seed-admin.mjs
node scripts/seed-admin.mjs --email member@kanjo.local --role member
```

表示されたlocalhostの承諾URLをそれぞれChromeで開き、自分で決めたパスワードを登録します。
管理者は続けてTOTPを設定し、復旧コードはこのローカル検証の安全な保管場所にだけ保存します。

登録した member のidentityで匿名データを取り込みます。パスワードは非表示で読み、argvや履歴へ入れません。

```sh
export KANJO_SEED_EMAIL=member@kanjo.local
read -rs 'KANJO_SEED_PASSWORD?Local password: '
export KANJO_SEED_PASSWORD
node scripts/seed-local.mjs
unset KANJO_SEED_EMAIL KANJO_SEED_PASSWORD
```

shellの実行トレース (`set -x`) は無効にしてください。`seed-local.mjs`は固定seedから
`samples/sample-mf-2025.csv`等の架空明細だけを生成し、招待承諾済みのlocalhost専用
identityでBetter Authへログインして取り込みます。再実行時も同じ内容に収束します。

8787以外で起動した場合だけ、読み込み前に次を追加します。

```sh
export KANJO_BASE_URL=http://localhost:<terminalに表示されたport>
```

APIと画面を別portで起動した場合 (Viteのproxy経由など) は、`BETTER_AUTH_URL` と同じ
画面側のoriginを `KANJO_SEED_ORIGIN` に渡します。未指定なら `KANJO_BASE_URL` のoriginを使います。

## 5. ログイン

Chromeでlocalhost URLを開き、`admin@kanjo.local` と招待承諾時に自分が決めたパスワードで
ログインします。TOTPを求められたら登録済みのコードを入力します。ホームに架空の金額が表示されれば準備完了です。

## 6. モバイル画面の確認

Chrome DevToolsのDevice toolbarを開き、高さを812px程度にして幅を
360、375、390pxの順に変えます。各幅で次のURLを確認します。

- `/` — ホームの収支と防衛ライン
- `/analysis/trends` — 推移と優先順位
- `/analysis/matrix` — 収支マトリクス
- `/subscriptions` — サブスク別の金額関係
- `/household` — 家計の推移
- `/statements` — 月次計算書

各グラフで、次の7つの意味情報が画面から消えていないことを確認します。

1. 何のグラフか分かる見出し
2. 先に読める結論
3. 対象期間
4. 単位
5. 系列の名前
6. 次に行う操作
7. 「正確な数値を表で確認」から開ける表

さらに次を確認します。

- グラフが高さ0pxや白紙にならず、縦・横の関係が読める。
- 画面全体は横スクロールしない。広い正確表だけが名前付き領域の中で横に
  動くのは正常。
- グラフ自体を触らなくても、結論、系列リスト、正確表で同じ意味を読める。
- 「正確な数値を表で確認」と次の行動ボタンが、指で押しやすい44px以上に
  見える。
- Tabキーで表と次の行動へ進み、現在地を示すfocus ringが見える。
- OSの「視差効果を減らす」をONにしても、図と操作の意味が変わらない。

`/subscriptions` では、モバイルのグラフとその下の系列リストが同じ
「金額の大きい上位6件 + 他N件」を示すこと、正確表にはまとめ前のすべての
サブスクが残ることを確認します。

## 7. タブレット、デスクトップ、200% reflow

同じシナリオを768、1280、1600pxで確認します。広い画面ではより多くの
比較情報が同時に見えても、モバイルと結論や金額が矛盾してはいけません。

Chromeを幅320pxにし、または幅640pxを200%表示にして、次を確認します。

- 結論、期間、単位、系列、表、次の行動が残る。
- 最下部の操作はタブバーやsafe areaに隠れない。
- 画面全体に横溢れが出ない。

## 8. AIレポートの補足

ローカルseedは外部AIを実行しないため、`/ai` にレポートがなければ空状態が
正常です。匿名AIレポート内の財務グラフは、次の自動検査が実React routeと
Chart.js canvasへfixtureを供給して360/375/390/1280pxを検査します。

```sh
pnpm --filter @kanjo/web exec vitest run --project render \
  src/mobile-financial-visualization-render.test.ts
```

## 9. 固定した自動検査

画面テスト前後に次を実行できます。

```sh
pnpm run preview:smoke
pnpm --filter @kanjo/web test
pnpm --filter @kanjo/web build
node packages/web/scripts/check-mobile-financial-layout.mjs
```

`preview:smoke` は一時D1/R2、一時的な合成招待・架空パスワード・セッション、架空現金明細だけを
使います。migration、SPA、未認証ガード、招待承諾、Better Authログイン、現金明細の作成→一覧→削除→空一覧と、
廃止済み添付・税申告APIがJSON 404を返すことを確認して自動停止します。証憑の登録・取得・削除は
行いません。一時的な認証値は表示せず、完了時に一時保管先ごと削除します。

## 10. トラブルシュート

| 症状 | 確認すること |
|---|---|
| `auth_not_configured` | `packages/api/.dev.vars` に `BETTER_AUTH_SECRET` があるか確認し、previewを再起動する |
| 招待が利用できない | `node scripts/seed-admin.mjs` を再実行し、最後に表示されたlocalhost URLを開く |
| パスワードが違う | 招待承諾時に自分が決めた値を非表示入力し、失敗を繰り返さない |
| seedが401 | `KANJO_SEED_EMAIL` / `KANJO_SEED_PASSWORD` と `KANJO_BASE_URL` のportを確認する |
| seedが403 (`MISSING_OR_NULL_ORIGIN` 等) | `KANJO_SEED_ORIGIN` を `BETTER_AUTH_URL` と同じoriginにする |
| seedが「TOTPを通すまで」で止まる | `KANJO_SEED_EMAIL` を admin ではなく member の identity にする |
| 金額が空 | seed commandの「取込」がすべて成功したか確認し、ページをreloadする |
| グラフが白い | hard reload後も続く場合はrender testを実行し、canvasの大きさとbitmapのFAILを確認する |
| 画面全体が横に動く | 発生route、viewport、zoom、横溢れした要素のDevTools screenshotを記録する |

## 11. 安全な終了

`pnpm run preview` を起動したterminalで `Ctrl-C` を1回押します。別のterminalから
`curl http://localhost:8787/` が接続できないことを確認します。`preview:smoke`は
完了時に自身の一時serverと一時D1/R2を自動で終了・削除します。

この手順では本番deploy、remote D1/R2、Gitのcommit/push/PR、Beadsの状態変更を
行いません。
