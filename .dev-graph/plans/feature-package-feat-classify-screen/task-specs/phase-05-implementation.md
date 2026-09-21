# System task overlay: classifyStatus・6 API・migration 0046・/classify 画面の最終実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p05", "mutation"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core / API / migration / web を実装する。P06 の検証前に、旧 pages/Classify.tsx の参照除去と証憑欄の非導入まで完了させる。

## 背景

分類ステータス・信頼度・根拠の判定は classifyStatus 1 関数に寄せ、recommendationFor を拡張してこれを呼ぶ。API は authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の既存順序を維持し、新規変更系ルートをフェンスに登録する。migration 0046 は追加のみで既存行を書き換えない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Q-1（origin='vendor_memory' の分岐を完了と手動変更のどちらにするか）が未解決の間は、この分岐だけ実装を確定せず、該当ロジックを pending のまま残す。本 task は Q-1 の分岐について complete を宣言しない。
Open risk: バッジで数える集合（BR-06）と月次クローズで数える集合（BR-07）の実装は、既存の counts.classification の意味（照合側・現金・isMfCountable 外・splitProjection ありを除く）を変えない前提で行い、どちらの集合に classifyStatus を当てるかは P02/P03 の記録に従う。
Open risk: saved_filters・tx_history をバックアップ・全削除の対象に含めるかは未決のため、本 task はこの 2 表を JSON バックアップ・deletion-full-reset.ts のどちらにも含めない現状維持のまま実装し、含めるかどうかの決定は行わない。

## Workstream applicability

- Frontend: applicable: 画面の全構成要素・フィルタ・編集パネル・一括操作バー・分割エディタ・ルールプレビューを実装する
- Backend: applicable: classifyStatus と recommendationFor 拡張、ruleTargets を実装する
- API: applicable: 6 API と zod の許可リストを実装する
- Data: applicable: migration 0046 と runtimeSchemaGuard を実装する
- Infrastructure: N/A: binding と配信構成は据え置き
- Security: applicable: canonicalMutationFence 登録と入力検証上限を実装する
- Quality: applicable: P04 の失敗テストが全て緑になり、旧参照が残っていないことを確認する
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration（0046_classify_workbench.sql の追加のみ）
- Compatibility/migration/backfill: saved_filters・tx_history 表の新設と rules・tx_edits への列追加のみ。既存行の書き換えと backfill は 0 件。番号は実装時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/classify-status.ts
- packages/api/src/routes/classify.ts
- packages/api/src/routes/classify-bulk.ts
- packages/api/src/routes/saved-filters.ts
- migrations/0046_classify_workbench.sql
- packages/web/src/pages/classify/
- Consumed artifacts:
- docs/classify-screen/design-decisions.md
- packages/core/test/classify-status.test.ts
- packages/api/test/classify-bulk.integration.test.ts
- packages/web/src/pages/classify/classify.dom.test.tsx
- Write scope/touches:
- packages/core/src/classify-status.ts
- packages/core/src/overview.ts
- packages/core/src/types.ts
- packages/core/src/exports.ts
- packages/api/src/routes/classify.ts
- packages/api/src/routes/classify-bulk.ts
- packages/api/src/routes/saved-filters.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- migrations/0046_classify_workbench.sql
- packages/web/src/api.ts
- packages/web/src/pages/classify/
- packages/web/src/pages/Classify.tsx
- packages/web/src/components/Layout.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/period.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- classifyStatus が 3 区分の排他と和を満たし、P04 の core テストが緑である（Q-1 該当分岐を除く）。
- 6 API が既存の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側で動き、許可リスト外のクエリと上限超過に 400 を返す。
- migration 0046 が追加のみで、runtimeSchemaGuard の必須表・必須列に反映される。
- /classify 画面が spec 7 節の構成要素を全て描画し、URL の status/category/owner/method/manual/q/sort/page/sel/tx と usePeriod/localStorage の期間から復元される。証憑欄は無く案内文言のみが出る。
- 旧 pages/Classify.tsx を削除し、route が新しい ClassifyPage の lazy import に差し替わる。
- 下書きが端末保存（localStorage）のみで、サーバへ送られない。
- 外部への送信が 0 件である（fetch の宛先が同一オリジンの /api だけ）。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/classify-status.ts
- packages/api/src/routes/classify.ts
- migrations/0046_classify_workbench.sql
- packages/web/src/pages/classify/

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration 0046 は追加のみの表・列で既存行を書き換えないため、表・列が残っても既存画面は動く。配信済みなら直前のビルドへ戻し、表・列の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P04
