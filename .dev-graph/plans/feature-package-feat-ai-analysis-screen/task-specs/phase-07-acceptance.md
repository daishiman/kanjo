# System task overlay: 受入基準 S1 から S6 の検証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-ai-analysis-screen
- owners: ["daishiman"]
- tags: ["ai-analysis", "p07", "acceptance"]
- related_nodes: ["arch-ai-analysis-auth", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-frontend", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops", "arch-ai-analysis-security", "arch-ai-analysis-ui-ux", "spec-ai-analysis-screen"]
- parent_feature: feat-ai-analysis-screen
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-ai-analysis-screen/sys-ai-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feature の受入 S1〜S6 を 1 件ずつ検証し、既知の逸脱・未実施・一部適合を PASS に数えずに結果を記録する。

## 背景

段階表示と agentGuard の一致 (S2)、キャンセル・再実行・削除の振る舞い (S3)、公開範囲と上限 (S5) は、画面の見た目だけでなく API の応答で確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen, SYS-AI-P06
- Entry gate: staging run run-ai-analysis-20260919T1339Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面の構成要素と URL 復元を確かめる
- Backend: N/A: 本 phase では扱わない
- API: N/A: 本 phase では扱わない
- Data: N/A: 本 phase では扱わない
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 本 phase では扱わない
- Quality: applicable: S1〜S6 を検証する
- Documentation: N/A: docs は P12
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 記録のみ

## 成果物

- Produced artifacts:
- docs/ai-screen/design-decisions.md
- Consumed artifacts:
- docs/ai-screen/design-decisions.md
- specs/spec-ai-analysis-screen.md
- Write scope/touches:
- docs/ai-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-AI-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-AI-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-AI-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-AI-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入、レポート JSON 契約 v3、ヘッダー、既存の依頼・レポート行の書き換え、新しいログイン手段・長期トークン・secret・binding・外部サービスの登録、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- S1〜S6 のそれぞれに PASS / FAIL と証跡が記録されている。
- 一部適合を PASS に数えていない。
- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web lint
- Required evidence:
- docs/ai-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-ai-analysis-screen.md
- Architecture: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Feature: feat-ai-analysis-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-AI-P06
