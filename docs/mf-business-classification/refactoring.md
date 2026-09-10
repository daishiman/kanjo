# MF 事業判定の整理記録

規範は `specs/spec-mf-business-classification.md`。本書は重複排除の境界だけを記録する。

## 一本化した知識

- 中項目の比較は `isMfBizByMid` の一箇所。
- 分類優先順位は `resolveIncomingTx` / `resolveTx` の一経路。
- 公私仕分けとトータル収支は同じ `resolveTx` の結果を利用。
- API の根拠は `src`、進捗内訳は `bySource`。
- 要確認の件数と金額は同じ集合からサーバー側で導出。
- `ClassificationSource` / `ClassificationProgress` は core の共有型へ集約。

## 意図して残すもの

中項目を扱えなかった旧公開 `classifyTx` と旧 `Classification` は削除した。互換用に二本目の判定を残すより、既存利用箇所を `resolveTx` 系へ統一して同じ誤りの再発を防ぐ。

core 内部の `clsSrc` と wire の `src` は重複ではなく境界写像である。公開契約には `src` だけを使う。

## 対象外

見た目が似ているだけの集計関数、既存 DB schema、認証、取込 lifecycle は共通化しない。共通化の基準はコード形状ではなく同じ業務知識を表しているかどうかとする。
