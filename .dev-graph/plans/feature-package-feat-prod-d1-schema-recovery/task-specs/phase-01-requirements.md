# System task overlay: 復旧要件のベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-prod-d1-schema-recovery (13 task で共有)
- owners / tags / related_nodes: owners は空、tags は server-error-recovery と prod-d1-recovery、related_nodes は arch-d1-schema-lifecycle
- parent_feature: feat-prod-d1-schema-recovery
- phase_ref: P01 (本 package 内で 1 件のみ)
- classification: confidence 1.0。理由は本 task が dev-graph feature の配下で単一 phase の実行単位として生成されたため。候補 path は tasks/feat-prod-d1-schema-recovery/SYS-PDSR-P01.md
- tracker_binding_intent: beads
- github_publication: mode は local_only、project_aliases と labels は空、milestone は無し
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch、worktree lease 必須、default-branch reconciliation、assignment_owner は dev-graph-scheduler

## 目的

本番 D1 の未適用マイグレーション一覧、保全対象テーブル、成功判定基準の三つが観測値として確定し、以降の全 phase がこの baseline だけを参照して進める状態。

## 背景

取込と取込履歴が同時に 500 を返す原因は、本番 d1_migrations の記録が 0005 で止まり 0006 以降が未適用であることにある。復旧作業の各手順が何をもって完了とするかを先に固定しないと、部分適用や取りこぼしを成功と誤認する余地が残る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-d1-schema-lifecycle および feature ノード feat-prod-d1-schema-recovery
- Entry gate: system-spec completeness が PASS であること。PASS 前は本 task を含む実装 phase へ進まない。
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
- Operations: N/A: 本番適用の実行と事後観察を扱うため本 task では扱わない。

## Architecture and deploy unit

- Architecture decisions: arch-d1-schema-lifecycle (D1 migration gate / D2 backup / D3 approved pending manifest / D4 document ownership)
- Deploy unit/environment: Cloudflare D1 の本番データベース kanjo-db。本 task 自体はアプリケーションのデプロイを伴わない
- Compatibility/migration/backfill: 未適用マイグレーションを連番順に逐次適用する。部分適用と順序逸脱を許さず、データの補正投入は行わない

## 成果物

- Produced artifacts: 作業開始時の remote list、repository head / ordered migrations digest、remote applied head、ordered pending files、保全対象、成功判定を持つ incident baseline を作成する。事故時の 0006〜0014 は履歴情報であり、適用対象の上限には使わない。
- Consumed artifacts: arch-d1-schema-lifecycle の設計判断、feature feat-prod-d1-schema-recovery の受入条件
- Write scope/touches: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-01-remote-baseline.json

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

- マイグレーションファイル自体の内容変更。スキーマの再設計。本番への書込みを伴う一切の操作。

## Verification and evidence

- Automated commands: wrangler d1 migrations list kanjo-db --remote の出力を作業記録へ転記し未適用ファイル名を確定する / リポジトリの migrations ディレクトリのファイル一覧と突き合わせ、欠落と余剰が無いことを確認する
- Required evidence: .dev-graph/plans/feature-package-feat-prod-d1-schema-recovery/evidence/phase-01-remote-baseline.json

## Rollout and rollback

- Rollout: 読み取り専用 baseline を記録するだけで、稼働中システムへの影響は無い。
- Rollback trigger and steps: baseline は読み取りのみで本番状態を変えないため、記録を破棄して再取得すれば戻せる。

## Handoff

- Executor: dev-graph が登録した task ノードを worktree lease のもとで実行する。本番への書込みコマンドはユーザーが実行する
- Ready when: system-spec/completeness-findings.json が PASS へ再評価され、参照元の implementation_readiness の blocked が解除されていること

## 参照情報

- System specification: system-spec-harness が生成した確定仕様の index ノード
- Architecture: arch-d1-schema-lifecycle
- Feature: feat-prod-d1-schema-recovery
- Phase doc: 生成側 13 phase 表の P01 (requirements)
- Dependencies: task-graph node なし (本 package の起点)
- Secondary workstreams: data
