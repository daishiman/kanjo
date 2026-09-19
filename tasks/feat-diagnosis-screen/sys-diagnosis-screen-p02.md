---
graph_node_id: "SYS-DIAGNOSIS-SCREEN-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "検知器レジストリ境界と実装アーキテクチャの確定"
project_id: "feature-package-feat-diagnosis-screen"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["SH2-maintainer"]
tags: ["diagnosis", "analysis", "system-dev-plan"]
file_path: "tasks/feat-diagnosis-screen/sys-diagnosis-screen-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "13faf94a21513a4fa3b49d5ee9e526e0ad84bf3e469ca60c900fb479d3be08e6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-diagnosis-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-18T02:13:52Z", "origin_kind": "system-dev-planner", "source_digest": "13faf94a21513a4fa3b49d5ee9e526e0ad84bf3e469ca60c900fb479d3be08e6", "source_path": ".dev-graph/plans/feature-package-feat-diagnosis-screen/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-18T02:13:52Z"
updated_at: "2026-09-18T02:13:52Z"
depends_on: ["SYS-DIAGNOSIS-SCREEN-P01"]
related_nodes: ["spec-diagnosis-screen", "arch-diagnosis-screen"]
resource_scope: ["docs", "packages/core/src"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-diagnosis-screen"
feature_package_id: "feature-package/feat-diagnosis-screen"
phase_ref: "P02"
classification_confidence: 1.0
classification_reason: "確定済み仕様と設計から導かれた単一 phase の実行単位であり artifact_kind=task に一意に定まる。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-diagnosis-screen/sys-diagnosis-screen-p02.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-18T01:57:38Z", "missing_sections": [], "status": "complete"}
---
# P02 検知器レジストリ境界と実装アーキテクチャの確定

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P02
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P02
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p02.md
- depends_on: SYS-DIAGNOSIS-SCREEN-P01

## 目的

ADR-001 の検知器レジストリ境界を実装レベルの型と呼び出し順序へ落とし、packages/web と packages/api が検知器 id を知らない構造を確定する。

## 背景

現行の diagnosis() は科目名を直書きで分岐しており、観点を足すたびに関数本体の編集を強いる。改善余地を金額で並べる仕組みは tradeoffCandidates() に二重に存在する。この 2 つを 1 つのレジストリへ寄せる境界を先に固定しないと、P05 で重複実装が残る。

## 前提条件

- P01 の要件対応表が確定していること。
- packages/core が依存ゼロの純粋関数であるという既存方針を維持できること。

## Workstream applicability

- frontend: applicable: /analysis/diagnosis の画面と子コンポーネント群、searchParams による条件の保持が対象になる。
- backend: applicable: packages/core の純粋関数と packages/api の Dataset 組み立てが対象になる。
- api: applicable: GET /api/diagnosis の拡張と PATCH /api/diagnosis/actions の新設が対象になる。
- data: applicable: D1 の diagnosis_action_states と migration が対象になる。
- infrastructure: applicable: Cloudflare Workers と D1 の既存構成の上で動き、新しいサービスを足さない。
- security: applicable: 未認証 401 と許可リスト方式の 400、プレースホルダ束縛が対象になる。
- quality: applicable: 境界値テスト・contract tests・統合テストと既存 CI ゲートの緑維持が対象になる。
- documentation: applicable: docs/diagnosis-screen.md の計算規則と手順の記載が対象になる。
- operations: applicable: manifest から Migrate APPLY を経て Deploy の順での本番反映が対象になる。

## Architecture and deploy unit

- deploy_unit: documentation
- build_target_kind: application-code
- 構造上の中心は ADR-001 の検知器レジストリであり、packages/web と packages/api は improvements を描画・転送するだけの汎用機構として扱う。
- write_scope: docs, packages/core/src

## 成果物

- 検知器インターフェース id / label / detect の型定義方針。
- Improvement の項目 (id, action_key, label, detail, severity, annualImpact, monthlyImpact, effort, confidence, evidence, nextAction, status) の定義。
- diagnosis() が登録済み検知器を順に回して連結し年間インパクト降順で並べるだけになる呼び出し順序の定義。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- 画面コンポーネント階層の決定。P03 が行う。
- D1 の物理設計。P08 が行う。

## Verification and evidence

- Improvement の各項目が画面の表・ウォーターフォール・詳細パネルのどの表示に使われるか対応づいていること。
- 既存 tradeoffCandidates() の 5 種がレジストリの何番へ寄るか明記されていること。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: documentation 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: 設計節の追記を revert する。実装が未着手のため影響が閉じる。

## Handoff

次 phase P03 (SYS-DIAGNOSIS-SCREEN-P03) へ成果物と判定結果を引き渡す。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
