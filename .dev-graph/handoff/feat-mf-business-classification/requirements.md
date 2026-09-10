# MF事業判定 — requirements handoff

契約正本は `specs/spec-mf-business-classification.md`。実行計画は匿名 task metadata から導出し、実入力や個別値を含めない。

## 現行意味

- 未判断候補は4区分外へ隔離し、`reviewCount` / `reviewAmount` で管理する。
- `same` は freee 正本を維持して総額不変。
- `different` は独立残余 MF として `resolveTx` の区分へ加算する。
- wire は `/api/transactions`、`src`、`summary.progress.bySource`。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-MFBIZ-P01 | 匿名 fixture による要件ベースライン確定 | — |
| SYS-MFBIZ-P02 | 判定境界のアーキテクチャ決定 | SYS-MFBIZ-P01 |
| SYS-MFBIZ-P03 | 設計レビュー | SYS-MFBIZ-P02 |
| SYS-MFBIZ-P04 | 契約テスト先行 | SYS-MFBIZ-P03 |
| SYS-MFBIZ-P05 | 最小実装 | SYS-MFBIZ-P04 |
| SYS-MFBIZ-P06 | テスト実行記録 | SYS-MFBIZ-P05 |
| SYS-MFBIZ-P07 | 匿名 fixture による受入検証 | SYS-MFBIZ-P06 |
| SYS-MFBIZ-P08 | 重複判定のリファクタリング | SYS-MFBIZ-P07 |
| SYS-MFBIZ-P09 | 品質保証レビュー | SYS-MFBIZ-P08 |
| SYS-MFBIZ-P10 | 最終レビュー | SYS-MFBIZ-P09 |
| SYS-MFBIZ-P11 | 証跡索引 | SYS-MFBIZ-P10 |
| SYS-MFBIZ-P12 | 利用者・運用文書同期 | SYS-MFBIZ-P11 |
| SYS-MFBIZ-P13 | クローズアウト | SYS-MFBIZ-P12 |

共通の確認・復旧手順は `docs/mf-business-classification/runbook.md` を参照する。
