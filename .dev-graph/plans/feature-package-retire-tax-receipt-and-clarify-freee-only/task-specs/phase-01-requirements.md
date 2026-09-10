# System task overlay: 廃止範囲と保持範囲の要件確定

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, requirements], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P01
- classification: confidence=0.95 / reason=P01 は 13 phase の requirements slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

確定申告と証憑に属する機能をどこまで消し、どの機能を必ず残すかを、件数で判定できる形の要件として確定させる。

## 背景

利用者は確定申告の準備と領収書の取り込みを不要と判断した。一方で R2 の FILES バインディングは改善リクエストのスクリーンショットと D1 夜間バックアップが使用中であり、証憑と同じ資源に見えるが廃止対象ではない。境界を先に書き切らないと実装段階で「念のため残す」判断が混入する。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 廃止対象の画面入口を要件表に列挙する
- Backend: 廃止対象の経路を要件表に列挙する
- API: 廃止対象の公開経路を要件表に列挙する
- Data: 廃止対象のテーブルと列を要件表に列挙する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: 認証環境変数から証憑用の項目を外す判断を含む
- Quality: 受入条件の判定手順を定める
- Documentation: 要件表そのものが成果物である
- Operations: 定期ジョブの廃止有無を要件表に含める

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 廃止対象と保持対象の対照表、受入条件 11 件の判定手順。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core/src / packages/api/src / packages/web/src / migrations

### 受入条件

- 廃止対象の能力が 9 項目すべて列挙され、各項目に判定コマンドが対応している
- 保持能力として FILES バインディング、改善リクエスト、夜間バックアップ、取込原本、現金記帳、交通費記帳、matched 行の除外、excluded 機能の 8 項目が明記されている

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

- excluded 機能そのものの廃止、消し込みと合算のロジック変更、R2 バケットと FILES バインディングの廃止。

## Verification and evidence

- Automated commands: features/feature-retire-tax-receipt-and-clarify-freee-only.md の scope_in と scope_out を対照表と突合する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。要件表を前世代へ戻し、後続 phase の着手を止める。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P01 (requirements)
- Dependencies: なし (先頭 phase)
