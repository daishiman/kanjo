# System task overlay: 退避テストと受入テストの設計

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, test-design], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P04
- classification: confidence=0.95 / reason=P04 は 13 phase の test-design slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P04.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

削除で失われる保証を独立テストへ退避する設計と、削除完了を件数で判定する受入テストの設計を確定する。

## 背景

夜間バックアップが R2 へ書けたことを見ている唯一のアサーションは、削除対象のライフサイクルテストの中にある。予算表のテストは全ジョブのクエリ本数を固定して合計が上限と一致することを要求しており、ジョブを 1 つ抜くと必ず落ちる。両者を先に設計しないと、削除の実施と同時に検出手段が消える。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P03
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面の受入テスト設計を含む
- Backend: 退避テストの配置を設計する
- API: 経路不在を確認するテストを設計する
- Data: スキーマ確認手順を設計する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: N/A: 権限設計の変更を伴わない
- Quality: テスト設計そのものが成果物である
- Documentation: 設計を文書に残す
- Operations: 予算表の検証手順を設計する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 退避テストの設計、受入テストの一覧と各テストが落ちる条件、削除着手前のパッケージ別テスト件数の記録。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/api/test / packages/core/test / packages/web/test / .dev-graph/eval-log

### 受入条件

- 削除着手前のパッケージ別テスト件数が記録され、後続 phase が突合できる形で保存されている
- 夜間バックアップの R2 書き込みを検証する独立テストの配置先と内容が決まっている
- 予算表の再宣言後に合計が上限と一致することを検証する手順が決まっている
- 各受入テストについて、旧実装のままなら落ちることが説明されている

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも none。GitHub 連携は無効設定のため公開先を持たない。
- PR completion policy: linked_pr_merged_all
- PR body contract: 対応 issue の完了参照と dev-graph の graph_node_id を本文へ記載し、既定ブランチを対象とする
- Ownership boundary: 本 spec は intent の宣言だけを行い、起票と完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に devgraph 接頭辞つきで割り当てる。system-dev-planner は事前割当を行わない。
- Worktree lease: 実装開始時に graph_node_id で確保し、作業中は更新、終了時に解放する
- Parallel safety: 依存 phase の完了と、write scope および有効な lease の非重複を条件とする
- Completion projection: 作業ブランチでは保留事象のみを記録し、既定ブランチが清浄な状態で確定を書く

## スコープ外

- 証憑機能そのものの新規テスト追加。

## Verification and evidence

- Automated commands: 設計した受入テストを削除前のコードに対して実行し、赤になることを確認する / パッケージごとのテストを実行し、件数を記録する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。テスト設計を前世代へ戻す。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P04 (test-design)
- Dependencies: SYS-RTR-P03
