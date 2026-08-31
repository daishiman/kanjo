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

このアプリのローカル認証にユーザー名はありません。テスト用identityは
`default`というlocalhost専用セッションで、ログイン画面に入力するのは手元で
作ったパスワードだけです。

1. 初回はignore対象の設定を作る。

   ```sh
   test -f packages/api/.dev.vars || cp packages/api/.dev.vars.example packages/api/.dev.vars
   ```

2. `packages/api/.dev.vars` の `AUTH_PASSWORD` にパスワードマネージャーで作った
   localhost専用の値、`SESSION_SECRET` に次で作った値を入れる。

   ```sh
   openssl rand -hex 32
   ```

3. `ACCESS_AUD` と `ACCESS_TEAM_DOMAIN` は空のままにする。値はチャット、
   画面キャプチャ、tracked fileのどこにも貼らない。

ログイン情報は次の通りです。

| 項目 | ローカルテスト値 |
|---|---|
| URL | `http://localhost:8787/` |
| ユーザー名 | なし |
| identity | `default` (localhost専用、画面入力不要) |
| パスワード | 手元の `packages/api/.dev.vars` に設定した `AUTH_PASSWORD` |

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

## 4. 匿名テストデータを投入

起動したterminalはそのままにし、別のterminalで次を実行します。

```sh
set -a
source packages/api/.dev.vars
set +a
node scripts/seed-local.mjs
unset AUTH_PASSWORD SESSION_SECRET
```

値をcommand lineに埋め込まず、ignore済み設定から現在のshellへだけ読みます。
shellの実行トレース (`set -x`) は無効にしてください。このscriptは固定seedから
`samples/sample-mf-2025.csv`等の架空明細だけを生成し、同じlocalhost専用
identityに取り込みます。再実行時も同じ内容に収束します。

8787以外で起動した場合だけ、読み込み前に次を追加します。

```sh
export KANJO_BASE_URL=http://localhost:<terminalに表示されたport>
```

## 5. ログイン

Chromeでlocalhost URLを開き、「収支統合管理」のログイン画面に
`packages/api/.dev.vars` の `AUTH_PASSWORD` を入力します。ユーザー名は入力
しません。ログイン後、ホームに架空の金額が表示されれば準備完了です。

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

`preview:smoke` は一時D1/R2、一時的な架空パスワードとセッション、架空現金明細と
1px PNGだけを使い、migration、SPA、未認証ガード、ログイン、登録、添付、取得、
削除を確認して自動停止します。一時的な認証値は表示も保存もしません。

## 10. トラブルシュート

| 症状 | 確認すること |
|---|---|
| `auth_not_configured` | `packages/api/.dev.vars` に `SESSION_SECRET` があるか確認し、previewを再起動する |
| パスワードが違う | 入力値と手元の `AUTH_PASSWORD` が同じか確認する。失敗を繰り返さない |
| seedが401 | `source packages/api/.dev.vars` 後に実行したか、`KANJO_BASE_URL` のportが正しいか確認する |
| 金額が空 | seed commandの「取込」がすべて成功したか確認し、ページをreloadする |
| グラフが白い | hard reload後も続く場合はrender testを実行し、canvasの大きさとbitmapのFAILを確認する |
| 画面全体が横に動く | 発生route、viewport、zoom、横溢れした要素のDevTools screenshotを記録する |

## 11. 安全な終了

`pnpm run preview` を起動したterminalで `Ctrl-C` を1回押します。別のterminalから
`curl http://localhost:8787/` が接続できないことを確認します。`preview:smoke`は
完了時に自身の一時serverと一時D1/R2を自動で終了・削除します。

この手順では本番deploy、remote D1/R2、Gitのcommit/push/PR、Beadsの状態変更を
行いません。
