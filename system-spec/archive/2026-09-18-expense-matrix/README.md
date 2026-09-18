# 退避サイクル: 2026-09-18-expense-matrix

マトリックス画面 (design/FINAL-UI/images/06-matrix.png。feat-expense-matrix、PR #57 で
2026-09-18 マージ済み) の確定仕様。診断画面 (design/FINAL-UI/images/08-diagnosis.png、
feat-diagnosis-screen) のサイクルを `system-spec/` 直下へ載せるにあたり退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
前サイクルの U1 は「科目 × 月の表から偏りを見つけ、その明細まで降りられるようにする」、
本サイクルの U1 は「次に何を改善すると最も効くかを、診断画面の 1 画面で決められるようにする」で、
上位概念が入れ替わる。片方を消すのではなく、直下を明け渡して archive に残す。

マトリックスと診断はどちらも「経費をどう減らすか」を扱うが、問いの立て方が違う。
マトリックスは科目 × 月の表で「どこが偏っているか」を先に決め、診断は改善アクションの
優先順位で「何から手を付けるか」を先に決める。両者は同じ取引集合を見るため矛盾せず、
マトリックスの確定内容は実装の正本として引き続き有効である。

## 退避に伴う付け替え

退避せずに直下だけを診断で上書きすると、`arch-expense-matrix-*` 8 ノードが指す
`source_path` (`system-spec/<章>.md`) の現物が診断の内容に入れ替わり、マトリックス画面の
設計章が診断の仕様を正本にしている状態になる。そのため直下は本サイクルへ明け渡したうえで、
マトリックスの 8 章を本ディレクトリへ退避し、`architecture/graph.json` の
`arch-expense-matrix-*` の `source_path` を
`system-spec/archive/2026-09-18-expense-matrix/<章>.md` へ付け替えた。
退避はバイト単位の複製なので、記録済みの `source_digest` は 8 件とも打ち直していない。

退避内容は `origin/main` の `system-spec/` 直下を `git show` で書き出したもので、
バイト単位で同一である。確定章の保護を尊重し、原本の移動ではなく新規ファイルとして複製した。

## 本サイクルで取り消した誤った退避

本サイクルでは当初 `system-spec/archive/2026-09-18-trends-screen/` が作られていたが、
その中身は前サイクルが既に退避済みの `archive/2026-09-17-trends-screen/` の再複製で、
README 以外の 13 ファイルがバイト一致していた。直下を明け渡す相手は直前に直下を占めていた
世代 (マトリックス) であって推移ではないため、この誤った退避は削除し、本ディレクトリへ置き換えた。

## 前サイクルとの関係

- 推移画面の世代は `system-spec/archive/2026-09-17-trends-screen/` にある。
- 総収支画面の世代は `system-spec/archive/2026-09-16-total-cashflow-screen/` にある。
- 照合画面の世代は `system-spec/archive/2026-09-16-reconciliation/` にある。

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
