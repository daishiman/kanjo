# System task overlay: 要件の基準線と着手時の確認事項 (0058 の空き・TanStack の型・問い合わせ数・overloaded の判定・照合順の数値変化) の確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-merge
- owners: ["daishiman"]
- tags: ["subscriptions-merge", "p01", "preparation"]
- related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
- parent_feature: feat-subscriptions-merge
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-merge/sys-subsmerge-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec の FR-001〜023・BR-001〜013・API 5 本・AC-001〜023 を実装の基準線として docs/subscriptions-screen.md に固定し、spec の『着手時に確かめる事項』を現物で確かめて結論を記録する。

## 背景

サブスク画面の統合は照合の名寄せにしか効かず、登録済みの行を別の登録済みの行へ統合しても統合元が一覧に残る (/subscriptions?vendor=aquavoice)。書込みは import の lease の取り合いで 409 や 500 になり、画面は『サーバー側で処理に失敗しました』で止まる。実装の前に、要件と現物の食い違いを先に潰す。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: migrations の最終番号が 0057 であり、0058 が他の worktree や main で使われていないことを確かめる。
Blocker: packages/web の TanStack Query の解決版で、useMutation の scope と useMutationState の型が使えることを確かめる。
Blocker: FR-009 (科目で先に絞る照合順) で他画面のサブスク集計の数値が変わる場合は、変わる箇所と理由を記録する。
制約: 他画面のデザインの作り直し・取込方式の変更・楽観更新・DO や Queues は扱わない (scope_out)。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
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
- features/feat-subscriptions-merge.md
- Write scope/touches:
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- docs/subscriptions-screen.md に『統合と並行制御』の節が足され、FR-001〜023・BR-001〜013・AC-001〜023 と検証手段 (core 契約・api 統合・web DOM) の対応表が記録されている。
- 着手時に確かめる事項 5 件 (0058 の空き・TanStack の scope と useMutationState の型・統合 1 回の問い合わせ数の見込み・D1 の overloaded の message・FR-009 による数値の変化) の結論と根拠が記録されている。
- scope_out 8 項目が記録され、他画面の作り直し・楽観更新・DO や Queues を範囲に含めていない。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/subscriptions-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-subscriptions-merge.md
- Architecture: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Feature: feat-subscriptions-merge
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
