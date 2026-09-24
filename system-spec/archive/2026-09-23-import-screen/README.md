# 退避サイクル: 2026-09-23-import-screen

データ取込画面 (design/FINAL-UI/images/16-import.png。feat-import-screen、Beads epic kanjo-y7q、PR #69) の確定仕様。
使い方画面 (design/FINAL-UI/images/19-guide.png、feat-guide-screen、Beads epic kanjo-ogz) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『複数の明細ファイルを、安全に取り込みますか？』という問いに 1 画面で答え切る」、
使い方サイクルの U1 は「『この数字を、どう読み・どこへ戻ればよいですか？』という問いに 1 画面で答え切る」で、上位概念が入れ替わる。

データ取込は明細を台帳へ入れる入口、使い方は台帳から導いた数字の読み方と戻り先を示す読み取り専用の画面である。
使い方画面は取込の結果を書き換えず、取込画面の規則 (重複判定・取り消し・外部へ送らない) にも触れない。
両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`origin/main` (ebc9d25) の tree から `git show origin/main:<file>` で直下 14 ファイル (`.gitkeep` を含む) を
ここへ書き出した。本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-import-screen-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない (付け替え時に 8 件とも sha256 の一致を確認した)。

## 参照

- 画面仕様の正本: `specs/spec-import-screen.md`
- 設計: `architecture/import-screen-*.md`
- 作業記録: `.dev-graph/plans/feature-package-feat-import-screen/`
