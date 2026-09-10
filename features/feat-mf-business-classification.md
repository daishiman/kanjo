---
graph_node_id: "feat-mf-business-classification"
artifact_kind: "feature"
artifact_subtypes: []
title: "MF 中項目による事業振り分け"
project_id: "kanjo"
domain: "mf-business-classification"
status: "active"
owners: []
tags: ["mf-business-classification", "feature"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-09-10T06:05:56Z"
updated_at: "2026-09-10T06:05:56Z"
depends_on: ["spec-mf-business-classification", "feat-total-cashflow"]
related_nodes: ["arch-mf-business-backend", "arch-mf-business-database", "arch-mf-business-frontend", "arch-mf-business-ui-ux", "arch-mf-business-auth", "arch-mf-business-security", "arch-mf-business-infrastructure", "arch-mf-business-maintenance-ops"]
resource_scope: ["packages/core/src/types.ts", "packages/core/src/classify.ts", "packages/core/src/total-cashflow.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/total-cashflow.ts", "packages/web/src/api.ts", "packages/web/src/pages/Classify.tsx", "packages/web/src/pages/analysis/TotalCashflow.tsx", "docs/spec-v1.1.md", "docs/data-schema.md"]
purpose: "MF 中項目に込めた分類意思を、既存の手動判断を保ちながら公私仕分けとトータル収支へ一貫して反映する。"
goal: "単一解決器、追跡可能な根拠、二重計上のない集計を実装する。"
scope_in: ["比較時 trim を行う isMfBizByMid", "manual > rule > vendor_memory > mf_mid > default", "resolveTx による共通解決", "src と bySource の中項目根拠", "reviewCount と reviewAmount"]
scope_out: ["DB マイグレーション", "新規 API", "認証変更", "実行時 feature flag", "既存手動編集の再評価"]
acceptance: ["canonical contract の受入条件を匿名化 fixture で固定する", "既存トータル収支の消し込み契約を維持する", "公開 wire と UI が中項目根拠を網羅する"]
architecture_refs: ["arch-mf-business-backend", "arch-mf-business-database", "arch-mf-business-frontend", "arch-mf-business-ui-ux", "arch-mf-business-auth", "arch-mf-business-security", "arch-mf-business-infrastructure", "arch-mf-business-maintenance-ops"]
parent_feature: "feat-total-cashflow"
feature_package_id: null
phase_ref: null
file_path: "features/feat-mf-business-classification.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f88998635cdf9dd3a7e6be3e6f2a59cd92cda235ef285ca317e0808582525885"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-mf-business-classification.md", "source_version": "0.1.11", "source_digest": "ff8ea4da84e164fc17911b506ebabc5b828669ff384b205d0bfee0e61f8f286c", "imported_at": "2026-09-10T06:05:56Z"}
classification_confidence: 1.0
classification_reason: "canonical specification を既存 total-cashflow feature へ適用する単一の実装差分。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-mf-business-classification.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-10T06:05:56Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# MF 中項目による事業振り分け

## 規範

要件、優先順位、wire 契約、互換性、復旧方法の正本は `specs/spec-mf-business-classification.md`。本書は実装差分と依存だけを持つ。

## 実装差分

- `packages/core/src/types.ts`: 比較時 trim を行う `isMfBizByMid`。
- `packages/core/src/classify.ts`: `manual > rule > vendor_memory > mf_mid > default` の共通解決、`clsSrc`、共有型 `ClassificationSource` / `ClassificationProgress`。
- `packages/core/src/total-cashflow.ts`: 中項目を直接再判定せず、`resolveTx` の結果を再利用。要確認 MF 投影にも `cls` / `clsSrc` を含める。
- `packages/api/src/routes/classify.ts`: `GET /api/transactions` の `src` と `summary.progress.bySource`。
- `packages/api/src/routes/total-cashflow.ts`: 同じ要確認集合から導出した `reviewCount` と `reviewAmount`。
- `packages/web/src/api.ts` と画面: core の共有型を使い、`中項目` を表示。

## 依存

`feat-total-cashflow` が提供する消し込み・残余加算・要確認の仕組みを変更せず利用する。MF 事業判定は `spec-mf-business-classification` に従い、領域別の配置は関連 architecture node を参照する。

## 検証と状態

受入条件は正本仕様をテストへ写し、状態はこのファイルの frontmatter だけで管理する。本文に二重の完了チェックリストを置かない。検証記録は `docs/mf-business-classification/test-run.md`、リリース判断は `docs/mf-business-classification/close-out.md` に分離する。

## Handoff

次工程は `specs/spec-mf-business-classification.md` と本書だけを規範入力にする。数値ベースラインや取込原本を dev-graph artifact へ複製しない。
