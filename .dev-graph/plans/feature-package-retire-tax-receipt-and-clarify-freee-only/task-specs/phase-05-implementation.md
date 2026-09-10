# System task overlay: 証憑機能の削除と freeeOnly 行の操作除去

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, implementation], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P05
- classification: confidence=0.95 / reason=P05 は 13 phase の implementation slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

確定申告の入口、証憑の登録から取得までの経路、関連する DB 定義を取り除き、あわせて一致にも除外にも入らない freee の残余一覧から二重登録として外す操作を除き、その見出しと説明を全分割の残余として読める表現へ変更する。

## 背景

二重登録として外す操作は freee 内部の重複を落とすための機構であり、家計簿側との重複を落とす消し込みとは対象が逆である。freeeOnly は matched にも excluded にも入らない集合上の残余であり、MF側の相手不存在や重複を断定しないため、その全行に同じ操作を出すのは表示の誤りにあたる。操作を外すだけでは、その一覧が何を意味するかが読み手に伝わらないままなので、見出しと説明も同時に直す。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P04
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面と操作を削除し、残余一覧の見出しと説明を是正する
- Backend: 証憑の処理を削除する
- API: 証憑と申告の経路を削除する
- Data: N/A: 0038の作成と検証はP08が一意に所有する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: 証憑用の環境変数を削除する
- Quality: 退避テストを追加する
- Documentation: N/A: 文書更新は後続 phase が担う
- Operations: 証憑の維持ジョブを削除する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 削除後のソース、退避済みの独立テスト、是正後の一覧見出しと説明文。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core/src / packages/api/src / packages/web/src

### 受入条件

- active runtime surface（route登録・API route登録・現行DB schema・navigation・scheduled job・public export）に、確定申告と証憑の画面、経路、および専用スキーマ定義が残っていない (実データベースへの適用は後続 phase が担う)
- 一致にも除外にも入らない freee の残余行に二重登録として外す操作が出ない
- その一覧の見出しと説明が、取り込んだ freee 取引の全分割における残余であることを述べる表現になっている
- 退避先の独立テストが追加され、単体で緑になる

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

- 突合済み行に出ている同じ操作の扱い、および excluded 機能そのもの。

## Verification and evidence

- Automated commands: `APP_ROUTES` / `ROUTE_COMPONENTS`、API route登録、`db/schema.ts`、navigation、scheduled job、public exportを検索し、廃止機能の入口・専用定義が無いことを確認する / 追加した独立テストを単体で実行する / 一覧の見出しと説明を描画する画面テストを実行し、是正後の表現が出力に含まれることを確認する。歴史migration・archive・retired/superseded文書、交通費互換の`receiptWaived`、改善要望の画像添付、共通`r2_cleanup`の`retired_attachment` purposeは不存在検査の対象外とする
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止し、P05の変更だけを取り消す。移行はP08より前には適用しない。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P05 (implementation)
- Dependencies: SYS-RTR-P04
