# System task overlay: 全テストと型検査と lint の実行記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p06", "test-run"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P06
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p06.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

packages/core と packages/api と packages/web の全テスト、型検査、lint を実行し、結果を再現可能な形で記録した状態にする。

## 背景

個別の filter 実行だけでは、他パッケージへの波及 (共通部品の変更や表記統一による既存テストの文言差分) を取りこぼす。P06 は全体を一度に走らせ、緑であることと実行条件を記録する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: web の DOM テストと check 系の結果を記録する
- Backend: applicable: core と api のテスト結果を記録する
- API: applicable: API テストの結果を記録する
- Data: N/A: データ定義に変更なし
- Infrastructure: N/A: 配信構成に変更なし
- Security: N/A: 保証確認は P09 の責務
- Quality: applicable: 全テストと型検査と lint を実行し記録する
- Documentation: applicable: docs/matrix/test-run.md を新設する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: 実行記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- docs/matrix/test-run.md
- Consumed artifacts:
- packages/core/test/matrix-contract.test.ts
- packages/api/test/matrix-routes.test.ts
- packages/web/src/matrix-cell.dom.test.tsx
- Write scope/touches:
- docs/matrix/test-run.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P06 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P06 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P06 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P05) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm typecheck
- pnpm lint
- Required evidence:
- docs/matrix/test-run.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/matrix/test-run.md の追加コミットを revert する。製品コードへの書込みがないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P05
