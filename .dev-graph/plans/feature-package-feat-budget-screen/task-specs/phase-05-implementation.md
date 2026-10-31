# System task overlay: budget-screen.ts・3 API・migration 0048・/budget 画面の最終実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p05", "mutation"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core (budget-screen.ts)・3 API・migration 0048・/budget 画面を実装する。P06 の検証前に、旧 Budget.tsx (317 行) の分離と route-task-detail.test.tsx の文言更新まで完了させる。

## 背景

予算の算出は budgetScreen / applyBudgetInputs / monthlyBudgetsAt 1 関数系統に寄せ、API は既存の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の順序を維持し、PUT /api/budget-plans を新規にフェンス登録する。migration 0048 は追加のみで既存 budgets 表を書き換えない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Q-7（PUT の 1 回の保存で最大 200 行を扱うときの batch 文数と D1 の 1 呼び出しあたりのクエリ上限）は、本 task で具体的な対処 (batch 分割やトランザクション設計) を決定し実装する。未対処のまま complete を宣言しない。
Open risk: 収入行の差額の色規則は agent 推定値として実装し、specs/spec-budget-screen.md の未決事項として明記したまま進める。
Open risk: 年額の下限は agent 推定値 (0 未満を許容しない、または許容する) として zod と migration の CHECK 制約を一致させて実装し、未決のまま進める。
Open risk: budget_plans を JSON_SNAPSHOT_MUTATION_CONSUMERS とバックアップ・復元の write-set (import-lifecycle.ts) の両方に登録する。片方だけの登録で complete を宣言しない。
Open risk: その他収入 (manualOnly) の行は自動提案を出さず、利用者の手入力のみを受け付ける行として実装し、未決のまま進める。
Open risk: Q-5 (増減率と季節性補正の読み) は agent 推定値として実装し、未決のまま進める。
Blocker: migration 番号 0048 は予定番号であり、本 task の着手時に origin/main の最新 migration 番号を確認し、既に 0048 が使われていれば繰り上げて実装する。

## Workstream applicability

- Frontend: applicable: 画面の全構成要素・KPI・グラフ・一覧・科目パネル・保存バーを実装する
- Backend: applicable: budget-screen.ts を実装する
- API: applicable: 3 API と zod の許可リストを実装する
- Data: applicable: migration 0048 と runtimeSchemaGuard を実装する
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: canonicalMutationFence 登録と入力検証上限を実装する
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration（0048_budget_plans.sql の追加のみ）
- Compatibility/migration/backfill: budget_plans 表の新設のみ。既存 budgets 表への書き換えと backfill は 0 件。番号は実装時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/budget-screen.ts
- packages/api/src/routes/budget-plans.ts
- migrations/0048_budget_plans.sql
- packages/web/src/pages/budget/
- Consumed artifacts:
- docs/budget-screen/design-decisions.md
- packages/core/test/budget-screen.test.ts
- packages/api/src/routes/budget-plans.test.ts
- packages/web/src/pages/budget/budget.dom.test.tsx
- Write scope/touches:
- packages/core/src/budget-screen.ts
- packages/core/src/analysis.ts
- packages/core/src/dataset.ts
- packages/core/src/fingerprint.ts
- packages/core/src/types.ts
- packages/core/src/period.ts
- packages/core/src/index.ts
- packages/core/src/diagnosis-detectors.ts
- packages/core/src/diagnosis-screen.ts
- packages/api/src/routes/budget-plans.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/settings.ts
- packages/api/src/routes/imports.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/store.ts
- packages/api/src/import-active.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- migrations/0048_budget_plans.sql
- packages/web/src/api.ts
- packages/web/src/pages/budget/
- packages/web/src/pages/Budget.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/route-task-detail.test.tsx
- packages/web/src/analysis-query-invalidation.ts
- packages/web/src/components/Layout.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/core/src/budget-screen.ts (新設) の budgetScreen / applyBudgetInputs / monthlyBudgetsAt が BR-01〜BR-25 を満たし、P04 の core テストが緑である。
- GET /api/budget-screen・GET /api/budget-plans・PUT /api/budget-plans が既存 authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側で動き、許可リスト外のクエリと上限超過に 400 を返す。
- migration 0048_budget_plans.sql が追加のみで、runtimeSchemaGuard の EXPECTED_D1_MIGRATION に反映される。既存 budgets 表は 1 行も書き換えない。
- /budget 画面が spec §7 の構成要素を全て描画し、収入の行 (売上高・その他収入) が一覧の先頭に出る。
- 下書きが端末 (localStorage) 保存・復元され、サーバへは保存操作でだけ送られる。
- budget_plans が JSON_SNAPSHOT_MUTATION_CONSUMERS とバックアップ・復元 (import-lifecycle.ts) の write-set の両方に登録され、揃っている (open item: snapshot consumer とバックアップ write-set の整合)。
- packages/web/src/route-task-detail.test.tsx の旧文言『±10%』を新しい routeMetadata の task/taskDetail 文言に更新し、テストが緑になる。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/budget-screen.ts
- packages/core/src/analysis.ts
- packages/core/src/dataset.ts
- packages/core/src/fingerprint.ts
- packages/core/src/types.ts
- packages/core/src/period.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration 0048 は追加のみの表なので既存行の書き換えは無く、表が残っても既存画面は動く。配信済みなら直前のビルドへ戻し、表の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P04
