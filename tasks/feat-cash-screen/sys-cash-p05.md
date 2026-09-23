---
graph_node_id: "SYS-CASH-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "cash-screen 純関数・論理削除と復元の 4 経路・migration 0052・夜間の完全消去・現金入力画面の分割と旧操作の移設の最終実装"
project_id: "feature-package-feat-cash-screen"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["cash", "p05", "mutation"]
file_path: "tasks/feat-cash-screen/sys-cash-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "67035b1f82f26d2d732f18b156a67c6d43d7e52afba21ff2d568d27cea5c4f1d", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-cash-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-22T01:43:10Z", "origin_kind": "system-dev-planner", "source_digest": "67035b1f82f26d2d732f18b156a67c6d43d7e52afba21ff2d568d27cea5c4f1d", "source_path": ".dev-graph/plans/feature-package-feat-cash-screen/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-22T01:43:10Z"
updated_at: "2026-09-22T01:43:10Z"
depends_on: ["SYS-CASH-P04"]
related_nodes: ["arch-cash-auth", "arch-cash-backend", "arch-cash-database", "arch-cash-frontend", "arch-cash-infrastructure", "arch-cash-maintenance-ops", "arch-cash-security", "arch-cash-ui-ux", "spec-cash-screen"]
resource_scope: ["packages/core/src/cash-screen.ts", "packages/core/src/cash.ts", "packages/core/src/dataset.ts", "packages/core/src/deletion.ts", "packages/core/src/index.ts", "packages/api/src/routes/cash.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/settings.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/store.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/index.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/deletion-lifecycle.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/audit-log.ts", "migrations/0052_cash_entry_owner_soft_delete.sql", "packages/web/src/api.ts", "packages/web/src/pages/Cash.tsx", "packages/web/src/pages/cash/", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css", "packages/web/package.json", "packages/web/src/cash-duplicate.dom.test.tsx", "packages/web/src/cash-transit-regression.test.ts", "packages/web/src/backup-restore.dom.test.tsx", "packages/web/src/settings-restore.dom.test.tsx", "package.json"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-cash-screen"
feature_package_id: "feature-package/feat-cash-screen"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-cash-screen/sys-cash-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-22T00:48:20Z", "missing_sections": [], "status": "complete"}
---

# cash-screen 純関数・論理削除と復元の 4 経路・migration 0052・夜間の完全消去・現金入力画面の分割と旧操作の移設の最終実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-cash-screen
- owners: ["daishiman"]
- tags: ["cash", "p05", "mutation"]
- related_nodes: ["arch-cash-auth", "arch-cash-backend", "arch-cash-database", "arch-cash-frontend", "arch-cash-infrastructure", "arch-cash-maintenance-ops", "arch-cash-security", "arch-cash-ui-ux", "spec-cash-screen"]
- parent_feature: feat-cash-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-cash-screen/sys-cash-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストがすべて緑になるまで、core / API / migration / cron / web を実装する。旧 Cash.tsx の操作をすべて新しい部品へ移し、合計と経路の計算の重複を除く。

## 背景

合計・絞り込み・ページング・入力経路・交通費合計・入力検証は core の cash-screen 1 か所に寄せ、API と web は写すだけにする。削除は deleted_at による論理削除で、同じ id のまま戻る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen, SYS-CASH-P04
- Entry gate: staging run plan-feat-cash-screen-20260921T2307Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 17-cash.png の全構成要素 (領収書欄を除く)・下書き・インライン削除確認・元に戻すトースト・下部固定バーを実装する
- Backend: applicable: cash-screen 純関数と夜間の完全消去 job を実装する
- API: applicable: restore / bulk-delete / bulk-restore の新設と GET / POST / PUT / DELETE の変更を実装する
- Data: applicable: migration 0052 と schema.ts と runtimeSchemaGuard と読取経路 5 本の条件を揃える
- Infrastructure: N/A: binding と配信構成は据え置き
- Security: applicable: 他人の id の 404 と zod の入力検証 400 を実装する
- Quality: applicable: P04 の失敗テストがすべて緑になる
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12 と P13

## Architecture and deploy unit

- Architecture decisions: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (0052 の列と索引の追加のみ)
- Compatibility/migration/backfill: cash_entries への owner・transit_purpose・deleted_at と索引の追加のみ。既存行の書き換えと backfill は 0 件。番号は着手時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/cash-screen.ts
- packages/api/src/routes/cash.ts
- migrations/0052_cash_entry_owner_soft_delete.sql
- packages/web/src/pages/cash/
- Consumed artifacts:
- docs/cash-screen/design-decisions.md
- packages/core/test/cash-screen.test.ts
- packages/api/src/cash-screen.integration.test.ts
- packages/api/src/cash-migration-0052.test.ts
- packages/web/src/pages/cash/cash-screen.dom.test.tsx
- Write scope/touches:
- packages/core/src/cash-screen.ts
- packages/core/src/cash.ts
- packages/core/src/dataset.ts
- packages/core/src/deletion.ts
- packages/core/src/index.ts
- packages/api/src/routes/cash.ts
- packages/api/src/routes/imports.ts
- packages/api/src/routes/settings.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/store.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- packages/api/src/scheduled-maintenance-budget.ts
- packages/api/src/deletion-lifecycle.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/audit-log.ts
- migrations/0052_cash_entry_owner_soft_delete.sql
- packages/web/src/api.ts
- packages/web/src/pages/Cash.tsx
- packages/web/src/pages/cash/
- packages/web/src/AuthenticatedApp.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/styles.css
- packages/web/package.json
- packages/web/src/cash-duplicate.dom.test.tsx
- packages/web/src/cash-transit-regression.test.ts
- packages/web/src/backup-restore.dom.test.tsx
- packages/web/src/settings-restore.dom.test.tsx
- package.json

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CASH-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CASH-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CASH-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CASH-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (領収書ファイルの保存、取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)、共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更、担当者の自由登録と管理画面 (qa-cash-decision-002)、モバイル・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)、既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え、税務判断 (税務上の正本は freee))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- cash-screen 純関数が P04 の core テストの境界値をすべて満たす。
- DELETE が論理削除になり、restore / bulk-restore で同じ id のまま戻り、一括は 1 件でも他人の id を含めば何も変えない。
- 削除中の行が読取経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) から外れ、JSON 復元の件数判定だけは削除中も数え、import-lifecycle.ts の restoreCashEntryStatements が owner と transit_purpose を復元する。
- migration 0052 が追加のみで runtimeSchemaGuard の期待 head が 0052 になり、夜間の完全消去 job が SCHEDULED_D1_QUERY_PLAN_MAX 49 の内に収まる。
- 現金入力画面が参照画像の構成要素 (領収書欄を除く) をすべて描画し、選択中のタブ・月・絞り込み・ページが URL から復元される。
- 旧 Cash.tsx の操作 (通常入力・交通費の入替と往復・重複の確認・編集・削除) がすべて新しい構成から実行でき、package.json の verify:full に check:cash-screen が入っている。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/cash-screen.ts
- packages/api/src/routes/cash.ts
- migrations/0052_cash_entry_owner_soft_delete.sql
- packages/web/src/pages/cash/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。0052 は列と索引の追加のみで既存行を書き換えないため、列が残っても旧画面は動く。巻き戻しは対称でなく、旧 Worker では削除中の行が一覧と集計に戻って見えるので、巻き戻す前に削除中の行が無いことを確かめる。列の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-cash-screen.md
- Architecture: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Feature: feat-cash-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CASH-P04
