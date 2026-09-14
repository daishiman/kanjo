# System task overlay: トークン値・コントラスト・共通シェルの失敗テスト先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p04", "test-design"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-frontend", "arch-design-system-backend"]
- parent_feature: feat-design-system-foundation
- phase_ref: P04
- lifecycle_role: test-design
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

FR-001・FR-003・FR-004・FR-002 それぞれの判定基準を機械検証するテストを実装前に red の状態で用意し、P05 の実装完了条件を固定する。

## 背景

specs/spec-design-system-foundation.md の AC-001..AC-006 と FR-001..FR-005 の判定基準を、実装より先にテストとして固定する (test-first)。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-frontend、arch-design-system-backend
- Entry gate: 依存 task (SYS-DSFOUND-P03) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: design-tokens-contrast.test.ts と common-shell-routes.dom.test.tsx を追加する
- Backend: applicable: packages/core/test/design-tokens.test.ts を追加する
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: N/A: 配信構成を変更しない
- Security: N/A: CSP・認可は変更しない
- Quality: applicable: 本 task の中心責務。4件の失敗テスト・検査スクリプトを red の状態で用意する
- Documentation: N/A: 規約文書は P12 の責務
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-frontend、arch-design-system-backend
- Deploy unit/environment: N/A: テストコードのみで配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- packages/core/test/design-tokens.test.ts
- packages/web/src/design-tokens-contrast.test.ts
- packages/web/src/common-shell-routes.dom.test.tsx
- scripts/check-design-tokens.mjs
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- packages/core/test/design-tokens.test.ts
- packages/web/src/design-tokens-contrast.test.ts
- packages/web/src/common-shell-routes.dom.test.tsx
- scripts/check-design-tokens.mjs

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test (新規テストが red であることを確認する)
- pnpm --filter @kanjo/web test (新規テストが red であることを確認する)
- node scripts/check-design-tokens.mjs (非 0 exit であることを確認する)
- Required evidence:
- packages/core/test/design-tokens.test.ts
- packages/web/src/design-tokens-contrast.test.ts
- packages/web/src/common-shell-routes.dom.test.tsx
- scripts/check-design-tokens.mjs

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 追加した失敗テストと check-design-tokens.mjs の初期実装を revert する。P05 未着手であればリポジトリは変更前の状態に戻る。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-frontend、arch-design-system-backend
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P03
