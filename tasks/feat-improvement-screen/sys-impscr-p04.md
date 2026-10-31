---
graph_node_id: "SYS-IMPSCR-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "core 境界値・マスク・API 契約・migration 0053・夜間予算・DOM の失敗テスト先行作成"
project_id: "feature-package-feat-improvement-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement", "p04", "test-design"]
file_path: "tasks/feat-improvement-screen/sys-impscr-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "976a9b89b575cd1d9a781fdd04237f7188cc0c2eb04daba7784139187fb2c144", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-improvement-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-23T14:14:59Z", "origin_kind": "system-dev-planner", "source_digest": "976a9b89b575cd1d9a781fdd04237f7188cc0c2eb04daba7784139187fb2c144", "source_path": ".dev-graph/plans/feature-package-feat-improvement-screen/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-23T14:14:59Z"
updated_at: "2026-09-23T14:14:59Z"
depends_on: ["SYS-IMPSCR-P03"]
related_nodes: ["arch-improvement-screen-auth", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-frontend", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops", "arch-improvement-screen-security", "arch-improvement-screen-ui-ux", "spec-improvement-screen"]
resource_scope: ["packages/core/test/improvement-screen.test.ts", "packages/core/test/improvement-highlights-contract.test.ts", "packages/api/src/improvement-screen.integration.test.ts", "packages/api/src/improvement-migration-0053.test.ts", "packages/api/src/improvement-redaction.test.ts", "packages/api/src/improvement-retention.test.ts", "packages/api/src/improvement-lifecycle.test.ts", "packages/api/src/improvement-backup-exclusion.test.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/api/src/audit-log-d8.test.ts", "packages/api/src/schema-guard.test.ts", "packages/web/src/pages/improvement/improvement-screen.dom.test.tsx", "packages/web/src/improvement-capture.dom.test.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-improvement-screen"
feature_package_id: "feature-package/feat-improvement-screen"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-improvement-screen/sys-impscr-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-23T14:07:26Z", "missing_sections": [], "status": "complete"}
---

# core 境界値・マスク・API 契約・migration 0053・夜間予算・DOM の失敗テスト先行作成

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-improvement-screen
- owners: ["daishiman"]
- tags: ["improvement", "p04", "test-design"]
- related_nodes: ["arch-improvement-screen-auth", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-frontend", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops", "arch-improvement-screen-security", "arch-improvement-screen-ui-ux", "spec-improvement-screen"]
- parent_feature: feat-improvement-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-improvement-screen/sys-impscr-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

S1〜S5 を実装前に失敗するテストへ落とす。実装を入れる前に全件が失敗することを確かめる。

## 背景

マスク・削除中の行の除外・夜間予算は、0 件の違反と 0 件しか調べていないことの区別が付きにくい。件数を固定し、条件を 1 つ外すとそのテストだけが落ちることを検算する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen, SYS-IMPSCR-P03
- Entry gate: staging run plan-feat-improvement-screen-20260923T1404Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 作成フォーム・一覧・詳細・撮影パネルの DOM テストを書く
- Backend: applicable: 削除・復元・読取経路・夜間消去のテストを書く
- API: applicable: 一覧・詳細・作成・状態変更・再発行の契約テストを書く
- Data: applicable: 0053 の適用で既存行が失われないテストを書く
- Infrastructure: N/A: テストの追加のみ
- Security: applicable: 7 種と秘匿値のマスク・他人の 404・入力の 400 のテストを書く
- Quality: applicable: 失敗を先に確かめる
- Documentation: N/A: テストの追加のみ
- Operations: N/A: テストの追加のみ

## Architecture and deploy unit

- Architecture decisions: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: テストの追加のみ

## 成果物

- Produced artifacts:
- packages/core/test/improvement-screen.test.ts
- packages/api/src/improvement-screen.integration.test.ts
- packages/api/src/improvement-migration-0053.test.ts
- packages/web/src/pages/improvement/improvement-screen.dom.test.tsx
- Consumed artifacts:
- docs/improvement-screen/design-decisions.md
- specs/spec-improvement-screen.md
- Write scope/touches:
- packages/core/test/improvement-screen.test.ts
- packages/core/test/improvement-highlights-contract.test.ts
- packages/api/src/improvement-screen.integration.test.ts
- packages/api/src/improvement-migration-0053.test.ts
- packages/api/src/improvement-redaction.test.ts
- packages/api/src/improvement-retention.test.ts
- packages/api/src/improvement-lifecycle.test.ts
- packages/api/src/improvement-backup-exclusion.test.ts
- packages/api/src/scheduled-maintenance-budget.test.ts
- packages/api/src/audit-log-d8.test.ts
- packages/api/src/schema-guard.test.ts
- packages/web/src/pages/improvement/improvement-screen.dom.test.tsx
- packages/web/src/improvement-capture.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPSCR-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPSCR-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPSCR-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPSCR-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)、改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)、関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)、複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する、モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)、新しい Cron・新しい資格情報の種類・R2 のキーの形の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 状態の遷移・概要 (40 字)・IMP 番号・検索・件数タブ・10 件ずつのページング・関連する依頼 (最大 3 件)・診断要約の境界が toBe / toEqual で書かれ、実装前は失敗する。
- 口座・取引先名・金額・個人名・メール・電話・住所の 7 種と秘匿値の各例がマスクされるテストと、クライアントのマスクを飛ばした投稿にサーバで同じ規則が掛かるテストがある。
- 削除中の行が一覧・件数・詳細・agent 経路に現れないテストが経路ごとに 1 件ずつあり、条件を 1 経路だけ外すとその経路のテストだけが落ちることを検算した記録がある。
- 30 日の完全消去の 29 日 / 31 日と R2 の画像・履歴の消去、total === PLAN_MAX (49) のテストがある。
- 0053 の適用で既存の行・画像のキー・トークンが残り、wontfix が完了へ移って理由が履歴に残るテストがある。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/improvement-screen.test.ts
- packages/api/src/improvement-screen.integration.test.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-improvement-screen.md
- Architecture: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Feature: feat-improvement-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPSCR-P03
