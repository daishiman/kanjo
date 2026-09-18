---
graph_node_id: "SYS-DIAGNOSIS-SCREEN-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "診断画面の要件確定と受入条件の分解"
project_id: "feature-package-feat-diagnosis-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["SH2-maintainer"]
tags: ["diagnosis", "analysis", "system-dev-plan"]
file_path: "tasks/feat-diagnosis-screen/sys-diagnosis-screen-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "13faf94a21513a4fa3b49d5ee9e526e0ad84bf3e469ca60c900fb479d3be08e6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-diagnosis-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-18T02:13:52Z", "origin_kind": "system-dev-planner", "source_digest": "13faf94a21513a4fa3b49d5ee9e526e0ad84bf3e469ca60c900fb479d3be08e6", "source_path": ".dev-graph/plans/feature-package-feat-diagnosis-screen/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-18T02:13:52Z"
updated_at: "2026-09-18T02:13:52Z"
depends_on: []
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
phase_ref: "P01"
classification_confidence: 1.0
classification_reason: "確定済み仕様と設計から導かれた単一 phase の実行単位であり artifact_kind=task に一意に定まる。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-diagnosis-screen/sys-diagnosis-screen-p01.md", "confidence": 1.0}]
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
# P01 診断画面の要件確定と受入条件の分解

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P01
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P01
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p01.md
- depends_on: なし (本 feature の起点 phase)

## 目的

診断画面 08-diagnosis の FR-001 から FR-011、BR-001 から BR-009、AC-001 から AC-006 を実装可能な粒度へ分解し、以降 12 phase が参照する単一の要件表を確定する。

## 背景

既存の診断タブは科目別の統計プロファイルと自動診断の箇条書きだけを出しており、改善余地の優先順位・年間インパクト・対応の手間・対応状況・根拠・健全性スコアを持たない。仕様と設計は確定済みだが、どの要件がどの成果物に落ちるかの対応表が無いままでは実装が分散する。

## 前提条件

- specs/spec-diagnosis-screen.md が confirmed かつ evaluation_status=pass であること。
- architecture/arch-diagnosis-screen.md が confirmed であること。
- system-spec/index.md の確定 8 章が読める状態であること。

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

- docs/diagnosis-screen.md の要件節 (FR/BR/AC と成果物の対応表)。
- 6 種の検知器 (固定費の見直し / 急増した費目 / 重複支払いの候補 / サブスクの重複候補 / 未分類明細 / 通信費の見直し) の入力と出力の定義。
- 健全性スコア 4 要素と重み 30/30/25/15 の算式定義。
- spec と architecture が migration の置き場所を packages/api/migrations と記す誤記の訂正。実体は repository 直下の migrations であり、packages/api/wrangler.jsonc の migrations_dir が ../../migrations を指すことを根拠とする。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- 検知器の実装そのもの。P05 が行う。
- テストコードの記述。P04 と P06 が行う。

## Verification and evidence

- FR-001 から FR-011 の全項目が対応表の行として存在すること。
- AC-001 から AC-006 の各受入条件に検証手段が 1 つ以上割り当たっていること。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: documentation 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: docs/diagnosis-screen.md の当該追記を revert する。コードと D1 に影響しない。

## Handoff

次 phase P02 (SYS-DIAGNOSIS-SCREEN-P02) へ成果物と判定結果を引き渡す。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
