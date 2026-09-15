# System task overlay: 概況 API・core 集計・D1 テーブルのワークストリーム設計決定記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p02", "architecture"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

GET /api/overview・GET /api/review-queue・PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey・PUT/DELETE /api/monthly-close/:month/review の4エンドポイントのパス・クエリ・レスポンス形と、review_snoozes・monthly_close_reviews の列定義をdocs/overview-screen/architecture-decision.mdへ確定記録する。

## 背景

spec-overview-screen.md のAPI契約節は「パスの細部・クエリ名・エラー形は実装方針の提案 (推定・planで確定)」としており、本taskがplan側の確定責務を負う。architecture/overview-screen-backend.md と architecture/overview-screen-database.md の制約に従う。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P01が完了し、requirements-baseline.mdの未決事項確認結果が記録されていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: web側が呼び出すAPIレスポンス形をここで確定する
- Backend: applicable: packages/api/src/routes/analytics.ts に追加する4エンドポイントの設計を確定する
- API: applicable: OverviewResponse / ReviewQueueResponse の形状とエラー契約を確定する
- Data: applicable: review_snoozes / monthly_close_reviews の列・主キー・CHECK制約を確定する
- Infrastructure: N/A: 配信構成の変更はない (既存Cloudflare Workers/D1のまま)
- Security: applicable: 既存authGuard→mustChangePasswordFence→runtimeSchemaGuard→canonicalMutationFenceの適用順を確定する
- Quality: N/A: テスト設計はP04の責務
- Documentation: applicable: 決定記録をdocs/overview-screen/architecture-decision.mdへ残す
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: N/A: 決定記録のみで配布物を持たない
- Compatibility/migration/backfill: GET /api/summary は変更せず、新規APIは追加のみとする (spec-overview-screen.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/overview-screen/architecture-decision.md
- Consumed artifacts:
- specs/spec-overview-screen.md
- architecture/overview-screen-backend.md
- architecture/overview-screen-database.md
- architecture/overview-screen-auth.md
- Write scope/touches:
- docs/overview-screen/architecture-decision.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm typecheck (既存構成に影響がないことを確認する)
- Required evidence:
- docs/overview-screen/architecture-decision.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/overview-screen/architecture-decision.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P01
