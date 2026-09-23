# 退避サイクル: 2026-09-23-tradeoff-screen

トレードオフ画面 (design/FINAL-UI/images/15-tradeoff.png。feat-tradeoff-screen、Beads epic kanjo-4ib、PR #68) の確定仕様。
設定画面 (design/FINAL-UI/images/18-settings.png、feat-settings-screen、Beads epic kanjo-0l4) のサイクルが
`main` を取り込む際に、本サイクルの章をこのディレクトリの親 (現行世代の置き場) から退避した。

## なぜ退避になったか

現行世代の置き場は「1 世代だけ」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『新しい支出を増やすなら、何を見直しますか？』という問いに 1 画面で答える」、
設定サイクルの U1 は「『集計ルールと復元設定を、安全に管理しますか？』という問いに 1 画面で答え切る」で、上位概念が入れ替わる。

トレードオフは新しい支出 1 件の財源を既存の支出から探す場、設定は台帳の集計・分析・出力の前提
(正規化ルール・名義・統計の閾値・現金上書き) と、その前提自体の出力・復元・バックアップを扱う場である。
設定の集計ルールはトレードオフの候補の科目名にも届くが、トレードオフの確定内容とは矛盾しない。
本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避のきっかけ

設定サイクル (ブランチ `devgraph/SYS-SETTINGS-P13`) が `main` (683226b) を取り込んだ際に現行世代の章が全件衝突した。
設定サイクルの章を現行世代とし、本サイクルの章は `main` の tree をここへ丸ごと残す。どちらの章も消していない。
本 README 以外は、取り込み時点の `main` の tree とバイト単位で同一。
`architecture/graph.json` の `arch-tradeoff-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-tradeoff-screen.md`
- 設計: `architecture/tradeoff-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-tradeoff-screen/`
