# 退避サイクル: 2026-09-16-reconciliation

照合画面 (design/FINAL-UI/images/04-reconciliation.png。feat-reconciliation、PR #54 で 2026-09-16 マージ済み) の確定仕様。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「照合画面を、帳簿と口座の差異を一件ずつ解消できる作業場にする」であり、
次に直下へ載るサイクルとは U1 が入れ替わる。片方を消すのではなく、直下を明け渡して archive に残す。

退避内容は `origin/main` (230baaa) の `system-spec/` 直下を `git show` で書き出したもので、
バイト単位で同一である。確定章の保護を尊重し、原本の移動ではなく新規ファイルとして複製した。

## 同じ退避が二系統で行われたこと

本ディレクトリは main 系列と本サイクル (マトリックス画面) の双方が独立に作成し、マージ時に add/add
衝突として現れた。どちらも 230baaa の直下を書き出しており、README 以外の 13 ファイルは
バイト単位で同一だったため、内容の取捨は不要だった。README だけを本文へ統合している。

- main 系列は総収支画面 (design/FINAL-UI/images/05-total-cashflow.png、feat-total-cashflow-screen)
  のサイクルを直下へ載せるにあたり退避した。その次サイクルの U1 は
  「MF と freee の二重計上を総収支画面の上で 1 件ずつ決めて消し込めるようにする」。
- 本サイクルは 230baaa から分岐しており、main 側の退避を知らないまま
  マトリックス画面 (design/FINAL-UI/images/06-matrix.png) のサイクルのために退避した。
  その U1 は「科目 × 月の表から偏りを見つけ、その明細まで降りられるようにする」。

いずれの次サイクルも照合の照合 API・状態語彙をそのまま前提として使うため、
照合の確定内容は実装の正本として引き続き有効である。

## 退避が遅れた経緯 (マトリックスサイクル側の記録)

次サイクル (マトリックス画面) の `system-spec/` 再生成を、本サイクルの退避より先に行ってしまった。その結果 `architecture/graph.json` の `arch-reconciliation-*` 8 ノードが指す `source_path` (`system-spec/<章>.md`) の現物が、次サイクルの内容へ入れ替わった状態になり、`check-graph-lineage` が digest 不一致 8 件として検出した。

このとき検査が出すメッセージは「正本の変更を章へ取り込んだうえで digest を打ち直してください」だが、**ここで digest を打ち直すのは誤り**である。起きていたのは「同じ正本が更新された」ことではなく「正本が別サイクルのものへ入れ替わった」ことであり、打ち直せば照合画面の章がマトリックス画面の仕様を正本にしていることになってしまう。正しい処置は本ディレクトリへの退避と `source_path` の付け替えであり、退避した 8 章の sha256 は `arch-reconciliation-*` に記録済みの digest と 8 件すべて一致した (打ち直しは 1 件も不要だった)。

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
