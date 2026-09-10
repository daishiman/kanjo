---
status: confirmed
category: ui-ux
aggregate: 確定
spec_cells: [ui-ux.web, ui-ux.mobile, ui-ux.tablet, ui-ux.desktop-windows, ui-ux.desktop-linux, ui-ux.desktop-macos]
serves_goals: [G2, G5]
---

# UI-UX

MF 事業判定の表示契約は `specs/spec-mf-business-classification.md`。本章は情報の意味だけを記録する。

- 明細では `cls` と `src` を対で示す。
- `src=中項目` は自動判定済みであり、`reviewPending` へ含めない。
- 進捗内訳は `bySource` を表示し、画面で分類元を推測しない。
- 要確認は4区分の合計に混ぜず、件数と金額を一組で示す。
- 要確認 MF 投影にも `cls` / `clsSrc` を含め、公私仕分けと同じ根拠を示す。
- `vendor_memory` は独立した表示値にせず、materialize 後は `手動` と示し、由来は `origin` で保持する。

新しい画面や操作体系は追加せず、既存二画面の意味を揃える。
