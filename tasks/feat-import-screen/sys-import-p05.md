---
graph_node_id: "SYS-IMPORT-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "import-screen 純関数・検査と確定の API・migration 0053・データ取込画面の分割と旧操作の移設の最終実装"
project_id: "feature-package-feat-import-screen"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["import-screen", "p05", "mutation"]
file_path: "tasks/feat-import-screen/sys-import-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "fa224df0033b3c1ab8a8b635f5b81cf08198f48aca9f810af472bf695fd896b4", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-import-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-21T23:18:31Z", "origin_kind": "system-dev-planner", "source_digest": "fa224df0033b3c1ab8a8b635f5b81cf08198f48aca9f810af472bf695fd896b4", "source_path": ".dev-graph/plans/feature-package-feat-import-screen/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-21T23:18:31Z"
updated_at: "2026-09-21T23:18:31Z"
depends_on: ["SYS-IMPORT-P04"]
related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
resource_scope: ["packages/core/src/import-screen.ts", "packages/core/src/index.ts", "packages/api/src/routes/imports.ts", "packages/api/src/import-pipeline.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/import-active.ts", "packages/api/src/import-diff.ts", "packages/api/src/import-history-discard.ts", "packages/api/src/import-rate-limit.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/index.ts", "migrations/0053_import_inspections.sql", "packages/web/src/api.ts", "packages/web/src/pages/Import.tsx", "packages/web/src/pages/import/", "packages/web/src/components/ImportDiff.tsx", "packages/web/src/components/ImportDeletion.tsx", "packages/web/src/import-retry.ts", "packages/web/src/pages/Import.dom.test.tsx", "packages/web/src/pages/Import.diff.test.tsx", "packages/web/src/pages/Import.discard.test.tsx", "packages/web/src/pages/Import.deletion.test.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-import-screen"
feature_package_id: "feature-package/feat-import-screen"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-import-screen/sys-import-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-21T23:14:02Z", "missing_sections": [], "status": "complete"}
---

# import-screen 純関数・検査と確定の API・migration 0053・データ取込画面の分割と旧操作の移設の最終実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-import-screen
- owners: ["daishiman"]
- tags: ["import-screen", "p05", "mutation"]
- related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
- parent_feature: feat-import-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-import-screen/sys-import-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストがすべて緑になるまで、core / API / migration / web を実装する。P06 の検証前に、旧 Import.tsx の操作をすべて新しい部品へ移し、上限値と取込規則の重複を除く。

## 背景

上限値と取込規則は core の import-screen.ts の 1 か所に寄せ、web の送信前判定と api の 413 が同じ関数を使う。検査は R2 と D1 に仮置きするだけで明細を書かず、確定は検査 ID だけで取り込む。取込元は freee と MF の CSV のみ。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen, SYS-IMPORT-P04
- Entry gate: staging run run-import-screen-20260921T2311Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 16-import.png の全構成要素・ステッパー 3 段・一覧 9 列・要約 6 項目・結果 4 枚・履歴 7 列と詳細ペイン・選択件数バーを実装する
- Backend: applicable: import-screen 純関数と IMPORT_LIMITS を実装する
- API: applicable: 検査・ファイル追加と除外・確定・履歴の経路を実装する
- Data: applicable: migration 0053 と schema.ts と runtimeSchemaGuard を揃える
- Infrastructure: N/A: binding と配信構成は据え置き
- Security: applicable: body の上限 413・Origin 検査 403・レート制限 429 を実装する
- Quality: applicable: P04 の失敗テストがすべて緑になる
- Documentation: N/A: docs の最終同期は P12
- Operations: applicable: 夜間保守で R2 の期限切れの仮置きを 1 回 500 件まで消す(D1 は使わない)。期限切れの検査行と古い時間枠は検査要求のついでに消す

## Architecture and deploy unit

- Architecture decisions: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (0053 の表と列の追加のみ)
- Compatibility/migration/backfill: 新表 3 件と import_runs への列追加のみ。既存行の書き換えと backfill は 0 件。番号は着手時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/import-screen.ts
- packages/api/src/routes/imports.ts
- migrations/0053_import_inspections.sql
- packages/web/src/pages/import/
- Consumed artifacts:
- docs/import-screen/design-decisions.md
- packages/core/test/import-screen.test.ts
- packages/api/src/import-screen.integration.test.ts
- packages/api/src/import-migration-0053.test.ts
- packages/web/src/pages/import/import-screen.dom.test.tsx
- packages/api/src/import-limits-literal.test.ts
- Write scope/touches:
- packages/core/src/import-screen.ts
- packages/core/src/index.ts
- packages/api/src/routes/imports.ts
- packages/api/src/import-pipeline.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/import-active.ts
- packages/api/src/import-diff.ts
- packages/api/src/import-history-discard.ts
- packages/api/src/import-rate-limit.ts
- packages/api/src/scheduled-maintenance-budget.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- migrations/0053_import_inspections.sql
- packages/web/src/api.ts
- packages/web/src/pages/Import.tsx
- packages/web/src/pages/import/
- packages/web/src/components/ImportDiff.tsx
- packages/web/src/components/ImportDeletion.tsx
- packages/web/src/import-retry.ts
- packages/web/src/pages/Import.dom.test.tsx
- packages/web/src/pages/Import.diff.test.tsx
- packages/web/src/pages/Import.discard.test.tsx
- packages/web/src/pages/Import.deletion.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPORT-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPORT-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPORT-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPORT-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (銀行・クレジットカードの明細ファイルの取り込みと、その対応サービスの案内、共通シェル、freee / マネーフォワードの API との自動連携、既存の取込形式、既存の imports と明細の行の書き換え、取消・破棄・差分プレビュー・手当ての継続再適用の規則そのものの変更、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- import-screen 純関数と IMPORT_LIMITS が境界をすべて満たし、P04 の core テストが緑である。
- 検査が明細を 1 行も書かず、確定が本人の未期限の検査 ID だけを受ける。
- body の上限を超える要求が本文を読む前に 413 で止まり、Origin 不一致が 403、上限回数を超えると 429 になる。
- migration 0053 が追加のみで runtimeSchemaGuard の必須列に含まれる。
- データ取込画面が参照画像の構成要素をすべて描画し、選択中の履歴が URL から復元される。
- 旧 Import.tsx の操作 (差分プレビュー・取り消し・破棄・置換・再試行) がすべて新しい構成から実行できる。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/import-screen.ts
- packages/api/src/routes/imports.ts
- migrations/0053_import_inspections.sql
- packages/web/src/pages/import/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。0053 は表と列の追加のみで既存行を書き換えないため、表と列が残っても旧画面は動く。配信済みなら直前のビルドへ戻し、表と列の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-import-screen.md
- Architecture: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Feature: feat-import-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPORT-P04
