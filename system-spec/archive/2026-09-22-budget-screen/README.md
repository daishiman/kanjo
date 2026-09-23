# 退避サイクル: 2026-09-22-budget-screen

予算画面 (design/FINAL-UI/images/14-budget.png。feat-budget-screen、Beads epic kanjo-inc、PR #67) の確定仕様。
トレードオフ画面 (design/FINAL-UI/images/15-tradeoff.png、feat-tradeoff-screen、Beads epic kanjo-4ib) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『実績に合う予算へ、どこを調整しますか？』という問いに 1 画面で答え切る」、
トレードオフサイクルの U1 は「『新しい支出を増やすなら、何を見直しますか？』という問いに 1 画面で答える」で、上位概念が入れ替わる。

予算は台帳の実績を下敷きにこれからの 1 年の枠を決める場、トレードオフは新しい支出 1 件の財源を既存の支出から探す場である。
どちらも防衛ラインを同じ core の関数から読むだけで、互いの数字を書き換えない。両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (0ed2d8c) の tree から `git show main:<file>` で直下 14 ファイル (`.gitkeep` を含む) をここへ書き出した。
本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-budget-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-budget-screen.md`
- 設計: `architecture/budget-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-budget-screen/`
