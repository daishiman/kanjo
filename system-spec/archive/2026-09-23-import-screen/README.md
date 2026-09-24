# 退避サイクル: 2026-09-23-import-screen

データ取込画面 (design/FINAL-UI/images/16-import.png。feat-import-screen、PR #69) の確定仕様。
設定画面 (design/FINAL-UI/images/18-settings.png、feat-settings-screen、Beads epic kanjo-0l4) のサイクルが
`main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『複数の明細ファイルを、安全に取り込みますか？』という問いに 1 画面で答え切る」、
設定サイクルの U1 は「『集計ルールと復元設定を、安全に管理しますか？』」で、上位概念が入れ替わる。

データ取込は銀行・カードの明細ファイルからまとめて台帳へ明細を入れる入口、設定は入った明細を
どう集計するか (表記ゆれの正規化・名義・現金の上書き・統計のしきい値) を決める場である。
取込が使う勘定科目の正規化は、設定サイクルが新設した `settings_norm_rules` を読む側へ移った
(`loadImportRestoreSettingsSnapshot`)。両者は矛盾せず、本サイクルの確定内容は実装の正本として
引き続き有効である。

## 退避の手順

`origin/main` (ebc9d25) の tree から `git show origin/main:<file>` で直下 14 ファイル (`.gitkeep` を含む) を
ここへ書き出した。本 README 以外はバイト単位で同一で、どの章も消していない。
`architecture/graph.json` の `arch-import-screen-*` の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-import-screen.md`
- 設計: `architecture/import-screen-*.md`
- 規則の一覧: `docs/import-screen/rules.md`
