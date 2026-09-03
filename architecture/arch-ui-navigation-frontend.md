---
graph_node_id: "arch-ui-navigation-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "共通UI実装境界と回帰防止"
project_id: "kanjo"
domain: "frontend"
status: "active"
owners: []
tags: ["react", "router", "ui-contract"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-29T15:30:44Z"
updated_at: "2026-08-29T15:30:44Z"
depends_on: []
related_nodes: ["spec-ui-navigation-cognitive-load", "arch-ui-navigation-experience"]
resource_scope: ["packages/web/src"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-ui-navigation-frontend.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"fa625c7ca3931ca00fbbb761e33b23a5b4e0da9bd96c896e8395f7a3038385f0"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/frontend.md","source_version":"0.1.12","source_digest":"fa625c7ca3931ca00fbbb761e33b23a5b4e0da9bd96c896e8395f7a3038385f0","imported_at":"2026-08-29T15:30:44Z"}
classification_confidence: 1.0
classification_reason: "C19 spec dispatchがconfirmed frontend章をfrontend architectureとして取り込んだため分類は一意。"
classification_candidates: []
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"open","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status":"complete","missing_sections":[],"checked_at":"2026-08-29T15:30:44Z"}
---

# Architecture overview

> 本書(`arch-ui-navigation-frontend`)は**`packages/web`の実装境界と回帰防止**を扱う。体験上の要求とADRの正本は`arch-ui-navigation-experience`にあり、本書はそれを再掲しない。

## Context and drivers

- Context: 共通LayoutとrouteMetadataが15画面を束ねるため共有境界の改善を優先する。
- Priorities: 型安全、回帰検知、accessibility、低bundle overhead。
- Constraints: React Router、Vitest/DOM、styles.css、PageHeader/PageState契約を維持。

## Goals and non-goals

- Goals: current/icon/spacing/disclosure/editing契約をmetadataと共通componentへ集約。
- Non-goals: backend API、database、auth、deployment再設計。

## System context and boundaries

- Users/external systems: React client、React Router、既存API。
- Boundaries: `packages/web`内。API responseや永続形式は不変。
- Context diagram: `APP_ROUTES → Layout → RouteIcon/NavLink → CSS/tests`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| routeMetadata.ts | 15 routeと支出分析4タブのiconを含む正本 | AppRouteId/APP_ROUTES/ANALYSIS_TABS/SEARCH_ROUTES | frontend | web |
| pages/Analysis.tsx | 増減マトリクス・支出トレンド・統計診断をURL付きタブで束ねる画面 | AnalysisPage | frontend | web |
| RouteIcon.tsx | 装飾SVG描画 | RouteIconName | frontend | web |
| Layout.tsx | desktop/mobile/current | location+metadata | frontend | web |
| NavItem.tsx | nav1項目のicon+label(sidebar/tab共有) | NavItemProps | frontend | web |
| styles.css | spacing/selected/responsive/focus | CSS token/class | frontend | web |
| tests | 網羅/current/ARIA回帰 | Vitest/JSDOM | frontend | CI |

## Cross-cutting contracts

- Identity/access: `route.id/path/icon`はcompile-timeに網羅。
- Errors/resilience: metadata欠落はtestでfailしlabel fallbackを維持。
- Observability/audit: test outputとvisual screenshot。
- Configuration/secrets: 追加なし。
- Compatibility/versioning: public URLとroute countを維持。

## Subtype architecture

- Frontend: React component+CSS+Vitest/DOM/visual verification。
- Backend/Infrastructure/Data/Security: N/A。

## Architecture decisions

**ADRの正本は`arch-ui-navigation-experience`の「Architecture decisions」。** ここでは決定を再掲せず、各ADRが`packages/web`の実装境界に何を課すかだけを書く。

| 参照ADR | この境界での実装帰結 | 回帰を止める場所 |
|---|---|---|
| ADR-UI-001 (`end`によるcurrent一意化) | `NavItem.tsx`が全nav項目に`end`を適用し、currentは`aria-current="page"`だけで表す(`className`を関数で渡し`.active`の二重表現を作らない)。CSSで選択表示を隠す回避はしない | DOM testで`/tax`・`/tax/receipts`のcurrent数を固定 |
| ADR-UI-002 (型付きinline SVG) | `routeMetadata.ts`のicon keyを必須とし`RouteIcon.tsx`が網羅する。外部icon runtimeを追加しない | 型のexhaustive checkと19 icon(15 route+4タブ)のtest |
| ADR-UI-003 (見る群の統合) | 同じ判断のための切り口だった `/matrix` `/trends` `/diagnosis` を `/analysis/:tab` の1画面へ束ね、旧URLはredirectで残す | `display-contract.test.tsx`(route=15)、`route-task-detail.test.tsx`(タブの説明文を含む用語リンク総数)、`check-mobile-layout.mjs`(サイドバー総高) |
| ADR-UI-003 (inline disclosure既定) | `details`等の既存要素で段階表示し、遷移経路へmodalを挟まない | DOM testと実ブラウザ確認 |
| ADR-UI-004 (shared primitive優先) | `PageHeader`/`PageState`/`styles.css` tokenへ寄せ、画面ごとの独自実装を増やさない | lint/typecheckと差分review |

## Delivery, migration and rollback

- Build/deploy topology: pnpm workspace既存web test/build。
- Migration: regression test→metadata/component/CSS→全web/visual確認。
- Rollback: route/focus/mobile/cold-load/bundle契約回帰で差分rollback。

## Risks and verification

- Risk: APP_ROUTES型推論がmobile filterへ波及。既存contractで固定。
- Fitness test: 15 route/19 icon、unique id/path、tax exact match、/analysis は前方一致でcurrent、external dependencyなし。
- Validation: web unit/DOM/build、headless mobile、visual、secret scan。
