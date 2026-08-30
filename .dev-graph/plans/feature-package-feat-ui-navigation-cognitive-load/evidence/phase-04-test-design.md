# P04 回帰・視覚テスト設計

- Task: `SYS-UINAV-P04` / Beads `kanjo-ay0.4`
- Dependency: P03 PASS

## TDDシナリオ

1. `/tax/receipts`を開いた利用者は「領収書の残り」だけを現在地として認識できる。
2. 17 routeのどれを選んでも、可視labelと重複しない意味的iconを同時に認識できる。
3. keyboard/screen reader利用者はcurrent pageとlink nameを取得でき、iconを重複読み上げしない。
4. 375/768/1280/1600pxと200%相当で、navの44px target、折返し、横scroll、主領域を維持できる。
5. drawerを開いた利用者はEscape/背景/遷移で閉じられ、reduced-motionでも操作できる。
6. 既存の編集利用者は対象・変更内容・保存・取消・未保存・保存結果を識別できる。

## RED（実装前に失敗させる）

- `navigation-ux.dom.test.tsx`
  - `/tax/receipts`の`[aria-current="page"]`が1件であること（変更前は2件でFAIL）。
  - `APP_ROUTES`全件に一意の`icon`があること（変更前は0件でFAIL）。
  - desktop/drawer/bottom tabにdecorative iconと可視labelがあること（変更前はiconなしでFAIL）。
  - CSS token、44px row、current indicator、focus/reduced-motion契約（変更前はtoken/44px/indicatorなしでFAIL）。

## GREEN/回帰

- Unit/DOM: `pnpm --filter @kanjo/web test`
- Type: `pnpm --filter @kanjo/web typecheck`
- Production build: `pnpm --filter @kanjo/web build`
- Workspace lint/test/buildの利用可能gateも実行する。
- 実ブラウザ: production相当previewで申告2画面・概況・公私仕分け・設定を操作する。
- 4幅 screenshotとDOM計測を匿名fixtureで記録する。
- 200%相当、Tab/Escape、reduced-motion、console errorを確認する。

## 編集面の回帰

- 既存の公私仕分け未保存guard/編集panel tests、税務保存状態tests、mobile card testsを全web suiteで再実行する。
- 新しいmodal/drawer編集を追加していないため、通常遷移を遮るoverlayの新規E2Eは不要。navigation drawerの開閉だけを対象にする。

## 判定

- P04 acceptance: PASS
- 高重大度の未解決: 0

