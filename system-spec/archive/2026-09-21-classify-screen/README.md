# 退避サイクル: 2026-09-21-classify-screen

明細仕分け画面 (design/FINAL-UI/images/13-classify.png。feat-classify-screen、Beads epic kanjo-d6m、PR #65) の確定仕様。
AI分析画面 (design/FINAL-UI/images/12-ai.png、feat-ai-analysis-screen、Beads epic kanjo-5ru) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『未整理の明細を、根拠を見ながら確定しますか？』という問いに 1 画面で答え切る」、
AI分析サイクルの U1 は「AI への分析依頼・実行状況・結果レポートの根拠と版を 1 画面で確かめる」で、上位概念が入れ替わる。

明細仕分けは取り込んだ明細に区分とカテゴリを与えて台帳を整える場、
AI分析は整った台帳の集計値を外部の AI (Claude Code / Codex) に渡して読み解かせ、返ってきたレポートを版で管理する場である。
前者の出力が後者の入力になる関係で、両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (8f72ff0) の tree から `git show origin/main:<file>` で直下 14 ファイルをここへ書き出した。
本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-classify-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-classify-screen.md`
- 設計: `architecture/classify-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-classify-screen/`
