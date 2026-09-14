# System task overlay: 再現可能な証跡索引の作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p11", "evidence"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-maintenance-ops"]
- parent_feature: feat-design-system-foundation
- phase_ref: P11
- lifecycle_role: evidence
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p11.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

S1-S6 それぞれの根拠を再現可能な形で1か所に索引化し、P10 の最終レビュー結果を再現できる状態にする。

## 背景

feature-execution-package-contract.md の P11 責務 (再現可能な証跡) に従い、P06/P07/P09 の記録を1つの索引にまとめる。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-maintenance-ops
- Entry gate: 依存 task (SYS-DSFOUND-P10) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実装コードは変更しない
- Backend: N/A: 実装コードは変更しない
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: N/A: 配信構成を変更しない
- Security: N/A: P09 で確認済み
- Quality: applicable: 本 task の中心責務。S1-S6 の根拠索引を作成する
- Documentation: applicable: evidence.md を新規作成する
- Operations: applicable: 実行ログの参照先を索引化する

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-maintenance-ops
- Deploy unit/environment: N/A: 索引文書のみで配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/design-system/evidence.md
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- docs/design-system/evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P11 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P11 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P11 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P10) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm lint
- Required evidence:
- docs/design-system/evidence.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: evidence.md の記録のみを revert する。索引先の記録自体には影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-maintenance-ops
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P10
