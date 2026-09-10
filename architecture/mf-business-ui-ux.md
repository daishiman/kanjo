---
graph_node_id: "arch-mf-business-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "MF 事業判定 — 表現物と情報階層"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["mf-business-classification", "ui-ux"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:03:20Z"
updated_at: "2026-09-10T06:03:20Z"
depends_on: ["spec-mf-business-classification"]
related_nodes: ["feat-mf-business-classification", "arch-total-cashflow-ui-ux"]
resource_scope: ["packages/web/src/pages/Classify.tsx", "packages/web/src/pages/analysis/TotalCashflow.tsx"]
purpose: "分類結果、根拠、要確認を混同しない表示規則を定める。"
goal: "利用者が自動判定の根拠と残作業を画面上で区別できる。"
scope_in: ["判定根拠ラベル", "進捗表示", "要確認表示"]
scope_out: ["新規ナビゲーション", "装飾変更", "画面側分類"]
acceptance: ["中項目由来を中項目と表示する", "未確認と自動判定済みを混ぜない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/mf-business-ui-ux.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "canonical-doc-review", "evidence_ref": "specs/spec-mf-business-classification.md", "evaluated_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "d835852b1d3cadf91f2679d08b8472b369775907805c49f3ad381f025ea9fcd3", "imported_at": "2026-09-10T06:03:20Z"}
classification_confidence: 1.0
classification_reason: "ui-ux の情報階層と表示意味を保持する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/mf-business-ui-ux.md"}]
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

# MF 事業判定 — 表現物と情報階層

規範は `specs/spec-mf-business-classification.md`。

- 明細には `cls` と `src` を対で示し、`src=中項目` を手動・ルール・既定と区別する。
- `vendor_memory` は `src` の選択肢に追加せず、materialize 後は `手動` と表示する。由来の調査には `origin` を使う。
- `bySource.中項目` は自動判定済みであり、未確認件数へ含めない。
- 要確認は事業/家計の合計に混ぜず、`reviewCount` と `reviewAmount` を一組で示す。
- 表示側は中項目文字列を再解釈せず、API が返す導出値だけを表示する。

本変更は既存二画面の情報の意味を揃えるもので、新しい画面や操作体系は追加しない。
