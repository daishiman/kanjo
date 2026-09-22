# 退避サイクル: 2026-09-22-ai-analysis-screen

AI分析画面 (design/FINAL-UI/images/12-ai.png。feat-ai-analysis-screen、Beads epic kanjo-5ru、PR #66) の確定仕様。
予算画面 (design/FINAL-UI/images/14-budget.png、feat-budget-screen、Beads epic kanjo-inc) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『AIに分析を依頼し、根拠と版を確認しますか？』という問いに 1 画面で答え切る」、
予算サイクルの U1 は「『実績に合う予算へ、どこを調整しますか？』という問いに 1 画面で答え切る」で、上位概念が入れ替わる。

AI分析は整った台帳の集計値を外部の AI に渡して読み解かせ、返ってきたレポートを版で管理する場、
予算は台帳の実績を下敷きに、これからの 1 年の収入・支出の枠を決める場である。
AI分析の改善提案が予算の見直しのきっかけになる関係で、両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (f0e5a3b) の tree から `git show origin/main:<file>` で直下 14 ファイル (`.gitkeep` を含む) をここへ書き出した。
本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-ai-analysis-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-ai-analysis-screen.md`
- 設計: `architecture/ai-analysis-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-ai-analysis-screen/`
