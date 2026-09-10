---
graph_node_id: "arch-mf-business-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "MF 事業判定 — 認証境界"
project_id: "kanjo"
domain: "auth"
status: "active"
owners: []
tags: ["mf-business-classification", "auth"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-auth"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/src/index.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/total-cashflow.ts"]
purpose: "既存認証境界の内側でのみ分類根拠を返すことを確認する。"
goal: "新しい主体、権限、未認証入口を増やさない。"
scope_in: ["既存 /api auth guard", "既存 route"]
scope_out: ["認証方式変更", "ロール追加", "公開 route"]
acceptance: ["新規 endpoint がない", "対象 route が既存 auth guard の内側にある"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-auth.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "af72f5ae696d778cf43742b746026376215565ba28a46de52e7b930b480f4567", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "既存認証境界内に閉じる差分を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-10T06:03:20Z"}
serves_goals: ["G2"]
---

# MF 事業判定 — 認証境界

規範は `specs/spec-mf-business-classification.md`。

新しい endpoint、主体、権限区分は追加しない。`GET /api/transactions` と `GET /api/total-cashflow` は既存の `/api/*` 認証ガード内に留まる。`src` は利用者自身の分類理由であり、認証情報や他利用者のデータを含めない。

本 feature は認証方式を変更しない。認証の一般仕様は `system-spec/auth.md` が担い、本書へ複製しない。
