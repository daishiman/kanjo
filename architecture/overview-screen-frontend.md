---
graph_node_id: "arch-overview-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "概況画面改善 — 共通部品と応答型境界"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "frontend"]
file_path: "architecture/overview-screen-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "9c075af903fe23a7e029e602eed6c1617a213be8f61ac39535180520419040df"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/frontend.md", "source_version": "0.1.14", "source_digest": "222efa30c534ea1fb7280fbca65798e6bde43946c3eedec15c6ce54bf650fe2d", "imported_at": "2026-09-15T00:18:48Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-15T00:18:48Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Overview.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/NavItem.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/FinancialFigure.tsx", "packages/web/src/components/charts.ts", "packages/web/src/api-client.ts", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/defense-forecast.dom.test.tsx"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を frontend とし、architecture-frontend.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G2", "G4", "G5"]
---

# Architecture overview

概況画面改善 — 共通部品と応答型境界。正本は `system-spec/frontend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: `packages/web/src/components/Layout.tsx` の NavItem にはバッジを渡す props が無く、MONTHLY_STEPS を持つ。`routeMetadata.ts` の path '/' は contentWidth reading。Page.tsx の部品、DataTable、FinancialFigure が既存の共通部品である。右パネル/ドロワーの部品は無く、styles.css の --aside-panel-w 320px は未使用。モーダルは dialog 要素で作る。React Query は retry 1・staleTime 30s。期間は usePeriod (period.tsx) で持つ。
- Quality attribute priorities: G2, G4, G5 に資する。画面は API の応答型だけを知り再計算しないこと (件数と総額のずれを防ぐ) を最優先にする。
- Constraints: C3: 期間は Dataset を切る方式 (period.ts) に従う。C4: design-tokens と check-design-tokens。C6: CI の headless Chrome は pointer:none。初期 JS 予算 110KiB。

## Goals and non-goals

- Goals:
  - G2: バッジ・右パネル・固定アクションバーを components/ の共通部品として置き、件数を 1 つのクエリから描く。
  - G4: Overview.tsx を 02 の構成で作り替え、既存 5 要素を段階的開示へ移す。
  - G5: 読込・空・エラー、1280px 未満での右パネルのドロワー化、キーボード操作を持つ。
- Non-goals:
  - 概況以外の画面の作り替え
  - 画面側での集計・再計算
  - 新しい外部ライブラリの追加

## System context and boundaries

- Users/external systems: 利用者 1 名。通信先は同一オリジンの /api/* だけ。
- Trust/deployment/data boundaries: web は Worker の静的アセットとして配信され、データは API 応答からだけ得る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| pages/Overview.tsx | `system-spec/ui-ux.md#表示順の正本`の配置と範囲切替 | OverviewResponse | packages/web | web ビルド |
| useReviewQueue | 未処理キューの取得。キー ['review-queue'] (期間を含めない、推定) | ReviewQueueResponse | packages/web | web ビルド |
| NavItem のバッジ | サイドバーの未処理件数 | props (新設) | packages/web | web ビルド |
| 右パネル / ドロワー | 1280px 以上は常設、未満は dialog 要素 (推定) | 選択明細 | packages/web | web ビルド |
| 固定アクションバー | 件数と主要操作 | ReviewQueueResponse | packages/web | web ビルド |
| api-client.ts | 型付き取得と PUT/DELETE | fetch | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: バッジ取得は enabled: !locked とし、ロック中に API を叩かない。
- Errors/resilience: React Query の retry 1 に合わせ、領域ごとにエラーと再試行を出す。
- Observability/audit: 実行時の計測は追加しない。件数の変化は role=status。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の共通シェルと期間保持を変えない。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

React SPA。図は既存の charts.ts と FinancialFigure で描く。移動平均は推移グラフの切替、パレートは支出内訳の構成比表示とし、未決済と科目別年比較は details 要素 (初期は閉じる) に入れる。防衛予測は defenseForecast.level が caution/warn のときだけ KPI の上に role=alert で出す。

#### Routes, screens and navigation

ルート `/` と routeMetadata を維持する。右パネルから該当画面へ 1 操作で遷移する。

#### Component and design-system boundaries

バッジ・右パネル・固定アクションバーは components/ の共通部品にし、概況固有の部品から直接スタイルを持たない。ドロワーは APG モーダルダイアログ (フォーカスの閉じ込めと戻し、Escape で閉じる) に従う。

#### State and data flow

web は OverviewResponse と ReviewQueueResponse だけを知り再計算しない。範囲はクエリ引数、期間は usePeriod。「後で確認」と月次レビューの PUT/DELETE の成功後に ['review-queue'] を invalidate して 3 か所を同時に更新する。

#### Backend integration

GET /api/overview、GET /api/review-queue、保留と月次レビューの PUT/DELETE を呼ぶ。PUT は冪等なので二重送信でも結果が同じ。

#### Performance and observability

新しい依存を足さず、初期 JS 110KiB 予算 (check-initial-js-budget.mjs) を守る。staleTime 30s を既存に合わせる。

#### Frontend verification

DOM テストでバッジ・カード・アクションバーの件数一致、「後で確認」での同時減少、期間 1年→3年で不変 (O2)。check-financial-visuals.mjs で画像正本の表示順、広幅の Review 3列・比較/内訳2列、横はみ出しなしを観測し、Overview を 8 幅で描画して exit 0 (O4)。既存の defense-forecast.dom.test.tsx を新しい配置に追従させる。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は dec-overview-legacy-elements と dec-overview-aggregation-scope を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: typecheck、vite build、check-initial-js-budget の既存順序で配信する。
- Migration sequence: 応答型の追加、共通部品 (バッジ・右パネル・アクションバー) の新設、Overview.tsx の差し替え、既存 5 要素の移設の順に進める。
- Rollback trigger/procedure: DOM テスト・描画検査・JS 予算のいずれかが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 未処理キューのキーに期間を含めると件数が期間で変わる。キーは ['review-queue'] に固定する。
- Architecture fitness test: 3 か所が同じクエリ結果を読むことを DOM テストで確かめる。
- Load/failure/security validation: API 失敗時の領域エラー表示と、明細をテキストとして描画することを DOM テストで確かめる。
