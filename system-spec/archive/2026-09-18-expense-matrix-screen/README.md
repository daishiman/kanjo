# 退避サイクル: 2026-09-18-expense-matrix-screen

マトリックス画面 (design/FINAL-UI/images/06-matrix.png。feat-expense-matrix、PR #57 で 2026-09-18 マージ済み) の確定仕様。
サブスク画面 (design/FINAL-UI/images/09-subscriptions.png) のサイクルを
`system-spec/` 直下へ載せるにあたり退避した。

## なぜ退避になったか

`system-spec/` 直下は「現行 1 世代」の運用で、上位概念 (U1) を 1 つだけ置く。
本サイクルの U1 は「科目 × 月の表から偏りを見つけ、その明細まで降りられるようにする」、
次サイクルの U1 は「『毎月の固定費に重複や見直し候補はありますか？』という問いに 1 画面で答え、見直すべき契約をその場で決着まで進められるようにする」で、
上位概念が入れ替わる。片方を消すのではなく、直下を明け渡して archive に残す。

マトリックスとサブスクは同じ支出明細を見るが、問いが違う。マトリックスは「どこが偏っているか」、
サブスクは「継続的な支払いのうち、どれを見直すべきか」を先に決める。
マトリックスの確定内容は実装の正本として引き続き有効である。

## 新しい世代を bootstrap から作り直した理由

`spec-state.json` を引き継いで init し直すと、旧世代の `decisions` (dec-matrix-*) が残る。
writer の `set-decision` は id で upsert するだけで削除できず、compile は残った decision を
要件定義書へ出力する。そのため、サブスク世代の `spec-state.json` は `bootstrap` で空の envelope から作り直した。
foundation (U1-U9) と decision 7 件 (dec-subs-*) は利用者の承認と選択をもとに記録した。

compile は既存章のうち管轄外の節を引き継ぐ (`merge_preserving`)。そのため、旧 `00-requirements-definition.md` が
直下に残ったままだと、旧 U1・U2 の段落と旧承認 `appr-foundation-expense-matrix-001` の節が
新しい要件定義書に混入した。旧ファイルは本ディレクトリにバイト一致で退避済みであることを確認した。
そのうえで利用者が直下の旧ファイルを削除し、compile し直した。
空ディレクトリへ compile した版と一致することも確認済みである。
カテゴリ章 8 本は spec_cells で旧世代と同じセルを指すため、引き継がれたのは凡例の注記 1 行だけで、内容の混入はない。

## architecture の付け替え

`architecture/graph.json` の `arch-<expense-matrix>-*` 8 ノードの `source_path` を
`system-spec/archive/2026-09-18-expense-matrix-screen/<章>.md` へ付け替えた。
退避はバイト単位の複製なので、記録済みの `source_digest` は 8 件とも打ち直していない。
退避内容は `bc3be0d` の `system-spec/` 直下と同一である。

## 前サイクルとの関係

- 推移画面の世代は `system-spec/archive/2026-09-17-trends-screen/` にある。
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
