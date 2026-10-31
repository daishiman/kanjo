---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-tradeoff-screen/sys-tradeoff-p01.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-tradeoff-screen/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T22:58:32Z"
depends_on: []
domain: "documentation"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-tradeoff-screen"
file_path: "tasks/feat-tradeoff-screen/sys-tradeoff-p01.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-TRADEOFF-P01"
implementation_readiness: {"checked_at": "2026-09-21T22:55:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-tradeoff-screen"
phase_ref: "P01"
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
source_lineage: {"imported_at": "2026-09-21T22:58:32Z", "origin_kind": "system-dev-planner", "source_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "source_path": ".dev-graph/plans/feature-package-feat-tradeoff-screen/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["tradeoff", "p01", "preparation"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "要件ベースライン確定と持ち越し事項の解決担当の割り当て"
tracker_binding: "beads"
updated_at: "2026-09-21T22:58:32Z"
---

# 要件ベースライン確定と持ち越し事項の解決担当の割り当て

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-tradeoff-screen
- owners: ["daishiman"]
- tags: ["tradeoff", "p01", "preparation"]
- related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
- parent_feature: feat-tradeoff-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-tradeoff-screen/sys-tradeoff-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec-tradeoff-screen と feature の受入 S1〜S6 を、実装着手時点の要件ベースラインとして 1 枚に固定し、持ち越し事項 (OI-01〜OI-04) の解決担当 phase を割り当てる。

## 背景

トレードオフ画面はアプリが LLM を呼ばず、試算の数字をすべて core の 1 か所から導く。保存一覧と翌月の突合は画面から外すが、既存の tradeoffReview・defenseLine・診断検知器の数字とテストは変えない。この境界を要件の最上位に置く。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Entry gate: staging run run-tradeoff-20260921T2250Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 要件の固定のみ
- Backend: N/A: 要件の固定のみ
- API: N/A: 要件の固定のみ
- Data: N/A: 要件の固定のみ
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 要件の固定のみ
- Quality: applicable: 受入 S1〜S6 を検証可能な文に分解する
- Documentation: applicable: 要件ベースラインと『agent 推定・利用者未確認』の値の一覧を docs へ置く
- Operations: N/A: 運用手順は P12 の責務

## Architecture and deploy unit

- Architecture decisions: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/tradeoff-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-tradeoff-screen.md
- features/feat-tradeoff-screen.md
- system-spec/00-requirements-definition.md
- Write scope/touches:
- docs/tradeoff-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRADEOFF-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRADEOFF-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRADEOFF-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの作り直し、保存済みの試算の一覧と翌月の突合の画面表示、アプリからの LLM 呼び出し、既存の tradeoff_plans の行やテーブルの削除・書換、既存の defenseLine・tradeoffCandidates・診断検知器の数字の変更、画像の数値の再現と web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S6 が検証可能な文に分解され docs/tradeoff-screen/design-decisions.md に載っている。
- 持ち越し事項 OI-01〜OI-04 それぞれに解決担当 phase が割り当てられている。
- 『agent 推定・利用者未確認』の値 (候補表の 10 件・推移の初月 0・組み合わせの列挙範囲と順位・充足度の丸め・新表の形・文字数と金額の上限・422 の文など) が一覧になり、利用者確認の要否と担当 phase が決まっている。候補キーは持ち越さず、spec の可逆な versioned JSON tuple 形式に従う。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/tradeoff-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-tradeoff-screen.md
- Architecture: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Feature: feat-tradeoff-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
