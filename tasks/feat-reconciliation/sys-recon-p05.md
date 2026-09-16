---
graph_node_id: "SYS-RECON-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "照合core判定関数・3API・月次レビューAPI・D1 migration・Reconciliation.tsx・共通シェル・アイコンの実装"
project_id: "feature-package-feat-reconciliation"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["reconciliation", "p05", "implementation"]
file_path: "tasks/feat-reconciliation/sys-recon-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-reconciliation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T11:23:54Z", "origin_kind": "system-dev-planner", "source_digest": "76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad", "source_path": ".dev-graph/plans/feature-package-feat-reconciliation/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T11:23:54Z"
updated_at: "2026-09-15T11:23:54Z"
depends_on: ["SYS-RECON-P04"]
related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
resource_scope: ["packages/core/src/reconciliation.ts", "packages/core/src/expense-projection.ts", "packages/core/src/analysis-hub.ts", "packages/api/src/routes/reconciliation.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/db/schema.ts", "packages/api/src/store.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/index.ts", "migrations/0040_reconciliation_tables.sql", "packages/web/src/pages/analysis/Reconciliation.tsx", "packages/web/src/components/RouteIcon.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/api.ts", "docs/data-schema.md", "docs/reconciliation-icons.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-reconciliation"
feature_package_id: "feature-package/feat-reconciliation"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-reconciliation/sys-recon-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-15T11:10:33Z", "missing_sections": [], "status": "complete"}
---

# 照合core判定関数・3API・月次レビューAPI・D1 migration・Reconciliation.tsx・共通シェル・アイコンの実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-reconciliation
- owners: ["daishiman"]
- tags: ["reconciliation", "p05", "implementation"]
- related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
- parent_feature: feat-reconciliation
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-reconciliation/sys-recon-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

照合core判定関数・照合専用3API・月次レビューAPI・D1新表3件・Reconciliation.tsx・共通シェル・画像内全アイコンを実装し、P04の失敗テストを全てgreenにする。

## 背景

scope_inの1〜6項目 (画面作り直し・core純関数・照合API・D1追加・共通シェル・アイコン) を一つの実装taskへ集約する。既存の支出分析ハブ改善 (PR #50) のトークン・共通Button・PageShellパターンを踏襲する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Entry gate: staging run sdp-feat-reconciliation-20260915T1102Z のgoal-spec.jsonがreadiness_pin.status=completeであること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- Depends on: SYS-RECON-P04 の成果物が確定していること

## Workstream applicability

- Frontend: applicable: Reconciliation.tsx・共通シェル・アイコン表示を実装する
- Backend: applicable: core判定関数とAPI routeを実装する
- API: applicable: 3API+月次レビューAPIを実装する
- Data: applicable: D1新表3件とmigration 0040を実装する
- Infrastructure: N/A: Worker/binding/cronの構成自体は変更しない (architecture/reconciliation-infrastructure.mdに従い既存Workerへ追加するのみ)
- Security: applicable: canonicalMutationFence対象化と入力検証を実装する
- Quality: N/A: テスト実行記録自体はP06の責務
- Documentation: applicable: docs/data-schema.mdの更新とdocs/reconciliation-icons.mdの新設を行う
- Operations: N/A: 運用手順文書はP12の責務

## Architecture and deploy unit

- Architecture decisions: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Deploy unit/environment: Cloudflare Workers kanjo-console (packages/api) と D1 kanjo-db (migrations/0040) への追加。既存配信構成のまま新規エンドポイントと新表3件を追加する。
- Compatibility/migration/backfill: migrations/0040は既存duplicate_verdicts (0036)・freee_deal_exclusions (0037) の列を変更しないCREATE ONLYであり、バックフィルは無い

## 成果物

- Produced artifacts:
- packages/core/src/reconciliation.ts
- packages/api/src/routes/reconciliation.ts
- migrations/0040_reconciliation_tables.sql
- packages/web/src/pages/analysis/Reconciliation.tsx
- docs/reconciliation-icons.md
- Consumed artifacts:
- docs/reconciliation/architecture-decision.md
- packages/core/test/reconciliation.test.ts
- packages/api/test/reconciliation.integration.test.ts
- packages/web/src/reconciliation.dom.test.tsx
- system-spec/00-requirements-definition.md
- specs/spec-reconciliation.md
- features/feat-reconciliation.md
- system-spec/completeness-findings.json
- Write scope/touches:
- packages/core/src/reconciliation.ts
- packages/core/src/expense-projection.ts
- packages/core/src/analysis-hub.ts
- packages/api/src/routes/reconciliation.ts
- packages/api/src/routes/total-cashflow.ts
- packages/api/src/db/schema.ts
- packages/api/src/store.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- migrations/0040_reconciliation_tables.sql
- packages/web/src/pages/analysis/Reconciliation.tsx
- packages/web/src/components/RouteIcon.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/components/Layout.tsx
- packages/web/src/api.ts
- docs/data-schema.md
- docs/reconciliation-icons.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-RECON-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-RECON-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-RECON-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-RECON-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (総収支・マトリクス・推移・診断タブ中身の作り直し、他画面の中身の作り直し、freee/MoneyForwardへの書き戻し、外部送信、利用規約等の本文新規作成、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm --filter @kanjo/web run typecheck
- pnpm lint
- Required evidence:
- packages/core/src/reconciliation.ts
- packages/api/src/routes/reconciliation.ts
- migrations/0040_reconciliation_tables.sql
- packages/web/src/pages/analysis/Reconciliation.tsx
- docs/reconciliation-icons.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: reconciliation.ts・routes/reconciliation.ts・routes/total-cashflow.ts・db/schema.ts・store.ts・canonical-mutation-fence.ts・index.ts・migrations/0040・Reconciliation.tsx・RouteIcon.tsx・routeMetadata.ts・Layout.tsx・api.ts・docs/data-schema.md・docs/reconciliation-icons.md への変更コミットをrevertする。D1側はmigrationがCREATEのみのため取り消し不要で、新表は無害に残置してよい。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Feature: feat-reconciliation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-RECON-P04
