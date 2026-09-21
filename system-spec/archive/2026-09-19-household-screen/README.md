# 退避サイクル: 2026-09-19-household-screen

家計収支画面 (design/FINAL-UI/images/10-household.png。feat-household-cashflow、PR #62) の確定仕様。
決算書画面 (design/FINAL-UI/images/11-statements.png、feat-statements-screen、Beads epic kanjo-oju) の
サイクルが `main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る」、
決算書サイクルの U1 は「『損益・資金・残高は、整合していますか？』という問いに 1 画面で答える」で、上位概念が入れ替わる。

家計収支と決算書は同じ台帳を見るが、問いが違う。家計収支は家計全体の収入・支出が「いつ・どこで」動いたかを掴み、
決算書は事業の損益・資金・残高の三表が互いに整合しているかを確かめる。
両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避のきっかけ

決算書サイクル (ブランチ `daishiman/11決算書`) が `main` (0003cb4) を取り込んだ際に `system-spec/` 直下が全章衝突した。
決算書サイクルの章を直下の現行世代とし、本サイクルの章は `main` の tree をここへ丸ごと残す。どちらの章も消していない。
本 README 以外は、取り込み時点の `main` の `system-spec/` 直下とバイト単位で同一。
`architecture/graph.json` の `arch-household-cashflow-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-household-cashflow-screen.md`
- 設計: `architecture/household-cashflow-*.md`
