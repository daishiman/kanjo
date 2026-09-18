# System task overlay: a11y・入力検証・所有者絞込・JS 予算・ロゴ 0 件の品質保証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-screen
- owners: ["daishiman"]
- tags: ["subscriptions-screen", "p09", "quality-assurance"]
- related_nodes: ["arch-subscriptions-auth", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-frontend", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops", "arch-subscriptions-security", "arch-subscriptions-ui-ux", "spec-subscriptions-screen"]
- parent_feature: feat-subscriptions-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-screen/sys-subs-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

tabs の a11y、Zod による 400 と 404 と 401、所有者での絞込、応答の no-store、ロゴ画像 0 件、初期 JS 予算、check:financial-figure を満たすことを確かめる。

## 背景

初期 JS 予算は build:bundle の直後に測る。build:artifact が manifest を消すため順序を入れ替えると測れない。verify:full は 4175 の vite が起動している前提で走る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Entry gate: staging run plan-feat-subscriptions-screen-20260918 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-SUBS-P08 の撤去と是正が完了していること

## Workstream applicability

- Frontend: applicable: tabs のキーボード操作と aria 属性、ロゴ 0 件を確かめる
- Backend: N/A: 本 phase は Backend の成果物を変更しない
- API: N/A: 本 phase は API の成果物を変更しない
- Data: N/A: 本 phase は Data の成果物を変更しない
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: applicable: 6 経路の認証・入力検証・所有者絞込・no-store を確かめる
- Quality: applicable: JS 予算と check:financial-figure と check:financial-routes の結果を記録する
- Documentation: N/A: 本 phase は Documentation の成果物を変更しない
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Deploy unit/environment: N/A: テストコードのみで配信単位を持たない
- Compatibility/migration/backfill: N/A: 本 phase は migration を適用しない

## 成果物

- Produced artifacts:
- packages/web/scripts/check-financial-visuals.mjs
- Consumed artifacts:
- packages/web/src/pages/Subscriptions.tsx
- packages/api/src/routes/subs.ts
- Write scope/touches:
- packages/web/scripts/check-financial-visuals.mjs
- packages/web/src/subscriptions-screen.dom.test.tsx
- packages/api/src/subs-screen.integration.test.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBS-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBS-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBS-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBS-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (ロゴ画像の取得と表示、外部サービスと生成 AI による分類と理由文、共通シェルの構造変更、他画面の中身の作り直し、行チェックによる一括操作、web 以外のプラットフォーム)
- 本番反映 (P13 が行う)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web run build:bundle
- pnpm --filter @kanjo/web run check:js-budget
- pnpm --filter @kanjo/web run check:financial-figure
- pnpm run verify:full
- Required evidence:
- packages/web/scripts/check-financial-visuals.mjs

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 検査の追加を revert する。プロダクトの挙動に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Feature: feat-subscriptions-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBS-P08
