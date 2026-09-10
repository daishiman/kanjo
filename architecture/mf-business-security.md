---
graph_node_id: "arch-mf-business-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "MF 事業判定 — 入力検証と脅威"
project_id: "kanjo"
domain: "security"
status: "active"
owners: []
tags: ["mf-business-classification", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-security"]
resource_scope: ["packages/core/src/csv.ts", "packages/core/src/types.ts", "packages/core/src/classify.ts"]
purpose: "入力の保持と比較時正規化の安全境界を定める。"
goal: "取込原本を壊さず、分類根拠だけを必要最小限に露出する。"
scope_in: ["CSV 境界", "比較時 trim", "src"]
scope_out: ["秘密情報", "取込原本のログ出力", "除外リスト"]
acceptance: ["raw data を文書・ログへ複製しない", "trim が保存値を変更しない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-security.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "96053444178396c297587b1bc18328344cf9f5301945414f38f30c87751f5f99", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "入力保持と比較時正規化の安全境界を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-10T06:03:20Z"}
serves_goals: ["G1", "G2", "G4"]
---

# MF 事業判定 — 入力検証と脅威

規範は `specs/spec-mf-business-classification.md`。

- 取込境界の既存文字コード・形状検証を維持する。
- `trim` は比較用の一時値にだけ適用し、取込原本を変更しない。
- 判定根拠 `src` は閉じた enum とし、任意の取込文字列を根拠欄へ反射しない。
- raw production data、行レベル値、秘密情報をログや公開文書へ載せない。

主要リスクは誤分類であり、手動編集を最優先に保つことと根拠表示で回復可能にする。
