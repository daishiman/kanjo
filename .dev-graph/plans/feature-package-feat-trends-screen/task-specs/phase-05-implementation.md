# System task overlay: 指標の登録表・推移集計・GET /api/trends 拡張・Trends.tsx の 10 ブロック・/classify 絞込の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p05", "implementation"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の red テストを green にする最小差分を core・api・web へ入れ、FR1〜FR12 と S1〜S4 を満たす。

## 背景

現行の Trends.tsx (536 行) は傾向の判定を主役にした画面で、07-trends.png の比較・要因分析の構成とは違う。本 task は既存の rows/pareto/breakdown を残したまま、総収支と同じ取引集合から数えた推移を足し、画面を 10 ブロックへ作り替え、傾向の判定を開閉部分へ移す。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: SYS-TRENDS-P04 が完了し、その成果物が default branch に取り込まれていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: Trends.tsx を 10 ブロックに作り替え、trends.css をトークンだけで書き、Classify.tsx に category・payee の初期値を足す
- Backend: applicable: trend-metrics.ts に登録表を置き、totalCashflowReport の判定を行単位で返す関数と previousYearPeriod を足す
- API: applicable: analytics.ts の GET /trends に追加フィールドと 400 invalid_metric を実装する
- Data: applicable: loadDataset と freee 系 4 表の読み取りを 1 回ずつに保つ
- Infrastructure: N/A: 本 task はこの層のコードを変更しない
- Security: applicable: metric を登録表の id に限定し、その他のクエリの形式違反を既定値へ倒す
- Quality: applicable: P04 のテストを green にする
- Documentation: N/A: 本 task はこの層のコードを変更しない
- Operations: N/A: 本 task はこの層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: Cloudflare Workers kanjo-console (packages/api と packages/web の静的配信) への追加。D1 は変えず、既存の配信構成のまま route の応答と画面を拡張する。
- Compatibility/migration/backfill: GET /api/trends の既存フィールドと scope の旧値 (all/biz/personal) を維持し、追加だけを行う。migration は無い (spec の互換性・移行・リリース節)。

## 受入基準

- P04 で追加したテストと既存テスト 3 本がすべて green である。
- 画面と API のコードに指標 id の分岐が無く、テスト用指標 1 件の追加で画面と API に現れる。
- 直書き色が 0 件で、色・余白・部品がトークンと共通 Button/PageShell/charts 経由である。

## 成果物

- Produced artifacts:
- packages/core/src/trend-metrics.ts
- packages/core/src/trend.ts
- packages/core/src/total-cashflow.ts
- packages/core/src/analysis-hub.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/analysis/Trends.tsx
- packages/web/src/pages/analysis/trends.css
- packages/web/src/pages/Classify.tsx
- packages/web/src/api.ts
- packages/web/src/components/charts.ts
- Consumed artifacts:
- system-spec/00-requirements-definition.md
- specs/spec-trends-screen.md
- features/feat-trends-screen.md
- system-spec/completeness-findings.json
- docs/trends-screen/architecture-decision.md
- packages/core/test/trend-metrics-contract.test.ts
- packages/core/test/trend-comparison.test.ts
- packages/api/test/trends-screen.integration.test.ts
- packages/web/src/pages/analysis/trends-screen.dom.test.tsx
- packages/web/src/classify-trends-filter.dom.test.tsx
- Write scope/touches:
- packages/core/src/trend-metrics.ts
- packages/core/src/trend.ts
- packages/core/src/total-cashflow.ts
- packages/core/src/analysis-hub.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/analysis/Trends.tsx
- packages/web/src/pages/analysis/trends.css
- packages/web/src/pages/Classify.tsx
- packages/web/src/api.ts
- packages/web/src/components/charts.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRENDS-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- pnpm lint
- Required evidence:
- packages/core/src/trend-metrics.ts
- packages/core/src/trend.ts
- packages/core/src/total-cashflow.ts
- packages/core/src/analysis-hub.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/analysis/Trends.tsx
- packages/web/src/pages/analysis/trends.css
- packages/web/src/pages/Classify.tsx
- packages/web/src/api.ts
- packages/web/src/components/charts.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 実装コミットを revert する。D1 を変えていないため、データの巻き戻しは要らない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRENDS-P04
