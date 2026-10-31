# System task overlay: migration 0058・resolveVendorMerges・統合と取り消しと操作履歴の API・既存書込みの revision・backup・選択バーと操作状態の画面の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-merge
- owners: ["daishiman"]
- tags: ["subscriptions-merge", "p05", "mutation"]
- related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
- parent_feature: feat-subscriptions-merge
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-merge/sys-subsmerge-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計どおりに core・api・web を実装し、P04 のテストを緑にする。統合元を一覧から消し、同時の書込みを409 と自動の再送で収束させ、取り消しで統合前へ戻せるようにする。

## 背景

SubscriptionTable.tsx は 8 列で行チェックが無く、統合先の選択は DetailOverview.tsx の中にある。routes/subs.ts の書込み 9 本は revision を持たず、統合は recomputeFromDeals を経由する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge, SYS-SUBSMERGE-P04
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-SUBSMERGE-P04 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: 統合と取り消しは recomputeFromDeals を呼ばず、subs 範囲の monthly_agg を同じ db.batch で置き換える。
Blocker: 操作状態の文言は describeError を通さず、spec の文言をそのまま出す。
制約: packages/web/src に色の hex を直書きしない。色は design-tokens から取る。楽観更新をしない。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の主責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Deploy unit/environment: web ビルドと Worker と D1 migration 0058 (単一 PR で配信する。merge 後に CI の Migrate が 0058 を適用してから Deploy する)
- Compatibility/migration/backfill: 0058 は sub_vendors への NULL 可の列 merged_into_id と 2 表 (subscription_operations・subscription_revisions) の追加だけで、既存行を書き換えず backfill は 0 件。schema-guard.ts の EXPECTED_D1_MIGRATION を 0058 にする。旧実装へ戻しても列と表は残るが参照されない

## 成果物

- Produced artifacts:
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
- Consumed artifacts:
- docs/subscriptions-screen.md
- specs/spec-subscriptions-merge.md
- packages/core/test/subs-contract.test.ts
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/api/src/subs-merge-operations.integration.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/expense-projection.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- Write scope/touches:
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

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBSMERGE-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- migration 0058 が sub_vendors.merged_into_id と subscription_operations・subscription_revisions を足し、schema-guard の EXPECTED_D1_MIGRATION と db/schema.ts が 0058 に揃う。
- core の resolveVendorMerges が applyFreeeDeals・サブスク画面の照合・projectCashContribution に通り、照合の順序が科目で先に絞る形に揃う。
- POST /api/sub-vendors/merge・POST /api/subscription-operations/:id/undo・GET /api/subscription-operations が spec の API 契約どおりに動き、統合と取り消しが 1 つの db.batch で原子的に行われ、fence に登録されている。
- 既存の書込み 9 本が baseRevision (任意) と Idempotency-Key (任意) を受けて応答に revision を返し、統合済みの行への変更は 409 になり、統合先の削除は統合元をまとめて消す。
- backup の JSON が mergedIntoName を運び、復元が統合を名前で入れ直して revision を +1 する。
- 操作の記録の保持と掃除 (FR-023・BR-013) が統合と取り消しの batch に入る。30 日を過ぎ payload_json か before_json がまだ NULL でない行を 50 件まで NULL にし、400 日を過ぎた行を 50 件まで消し、30 日を過ぎた操作の取り消しは 410 undo_expired になる。
- 画面が行チェック・全選択・選択バー・名称を統合・操作状態 (直近 5 件と取り消し) を描き、mutation scope で 1 件ずつ送り、409 と 503 を自動で再送し、5xx と通信の失敗だけを再試行ボタンにする。
- P04 のテストが緑である。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- pnpm lint
- Required evidence:
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

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。0058 は追加だけなので表と列は残してよい。統合済みの行は旧実装では独立した行として再び現れるため、差し戻す前に統合を取り消すかを判断する。配信済みなら直前のビルドへ戻す。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-subscriptions-merge.md
- Architecture: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Feature: feat-subscriptions-merge
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBSMERGE-P04
