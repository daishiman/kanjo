---
graph_node_id: "SYS-DSFOUND-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "トークン値・コントラスト・共通シェルの失敗テスト先行作成"
project_id: "feature-package-feat-design-system-foundation"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["design-system-foundation", "p04", "test-design"]
file_path: "tasks/feat-design-system-foundation/sys-dsfound-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-design-system-foundation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-13T08:47:51Z", "origin_kind": "system-dev-planner", "source_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "source_path": ".dev-graph/plans/feature-package-feat-design-system-foundation/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-13T08:47:51Z"
updated_at: "2026-09-13T09:08:34Z"
depends_on: ["SYS-DSFOUND-P03"]
related_nodes: ["spec-design-system-foundation", "arch-design-system-frontend", "arch-design-system-backend"]
resource_scope: ["packages/core/test/design-tokens.test.ts", "packages/web/src/design-tokens-contrast.test.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "scripts/check-design-tokens.mjs"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-design-system-foundation"
feature_package_id: "feature-package/feat-design-system-foundation"
phase_ref: "P04"
lifecycle_role: "test-design"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-design-system-foundation/sys-dsfound-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-5kq.4", "linked_at": "2026-09-13T09:08:34Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-13T08:30:17Z", "missing_sections": [], "status": "complete"}
---

# トークン値・コントラスト・共通シェルの失敗テスト先行作成

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p04", "test-design"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-frontend", "arch-design-system-backend"]
- parent_feature: feat-design-system-foundation
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

FR-001・FR-003・FR-004・FR-002 それぞれの判定基準を機械検証するテストを実装前に red の状態で用意し、P05 の実装完了条件を固定する。

## 背景

specs/spec-design-system-foundation.md の FR-001..FR-004 の判定基準を、実装より先にテストとして固定する (test-first)。FR-005 の文書契約は文書同期を所有する P12 で固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-frontend、arch-design-system-backend
- Entry gate: 依存 task (SYS-DSFOUND-P03) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: design-tokens-contrast.test.ts と common-shell-routes.dom.test.tsx を追加する
- Backend: applicable: packages/core/test/design-tokens.test.ts を追加する
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: N/A: 配信構成を変更しない
- Security: N/A: CSP・認可は変更しない
- Quality: applicable: 本 task の中心責務。4件の失敗テスト・検査スクリプトを red の状態で用意する
- Documentation: N/A: 規約文書は P12 の責務
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-frontend、arch-design-system-backend
- Deploy unit/environment: N/A: テストコードのみで配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- packages/core/test/design-tokens.test.ts
- packages/web/src/design-tokens-contrast.test.ts
- packages/web/src/common-shell-routes.dom.test.tsx
- scripts/check-design-tokens.mjs
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- packages/core/test/design-tokens.test.ts
- packages/web/src/design-tokens-contrast.test.ts
- packages/web/src/common-shell-routes.dom.test.tsx
- scripts/check-design-tokens.mjs

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test (新規テストが red であることを確認する)
- pnpm --filter @kanjo/web test (新規テストが red であることを確認する)
- node scripts/check-design-tokens.mjs (非 0 exit であることを確認する)
- Required evidence:
- packages/core/test/design-tokens.test.ts
- packages/web/src/design-tokens-contrast.test.ts
- packages/web/src/common-shell-routes.dom.test.tsx
- scripts/check-design-tokens.mjs

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 追加した失敗テストと check-design-tokens.mjs の初期実装を revert する。P05 未着手であればリポジトリは変更前の状態に戻る。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-frontend、arch-design-system-backend
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P03
