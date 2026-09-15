# System task overlay: core/API/DOM の失敗テスト先行作成 (O1-O5)

## Machine-readable registration fields

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p04", "test-design"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

AC-001..AC-006を検証するcore単体テスト・APIテスト・DOMテストをred (失敗) の状態で追加し、P05の実装が満たすべき契約をテストとして固定する。

## 背景

spec-overview-screen.mdのテストと受入条件節は core単体 (O1、O2の指紋、O5)・DOM (O2)・API (O3と入力検証・冪等・401)・描画 (O4) の4系統検査を要求する。本taskはP05実装前にそのうちcore/API/DOMの3系統を先行作成する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P03が完了し、design-review.mdに是正未了の指摘が残っていないこと
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: packages/web/src/overview-review-queue.dom.test.tsx を追加する
- Backend: applicable: packages/core/test/overview-close-status.test.ts を追加する
- API: applicable: packages/api/src/overview.test.ts を追加する
- Data: applicable: overview.test.ts がバックアップ→全消去→復元往復でreview_snoozes/monthly_close_reviewsが残ることを検証する
- Infrastructure: N/A: 配信構成の変更はない
- Security: N/A: 認可制御自体はP05で実装しP09で保証確認する
- Quality: applicable: 3ファイルすべてがredであることを本taskの完了条件にする
- Documentation: N/A: 文書更新はない
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: N/A: テストコードのみで配布物を持たない
- Compatibility/migration/backfill: N/A: 既存テストファイルは変更せず新規3ファイルを追加するのみ

## 成果物

- Produced artifacts:
- packages/core/test/overview-close-status.test.ts
- packages/api/src/overview.test.ts
- packages/web/src/overview-review-queue.dom.test.tsx
- Consumed artifacts:
- docs/overview-screen/architecture-decision.md
- specs/spec-overview-screen.md
- Write scope/touches:
- packages/core/test/overview-close-status.test.ts
- packages/api/src/overview.test.ts
- packages/web/src/overview-review-queue.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core exec vitest run test/overview-close-status.test.ts (新規テストがredであることを確認する)
- pnpm --filter @kanjo/api exec vitest run src/overview.test.ts (新規テストがredであることを確認する)
- pnpm --filter @kanjo/web exec vitest run src/overview-review-queue.dom.test.tsx (新規テストがredであることを確認する)
- Required evidence:
- packages/core/test/overview-close-status.test.ts
- packages/api/src/overview.test.ts
- packages/web/src/overview-review-queue.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: packages/core/test/overview-close-status.test.ts・packages/api/src/overview.test.ts・packages/web/src/overview-review-queue.dom.test.tsx の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P03
