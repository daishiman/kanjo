---
graph_node_id: "arch-mobile-financial-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "モバイル財務chartのフロントエンドアーキテクチャ"
project_id: "kanjo"
domain: "frontend"
status: "active"
owners: []
tags: ["chartjs", "responsive", "semantic-table", "visual-regression"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T09:25:39Z"
updated_at: "2026-08-30T09:25:39Z"
depends_on: []
related_nodes: ["spec-mobile-financial-visualization", "arch-mobile-financial-experience"]
resource_scope: ["packages/web/src", "packages/web/scripts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-mobile-financial-frontend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"d9fb1ee711c018ee497c65f58bef5878593a9faf59c3ba7b22600a73a9afe7a3"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/frontend.md","source_version":"0.1.11","source_digest":"d9fb1ee711c018ee497c65f58bef5878593a9faf59c3ba7b22600a73a9afe7a3","imported_at":"2026-08-30T09:25:39Z"}
classification_confidence: 1.0
classification_reason: "C19 spec dispatchがconfirmed frontend章をChart.js responsive architectureとして一意に分類した。"
classification_candidates: [{"artifact_kind":"architecture","confidence":1.0,"candidate_path":"architecture/arch-mobile-financial-frontend.md"},{"artifact_kind":"specification","confidence":0.1,"candidate_path":"specs/mobile-financial-frontend.md"}]
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"open","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-08-30T09:25:39Z"}
---

# Architecture overview

Chart.js canvasのresponsive contractと、視覚情報を補完するsemantic companionを共通component境界にする。既存APIと会計計算は内側の正本として守り、viewport固有の変換を表示adapterへ局所化する。

## Context and drivers

- Business/technical context: grid/flexとcanvasの親寸法によりモバイルだけ0寸法・overflow・label重なりが起き得る。
- Quality attribute priorities: 正確性、responsive可視性、accessibility、testability、bundle size。
- Constraints: React 18、Chart.js 4、react-chartjs-2、既存route/CSS tokenを維持する。

## Goals and non-goals

- Goals: 全chartへ可視container、単一view-model、semantic companion、viewport contractを適用する。
- Non-goals: chart library交換、API追加、集計再実装、全画面rewrite。

## System context and boundaries

- Users/external systems: React page、Chart.js、DOM/ARIA、支援技術、実Chrome検査。
- Trust/deployment/data boundaries: Web bundle内。API/session/永続層を越えない。
- Context diagram: `query data → pure adapter/view-model → FinancialFigure(summary, chart, details) → DOM/canvas`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| financial adapter | API値を表示用series/summary/rowsへ一度だけ変換 | typed pure function | Web client | web bundle |
| responsive chart container | min-width:0、relative、明示高さ、resize契約 | children/height variant | Web client | web bundle |
| financial figure | heading、summary、canvas、legend、semantic detailsを関連付ける | view-model+chart options | Web client | web bundle |
| mobile visual test | viewport別DOM/canvas実測 | localhost+anonymous fixture | test process | development only |

## Cross-cutting contracts

- Identity/access: heading idとfigure/summary/detailsをARIAで関連付ける。
- Errors/resilience: canvasが描けなくてもsummary/detailsを残す。
- Observability/audit: bounding box、visibility、overflow、semantic fieldsを機械計測する。
- Configuration/secrets: 追加なし。test dataは匿名化する。
- Compatibility/versioning: 既存chart optionを段階移行しdesktop seriesを維持する。

## Subtype architecture

- Frontend: 本書のcomponent/view-model/test境界を適用する。
- Backend: N/A: 既存APIを変更しない。
- Infrastructure: N/A: deploy構成を変更しない。
- Data: N/A: 永続modelを変更しない。
- Security: N/A: 認証認可を変更しない。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-CHART-001 | 専用relative parentにmin-width:0と明示高さを与え、maintainAspectRatio=falseを使う | canvas直指定、固定aspect ratio | Chart.js公式responsive契約とgrid/flex縮小を両立 | viewport別height tokenが必要 |
| ADR-CHART-002 | canvas/summary/tableを単一view-modelから生成する | 各表現で再集計 | 会計値の不一致を防ぎunit test可能 | adapter型の設計が必要 |
| ADR-CHART-003 | 実Chromeのgeometry/DOM contractを回帰の正本にする | CSS文字列検査、目視screenshotのみ | 0寸法と実overflowを再現可能に検出 | browser起動コストが増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存Vite/Web bundle。
- Migration sequence: inventory→共通primitive/view-model→高リスクchart→残route→visual gate。
- Rollback trigger/procedure: series/値不一致、0寸法、既存test回帰で適用単位を戻す。

## Risks and verification

- Risk/assumption: chart固有option差を共通化しすぎる。共通containerとsemantic contractだけを固定し、series表現はpage adapterへ残す。
- Architecture fitness test: 全figureにheading/summary/details、container正寸法、主要series保持。
- Load/failure/security validation: empty/large series、resize連打、200% zoom、匿名fixture、client logの財務値非出力。

## Rendering and application pattern

- Pattern: React SPA、pure adapter + presentational figure + Chart.js adapter。
- Framework/runtime and selection rationale: 既存依存を継続しbundle/学習/移行riskを抑える。
- Browser/device support: Chrome実測を自動gateとし、Safari実機は手動acceptanceで補完する。

## Routes, screens and navigation

- Route/screen map: chart/figure inventoryを静的に列挙し、全既存routeとの対応をtestで固定する。
- Authentication guard/deep link/history: navigation/session挙動を変更しない。

## Component and design-system boundaries

- Component hierarchy: route page→domain adapter→FinancialFigure→ResponsiveChartContainer/semantic details。
- Design tokens/reusable primitives: chart height、gap、touch target、safe-area、overflow edgeをCSS token化する。
- Accessibility standard: WCAG 2.2 AA相当、figure heading、非色依存legend、semantic table、keyboard details。

## State and data flow

- Local/server/global state ownership: query data=server、view-model=pure derived、details open=local。
- Fetch/cache/invalidation/optimistic update: 既存query keyとcacheを変更しない。
- Form/validation/error presentation: 書込form非対象。errorは既存PageStateとfigure fallbackを組み合わせる。

## Backend integration

- API client/generated types/versioning: 既存API型をadapter入力として維持する。
- Auth/session/CSRF/CORS: 変更なし。
- Offline/retry/timeout: 既存query policyを維持し、stale dataは期間表示と共に扱う。

## Performance and observability

- Bundle/render/Core Web Vitals budgets: 依存追加0、visible chartだけrender、resize debounceを公式option範囲で使用する。
- Client logs/metrics/traces and privacy: 自動testはgeometryとDOM存在だけを記録し金額値を保存しない。

## Frontend verification

- Unit/component/visual/e2e/accessibility: adapter edge cases、semantic role/name、all routes build、360/375/390/tablet/desktop/zoom2 geometry、keyboard、reduced-motion。
