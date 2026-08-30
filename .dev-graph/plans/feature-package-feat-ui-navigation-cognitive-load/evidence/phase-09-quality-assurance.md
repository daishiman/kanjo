# P09 品質保証 — 停止

- Task: `SYS-UINAV-P09` / Beads `kanjo-ay0.9`
- Dependency: P08（P07未完のため未着手）
- Result: **STOP / dependency unmet and browser runtime unavailable**

## 自動検証済みの範囲（P09のPASS代替ではない）

- CSS contract: sidebar row 44px、bottom tab 64px、icon/label/group token、currentの非色依存indicator、`prefers-reduced-motion`規則。
- DOM: 17 routeの可視labelと装飾icon、current一意、mobile drawer Escape。
- 既存実描画回帰: mobile layoutとsticky table header testsはPASS。
- keyboard/reduced-motionのsource contractはPASS。

## 未実行

- 指定browser runtimeで375 / 768 / 1280 / 1600pxの実画面視認とscreenshot。
- 200%相当での横overflow、文字切れ、focus visibilityの目視。
- 全操作をTab/Shift+Tab/Enter/Escapeで通すkeyboard walk-through。
- reduced-motionをOS/browserで有効化した実操作。
- 実ブラウザconsole error監査。

## 再現手順

各幅でP07の手順2〜6を行い、`document.documentElement.scrollWidth <= document.documentElement.clientWidth`（bottom tab自身の横scrollは許可）、nav hit target 44px以上、current 1件を確認する。200%相当はdesktop幅を半分のCSS viewportとして再確認する。最後に`prefers-reduced-motion: reduce`でdrawerの開閉とEscapeを確認する。

## 判定

- P09 acceptance: 未充足
- 高重大度の製品finding: 0
- 実行環境blocker: 1

