---
graph_node_id: "arch-mf-business-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "MF 事業判定 — バックエンド境界"
project_id: "kanjo"
domain: "backend"
status: "active"
owners: []
tags: ["mf-business-classification", "backend"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-backend"]
resource_scope: ["packages/core/src/types.ts", "packages/core/src/classify.ts", "packages/core/src/total-cashflow.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/total-cashflow.ts"]
purpose: "MF 事業判定の依存方向と共通解決器の境界を定める。"
goal: "分類知識を一箇所に保ち、集計側の独自判定を防ぐ。"
scope_in: ["isMfBizByMid", "resolveIncomingTx", "resolveTx", "classificationProgress", "total-cashflow 集計"]
scope_out: ["永続スキーマ", "認証", "画面レイアウト"]
acceptance: ["total-cashflow が resolveTx を介して分類する", "分類優先順位が canonical contract と一致する"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-backend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "8ef2dbf6dd24ac4e3884e328fcddb7bc711b21f9e4c54d0b6f760284746baf44", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "backend の依存方向と resolver 境界を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-backend.md"}]
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

# MF 事業判定 — バックエンド境界

規範は `specs/spec-mf-business-classification.md`。本書は依存方向だけを定める。

```text
types.isMfBizByMid
  -> classify.resolveIncomingTx
  -> classify.resolveTx
  -> classify route / total-cashflow
```

- `isMfBizByMid` は比較時 trim と接頭辞比較だけを担当する。
- `resolveIncomingTx` は `rule > vendor_memory > mf_mid > default`、`resolveTx` は通常手動をその上へ重ねる。
- `total-cashflow.ts` は `isMfBizByMid` を直接参照せず、`resolveTx` への間接依存にする。
- core の `clsSrc` は内部根拠名。API route が wire key `src` へ写像する。
- `ClassificationSource` と `ClassificationProgress` は core を型正本とし、web の重複宣言を持たない。
- 要確認 MF 投影も `cls` / `clsSrc` を保持し、公私仕分けと同じ解決結果を使う。
- 月次集計は明細ごとの解決結果を一度作り、月ループ内で再判定しない。

却下した構成は、集計側で中項目を再比較する二本目の判定と、表示側で分類を再構成する方式。どちらも優先順位と正本を分裂させる。
