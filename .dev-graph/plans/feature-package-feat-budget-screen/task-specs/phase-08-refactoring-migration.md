# System task overlay: 旧 Budget.tsx 参照・重複判定ロジック・budgets 表書き換え有無の読取専用監査

## Machine-readable registration fields

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p08", "audit"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

旧 pages/Budget.tsx への参照が残っていないこと、算出ロジックの重複が無いこと、migration 0048 が既存 budgets 行を書き換えていないことを読取専用で監査する。

## 背景

pages/Budget.tsx は互換の re-export 1 行だけであることを確認し、予算の算出が packages/core/src/budget-screen.ts 以外で再実装されていないことを確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 読取専用監査を行う
- Documentation: applicable: 監査結果を記録する
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: 読取専用監査のみ
- Compatibility/migration/backfill: N/A: 監査のみで変更を行わない

## 成果物

- Produced artifacts:
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- packages/web/src/pages/Budget.tsx
- packages/core/src/budget-screen.ts
- migrations/0048_budget_plans.sql
- Write scope/touches:
- docs/budget-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/web/src/pages/Budget.tsx が互換の re-export 1 行だけであり、旧 317 行の実装への参照が repository 内で 0 件である。
- 予算の算出ロジックが packages/core/src/budget-screen.ts の純関数以外で再実装されていない (api / web に重複判定が無い)。
- migration 0048 適用前後で既存 budgets 表の行数と内容が変わらないこと (UPDATE・DELETE が 0 件) が確認されている。
- P06 / P07 の証跡が最終コードに対応し、既知逸脱・未実施・一部適合が PASS に含まれていない。
- Automated commands:
- rg による旧 pages/Budget.tsx 参照と重複判定ロジックの検査
- P06 / P07 の証跡と git diff の照合
- Required evidence:
- docs/budget-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 監査記録に誤りがあれば docs の追記だけを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P07
