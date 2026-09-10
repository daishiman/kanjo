# 事業判定の配置と参照方向

規範は `specs/spec-mf-business-classification.md`。本書は配置判断だけを記録する。

## 決定

- `packages/core/src/types.ts` の `isMfBizByMid` を中項目比較の唯一の述語にする。
- `packages/core/src/classify.ts` の `resolveIncomingTx` / `resolveTx` を分類優先順位の唯一の解決器にする。
- `packages/core/src/total-cashflow.ts` は `resolveTx` を介して分類結果へ**間接依存**し、中項目を直接比較しない。
- 内部 `ResolvedTx.clsSrc` は API route で wire key `src` へ写像する。進捗の wire key は `summary.progress.bySource` とする。

```text
isMfBizByMid -> resolveIncomingTx -> resolveTx -> classify / total-cashflow
                                         |
                                         +-> API: src, bySource
```

## 理由

`total-cashflow.ts` が述語を直接呼ぶと、通常手動・ルール・取引先メモリを迂回する二本目の判定になる。間接依存は、コード上の呼び出し本数ではなく業務知識を一つに保つための意図的な設計である。

## 却下

- 集計側で中項目を再判定する方式: 優先順位が分裂する。
- 画面側で `mid` から根拠を推測する方式: API と UI の意味が分裂する。
- 保存値を trim する方式: 取込原本を変更してしまう。

## 互換性

`src` / `bySource` への `中項目` 追加と、該当明細が `既定`・`reviewPending` から移ることは意図した意味変更である。詳細は canonical contract の「互換性」を参照する。

