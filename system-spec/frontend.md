---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G2, G5]
---

# フロントエンド

MF 事業判定の wire 契約は `specs/spec-mf-business-classification.md`。本章は表示境界だけを記録する。

- 明細 route は `GET /api/transactions`。
- 明細の wire key は `src`、進捗内訳は `summary.progress.bySource`。
- core 内部名 `clsSrc` を公開 key として扱わない。
- core の `ClassificationSource` / `ClassificationProgress` を web で共有し、enum を重複宣言しない。
- `reviewCount` と `reviewAmount` は API の導出値をそのまま表示し、画面で再集計しない。
- materialize 済み取引先メモリの wire `src` は `手動`。`vendor_memory` を enum に追加せず、由来は `origin` で保持する。

`中項目` enum の追加と `reviewPending` の意味変化は意図した互換性変更。新規 route、画面、状態管理方式は追加しない。
