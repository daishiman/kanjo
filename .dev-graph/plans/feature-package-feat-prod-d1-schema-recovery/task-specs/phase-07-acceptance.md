# System task overlay: 本番適用の受入判定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-prod-d1-schema-recovery (13 task で共有)
- owners / tags / related_nodes: owners は空、tags は server-error-recovery と prod-d1-recovery、related_nodes は arch-d1-schema-lifecycle
- parent_feature: feat-prod-d1-schema-recovery
- phase_ref: P07 (本 package 内で 1 件のみ)
- classification: confidence 1.0。理由は本 task が dev-graph feature の配下で単一 phase の実行単位として生成されたため。候補 path は tasks/feat-prod-d1-schema-recovery/SYS-PDSR-P07.md
- tracker_binding_intent: beads
- github_publication: mode は local_only、project_aliases と labels は空、milestone は無し
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch、worktree lease 必須、default-branch reconciliation、assignment_owner は dev-graph-scheduler

## 目的

ユーザーが本番へ適用を実施し、未適用 0 件・行数非減少・取込および取込履歴の正常応答という三つの合格条件がすべて観測値で確認されている状態。

## 背景

本 feature の価値は本番の稼働回復そのものにある。適用コマンドの実行権限はユーザーが保持するという決定に従い、本 task は手順の提示と結果の検証を担い、適用の実行そのものは担わない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-d1-schema-lifecycle および feature ノード feat-prod-d1-schema-recovery
- Entry gate: P06 の予行が合格し、適用直前の全件エクスポートが取得済みであること。remote list と repository head / ordered migrations digest を再取得し、P01 baseline から変化していれば承認せず P01 へ差し戻すこと。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity は github:daishiman/kanjo、root_resolution_source は explicit-cli、config は .dev-graph/config.json。絶対 path を成果物へ書かない

## Workstream applicability

- Frontend: N/A: 本 feature の成果物は運用手順と検証スクリプトであり画面変更を含まないため本 task では扱わない。
- Backend: N/A: アプリケーションコードの変更を伴わないため本 task では扱わない。
- API: N/A: API 契約の変更を伴わないため本 task では扱わない。
- Data: 該当。本番 D1 のスキーマ適用と行数保全を扱う。
- Infrastructure: N/A: 既存の D1 と wrangler 設定を前提とし構成変更を伴わないため本 task では扱わない。
- Security: N/A: 本番全件ダンプの取扱いとログ非出力方針の遵守を扱うため本 task では扱わない。
- Quality: N/A: 適用前後の検証と受入判定を扱うため本 task では扱わない。
- Documentation: N/A: 復旧 runbook と証跡の整備を扱うため本 task では扱わない。
- Operations: 該当。本番適用の実行と事後観察を扱う。

## Architecture and deploy unit

- Architecture decisions: arch-d1-schema-lifecycle (D1 migration gate / D2 backup / D3 approved pending manifest / D4 document ownership)
- Deploy unit/environment: Cloudflare D1 の本番データベース kanjo-db。本 task 自体はアプリケーションのデプロイを伴わない
- Compatibility/migration/backfill: 未適用マイグレーションを連番順に逐次適用する。部分適用と順序逸脱を許さず、データの補正投入は行わない

## 成果物

- Produced artifacts: repository head / ordered migrations digest、remote applied head、ordered pending files、captured_at、approved_at を持つ人間承認済み manifest と、適用後の受入記録を phase 固有 evidence として残す。
- Consumed artifacts: arch-d1-schema-lifecycle の設計判断、feature feat-prod-d1-schema-recovery の受入条件
- Write scope/touches: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-07-approved-pending-manifest.json および .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-07-acceptance.md

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

- 適用コマンドの代行実行。合格条件を満たさない状態での受入。

## Verification and evidence

- Automated commands: 適用直前に remote list と repository head / ordered migrations digest を再取得し承認済み manifest と一致することを確認する / 適用後に migrations list を実行し未適用件数が 0 であることを確認する / 突合スクリプトを実行し主要テーブルの行数が基準値から減少していないことを確認する / 取込と取込履歴の経路が本番で正常応答を返すことを確認する
- Required evidence: 人間承認済み manifest、Migrate 実行記録、適用後の remote list、行数突合、動作確認

## Rollout and rollback

- Rollout: ユーザーが承認済み manifest を確認して Migrate を `APPLY` で実行する。Deploy は適用しない。manifest の remote list または repository head / ordered migrations digest が変わっていれば実行せず再取得する。
- Rollback trigger and steps: 合格条件を満たさない場合は取得済みエクスポートからの復元を検討する。復元の実行判断と実行はユーザーが行う。

## Handoff

- Executor: dev-graph が登録した task ノードを worktree lease のもとで実行する。本番への書込みコマンドはユーザーが実行する
- Ready when: system-spec completeness が PASS で、P06 が合格し、参照元の blocked が解除されていること

## 参照情報

- System specification: system-spec-harness が生成した確定仕様の index ノード
- Architecture: arch-d1-schema-lifecycle
- Feature: feat-prod-d1-schema-recovery
- Phase doc: 生成側 13 phase 表の P07 (acceptance)
- Dependencies: task-graph node SYS-PDSR-P06 (直前 phase の完了を前提とする)
- Secondary workstreams: data
