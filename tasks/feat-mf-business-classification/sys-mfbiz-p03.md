---
graph_node_id: "SYS-MFBIZ-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "設計レビュー"
project_id: "feature-package-feat-mf-business-classification"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["mf-business-classification", "p03"]
file_path: "tasks/feat-mf-business-classification/sys-mfbiz-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ef652163d41be684af57c868d8e8ac2f2aa25803eec7569d8d97ed5916d3dbd7", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-mf-business-classification/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-10T06:39:55Z", "origin_kind": "system-dev-planner", "source_digest": "35bd61a897bfcc6792593301672f00505994e9f922ed29b88ca293eba01f0a78", "source_path": ".dev-graph/plans/feature-package-feat-mf-business-classification/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-10T06:39:55Z"
updated_at: "2026-09-10T06:39:55Z"
depends_on: ["SYS-MFBIZ-P02"]
related_nodes: ["spec-mf-business-classification", "arch-mf-business-backend", "arch-mf-business-maintenance-ops"]
resource_scope: ["docs/mf-business-classification/design-review.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-mf-business-classification"
feature_package_id: "feature-package/feat-mf-business-classification"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-mf-business-classification/sys-mfbiz-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-10T06:35:11Z", "missing_sections": [], "status": "complete"}
---

# 設計レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

## 目的

core / API / web の責務境界を design-review で検証する。

## 背景

共通規則は `specs/spec-mf-business-classification.md` を参照。

## 前提条件

P02 の決定。依存IDは frontmatter の `depends_on` を参照。

## Workstream applicability

対象は frontmatter の `resource_scope` のみ。

## Architecture and deploy unit

`architecture/mf-business-*.md` を再利用し、新規deploy unitなし。

## 成果物

core / API / web の責務境界を design-review で検証する。

## Tracker publication and completion

tracker・状態・証跡は frontmatter で管理。

## Branch and worktree execution

共有worktreeの担当資源だけを変更。

## スコープ外

canonical spec の `scope_out` と担当資源外。

## Verification and evidence

wire/internal名と復旧用語を混同しない。

## Rollout and rollback

共通手順は `docs/mf-business-classification/runbook.md` を参照。

## Handoff

後続は成果物と frontmatter の依存辺を参照。

## 参照情報

canonical spec、共有runbook、生成先 task。
