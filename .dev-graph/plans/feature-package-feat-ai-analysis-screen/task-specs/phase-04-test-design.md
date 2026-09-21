# System task overlay: core 境界値・API 契約・migration・DOM の失敗テスト先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-ai-analysis-screen
- owners: ["daishiman"]
- tags: ["ai-analysis", "p04", "test-design"]
- related_nodes: ["arch-ai-analysis-auth", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-frontend", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops", "arch-ai-analysis-security", "arch-ai-analysis-ui-ux", "spec-ai-analysis-screen"]
- parent_feature: feat-ai-analysis-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-ai-analysis-screen/sys-ai-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

段階の 6 条件と境界 4 件、T-番号、版の説明、タブ振り分け、JSON エラー位置、3 経路の契約、agentGuard のキャンセル拒否、body 上限の境界、公開範囲、inventory の件数一致、migration の更新 0 件、画面の DOM を失敗テストとして先に書く。

## 背景

段階導出は条件の優先順位で結果が変わるため、境界を toBe で固定してから実装する。旧実装で落ちることを確かめ、0 件しか調べていないテストを作らない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen, SYS-AI-P03
- Entry gate: staging run run-ai-analysis-20260919T1339Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: DOM テストを書く
- Backend: applicable: core の境界値テストを書く
- API: applicable: API の契約テストを書く
- Data: applicable: migration の検査を書く
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: トークン失効と body 上限と公開範囲のテストを書く
- Quality: applicable: テストが旧実装で落ちることを確かめる
- Documentation: N/A: docs は P12
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: テストのみ

## 成果物

- Produced artifacts:
- packages/core/test/ai-screen.test.ts
- packages/api/src/ai-screen.integration.test.ts
- packages/api/src/ai-migration-0046.test.ts
- packages/web/src/pages/ai/ai-screen.dom.test.tsx
- Consumed artifacts:
- docs/ai-screen/design-decisions.md
- specs/spec-ai-analysis-screen.md
- Write scope/touches:
- packages/core/test/ai-screen.test.ts
- packages/api/src/ai-screen.integration.test.ts
- packages/api/src/ai-migration-0046.test.ts
- packages/web/src/pages/ai/ai-screen.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-AI-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-AI-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-AI-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-AI-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入、レポート JSON 契約 v3、ヘッダー、既存の依頼・レポート行の書き換え、新しいログイン手段・長期トークン・secret・binding・外部サービスの登録、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 段階の 6 条件と境界 4 件が toBe で書かれ、実装前は失敗する。
- 上限ちょうどの契約適合レポートが 413 にならず、1 バイト超えが 413 になるテストがある。
- migration 0046 の適用で既存行の更新が 0 件であるテストがある。
- 他人の id に 404、キャンセル済みトークンに 401 のテストがある。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/ai-screen.test.ts
- packages/api/src/ai-screen.integration.test.ts
- packages/api/src/ai-migration-0046.test.ts
- packages/web/src/pages/ai/ai-screen.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-ai-analysis-screen.md
- Architecture: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Feature: feat-ai-analysis-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-AI-P03
