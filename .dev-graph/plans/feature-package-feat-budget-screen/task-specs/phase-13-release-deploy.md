# System task overlay: 単一 PR での配信と migration 0048 適用とクローズアウト

## Machine-readable registration fields

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p13", "release"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

単一 PR で web ビルド・Worker・D1 migration 0048 を配信し、クローズアウトする。

## 背景

着手時に origin/main を再度 fetch し、migration 0048 が空き番号であることを再確認したうえで PR を merge する。main が進んで 0048 が埋まっていた場合は繰り上げて対応する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: migration 番号 0048 は予定番号であり、本 task の着手時に origin/main を再度 fetch し直し、0048 が空き番号であることを再確認しない限り merge しない。埋まっていた場合は次の空き番号へ繰り上げ、schema-guard.ts の EXPECTED_D1_MIGRATION と docs の参照を揃える。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 配信後の数値一致を確認する
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: applicable: 配信とクローズアウトを行う

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration（単一 PR で同時に配信する）
- Compatibility/migration/backfill: budget_plans 表の新設のみ。既存 budgets 表への書き換えと backfill は 0 件。番号は配信直前に origin/main を再確認して確定する

## 成果物

- Produced artifacts:
- migrations/0048_budget_plans.sql
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/budget-screen.ts
- packages/api/src/routes/budget-plans.ts
- packages/web/src/pages/budget/
- Write scope/touches:
- docs/budget-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 着手時に origin/main を fetch し直し、0048 が空き番号であることを再確認した上で PR が default branch へ merge され、CI の Migrate と Deploy が緑である (open item: migration 番号 0048 は予定番号)。main が進んで 0048 が埋まっていた場合は次の空き番号へ繰り上げ、schema-guard.ts の EXPECTED_D1_MIGRATION と本書の参照を揃えたことが記録されている。
- 配信後に /budget の KPI・一覧・診断の予算カバー率が同じ budgetScreen / monthlyBudgetsAt から出て、値がずれていない。
- Automated commands:
- pnpm test
- pnpm typecheck
- Required evidence:
- docs/budget-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: PR を revert して直前のビルドへ戻す。migration 0048 は追加のみの表なので削除しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P12
