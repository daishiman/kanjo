# System task overlay: 削除後の依存グラフと層境界の設計

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, architecture], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P02
- classification: confidence=0.95 / reason=P02 は 13 phase の architecture slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P02.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

証憑に属するモジュールを取り除いた後の core / api / web の依存関係を設計し、削除順序と切断点を決める。

## 背景

証憑の処理は削除ライフサイクルと取込ライフサイクルのトランザクションへ組み込まれており、添付親の収束処理が両者から呼ばれている。単純にファイルを消すと呼び出し側が壊れるため、切断点を先に設計する必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P01
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面側の再輸出と参照の切断点を設計する
- Backend: ライフサイクルからの切断点を設計する
- API: 経路削除に伴う依存の整理を設計する
- Data: テーブル削除の順序を設計する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: 認証環境変数の削除順序を設計する
- Quality: N/A: 検証は設計レビューと後続 phase が担う
- Documentation: 設計文書を残す
- Operations: 定期ジョブの登録解除順序を設計する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 削除順序を持つ依存グラフ、re-export とライフサイクル呼び出しの切断点一覧。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core/src / packages/api/src / packages/web/src

### 受入条件

- 添付親の収束処理を呼ぶ箇所がすべて特定され、削除後の代替挙動が決まっている
- core の re-export から証憑シンボルを外した際に壊れる利用側が列挙されている

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

- 証憑以外のドメインロジックの再設計。

## Verification and evidence

- Automated commands: 設計文書の切断点一覧と、リポジトリ内の実際の呼び出し箇所の件数が一致することを確認する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。設計を前世代へ戻し、実装 phase を着手前状態に保つ。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P02 (architecture)
- Dependencies: SYS-RTR-P01
