# MF事業判定 — 設計レビュー

規則の正本は `specs/spec-mf-business-classification.md`、領域別制約は `architecture/mf-business-*.md`。

## 採用した境界

- 判定 predicate は比較時 trim を行う `isMfBizByMid` の1つだけ。
- 優先順位は `resolveIncomingTx` と `resolveTx` に集約する。
- total-cashflow は predicate を直接呼ばず `resolveTx` に間接依存する。
- `ClassificationSource` / `ClassificationProgress` は core を型正本とする。
- API は既存 `/api/transactions`、wire key は `src`、集約は `bySource`。
- `vendor_memory` は由来であり、独立 source enum にしない。
- 要確認集合は4区分から除外し、件数と金額を一組で返す。

## 採用しない構成

画面ごとの判定、名称列挙、保存時 trim、web 側の再集計、新規分類 endpoint、DB migration は採用しない。

正式復旧は版の巻き戻し、MF中項目だけを止める操作は部分無効化として区別する。
