---
graph_node_id: "SYS-TRENDS-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "境界値付きの red テスト先行 (指標定義・比較期間・総収支との一致・画面ブロック・/classify 絞込)"
project_id: "feature-package-feat-trends-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["trends-screen", "p04", "test-design"]
file_path: "tasks/feat-trends-screen/sys-trends-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-trends-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T10:30:02Z", "origin_kind": "system-dev-planner", "source_digest": "ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4", "source_path": ".dev-graph/plans/feature-package-feat-trends-screen/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-16T10:30:02Z"
updated_at: "2026-09-16T10:30:02Z"
depends_on: ["SYS-TRENDS-P03"]
related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
resource_scope: ["packages/core/test/trend-metrics-contract.test.ts", "packages/core/test/trend-comparison.test.ts", "packages/api/test/trends-screen.integration.test.ts", "packages/web/src/pages/analysis/trends-screen.dom.test.tsx", "packages/web/src/classify-trends-filter.dom.test.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-trends-screen"
feature_package_id: "feature-package/feat-trends-screen"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-trends-screen/sys-trends-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-16T10:20:25Z", "missing_sections": [], "status": "complete"}
---

# 境界値付きの red テスト先行 (指標定義・比較期間・総収支との一致・画面ブロック・/classify 絞込)

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p04", "test-design"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec の「テストと受入条件」と Contract tests 10 項目を、実装前に失敗するテストとして書き、P05 の完了条件をテストで固定する。

## 背景

既存の trend-contract.test.ts と trends-scope.dom.test.tsx は傾向の判定と範囲の切替だけを見ている。指標の登録制、総収支との一致、要確認の扱い、/classify の完全一致の絞込は、どれもテストが無い。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: SYS-TRENDS-P03 が完了し、その成果物が default branch に取り込まれていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 10 ブロックの描画・URL 復元・遷移先 URL・/classify の絞込の DOM テストを書く
- Backend: applicable: core の指標定義 3 件・比較期間・恒等式・境界値・テスト用指標 1 件の追加を検査するテストを書く
- API: applicable: Contract tests 10 項目を integration test にする
- Data: N/A: 本 task はこの層のコードを変更しない
- Infrastructure: N/A: 本 task はこの層のコードを変更しない
- Security: N/A: 本 task はこの層のコードを変更しない
- Quality: applicable: 新しいテストが現行実装で失敗し、既存テストが緑のままであることを確認する
- Documentation: N/A: 本 task はこの層のコードを変更しない
- Operations: N/A: 本 task はこの層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: N/A: テストコードのみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本 task は migration もデータの移行も行わない (D1 は変えない)

## 受入基準

- 新しいテスト 5 本が現行実装で失敗し、失敗の理由が未実装の機能であると読める。
- 3 指標×3 範囲×2 比較対象の恒等式 (総合=事業+家計、純収支=収入-支出) を全組合せで検査している。
- 要確認 0 件と 1 件以上、口座が空の freee 行、最も変化が大きい月の同値と全 0 の境界値を含む。
- 既存テスト 3 本 (packages/core/test/trend-contract.test.ts、packages/web/src/trends-scope.dom.test.tsx、packages/api/src/analytics-period.test.ts) は変更せず緑のままである。

## 成果物

- Produced artifacts:
- packages/core/test/trend-metrics-contract.test.ts
- packages/core/test/trend-comparison.test.ts
- packages/api/test/trends-screen.integration.test.ts
- packages/web/src/pages/analysis/trends-screen.dom.test.tsx
- packages/web/src/classify-trends-filter.dom.test.tsx
- Consumed artifacts:
- system-spec/00-requirements-definition.md
- specs/spec-trends-screen.md
- features/feat-trends-screen.md
- system-spec/completeness-findings.json
- docs/trends-screen/architecture-decision.md
- docs/trends-screen/design-review.md
- packages/core/test/trend-contract.test.ts
- packages/web/src/trends-scope.dom.test.tsx
- packages/api/src/analytics-period.test.ts
- Write scope/touches:
- packages/core/test/trend-metrics-contract.test.ts
- packages/core/test/trend-comparison.test.ts
- packages/api/test/trends-screen.integration.test.ts
- packages/web/src/pages/analysis/trends-screen.dom.test.tsx
- packages/web/src/classify-trends-filter.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRENDS-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/trend-metrics-contract.test.ts
- packages/core/test/trend-comparison.test.ts
- packages/api/test/trends-screen.integration.test.ts
- packages/web/src/pages/analysis/trends-screen.dom.test.tsx
- packages/web/src/classify-trends-filter.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 追加したテストファイルのコミットを revert する。既存テストに変更が無いため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRENDS-P03
