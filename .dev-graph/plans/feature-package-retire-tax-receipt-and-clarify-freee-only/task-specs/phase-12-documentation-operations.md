# System task overlay: 文書と運用手順の更新

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, documentation-operations], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P12
- classification: confidence=0.95 / reason=P12 は 13 phase の documentation-operations slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P12.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

現行案内から廃止機能を外し、履歴資料はretired/supersededと明示して、運用手順の定期ジョブ一覧を実態へ合わせる。

## 背景

機能を消しても文書が残ると、次の担当者が存在しない機能を前提に判断する。定期ジョブの一覧と予算の説明は運用時に参照されるため、特に実態との一致が要る。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P11
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: N/A: 画面変更を伴わない
- Backend: N/A: 処理変更を伴わない
- API: N/A: 経路変更を伴わない
- Data: N/A: スキーマ変更を伴わない
- Infrastructure: N/A: 構成の変更を伴わない
- Security: N/A: 権限の変更を伴わない
- Quality: 文書と実態の一致を検査する
- Documentation: 文書更新そのものが成果物である
- Operations: 運用手順を更新する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 更新後の文書と運用手順。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: docs / README.md

### 受入条件

- 現行機能として廃止した機能を案内する記述が残っていない。歴史migration・archive・retired/superseded文書、交通費互換の`receiptWaived`、改善要望の画像添付、共通R2 cleanupの記述は対象外である
- 定期ジョブ一覧が実際に登録されているジョブと一致する

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

- 文書構成そのものの刷新。

## Verification and evidence

- Automated commands: 現行README・schema・navigation・operations文書を検索し、廃止機能を利用可能として案内する記述が無いことを確認する。検索結果に残る歴史migration・archive・retired/superseded文書、`receiptWaived`、改善要望の画像添付、共通R2 cleanupは理由を分類して記録する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。文書を前世代へ戻す。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P12 (documentation-operations)
- Dependencies: SYS-RTR-P11
