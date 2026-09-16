# System task overlay: 再現可能な証跡索引の作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reconciliation
- owners: ["daishiman"]
- tags: ["reconciliation", "p11", "evidence"]
- related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
- parent_feature: feat-reconciliation
- phase_ref: P11
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-reconciliation/sys-recon-p11.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P07の受入検証・P09の保証確認で使った検証コマンドを再実行可能な形で索引化する。

## 背景

feature-execution-package-contractのP11はevidence (再現可能な証跡索引) を担う。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Entry gate: staging run sdp-feat-reconciliation-20260915T1102Z のgoal-spec.jsonがreadiness_pin.status=completeであること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- Depends on: SYS-RECON-P10 の成果物が確定していること

## Workstream applicability

- Frontend: N/A: 本taskの関心外
- Backend: N/A: 本taskの関心外
- API: N/A: 本taskの関心外
- Data: N/A: 本taskの関心外
- Infrastructure: N/A: 本taskの関心外
- Security: N/A: 本taskの関心外
- Quality: applicable: 証跡索引の作成そのもの
- Documentation: applicable: docs/reconciliation/evidence.mdを新設する
- Operations: applicable: 第三者による再実行可能性を保証する

## Architecture and deploy unit

- Architecture decisions: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Deploy unit/environment: N/A: 索引文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本taskはコードのマイグレーションを直接実行しない

## 成果物

- Produced artifacts:
- docs/reconciliation/evidence.md
- Consumed artifacts:
- docs/reconciliation/acceptance.md
- docs/reconciliation/assurance.md
- system-spec/00-requirements-definition.md
- specs/spec-reconciliation.md
- features/feat-reconciliation.md
- system-spec/completeness-findings.json
- Write scope/touches:
- docs/reconciliation/evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-RECON-P11 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-RECON-P11 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-RECON-P11 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-RECON-P10) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (総収支・マトリクス・推移・診断タブ中身の作り直し、他画面の中身の作り直し、freee/MoneyForwardへの書き戻し、外部送信、利用規約等の本文新規作成、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm lint
- Required evidence:
- docs/reconciliation/evidence.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/reconciliation/evidence.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Feature: feat-reconciliation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-RECON-P10
