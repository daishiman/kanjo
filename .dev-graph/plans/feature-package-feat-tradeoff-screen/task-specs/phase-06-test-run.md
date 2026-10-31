# System task overlay: 全テストと型検査と lint と verify:full の実行記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-tradeoff-screen
- owners: ["daishiman"]
- tags: ["tradeoff", "p06", "test-run"]
- related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
- parent_feature: feat-tradeoff-screen
- phase_ref: P06
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-tradeoff-screen/sys-tradeoff-p06.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 の実装後に全テスト・型検査・lint・verify:full を実行し、結果を決定記録に残す。

## 背景

受入は実行済みの最新のテスト証跡だけで判定する。verify:full は 4175 の vite を前提にするため、起動条件も記録する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen, SYS-TRADEOFF-P05
- Entry gate: staging run run-tradeoff-20260921T2250Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実行のみ
- Backend: N/A: 実行のみ
- API: N/A: 実行のみ
- Data: N/A: 実行のみ
- Infrastructure: N/A: 実行のみ
- Security: N/A: 実行のみ
- Quality: applicable: 全テスト・型検査・lint・verify:full を実行して記録する
- Documentation: applicable: 実行記録を docs へ残す
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Deploy unit/environment: N/A: 実行記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 実行のみ

## 成果物

- Produced artifacts:
- docs/tradeoff-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/tradeoff-screen.ts
- packages/web/src/pages/tradeoff/
- Write scope/touches:
- docs/tradeoff-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRADEOFF-P06 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRADEOFF-P06 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRADEOFF-P06 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRADEOFF-P05) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの作り直し、保存済みの試算の一覧と翌月の突合の画面表示、アプリからの LLM 呼び出し、既存の tradeoff_plans の行やテーブルの削除・書換、既存の defenseLine・tradeoffCandidates・診断検知器の数字の変更、画像の数値の再現と web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- pnpm test・pnpm typecheck・pnpm lint・verify:full の結果 (件数と終了コード) が記録されている。
- 失敗が 1 件でもあれば P05 へ差し戻した記録がある。
- Automated commands:
- pnpm test
- pnpm typecheck
- pnpm lint
- pnpm verify:full
- Required evidence:
- docs/tradeoff-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-tradeoff-screen.md
- Architecture: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Feature: feat-tradeoff-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRADEOFF-P05
