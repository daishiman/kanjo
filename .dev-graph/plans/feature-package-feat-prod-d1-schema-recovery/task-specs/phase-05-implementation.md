# System task overlay: 復旧手順書と突合スクリプトの作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-prod-d1-schema-recovery (13 task で共有)
- owners / tags / related_nodes: owners は空、tags は server-error-recovery と prod-d1-recovery、related_nodes は arch-d1-schema-lifecycle
- parent_feature: feat-prod-d1-schema-recovery
- phase_ref: P05 (本 package 内で 1 件のみ)
- classification: confidence 1.0。理由は本 task が dev-graph feature の配下で単一 phase の実行単位として生成されたため。候補 path は tasks/feat-prod-d1-schema-recovery/SYS-PDSR-P05.md
- tracker_binding_intent: beads
- github_publication: mode は local_only、project_aliases と labels は空、milestone は無し
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch、worktree lease 必須、default-branch reconciliation、assignment_owner は dev-graph-scheduler

## 目的

恒久手順の SSOT へ迷わず到達できる薄い incident checklist と、行数突合を機械的に行うスクリプトが揃い、本番以外の環境で検証可能になっている状態。

## 背景

復旧の実行主体はユーザーである。通常手順は `docs/ci-cd-operations.md` に一元化し、incident checklist は固有値と証跡リンクだけを扱う。突合を目視に頼ると、テーブル数が増えたときに見落とす。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-d1-schema-lifecycle および feature ノード feat-prod-d1-schema-recovery
- Entry gate: P02 の設計節と P04 の検証設計節が確定していること。
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
- Documentation: 該当。復旧 runbook と証跡の整備を扱う。
- Operations: 該当。本番適用の実行と事後観察を扱う。

## Architecture and deploy unit

- Architecture decisions: arch-d1-schema-lifecycle (D1 migration gate / D2 backup / D3 approved pending manifest / D4 document ownership)
- Deploy unit/environment: Cloudflare D1 の本番データベース kanjo-db。本 task 自体はアプリケーションのデプロイを伴わない
- Compatibility/migration/backfill: 未適用マイグレーションを連番順に逐次適用する。部分適用と順序逸脱を許さず、データの補正投入は行わない

## 成果物

- Produced artifacts: 復旧runbookと行数突合スクリプトを作成する本 package 唯一の writer。runbook は `docs/ci-cd-operations.md` を恒久 policy/通常手順の SSOT として参照し、incident baseline・承認済み pending manifest・行数突合・証跡へのリンクだけを持つ薄い checklist とする。両者とも本番への書込みを自動実行しない。
- Consumed artifacts: arch-d1-schema-lifecycle の設計判断、feature feat-prod-d1-schema-recovery の受入条件
- Write scope/touches: docs/runbooks/prod-d1-schema-recovery.md および docs/runbooks/scripts/reconcile-row-counts.sh

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

- 本番への適用の実施。CI からの自動実行。バックアップの自動削除。

## Verification and evidence

- Automated commands: runbook が SSOT・baseline・manifest・行数突合・証跡のリンク以外の通常手順を複製していないことを確認する / 突合スクリプトをローカル D1 に対して実行し、非ゼロ終了が期待どおり起きることを確認する / スクリプトの出力に明細内容と金額が含まれないことを確認する
- Required evidence: runbook が docs/ci-cd-operations.md を参照し通常手順を複製していないこと、および突合スクリプトのローカル検査結果

## Rollout and rollback

- Rollout: リポジトリへ手順書とスクリプトを追加するのみ。稼働中システムへの影響は無い。
- Rollback trigger and steps: version history で手順書とスクリプトを前版へ戻す。本番状態には影響しない。

## Handoff

- Executor: dev-graph が登録した task ノードを worktree lease のもとで実行する。本番への書込みコマンドはユーザーが実行する
- Ready when: system-spec completeness が PASS で、P02/P04 の契約が確定し、参照元の blocked が解除されていること

## 参照情報

- System specification: system-spec-harness が生成した確定仕様の index ノード
- Architecture: arch-d1-schema-lifecycle
- Feature: feat-prod-d1-schema-recovery
- Phase doc: 生成側 13 phase 表の P05 (implementation)
- Dependencies: task-graph node SYS-PDSR-P04 (直前 phase の完了を前提とする)
- Secondary workstreams: data、operations
