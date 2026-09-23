# 退避サイクル: 2026-09-23-cash-entry-screen

現金入力画面 (design/FINAL-UI/images/17-cash.png。feat-cash-screen、PR #70) の確定仕様。
データ取込画面 (design/FINAL-UI/images/16-import.png、feat-import-screen、Beads epic kanjo-y7q) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『現金と交通費を、漏れなく記録しますか？』という問いに 1 画面で答え切る」、
取込サイクルの U1 は「複数の明細ファイルを、安全に取り込みますか？」で、上位概念が入れ替わる。

現金入力は取込に乗らない支払いを手で台帳へ入れる入口、データ取込は銀行・カードの明細ファイルから
まとめて台帳へ入れる入口である。どちらも台帳へ明細を足す側で、同じ重複判定と同じ削除の規則に従い、
互いの行を書き換えない。両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`origin/main` (237d2a2) の tree から `git show origin/main:<file>` で直下 14 ファイル (`.gitkeep` を含む) を
ここへ書き出した。本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-cash-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-cash-screen.md`
- 設計: `architecture/cash-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-cash-screen/`
