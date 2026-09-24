# 退避サイクル: 2026-09-23-settings-screen

設定画面 (design/FINAL-UI/images/18-settings.png。feat-settings-screen、Beads epic kanjo-0l4、PR #71) の確定仕様。
使い方画面 (design/FINAL-UI/images/19-guide.png、feat-guide-screen、Beads epic kanjo-ogz) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『集計ルールと復元設定を、安全に管理しますか？』」、
使い方サイクルの U1 は「『この数字を、どう読み・どこへ戻ればよいですか？』という問いに 1 画面で答え切る」で、上位概念が入れ替わる。

設定は明細をどう集計するか (表記ゆれの正規化・名義・現金の上書き・統計のしきい値) を決める場、
使い方は集計された数字の読み方と戻り先を示す読み取り専用の画面である。使い方画面は設定を書き換えず、
設定サイクルが新設した表 (`settings_norm_rules` ほか) にも触れない。
両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避の手順

`main` (ef7ee82) の tree から `git show main:<file>` で直下 14 ファイル (`.gitkeep` を含む) を
ここへ書き出した。本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-settings-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-settings-screen.md`
- 設計: `architecture/settings-*.md`
