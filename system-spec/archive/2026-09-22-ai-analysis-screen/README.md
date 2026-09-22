# 退避サイクル: 2026-09-22-ai-analysis-screen

AI分析画面 (design/FINAL-UI/images/12-ai.png。feat-ai-analysis-screen、PR #66) の確定仕様。
トレードオフ画面 (design/FINAL-UI/images/15-tradeoff.png) のサイクルを始める際に、
本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『AIに分析を依頼し、根拠と版を確認しますか？』という問いに 1 画面で答える」、
トレードオフサイクルの U1 は「『新しい支出を増やすなら、何を見直しますか？』という問いに 1 画面で答える」で、
上位概念が入れ替わる。両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

本 README 以外は、退避時点の `main` (f0e5a3b) の `system-spec/` 直下とバイト単位で同一。
`architecture/graph.json` の `arch-ai-analysis-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-ai-analysis-screen.md`
- 設計: `architecture/ai-analysis-*.md`
