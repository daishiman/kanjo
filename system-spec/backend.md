---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G3, G4]
---

# バックエンド

MF 事業判定の規範は `specs/spec-mf-business-classification.md`。本章は依存方向の決定だけを記録する。

- `isMfBizByMid` が比較時 trim と接頭辞比較の唯一の述語。
- `resolveIncomingTx` / `resolveTx` が優先順位の唯一の解決経路。
- `total-cashflow.ts` は `resolveTx` を介して間接依存し、中項目を直接比較しない。
- 解決結果は月ループの外で一度作り、集計で再利用する。
- core の `ClassificationSource` と `ClassificationProgress` を型の正本にし、web は同じ型を利用する。
- 要確認 MF 投影は `cls` と `clsSrc` を保持し、公私仕分けと同じ判断根拠を示す。

集計側の再判定、画面側の再分類、重複した enum 宣言は採用しない。
