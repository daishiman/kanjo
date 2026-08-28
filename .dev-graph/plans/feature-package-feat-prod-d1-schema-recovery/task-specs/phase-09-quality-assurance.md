# System task overlay: 品質・セキュリティ・運用準備の確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-prod-d1-schema-recovery (13 task で共有)
- owners / tags / related_nodes: owners は空、tags は server-error-recovery と prod-d1-recovery、related_nodes は arch-d1-schema-lifecycle
- parent_feature: feat-prod-d1-schema-recovery
- phase_ref: P09 (本 package 内で 1 件のみ)
- classification: confidence 1.0。理由は本 task が dev-graph feature の配下で単一 phase の実行単位として生成されたため。候補 path は tasks/feat-prod-d1-schema-recovery/SYS-PDSR-P09.md
- tracker_binding_intent: beads
- github_publication: mode は local_only、project_aliases と labels は空、milestone は無し
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch、worktree lease 必須、default-branch reconciliation、assignment_owner は dev-graph-scheduler

## 目的

復旧作業で生じた成果物と記録が、ログとレスポンスに明細内容および金額を残さないという既存方針を守っていることが確認され、取得したダンプの取扱いが完了している状態。

## 背景

復旧作業では本番の全件エクスポートという最も機微な成果物を扱う。作業が終わった後にこれが残り続けると、障害対応が新たな露出面を作ってしまう。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-d1-schema-lifecycle および feature ノード feat-prod-d1-schema-recovery
- Entry gate: P07 の受入が合格していること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity は github:daishiman/kanjo、root_resolution_source は explicit-cli、config は .dev-graph/config.json。絶対 path を成果物へ書かない

## Workstream applicability

- Frontend: N/A: 本 feature の成果物は運用手順と検証スクリプトであり画面変更を含まないため本 task では扱わない。
- Backend: N/A: アプリケーションコードの変更を伴わないため本 task では扱わない。
- API: N/A: API 契約の変更を伴わないため本 task では扱わない。
- Data: N/A: 本番 D1 のスキーマ適用と行数保全を扱うため本 task では扱わない。
- Infrastructure: N/A: 既存の D1 と wrangler 設定を前提とし構成変更を伴わないため本 task では扱わない。
- Security: 該当。本番全件ダンプの取扱いとログ非出力方針の遵守を扱う。
- Quality: 該当。適用前後の検証と受入判定を扱う。
- Documentation: N/A: 復旧 runbook と証跡の整備を扱うため本 task では扱わない。
- Operations: 該当。本番適用の実行と事後観察を扱う。

## Architecture and deploy unit

- Architecture decisions: arch-d1-schema-lifecycle (D1 migration gate / D2 backup / D3 approved pending manifest / D4 document ownership)
- Deploy unit/environment: Cloudflare D1 の本番データベース kanjo-db。本 task 自体はアプリケーションのデプロイを伴わない
- Compatibility/migration/backfill: 未適用マイグレーションを連番順に逐次適用する。部分適用と順序逸脱を許さず、データの補正投入は行わない

## 成果物

- Produced artifacts: ダンプ削除とログ非露出の確認結果を phase 固有 evidence に残す。runbook/script は read-only で検査する。
- Consumed artifacts: arch-d1-schema-lifecycle の設計判断、feature feat-prod-d1-schema-recovery の受入条件
- Write scope/touches: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-09-quality.md

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

- 既存のログ基盤の作り直し。権限管理の全面見直し。

## Verification and evidence

- Automated commands: 作業記録と手順書の出力例に明細内容と金額が含まれていないことを確認する / 取得したダンプが作業完了後に削除されたことを確認する / 夜間バックアップが成功し当日分のスナップショットが保存されていることを確認する
- Required evidence: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-09-quality.md

## Rollout and rollback

- Rollout: 確認と削除を実施し、結果を作業記録へ追記する。
- Rollback trigger and steps: 削除済みダンプは復元しない。必要が生じた場合は改めて取得手順から実施する。

## Handoff

- Executor: dev-graph が登録した task ノードを worktree lease のもとで実行する。本番への書込みコマンドはユーザーが実行する
- Ready when: system-spec completeness が PASS で、P07 が合格し、参照元の blocked が解除されていること

## 参照情報

- System specification: system-spec-harness が生成した確定仕様の index ノード
- Architecture: arch-d1-schema-lifecycle
- Feature: feat-prod-d1-schema-recovery
- Phase doc: 生成側 13 phase 表の P09 (quality-assurance)
- Dependencies: task-graph node SYS-PDSR-P08 (直前 phase の完了を前提とする)
- Secondary workstreams: operations、quality
