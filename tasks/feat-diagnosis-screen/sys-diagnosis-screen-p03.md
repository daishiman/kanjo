---
graph_node_id: "SYS-DIAGNOSIS-SCREEN-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "画面構成と API 契約の設計レビュー"
project_id: "feature-package-feat-diagnosis-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["SH2-maintainer"]
tags: ["diagnosis", "analysis", "system-dev-plan"]
file_path: "tasks/feat-diagnosis-screen/sys-diagnosis-screen-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "13faf94a21513a4fa3b49d5ee9e526e0ad84bf3e469ca60c900fb479d3be08e6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-diagnosis-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-18T02:13:52Z", "origin_kind": "system-dev-planner", "source_digest": "13faf94a21513a4fa3b49d5ee9e526e0ad84bf3e469ca60c900fb479d3be08e6", "source_path": ".dev-graph/plans/feature-package-feat-diagnosis-screen/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-18T02:13:52Z"
updated_at: "2026-09-18T02:13:52Z"
depends_on: ["SYS-DIAGNOSIS-SCREEN-P02"]
related_nodes: ["spec-diagnosis-screen", "arch-diagnosis-screen"]
resource_scope: ["docs"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-diagnosis-screen"
feature_package_id: "feature-package/feat-diagnosis-screen"
phase_ref: "P03"
classification_confidence: 1.0
classification_reason: "確定済み仕様と設計から導かれた単一 phase の実行単位であり artifact_kind=task に一意に定まる。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-diagnosis-screen/sys-diagnosis-screen-p03.md", "confidence": 1.0}]
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
# P03 画面構成と API 契約の設計レビュー

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P03
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P03
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p03.md
- depends_on: SYS-DIAGNOSIS-SCREEN-P02

## 目的

画面 11 ブロックの構成と 2 endpoint の契約を、P02 の境界と矛盾しないことを確かめたうえでレビュー通過させる。

## 背景

画面は期間タブ・問いの見出し・条件の帯・診断結果カード・健全性カード・主なシグナル・改善アクションの表・ウォーターフォール・診断根拠の表・完了すると変わる指標・詳細パネル・選択バーを持つ。ブロック数が多く、1 ファイルに詰め込むと以降の phase で手が入らなくなる。

## 前提条件

- P02 の検知器レジストリ境界が確定していること。
- design/FINAL-UI のトークンと既存共通部品 (KpiCard / PageState / DataTable / PageShell / Button) が参照できること。

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
- write_scope: docs

## 成果物

- 画面コンポーネント階層と子コンポーネントの分割単位。
- GET /api/diagnosis の返却形状と PATCH /api/diagnosis/actions の入出力形状のレビュー記録。
- searchParams に載せる条件 (期間・範囲・指標・比較対象・選択行・畳み) の一覧。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- 実装コードの記述。P05 が行う。
- テストの記述。P04 が行う。

## Verification and evidence

- 返却形状が spec の API契約節と一致すること。
- 色と余白の直書きが設計上発生しないことをレビューで確認すること。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: documentation 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: レビュー記録の追記を revert する。

## Handoff

次 phase P04 (SYS-DIAGNOSIS-SCREEN-P04) へ成果物と判定結果を引き渡す。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
