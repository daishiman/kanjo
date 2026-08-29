# T3. 機能分解 — 確定申告の準備

## 最リスク仮説

> R2に実在する原本と対象年の事業支出を同じcanonical集合へ収束させれば、索引とZIPの不一致や無言欠損を防げる。

検証はSlice 0〜1のcore契約、API統合、実ZIP展開で行う。

| Slice | 内容 | 依存 | 検証 | 状態 |
|---|---|---|---|---|
| 0 境界 | exact `TaxYear`、年別`TaxAccountPolicy`、canonical `ReceiptInventory` | 既存period/attachments | core contract | 完了 |
| 1 縦切り | readiness、CSV、分割ZIP、R2完全性、backup/restore | 0027、既存R2 availability | API/DB/ZIP integration | 完了 |
| 2 体験 | `/tax`、`/tax/receipts`、例外駆動UI、mobile/a11y | Slice 1 API | DOM、keyboard相当、build | 完了 |
| 3 追加要望 | `ReceiptSourceProfile`、継承、override、曖昧候補 | 0028、ReceiptInventory target | user isolation/restore/UI test | 完了 |

背骨は `年選択 → 方針確認 → 証憑解消 → export`。migrationはexpandとしてコード公開より先に適用し、依存順を逆転させない。

却下した案:

- 月ごとの取得先コピー: 重複と更新漏れが増えるため不採用。
- merchant部分一致の自動継承: 誤紐付けを回復しにくいため不採用。
- D1添付metadataだけの件数: R2原本欠損を隠すため不採用。
- 1つの巨大ZIP/上限で切捨て: 失敗と欠損を区別できないため不採用。

## 変更ログ

| 日付 | 要望 | 判断 | 検証 |
|---|---|---|---|
| 2026-08-29 | 確定申告準備CSV/ZIPと証憑添付 | Slice 0〜2 | 全層テスト・preview smoke |
| 2026-08-29 | 取得先URL/アカウント/メモと翌月継承 | Slice 3 | scheme拒否、他ユーザー、月跨ぎ、override、表記揺れ、restore、DOM |
| 2026-08-29 | Slow 3Gの申告画面cold-loadと200%表示 | Slice 4 | TaxReturn直列chunk除去、110KiB初期JS budget、44px操作、zoom2 nav実描画 |
