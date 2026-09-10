# System task overlay: テスト実行

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, test-run], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P06
- classification: confidence=0.95 / reason=P06 は 13 phase の test-run slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P06.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

削除後のコードに対して単体、契約、結合の各テストを実行し、保持対象の保証が生きていることを確かめる。

## 背景

削除ではテストが減ること自体が検出対象になる。全体が緑であることに加えて、退避したテストと恒等式の契約テストが実際に実行されたことを個別に確認する必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P05
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面テストを実行する
- Backend: 単体と結合テストを実行する
- API: 経路の結合テストを実行する
- Data: スキーマ確認を実行する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: N/A: 権限テストの変更を伴わない
- Quality: テスト実行そのものが成果物である
- Documentation: 実行ログを残す
- Operations: 予算表テストを実行する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: テスト実行ログ。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core/test / packages/api/test / packages/web/test

### 受入条件

- 取り込んだ freee 取引の分割が過不足なく成り立つことを見る契約テストが実行され緑である
- matched 行の除外操作と excluded 機能の回帰テストが実行され緑である
- 取込原本の active・recent・processing 保護と期限超過 inactive 削除の回帰テストが実行され緑である
- 現金記帳のライフサイクル回帰テストが実行され緑である
- 交通費記帳のライフサイクル回帰テストが実行され緑である
- 退避した夜間バックアップのテストが実行され緑である
- 予算表の合計一致テストが実行され緑である

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

- 新機能に対するテストの追加。

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/core exec vitest run test/total-cashflow-contract.test.ts`、`pnpm --filter @kanjo/api exec vitest run src/r2-cleanup.test.ts src/cash-lifecycle.test.ts src/transit-lifecycle.test.ts src/nightly-backup.test.ts src/scheduled-maintenance-budget.test.ts`、`pnpm --filter @kanjo/web exec vitest run test/total-cashflow-table.dom.test.tsx` を実行し、上記 7 能力のテスト名と成功結果をログで確認する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。失敗したテストの対象コミットを取り消す。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P06 (test-run)
- Dependencies: SYS-RTR-P05
