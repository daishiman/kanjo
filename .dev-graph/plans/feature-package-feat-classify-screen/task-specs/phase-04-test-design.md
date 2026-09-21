# System task overlay: core 不変条件・API 契約・migration・DOM の失敗テスト先行作成（Q-1 の vendor_memory 分岐を除く）

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p04", "test-design"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

classifyStatus・6 API・migration 0046・/classify 画面に対する失敗テストを、現行実装（旧 pages/Classify.tsx を含む）に対して先に作成し、赤であることを確認する。

## 背景

旧実装は分類ステータスを 3 区分排他で扱っておらず、要確認の内訳も持たない。テストは旧実装を落とすことで、契約の実効性を確認する。Q-1（origin='vendor_memory' の分岐）は未解決のため、該当テストケースのみ pending として作成し、確定させない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Q-1（BR-01(d) の vendor_memory 由来の手当てを完了とするか手動変更とするか）が未解決である。本 task は当該分岐のテストケースを pending として作成するに留め、緑・赤いずれの断定も行わない。Q-1 が解決するまで SYS-CLASSIFY-P05 はこの分岐を実装確定しない。
Open risk: バッジで数える集合（BR-06）と月次クローズで数える集合（BR-07）が異なりうるため、テストは両者を別々の入力集合で検査し、同一関数を当てる前提を固定しない。

## Workstream applicability

- Frontend: applicable: DOM テストを作成する
- Backend: applicable: core 不変条件テストを作成する
- API: applicable: 6 API の統合テストを作成する
- Data: applicable: migration 0046 の追加のみ性を検査するテストを作成する
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: フェンス違反・上限超過・他利用者アクセスのテストを作成する
- Quality: applicable: 全テストが現行実装（旧実装含む）に対して赤であることを確認する
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: migration 本体は P05 で作成し、本 task は検査テストのみを作成する

## 成果物

- Produced artifacts:
- packages/core/test/classify-status.test.ts
- packages/core/test/overview-recommendation-contract.test.ts
- packages/api/test/classify-bulk.integration.test.ts
- packages/api/test/saved-filters.integration.test.ts
- packages/api/test/rules-preview-apply.integration.test.ts
- packages/web/src/pages/classify/classify.dom.test.tsx
- packages/web/src/pages/classify/view-model.test.ts
- Consumed artifacts:
- docs/classify-screen/design-decisions.md
- specs/spec-classify-screen.md
- Write scope/touches:
- packages/core/test/classify-status.test.ts
- packages/core/test/overview-recommendation-contract.test.ts
- packages/api/test/classify-bulk.integration.test.ts
- packages/api/test/saved-filters.integration.test.ts
- packages/api/test/rules-preview-apply.integration.test.ts
- packages/web/src/pages/classify/classify.dom.test.tsx
- packages/web/src/pages/classify/view-model.test.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core 不変条件（3 区分の排他と和、要確認 ⊆ 未整理、信頼度 79/80 境界、衝突・矛盾の各規則）の失敗テストが現行実装で失敗する。Q-1 該当ケースは pending として明記される。
- 6 API の統合テストが 401・フェンス違反・上限超過 400・他利用者 404・部分失敗の応答形を検査し、現行実装で失敗する。
- DOM テストが AT-01〜AT-07・AT-10・AT-11・AT-16〜AT-18 に対応する構成要素・文言・状態を検査し、現行実装で失敗する。
- 分割ルールの行の和が元の金額に一致すること（BR-10）と ruleTargets のプレビューと適用の一致（BR-11）を固定するテストがある。
- migration 0046 が既存行を書き換えないことを検査するテストがある。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/classify-status.test.ts
- packages/api/test/classify-bulk.integration.test.ts
- packages/web/src/pages/classify/classify.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P03
