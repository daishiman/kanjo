# System task overlay: 単一 PR での配信 (Migrate 0058 の後に Deploy) とクローズアウト

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-merge
- owners: ["daishiman"]
- tags: ["subscriptions-merge", "p13", "release"]
- related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
- parent_feature: feat-subscriptions-merge
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-merge/sys-subsmerge-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

verify:full を緑にして単一 PR で配信し、merge 後に 0058 の適用と Deploy を確かめてクローズする。

## 背景

0058 は列と表の追加だけなので migration の承認は不要だが、Deploy より先に Migrate が走る必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge, SYS-SUBSMERGE-P12
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-SUBSMERGE-P12 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: verify:full は 4175 の vite を前提にする。起動していなければ check:financial-routes が接続拒否で落ちる。
制約: commit・push・PR の作成は利用者の指示があるまで行わない。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: applicable: 本 phase の副次責務として扱う
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: applicable: 本 phase の主責務として扱う

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Deploy unit/environment: web ビルドと Worker と D1 migration 0058 (単一 PR で配信する。merge 後に CI の Migrate が 0058 を適用してから Deploy する)
- Compatibility/migration/backfill: 0058 は sub_vendors への NULL 可の列 merged_into_id と 2 表 (subscription_operations・subscription_revisions) の追加だけで、既存行を書き換えず backfill は 0 件。schema-guard.ts の EXPECTED_D1_MIGRATION を 0058 にする。旧実装へ戻しても列と表は残るが参照されない

## 成果物

- Produced artifacts:
- docs/subscriptions-screen.md
- Consumed artifacts:
- migrations/0058_subscription_merge_operations.sql
- packages/core/src/subs.ts
- packages/core/src/subs-screen.ts
- packages/core/src/dataset.ts
- packages/core/src/expense-projection.ts
- packages/core/src/index.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/import-active.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/store.ts
- packages/api/src/subscription-writes.ts
- packages/api/src/routes/subs.ts
- packages/api/src/routes/subscription-operations.ts
- packages/api/src/routes/imports.ts
- packages/api/src/routes/settings.ts
- packages/api/src/index.ts
- packages/api/src/index.test.ts
- packages/api/src/deletion-schema.test.ts
- packages/api/src/import-lifecycle-pure.test.ts
- packages/web/src/api.ts
- packages/web/src/api-client.ts
- packages/web/src/components/Page.tsx
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/subscriptions/
- packages/web/src/pages/import/import-test-fakes.ts
- packages/web/src/diagnosis-next-action-receivers.dom.test.tsx
- packages/web/src/mobile-financial-visualization.dom.test.tsx
- packages/core/test/subs-contract.test.ts
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/api/src/subs-merge-operations.integration.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/expense-projection.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- docs/subscriptions-screen.md
- docs/data-schema.md
- Write scope/touches:
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBSMERGE-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- pnpm run verify:full が緑である。
- PR 本文に dev-graph の graph_node_id を記載し、merge 後に CI の Migrate が 0058 を適用してから Deploy したことを確かめた記録がある。
- Automated commands:
- pnpm run verify:full
- pnpm test
- pnpm typecheck
- Required evidence:
- docs/subscriptions-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: PR を revert して直前のビルドへ戻す。0058 の列と表は残してよい (旧実装は参照しない)。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-subscriptions-merge.md
- Architecture: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Feature: feat-subscriptions-merge
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBSMERGE-P12
