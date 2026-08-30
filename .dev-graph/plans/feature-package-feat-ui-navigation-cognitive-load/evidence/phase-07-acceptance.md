# P07 受入条件と主要導線の確認 — 停止

- Task: `SYS-UINAV-P07` / Beads `kanjo-ay0.7`
- Dependency: P06 PASS
- Result: **STOP / browser runtime unavailable**

## 停止理由

適用必須のbrowser control skillが指定する`mcp__node_repl__js`とtool discoveryが、このsessionには露出していない。skillは外部Chrome MCPやstandalone Playwright等への代替を禁止しているため、実ブラウザで申告2画面と代表pageを操作・撮影したと虚偽報告しない。

## 完了済みの代替範囲（P07のPASS代替ではない）

- `http://localhost:8787/` はWorkers runtimeで200、未認証`/api/auth/me`は401。
- turn内だけで共有するローカル用パスワードでlogin/meは200。隔離D1へ匿名テストデータを登録し、一覧と月次集計を確認。
- DOM contractで`/tax`と`/tax/receipts`のcurrent各1件、17 icon/label、decorative SVG、drawer Escapeを確認。
- web全47 files / 273 testsの逐次実行、production build、workspace typecheck/lintはPASS。
- screenshotは未作成。実ブラウザ視認・click・scroll・focus順の受入は未実行。

## Browser runtimeが利用可能になった後の再現手順

1. `http://localhost:8787/login`を開き、このturn内で共有されたローカル用パスワードでログインする（メールアカウントはない）。パスワードは証跡へ転記しない。
2. `/tax`を開き、sidebarの「確定申告の準備」だけがcurrentで、icon・文字・左indicator・境界が見えることを確認する。
3. 「領収書の残り」へ移動し、「領収書の残り」だけがcurrent、「確定申告の準備」は通常状態へ戻ることを確認する。
4. ページ内の「確定申告の準備へ戻る」で戻り先が予測どおりか確認する。
5. `/`、`/classify`、`/settings`へsidebarで移動し、各pageでcurrentが1件、目的・重要状態・主操作の順に読めることを確認する。
6. 公私仕分けで匿名明細を1件開き、編集対象、変更項目、保存、閉じる、未保存表示を確認する。値を変えたまま別行または別pageへ移り、確認を取消して編集内容が保持されることを確認する。
7. 変更を保存する場合は匿名ローカルデータだけを使い、保存中→保存完了または失敗表示を確認する。

## 判定

- P07 acceptance: 未充足（実ブラウザ操作が未実行）
- 高重大度の製品finding: 0
- 実行環境blocker: 1
- 後続P08〜P13: P07未完のため正式実行しない。
