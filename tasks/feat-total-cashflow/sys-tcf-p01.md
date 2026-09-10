---
graph_node_id: "SYS-TCF-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "トータル収支の要件と受入条件を機械可読な二値条件へ確定する"
project_id: "feature-package-feat-total-cashflow"
domain: "documentation"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p01"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T21:49:49Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-backend","arch-total-cashflow-database"]
resource_scope: ["specs/total-cashflow-requirements.md","features/feat-total-cashflow.md"]
purpose: "「トータルでいくらプラスマイナスか」を判断できない現状に対し、何が成立すれば解決なのかを 観測可能な二値条件として確定した状態。総支出 == 事業費 + 家計費、総収入 == 事業収入 + 家計収入 の 2 恒等式と、重複消し込みの唯一の判定規則が、後続 phase が参照できる 1 箇所に固定される。"
goal: "トータル収支の要件と受入条件を機械可読な二値条件へ確定する"
scope_in: ["specs/total-cashflow-requirements.md","features/feat-total-cashflow.md"]
scope_out: ["重複判定の実装 (P05 の責務)","freee / Money Forward への新規 API 連携の追加"]
acceptance: ["total-cashflow 2仕様とfeatureがcanonical MF specを参照する", "未判断候補は4区分から除外されreviewCount/reviewAmountへ隔離される", "sameはfreee正本を維持して総額不変である", "differentは独立残余MFとしてresolveTx区分へ加算される", "総収入・総支出の恒等式が判断後も成立する"]
architecture_refs: ["arch-total-cashflow-backend","arch-total-cashflow-database"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P01"
classification_confidence: 1.0
classification_reason: "P01 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-01-requirements に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p01.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","documentation"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-05T21:49:49Z","evidence_refs":["git:d3e0b0675e5e7b0c153efefeeb39b6ca095aeb61","eval-log/tcf-p01-acceptance-verification.json","specs/total-cashflow-requirements.md","features/feat-total-cashflow.md"],"policy":"manual","reconciled_at":null,"source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

# トータル収支の要件と受入条件を機械可読な二値条件へ確定する

本 task は完了済み要件タスクを現実装へ同期したもの。旧意味は retire せず、canonical amendment を取り込んで維持する。

## 固有入力

- `specs/spec-mf-business-classification.md`
- `specs/total-cashflow-requirements.md`
- `specs/spec-total-cashflow-system.md`

## 固有出力

frontmatter の `resource_scope` にある仕様と feature の受入意味を同期する。

## 受入

- 未判断: MF候補を4区分外へ隔離し、`reviewCount` / `reviewAmount` で管理する。
- same: freee正本だけを維持し、総額を変えない。
- different: 独立残余MFとして `resolveTx` の区分へ加算する。
- 判断後も総収入・総支出の恒等式を保つ。

依存、状態、証跡、lineage は frontmatter を正本とする。共通の検証・復旧手順は `docs/mf-business-classification/runbook.md` を参照する。
