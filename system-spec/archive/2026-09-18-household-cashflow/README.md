# 退避サイクル: 2026-09-18-household-cashflow

家計収支画面 (design/FINAL-UI/images/10-household.png。feat-household-cashflow、PR #62) の確定仕様。
明細仕分け画面 (design/FINAL-UI/images/13-classify.png) のサイクルを始めるにあたり、
本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る」、
明細仕分けサイクルの U1 は「未整理の明細を、根拠を見ながら確定する」で、上位概念が入れ替わる。

家計収支は仕分け済みの取引を集計して見る画面、明細仕分けはその手前で取引 1 件ごとの区分・カテゴリを
確定する画面で、両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の方法

`main` (0003cb4) の tree から本 README 以外の 13 ファイルをバイト単位で同一のまま複写した。
正本 `system-spec/spec-state.json` は system-spec-harness の単一 writer (`apply-spec-transition.py bootstrap`) で
新サイクル用に作り直しており、確定章を直接書き換えていない。

## 参照

- 画面仕様の正本: `specs/spec-household-cashflow-screen.md`
- 設計: `architecture/household-cashflow-*.md`
