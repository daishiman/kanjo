# P05 共通サイドバーと低認知負荷UIの実装

- Task: `SYS-UINAV-P05` / Beads `kanjo-ay0.5`
- Dependency: P04 PASS
- Source digest: `sha256:be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd`
- Write scope: task指定のWeb 5ファイルのみ。API、会計計算、データ、認証、インフラは不変。

## 実装結果

| 契約 | 実装 | 検証 |
|---|---|---|
| `/tax`と`/tax/receipts`のcurrent一意化 | 全`NavLink`をroute完全一致へ統一 | 両pathで`[aria-current="page"]`が各1件 |
| 17 routeのicon+可視label | `APP_ROUTES`へ型付き・一意icon key、`RouteIcon` registry、desktop/mobileでlabel併記 | 17 key一意、全linkのSVGは`aria-hidden`かつ`focusable=false` |
| Lucide等の実績あるstroke icon・自作glyph禁止 | `lucide-static v1.37.0`公式配布物の同名SVG geometryを固定利用。独自geometryはなく、ISC copyright/permission全文を`RouteIcon.tsx`に保持 | npm配布物17 SVGとの目視・source照合。外部runtime/package/lock変更なし |
| spacing/hit target | sidebar幅、44px行高、icon-label/group間隔をCSS token化 | DOM/CSS contractと既存mobile実描画test PASS |
| 色以外のcurrent cue | `aria-current`、太字、境界、左indicatorを併用 | current DOM/CSS contract PASS |
| 認知負荷 | 全pageの長い共通task文を1文の目的へ短縮。初期表示の主役・重要状態・主操作を保持 | 全17 route metadataと代表pageを監査 |
| 編集安全性 | 既存の公私仕分け・税務・予算・現金・設定が対象、変更項目、保存/取消、未保存、処理結果を満たすため構造を保持 | editor/tax/mobile/restore回帰をfull web suiteで確認 |

## 過剰変更をしなかった理由

既存編集面は作業対象の近くで変更し、保存状態と未保存guardを既に持つ。共通modalや新しい説明を全画面へ追加すると文脈を隠し、通常遷移を遮り、認知負荷を増やすため適用しなかった。今回の共通化はroute metadata、current判定、icon、spacingへ限定した。

## Privacy / security

- `data/`、口座明細、実金額、`.dev.vars`、secretを読まず、証跡にも含めていない。
- SVGは固定geometryだけで、外部入力やHTML挿入を受けない。
- 新しい通信、API、保存、認証、外部runtimeは追加していない。

## 判定

- P05 acceptance: PASS
- 高重大度の未解決: 0
- Rollback: 上記Web 5ファイルだけを直前版へ戻せば既存route/data契約へ復帰できる。
