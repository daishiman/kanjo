---
graph_node_id: "arch-mf-business-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "MF 事業判定 — データ境界"
project_id: "kanjo"
domain: "database"
status: "active"
owners: []
tags: ["mf-business-classification", "data"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-database"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations/", "packages/core/src/types.ts"]
purpose: "取込原本、利用者判断、導出分類の保存境界を定める。"
goal: "規則変更をデータ移行へ結合させず、利用者判断だけを永続化する。"
scope_in: ["mf_transactions", "tx_edits", "要求時導出"]
scope_out: ["新規テーブル", "分類結果列", "月次集計の永続化"]
acceptance: ["DB migration が不要である", "取込中項目を保存時に trim しない", "既存手動編集を再評価しない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-database.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "2fe5bbedace90f133275f839664b0b31ff7394e29f0ef4495cbed932e6816c0e", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "data の保存境界と導出方針を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-10T06:03:20Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# MF 事業判定 — データ境界

規範は `specs/spec-mf-business-classification.md`。

- MF の中項目は取込原本として保持し、保存時には正規化しない。
- 前後空白の吸収は `isMfBizByMid` の比較時だけ行う。
- 自動分類結果と月次集計は保存せず、要求時に導出する。
- 通常手動と取引先メモリ由来の判断は既存 `tx_edits` で保持する。
- 本変更に DB migration、backfill、既存編集の再評価はない。

これにより判定規則の版と取込原本を分離し、版の巻き戻しをデータ復元なしで行える。
