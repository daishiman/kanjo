# System task overlay: 運用文書と引き継ぎの整備

## Machine-readable registration fields

- feature_package_id: feature-package/feat-prod-d1-schema-recovery (13 task で共有)
- owners / tags / related_nodes: owners は空、tags は server-error-recovery と prod-d1-recovery、related_nodes は arch-d1-schema-lifecycle
- parent_feature: feat-prod-d1-schema-recovery
- phase_ref: P12 (本 package 内で 1 件のみ)
- classification: confidence 1.0。理由は本 task が dev-graph feature の配下で単一 phase の実行単位として生成されたため。候補 path は tasks/feat-prod-d1-schema-recovery/SYS-PDSR-P12.md
- tracker_binding_intent: beads
- github_publication: mode は local_only、project_aliases と labels は空、milestone は無し
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch、worktree lease 必須、default-branch reconciliation、assignment_owner は dev-graph-scheduler

## 目的

同種の事象が再び起きたときに、担当者が恒久運用の SSOT と incident checklist の責務を迷わず判別し、両方のリンクから復旧に着手できる状態。

## 背景

今回の障害は、コードの進行に対してスキーマ適用が運用工程として組み込まれていないという構造から生じた。構造への対処は別 feature が担うが、それが入るまでの間も手順で対処できるようにしておく必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-d1-schema-lifecycle および feature ノード feat-prod-d1-schema-recovery
- Entry gate: P11 の証跡集が揃っていること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity は github:daishiman/kanjo、root_resolution_source は explicit-cli、config は .dev-graph/config.json。絶対 path を成果物へ書かない

## Workstream applicability

- Frontend: N/A: 本 feature の成果物は運用手順と検証スクリプトであり画面変更を含まないため本 task では扱わない。
- Backend: N/A: アプリケーションコードの変更を伴わないため本 task では扱わない。
- API: N/A: API 契約の変更を伴わないため本 task では扱わない。
- Data: N/A: 本番 D1 のスキーマ適用と行数保全を扱うため本 task では扱わない。
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

- Produced artifacts: `docs/ci-cd-operations.md` が恒久 policy/通常手順の SSOT、復旧 runbook が incident 固有 checklist であることを read-only で確認し、tracker handoff に両リンクを渡す。文書は変更しない。
- Consumed artifacts: arch-d1-schema-lifecycle の設計判断、feature feat-prod-d1-schema-recovery の受入条件
- Write scope/touches: なし (リンク/引継ぎのみ)

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

- デプロイ工程そのものの変更。検査ゲートの実装 (別 feature が所有)。

## Verification and evidence

- Automated commands: `docs/ci-cd-operations.md` が恒久 policy/通常手順の SSOT と明示されていることを確認する / runbook が baseline・承認済み manifest・行数突合・証跡へのリンクだけを持ち、通常手順を複製していないことを確認する / 本番への書込み操作の実行主体がユーザーであることを確認する
- Required evidence: docs/ci-cd-operations.md、docs/runbooks/prod-d1-schema-recovery.md、P11 evidence の参照リンク

## Rollout and rollback

- Rollout: tracker handoff に正本リンクを渡すだけで、リポジトリ成果物は変更しない。
- Rollback trigger and steps: tracker handoff のリンクを訂正する。本番状態とリポジトリ成果物には影響しない。

## Handoff

- Executor: dev-graph が登録した task ノードを worktree lease のもとで実行する。本番への書込みコマンドはユーザーが実行する
- Ready when: system-spec completeness が PASS で、P11 evidence が揃い、参照元の blocked が解除されていること

## 参照情報

- System specification: system-spec-harness が生成した確定仕様の index ノード
- Architecture: arch-d1-schema-lifecycle
- Feature: feat-prod-d1-schema-recovery
- Phase doc: 生成側 13 phase 表の P12 (documentation-operations)
- Dependencies: task-graph node SYS-PDSR-P11 (直前 phase の完了を前提とする)
- Secondary workstreams: operations
