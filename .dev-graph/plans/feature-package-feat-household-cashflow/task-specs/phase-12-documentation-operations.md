# System task overlay: 集計規則・6 区分の対応表・振替の対推定・名義表示名の docs 最終同期

## Machine-readable registration fields

- feature_package_id: feature-package/feat-household-cashflow
- owners: ["daishiman"]
- tags: ["household-cashflow", "p12", "documentation-sync"]
- related_nodes: ["arch-household-cashflow-auth", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-frontend", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops", "arch-household-cashflow-security", "arch-household-cashflow-ui-ux", "spec-household-cashflow-screen"]
- parent_feature: feat-household-cashflow
- phase_ref: P12
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-household-cashflow/sys-household-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

家計全体 = 事業 + 個人、前年比較の欠損規則、6 区分と MF 大項目の対応表、振替の対推定、名義表示名の既定と編集を docs に同期し、data-schema と ui-decisions を更新する。

## 背景

6 区分の対応表は core に 1 か所だけ置き、docs には同じ表を載せる。コードと docs の表がずれないことを、契約テストと合わせて確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen, SYS-HOUSEHOLD-P11
- Entry gate: staging run run-feat-household-cashflow-20260918T124500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 文書のみ
- Backend: N/A: 文書のみ
- API: N/A: 文書のみ
- Data: applicable: data-schema に owner_labels を追記する
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 文書のみ
- Quality: N/A: 検証は P11 まで
- Documentation: applicable: 集計規則と対応表と対推定を docs に同期する
- Operations: applicable: migration 適用手順を運用文書に追記する

## Architecture and deploy unit

- Architecture decisions: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/household-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md
- Consumed artifacts:
- docs/household-screen/design-decisions.md
- packages/core/src/household-summary.ts
- Write scope/touches:
- docs/household-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-HOUSEHOLD-P12 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-HOUSEHOLD-P12 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-HOUSEHOLD-P12 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-HOUSEHOLD-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (累計収支画面の新設、名義の内部値の変更と既存行の書き換え、明細への相手口座カラムの追加、共通シェルの作り直し、総収支・推移・マトリックス・分析ハブの中身の作り直し、集計結果の永続化とキャッシュ層と新しい外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- docs の 6 区分の対応表が core の対応表と一致する。
- data-schema に owner_labels の定義がある。
- 振替の対推定規則と 相手不明 の扱いが docs に明記されている。
- Automated commands:
- pnpm lint
- pnpm test
- Required evidence:
- docs/household-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-household-cashflow-screen.md
- Architecture: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Feature: feat-household-cashflow
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-HOUSEHOLD-P11
