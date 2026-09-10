---
graph_node_id: "arch-mf-business-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "MF 事業判定 — 実行環境と配信"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
owners: []
tags: ["mf-business-classification", "infrastructure"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-infrastructure"]
resource_scope: ["packages/api/wrangler.jsonc", ".github/workflows/"]
purpose: "本 feature による配信・binding・migration の差分を定める。"
goal: "既存配信経路を変えず、版単位で復旧可能にする。"
scope_in: ["既存 CI/CD", "版の巻き戻し"]
scope_out: ["新規 binding", "migration", "secret", "実行時 feature flag"]
acceptance: ["配信設定差分がない", "git revert と通常配信で前版へ戻せる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-infrastructure.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "d13ad4a5a60401079275bbaccb6a9ef671f0118ae7db6f7f44f42c248e5854d7", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "配信差分と復旧境界を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-10T06:03:20Z"}
serves_goals: ["G2", "G3"]
---

# MF 事業判定 — 実行環境と配信

規範は `specs/spec-mf-business-classification.md`。

新しい Worker、binding、secret、migration はない。既存のテスト・preview・CI/CD 経路で同一版を配信する。

- **版の巻き戻し**は feature のコミットを `git revert` して通常経路で再公開する。
- **MF 中項目判定の部分無効化**は別のコード変更であり、rollback ではない。
- 実行時 feature flag は本 feature の範囲外。
