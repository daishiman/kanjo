# 退避サイクル: 2026-09-16-total-cashflow-screen

総収支画面 (design/FINAL-UI/images/05-total-cashflow.png。feat-total-cashflow-screen、PR #55 で 2026-09-16 マージ済み) の確定仕様。
推移画面 (design/FINAL-UI/images/07-trends.png) のサイクルを `system-spec/` 直下へ載せるにあたり退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「家計と事業を合わせた本当の収支を、重複と除外の判断ごと 1 画面で確かめる」、
次サイクルの U1 は「収支がいつ・なぜ変わったかを、推移と増減要因で 1 画面で掴めるようにする」で、
上位概念が入れ替わる。片方を消すのではなく、直下を明け渡して archive に残す。
総収支の確定内容は実装の正本として引き続き有効である。

退避内容は `origin/main` (9da407b) の `system-spec/` 直下を `git show` で書き出したもので、
バイト単位で同一である (`diff -rq` で差分 0 を確認)。確定章の保護を尊重し、原本の移動ではなく新規ファイルとして複製した。

## 前サイクルとの関係

照合画面世代は `system-spec/archive/2026-09-16-reconciliation/` にある。

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
