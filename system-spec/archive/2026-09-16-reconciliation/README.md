# 退避サイクル: 2026-09-16-reconciliation

照合画面 (design/FINAL-UI/images/04-reconciliation.png。feat-reconciliation、PR #54 で 2026-09-16 マージ済み) の確定仕様。
総収支画面 (design/FINAL-UI/images/05-total-cashflow.png、feat-total-cashflow-screen) のサイクルを
`system-spec/` 直下へ載せるにあたり退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「照合画面を、帳簿と口座の差異を一件ずつ解消できる作業場にする」、
次サイクルの U1 は「MF と freee の二重計上を総収支画面の上で 1 件ずつ決めて消し込めるようにする」で、
上位概念が入れ替わる。片方を消すのではなく、直下を明け渡して archive に残す。

本サイクルと次サイクルは同じ判断表 (`duplicate_verdicts` / `freee_deal_exclusions`) を触るが、
矛盾はしない。照合の確定内容は実装の正本として引き続き有効である。

退避内容は `origin/main` (230baaa) の `system-spec/` 直下を `git show` で書き出したもので、
バイト単位で同一である。確定章の保護を尊重し、原本の移動ではなく新規ファイルとして複製した。

## 前サイクルとの関係

支出分析ハブ世代は `system-spec/archive/2026-09-15-analysis-hub/` にある。
総収支サイクルは同じ世代を `2026-09-14-analysis-hub` という別名でも退避していたが、
README 以外の中身が同一の重複だったため、main 側の `2026-09-15-analysis-hub` を正として片方を削除した。

退避したファイル:

- `00-requirements-definition.md`
- `auth.md`
- `backend.md`
- `completeness-findings.json`
- `database.md`
- `fetched-references.json`
- `frontend.md`
- `index.md`
- `infrastructure.md`
- `maintenance-ops.md`
- `security.md`
- `spec-state.json`
- `ui-ux.md`
