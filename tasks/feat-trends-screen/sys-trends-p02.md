---
graph_node_id: "SYS-TRENDS-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "指標の登録表・総収支と同じ取引集合の推移集計・GET /api/trends 拡張・/classify 絞込の設計決定記録"
project_id: "feature-package-feat-trends-screen"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["trends-screen", "p02", "architecture"]
file_path: "tasks/feat-trends-screen/sys-trends-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-trends-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T10:30:02Z", "origin_kind": "system-dev-planner", "source_digest": "ad9f046d57b0189604f64f5669609c5feb4462b9f403d3f31a053df4268349b4", "source_path": ".dev-graph/plans/feature-package-feat-trends-screen/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-16T10:30:02Z"
updated_at: "2026-09-16T10:30:02Z"
depends_on: ["SYS-TRENDS-P01"]
related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
resource_scope: ["docs/trends-screen/architecture-decision.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-trends-screen"
feature_package_id: "feature-package/feat-trends-screen"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-trends-screen/sys-trends-p02.md", "confidence": 0.95}]
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

# 指標の登録表・総収支と同じ取引集合の推移集計・GET /api/trends 拡張・/classify 絞込の設計決定記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p02", "architecture"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core の MetricDefinition と登録表、totalCashflowReport と同じ判定を行単位で返す TrendSourceRow、previousYearPeriod、GET /api/trends の追加フィールド (metrics・selection・series・kpis・detail・categories・pareto 拡張・topMovers・review・judgementBasis)、/classify の category・payee クエリ、画面 10 ブロックの部品分けを決定記録にする。

## 背景

現行の GET /api/trends (packages/api/src/routes/analytics.ts:432) は MF 明細だけの Dataset から trendsReport (packages/core/src/trend.ts) を作る。spec は数値の出所を総収支と同じ取引集合に変え (dec-trends-datasource-001)、傾向の判定だけは MF の明細のまま残す (dec-trends-judgement-source-001)。二つの基準が同じ応答に並ぶため、型の境界を先に決めておく必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: SYS-TRENDS-P01 が完了し、その成果物が default branch に取り込まれていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: Trends.tsx の 10 ブロックの部品分けと URL 状態 (range・metric・compare・month・category) の形を決める
- Backend: applicable: MetricDefinition・TrendSourceRow・TrendReviewSummary の型と、totalCashflowReport との共有の仕方を決める
- API: applicable: GET /api/trends の追加フィールドと 400 invalid_metric、その他のクエリを既定値へ倒す規則を決める
- Data: applicable: D1 を変えず、loadDataset と freee 系 4 表の読み取りを 1 回ずつに保つ方針を記録する
- Infrastructure: N/A: 本 task はこの層のコードを変更しない
- Security: applicable: metric を登録表の id だけに限定し、payee を完全一致の値として扱う方針を記録する
- Quality: N/A: 本 task はこの層のコードを変更しない
- Documentation: applicable: docs/trends-screen/architecture-decision.md を新設する
- Operations: N/A: 本 task はこの層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: N/A: 決定記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本 task は migration もデータの移行も行わない (D1 は変えない)

## 受入基準

- 追加フィールドの名前と型が spec の Response 節と一致して記録されている。
- 指標 id の分岐を画面と API に書かない構造 (登録表を引くだけ) が、図か表で示されている。
- 要確認の件数と金額を totalCashflowReport の月次 reviewCount・reviewAmount から取り、金額は sumAbs と同じ絶対値の合計とする決定が記録されている。
- previousYearPeriod を analysis-hub.ts の previousPeriod の隣に置く決定と、全期間で comparePeriod を null にする規則が記録されている。

## 成果物

- Produced artifacts:
- docs/trends-screen/architecture-decision.md
- Consumed artifacts:
- system-spec/00-requirements-definition.md
- specs/spec-trends-screen.md
- features/feat-trends-screen.md
- system-spec/completeness-findings.json
- docs/trends-screen/requirements-baseline.md
- Write scope/touches:
- docs/trends-screen/architecture-decision.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRENDS-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm typecheck
- Required evidence:
- docs/trends-screen/architecture-decision.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: architecture-decision.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRENDS-P01
