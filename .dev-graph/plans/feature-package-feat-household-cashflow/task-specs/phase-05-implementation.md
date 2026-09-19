# System task overlay: household-summary 純関数・3 経路 API・owner_labels・家計収支画面・旧参照除去の最終実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-household-cashflow
- owners: ["daishiman"]
- tags: ["household-cashflow", "p05", "mutation"]
- related_nodes: ["arch-household-cashflow-auth", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-frontend", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops", "arch-household-cashflow-security", "arch-household-cashflow-ui-ux", "spec-household-cashflow-screen"]
- parent_feature: feat-household-cashflow
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-household-cashflow/sys-household-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core / API / web / owner_labels / 名称統一を実装する。P06 の検証前に、旧 `household()` / `HouseholdData` / `OWNER_LABEL` 直参照の除去と重複ロジックの集約まで完了させる。

## 背景

集計は core の純関数 1 か所に寄せ、API は返すだけ、画面は描くだけにする。名義の表示は表示名の取得関数 1 つへ寄せ、家計・設定・明細の全画面に効かせる。旧 household() と HouseholdData は削除して参照元を付け替える。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen, SYS-HOUSEHOLD-P04
- Entry gate: staging run run-feat-household-cashflow-20260918T124500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面の全構成要素・選択・詳細パネル・下部バー・名義ラベル編集ダイアログを実装する
- Backend: applicable: household-summary と台帳行の owner と 6 区分の対応表を実装する
- API: applicable: 3 経路と zod の許可リストを実装する
- Data: applicable: owner_labels の追加のみの migration と runtimeSchemaGuard を実装する
- Infrastructure: N/A: binding と配信構成は据え置き
- Security: applicable: 表示名の長さと文字種の検証と変更系フェンスを実装する
- Quality: applicable: P04 の失敗テストが全て緑になり、P06 へ渡す最終コードに旧参照と重複経路が残っていないことを確認する
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12 と P13

## Architecture and deploy unit

- Architecture decisions: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (owner_labels の追加のみ)
- Compatibility/migration/backfill: owner_labels 表の追加のみ。既存行の書き換えと backfill は 0 件。番号は実装時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/household-summary.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/settings.ts
- migrations/0043_owner_labels.sql
- packages/web/src/pages/household/
- Consumed artifacts:
- docs/household-screen/design-decisions.md
- packages/core/test/household-summary-contract.test.ts
- packages/api/test/household.integration.test.ts
- packages/api/test/owner-labels.integration.test.ts
- packages/web/src/pages/household/household.dom.test.tsx
- Write scope/touches:
- packages/core/src/household-summary.ts
- packages/core/src/total-cashflow.ts
- packages/core/src/analysis.ts
- packages/core/src/classify.ts
- packages/core/src/types.ts
- packages/core/src/exports.ts
- packages/core/src/chart-aggregates.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/settings.ts
- packages/api/src/ai/dataset.ts
- packages/api/src/cashflow-sources.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- migrations/0043_owner_labels.sql
- packages/web/src/api.ts
- packages/web/src/pages/Household.tsx
- packages/web/src/pages/household/
- packages/web/src/components/Page.tsx
- packages/web/src/components/charts.ts
- packages/web/src/period.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/figure-guides.ts
- packages/web/src/glossary.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-HOUSEHOLD-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-HOUSEHOLD-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-HOUSEHOLD-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-HOUSEHOLD-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (累計収支画面の新設、名義の内部値の変更と既存行の書き換え、明細への相手口座カラムの追加、共通シェルの作り直し、総収支・推移・マトリックス・分析ハブの中身の作り直し、集計結果の永続化とキャッシュ層と新しい外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- household-summary が不変条件 5 件を満たし、P04 の core テストが緑である。
- 3 経路が既存 authGuard の内側にあり、PUT は変更系フェンスの内側で、許可リスト外のクエリに 400 を返す。
- owner_labels の migration が追加のみで、runtimeSchemaGuard の必須表に含まれる。
- 家計収支画面が参照画像の構成要素を全て描画し、URL の `seg` / `month` / `cat` と `usePeriod` / localStorage の期間から復元される。
- 空は集計対象台帳行 0 件 (振替のみ・除外行のみを含む)、カテゴリ詳細は `current` / `monthTotal` / 最大 5 件プレビューを分離、振替は選択月の全件 (抜粋なし) をカード内に出し循環導線を置かない。
- 旧 `household()` / `HouseholdData` / `OWNER_LABEL` 直参照が 0 件で、P08 がコード変更なしで監査できる。
- 名義表示が家計・設定・明細で表示名の取得関数 1 つを経由する。
- ナビとパンくずの名称が 家計収支 である。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/household-summary.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/settings.ts
- migrations/0043_owner_labels.sql
- packages/web/src/pages/household/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。owner_labels は追加のみの表で既存行を書き換えないため、表が残っても既存画面は動く。配信済みなら直前のビルドへ戻し、表の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-household-cashflow-screen.md
- Architecture: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Feature: feat-household-cashflow
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-HOUSEHOLD-P04
