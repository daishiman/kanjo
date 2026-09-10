---
graph_node_id: "arch-mf-business-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "MF 事業判定 — 運用と文書"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
owners: []
tags: ["mf-business-classification", "maintenance"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-maintenance-ops"]
resource_scope: ["specs/spec-mf-business-classification.md", "docs/spec-v1.1.md", "docs/data-schema.md", "docs/mf-business-classification/runbook.md"]
purpose: "文書の責務と運用上の切り分け先を定める。"
goal: "規則の重複を防ぎ、変更時に一つの正本だけを更新する。"
scope_in: ["canonical contract", "runbook", "検証記録", "復旧用語"]
scope_out: ["実データ証跡の公開", "除外リスト設定"]
acceptance: ["規則の再掲がない", "参照先が実在する", "復旧用語が区別される"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "696083a21c3ae1034c1eeff2c8db92cb2c3e7c7f499f57ee1f89360da74df3a2", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "正本、検証、運用の文書責務を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-maintenance-ops.md"}]
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

# MF 事業判定 — 運用と文書

規範は `specs/spec-mf-business-classification.md`。運用手順は `docs/mf-business-classification/runbook.md`、検証結果は `docs/mf-business-classification/test-run.md`、リリース判断は `docs/mf-business-classification/close-out.md` に分離する。

判定が想定と違う場合は、`GET /api/transactions` の `src` を見て `手動 / ルール / 中項目 / 既定` のどの経路かを切り分ける。中項目の具体名や実データ値を運用文書へ複製しない。

変更時は canonical contract と契約テストを先に更新し、architecture 文書へ規則本文をコピーしない。
