# 退避サイクル: 2026-09-22-ai-analysis-screen

AI分析画面 (design/FINAL-UI/images/12-ai.png。feat-ai-analysis-screen、Beads epic kanjo-5ru、PR #66) の確定仕様。
現金入力画面 (design/FINAL-UI/images/17-cash.png) のサイクルを始めるにあたり、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「AI への分析依頼・実行状況・結果レポートの根拠と版を 1 画面で確かめる」、
現金入力サイクルの U1 は銀行・カードの取込に乗らない現金と交通費を、漏れなく記録する場であり、上位概念が入れ替わる。

現金入力で記録した明細は台帳に入り、集計を経て AI分析の入力になる。前者の出力が後者の入力になる関係で、両者は矛盾しない。
本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (f0e5a3b) の tree から `git show HEAD:<file>` で直下 13 ファイルをここへ書き出した。
本 README と `.gitkeep` 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-ai-analysis-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-ai-analysis-screen.md`
- 設計: `architecture/ai-analysis-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-ai-analysis-screen/`
