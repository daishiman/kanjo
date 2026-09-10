# MF事業判定 — 要件ベースライン

規則の正本は `specs/spec-mf-business-classification.md`。本書は検証入力の境界だけを定める。

## 公開可能な入力

検証には `samples/` またはテスト内で生成した匿名 fixture だけを使う。実データの行、件数、金額、取引先名、個人パスは記録しない。

## 必須ケース

- 中項目が空、空白だけ、非一致、一致、前後空白付き一致である。
- 優先順位の各段と競合を含む。
- 公私仕分けとトータル収支が同じ `resolveTx` 結果を使う。
- 未判断の要確認は4区分から除外し、`reviewCount` / `reviewAmount` は同じ集合から導出する。
- `/api/transactions` の `src` と `summary.progress.bySource` を検査する。
- materialize 済み取引先メモリは `src=手動`、由来は `origin=vendor_memory` とする。

実行結果の正本は `test-run.md`、証跡の所在は `evidence.md` とする。
