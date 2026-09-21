---
graph_node_id: "SYS-CLASSIFY-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "classifyStatus・recommendationFor 拡張・6 API 新設拡張・migration 0046 のワークストリーム設計決定記録"
project_id: "feature-package-feat-classify-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["classify-screen", "p02", "preparation"]
file_path: "tasks/feat-classify-screen/sys-classify-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "7c218fe0d853660e36f0514a16a73caf263ddd8dfe8c20e45ab7eb46dd88d6ce", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-classify-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-19T14:51:41Z", "origin_kind": "system-dev-planner", "source_digest": "7c218fe0d853660e36f0514a16a73caf263ddd8dfe8c20e45ab7eb46dd88d6ce", "source_path": ".dev-graph/plans/feature-package-feat-classify-screen/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-19T14:51:41Z"
updated_at: "2026-09-19T14:51:41Z"
depends_on: ["SYS-CLASSIFY-P01"]
related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
resource_scope: ["docs/classify-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-classify-screen"
feature_package_id: "feature-package/feat-classify-screen"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-classify-screen/sys-classify-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-19T14:35:00Z", "missing_sections": [], "status": "complete"}
---

# classifyStatus・recommendationFor 拡張・6 API 新設拡張・migration 0046 のワークストリーム設計決定記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p02", "preparation"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

classifyStatus（新設 core 純関数）と recommendationFor（overview.ts 拡張）、6 API（bulk・history・rules preview・rules apply・saved-filters GET/POST/DELETE）、migration 0046 の設計決定を、ワークストリームごとに記録する。

## 背景

分類ステータス・信頼度・根拠の判定は core の純関数 1 か所に寄せ、API と画面はそれを呼ぶだけにする。migration は追加のみとし、既存行を書き換えない。ナビのバッジと月次クローズの『仕分け』は異なる母集団を数えている可能性があり、どちらの集合に classifyStatus を当てるかは本 phase で明示的な未決事項として記録し、実装 phase で推測しない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: ナビのバッジ（BR-06）と月次クローズの『仕分け』（BR-07）が数える集合が異なる可能性があり、本 task はこの差異を docs に明記するに留め、確定は行わない。
Open risk: saved_filters・tx_history を JSON バックアップ／復元と deletion-full-reset.ts の全削除対象に含めるかが未決（architecture/classify-database.md の Risk）。本 task はこの未決を docs に明記するに留め、確定は行わない。

## Workstream applicability

- Frontend: N/A: 設計決定の記録のみ
- Backend: applicable: classifyStatus・recommendationFor 拡張・6 API の設計を記録する
- API: applicable: 6 API の応答形と zod 許可リストの設計を記録する
- Data: applicable: migration 0046 の追加のみ方針を記録する
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: canonicalMutationFence 登録対象ルートの設計を記録する
- Quality: applicable: 設計決定が spec の BR-01〜BR-15 と矛盾しないことを確認する
- Documentation: applicable: 設計決定を docs へ記録する
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ（migration 0046 の方針記録に留め、SQL 本体は P05 で作成する）

## 成果物

- Produced artifacts:
- docs/classify-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-classify-screen.md
- architecture/classify-backend.md
- architecture/classify-database.md
- architecture/classify-security.md
- Write scope/touches:
- docs/classify-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- classifyStatus（packages/core/src/classify-status.ts 新設）の入出力と 3 区分の排他規則（BR-01〜BR-03）、信頼度の算出規則（BR-04・BR-05）が docs に書かれている。
- 6 API の応答形と zod 許可リストが spec の API 契約と一致している。
- migration 0046（saved_filters・tx_history の新設、rules への 3 列、tx_edits への 2 列）が追加のみである方針が docs に明記されている。
- バッジと月次クローズの集合の違い、saved_filters・tx_history のバックアップ／全削除対象の未決が docs に明記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/classify-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P01
