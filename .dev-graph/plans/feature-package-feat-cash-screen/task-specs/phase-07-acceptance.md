# System task overlay: 受入基準 S1 から S5 の検証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-cash-screen
- owners: ["daishiman"]
- tags: ["cash", "p07", "acceptance"]
- related_nodes: ["arch-cash-auth", "arch-cash-backend", "arch-cash-database", "arch-cash-frontend", "arch-cash-infrastructure", "arch-cash-maintenance-ops", "arch-cash-security", "arch-cash-ui-ux", "spec-cash-screen"]
- parent_feature: feat-cash-screen
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-cash-screen/sys-cash-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入 S1〜S5 のそれぞれを、実行済みのテスト証跡と画面の描画検査で PASS / FAIL に判定する。

## 背景

一部適合や既知の逸脱を PASS に数えない規則があるため、各項目に証跡を 1 対 1 で結び付ける。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen, SYS-CASH-P06
- Entry gate: staging run plan-feat-cash-screen-20260921T2307Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面の構成要素と状態を描画検査で確かめる
- Backend: N/A: 検証のみ
- API: N/A: 検証のみ
- Data: N/A: 検証のみ
- Infrastructure: N/A: 検証のみ
- Security: N/A: 検証のみ
- Quality: applicable: S1〜S5 を判定する
- Documentation: N/A: docs の同期は P12
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 検証のみ

## 成果物

- Produced artifacts:
- docs/cash-screen/design-decisions.md
- Consumed artifacts:
- docs/cash-screen/design-decisions.md
- specs/spec-cash-screen.md
- Write scope/touches:
- docs/cash-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CASH-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CASH-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CASH-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CASH-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (領収書ファイルの保存、取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)、共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更、担当者の自由登録と管理画面 (qa-cash-decision-002)、モバイル・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)、既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え、税務判断 (税務上の正本は freee))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- S1〜S5 のそれぞれに PASS / FAIL と証跡が記録されている。
- 一部適合を PASS に数えていない。
- check:cash-screen の描画検査が緑である。
- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web check:cash-screen
- Required evidence:
- docs/cash-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-cash-screen.md
- Architecture: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Feature: feat-cash-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CASH-P06
