---
graph_node_id: "feat-transaction-split-readability"
artifact_kind: "feature"
artifact_subtypes: []
title: "明細の分割記帳と、その科目を読める形で選ばせること"
project_id: "kanjo"
domain: "accounting-records"
status: "draft"
owners: []
tags: ["splits", "classify", "ui"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T00:00:00Z"
updated_at: "2026-08-30T00:00:00Z"
depends_on: []
related_nodes: ["arch-transaction-split-projection", "spec-transaction-splits", "tasks-transaction-split-readability"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-transaction-split-readability.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "manual-review", "evidence_ref": "tasks/transaction-split-readability-tasks.md", "evaluated_digest": null}
source_lineage: {"origin_kind": "manual", "source_plugin": null, "source_path": "docs/spec-v1.1.md", "source_version": "1.1", "source_digest": null, "imported_at": "2026-08-30T00:00:00Z"}
classification_confidence: 1.0
classification_reason: "1画面・複数API・1migration・投影ロジックを束ねる利用者向け機能単位であるため feature 層。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"issue_id": "kanjo-17k", "external_ref": "dev-graph:feat-transaction-split-readability"}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": ["tasks/transaction-split-readability-tasks.md"]}
implementation_readiness: {"status": "ready", "missing_sections": [], "checked_at": "2026-08-30T00:00:00Z"}
purpose: "1件の引き落としに複数の用途が混ざっていると、科目を1つしか選べない現状では中身が永久に分からない。用途ごとに割れるようにし、割った結果を集計まで届ける。"
goal: "明細を内訳2〜50行へ割れ、合計が元の金額と1円も違わないことを保存前に保証し、内訳の科目・公私が家計の科目別・名義別・事業立替・証憑棚卸しへそのまま届く。科目は小窓ではなく読める大きさで選べる。"
scope_in: ["tx_splitsの永続と検証", "金額入力と割合入力(保存は金額のみ)", "最大剰余法による端数配分", "内訳ごとの公私・科目", "projectAccountingDatasetによる集計への投影", "fail-closedと要確認状態の可視化", "親取引への証憑添付と棚卸しの畳み込み", "分割エディタの表示(科目パネルを浮かせない)"]
scope_out: ["freee帳簿への事業科目別の書き戻し", "内訳ごとの証憑添付", "identity_stable=0の明細の分割", "本番deploy"]
acceptance: ["合計が親と1円でも違う内訳が保存されない", "端数のある割合分割でも合計が親と一致する", "家計の科目別支出が親1行ではなく内訳の科目で積まれる", "名義が親から引き継がれ内訳ごとに選び直させない", "事業にした内訳が事業立替へ回り家計の科目別から外れる", "合計不一致の内訳は集計に出ず親の金額のまま数える", "証憑棚卸しが子行を親へ畳み内訳の科目を併記する", "開いた科目パネルが分割エディタ内部のoverflowで切られない", "狭幅で科目ボタンのタップ領域が確保される", "lint・typecheck・core/api/web の単体と実描画回帰がPASSする"]
architecture_refs: ["arch-transaction-split-projection"]
---

# 目的

仕分け画面の「未分類 10万円」は、銀行がそう記録しているというだけで、
中身が1つの用途だとは限らない。電気代・携帯・税金がまとまって引き落とされていても、
科目を1つしか選べなければ、その内訳はどこにも残らない。

この feature は2つのことをする。**割れるようにすること**と、
**割った結果を集計まで届けること**。片方だけでは意味がない。
画面上でだけ分かれていて家計簿が「未分類10万円」のままなら、分けた意味がないからである。

# 範囲

- 永続: `tx_splits`(migration 0025)。親金額のスナップショットと `line_id` を持つ
- 投影: `projectAccountingDataset()` が親1行を内訳N行へ置き換える。ここが唯一の合流点
- 検証: 合計一致・行数・整数・科目必須。合わないものは保存させず、集計にも出さない
- 表示: 残額の常時表示と、分割エディタ内で浮かせない科目パネル

規範詳細は [`specs/transaction-splits.md`](../specs/transaction-splits.md)、
境界の判断は [`architecture/arch-transaction-split-projection.md`](../architecture/arch-transaction-split-projection.md)。

# 対象外の理由

- **freee帳簿への書き戻し**: 事業科目別の正本を2つ持つことになり、二重計上を招く
- **内訳ごとの証憑添付**: 領収書は1枚。添付先がN個できるとどれが正か決まらない
- **`identity_stable=0` の分割**: 行の同一性が保証できないため、再取込を案内する
