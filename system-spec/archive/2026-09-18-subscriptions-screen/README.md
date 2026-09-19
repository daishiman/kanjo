# 退避サイクル: 2026-09-18-subscriptions-screen

サブスク画面 (design/FINAL-UI/images/09-subscriptions.png。feat-subscriptions-screen、PR #60) の確定仕様。
家計収支画面 (design/FINAL-UI/images/10-household.png、feat-household-cashflow、Beads epic kanjo-fzu) の
サイクルを `main` へ取り込む際に、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「『毎月の固定費に重複や見直し候補はありますか？』という問いに 1 画面で答え、
見直すべき契約をその場で決着まで進められるようにする」、家計収支サイクルの U1 は
「『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る」で、上位概念が入れ替わる。

サブスクと家計収支は同じ取引集合を見るが、問いが違う。サブスクは継続的な支払いのうち
「どれを見直すべきか」を先に決め、家計収支は家計全体の収入・支出が「いつ・どこで」動いたかを先に掴む。
両者は矛盾せず、本サイクルの確定内容は実装の正本として引き続き有効である。

## 退避のきっかけ

家計収支サイクル (ブランチ `devgraph/feat-household-cashflow`) が `main` を取り込んだ merge で
`system-spec/` 直下が全章衝突した。家計収支サイクルの章を直下の現行世代とし、本サイクルの章は
`main` の tree (本 README 以外はバイト単位で同一) をここへ丸ごと残す。どちらの章も消していない。
`architecture/graph.json` の `arch-subscriptions-*` 8 件の `source_lineage.source_path` はこの退避先へ付け替え、
digest は内容が同一なので打ち直していない。

## 参照

- 画面仕様の正本: `specs/spec-subscriptions-screen.md`
- 設計: `architecture/subscriptions-*.md`
- 仕様反映の受領書: `docs/evidence/subscriptions-spec-reflection-receipt.md`
