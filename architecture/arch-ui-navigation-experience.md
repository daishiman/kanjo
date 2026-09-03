---
graph_node_id: "arch-ui-navigation-experience"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "ナビゲーションと情報階層の体験設計"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
owners: []
tags: ["apple-hig", "information-design", "accessibility"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-29T15:30:44Z"
updated_at: "2026-08-29T15:30:44Z"
depends_on: []
related_nodes: ["spec-ui-navigation-cognitive-load", "arch-ui-navigation-frontend"]
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
file_path: "architecture/arch-ui-navigation-experience.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-findings.json","evaluated_digest":"bb1eff33a99062961917de36cfb36f2acb7e8bede6cf315cdfe0e3be3e2f19c7"}
source_lineage: {"origin_kind":"system-spec-harness","source_plugin":"system-spec-harness","source_path":"system-spec/ui-ux.md","source_version":"0.1.12","source_digest":"bb1eff33a99062961917de36cfb36f2acb7e8bede6cf315cdfe0e3be3e2f19c7","imported_at":"2026-08-29T15:30:44Z"}
classification_confidence: 1.0
classification_reason: "C19 spec dispatchがconfirmed UI-UX章をfrontend architectureとして取り込んだため分類は一意。"
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

> このfeatureのarchitectureは2本に分かれる。本書(`arch-ui-navigation-experience`)は**体験の要求と決定**を扱いADRの正本を持つ。`arch-ui-navigation-frontend`は**`packages/web`の実装境界と回帰防止**を扱う。決定を変えるときは本書を直し、frontend側は帰結だけ追随させる。

## Context and drivers

- Business/technical context: 15 routeと支出分析4タブの文字ナビで現在地が弱く、親子routeが同時activeになる。
- Quality priorities: learnability、accessibility、predictability、bundle size、route互換。
- Constraints: labelを残す、税務警告を隠さない、通常遷移へmodalを挟まない、外部icon runtimeを追加しない。

## Goals and non-goals

- Goals: currentを一意にし、icon・label・spacingで探索を速め、情報と編集操作を段階表示する。
- Non-goals: Apple外観の模倣、装飾目的animation、会計/API/data変更。

## System context and boundaries

- Users/external systems: Kanjo利用者、React Router、支援技術。
- Trust/deployment/data boundaries: Web bundle内だけ。永続データ境界は不変。
- Context diagram: `routeMetadata → Layout(→NavItem) → sidebar + mobile drawer/tabbar`。`NavItem`は`Layout`から抽出済みで、sidebarとtabbarが`variant`だけ変えて同じ構造を共有する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit | 実装状況 |
|---|---|---|---|---|---|
| routeMetadata | route/group/label/icon正本 | `APP_ROUTES` | Web client | web bundle | 実装済 |
| RouteIcon | 型付きinline SVG | `{ name: RouteIconName }` | Web client | web bundle | 実装済(寸法はCSS tokenで決めるため`size` propは持たない) |
| Layout | 厳密current、ARIA、spacing | pathname+metadata | Web client | web bundle | 実装済 |
| NavItem | 1 nav項目のicon+label+current表現 | `{ to, icon, label, variant }`(`variant`は`'sidebar' \| 'tab'`) | Web client | web bundle | 実装済(`packages/web/src/components/NavItem.tsx`)。currentは`aria-current="page"`だけで表し、`end`はNavItemが一律に適用する |
| disclosure/edit surface | 段階表示と安全状態 | details/drawer/dialog | Web client | web bundle | 実装済 |

## Cross-cutting contracts

- Identity/access: route pathをidentityとしcurrentは1件以下。
- Errors/resilience: iconなしでもlabelが残り保存失敗は対象と再試行を表示。
- Observability/audit: DOM contractとvisual evidence。
- Configuration/secrets: 追加なし。
- Compatibility/versioning: 既存route path/label/lazy loadingを維持。

## Subtype architecture

- Frontend: metadata-driven navigation、inline SVG registry、shared UX primitives。
- Backend/Infrastructure/Data/Security: N/A。各境界を変更しない。

## Architecture decisions

**このfeatureのADR正本はこの表とする。** `arch-ui-navigation-frontend`は同じ決定を再掲せず、実装上の帰結だけを書いてここを参照する。

| ADR | Decision | Alternatives | Trade-off rationale | Consequences |
|---|---|---|---|---|
| ADR-UI-001 | `/tax`へ`end`を適用しcurrentを1件以下にする | prefix一致、CSSで親の選択表示を隠す | Router標準ARIAと一貫し、DOM/ARIAの実状態を正す | nested追加時はmetadataとLayoutを更新 |
| ADR-UI-002 | 型付きinline SVGをmetadataのicon keyから必須で描く | icon package、emoji、labelからの推測 | 外部依存と字体差を回避し、欠落をtype/testで検出できる | icon registryとmetadata差分の保守が必要 |
| ADR-UI-003 | inline disclosureを既定にする | 全詳細をmodalで出す | 文脈を保ち通常遷移を遮らない | surfaceの適否reviewが必要 |
| ADR-UI-004 | 既存のshared primitiveへ寄せて段階的に追補する | 全画面rewrite | 変更範囲と利用者の再学習コストを抑える | 画面ごとの追補が残る |

## Delivery, migration and rollback

- Build/deploy topology: 既存web build。
- Migration sequence: metadata→shared component→layout→high-density/edit surface→tests。
- Rollback: current複数、keyboard回帰、主要情報消失で共通UI差分を戻す。

## Risks and verification

- Risk: 似たiconで識別性が下がる。route固有glyphとlabel併記をreview。
- Architecture fitness test: route=15(+支出分析の4タブ)、icon exhaustive、current≤1、external icon dependency=0。
- Validation: bundle差分、200% zoom、mobile drawer、keyboard/focus、reduced motion。
