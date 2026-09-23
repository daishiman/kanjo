---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-tradeoff-screen/sys-tradeoff-p05.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-tradeoff-screen/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T22:58:32Z"
depends_on: ["SYS-TRADEOFF-P04"]
domain: "frontend"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-tradeoff-screen"
file_path: "tasks/feat-tradeoff-screen/sys-tradeoff-p05.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-TRADEOFF-P05"
implementation_readiness: {"checked_at": "2026-09-21T22:55:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-tradeoff-screen"
phase_ref: "P05"
priority: null
project_id: "feature-package-feat-tradeoff-screen"
pull_request_linkages: []
related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
resource_scope: ["packages/core/src/tradeoff-screen.ts", "packages/core/src/diagnosis-detectors.ts", "packages/core/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/schema-guard.test.ts", "migrations/0051_tradeoff_notes.sql", "packages/web/src/api.ts", "packages/web/src/pages/Tradeoff.tsx", "packages/web/src/pages/tradeoff/", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/analysis-query-invalidation.ts"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
source_lineage: {"imported_at": "2026-09-21T22:58:32Z", "origin_kind": "system-dev-planner", "source_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "source_path": ".dev-graph/plans/feature-package-feat-tradeoff-screen/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["tradeoff", "p05", "mutation"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "tradeoff-screen 純関数・3 経路 API・migration 0051・トレードオフ画面の分割の最終実装"
tracker_binding: "beads"
updated_at: "2026-09-21T22:58:32Z"
---

# tradeoff-screen 純関数・3 経路 API・migration 0051・トレードオフ画面の分割の最終実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-tradeoff-screen
- owners: ["daishiman"]
- tags: ["tradeoff", "p05", "mutation"]
- related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
- parent_feature: feat-tradeoff-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-tradeoff-screen/sys-tradeoff-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストがすべて緑になるまで、core / API / migration / web を実装する。試算の式を core の 1 か所に寄せ、web と api から ×12・差額の式の重複を除く。

## 背景

右パネル・選択中バー・計算例の 3 か所が同じ core の返り値を描く。API は候補と上書きを返しサーバで再計算して保存するだけ、画面は描くだけにする。claimPart の正規化を core から export しても既存の診断検知器の数字は変えない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen, SYS-TRADEOFF-P04
- Entry gate: staging run run-tradeoff-20260921T2250Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 15-tradeoff.png の全構成要素・選択中バー・計算例・防衛ラインの文を実装する
- Backend: applicable: tradeoff-screen 純関数と claimPart の export を実装する
- API: applicable: GET の作り直し・POST のサーバ再計算・PUT の新設を実装する
- Data: applicable: migration 0051 と schema.ts と EXPECTED_D1_MIGRATION を揃える
- Infrastructure: N/A: binding と配信構成は据え置き
- Security: applicable: 未知キー 422・zod 上限・user_id 分離を実装する
- Quality: applicable: P04 の失敗テストがすべて緑になる
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12 と P13

## Architecture and deploy unit

- Architecture decisions: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (0051 の列追加と新表のみ)
- Compatibility/migration/backfill: tradeoff_plans への start_month・memo 列の追加と新表 tradeoff_candidate_notes (一意索引 (user_id, candidate_key)) のみ。既存行の書き換えと backfill は 0 件。番号は着手時に origin/main を fetch してマージ時点の最新 +1 に付け替える

## 成果物

- Produced artifacts:
- packages/core/src/tradeoff-screen.ts
- packages/api/src/routes/analytics.ts
- migrations/0051_tradeoff_notes.sql
- packages/web/src/pages/tradeoff/
- Consumed artifacts:
- docs/tradeoff-screen/design-decisions.md
- packages/core/test/tradeoff-screen-contract.test.ts
- packages/api/src/tradeoff-screen.integration.test.ts
- packages/api/src/tradeoff-migration-0051.test.ts
- packages/web/src/pages/tradeoff/tradeoff-screen.dom.test.tsx
- Write scope/touches:
- packages/core/src/tradeoff-screen.ts
- packages/core/src/diagnosis-detectors.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/schema-guard.test.ts
- migrations/0051_tradeoff_notes.sql
- packages/web/src/api.ts
- packages/web/src/pages/Tradeoff.tsx
- packages/web/src/pages/tradeoff/
- packages/web/src/AuthenticatedApp.tsx
- packages/web/src/analysis-query-invalidation.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRADEOFF-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRADEOFF-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRADEOFF-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRADEOFF-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの作り直し、保存済みの試算の一覧と翌月の突合の画面表示、アプリからの LLM 呼び出し、既存の tradeoff_plans の行やテーブルの削除・書換、既存の defenseLine・tradeoffCandidates・診断検知器の数字の変更、画像の数値の再現と web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- tradeoff-screen 純関数が P04 の core テスト (試算・候補・推移・必要度・理由・推奨・covered の不変条件) をすべて満たす。
- 3 経路が既存 /api/* のフェンスの内側にあり、POST がサーバで再計算した covered と verdict だけを保存し、未知の候補キーを 422 で拒否する。
- migration 0051 が追加のみで、schema.ts と EXPECTED_D1_MIGRATION が同じ変更で進んでいる。
- トレードオフ画面が参照画像の構成要素をすべて描画し、保存一覧と突合の表示が無い。
- web と api に ×12・差額の式の重複が無い (grep で 0 件)。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/tradeoff-screen.ts
- packages/api/src/routes/analytics.ts
- migrations/0051_tradeoff_notes.sql
- packages/web/src/pages/tradeoff/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。0051 は列と表の追加のみで既存行を書き換えないため、列と表が残っても旧画面は動く。配信済みなら直前のビルドへ戻し、列と表の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-tradeoff-screen.md
- Architecture: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Feature: feat-tradeoff-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRADEOFF-P04
