---
graph_node_id: "SYS-ANHUB-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "支出分析ハブ アーキテクチャ決定記録の確定"
project_id: "feature-package-feat-analysis-hub"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["analysis-hub", "p02"]
file_path: "tasks/feat-analysis-hub/sys-anhub-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:39:34Z", "origin_kind": "system-dev-planner", "source_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "source_path": ".dev-graph/plans/feature-package-feat-analysis-hub/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:39:34Z"
updated_at: "2026-09-14T13:39:34Z"
depends_on: ["SYS-ANHUB-P01"]
related_nodes: ["arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-ui-ux", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["docs/analysis-hub/architecture-decision.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-analysis-hub"
feature_package_id: "feature-package/feat-analysis-hub"
phase_ref: "P02"
classification_confidence: 1.0
classification_reason: "feature-execution-package-contract.md の P01..P13 責務表に基づき、specs/spec-analysis-hub.md と architecture/analysis-hub-*.md の該当領域から本 task の workstream を分類した。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-analysis-hub/sys-anhub-p02.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-lci.2", "linked_at": "2026-09-14T14:18:17Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:00:22Z", "missing_sections": [], "status": "complete"}
---

# SYS-ANHUB-P02 支出分析ハブ アーキテクチャ決定記録の確定

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P02",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P02",
  "workstream_kind": "documentation",
  "secondary_workstreams": [
    "frontend",
    "backend"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P01"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p02.md"
}
```

## 目的

8 件の architecture/analysis-hub-*.md に分散する ADR (qa-analysis-hub-decision-001..004, qa-backend-web-ah-decision-003, qa-frontend-web-ah-decision-003, qa-ui-ux-web-ah-decision-005) を 1 つの決定記録に集約し、P05 実装が参照する設計方針を確定する。

## 背景

architecture-frontend.md の queryKey 共有・staleTime 方針 (qa-frontend-web-ah-decision-003) と architecture-backend.md の previousPeriod 移設方針は、実装前に決定内容と未決範囲を明示しないと P05 で場当たり的な実装に流れる。

## 前提条件

- Entry gate: P01 の docs/analysis-hub/requirements-baseline.md が存在し、8 件の architecture/analysis-hub-*.md すべての confirmation_status=confirmed かつ evaluation_status=pass であること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P01

## Workstream applicability

主分類: Documentation / 副分類: frontend, backend

- Frontend: applicable — queryKey ['analysis-hub', 期間 key] 共有と staleTime 方針の決定記録 (実装は P05)
- Backend: applicable — previousPeriod の api/ai/dataset.ts から packages/core への移設方針の決定記録 (実装は P05)
- API: N/A: GET /api/analysis/hub の契約自体は specs/spec-analysis-hub.md で確定済みのため本taskでは変更しない
- Data: N/A: スキーマ変更なし (D1 migration なし)
- Infrastructure: N/A: 配信構成 (Worker/binding/cron) の変更なし
- Security: N/A: 認証・認可方針は既存を維持し auth 章の決定を変えない
- Quality: applicable — 決定記録が P04 の境界値テスト設計の入力になる
- Documentation: applicable — docs/analysis-hub/architecture-decision.md を新設する
- Operations: N/A: 運用手順の変更なし

## Architecture and deploy unit

- Architecture decisions: qa-analysis-hub-decision-001 (/analysis をハブにし ?focus= で選択を保持), qa-analysis-hub-decision-002/003 (core 集計関数と previousPeriod 移設), qa-analysis-hub-decision-004 (5 タブ名とサイドバー子行の短縮), qa-ui-ux-web-ah-decision-005 (情報の優先順位), qa-frontend-web-ah-decision-003 (queryKey 共有・staleTime は reopen 時に値を分割), qa-backend-web-ah-decision-003 を決定記録として1文書に統合する。デプロイ単位は packages/web (web ビルド) と packages/api (Worker) を変更しない。
- Deploy unit: N/A: ドキュメント成果物のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/architecture-decision.md (ADR 一覧、未決事項の明示的な Entry gate 化を含む)
- 参照する既存成果物 (Consumed artifacts): architecture/analysis-hub-frontend.md, architecture/analysis-hub-backend.md, architecture/analysis-hub-ui-ux.md, architecture/analysis-hub-security.md, docs/analysis-hub/requirements-baseline.md
- Write scope: `docs/analysis-hub/architecture-decision.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P02 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- staleTime の具体的な数値の確定 (未決事項のため本taskでは決定せず、次サイクルの reopen 対象として明記する)
- bundled decision (qa-frontend-web-ah-decision-003) の分割そのもの
- 実装コードの変更
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/architecture-decision.md`
- `grep -c 'qa-' docs/analysis-hub/architecture-decision.md`
- Required evidence: docs/analysis-hub/architecture-decision.md の diff。未決事項 (staleTime 値等) が『未決』として明記され、実装で仮の値が正としてコミットされていないことの確認

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/architecture-decision.md を削除する。P05 はこの巻き戻し後 architecture/analysis-hub-*.md へ直接立ち返る。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p02.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/frontend.md
- system-spec/backend.md
- system-spec/ui-ux.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P01
