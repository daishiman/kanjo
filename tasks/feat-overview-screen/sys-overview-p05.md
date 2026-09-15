---
graph_node_id: "SYS-OVERVIEW-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "概況集計・未処理キューAPI・D1 migration・Overview.tsx の実装"
project_id: "feature-package-feat-overview-screen"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["overview-screen", "p05", "implementation"]
file_path: "tasks/feat-overview-screen/sys-overview-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-overview-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:55:29Z", "origin_kind": "system-dev-planner", "source_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "source_path": ".dev-graph/plans/feature-package-feat-overview-screen/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:55:29Z"
updated_at: "2026-09-14T13:55:29Z"
depends_on: ["SYS-OVERVIEW-P04"]
related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
resource_scope: ["packages/core/src/analysis.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/db/schema.ts", "packages/api/src/store.ts", "packages/api/src/schema-guard.ts", "packages/api/src/canonical-mutation-fence.ts", "migrations/0040_review_snoozes_and_monthly_close_reviews.sql", "packages/web/src/pages/Overview.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/api.ts"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-overview-screen"
feature_package_id: "feature-package/feat-overview-screen"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-overview-screen/sys-overview-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-8c2.5", "linked_at": "2026-09-14T14:18:42Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:41:44Z", "missing_sections": [], "status": "complete"}
---

# 概況集計・未処理キューAPI・D1 migration・Overview.tsx の実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p05", "implementation"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04のredテストをgreenにする最小差分をcore/api/webへ実装し、FR-001..FR-007とAC-001..AC-006を満たす。

## 背景

現行の概況はGET /api/summaryからcoreのoverview()を呼び事業だけを表示している (packages/api/src/routes/analytics.ts のanalyticsRoute.get('/summary', ...) と packages/core/src/analysis.ts の overview())。本taskはこれを変更せず、新規のGET /api/overview・GET /api/review-queue・PUT/DELETE snoozes・PUT/DELETE monthly-close reviewを追加する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P04が完了し、3件のredテストが存在すること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: packages/web/src/pages/Overview.tsx を作り替え、packages/web/src/components/Layout.tsx にサイドバー未処理バッジを追加する
- Backend: applicable: packages/core/src/analysis.ts に月次クローズ判定・支出内訳上位5+その他等の集計を追加する
- API: applicable: packages/api/src/routes/analytics.ts に4エンドポイントを追加する
- Data: applicable: migrations/0040_review_snoozes_and_monthly_close_reviews.sql でreview_snoozes/monthly_close_reviewsをCREATEし、packages/api/src/db/schema.tsとpackages/api/src/schema-guard.tsのEXPECTED_D1_MIGRATIONを更新する
- Infrastructure: N/A: 配信構成は既存のCloudflare Workers/D1のまま (check:js-budgetはP09で確認)
- Security: applicable: 新規4エンドポイントをpackages/api/src/canonical-mutation-fence.tsのCANONICAL_MUTATION_ROUTESへ登録し直列化する
- Quality: applicable: P04のredテストをgreenにする
- Documentation: N/A: 規約文書はP12の責務
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: Cloudflare Workers kanjo-console (packages/api) と D1 kanjo-db (migrations/0040) への追加。既存配信構成のまま新規エンドポイントとテーブルを追加する。
- Compatibility/migration/backfill: CSS変数・GET /api/summaryのレスポンス形を維持し、既存画面の参照を壊さない (spec-overview-screen.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- packages/core/src/analysis.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/db/schema.ts
- packages/api/src/store.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- migrations/0040_review_snoozes_and_monthly_close_reviews.sql
- packages/web/src/pages/Overview.tsx
- packages/web/src/components/Layout.tsx
- packages/web/src/api.ts
- Consumed artifacts:
- docs/overview-screen/architecture-decision.md
- docs/overview-screen/design-review.md
- specs/spec-overview-screen.md
- Write scope/touches:
- packages/core/src/analysis.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/db/schema.ts
- packages/api/src/store.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- migrations/0040_review_snoozes_and_monthly_close_reviews.sql
- packages/web/src/pages/Overview.tsx
- packages/web/src/components/Layout.tsx
- packages/web/src/api.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm --filter @kanjo/web run typecheck
- pnpm lint
- Required evidence:
- packages/core/src/analysis.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/db/schema.ts
- packages/api/src/store.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- migrations/0040_review_snoozes_and_monthly_close_reviews.sql
- packages/web/src/pages/Overview.tsx
- packages/web/src/components/Layout.tsx
- packages/web/src/api.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: analysis.ts・routes/analytics.ts・db/schema.ts・store.ts・schema-guard.ts・canonical-mutation-fence.ts・migrations/0040・Overview.tsx・Layout.tsx・api.tsへの変更コミットをrevertする。D1側はmigrationがCREATEのみのため取り消し不要で、新テーブルは無害に残置してよい。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P04
