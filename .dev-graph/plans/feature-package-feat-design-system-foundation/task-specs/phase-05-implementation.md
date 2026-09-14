# System task overlay: design-tokens.ts 正本の実装と styles.css / charts.ts / 共通部品への反映

## Machine-readable registration fields

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p05", "implementation"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-backend", "arch-design-system-frontend", "arch-design-system-ui-ux"]
- parent_feature: feat-design-system-foundation
- phase_ref: P05
- lifecycle_role: mutation
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストを green にする最小差分を core / web に実装し、FR-001..FR-004 と S1・S2・S5 を満たす。

## 背景

architecture/design-system-frontend.md の依存方向 (core→web 一方向) と、charts.ts の getComputedStyle 経路を維持したまま COLOR_FALLBACKS だけを正本参照へ置き換える方針 (dec-design-token-source) に従う。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-backend、arch-design-system-frontend、arch-design-system-ui-ux
- Entry gate: 依存 task (SYS-DSFOUND-P04) が完了し、docs/design-system/architecture-decision.md に利用者が選択した dec-chart-series-contrast が記録されていること (未記録なら着手しない)
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: styles.css・charts.ts・Layout.tsx・Button.tsx を変更する
- Backend: applicable: packages/core/src/design-tokens.ts を新設する
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: N/A: 配信構成を変更しない (check:js-budget は P09 で確認)
- Security: N/A: CSP は変更しない (arch-design-system-security)
- Quality: applicable: P04 の red テストを green にする
- Documentation: N/A: 規約文書は P12 の責務
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-backend、arch-design-system-frontend、arch-design-system-ui-ux
- Deploy unit/environment: N/A: 既存の Cloudflare Workers 配信構成のまま追加の配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- packages/core/src/design-tokens.ts
- packages/web/src/styles.css
- packages/web/src/components/charts.ts
- packages/web/src/components/Layout.tsx
- packages/web/src/components/Button.tsx
- scripts/check-design-tokens.mjs
- package.json
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- packages/core/src/design-tokens.ts
- packages/web/src/styles.css
- packages/web/src/components/charts.ts
- packages/web/src/components/Layout.tsx
- packages/web/src/components/Button.tsx
- scripts/check-design-tokens.mjs
- package.json

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/web test
- pnpm --filter @kanjo/web run typecheck
- pnpm lint
- pnpm --filter @kanjo/web run check:thead
- pnpm --filter @kanjo/web run check:mobile-layout
- pnpm --filter @kanjo/web run check:financial-figure
- pnpm --filter @kanjo/web run check:financial-routes
- Required evidence:
- packages/core/src/design-tokens.ts
- packages/web/src/styles.css
- packages/web/src/components/charts.ts
- packages/web/src/components/Layout.tsx
- packages/web/src/components/Button.tsx
- scripts/check-design-tokens.mjs
- package.json

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: design-tokens.ts・styles.css・charts.ts・Layout.tsx・Button.tsx・scripts/check-design-tokens.mjs・package.json への変更コミットを revert し、直前のビルドへ戻す。単一 PR のため1回の revert で完全に戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-backend、arch-design-system-frontend、arch-design-system-ui-ux
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P04
