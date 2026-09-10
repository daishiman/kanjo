# System task overlay: 型検査と静的検査と運用予算の整合

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, quality-assurance], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P09
- classification: confidence=0.95 / reason=P09 は 13 phase の quality-assurance slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P09.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

型検査と静的検査を通し、定期ジョブの問い合わせ本数の予算表が実態と一致していることを確かめる。

## 背景

証憑の維持ジョブを外すと、全ジョブの本数合計を上限と一致させている予算表が必ず崩れる。予算表を再宣言せずに数値だけ合わせると、上限の意味が失われる。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P08
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 型検査と静的検査を通す
- Backend: 型検査と静的検査を通す
- API: 型検査を通す
- Data: N/A: 移行は前 phase で完了する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: N/A: 権限の変更を伴わない
- Quality: 検査そのものが成果物である
- Documentation: 検査出力を残す
- Operations: 予算表を再宣言する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 型検査と静的検査の出力、再宣言後の予算表、テスト総数の増減記録。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core / packages/api / packages/web

### 受入条件

- 型検査と静的検査がいずれも成功で終了する
- 参照できない識別子が 0 件である
- 予算表の合計が宣言された上限と一致する
- 全パッケージのテストが緑で終了する
- 削除前後のテスト件数の差分が、削除した証憑のテストと退避した独立テストの内訳で説明されている

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

- 予算上限そのものの引き上げ。

## Verification and evidence

- Automated commands: 型検査と静的検査を実行し、終了コードが成功であることを確認する / 全パッケージのテストを実行し、削除前に記録した件数と突き合わせる
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。検査を通らない変更を取り消す。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P09 (quality-assurance)
- Dependencies: SYS-RTR-P08
