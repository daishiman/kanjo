# System task overlay: アクセシビリティ・CSP・JS 予算・狭幅表示・クエリ入力境界の保証と視覚検査の更新

## Machine-readable registration fields

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p09", "quality-assurance"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

新しい画面が既存の品質基準 (色だけに頼らない表示、CSP、初期 JS 予算、狭幅の縦積み、クエリの入力境界) を満たすことを確かめ、headless Chrome の視覚検査に推移の図の枚数を加える。

## 背景

視覚の確認は packages/web/scripts/check-financial-visuals.mjs が担う。CI の headless Chrome は pointer:none なので、pointer 条件に依存する表示は否定形の 2 段で書く必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: SYS-TRENDS-P08 が完了し、その成果物が default branch に取り込まれていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 検査で見つかった表示の崩れを Trends.tsx と trends.css の範囲で直す
- Backend: N/A: 本 task はこの層のコードを変更しない
- API: N/A: 本 task はこの層のコードを変更しない
- Data: N/A: 本 task はこの層のコードを変更しない
- Infrastructure: N/A: 本 task はこの層のコードを変更しない
- Security: applicable: metric・month・scope・compare・category・payee の入力境界と、外部送信が無いことを確認する
- Quality: applicable: アクセシビリティ (符号と文字の併記、開閉部分の見出し) と狭幅表示を確認する
- Documentation: N/A: 本 task はこの層のコードを変更しない
- Operations: applicable: check-financial-visuals.mjs に推移の図の描画枚数を加え、JS 予算の検査を build:bundle 直後に実行する

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: N/A: 既存の Cloudflare Workers kanjo-console の配信構成を変えず、検査と記録だけを行う
- Compatibility/migration/backfill: N/A: 本 task は migration もデータの移行も行わない (D1 は変えない)

## 受入基準

- check:financial-routes が推移の図の枚数を検査して緑である。
- check:js-budget が build:bundle 直後の実行で緑である。
- 未登録 metric が 400、それ以外の形式違反が既定値の 200 になることが integration test で確認されている。

## 成果物

- Produced artifacts:
- packages/web/scripts/check-financial-visuals.mjs
- docs/trends-screen/assurance.md
- Consumed artifacts:
- packages/web/src/pages/analysis/Trends.tsx
- packages/web/src/pages/analysis/trends.css
- packages/web/src/pages/Classify.tsx
- packages/web/src/api.ts
- packages/web/src/components/charts.ts
- packages/api/src/routes/analytics.ts
- Write scope/touches:
- packages/web/scripts/check-financial-visuals.mjs
- docs/trends-screen/assurance.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRENDS-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web run check:financial-routes
- pnpm --filter @kanjo/web run check:mobile-layout
- pnpm --filter @kanjo/web run check:js-budget
- Required evidence:
- packages/web/scripts/check-financial-visuals.mjs
- docs/trends-screen/assurance.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 検査スクリプトと記録のコミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRENDS-P08
