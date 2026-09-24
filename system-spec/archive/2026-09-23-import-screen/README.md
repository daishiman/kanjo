# 退避サイクル: 2026-09-23-import-screen

データ取込画面 (design/FINAL-UI/images/16-import.png。feat-import-screen、PR #69、Beads epic kanjo-y7q) の確定仕様。
改善リクエスト画面 (design/FINAL-UI/images/20-improvement.png、feat-improvement-screen、Beads epic kanjo-kkp) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「複数の明細ファイルを、安全に取り込みますか？」、改善リクエストサイクルの U1 は
改善リクエストを 1 画面で出し・追い・片付けることで、上位概念が入れ替わる。

データ取込は台帳へ明細を足す入口、改善リクエストは利用者がアプリそのものへの要望を出す入口で、
互いの表・API・画面を書き換えない。両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`origin/main` (ebc9d25) の tree から `git show origin/main:<file>` で直下 14 ファイルをここへ書き出した。
本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-import-screen-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

改善リクエストサイクルは現金入力サイクルの章を `archive/2026-09-23-cash-screen/` へ退避していたが、
#69 が同じ内容を `archive/2026-09-23-cash-entry-screen/` へ退避済みだったため (README 以外バイト同一)、そちらへ一本化した。

## 参照

- 画面仕様の正本: `specs/spec-import-screen.md`
- 設計: `architecture/import-screen-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-import-screen/`
