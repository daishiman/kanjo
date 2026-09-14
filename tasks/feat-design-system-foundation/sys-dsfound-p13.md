---
graph_node_id: "SYS-DSFOUND-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "単一 PR での配信とクローズアウト"
project_id: "feature-package-feat-design-system-foundation"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["design-system-foundation", "p13", "release"]
file_path: "tasks/feat-design-system-foundation/sys-dsfound-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-design-system-foundation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-13T08:47:51Z", "origin_kind": "system-dev-planner", "source_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "source_path": ".dev-graph/plans/feature-package-feat-design-system-foundation/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-13T08:47:51Z"
updated_at: "2026-09-13T09:08:48Z"
depends_on: ["SYS-DSFOUND-P11"]
related_nodes: ["spec-design-system-foundation", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["docs/design-system/close-out.md", "scripts/design-system-status.mjs", "scripts/design-system-status.test.mjs"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-design-system-foundation"
feature_package_id: "feature-package/feat-design-system-foundation"
phase_ref: "P13"
lifecycle_role: "release"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-design-system-foundation/sys-dsfound-p13.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-5kq.13", "linked_at": "2026-09-13T09:08:48Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-13T08:30:17Z", "missing_sections": [], "status": "complete"}
---

# 単一 PR での配信とクローズアウト

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p13", "release"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
- parent_feature: feat-design-system-foundation
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

公開前の判定を `pnpm run design-system:status` へ一本化し、S1-S6、外部承認、追跡状態、maintainer同期、配信拘束がすべて満たされたときだけ単一 PR で配信できる状態にする。

## 背景

specs/spec-design-system-foundation.md の Rollout/rollback は単一の PR で配信し、問題があれば直前のビルドへ戻すことを定めている。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-infrastructure、arch-design-system-maintenance-ops
- Entry gate: 依存 task (SYS-DSFOUND-P11) の証跡を含む `pnpm run design-system:status` が exit 0 であること
- Fail-closed boundary: full S6 receipt、machine token integrity、承認対象digestの独立外部承認、実Git状態によるstrict tracking、maintainer/external parity、配信workflowの承認digest拘束のいずれかが欠けたら公開不可
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実装コードの変更は P05/P08 で完了済み
- Backend: N/A: 実装コードの変更は P05 で完了済み
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: applicable: 既存の配信構成のまま単一 PR で配信することを確認する
- Security: N/A: P09 で確認済み
- Quality: applicable: S1-S6 が全て満たされていることを close-out 前に確認する
- Documentation: applicable: close-out.md を新規作成する
- Operations: applicable: 本 task の中心責務。配信とクローズアウトの手順を記録する

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-infrastructure、arch-design-system-maintenance-ops
- Deploy unit/environment: N/A: 既存の Cloudflare Workers 配信構成 (静的アセットと /api/*) を変更しない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/design-system/close-out.md
- scripts/design-system-status.mjs
- scripts/design-system-status.test.mjs
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- docs/design-system/close-out.md
- scripts/design-system-status.mjs
- scripts/design-system-status.test.mjs

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm run design-system:status (人間向けの公開前単一入口。blocked時は非0)
- pnpm run design-system:status -- --json (機械可読な全check・blocker・next_actions)
- pnpm --filter @kanjo/web run build:artifact (配信可能な成果物が生成されることを確認する)
- Required evidence:
- docs/design-system/close-out.md

`design-system:status` はread-onlyであり、commit、tracker同期、承認記入、公開を行わない。現在の `.github/workflows/deploy.yml` は外部承認receiptと承認対象digestの拘束を実行しないため、その経路が追加されるまでstatusは公開準備完了を返さない。

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 単一 PR の配信を revert し直前のビルドへ戻す。close-out.md にロールバック実施記録を追記する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-infrastructure、arch-design-system-maintenance-ops
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P11
