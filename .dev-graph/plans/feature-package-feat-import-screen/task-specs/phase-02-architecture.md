# System task overlay: 取込規則純関数と IMPORT_LIMITS・検査と確定の API・migration 0050・画面分割のワークストリーム設計決定記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-import-screen
- owners: ["daishiman"]
- tags: ["import-screen", "p02", "preparation"]
- related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
- parent_feature: feat-import-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-import-screen/sys-import-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core の import-screen 純関数と IMPORT_LIMITS、検査・ファイル追加と除外・確定・履歴の経路、migration 0050 の新表と列追加、pages/import/ への分割、URL の検索パラメータの設計決定を 1 か所に記録し、実装の分担と境界を確定する。

## 背景

ファイルの状態・取込可否・要約・結果・上限の判定を web と api が別々に持つと、送信前の判定と 413 が食い違う。判定と上限値を core の 1 か所へ寄せ、API は仮置きと記録、画面は描くだけにする設計を、実装前に決定記録として固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen, SYS-IMPORT-P01
- Entry gate: staging run run-import-screen-20260921T2311Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: pages/import/ の部品分割と URL の検索パラメータを設計する
- Backend: applicable: import-screen 純関数と IMPORT_LIMITS の入出力を設計する
- API: applicable: 検査・確定・履歴の経路と既存経路の扱いを設計する
- Data: applicable: migration 0050 の新表 3 件と import_runs の列追加を設計する
- Infrastructure: N/A: binding は既存の R2 と D1 のまま
- Security: N/A: セキュリティ設計は P03 で独立レビューする
- Quality: N/A: テスト設計は P04
- Documentation: applicable: 設計決定を docs へ記録する
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/import-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-import-screen.md
- architecture/import-screen-ui-ux.md
- architecture/import-screen-frontend.md
- architecture/import-screen-backend.md
- architecture/import-screen-database.md
- architecture/import-screen-auth.md
- architecture/import-screen-security.md
- architecture/import-screen-infrastructure.md
- architecture/import-screen-maintenance-ops.md
- Write scope/touches:
- docs/import-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPORT-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPORT-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPORT-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPORT-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (銀行・クレジットカードの明細ファイルの取り込みと、その対応サービスの案内、共通シェル、freee / マネーフォワードの API との自動連携、既存の取込形式、既存の imports と明細の行の書き換え、取消・破棄・差分プレビュー・手当ての継続再適用の規則そのものの変更、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- ファイルの状態 6 種・取込可否・要約 6 項目・取込 1 回の結果・上限の判定の関数の入出力が決定記録にある。
- 検査 ID と import_runs.id の関係、keepOnShrink と POST /imports の扱い、IMPORT_LIMITS に含める範囲の結論が決定記録にある。
- migration 0050 が表と列の追加のみで既存行の更新 0 件であることが設計として明記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/import-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-import-screen.md
- Architecture: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Feature: feat-import-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPORT-P01
