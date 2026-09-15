---
graph_node_id: "SYS-ANHUB-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "支出分析ハブ リリース判断とクローズアウト"
project_id: "feature-package-feat-analysis-hub"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["analysis-hub", "p13"]
file_path: "tasks/feat-analysis-hub/sys-anhub-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:39:34Z", "origin_kind": "system-dev-planner", "source_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "source_path": ".dev-graph/plans/feature-package-feat-analysis-hub/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:39:34Z"
updated_at: "2026-09-14T13:39:34Z"
depends_on: ["SYS-ANHUB-P12"]
related_nodes: ["arch-analysis-hub-infrastructure", "feat-analysis-hub"]
resource_scope: ["docs/analysis-hub/close-out.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-analysis-hub"
feature_package_id: "feature-package/feat-analysis-hub"
phase_ref: "P13"
classification_confidence: 1.0
classification_reason: "feature-execution-package-contract.md の P01..P13 責務表に基づき、specs/spec-analysis-hub.md と architecture/analysis-hub-*.md の該当領域から本 task の workstream を分類した。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-analysis-hub/sys-anhub-p13.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-lci.13", "linked_at": "2026-09-14T14:18:59Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:00:22Z", "missing_sections": [], "status": "complete"}
---

# SYS-ANHUB-P13 支出分析ハブ リリース判断とクローズアウト

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P13",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P13",
  "workstream_kind": "operations",
  "secondary_workstreams": [
    "infrastructure",
    "quality",
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P12"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p13.md"
}
```

## 目的

P01..P12 の全証跡をもとに、既存の ci.yml → deploy.yml 経路でのリリース可否を判断し、feature 完了のクローズアウト記録を残す。

## 背景

feature-execution-package-contract.md は P08/P13 について N/A を理由付きで許容するが、本feature は既存 Worker 配信経路を使うリリースを伴うため P13 を N/A とせず、既存経路の維持確認とクローズアウトを行う。architecture-infrastructure.md は Worker/binding/cron の変更なしを前提とする。

## 前提条件

- Entry gate: P12 の docs/ui-decisions.md 更新と3件のDOMテスト更新が完了していること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P12

## Workstream applicability

主分類: Operations / 副分類: infrastructure, quality, documentation

- Frontend: N/A: リリース判断のみで実装コード変更を持たない
- Backend: N/A: リリース判断のみで実装コード変更を持たない
- API: N/A: リリース判断のみで実装コード変更を持たない
- Data: N/A: スキーマ変更なし
- Infrastructure: applicable — 既存 Cloudflare Workers 配信構成 (ci.yml → deploy.yml) が変更されていないことを最終確認する
- Security: N/A: セキュリティ確認は P09 で完了済み
- Quality: applicable — P01..P12 の証跡 (docs/analysis-hub/evidence.md) が全件揃っていることを確認する
- Documentation: applicable — docs/analysis-hub/close-out.md を新設する
- Operations: applicable — 本taskの主責務。リリース判断とクローズアウト

## Architecture and deploy unit

- Architecture decisions: architecture-infrastructure.md の『Worker/binding/cron の変更なし』を最終確認する。デプロイ単位は既存の packages/web (静的アセット) + packages/api (Worker) のままで新規デプロイ単位を追加しない。
- Deploy unit: packages/web + packages/api を既存 ci.yml → deploy.yml の Cloudflare Workers 配信経路でリリースする (配信構成自体の変更なし)
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/close-out.md (リリース可否判断、feature クローズアウト記録、次サイクル候補の明記)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/evidence.md, docs/analysis-hub/final-review.md, .github/workflows/ci.yml, .github/workflows/deploy.yml
- Write scope: `docs/analysis-hub/close-out.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P13 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- ci.yml/deploy.yml 自体の変更
- 5 タブ詳細画面の作り直しfeatureの起票 (次サイクル候補として記録するに留める)
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/close-out.md`
- `git diff --stat .github/workflows/ci.yml .github/workflows/deploy.yml`
- Required evidence: docs/analysis-hub/close-out.md に記載したリリース判断根拠と、ci.yml/deploy.yml に差分がないことの確認結果

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/close-out.md を削除する。リリース後に問題が判明した場合は既存の Cloudflare Workers ロールバック手順 (直前のデプロイへ戻す) に従う。migration は伴わないため巻き戻し不要。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p13.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/infrastructure.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P12

## 実装で確定した結果 (2026-09-15)

- close-out の条件だった F1 (トークン承認記録の digest) と F2 (評価記録の絶対パス) を解消し、`pnpm lint` / `pnpm typecheck` / 全パッケージ test が exit 0。判断は「リリース可」へ更新した。
- 仕様反映の受領書は docs/analysis-hub/close-out.md 7 節に記録した。再改善 (invalidate 集約・ナビゲーション効果・実描画検査・判断の結び付けの切り出し) は確定仕様の契約を変えないため確定章の reopen は行わず、reopen 候補を close-out 6 節へ登録した。
- 配信経路: branch `devgraph/feat-analysis-hub` から main 向け draft PR。Beads (kanjo-lci.*) の done 化は default branch への merge 後に `/dev-graph sync` で行う。
