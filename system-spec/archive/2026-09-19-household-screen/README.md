# 退避サイクル: 2026-09-19-household-screen

家計収支画面 (design/FINAL-UI/images/10-household.png。feat-household-cashflow、PR #62) の確定仕様。
AI分析画面 (design/FINAL-UI/images/12-ai.png) のサイクルを始める際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る」、
AI分析サイクルの U1 は AI への分析依頼・実行状況・結果レポートの根拠と版を 1 画面で確かめることで、上位概念が入れ替わる。

家計収支は台帳の集計結果を画面で読む場、AI分析は集計データを外部の AI (Claude Code / Codex) に渡して読み解かせる場であり、
両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (6290624) の tree から `git show HEAD:system-spec/<file>` で 13 ファイルをここへ書き出した。
本 README 以外はバイト単位で同一 (cmp で 13 件一致を確認)。どの章も消していない。
`architecture/graph.json` の `arch-household-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-household-cashflow-screen.md`
- 設計: `architecture/household-cashflow-*.md`
- 作業記録: `docs/household-screen/`
