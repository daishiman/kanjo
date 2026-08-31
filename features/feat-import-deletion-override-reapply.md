---
graph_node_id: "feat-import-deletion-override-reapply"
artifact_kind: "feature"
artifact_subtypes: []
title: "取込データの削除・上書きと手当ての継続再適用"
project_id: "kanjo"
domain: "accounting-records"
status: "draft"
owners: []
tags: ["import", "deletion", "undo", "audit", "three-way-merge", "vendor-memory"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-31T00:00:00Z"
updated_at: "2026-08-31T00:00:00Z"
depends_on: []
related_nodes: ["arch-import-deletion-undo-boundary", "arch-override-reapply-three-way-merge", "spec-import-deletion-override-reapply", "tasks-import-deletion-override-reapply", "spec-transaction-splits", "spec-attachments-transit"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-import-deletion-override-reapply.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "manual-review", "evidence_ref": "system-spec/archive/2026-08-31-import-deletion-override-reapply/spec-state.json", "evaluated_digest": null}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-08-31-import-deletion-override-reapply/spec-state.json", "source_version": "1.0", "source_digest": "9246668a4814cd0e589efacb5f8b9a22ac196e4fccf3dd37490f3529d0f14027", "imported_at": "2026-08-31T00:00:00Z"}
classification_confidence: 1.0
classification_reason: "1画面への追加・10APIの新設・複数migrationを束ねる利用者向け機能単位であるため feature 層。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"issue_id": "kanjo-m2m", "external_ref": "dev-graph:feat-import-deletion-override-reapply", "issue_type": "epic", "status": "open"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": ["tasks/import-deletion-override-reapply-tasks.md"]}
implementation_readiness: {"status": "blocked", "missing_sections": ["vendor_memory の confidence 算出式と初期閾値", "core/classify.ts の conflict を属性単位へ作り替える範囲の見積り", "既存明細への base 埋め移行の経路と検証", "undo 退避行の保持期間の具体値"], "checked_at": "2026-08-31T00:00:00Z"}
purpose: "取り込んだあとに取込元が動く以上、帳簿を最新へ収束させる手段が要る。いま削除APIは1本も無く、上書きの選択肢は月単位までしか無く、3点比較は科目2属性の衝突検出で止まっていて解決する経路が無い。消す・選ぶ・戻すを利用者の手に渡し、一度した手当てを二度させない。"
goal: "取込単位・期間単位・種別単位・全件の4粒度で消せ、実行前に巻き添えを見せ、実行後に戻せる。取込のたびの3点比較で手当てが自動的に維持され、真の衝突だけが行として提示され、取引先単位の決め事が蓄積して問われる件数が逓減する。"
scope_in: ["取込単位/期間/種別/全件の4粒度削除", "実行前 preflight と確認指紋", "D1退避テーブルによる undo と有限保持", "削除・上書きの監査記録", "取込実行前の差分プレビュー", "base/current/incoming の3点比較による手当ての継続再適用", "tx_edits への base_cls / base_owner / stable_key 追加", "core/classify.ts の conflict を属性単位の3分岐へ作り替え", "取引先単位の決め事(vendor_memory)と確信度", "決め事の一覧・取消・pin・再判定"]
scope_out: ["freee・マネーフォワード側のデータ変更", "Time Travel を undo の代替とすること", "overrides テーブルの復活", "既存の月単位洗い替え・POST /restore の挙動変更", "分割記帳そのものの不変条件", "証憑原本の lifecycle"]
acceptance: ["取込履歴から任意の取込を取り消せ、その import_id を参照する行が0件になり、他の取込由来の明細が1件も減らない", "月・期間・種別・全件を指定した削除で指定範囲外のデータが1件も変化しない", "削除の確認画面に対象件数・対象期間・巻き添えになる手動記録の件数が出る", "確認指紋が一致しない実行が409で拒否され、状態が動かない", "実行直後の取り消しで各テーブルの行数と内容が実行前と完全に一致する", "保持期間を過ぎた undo が410で拒否され、退避行が掃除されている", "削除後に import_active_targets の指紋が巻き戻り、同じファイルを duplicate にならず入れ直せる", "監査記録に操作種別・範囲・件数・日時が残り、明細本体・金額がログとエラー応答に含まれない", "base == incoming の属性で手当てが維持され、双方が変わった属性だけが衝突として提示される", "MF側で tx_id が振り直されても stable_key で手当てが追随する", "適用の優先順位が tx_edits > rules > vendor_memory > 取込原本値 の順で解決される", "確信度が閾値未満の決め事は自動適用されず候補提示に留まり、取り消すと再判定で戻せる", "通常幅5,000行の取込に対する3点比較と書戻しが 49 D1 queries 以内に収まる", "削除・上書きが freee・マネーフォワード側へ一切波及しない"]
architecture_refs: ["arch-import-deletion-undo-boundary", "arch-override-reapply-three-way-merge"]
---

# 目的

取込元は生きたサービスである。freee・マネーフォワードの側で科目名が変わり、項目名が直され、
明細が足され、金額が修正される。取り込んだあとに元が動く以上、帳簿を最新へ収束させる手段が要る。

いま欠けているのは3つ。

1. **消す手段が1つも無い。** 取込APIは `POST /imports` / `GET /imports` /
   `GET /imports/:id/original` / `POST /restore` の4本だけで、削除系が1本も無い。
   月単位の洗い替えは取込の副作用であって、利用者が意図して選べる操作ではない。
2. **上書きの選択肢が月単位までしか無い。** `keepOnShrink`(件数が減る月は取り込まず
   前回の内容を残す)で利用者が選べる経路は既にある。無いのは明細単位・項目単位の判断と、
   何がどう変わるかを実行前に見る手段である。
3. **衝突の検出で止まっている。** `tx_edits` の `base_major` / `base_mid` から
   `core/classify.ts` が `conflict` を算出し、`Classify.tsx` が「編集済み・取込値が変更」まで
   出している。だが**科目2属性だけ**で、`cls`(公私)と `owner`(名義)には base が無い。
   そして検出したあとに**解決する経路が無い**ため、一度直した手当ては次の取込で消える。

# 到達状態

取込画面から、取込単位・期間・種別・全件のいずれの粒度でも消せる。
実行前に対象件数・対象期間・**巻き添えになる手動記録の件数**が出る。
実行後は保持期間内なら戻せ、戻したあとの各テーブルの行数と内容は実行前と一致する。

取込のたびに前回取込原本値(base)・利用者の手当て(current)・新しい取込原本値(incoming)の
3つを比べ、自動で決まる分は件数の要約だけを見せて黙って通す。
行として出るのは真の衝突と、確信度が閾値未満の決め事候補の2種類だけ。

同じ取引先の同じ判断は決め事として蓄積し、確信度が閾値を超えたら問わずに適用する。
決め事は一覧で見え、取り消せ、常に適用する指定ができ、過去の自動適用を再判定で戻せる。

# スコープ

- スコープ内: `scope_in` のとおり。新しい最上位画面は作らず、取込画面
  (`packages/web/src/pages/Import.tsx`)へ足す。
- スコープ外: `scope_out` のとおり。**削除は取込元へ波及しない。**
  この機能が消すのは、このシステムが取り込んだ複製だけである。

# 受入

`acceptance` の14件。仕様側の全27件は `specs/import-deletion-and-override-reapply.md` の
「受入」を正とし、証拠の対応は `tasks/import-deletion-override-reapply-tasks.md` が持つ。

# アーキテクチャ参照

- `architecture_refs`: `arch-import-deletion-undo-boundary` / `arch-override-reapply-three-way-merge`
- 詳細仕様: `specs/import-deletion-and-override-reapply.md`
- 要件正本: `system-spec/archive/2026-08-31-import-deletion-override-reapply/spec-state.json` および `system-spec/archive/2026-08-31-import-deletion-override-reapply/*.md`
- 製品正本: `docs/spec-v1.1.md` FR-01 / P8
- 永続形状: `docs/data-schema.md`

# 機能間依存

- `depends_on`: (なし)。既存の `spec-transaction-splits` / `spec-attachments-transit` は
  完了を待つ関係ではなく、**巻き添えにしない対象**として参照する関係にある。

# 実装着手前に決めること

`implementation_readiness.status: blocked`。詳細と背景は
`specs/import-deletion-and-override-reapply.md` の「未決事項」を正とする。

1. `vendor_memory` の confidence 算出式・初期閾値・段階的緩和基準が未数値化。
   このため「利用者へ問う件数を逓減させる」という上位目標に測定基準が無い。
2. `core/classify.ts` の `conflict` を属性単位へ作り替える範囲が未見積り。
   戻り値型が変わり `routes/classify.ts` / `Classify.tsx` / 既存テストへ波及する。
3. 既存明細への base 埋め移行処理の経路と検証方法が未着地。
   移行前の明細は全属性が「利用者が触っていない」扱いになるおそれがある。
4. undo 退避行の保持期間の具体値が未定。D1 Free の 500 MB と
   rows written 10万/日 に対する1日あたり削除規模の見積りも未実施。
