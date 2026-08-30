# P03 直感性・アクセシビリティ設計レビュー

- Task: `SYS-UINAV-P03` / Beads `kanjo-ay0.3`
- Dependency: P02 PASS

## Design Judgment

| Phase | 判断 |
|---|---|
| 業務構造 | 主役は「今いる画面」と「その画面の要対応」。sidebarは機能カタログでなく業務順を保つ |
| 主役と開示 | 現在地を1件だけ強くし、他項目は静かに保つ。詳細根拠は文脈内で開示する |
| 操作感 | 同じNavLinkは同じ遷移、押下直後に状態が変わり、drawerはEscape/背景/遷移で中断できる |
| 装飾除去 | 色を外してもindicator・border・太字・位置・labelで現在地が分かる |

## UX/a11yレビュー

- 認識優先: iconは探索を速め、labelは意味を確定する。どちらか一方へ依存しない。
- ヒックの法則: 17項目を業務4群へ分け、既存順を維持する。機能削除や深い多段menu化はしない。
- フィッツの法則: nav/bottom tabの操作領域を44px以上にする。
- 予測可能性: 全routeを完全一致に統一し、親子だけ例外の規則を作らない。
- 即応性: hover/pressed/currentを短いsurface/border変化で返し、layoutを動かさない。
- 可逆性: drawerは3経路で閉じる。編集は既存の保存/取消/未保存guardを保持する。
- keyboard: skip link、focus-visible、NavLink、button、Escapeを維持する。
- screen reader: nav landmark、可視link name、current page、装飾icon hiddenを成立させる。
- zoom/narrow: label途中改行とページ全体横scrollを避け、drawer/bottom tabへ切り替える。
- motion: 現れた位置を示すdrawer移動だけ。`prefers-reduced-motion`で停止しても意味が残る。
- forced/contrast: indicatorとborderを残し、色が失われてもcurrentを識別できる。

## 編集安全性レビュー

- 対象名: 公私仕分けのeditor heading、税務科目、予算科目、現金明細など対象近傍にある。
- 変更内容: label/fieldset/入力欄で識別できる。
- 保存/取消: 動詞labelで常時見える。保存中はdisabledと文言で二重送信を防ぐ。
- 未保存: 公私仕分けはroute/row/filter変更を共通guardで防ぐ。税務は未保存badgeを表示する。
- 結果: 保存中・成功・失敗を対象近傍へ表示する。
- 危険操作: 既存の確認・論理的な戻し操作を維持し、navigation改善から新しい破壊操作を増やさない。

全面的なside panel/dialog共通化は採用しない。既存inline editorは一覧の対象を見失わず、変更範囲も小さいため、このfeatureでは予測可能性と文脈保持に優れる。新規の短い文脈編集を追加する場合だけ将来の共通surface候補とする。

## 判定

- P03 acceptance: PASS
- WCAG/Apple的観点の高重大度未解決: 0

