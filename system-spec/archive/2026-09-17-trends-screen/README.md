# 退避サイクル: 2026-09-17-trends-screen

推移画面 (design/FINAL-UI/images/07-trends.png。feat-trends-screen、PR #56 で 2026-09-17 マージ済み) の確定仕様。
マトリックス画面 (design/FINAL-UI/images/06-matrix.png、feat-expense-matrix) のサイクルを
`system-spec/` 直下へ載せるにあたり退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「収支が『いつ・なぜ』変わったかを、推移画面の 1 画面で掴めるようにする」、
次サイクルの U1 は「科目 × 月の表から偏りを見つけ、その明細まで降りられるようにする」で、
上位概念が入れ替わる。片方を消すのではなく、直下を明け渡して archive に残す。

推移とマトリックスはどちらも「支出が動いた理由を辿る」系統だが、問いの立て方が違う。
推移は時間軸で「いつ動いたか」を先に決め、マトリックスは科目 × 月の表で「どこが偏っているか」を
先に決める。両者は同じ取引集合を見るため矛盾せず、推移の確定内容は実装の正本として引き続き有効である。

## この退避がマージ時に行われた理由

マトリックスサイクルのブランチは照合サイクル (230baaa) から分岐しており、
その後 main に総収支 (PR #55) と推移 (PR #56) の 2 サイクルが積まれた。
マージ時点で main の直下は推移サイクルの内容、本ブランチの直下はマトリックスサイクルの内容で、
`system-spec/` 直下の 12 ファイルすべてが衝突した。

退避せずに直下だけをマトリックスで上書きすると、`arch-trends-screen-*` 8 ノードが指す
`source_path` (`system-spec/<章>.md`) の現物がマトリックスの内容に入れ替わり、
推移画面の設計章がマトリックスの仕様を正本にしている状態になる。
そのため直下は本サイクルへ明け渡したうえで、推移の 8 章を本ディレクトリへ退避し、
`architecture/graph.json` の `arch-trends-screen-*` の `source_path` を
`system-spec/archive/2026-09-17-trends-screen/<章>.md` へ付け替えた。
退避はバイト単位の複製なので、記録済みの `source_digest` は 8 件とも打ち直していない。

退避内容は `origin/main` (9a8bd28) の `system-spec/` 直下を `git show` で書き出したもので、
バイト単位で同一である。確定章の保護を尊重し、原本の移動ではなく新規ファイルとして複製した。

## 前サイクルとの関係

- 総収支画面の世代は `system-spec/archive/2026-09-16-total-cashflow-screen/` にある。
- 照合画面の世代は `system-spec/archive/2026-09-16-reconciliation/` にある。
- 支出分析ハブ世代は `system-spec/archive/2026-09-15-analysis-hub/` にある。

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
