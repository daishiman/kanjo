---
graph_node_id: "SYS-DSFOUND-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "トークン正本配置とワークストリーム設計の決定記録"
project_id: "feature-package-feat-design-system-foundation"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["design-system-foundation", "p02", "architecture"]
file_path: "tasks/feat-design-system-foundation/sys-dsfound-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-design-system-foundation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-13T08:47:51Z", "origin_kind": "system-dev-planner", "source_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "source_path": ".dev-graph/plans/feature-package-feat-design-system-foundation/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-13T08:47:51Z"
updated_at: "2026-09-13T09:08:31Z"
depends_on: ["SYS-DSFOUND-P01"]
related_nodes: ["spec-design-system-foundation", "arch-design-system-backend", "arch-design-system-frontend", "arch-design-system-database"]
resource_scope: ["docs/design-system/architecture-decision.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-design-system-foundation"
feature_package_id: "feature-package/feat-design-system-foundation"
phase_ref: "P02"
lifecycle_role: "preparation"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-design-system-foundation/sys-dsfound-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-5kq.2", "linked_at": "2026-09-13T09:08:31Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-13T08:30:17Z", "missing_sections": [], "status": "complete"}
---

# トークン正本配置とワークストリーム設計の決定記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p02", "architecture"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-backend", "arch-design-system-frontend", "arch-design-system-database"]
- parent_feature: feat-design-system-foundation
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

design-tokens.ts の配置と依存方向、境界色の役割分離、チャート系列色 (収入 #599AE9 / 支出 #EB9099) を 3:1 へ調整するか否かの決定 (dec-chart-series-contrast) を確定し、P03 の独立レビュー対象を用意する。

## 背景

architecture/design-system-frontend.md の Dependency Rule により、トークン (役割名から値への対応) は表示技術に依存しない packages/core に置き、styles.css の :root と charts.ts はその写しとする。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-backend、arch-design-system-frontend、arch-design-system-database
- Entry gate: 依存 task (SYS-DSFOUND-P01) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: styles.css/charts.ts が core を参照する依存方向を決定する
- Backend: applicable: packages/core への design-tokens.ts 配置を決定する
- API: N/A: API を公開・変更しない (scope_out)
- Data: N/A: 永続化を変更しない (arch-design-system-database)
- Infrastructure: N/A: 配信構成を変更しない
- Security: N/A: CSP・認可は変更しない
- Quality: applicable: FR-004 の判定基準 (4.5:1 / 3:1) と役割分離の対応を確認する
- Documentation: applicable: architecture-decision.md を新規作成し、dec-chart-series-contrast を利用者の選択 (調整する/現行値を維持し FR-004 の判定をどう扱うか) と選択日時付きで記録する。推定のまま confirmed と書かない
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-backend、arch-design-system-frontend、arch-design-system-database
- Deploy unit/environment: N/A: 決定記録のみで配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/design-system/architecture-decision.md
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- docs/design-system/architecture-decision.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm typecheck (既存構成に影響がないことを確認する)
- architecture-decision.md の記載が architecture/design-system-frontend.md および architecture/design-system-backend.md と矛盾しないことをレビューで確認する
- architecture-decision.md に dec-design-token-source / dec-border-color-roles / dec-chart-series-contrast の 3 決定が揃い、dec-chart-series-contrast の根拠が利用者の選択 (agent-inference 単独でない) であることをレビューで確認する
- Required evidence:
- docs/design-system/architecture-decision.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: architecture-decision.md の追加コミットを revert する。決定は P01 のベースラインへの追記のみで実装済みコードに影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-backend、arch-design-system-frontend、arch-design-system-database
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P01
