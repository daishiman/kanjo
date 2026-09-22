# 退避サイクル: 2026-09-22-budget-screen

予算画面 (design/FINAL-UI/images/14-budget.png。feat-budget-screen、Beads epic kanjo-inc、PR #67) の確定仕様。
データ取込画面 (design/FINAL-UI/images/16-import.png、feat-import-screen、Beads epic kanjo-y7q) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『実績に合う予算へ、どこを調整しますか？』という問いに 1 画面で答え切る」、
取込サイクルの U1 は「複数の明細ファイルを、安全に取り込みますか？」で、上位概念が入れ替わる。

予算は台帳の実績を下敷きにこれからの 1 年の枠を決める場、取込は台帳へ明細を入れる入口である。
取込が台帳の実績を作り、予算がそれを読む関係で、両者は矛盾しない。本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (0ed2d8c) の tree から `git show main:<file>` で直下 14 ファイル (`.gitkeep` を含む) をここへ書き出した。
本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-budget-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-budget-screen.md`
- 設計: `architecture/budget-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-budget-screen/`
