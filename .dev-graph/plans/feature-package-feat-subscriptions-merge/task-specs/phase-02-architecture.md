# System task overlay: resolveVendorMerges・統合と取り消しの db.batch・fence の登録・migration 0058・backup の mergedIntoName・画面の待ち行列の設計決定記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-merge
- owners: ["daishiman"]
- tags: ["subscriptions-merge", "p02", "preparation"]
- related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
- parent_feature: feat-subscriptions-merge
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-merge/sys-subsmerge-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

実装の形を docs に固定する。core の resolveVendorMerges と defaultMergeTarget の型、統合・取り消し・統合先の削除の db.batch の文の並び、fence の登録、migration 0058 の DDL、backup の mergedIntoName、画面の待ち行列の状態遷移を決める。

## 背景

名寄せは applyFreeeDeals・サブスク画面の照合・projectCashContribution の 3 か所に散っており、統合の書込みは recomputeFromDeals を呼んで lease を長く握る。1 か所の名寄せと 1 つの db.batch へ寄せる形を先に決める。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge, SYS-SUBSMERGE-P01
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-SUBSMERGE-P01 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: 統合の batch は 10 文、取り消しは 11 文、統合先の削除は 9 文とし、fence などを足した最悪でも 20 文未満に収める。
Blocker: (a) の条件付き INSERT 以外の文は全て操作の行が在ることを条件にし、(a) が 0 行なら 409 とする。
制約: JSON_SNAPSHOT_MUTATION_CONSUMERS には新しい 2 表を足さない。既存 9 本の書込みの consumers には足す。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: コードと表の変更を伴わない

## 成果物

- Produced artifacts:
- docs/subscriptions-screen.md
- Consumed artifacts:
- specs/spec-subscriptions-merge.md
- architecture/subscriptions-merge-backend.md
- architecture/subscriptions-merge-database.md
- architecture/subscriptions-merge-frontend.md
- architecture/subscriptions-merge-security.md
- Write scope/touches:
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBSMERGE-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core の resolveVendorMerges (連鎖の解決、循環と自己統合は例外、参照先の無い id は統合なし) と defaultMergeTarget (推定月額が最大の登録済み行、無ければ null) の型が記録されている。
- 統合・取り消し・統合先の削除の各 db.batch の文の並びと、(a) 以外の文が操作の行の存在を条件にすることが記録されている。
- fence の登録 (merge と undo を CANONICAL_MUTATION_ROUTES に明示登録し、既存 9 本の consumers に新しい 2 表を足す) と lease の TTL (2 分) が記録されている。
- migration 0058 の DDL、schema-guard の EXPECTED_D1_MIGRATION の更新点、backup の mergedIntoName の検証規則 (名前の集合に無い・自己参照・循環は InvalidRestoreSettingsError) が記録されている。
- 画面の待ち行列 (scope subscriptions-write、409 canonical_write_busy と 503 d1_overloaded の同じ key での再送、revision の衝突の送り直し、5xx と通信の失敗だけの再試行ボタン) の状態遷移が記録されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/subscriptions-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-subscriptions-merge.md
- Architecture: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Feature: feat-subscriptions-merge
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBSMERGE-P01
