# System task overlay: 検算済み fixture・境界値・API・DOM の失敗テストの先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-screen
- owners: ["daishiman"]
- tags: ["subscriptions-screen", "p04", "test-design"]
- related_nodes: ["arch-subscriptions-auth", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-frontend", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops", "arch-subscriptions-security", "arch-subscriptions-ui-ux", "spec-subscriptions-screen"]
- parent_feature: feat-subscriptions-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-screen/sys-subs-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

仕様 13.3 節の検算済み fixture (月額 9,778・年換算 117,336・前期間 9,530・差 248 円 2.6 パーセント・直近 12 か月 114,856・売上比 0.053863・候補 2 件・カバー率 97 と 100 と 92) と境界値を、現行実装では落ちるテストとして先に書き、暫定 U 項目の値をここで確定する。

## 背景

旧実装でも緑になるテストは、0 件の違反と 0 件しか調べていないの区別が付かない。件数と金額を固定値で検算し、旧実装で落ちることを確かめてから実装に入る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Entry gate: staging run plan-feat-subscriptions-screen-20260918 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-SUBS-P03 のレビューが通過していること

## Workstream applicability

- Frontend: applicable: 構成要素・tabs の操作・選択中バー・空と失敗の DOM テストを書く
- Backend: applicable: subscriptionsScreen の fixture と見直し候補 5 規則の境界値テストを書く
- API: applicable: 6 経路の 200・400・401・404 と所有者絞込のテストを書く
- Data: N/A: 本 phase は Data の成果物を変更しない
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: N/A: 本 phase は Security の成果物を変更しない
- Quality: applicable: 旧実装で落ちることを確認して記録する
- Documentation: applicable: 確定した暫定 U 項目の値を docs へ写す
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Deploy unit/environment: N/A: テストコードのみで配信単位を持たない
- Compatibility/migration/backfill: N/A: 本 phase は migration を適用しない

## 成果物

- Produced artifacts:
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- Consumed artifacts:
- specs/spec-subscriptions-screen.md
- docs/subscriptions-screen.md
- Write scope/touches:
- packages/core/test/subs-screen-contract.test.ts
- packages/core/test/subs-contract.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBS-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBS-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBS-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBS-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (ロゴ画像の取得と表示、外部サービスと生成 AI による分類と理由文、共通シェルの構造変更、他画面の中身の作り直し、行チェックによる一括操作、web 以外のプラットフォーム)
- プロダクトコードの変更 (P05 が行う)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 追加したテストを revert する。プロダクトの挙動に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Feature: feat-subscriptions-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBS-P03
