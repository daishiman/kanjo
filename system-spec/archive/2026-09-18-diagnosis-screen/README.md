# 退避サイクル: 2026-09-18-diagnosis-screen

診断画面 (design/FINAL-UI/images/08-diagnosis.png。feat-diagnosis-screen、Beads epic kanjo-8bk) の確定仕様。
サブスク画面 (design/FINAL-UI/images/09-subscriptions.png、feat-subscriptions-screen) のサイクルが
先に `main` へ入ったため、本サイクルの章を `system-spec/` 直下から退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「次に何を改善すると最も効くかを、診断画面の 1 画面で決められるようにする」、
`main` 側サイクルの U1 は「『毎月の固定費に重複や見直し候補はありますか？』という問いに
1 画面で答え、見直すべき契約をその場で決着まで進められるようにする」で、上位概念が入れ替わる。

診断とサブスクは同じ支出明細を見るが、問いが違う。診断は改善アクションの優先順位で
「何から手を付けるか」を先に決め、サブスクは継続的な支払いのうち「どれを見直すべきか」を先に決める。
両者は同じ取引集合を見るため矛盾せず、診断の確定内容は実装の正本として引き続き有効である。

## 退避のきっかけ

診断サイクル (ブランチ `devgraph/feat-diagnosis-screen`) の作業中に `main` が
サブスクサイクル (PR #60) を取り込んだため、merge 時に `system-spec/` 直下が全章衝突した。
後から `main` に入った世代を直下の正本とし、本サイクルの章はここへ丸ごと残す。
どちらの章も消していない。

## 参照

- 画面仕様の正本: `specs/spec-diagnosis-screen.md`
- 設計判断 (ADR-001..006): `architecture/arch-diagnosis-screen.md`
- 仕様反映の受領書: `docs/diagnosis-screen/spec-reflection-receipt.md`
