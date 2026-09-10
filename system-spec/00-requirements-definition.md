---
status: confirmed
---

# 要件定義書 (上位概念)

本書は MF 事業判定に至った上位目的と決定来歴を保持する。実装が従う単一契約は `specs/spec-mf-business-classification.md`。トータル収支全般は active な `specs/spec-total-cashflow-system.md` を維持し、本 feature は MF 分類入力だけを差分化する。

## 本質的目的

MF 側で付けた事業分類を収入・支出へ一貫して反映し、公私仕分けと月次トータル収支で同じ明細が別の側へ現れないようにする。freee を事業帳簿として扱う既存の消し込み契約は維持する。

## 確定した意思決定

- 中項目の事業判定は、保存値を変えず比較時だけ trim して接頭辞を比較する。
- `cls` は `manual > rule > vendor_memory > mf_mid > default` の順で決める。口座名義は `owner` の根拠として分離する。
- 公私仕分けとトータル収支は `resolveTx` の同じ結果を使う。集計側に二本目の中項目判定を置かない。
- freee との消し込みを先に行い、残余だけを事業または家計へ算入する。
- 要確認は判断まで4区分の合計から外し、件数と金額を同じ集合から導出する。
- API の明細 route は `/api/transactions`、wire 根拠は `src`、進捗内訳は `summary.progress.bySource` とする。
- `中項目` enum の追加、`reviewPending` の意味変化、該当明細の集計先変更は意図した互換性変更として扱う。
- DB migration、新規 endpoint、認証変更、既存通常手動編集の再評価は行わない。

## 成功条件

canonical contract の受入条件が匿名化 fixture で再現され、raw production data や実データ由来の具体値を公開成果物へ複製しないこと。

## 意思決定の来歴

詳細な質疑・評価結果は `system-spec/spec-state.json` と `system-spec/completeness-findings.json` に保持する。本書は逐語ログや数値ベースラインを再掲しない。
