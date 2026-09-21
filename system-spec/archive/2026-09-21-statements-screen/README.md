# 退避サイクル: 2026-09-21-statements-screen

決算書画面 (design/FINAL-UI/images/11-statements.png。feat-statements-screen、PR #64) の確定仕様。
明細仕分け画面 (design/FINAL-UI/images/13-classify.png、feat-classify-screen、Beads epic kanjo-d6m) の
サイクルが `main` を取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『損益・資金・残高は、整合していますか？』という問いに 1 画面で答える」、
明細仕分けサイクルの U1 は「取り込んだ明細を『未仕分け・手動・完了』のどれかへ 1 画面で決着させる」で、
上位概念が入れ替わる。

決算書と明細仕分けは同じ台帳を見るが、問いが違う。決算書は確定した数字が三表で整合しているかを確かめ、
明細仕分けはその数字の入口で 1 件ずつの区分を決める。
両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避のきっかけ

明細仕分けサイクル (ブランチ `devgraph/feat-classify-screen`) が `main` (01da6ef) を取り込んだ際に
`system-spec/` 直下が全章衝突した。明細仕分けサイクルの章を直下の現行世代とし、本サイクルの章は
`main` の tree をここへ丸ごと残す。どちらの章も消していない。
本 README 以外は、取り込み時点の `main` の `system-spec/` 直下とバイト単位で同一。
`architecture/graph.json` の `arch-statements-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-statements-screen.md`
- 設計: `architecture/statements-*.md`
