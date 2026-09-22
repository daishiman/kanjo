# System task overlay: 算出契約・API 契約・migration 契約・snapshot/バックアップ整合の独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p03", "design-review"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 で固定した算出契約・API 契約・migration 契約・snapshot/バックアップ整合の設計を、実装着手前に独立してレビューする。

## 背景

レビューは spec-budget-screen の BR-01〜BR-25・API 契約・migration DDL と、arch-budget-* の Risks に照らして行い、指摘を全て docs に記録する。収入行の差額の色・年額の下限・その他収入 (manualOnly) の扱いは未決のまま実装へ持ち越すことをレビュー結果として明記する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 収入行の差額の色規則・年額の下限・その他収入 (manualOnly) の行の扱いは、本レビューでも値を決定せず、agent 推定値として実装し DOM テストで表現を変えられる前提であることを記録する。
Open risk: budget_plans の JSON snapshot consumer 登録とバックアップ・復元 write-set 登録が両方揃っているかどうかは、本レビューで設計の整合性だけを確認し、実装済みであることの確認は SYS-BUDGET-P05/SYS-BUDGET-P08 に持ち越す。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: applicable: 算出契約をレビューする
- API: N/A: 本 phase の責務に含まれない
- Data: applicable: migration 契約と snapshot/バックアップ整合をレビューする
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: PUT のフェンス登録設計をレビューする
- Quality: applicable: レビュー観点を検証可能な文として記録する
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: レビュー記録のみ

## 成果物

- Produced artifacts:
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-budget-screen.md
- architecture/budget-security.md
- architecture/budget-database.md
- Write scope/touches:
- docs/budget-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- レビュー指摘が docs に列挙され、全件が解消済みか理由付きで持ち越されている。
- PUT /api/budget-plans が canonicalMutationFence の内側にあること、GET 2 本はフェンス対象外であることが確認されている。
- budget_plans を JSON_SNAPSHOT_MUTATION_CONSUMERS とバックアップ・復元の write-set の両方に入れる設計が揃っていることが確認されている (open item: snapshot consumer とバックアップ write-set の整合)。
- 収入の行の差額の色規則・年額の下限・その他収入 (manualOnly) の扱いが未決のまま実装へ渡され、agent 推定の値として実装し DOM テストで表現を変えられる前提であることがレビュー結果として明記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/budget-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P02
