---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G3, G5]
---

# データベース

MF 事業判定の規範は `specs/spec-mf-business-classification.md`。本章は保存境界だけを記録する。

- MF 中項目は取込原本のまま保存し、trim は比較時だけ行う。
- 自動分類結果と月次集計は保存せず要求時に導出する。
- 利用者判断と取引先メモリ由来の既存編集は既存の保存構造を利用する。
- DB migration、backfill、既存通常手動編集の再評価は行わない。

したがって版の巻き戻しにデータ復元は不要であり、schema の変更も発生しない。
