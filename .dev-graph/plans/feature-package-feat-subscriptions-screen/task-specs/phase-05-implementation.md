# System task overlay: core の subscriptionsScreen・API 6 経路・migration 0043・サブスク画面の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-screen
- owners: ["daishiman"]
- tags: ["subscriptions-screen", "p05", "implementation"]
- related_nodes: ["arch-subscriptions-auth", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-frontend", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops", "arch-subscriptions-security", "arch-subscriptions-ui-ux", "spec-subscriptions-screen"]
- parent_feature: feat-subscriptions-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-screen/sys-subs-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core の subscriptionsScreen、GET 2 経路と更新 4 経路、migration 0043、画像どおりのサブスク画面、サイドバーのバッジの付け替えを実装する。

## 背景

集計は core の純関数 1 か所に寄せ、API はそれを返すだけ、画面は返ってきた数値と候補を描くだけにする。ロゴは取得も表示もしない。更新後は関係するクエリを invalidate し、楽観更新はしない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Entry gate: staging run plan-feat-subscriptions-screen-20260918 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-SUBS-P04 の失敗テストが揃っていること
- origin/main を取り直して migrations の最大番号が 0042 のままであること

## Workstream applicability

- Frontend: applicable: 画像の全構成要素と読込・空・失敗の状態を pages/subscriptions/ の部品で描く
- Backend: applicable: subscriptionsScreen と見直し候補 5 規則と定型文を実装する
- API: applicable: GET /api/subscriptions の拡張と GET /api/subscriptions/vendors/:key と更新 4 経路を実装する
- Data: applicable: migration 0043 と schema と store を追加する
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: applicable: Zod 検証・所有者絞込・:id の整数検査・aliases の 50 件かつ 100 文字の上限を実装する
- Quality: applicable: P04 の失敗テストが全て緑になることを確かめる
- Documentation: N/A: 本 phase は Documentation の成果物を変更しない
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration 0043 (追加のみ。既存行を書き換えない)
- Compatibility/migration/backfill: migration 0043 は列と表の追加だけで、既存行を書き換えず backfill も行わない

## 成果物

- Produced artifacts:
- packages/core/src/subs.ts
- migrations/0043_sub_vendor_category_and_review_decisions.sql
- packages/api/src/routes/subs.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/subscriptions/
- Consumed artifacts:
- docs/subscriptions-screen.md
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- Write scope/touches:
- packages/core/src/subs.ts
- migrations/0043_sub_vendor_category_and_review_decisions.sql
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/store.ts
- packages/api/src/routes/subs.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/api.ts
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/subscriptions/
- packages/web/src/components/Layout.tsx
- packages/web/src/components/ReviewQueue.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBS-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBS-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBS-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBS-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (ロゴ画像の取得と表示、外部サービスと生成 AI による分類と理由文、共通シェルの構造変更、他画面の中身の作り直し、行チェックによる一括操作、web 以外のプラットフォーム)
- 旧 UI の撤去と旧テストの移設 (P08 が行う)
- ロゴ画像の取得と表示、頭文字の代替表示
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/subs.ts
- migrations/0043_sub_vendor_category_and_review_decisions.sql
- packages/api/src/routes/subs.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/subscriptions/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration 0043 は追加のみのため、表と列が残っても既存機能に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Feature: feat-subscriptions-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBS-P04
