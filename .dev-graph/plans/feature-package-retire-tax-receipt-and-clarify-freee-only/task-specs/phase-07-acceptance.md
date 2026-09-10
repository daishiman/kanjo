# System task overlay: 受入判定

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, acceptance], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P07
- classification: confidence=0.95 / reason=P07 は 13 phase の acceptance slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

feature の受入条件 11 件のうち、この時点で判定材料が揃っている条件を機械的に判定し、残る条件は判定を担う後続 phase を明示して引き渡す。

## 背景

受入条件は件数 0 かテスト緑のいずれかで書かれており、判断の余地を残していない。ただし移行の適用は後続 phase、型検査と予算表の整合はさらに後の phase が担うため、この時点ですべてを判定しようとすると材料のない条件を主観で通すことになる。判定できる条件と引き渡す条件を分けることで、その抜け道を塞ぐ。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P06
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面側の受入条件を判定する
- Backend: 経路側の受入条件を判定する
- API: 経路不在を判定する
- Data: 現行runtime schemaから専用定義が消え、移行上限が0038であることを判定する
- Infrastructure: N/A: 構成の変更を伴わない
- Security: N/A: 権限の受入条件を持たない
- Quality: 受入判定そのものが成果物である
- Documentation: 判定結果表を残す
- Operations: 保持対象の動作を判定する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 受入条件ごとの判定結果表と、後続 phase へ引き渡す条件の一覧。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core / packages/api / packages/web / migrations

### 受入条件

- この時点で判定可能な受入条件がすべて判定され、未達が 0 件である
- 判定を後続 phase へ引き渡す条件について、引き渡し先の phase が条件ごとに明記されている
- 受入条件 11 件のいずれもが、判定済みか引き渡し済みのどちらかに分類されている

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

- 受入条件そのものの改定。移行適用後にしか判定できない条件と、型検査および予算表に関する条件の判定。

## Verification and evidence

- Automated commands: 判定結果表の各行について、記載されたコマンドを再実行し同じ出力になることを確認する
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後に着手し、受入条件の判定をもって完了とする
- Rollback trigger and steps: 受入条件が未達となった時点で着手を停止する。未達条件を実装 phase へ差し戻す。

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P07 (acceptance)
- Dependencies: SYS-RTR-P06
