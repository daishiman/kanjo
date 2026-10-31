# System task overlay: core 不変条件・API 契約・migration・DOM の失敗テスト先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p04", "test-design"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core の不変条件・3 API の契約・migration・DOM の各テストを、実装より先に失敗する状態で作成する。

## 背景

失敗テストは packages/core/test/budget-screen.test.ts (BR-01〜BR-25 相当の等式・境界)・packages/api/src/routes/budget-plans.test.ts (認証・フェンス・入力検証・migration 未適用)・packages/web/src/pages/budget/budget.dom.test.tsx (AT-01〜AT-12・AT-20〜AT-22) に分け、現行実装 (budget-screen.ts が存在しない) に対して確実に失敗させる。route-task-detail.test.tsx の旧文言『±10%』も更新対象として本 task の管理下に置く。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Q-7 の検証として、1 回の PUT が 200 行のときの batch 文数と D1 上限の関係を確認するテストケースを用意するが、実装側の対処方針の決定は SYS-BUDGET-P05 に委ねる。
Open risk: 収入行の差額の色・年額の下限・その他収入 (manualOnly) のテストは、agent 推定の初期仕様値で作成し、SYS-BUDGET-P05 以降で表現が変わり得る前提を明記する。

## Workstream applicability

- Frontend: applicable: DOM の失敗テストを作成する
- Backend: applicable: core 不変条件の失敗テストを作成する
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 全テストが現行実装に対して失敗することを確認する
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: migration 0048 の非破壊性を検査するテストのみを追加する

## 成果物

- Produced artifacts:
- packages/core/test/budget-screen.test.ts
- packages/api/src/routes/budget-plans.test.ts
- packages/web/src/pages/budget/budget.dom.test.tsx
- packages/web/src/pages/budget/view-model.test.ts
- Consumed artifacts:
- specs/spec-budget-screen.md
- docs/budget-screen/design-decisions.md
- Write scope/touches:
- packages/core/test/budget-screen.test.ts
- packages/api/src/routes/budget-plans.test.ts
- packages/web/src/pages/budget/budget.dom.test.tsx
- packages/web/src/pages/budget/view-model.test.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core 不変条件 (KPI の各式、一覧の来期予算の和 = KPI = グラフの月次予算の年合計 = 今後の見通しの累計、自動提案の式、前期実績の式、増減率の頭打ちと 24 か月未満・P=0 で 0、季節性補正の 0 になる条件、見通し・過不足・インパクトの式、monthlyBudgetsAt の期間選択) の失敗テストが packages/core/test/budget-screen.test.ts にあり、現行実装 (budget-screen.ts が存在しない) で失敗する。
- 3 API (GET /api/budget-screen・GET/PUT /api/budget-plans) の統合テストが packages/api/src/routes/budget-plans.test.ts にあり、401・fence の 409・不正値の 400・他利用者の初期値返却・migration 未適用の 503 を検査し、現行実装で失敗する。
- DOM テスト packages/web/src/pages/budget/budget.dom.test.tsx が AT-01〜AT-12・AT-20〜AT-22 に対応する構成要素・文言・状態を検査し、現行実装で失敗する。
- migration 0048 が既存 budgets 行を書き換えないことを検査する migration テストがある。
- packages/web/src/route-task-detail.test.tsx の旧文言『±10%』の固定箇所が、新しい routeMetadata の task/taskDetail 文言に合わせて更新する対象として失敗テスト側に含まれている (更新前は旧文言のまま緑になる状態を維持し、本 task では失敗させるところまでを行う)。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/budget-screen.test.ts
- packages/api/src/routes/budget-plans.test.ts
- packages/web/src/pages/budget/budget.dom.test.tsx
- packages/web/src/pages/budget/view-model.test.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P03
