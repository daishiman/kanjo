# System task overlay: 要件ベースライン確定と持ち越し事項の解決担当の割り当て

## Machine-readable registration fields

- feature_package_id: feature-package/feat-cash-screen
- owners: ["daishiman"]
- tags: ["cash", "p01", "preparation"]
- related_nodes: ["arch-cash-auth", "arch-cash-backend", "arch-cash-database", "arch-cash-frontend", "arch-cash-infrastructure", "arch-cash-maintenance-ops", "arch-cash-security", "arch-cash-ui-ux", "spec-cash-screen"]
- parent_feature: feat-cash-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-cash-screen/sys-cash-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入 S1〜S5 を検証可能な文へ分解し、持ち越し事項 OI-01〜OI-05 と『agent 推定・利用者未確認』の値に確認の担当 phase を割り当てる。

## 背景

現金入力の規範は specs/spec-cash-screen.md と system-spec に確定済みだが、画像からの解釈や agent 推定の値が残る。実装前にどれを誰が確かめるかを固定しないと、P05 で期待値が揺れる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Entry gate: staging run plan-feat-cash-screen-20260921T2307Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 要件の固定のみ
- Backend: N/A: 要件の固定のみ
- API: N/A: 要件の固定のみ
- Data: N/A: 要件の固定のみ
- Infrastructure: N/A: 要件の固定のみ
- Security: N/A: 要件の固定のみ
- Quality: applicable: 受入 S1〜S5 を検証可能な文に分解する
- Documentation: applicable: 要件ベースラインを docs へ置く
- Operations: N/A: 運用手順は P12 の責務

## Architecture and deploy unit

- Architecture decisions: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/cash-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-cash-screen.md
- features/feat-cash-screen.md
- system-spec/00-requirements-definition.md
- Write scope/touches:
- docs/cash-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CASH-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CASH-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CASH-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (領収書ファイルの保存、取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)、共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更、担当者の自由登録と管理画面 (qa-cash-decision-002)、モバイル・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)、既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え、税務判断 (税務上の正本は freee))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S5 が検証可能な文に分解され docs/cash-screen/design-decisions.md に載っている。
- 持ち越し事項 OI-01〜OI-05 それぞれに解決担当 phase が割り当てられている。
- 『agent 推定・利用者未確認』の値 (1 ページ 20 件・業務の目的の選択肢・名義 NULL の表示など) が一覧になり、確認の担当 phase が決まっている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/cash-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-cash-screen.md
- Architecture: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Feature: feat-cash-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
