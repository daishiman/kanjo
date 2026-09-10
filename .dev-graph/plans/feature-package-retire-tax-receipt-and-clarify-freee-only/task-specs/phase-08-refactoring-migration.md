# System task overlay: 残存参照の整理とデータ移行

## Machine-readable registration fields

- feature_package_id: feature-package/retire-tax-receipt-and-clarify-freee-only (13 task で共有)
- owners / tags / related_nodes: owners=[], tags=[retire-tax-receipt, refactoring-migration], related_nodes=[spec-total-cashflow-system, arch-total-cashflow-system]
- parent_feature: feature-retire-tax-receipt-and-clarify-freee-only
- phase_ref: P08
- classification: confidence=0.95 / reason=P08 は 13 phase の refactoring-migration slot に対応し、成果物は task 1 件である / candidate=tasks/feature-retire-tax-receipt-and-clarify-freee-only/SYS-RTR-P08.md
- tracker_binding_intent: beads
- github_publication: mode=local_only / project_aliases=[] / labels=[] / milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease required / default-branch reconciliation / assignment_owner=dev-graph-scheduler

## 目的

証憑に依存していた列と再輸出、および参照されなくなったオブジェクトの後始末を行い、他機能への影響がないことを確かめる。

## 背景

現金の記帳の添付列、取込明細の添付件数表示、バックアップの取得対象宣言、書き換え可能な資源を列挙した防御宣言、監査記録の対象宣言など、証憑を前提にした記述が他機能側に残っている。これらは証憑本体を消しても文法上は壊れないため、明示的に洗い出さないと残る。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-total-cashflow-system / arch-total-cashflow-system / feature-retire-tax-receipt-and-clarify-freee-only
- Depends on: SYS-RTR-P07
- Entry gate: 直前 phase の受入条件がすべて満たされていること。P01 は feature の implementation_readiness が complete であること。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/kanjo / root_resolution_source=explicit-cli / .dev-graph/config.json (絶対パスは使わない)

## Workstream applicability

- Frontend: 画面側の残存参照を整理する
- Backend: 再輸出から証憑を外す
- API: 未使用となった内部関数を整理する
- Data: 0038で旧cleanup intentを共通R2 cleanupへ退避し、旧専用テーブルは互換期間のため残す
- Infrastructure: N/A: バインディング構成は保持する
- Security: 書き換え可能な資源の防御宣言と監査記録の対象宣言から証憑を外す
- Quality: 整理後にテストを再実行する
- Documentation: 整理内容を記録する
- Operations: バックアップの取得対象宣言を更新する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-system
- Deploy unit/environment: Cloudflare Workers 上の単一デプロイ単位 (api と web を同一世代で反映する)
- Compatibility/migration/backfill: 連番マイグレーションによる前進のみ。取り込み済みデータの再作成は行わない。

## 成果物

- Produced artifacts: 共通cleanupへ移行する0038 SQL、参照整理後のソース、防御宣言と監査対象宣言の更新差分。
- Consumed artifacts: features/feature-retire-tax-receipt-and-clarify-freee-only.md / features/feature-retire-tax-receipt-and-clarify-freee-only.context.json / system-spec/index.md
- Write scope/touches: packages/core/src / packages/api/src / packages/web/src / migrations

### 受入条件

- バックアップの取得対象宣言から証憑テーブルが外れている
- 書き換え可能な資源の防御宣言と監査記録の対象宣言から証憑由来の項目が外れている
- 証憑用に置かれたオブジェクトの利用が終了しており、FILES バインディング自体は残っている
- 0038で全旧添付keyと旧取込原本削除intentが共通`r2_cleanup_jobs`へ退避され、旧Workerの遅延writeも再処理できる
- 取込原本は active・30日以内・processing/partial のいずれかなら共通guardで保護され、期限超過した inactive 原本だけが削除対象になる
- 現行migration headが0038で、0039と旧専用6テーブルの物理削除がこのfeature packageに含まれていない

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

- R2 バケットと FILES バインディングの廃止。改善リクエストと夜間バックアップが使用中のため対象外とする。
- 0039の作成・適用と旧専用6テーブルの物理削除。別follow-up featureが担う。

## Verification and evidence

- Automated commands: 0038適用後に旧R2削除intentが共通`r2_cleanup_jobs`へ退避され、旧Workerの遅延writeがretryへ再活性化されることを検査する / `pnpm --filter @kanjo/api exec vitest run src/r2-cleanup.test.ts` でactive・recent・processing/partial原本の保持と期限超過inactive原本の削除を正方向に確認する / migration一覧・schema guard・local previewの適用上限が0038で、0039が配布物に無いことを確認する / active runtimeの防御宣言と監査対象宣言に旧専用項目が無いことを確認する。歴史migration・archive・retired文書、`receiptWaived`、改善要望の画像添付、共通cleanupの`retired_attachment`は対象外とする
- Required evidence: .dev-graph/eval-log 配下に実行コマンドと出力を対で保存する

## Rollout and rollback

- Rollout: 依存 phase の完了後、0038と同schema互換WorkerをRelease A候補として準備する。0039は作成も適用もせず、残件0・D1復元点・互換世代を前提とする別follow-up featureへ引き渡す
- Rollback trigger and steps: 0038未適用なら当該変更を取り消す。0038適用後は追加済みの共通台帳を残し、同schema互換世代へ戻すかforward-fixする

## Handoff

- Executor: dev-graph の task-graph から起動する system build 経路
- Ready when: confirmed かつ evaluation pass かつ readiness complete で、promotion 済み digest と dev-graph 登録が揃ったとき

## 参照情報

- System specification: spec-total-cashflow-system
- Architecture: arch-total-cashflow-system
- Feature: feature-retire-tax-receipt-and-clarify-freee-only
- Phase doc: P08 (refactoring-migration)
- Dependencies: SYS-RTR-P07
