# MF事業判定 — 実行構造

task-graph.json の現行投影: **13 nodes / 12 edges / 1 root**。P01 から P13 まで一方向に接続する。

| 状態 | ID | 固有成果 | 依存 |
|---|---|---|---|
| pending | SYS-MFBIZ-P01 | 匿名 fixture による要件ベースライン確定 | — |
| pending | SYS-MFBIZ-P02 | 判定境界のアーキテクチャ決定 | SYS-MFBIZ-P01 |
| pending | SYS-MFBIZ-P03 | 設計レビュー | SYS-MFBIZ-P02 |
| pending | SYS-MFBIZ-P04 | 契約テスト先行 | SYS-MFBIZ-P03 |
| pending | SYS-MFBIZ-P05 | 最小実装 | SYS-MFBIZ-P04 |
| pending | SYS-MFBIZ-P06 | テスト実行記録 | SYS-MFBIZ-P05 |
| pending | SYS-MFBIZ-P07 | 匿名 fixture による受入検証 | SYS-MFBIZ-P06 |
| pending | SYS-MFBIZ-P08 | 重複判定のリファクタリング | SYS-MFBIZ-P07 |
| pending | SYS-MFBIZ-P09 | 品質保証レビュー | SYS-MFBIZ-P08 |
| pending | SYS-MFBIZ-P10 | 最終レビュー | SYS-MFBIZ-P09 |
| pending | SYS-MFBIZ-P11 | 証跡索引 | SYS-MFBIZ-P10 |
| pending | SYS-MFBIZ-P12 | 利用者・運用文書同期 | SYS-MFBIZ-P11 |
| pending | SYS-MFBIZ-P13 | クローズアウト | SYS-MFBIZ-P12 |

契約は `specs/spec-mf-business-classification.md`、共通運用は `docs/mf-business-classification/runbook.md`、状態・資源・lineageはtask frontmatterを正本とする。
