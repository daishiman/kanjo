---
graph_node_id: "SYS-TCSCREEN-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受入条件 AC-001..AC-006 の検証"
project_id: "feature-package-feat-total-cashflow-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow-screen", "p07", "acceptance"]
file_path: "tasks/feat-total-cashflow-screen/sys-tcscreen-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T15:38:58Z", "origin_kind": "system-dev-planner", "source_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "source_path": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T15:38:58Z"
updated_at: "2026-09-15T15:38:58Z"
depends_on: ["SYS-TCSCREEN-P06"]
related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
resource_scope: ["docs/total-cashflow-screen/acceptance.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-total-cashflow-screen"
feature_package_id: "feature-package/feat-total-cashflow-screen"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-total-cashflow-screen/sys-tcscreen-p07.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-15T15:22:17Z", "missing_sections": [], "status": "complete"}
---

# 受入条件 AC-001..AC-006 の検証

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-total-cashflow-screen
- owners: ["daishiman"]
- tags: ["total-cashflow-screen", "p07", "acceptance"]
- related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
- parent_feature: feat-total-cashflow-screen
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-total-cashflow-screen/sys-tcscreen-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

AC-001..AC-006 を 1 件ずつ、テスト名・画面確認・API 応答で検証し、05-total-cashflow.png との構成差分を記録する。

## 背景

S1 は画像の構成要素がすべて描画されること、S4 は取消後の総額と件数が操作前と一致することを求める。テストが緑でも内容の正しさは別に確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Entry gate: SYS-TCSCREEN-P06 が完了し全テストが緑であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画像との構成差分を確認する
- Backend: applicable: 総合 = 事業 + 家計を確認する
- API: applicable: 取消の 2 回送信で 1 回分だけ戻ることを確認する
- Data: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Infrastructure: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Security: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Quality: applicable: AC ごとの判定を記録する
- Documentation: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Operations: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Deploy unit/environment: N/A: 受入記録のみで配布物を持たない
- Compatibility/migration/backfill: GET /api/total-cashflow の既存フィールドと旧 reason body の受理を維持し、migration は追加のみとする (spec-total-cashflow-screen.md 互換性・移行・リリース節)

## 受入基準

- AC-001..AC-006 すべてに PASS と根拠 (テスト名またはコマンド出力) が記録されている。
- サイドバーの支出分析 > 総収支 が現在地で、照合バッジが要確認件数と一致することを記録している。

## 成果物

- Produced artifacts:
- docs/total-cashflow-screen/acceptance.md
- Consumed artifacts:
- docs/total-cashflow-screen/test-run.md
- specs/spec-total-cashflow-screen.md
- design/FINAL-UI/images/05-total-cashflow.png
- Write scope/touches:
- docs/total-cashflow-screen/acceptance.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCSCREEN-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TCSCREEN-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TCSCREEN-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TCSCREEN-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ・照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う・日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する・freee / Money Forward の取込経路の追加と明細分割の仕様変更・期間選択の保存先の変更 (既存どおり localStorage で全画面共有)・mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web run check:financial-routes
- Required evidence:
- docs/total-cashflow-screen/acceptance.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/total-cashflow-screen/acceptance.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Feature: feat-total-cashflow-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TCSCREEN-P06
