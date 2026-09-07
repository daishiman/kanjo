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
updated_at: "2026-09-07T13:55:37Z"
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

- Business/technical context: 15 routeと支出分析5タブの文字ナビで現在地が弱く、親子routeが同時activeになる。加えて、タブはサイドバーに出ておらず、利用者が行き先を見つけられなかった(2026-09-07)。
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
| ConfirmDialog / usePendingConfirm | 破壊的操作の確認の正本(`<dialog>`・focus・busy中の閉じ抑止・続きの操作の保持) | `{ dialog, title, confirmLabel, busyLabel, onConfirm, onDismiss }` / `usePendingConfirm<T>()` | Web client | web bundle | 実装済(`packages/web/src/components/ConfirmDialog.tsx`)。`window.confirm`は使わない(ADR-UI-007) |

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
| ADR-UI-005 (2026-09-07) | 支出分析の5タブをサイドバーへ**常時展開**した子行として出す | (a) 親クリックで開閉するdisclosure、(b) タブを親から辿らせる現状維持、(c) 5タブを最上位routeへ昇格 | (b)は行き先の存在自体が画面外にあり、実際に利用者が到達できなかった。(a)は畳んだ状態が既定になると同じ問題が残り、状態の永続先という新たな判断も生む。(c)は最上位の選択肢を15→20に戻し、ADR-UI-003が減らした認知負荷を打ち消す。常時展開は高さを増やすが、行き先が見えることを優先した | サイドバーが約140px高くなる。将来ANALYSIS_TABSが増えるとさらに伸びるため、群の折りたたみが次の検討事項になる |
| ADR-UI-006 (2026-09-07) | `/analysis/:tab`のcurrentは子行だけに立て、親「支出分析」には立てない | 親子ともにcurrent、親だけcurrent | ADR-UI-001と同じ原則。親子が同時にcurrentだと現在地が2件になり、「currentは1件以下」というfitness testも破れる | 親routeは`end`を子の有無で切り替える。nested tabを持つrouteを追加するときは同じ扱いが要る |
| ADR-UI-007 (2026-09-07) | 破壊的操作の確認をアプリ内`<dialog>`で行い`window.confirm`を使わない | window.confirm継続、確認なしでundoを用意 | `window.confirm`はブラウザの抑止(「このページでこれ以上ダイアログを表示しない」)が効くと即`false`を返し、呼び出し側は抑止と拒否を区別できない。押しても無反応なボタンになり理由も画面に出ない。undo方式は削除済みデータの保持が要り、データ境界を変える | 確認文言がテスト契約の一部になる。共有部品`ConfirmDialog`/`usePendingConfirm`が正本で、確認を要する新操作はここへ寄せる |

## Delivery, migration and rollback

- Build/deploy topology: 既存web build。
- Migration sequence: metadata→shared component→layout→high-density/edit surface→tests。
- Rollback: current複数、keyboard回帰、主要情報消失で共通UI差分を戻す。

## Risks and verification

- Risk: 似たiconで識別性が下がる。route固有glyphとlabel併記をreview。
- Architecture fitness test: route=15(+支出分析の5タブ)、icon exhaustive、current≤1(タブ配下では子1件)、external icon dependency=0、破壊的操作での`window.confirm`呼出=0。
- Validation: bundle差分、200% zoom、mobile drawer、keyboard/focus、reduced motion。
