# System task overlay: FINAL-UI 抽出値による要件ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p01", "requirements"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-ui-ux", "arch-design-system-frontend"]
- parent_feature: feat-design-system-foundation
- phase_ref: P01
- lifecycle_role: preparation
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

specs/spec-design-system-foundation.md と DESIGN-SYSTEM.md の規定値を requirements-baseline.md へ固定し、FR-001..FR-005 と S1-S6 の対応を後続 phase が参照できる状態にする。

## 背景

specs/spec-design-system-foundation.md は FINAL-UI (design/FINAL-UI, DESIGN-SYSTEM.md) を見た目の正本と定め、単独利用者が新しい画面をつくるときに共通定義を参照するだけで同じ見た目になることを目的にしている。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-ui-ux、arch-design-system-frontend
- Entry gate: 依存 task (なし (P01 起点)) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実装コードは変更しない (P05 の責務)
- Backend: N/A: 実装コードは変更しない (P05 の責務)
- API: N/A: API を公開・変更しない (scope_out)
- Data: N/A: 永続化を変更しない (arch-design-system-database)
- Infrastructure: N/A: 配信構成を変更しない (arch-design-system-infrastructure)
- Security: N/A: CSP・実データ混入対策は本 task の範囲外 (arch-design-system-security)
- Quality: applicable: FR-001..FR-005 と S1-S6 の対応表が後続 phase の検証基準になる
- Documentation: applicable: requirements-baseline.md を新規作成する
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-ui-ux、arch-design-system-frontend
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/design-system/requirements-baseline.md
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- docs/design-system/requirements-baseline.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし (P01 起点)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm lint (既存 check-glossary.mjs 等の文書検査が緑のままであることを確認する)
- DESIGN-SYSTEM.md の値と requirements-baseline.md の転記表を目視突合し差分 0 件を確認する
- Required evidence:
- docs/design-system/requirements-baseline.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: requirements-baseline.md の追加コミットを revert する。後続 phase は未着手のため影響範囲は docs のみ。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-ui-ux、arch-design-system-frontend
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: none
