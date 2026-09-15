---
graph_node_id: "SYS-ANHUB-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "支出分析ハブ 実装 (core集計・previousPeriod移設・API・ハブ画面)"
project_id: "feature-package-feat-analysis-hub"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["analysis-hub", "p05"]
file_path: "tasks/feat-analysis-hub/sys-anhub-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:39:34Z", "origin_kind": "system-dev-planner", "source_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "source_path": ".dev-graph/plans/feature-package-feat-analysis-hub/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:39:34Z"
updated_at: "2026-09-14T13:39:34Z"
depends_on: ["SYS-ANHUB-P04"]
related_nodes: ["arch-analysis-hub-backend", "arch-analysis-hub-frontend", "arch-analysis-hub-ui-ux", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-database"]
resource_scope: ["packages/core/src/analysis-hub.ts", "packages/api/src/routes/analysis-hub.ts", "packages/api/src/index.ts", "packages/web/src/pages/Analysis.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/components/Layout.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-analysis-hub"
feature_package_id: "feature-package/feat-analysis-hub"
phase_ref: "P05"
classification_confidence: 1.0
classification_reason: "feature-execution-package-contract.md の P01..P13 責務表に基づき、specs/spec-analysis-hub.md と architecture/analysis-hub-*.md の該当領域から本 task の workstream を分類した。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-analysis-hub/sys-anhub-p05.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-lci.5", "linked_at": "2026-09-14T14:18:22Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:00:22Z", "missing_sections": [], "status": "complete"}
---

# SYS-ANHUB-P05 支出分析ハブ 実装 (core集計・previousPeriod移設・API・ハブ画面)

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P05",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P05",
  "workstream_kind": "frontend",
  "secondary_workstreams": [
    "backend",
    "api"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P04"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p05.md"
}
```

## 目的

P04 の失敗テストを green にする実装として、packages/core にハブ集計純関数と previousPeriod 判定を追加し、GET /api/analysis/hub を authGuard→mustChangePasswordFence の内側に新設し、/analysis を ?focus= 対応のハブ画面へ置き換え、タブ短縮名とサイドバー件数バッジを実装する。

## 背景

architecture-backend.md は C1 (集計は core の純関数) を制約とし、architecture-frontend.md は queryKey ['analysis-hub', 期間 key] の共有と C3 例外 (ハブ API は表示していないタブの API を呼ばない原則の例外として docs/ui-decisions.md に明記) を求める。architecture-ui-ux.md は情報の優先順位 (①ルート一覧②収支サマリー③選択中パネル④読み順) を画面構成の根拠とする。

## 前提条件

- Entry gate: P04 の3テストファイルが存在し、実装前に red (失敗) であることが確認済みであること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P04

## Workstream applicability

主分類: Frontend / 副分類: backend, api

- Frontend: applicable — /analysis ハブ画面 (?focus=, URL コピー, ルート一覧, 収支サマリー, 選択中パネル, 読み順, 下部固定バー)・タブ短縮名・サイドバー件数バッジを実装する
- Backend: applicable — packages/core にハブ集計純関数と previousPeriod 判定関数を実装する (api/ai/dataset.ts からの移設)
- API: applicable — GET /api/analysis/hub route を新設し authGuard 配下に置く
- Data: N/A: 既存テーブルの読取りのみでスキーマ変更を持たない
- Infrastructure: N/A: 既存 Cloudflare Workers 配信構成のままで追加の配布物を持たない
- Security: applicable — 新ルートを既存の認証ゲート配下に置き userId で絞り込み、focus を ANALYSIS_TABS の id の許可リストで検証する
- Quality: applicable — P04 の失敗テストを green にすることが受入条件
- Documentation: N/A: 本taskは実装コードのみで docs 更新は P12 で行う
- Operations: N/A: 運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: qa-analysis-hub-decision-001 (?focus= を setSearchParams replace:true で保持), qa-analysis-hub-decision-002/003 (core 集計・previousPeriod 移設), qa-frontend-web-ah-decision-003 (queryKey 共有、staleTime は本taskでは暫定値を決定として確定せず P02 決定記録の『未決』注記に従う), qa-ui-ux-web-ah-decision-005 (情報の優先順位) を実装する。デプロイ単位: packages/core は npm workspace 経由で packages/api・packages/web から参照、packages/api は Cloudflare Workers、packages/web は Vite ビルドで Worker から静的配信。
- Deploy unit: packages/core (Node ライブラリ, npm workspace), packages/api (Cloudflare Workers, Hono route追加), packages/web (Vite web ビルド)
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): packages/core/src/analysis-hub.ts, packages/api/src/routes/analysis-hub.ts, packages/web/src/pages/Analysis.tsx ほかの実装コード一式 (P04 のテストが green になる状態)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/architecture-decision.md, packages/core/src/analysis-hub.test.ts, packages/api/src/analysis-hub.test.ts, packages/web/src/analysis-hub.dom.test.tsx, packages/api/src/ai/dataset.ts (previousPeriod の移設元)
- Write scope: `packages/core/src/analysis-hub.ts`, `packages/api/src/routes/analysis-hub.ts`, `packages/api/src/index.ts`, `packages/web/src/pages/Analysis.tsx`, `packages/web/src/routeMetadata.ts`, `packages/web/src/components/Layout.tsx`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P05 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- 5 タブ詳細画面の中身の作り直し
- D1 migration の追加
- staleTime 具体値の確定 (未決のため既存の TanStack Query 既定挙動を超えて固定しない)
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `pnpm --filter core test -- analysis-hub`
- `pnpm --filter api test -- analysis-hub`
- `pnpm --filter web test -- analysis-hub.dom`
- `pnpm typecheck`
- Required evidence: P04 の3テストファイルが green になった実行ログ、typecheck 成功ログ

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: 本task で追加・変更したファイルを P04 完了時点の状態 (テスト red) へ差し戻す。api/ai/dataset.ts の previousPeriod は削除せず維持したまま (重複除去は P08) 実装のみを取り消す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p05.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/backend.md
- system-spec/frontend.md
- system-spec/ui-ux.md
- system-spec/auth.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P04
