---
graph_node_id: "arch-mobile-financial-experience"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "モバイル財務情報の体験アーキテクチャ"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["apple-hig", "information-design", "mobile", "accessibility"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T09:25:39Z"
updated_at: "2026-08-30T09:25:39Z"
depends_on: []
related_nodes: ["spec-mobile-financial-visualization", "arch-mobile-financial-frontend"]
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
file_path: "architecture/arch-mobile-financial-experience.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"c696b95ff559b83fa398a97aa132d1381b1cf175ce6a72763026dae29d7bdb97"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/ui-ux.md","source_version":"0.1.11","source_digest":"c696b95ff559b83fa398a97aa132d1381b1cf175ce6a72763026dae29d7bdb97","imported_at":"2026-08-30T09:25:39Z"}
classification_confidence: 1.0
classification_reason: "C19 spec dispatchがconfirmed UI-UX章をfrontend experience architectureとして一意に分類した。"
classification_candidates: [{"artifact_kind":"architecture","confidence":1.0,"candidate_path":"architecture/arch-mobile-financial-experience.md"},{"artifact_kind":"specification","confidence":0.1,"candidate_path":"specs/mobile-financial-experience.md"}]
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

モバイルの財務情報を「結論→文脈→詳細」の順へ再構成し、視覚chartとsemantic表を同じ意味modelへ接続する。Apple HIGの単純・一貫・適応的なlayoutと、WCAG 2.2のreflow/keyboard/focusをKanjoのWeb契約へ写像する。

## Context and drivers

- Business/technical context: 移動中の短時間・片手操作で、収支の変化・異常・次の確認先を判断する。
- Quality attribute priorities: 情報欠落ゼロ、認知負荷、accessibility、一貫性、可逆性。
- Constraints: 会計値・API・認証・routeを変えず、実データをテストへ含めない。

## Goals and non-goals

- Goals: どのviewport・操作方式でも同じ財務上の結論へ到達させる。
- Non-goals: Apple外観の模倣、装飾目的animation、ネイティブアプリ化、会計ロジック変更。

## System context and boundaries

- Users/external systems: Kanjo利用者、支援技術、React Router、Chart.js。
- Trust/deployment/data boundaries: browser表示層内。API/session/tenant/D1/R2境界は不変。
- Context diagram: `existing API result → financial view-model → summary + chart + semantic table → user/assistive technology`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| information priority contract | 結論・期間・単位・異常・行動・詳細の順を固定 | page/figure metadata | Web client | web bundle |
| financial view-model | chartと意味表現の単一入力 | labels/series/unit/period/summary/rows | Web client | web bundle |
| disclosure surface | 詳細値を必要時だけ開示 | semantic HTML | Web client | web bundle |

## Cross-cutting contracts

- Identity/access: 既存route/session/owner境界を維持する。
- Errors/resilience: canvas失敗でも要約と表を残し、空白を成功扱いしない。
- Observability/audit: viewport別の実描画寸法と意味情報を匿名fixtureで検査する。
- Configuration/secrets: 追加なし。secretをclient/fixtureへ含めない。
- Compatibility/versioning: desktopの意味情報と既存API型を維持する。

## Subtype architecture

- Frontend: 本書の体験契約を `arch-mobile-financial-frontend` のcomponent/Chart.js境界へ接続する。
- Backend: N/A: 既存APIを変更しない。
- Infrastructure: N/A: 既存Cloudflare構成を変更しない。
- Data: N/A: 永続modelと会計計算を変更しない。
- Security: N/A: 既存認証認可・tenant境界を変更しない。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-MOB-001 | chartを隠さず、同じview-modelの要約と表を常設する | 狭幅でchartを削除、別計算のmobile専用UI | 情報同等性と保守性を優先 | DOM量は増えるが認知順と段階表示で抑える |
| ADR-MOB-002 | 44 CSS pxをcoarse pointer主要操作の下限にする | WCAG 24pxのみ、全端末44px | Appleのtouch慣習と既存desktop密度を両立 | pointer/viewport条件の回帰検査が必要 |
| ADR-MOB-003 | ページ横overflowは禁止し、高密度表だけ局所scrollを許可 | 全体scroll、全表カード化 | 文脈喪失を防ぎつつ原値一覧を保持 | scroll containerの見出し/edge affordanceが必要 |

## Delivery, migration and rollback

- Build/deploy topology: 既存Web bundleだけを更新する。
- Migration sequence: inventory→共通view-model/container→page適用→実描画回帰。
- Rollback trigger/procedure: figure欠落、意味情報不一致、横overflow、keyboard回帰のいずれかで変更surfaceを戻す。

## Risks and verification

- Risk/assumption: 情報削減が会計文脈を失わせる。期間・単位・符号・比較基準のDOM contractで防ぐ。
- Architecture fitness test: figure可視数、semantic companion、document overflow、44px target、safe-area遮蔽を実Chromeで測る。
- Load/failure/security validation: 大量series、empty/error、200% zoom、reduced-motion、匿名fixture、機微情報guardを検証する。

## Rendering and application pattern

- Pattern: React 18 SPAの既存route/component構成を維持する。
- Framework/runtime and selection rationale: Chart.js 4/react-chartjs-2を継続し追加runtimeを避ける。
- Browser/device support: 360/375/390px mobile、tablet、desktop、200%相当zoom。

## Routes, screens and navigation

- Route/screen map: 全既存routeをinventoryし、財務figureを持つ単位へ横断適用する。
- Authentication guard/deep link/history: 既存route metadataとsession guardを維持する。

## Component and design-system boundaries

- Component hierarchy: page→figure→summary/chart/semantic details。pageごとの二重実装を避ける。
- Design tokens/reusable primitives: spacing、min-height、touch target、safe-areaを既存tokenへ集約する。
- Accessibility standard: WCAG 2.2 AA相当、Apple HIG touch/layoutをWeb契約へ具体化する。

## State and data flow

- Local/server/global state ownership: server dataは既存query、表示派生はpure view-model、展開状態だけlocal。
- Fetch/cache/invalidation/optimistic update: 既存React Query契約を維持する。
- Form/validation/error presentation: 表示改善に限定し、既存mutation/error contractを維持する。

## Backend integration

- API client/generated types/versioning: 既存型・endpointを変更しない。
- Auth/session/CSRF/CORS: 既存境界を維持する。
- Offline/retry/timeout: 既存PageStateを使い、chartだけの失敗で意味情報を消さない。

## Performance and observability

- Bundle/render/Core Web Vitals budgets: 外部依存0、非表示chartの同時renderを避け、既存budgetを維持する。
- Client logs/metrics/traces and privacy: 匿名テストの実測だけを保存し、財務値をログへ出さない。

## Frontend verification

- Unit/component/visual/e2e/accessibility: view-model unit、semantic DOM、build、desktop/mobile実Chrome、zoom/keyboard/reduced-motionを通す。
