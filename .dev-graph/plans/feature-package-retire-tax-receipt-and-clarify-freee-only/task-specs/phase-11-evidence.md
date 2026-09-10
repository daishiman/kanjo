# System task overlay: 再現可能な証跡の収集

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, evidence], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P11
- classification: confidence=0.95 / reason=P11 は 13 phase の evidence slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P11.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

受入と検査の結果を、後から同じ手順で再現できる形で保存する。

## 背景

削除は元に戻しにくい変更であり、何を根拠に消したかが残らないと、後日の判断ができない。件数の出力とテストログを、実行コマンドとともに保存する。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P10
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面側の証跡を保存する
- Backend: 処理側の証跡を保存する
- API: 経路側の証跡を保存する
- Data: スキーマ証跡を保存する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: N/A: 権限の証跡を持たない
- Quality: 証跡収集そのものが成果物である
- Documentation: 証跡を文書化する
- Operations: 定期ジョブの証跡を保存する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 実行コマンドと出力を対にした証跡ファイル。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: .dev-graph/eval-log

### 受入条件

- 受入条件 11 件それぞれについてコマンドと出力が保存されている
- 保存された各コマンドが再実行可能な形で記録されている

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

- 証跡の外部公開。

## Verification and evidence

- Automated commands: 保存済み証跡から任意の 3 件を再実行し、同じ出力になることを確認する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。証跡ファイルを前世代へ戻す。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P11 (evidence)
- Dependencies: SYS-RTR-P10
