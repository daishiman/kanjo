# System task overlay: 要件ベースライン確定と architecture の path 表記の対応表

## Machine-readable registration fields

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p01", "requirements"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec-trends-screen の FR1〜FR12・S1〜S5・GET /api/trends の契約・確定意思決定 17 件 (qa-trends-decision-001〜014 と dec-trends-* 3 件) を docs/trends-screen/requirements-baseline.md へ転記し、architecture 8 章の scope 表記と実在 path の対応表を残して、後続 task が同じ path を使う状態にする。

## 背景

規範の正本は specs/spec-trends-screen.md と system-spec/ の各章で、未決事項は 0 件である。一方で architecture の scope には packages/web/src/lib/api.ts など、現行の repository に無い表記が 8 件ある。取込み済みの node の digest を変えないため、architecture は書き換えず、本 task で対応表を作って P02 以降が実在 path だけを使うようにする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: feat-trends-screen が active/confirmed/pass/readiness complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 task はこの層のコードを変更しない
- Backend: N/A: 本 task はこの層のコードを変更しない
- API: N/A: 本 task はこの層のコードを変更しない
- Data: N/A: 本 task はこの層のコードを変更しない
- Infrastructure: N/A: 本 task はこの層のコードを変更しない
- Security: N/A: 本 task はこの層のコードを変更しない
- Quality: applicable: 転記の欠落が 0 件であることを原文と突き合わせる
- Documentation: applicable: docs/trends-screen/requirements-baseline.md を新設する
- Operations: N/A: 本 task はこの層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本 task は migration もデータの移行も行わない (D1 は変えない)
- Path mapping (architecture の scope 表記 → 実在 path):
  - packages/web/src/lib/api.ts → packages/web/src/api.ts
  - packages/web/src/lib/charts.ts → packages/web/src/components/charts.ts
  - packages/web/src/lib/period.ts → packages/web/src/period.tsx
  - packages/web/src/styles → packages/web/src/styles.css と packages/web/src/pages/analysis/trends.css
  - packages/api/src/dataset.ts → packages/api/src/store.ts (loadDataset)
  - packages/web/src/pages/analysis/trends-scope.dom.test.tsx → packages/web/src/trends-scope.dom.test.tsx
  - packages/core/src/period.ts の previousYearPeriod → packages/core/src/analysis-hub.ts (previousPeriod の隣に新設)
  - packages/api/src/index.ts の認証 → 既存の認証 middleware をそのまま使い変更しない

## 受入基準

- FR1〜FR12・S1〜S5・Contract tests 10 項目・確定意思決定 17 件が requirements-baseline.md に原文どおり転記され、欠落が 0 件である。
- architecture の scope 表記と実在 path の対応 8 件 (packages/web/src/lib/api.ts、packages/web/src/lib/charts.ts、packages/web/src/lib/period.ts ほか) が表になっている。
- migration を足さない (最新は 0042 のまま) こと、既存テスト 3 本 (packages/core/test/trend-contract.test.ts、packages/web/src/trends-scope.dom.test.tsx、packages/api/src/analytics-period.test.ts) を壊さないことが前提として明記されている。

## 成果物

- Produced artifacts:
- docs/trends-screen/requirements-baseline.md
- Consumed artifacts:
- specs/spec-trends-screen.md
- system-spec/00-requirements-definition.md
- system-spec/completeness-findings.json
- architecture/trends-screen-frontend.md
- architecture/trends-screen-backend.md
- architecture/trends-screen-database.md
- architecture/trends-screen-maintenance-ops.md
- Write scope/touches:
- docs/trends-screen/requirements-baseline.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (無し (先頭 task)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint
- Required evidence:
- docs/trends-screen/requirements-baseline.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: requirements-baseline.md の追加コミットを revert する。他ファイルへの書込みが無いため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: 無し (先頭 task)
