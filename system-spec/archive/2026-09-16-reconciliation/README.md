# 退避サイクル: 2026-09-16-reconciliation

照合画面 (design/FINAL-UI/images/04-reconciliation.png。feat-reconciliation、PR #54 で 2026-09-16 マージ済み) の確定仕様。次サイクル (支出分析>マトリックス画面 design/FINAL-UI/images/06-matrix.png の UI/UX 改善と必要なバックエンド改善) を開始する際に退避すべきものだった。

本サイクルの上位概念は「帳簿と口座の差異を状態 5 語と一括操作で 1 画面で解消する」であり、次サイクルの「科目 × 月の表から偏りを見つけ、その明細まで降りられるようにする」とは上位概念が入れ替わる。次サイクルは本サイクルの照合 API・状態語彙をそのまま前提として使うため、本サイクルの確定内容は実装の正本として有効である。退避内容は PR #54 のマージコミット (230baaa) のコミット済み内容を `git show` で書き出したものと同一である。

## 退避が遅れた経緯

次サイクル (マトリックス画面) の `system-spec/` 再生成を、本サイクルの退避より先に行ってしまった。その結果 `architecture/graph.json` の `arch-reconciliation-*` 8 ノードが指す `source_path` (`system-spec/<章>.md`) の現物が、次サイクルの内容へ入れ替わった状態になり、`check-graph-lineage` が digest 不一致 8 件として検出した。

このとき検査が出すメッセージは「正本の変更を章へ取り込んだうえで digest を打ち直してください」だが、**ここで digest を打ち直すのは誤り**である。起きていたのは「同じ正本が更新された」ことではなく「正本が別サイクルのものへ入れ替わった」ことであり、打ち直せば照合画面の章がマトリックス画面の仕様を正本にしていることになってしまう。正しい処置は本ディレクトリへの退避と `source_path` の付け替えであり、退避した 8 章の sha256 は `arch-reconciliation-*` に記録済みの digest と 8 件すべて一致した (打ち直しは 1 件も不要だった)。

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
