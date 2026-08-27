# System task overlay: 復旧完了の最終ゲート

## Machine-readable registration fields

- feature_package_id: feature-package/feat-prod-d1-schema-recovery (13 task で共有)
- owners / tags / related_nodes: owners は空、tags は server-error-recovery と prod-d1-recovery、related_nodes は arch-d1-schema-lifecycle
- parent_feature: feat-prod-d1-schema-recovery
- phase_ref: P10 (本 package 内で 1 件のみ)
- classification: confidence 1.0。理由は本 task が dev-graph feature の配下で単一 phase の実行単位として生成されたため。候補 path は tasks/feat-prod-d1-schema-recovery/SYS-PDSR-P10.md
- tracker_binding_intent: beads
- github_publication: mode は local_only、project_aliases と labels は空、milestone は無し
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch、worktree lease 必須、default-branch reconciliation、assignment_owner は dev-graph-scheduler

## 目的

P01 から P09 までの受入条件がすべて満たされていることを、実施者とは独立した観点で通し確認し終えている状態。

## 背景

個々の phase が合格していても、通しで見ると記録の欠落や条件の読み替えが残ることがある。最終ゲートを独立に置くことで、部分的な達成を全体の完了と誤認しない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-d1-schema-lifecycle および feature ノード feat-prod-d1-schema-recovery
- Entry gate: P01 から P09 の受入が記録上すべて合格していること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity は github:daishiman/kanjo、root_resolution_source は explicit-cli、config は .dev-graph/config.json。絶対 path を成果物へ書かない

## Workstream applicability

- Frontend: N/A: 本 feature の成果物は運用手順と検証スクリプトであり画面変更を含まないため本 task では扱わない。
- Backend: N/A: アプリケーションコードの変更を伴わないため本 task では扱わない。
- API: N/A: API 契約の変更を伴わないため本 task では扱わない。
- Data: N/A: 本番 D1 のスキーマ適用と行数保全を扱うため本 task では扱わない。
- Infrastructure: N/A: 既存の D1 と wrangler 設定を前提とし構成変更を伴わないため本 task では扱わない。
- Security: N/A: 本番全件ダンプの取扱いとログ非出力方針の遵守を扱うため本 task では扱わない。
- Quality: 該当。適用前後の検証と受入判定を扱う。
- Documentation: N/A: 復旧 runbook と証跡の整備を扱うため本 task では扱わない。
- Operations: 該当。本番適用の実行と事後観察を扱う。

## Architecture and deploy unit

- Architecture decisions: arch-d1-schema-lifecycle (D1 migration gate / D2 backup / D3 approved pending manifest / D4 document ownership)
- Deploy unit/environment: Cloudflare D1 の本番データベース kanjo-db。本 task 自体はアプリケーションのデプロイを伴わない
- Compatibility/migration/backfill: 未適用マイグレーションを連番順に逐次適用する。部分適用と順序逸脱を許さず、データの補正投入は行わない

## 成果物

- Produced artifacts: 全 phase の受入条件と対応する証跡の対応表を phase 固有 evidence に作成する。既存成果物は read-only で検査する。
- Consumed artifacts: arch-d1-schema-lifecycle の設計判断、feature feat-prod-d1-schema-recovery の受入条件
- Write scope/touches: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-10-final-gate.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: 本 package は beads 束縛のため GitHub 側の公開先を持たない
- PR completion policy: linked_pr_merged_all
- PR body contract: 対応する beads issue 識別子と dev-graph の graph_node_id を本文へ記載し、既定ブランチを対象とする
- Ownership boundary: 本 spec は intent の宣言のみを行い、起票と完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph への登録後に scheduler が devgraph 接頭辞と graph_node_id から採番する。本 spec では事前に割り当てない
- Worktree lease: 実装着手前に graph_node_id で lease を claim し、作業中は heartbeat を送り、完了時に release する
- Parallel safety: depends_on が完了しており、resource_scope と有効な lease が他 task と重ならないこと
- Completion projection: feature ブランチ上では保留イベントのみを記録し、既定ブランチが清浄な状態で確定的な完了を書き込む

## スコープ外

- 未達項目の実作業による解消。作業の再設計。

## Verification and evidence

- Automated commands: 各 phase の受入条件に対応する証跡が実在することを一件ずつ確認する / 証跡が欠落している受入条件が 0 件であることを確認する
- Required evidence: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-10-final-gate.md

## Rollout and rollback

- Rollout: 対応表を作業記録へ追加するのみ。
- Rollback trigger and steps: 対応表を差し戻す。本番状態には影響しない。

## Handoff

- Executor: dev-graph が登録した task ノードを worktree lease のもとで実行する。本番への書込みコマンドはユーザーが実行する
- Ready when: system-spec completeness が PASS で、P01〜P09 の evidence が揃い、参照元の blocked が解除されていること

## 参照情報

- System specification: system-spec-harness が生成した確定仕様の index ノード
- Architecture: arch-d1-schema-lifecycle
- Feature: feat-prod-d1-schema-recovery
- Phase doc: 生成側 13 phase 表の P10 (final-review)
- Dependencies: task-graph node SYS-PDSR-P09 (直前 phase の完了を前提とする)
- Secondary workstreams: operations
