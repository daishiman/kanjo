# System task overlay: 反映と反映後の確認

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, release-deploy], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P13
- classification: confidence=0.95 / reason=P13 は 13 phase の release-deploy slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

0038までの互換Release Aだけを反映し、保持対象の動作と廃止入口の不在を確認して、物理削除は別follow-up featureへ引き渡す。

## 背景

0038は共通cleanup台帳を追加する同schema互換の移行であり、旧専用6テーブルを残す。物理削除を行う0039は残件0・D1復元点・互換アプリ世代を必要とする別featureであり、この反映には含めない。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P12
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 反映後に画面動作を確認する
- Backend: 反映後に処理を確認する
- API: 反映後に経路の不在を確認する
- Data: 0038だけを反映し、migration headを固定する
- Infrastructure: Release Aの反映操作を実施する
- Security: N/A: 権限の変更を伴わない
- Quality: 反映後の確認を実施する
- Documentation: 反映記録を残す
- Operations: 同schema rollbackを用意し、Release Bの前提をfollow-upへ引き渡す

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: このfeatureでは追加型の0038だけを適用する。0039による物理削除は別featureで扱う。

## 成果物

- Produced artifacts: Release Aの反映記録、反映後の確認結果、Release B follow-up feature候補。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: migrations / packages/api / packages/web / .dev-graph/eval-log

### 受入条件

- 反映後に改善リクエストのスクリーンショットが保存できる
- 反映後に夜間バックアップが所定の場所へ書ける
- 反映後に確定申告と証憑の経路へ到達できない
- 反映済みmigration headが0038であり、0039と旧専用6テーブルの物理削除を含まない
- Release Bが、共通`r2_cleanup_jobs`と旧cleanup台帳の残件0・D1復元点・互換アプリ世代を開始条件とする別follow-up featureとして記録されている

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

- 新機能の同時投入、および0039と旧専用6テーブルの物理削除。

## Verification and evidence

- Automated commands: Release A後に上記3件を確認する / migration履歴・schema guard・local previewから現行headが0038で0039が未配布であることを確認する / 共通`r2_cleanup_jobs`のprocessorが動作し、将来のRelease B開始条件が別follow-up featureに記録されていることを確認する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: Release Aとして0038、共通R2 cleanup processor、旧添付write停止、廃止routeだけを反映する。0039は作成・適用せず、Release Bの開始条件を別follow-up featureへ引き渡す
- Rollback trigger and steps: 0038は追加型で旧専用6テーブルを保持するため、同schema互換世代へ戻すかforward-fixする。共通台帳を逆DDLで削除しない

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P13 (release-deploy)
- Dependencies: SYS-RTR-P12
