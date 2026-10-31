# サブスク統合と並行制御 — 仕様反映の受領書

- 記録日: 2026-10-01
- 対象ブランチ: `devgraph/feat-subscriptions-merge`
- base: `main` (`a63d35c`。`origin/main` = ローカル `main` = 分岐元で、取り込む差分は 0)
- Beads: epic `kanjo-c2t`、子 `kanjo-c2t.1` .. `kanjo-c2t.13` (13 件、`dev-graph:SYS-SUBSMERGE-P01`..`P13`)
- dev-graph node: `feat-subscriptions-merge`

## 判定: 仕様・設計への影響あり → specs と architecture に反映済み。system-spec は影響なし

本サイクルは、統合の意味の是正 (`merged_into_id` と core の `resolveVendorMerges`)、書込みの順次処理と取り消し、
保存 (migration 0058)・API・画面の作り直しを含む。本サイクルの system-spec・specs・architecture・features・tasks は
P01 の前に正規フロー (elicit → doc-fetch → compile → plan) で作った。
本受領書は、その後の実装 (P01〜P13) と elegant review (2026-10-01) で確定した契約を、どの層へ戻したかの記録である。

## 何が変わったか (判定の入力)

elegant review で、応答と再取得の契約が 4 点変わった。

1. **循環の止まり方**。統合元の子孫を統合先に選ぶと、子孫は必ず統合済みなので BR-001 の
   409 `subscription_revision_conflict` で先に止まる。422 `merge_cycle` は自己統合と、確定の直前に照合一覧を組み立てる最後の守りに残る。
2. **読取りの `private, no-store`**。成否 (200・404・409 など) を問わず付け、付ける入口を `subscriptionReadSnapshot` の 1 か所にした。
3. **登録の再送**。`POST /api/sub-vendors` を同じ key で再送すると、最初に作った行の id を本文の `id` に入れて返す。
4. **他画面の取り直し**。他画面のサブスク集計を変える操作 (登録・削除・統合・取り消しと、カテゴリ以外の登録内容の変更) の成功後に、
   既存の `invalidateAnalysisDerived` で他画面の派生分析へ古い印を付ける。待たないので、同じ scope の次の操作は遅れない。

あわせて、revision の比較式を `revisionOf` の 1 か所に寄せた (状態の読取り・読取りの stamp・登録の CAS)。式の意味は変えていない。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| specs | `specs/spec-subscriptions-merge.md` | BR-005 と Error contract の 422 の行 (1)、共通の読取り契約 (2)、既存書込みの実行セマンティクス (3)、入力・再取得・タブの追加契約 (4)。「確定した実装契約」の表に #12 (`revisionOf`) と、elegant review の 4 点の所在を 1 文で足した |
| architecture | `architecture/subscriptions-merge-security.md` | 濫用ケース・入口の検査・abuse の検証の 3 か所を、自己統合は 422、循環は 409 に直した (1) |
| architecture | `architecture/subscriptions-merge-backend.md` | 「実装時に確定した判断」へ `revisionOf`・no-store の入口・登録の再送の id・判定順を追記 (1〜3) |
| architecture | `architecture/subscriptions-merge-frontend.md` | Fetch/cache/invalidation へ `AFFECTS_TOTALS` と待たない理由、「実装時に確定した判断」へ入口を `ANALYSIS_DERIVED_QUERY_ROOTS` に寄せた理由を追記 (4) |
| docs | `docs/subscriptions-screen.md` | P10 の範囲外 4 ファイルの表で「無関係」としていた 2 件 (財務実描画の待ち条件と shard の分割) を、本機能の `verify:full` を安定させるために elegant review で足した変更と書き直した |
| docs | 本受領書 | 判定の記録 |

## 反映しなかった層と理由

- **system-spec**: 変更しない (writer と compile は回さない)。4 点はいずれも HTTP の応答コード・ヘッダ・キャッシュの印の付け方で、
  system-spec の章はこの粒度を持たない。backend 章の「循環と自己統合は例外」は core の純関数 `resolveVendorMerges` の振る舞いで、今も正しい。
  上位の G1 (他画面も同じ名寄せを示す) と不変条件 I3 は変わらず、(4) はそれを満たす側の実装である。
- **features**: 変更しない。`features/feat-subscriptions-merge.md` の goal・scope・acceptance (O1〜O4) は 4 点のどれとも矛盾せず、(4) は O1 の「他画面のサブスク集計が同じ名寄せを示す」を補強する。
- **tasks**: 変更しない。13 本の task spec は応答コードと no-store に触れず、受入の文言も変わらない。
- **graph**: `architecture/graph.json` の `source_digest` は system-spec の章を指し、本受領書の変更では動かない。
  `check-graph-lineage` は 198 ノードすべてが正本と一致する。
  `.dev-graph/state/graph.json` の spec ノードの `confirmation_evidence.evaluated_digest` は、評価した時点の版の記録なので打ち直さない。
  評価の後の spec の変更は、実装で確定した契約の書き戻しであり、`docs/evidence/subscriptions-merge/elegant-review.md` に経緯がある。

## 仕様を実装に合わせて緩めなかった点

- 循環の 422 を消していない。BR-001 を通る限り届かないが、確定の直前の最後の守りとして残し、仕様にもそう書いた。
- 統合後の推定月額は、統合前の推定の和ではなく統合後の明細から推定し直す (反例 2 件を core のテストで固定)。この規則は elegant review の前から仕様の確定節にある。

## 検証結果

MVP のため最小限にした。

- task 仕様書の品質ゲート: `validate-system-plan.py` (P01..P13 の exact 13・DAG・package) と `validate-graph-schema.py` が PASS。
- `pnpm typecheck` と `pnpm lint` が exit 0 (`check-graph-lineage`・`check-migration-approvals`・公開文書の実データ参照チェックを含む)。
- テスト: core 1308 件 (6 件 skip)、web 167 件、api の担当 3 ファイルが成功。
  全体の結果 (web 100 ファイル 1,233 件、API 76 ファイル 1,121 件、財務実描画の単独再検証) は `docs/evidence/subscriptions-merge/elegant-review.md` にある。

## Beads の状態

子 `kanjo-c2t.1` .. `.12` は closed。`kanjo-c2t.13` (配信と migration 0058 の本番適用) と epic `kanjo-c2t` は、PR のマージと Deploy の後に閉じる。

## 残課題

1. 本番 D1 への migration 0058 の適用。`ALTER TABLE … ADD COLUMN` と表の新設だけで、`check-migration-approvals` は承認の必要な破壊的変更を検出しない。main へのマージの後に Deploy が自動で適用する。
2. CI。PR を作った後に確かめる。
3. `docs/subscriptions-screen.md` の「後続課題」の節 (統合元の古いリンクの付け替え、背景の取り直しが 409 busy のときの表示、検査用 vite の `cacheDir` など)。
