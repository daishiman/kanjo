# 実装要件 — トータル収支一覧 (事業+家計の合算)

- feature: `feat-total-cashflow` / package: `feature-package/feat-total-cashflow`
- source canonical digest: `sha256:919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb`
- graph snapshot digest: `sha256:df660192bfa7be5c9c45fcf7dfaac66f5321c3231b50c99568aaf492b51b3cc0`
- handoff target: `task-graph` / handoff status: **released**

## この feature が解く困りごと

個人事業主として事業と家計が一体になっている実態に対し、freee (事業帳簿) と Money Forward (家計) へ分かれて記録された収入・支出が、二重計上を含んだまま別々の数字として出ているため、「今月トータルでいくらプラスマイナスなのか」「費用が増えているのか減っているのか」が判断できない。重複を明細単位で消し込んだうえで 1 つの一覧表に束ね、消し込みの根拠ごと確認できる状態を作る。

月ごとのトータル収入・トータル支出・トータル収支と、事業側/家計側の内訳、支出トレンドの判定 (増加/減少/横ばい/判定不可) を 1 つの一覧表で確認でき、合計が 事業費 (freee 正) + 家計費 (MF 残余) として利用者の手で検算でき、自動で寄せられなかった重複候補は要確認として理由付きで列挙され、一度下した「同じ/違う」の判断が次回以降の取込へ再適用される状態。

## 受入条件 (feature 層)

- 月次一覧表に トータル収入 / トータル支出 / トータル収支 の 3 列が表示され、総支出 == 事業費 + 家計費 および 総収入 == 事業収入 + 家計収入 が全ての表示月で成立する
- MF 日付 == freee 発生日 かつ 金額一致 の支出について、freee 側 1 件だけが事業費に計上され、同一金額の MF 側明細が家計費に残らない
- 一覧表に 事業側へ寄せた金額と件数 が表示され、その値が消し込み対象明細の実数と一致する
- 金額または日付が一致しない重複候補が要確認として理由付きで列挙され、0 件のときは 0 件と明示される
- 要確認明細に「同じ」判定を下した後、同じ入力を再取込しても判定が保持され、集計結果が変わらない
- 収入側の要確認明細を「同じ」と判定すると、その明細が家計収入から事業収入へ移り、総収入は不変である
- トータル支出のトレンド判定が trend.ts と同じ Mann-Kendall / Theil-Sen で計算され、同一データに対し既存の事業単独トレンドと同じ統計手続きを踏んだ結果を返す
- 期間を切り替えて再計算した各月の値が、別の期間指定で同じ月を含めたときの値と一致する

## 三 gate の実測

| gate | 実測 |
|---|---|
| C11 validate-graph-schema | valid=True / readiness=complete / violations=0 |
| C02 保存状態 (13 task) | readiness=['complete'] / confirmation=['confirmed'] / evaluation=['pass'] |
| C12 validate-system-plan | status=pass / violations=0 |

三 gate が同一 digest を見ていること: **True** (C02 保存 digest の異なり数 = 1)

## readiness matrix

| phase | node | 種別 | 依存 | readiness | 不足 section | 是正責任 |
|---|---|---|---|---|---|---|
| P01 | `SYS-TCF-P01` | documentation | なし | complete | なし | — |
| P02 | `SYS-TCF-P02` | backend | SYS-TCF-P01 | complete | なし | — |
| P03 | `SYS-TCF-P03` | quality | SYS-TCF-P02 | complete | なし | — |
| P04 | `SYS-TCF-P04` | quality | SYS-TCF-P03 | complete | なし | — |
| P05 | `SYS-TCF-P05` | backend | SYS-TCF-P03, SYS-TCF-P04 | complete | なし | — |
| P06 | `SYS-TCF-P06` | quality | SYS-TCF-P05 | complete | なし | — |
| P07 | `SYS-TCF-P07` | quality | SYS-TCF-P05, SYS-TCF-P06 | complete | なし | — |
| P08 | `SYS-TCF-P08` | data | SYS-TCF-P07 | complete | なし | — |
| P09 | `SYS-TCF-P09` | quality | SYS-TCF-P06, SYS-TCF-P08 | complete | なし | — |
| P10 | `SYS-TCF-P10` | quality | SYS-TCF-P07, SYS-TCF-P09 | complete | なし | — |
| P11 | `SYS-TCF-P11` | documentation | SYS-TCF-P09, SYS-TCF-P10 | complete | なし | — |
| P12 | `SYS-TCF-P12` | documentation | SYS-TCF-P11 | complete | なし | — |
| P13 | `SYS-TCF-P13` | operations | SYS-TCF-P12 | complete | なし | — |

## handoff の内容

`.dev-graph/plans/feature-package-feat-total-cashflow/requirements-handoff.json` が正本。task-graph build は次を入力とする。

- task graph: `.dev-graph/plans/feature-package-feat-total-cashflow/task-graph.json`
- workstream inventory: `.dev-graph/plans/feature-package-feat-total-cashflow/workstream-inventory.json`
- 各 task の正本文書: `tasks/feat-total-cashflow/` 配下 13 件

## 本 skill が生成しなかったもの

- 実装コード 0 件。packages/ 配下への書込みは行っていない。
- 13 task spec の再生成 0 件 (system-dev-planner の所有物を引用しただけ)。
