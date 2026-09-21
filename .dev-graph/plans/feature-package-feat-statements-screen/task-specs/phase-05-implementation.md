# System task overlay: core statementsScreen・GET と PUT・migration 0045・決算書画面の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-statements-screen
- owners: ["daishiman"]
- tags: ["statements-screen", "p05", "implementation"]
- related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
- parent_feature: feat-statements-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-statements-screen/sys-stmt-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core の statementsScreen、GET /api/statements の screen と ref、PUT /api/balances/liabilities の項目単位 upsert と監査、migration 0045、画像どおりの決算書画面と負債の下書き・CSV エクスポートを実装する。

## 背景

集計は core の純関数 1 か所に寄せ、API はそれを返すだけ、画面は描くだけにする。下書きはブラウザ内だけに置き、ログアウトで接頭辞のキーを全て消す (Layout.tsx のログアウト処理に消去を足すだけで、シェルの構造は変えない)。更新後は statements のクエリを invalidate し、楽観更新はしない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Entry gate: staging run plan-feat-statements-screen-20260919 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-STMT-P04 の失敗テストが揃っていること
- origin/main を取り直して migrations の最大番号が 0044 のままであること (使われていれば次の番号へ繰り下げる)

## Workstream applicability

- Frontend: applicable: 画像の全構成要素と読込・空・失敗・CF 不能・負債未入力・保存中の状態を pages/statements/ の部品で描く
- Backend: applicable: statementsScreen と区分の固定対応表と CF 原因の件数と BS の完了判定を実装する
- API: applicable: GET の screen 追加 (既存項目は後方互換) と ref の丸め、PUT の項目単位 upsert と応答 bs を実装する
- Data: applicable: migration 0045 と schema.ts と schema-guard の期待版と削除 / 全消去の対象表を追加する
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: applicable: zod strict・金額上限 1 兆円・bodyLimit 8 KiB・行数上限・監査 (金額なし)・CSV の数式注入対策を実装する
- Quality: applicable: P04 の失敗テストが全て緑になることを確かめる
- Documentation: N/A: 本 phase は Documentation の成果物を変更しない
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration 0045 (列と表の追加のみ。既存行を書き換えない)
- Compatibility/migration/backfill: migration 0045 は列と表の追加だけで、既存行を書き換えず backfill も行わない

## 成果物

- Produced artifacts:
- packages/core/src/statements-screen.ts
- migrations/0045_liability_status.sql
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/balances.ts
- packages/web/src/pages/Statements.tsx
- packages/web/src/pages/statements/
- Consumed artifacts:
- docs/statements-screen.md
- packages/core/test/statements-screen-contract.test.ts
- packages/api/src/statements-screen.integration.test.ts
- packages/web/src/statements-screen.dom.test.tsx
- Write scope/touches:
- packages/core/src/statements-screen.ts
- packages/core/src/index.ts
- migrations/0045_liability_status.sql
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/balances.ts
- packages/api/src/deletion-full-reset.ts
- packages/api/src/deletion-lifecycle.ts
- packages/api/src/deletion-schema.test.ts
- packages/core/src/deletion.ts
- packages/web/src/api.ts
- packages/web/src/pages/Statements.tsx
- packages/web/src/pages/statements/
- packages/web/src/components/Layout.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-STMT-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-STMT-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-STMT-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-STMT-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (投資 CF と財務 CF の区分、区分対応表の利用者による上書き、下書きのサーバ保存、共通シェルの構造変更、既存 audit_log の action 拡張、他画面の作り直しと web 以外のプラットフォーム)
- 旧 UI と旧テストの整理 (P08 が行う)
- 投資 CF と財務 CF の算出
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/statements-screen.ts
- migrations/0045_liability_status.sql
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/balances.ts
- packages/web/src/pages/Statements.tsx
- packages/web/src/pages/statements/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration 0045 は追加のみのため、列と表が残っても既存機能に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Feature: feat-statements-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-STMT-P04
