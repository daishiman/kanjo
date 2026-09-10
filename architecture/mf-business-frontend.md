---
graph_node_id: "arch-mf-business-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "MF 事業判定 — フロントエンド境界"
project_id: "kanjo"
domain: "frontend"
status: "active"
owners: []
tags: ["mf-business-classification", "frontend"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-frontend"]
resource_scope: ["packages/web/src/api.ts", "packages/web/src/pages/Classify.tsx", "packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/api/src/routes/classify.ts", "packages/api/src/routes/total-cashflow.ts"]
purpose: "API wire 値と表示の写像境界を定める。"
goal: "画面が分類を再計算せず、サーバーの導出値と根拠をそのまま示す。"
scope_in: ["GET /api/transactions", "GET /api/total-cashflow", "src", "bySource", "reviewAmount"]
scope_out: ["新規 route", "画面側集計", "モバイル専用画面"]
acceptance: ["公開 route と key が canonical contract と一致する", "中項目 enum を型と表示が網羅する"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-frontend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "c0e51ae2eff4d0c53e4008887db4a39f6a508fa74c3422c32bf0fda0fd3cd31b", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "frontend の wire と表示境界を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-frontend.md"}]
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

# MF 事業判定 — フロントエンド境界

規範は `specs/spec-mf-business-classification.md`。

- 公私仕分けの取得 route は `GET /api/transactions`。
- 明細行は内部名 `clsSrc` ではなく wire key `src` を返す。
- 集約は `summary.progress.bySource` に置く。
- web は core の `ClassificationSource` / `ClassificationProgress` を共有し、`手動 | ルール | 中項目 | 既定` を重複宣言しない。
- 取引先メモリを materialize した明細の wire `src` は `手動`。必要な由来は `origin=vendor_memory` で保持し、独立した表示 enum を増やさない。
- トータル収支は `reviewCount` と `reviewAmount` をサーバー応答から表示し、画面で再集計しない。

`中項目` の追加と `reviewPending` の意味変化は意図した互換性変更であり、単なるフィールド追加とは記録しない。
