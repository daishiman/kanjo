---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-tradeoff-screen/sys-tradeoff-p03.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-tradeoff-screen/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T22:58:32Z"
depends_on: ["SYS-TRADEOFF-P02"]
domain: "quality"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-tradeoff-screen"
file_path: "tasks/feat-tradeoff-screen/sys-tradeoff-p03.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-TRADEOFF-P03"
implementation_readiness: {"checked_at": "2026-09-21T22:55:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-tradeoff-screen"
phase_ref: "P03"
priority: null
project_id: "feature-package-feat-tradeoff-screen"
pull_request_linkages: []
related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
resource_scope: ["docs/tradeoff-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
source_lineage: {"imported_at": "2026-09-21T22:58:32Z", "origin_kind": "system-dev-planner", "source_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "source_path": ".dev-graph/plans/feature-package-feat-tradeoff-screen/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["tradeoff", "p03", "design-review"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "試算契約・API 契約・候補キー・データ保存範囲の独立レビュー"
tracker_binding: "beads"
updated_at: "2026-09-21T22:58:32Z"
---

# 試算契約・API 契約・候補キー・データ保存範囲の独立レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-tradeoff-screen
- owners: ["daishiman"]
- tags: ["tradeoff", "p03", "design-review"]
- related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
- parent_feature: feat-tradeoff-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-tradeoff-screen/sys-tradeoff-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の決定記録を spec と architecture 8 領域に照らして独立にレビューし、候補キーの可逆形式と上限値など P03 担当の持ち越し事項を確定する。

## 背景

候補キーは科目×取引先から `v1:${JSON.stringify([account_norm, partner])}` として組み立て、`parseTradeoffCandidateKey` で可逆解析する。PUT の経路パラメータと POST の keys の両方に現れるため、形式と長さ上限 (300) が揺れると 422 の判定と保存済みの上書きの照合が壊れる。0050 は未公開・未適用なので旧 `account|partner` 互換は持たない。保存するのは条件と上書きだけで、候補・推定値・差額は保存しない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen, SYS-TRADEOFF-P02
- Entry gate: staging run run-tradeoff-20260921T2250Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 部品境界と状態の網羅をレビューする
- Backend: applicable: 純関数の責務の重複をレビューする
- API: applicable: 3 経路の契約と 422 / 400 / 401 をレビューする
- Data: applicable: 保存範囲 (候補・推定値・差額を保存しない) をレビューする
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: user_id 分離とサーバ再計算をレビューする
- Quality: applicable: レビュー結果を記録する
- Documentation: applicable: 確定した値を決定記録へ反映する
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/tradeoff-screen/design-decisions.md
- Consumed artifacts:
- docs/tradeoff-screen/design-decisions.md
- specs/spec-tradeoff-screen.md
- Write scope/touches:
- docs/tradeoff-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRADEOFF-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRADEOFF-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRADEOFF-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRADEOFF-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの作り直し、保存済みの試算の一覧と翌月の突合の画面表示、アプリからの LLM 呼び出し、既存の tradeoff_plans の行やテーブルの削除・書換、既存の defenseLine・tradeoffCandidates・診断検知器の数字の変更、画像の数値の再現と web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 候補キーが versioned JSON tuple で可逆解析でき、長さ上限 300 とともに決定記録にある (OI-02)。
- POST が covered / verdict / selected.value を受け取らない契約と、未知キー 422 の条件がレビューで確認されている。
- レビュー指摘がすべて決定記録へ反映されるか、理由付きで持ち越しになっている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/tradeoff-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-tradeoff-screen.md
- Architecture: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Feature: feat-tradeoff-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRADEOFF-P02
