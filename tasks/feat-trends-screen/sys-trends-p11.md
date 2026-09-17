---
graph_node_id: "SYS-TRENDS-P11"
artifact_kind: "task"
artifact_subtypes: []
title: "証跡索引の作成"
project_id: "feature-package-feat-trends-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["trends-screen", "p11", "evidence"]
file_path: "tasks/feat-trends-screen/sys-trends-p11.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-trends-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T10:30:02Z", "origin_kind": "system-dev-planner", "source_digest": "ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4", "source_path": ".dev-graph/plans/feature-package-feat-trends-screen/task-specs/phase-11-evidence.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-16T10:30:02Z"
updated_at: "2026-09-16T10:30:02Z"
depends_on: ["SYS-TRENDS-P10"]
related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
resource_scope: ["docs/trends-screen/evidence.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-trends-screen"
feature_package_id: "feature-package/feat-trends-screen"
phase_ref: "P11"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-trends-screen/sys-trends-p11.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-16T10:20:25Z", "missing_sections": [], "status": "complete"}
---

# 証跡索引の作成

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p11", "evidence"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P11
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p11.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P01〜P10 の記録とテスト・検査の結果を 1 枚の索引にまとめ、受入 S1〜S6 から証跡へ辿れるようにする。

## 背景

受入の判定と PR の本文が同じ証跡を指すようにする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: SYS-TRENDS-P10 が完了し、その成果物が default branch に取り込まれていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 task はこの層のコードを変更しない
- Backend: N/A: 本 task はこの層のコードを変更しない
- API: N/A: 本 task はこの層のコードを変更しない
- Data: N/A: 本 task はこの層のコードを変更しない
- Infrastructure: N/A: 本 task はこの層のコードを変更しない
- Security: N/A: 本 task はこの層のコードを変更しない
- Quality: applicable: S1〜S6 と証跡の対応を表にする
- Documentation: applicable: docs/trends-screen/evidence.md を新設する
- Operations: applicable: 検査コマンドと実行日時を記録する

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: N/A: 索引文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本 task は migration もデータの移行も行わない (D1 は変えない)

## 受入基準

- S1〜S6 の各行から、テスト名・コマンド・記録ファイルへ辿れる。

## 成果物

- Produced artifacts:
- docs/trends-screen/evidence.md
- Consumed artifacts:
- docs/trends-screen/test-run.md
- docs/trends-screen/acceptance.md
- docs/trends-screen/assurance.md
- docs/trends-screen/final-review.md
- Write scope/touches:
- docs/trends-screen/evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P11 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P11 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P11 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRENDS-P10) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint
- Required evidence:
- docs/trends-screen/evidence.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: evidence.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRENDS-P10
