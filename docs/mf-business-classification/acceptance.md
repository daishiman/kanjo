# MF事業判定 — 受入対応

受入条件の正本は `specs/spec-mf-business-classification.md`。本書は条件と再現可能な証跡の対応だけを持つ。

| 観点 | 判定方法 | 証跡 |
|---|---|---|
| 比較境界 | 空・非一致・一致・前後空白付き一致を匿名 fixture で検査 | `test-run.md` |
| 優先順位 | 競合 fixture で manual > rule > vendor_memory > mf_mid > default を検査 | `test-run.md` |
| 共通解決 | 公私仕分けとトータル収支の `resolveTx` 結果を比較 | `test-run.md` |
| 要確認 | 4区分からの除外と count/amount の同一集合性を検査 | `test-run.md` |
| wire | `/api/transactions`、`src`、`bySource` を契約テスト | `test-run.md` |
| 由来 | materialize 後の `src=手動` と `origin=vendor_memory` を検査 | `test-run.md` |
| 公開安全 | 実データ・個人パス・秘密が証跡に無いことを検査 | `evidence.md` |

最終状態はチェックボックスで二重管理せず、テスト終了状態と `final-review.md` を参照する。
