# 退避サイクル: 2026-09-22-tradeoff-screen

トレードオフ画面 (design/FINAL-UI/images/15-tradeoff.png。feat-tradeoff-screen、Beads epic kanjo-4ib、PR #68) の確定仕様。
現金入力画面 (design/FINAL-UI/images/17-cash.png、feat-cash-screen、Beads epic kanjo-tf6) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『新しい支出を増やすなら、何を見直しますか？』という問いに 1 画面で答える」、
現金入力サイクルの U1 は「銀行・カードの取込に乗らない現金と交通費を、漏れなく記録する場」で、上位概念が入れ替わる。

現金入力で記録した明細は台帳の実績に入り、トレードオフはその実績から見直し候補を探す。前者の出力が後者の入力になる関係で、
両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (683226b) の tree から `git show origin/main:<file>` で直下 15 ファイル (`.gitkeep` を含む) をここへ書き出した。
本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-tradeoff-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-tradeoff-screen.md`
- 設計: `architecture/tradeoff-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-tradeoff-screen/`
