# System task overlay: ai-screen 純関数・3 経路 API・migration 0046・AI分析画面の分割と旧操作の移設の最終実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-ai-analysis-screen
- owners: ["daishiman"]
- tags: ["ai-analysis", "p05", "mutation"]
- related_nodes: ["arch-ai-analysis-auth", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-frontend", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops", "arch-ai-analysis-security", "arch-ai-analysis-ui-ux", "spec-ai-analysis-screen"]
- parent_feature: feat-ai-analysis-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-ai-analysis-screen/sys-ai-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストがすべて緑になるまで、core / API / migration / web を実装する。P06 の検証前に、旧 Ai.tsx の操作をすべて新しい部品へ移し、段階判定の重複を除く。

## 背景

段階の判定は core の純関数 1 か所に寄せ、画面の段階表示と agentGuard の拒否が同じ関数を使う。API は記録を返すだけ、画面は描くだけにする。アプリは LLM を呼ばず、契約 v3 と skill は変えない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen, SYS-AI-P04
- Entry gate: staging run run-ai-analysis-20260919T1339Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 12-ai.png の全構成要素・選択中バー・下書き保存・4 タブ・版比較を実装する
- Backend: applicable: ai-screen 純関数を実装する
- API: applicable: cancel / retry / inventory と既存経路の変更を実装する
- Data: applicable: migration 0046 と schema.ts と runtimeSchemaGuard を揃える
- Infrastructure: N/A: binding と配信構成は据え置き
- Security: applicable: agentGuard のキャンセル拒否と body 上限 413 を実装する
- Quality: applicable: P04 の失敗テストがすべて緑になる
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12 と P13

## Architecture and deploy unit

- Architecture decisions: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (0046 の列追加のみ)
- Compatibility/migration/backfill: ai_tasks への列追加と一意索引 (user_id, seq) のみ。既存行の書き換えと backfill は 0 件。番号は着手時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/ai-screen.ts
- packages/api/src/routes/ai.ts
- migrations/0048_ai_task_stages.sql
- packages/web/src/pages/ai/
- Consumed artifacts:
- docs/ai-screen/design-decisions.md
- packages/core/test/ai-screen.test.ts
- packages/api/src/ai-screen.integration.test.ts
- packages/api/src/ai-migration-0048.test.ts
- packages/web/src/pages/ai/ai-screen.dom.test.tsx
- Write scope/touches:
- packages/core/src/ai-screen.ts
- packages/core/src/index.ts
- packages/core/src/exports.ts
- packages/api/src/routes/ai.ts
- packages/api/src/ai/dataset.ts
- packages/api/src/ai/period.ts
- packages/api/src/ai/catalog.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- packages/api/src/auth.ts
- migrations/0048_ai_task_stages.sql
- packages/web/src/api.ts
- packages/web/src/pages/Ai.tsx
- packages/web/src/pages/ai/
- packages/web/src/period.tsx
- packages/web/src/ai-copy-log.dom.test.tsx
- packages/web/src/ai-report-archive.dom.test.tsx
- packages/web/src/ai-report-structure.dom.test.tsx
- packages/web/src/ai-task-collapse.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-AI-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-AI-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-AI-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-AI-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入、レポート JSON 契約 v3、ヘッダー、既存の依頼・レポート行の書き換え、新しいログイン手段・長期トークン・secret・binding・外部サービスの登録、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- ai-screen 純関数が段階の 6 条件と境界 4 件を満たし、P04 の core テストが緑である。
- 3 経路が既存の認証の内側にあり、agentGuard がキャンセル済みトークンを 401 で拒否する。
- body 上限を超える要求が JSON の読み込み前に 413 で止まる。
- migration 0046 が追加のみで runtimeSchemaGuard の必須列に含まれる。
- AI分析画面が参照画像の構成要素をすべて描画し、選択中の依頼・レポート・タブが URL から復元される。
- 旧 Ai.tsx の操作 (コピーの記録・データセット表示・アーカイブ / 表示・削除の確認) がすべて新しい構成から実行できる。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/ai-screen.ts
- packages/api/src/routes/ai.ts
- migrations/0048_ai_task_stages.sql
- packages/web/src/pages/ai/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。0046 は列の追加のみで既存行を書き換えないため、列が残っても旧画面は動く。配信済みなら直前のビルドへ戻し、列の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-ai-analysis-screen.md
- Architecture: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Feature: feat-ai-analysis-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-AI-P04
