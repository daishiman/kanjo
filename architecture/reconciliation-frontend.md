---
graph_node_id: "arch-reconciliation-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "照合画面 — 3 カラム画面の状態・クエリ無効化・アイコン登録"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "frontend"]
file_path: "architecture/reconciliation-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fa73d81d52841cb01432498c3c1de96af84115861e0f21c1b1a8e09bafaf158a"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "fa73d81d52841cb01432498c3c1de96af84115861e0f21c1b1a8e09bafaf158a", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/web/src/AuthenticatedApp.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/pages/Analysis.tsx", "packages/web/src/pages/analysis/Reconciliation.tsx", "packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/components/RouteIcon.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/styles.css", "packages/core/src/design-tokens.ts"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G1", "G4", "G5"]
---

# Architecture overview

照合画面 — 3 カラム画面の状態・クエリ無効化・アイコン登録。`system-spec/frontend.md` は承認時入力、本書は frontend 制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: ルートは /analysis/:tab (AuthenticatedApp.tsx:50) → pages/Analysis.tsx → pages/analysis/Reconciliation.tsx。データ取得は TanStack Query 5 の useQuery で GET /api/business-spend の 1 本、スタイルは styles.css:1025-1121。再利用できる部品は DataTable・PageState (読込/空/失敗)・KpiCard・ConfirmDialog・共通 Button (素の button は DOM テストで落ちる)・ANALYSIS_HUB_ICONS、総収支 TotalCashflow.tsx の一括選択バー・useMutation・相手選択ラジオ・除外の復元。トークン正本は packages/core/src/design-tokens.ts。アイコンは components/RouteIcon.tsx に lucide-static v1.37.0 の SVG を 27 個自前登録し、search・download・circle-help・check・undo-2・funnel・x・chevron-down/left/right・shield-check・wallet・file-pen・external-link・lock・cloud・message-circle・circle 等が未登録。Layout.tsx は summary・imports・analysis hub の 3 クエリを持ち、改善要望は lazy の ImprovementRequestButton と /improvement 画面がある (qa-frontend-web-rc-observed-001)。
- Quality attribute priorities: G1・G4・G5 に資する。Clean Architecture の依存方向で web は照合の規則を持たず API の結果を描く。Information Design の『同じ件数を複数箇所に出すときは 1 つの正本から描く』を queryKey の無効化で守る。
- Constraints: C1 (React 18 + react-router-dom 7 + TanStack Query 5)、C2 (トークン・共通 Button・PageShell・--aside-panel-w、lucide-static 由来の SVG を自前登録、WCAG 2.2 AA)、C3 (表示していないタブの API は呼ばない・タブ状態は URL・期間は全画面共有)。

## Goals and non-goals

- Goals:
  - G1: Reconciliation.tsx を 3 カラム (絞り込み+対応キュー / 候補一覧 / 詳細パネル) と KPI 4 枚・下段プレビュー・選択中バーに作り直し、6 状態 (理想/空/読込/部分/失敗/低速) と操作結果を持つ。
  - G4: 共通シェル (サイドバー文言・グループ・件数バッジ、月次クローズ 3/4、ヘッダー、フッター、改善を送る) を全て今回直す (qa-reconciliation-decision-001)。
  - G5: 画像のアイコンを RouteIcon に登録して各箇所で表示し、重複検査を維持する。
- Non-goals:
  - web 側での一致度・ステータスの再計算
  - 検索語・絞り込みの URL 保持
  - 外部アイコンライブラリの追加

## System context and boundaries

- Users/external systems: 利用者 1 名。呼ぶ API は GET /api/reconciliation・POST actions / undo・月次レビュー API と共通シェルの既存クエリ。
- Trust/deployment/data boundaries: 画面は AuthenticatedApp の共通シェル内。検索語と絞り込みは web の状態に留める。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Reconciliation.tsx | 3 カラム・KPI・`mfOnly`/`reviewRows` プレビュー・選択中バーを API 応答から描く | React コンポーネント | packages/web | web ビルド |
| 照合の mutation | actions / undo を呼び、成功後に関連 queryKey を invalidate する | useMutation | packages/web | web ビルド |
| Layout.tsx (共通シェル) | サイドバー文言・グループ・件数バッジ・月次クローズ 3/4・ヘッダー・フッター・改善を送る | React コンポーネント | packages/web | web ビルド |
| routeMetadata.ts | ラベル・グループ・パンくず・コマンドパレットの正本 | 静的定義 | packages/web | web ビルド |
| RouteIcon.tsx | lucide-static 由来の SVG 登録表 | React コンポーネント | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 認証済みシェル内でだけ描く。
- Errors/resilience: PageState で読込/空/失敗、一括の部分成功の内訳、409 は『取込中のため保存できませんでした』と再試行。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: /analysis/:tab と旧 URL を維持する。サイドバー文言変更に伴い既存 DOM テストを更新する。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

既存 SPA の共通シェル内に PageShell で描く。右パネルは --aside-panel-w。狭幅では 3 カラムを縦積みにする。

#### Routes, screens and navigation

/analysis/reconciliation (/analysis/:tab)。タブ状態は URL。パンくず・ページ見出し・コマンドパレットは routeMetadata のラベルに追随する。

#### Component and design-system boundaries

DataTable・PageState・KpiCard・ConfirmDialog・共通 Button・ANALYSIS_HUB_ICONS を再利用し、総収支の一括選択バーの実装を参照する。色は design-tokens.ts 由来のトークンだけ。アイコンは RouteIcon に lucide-static 由来の SVG を追加登録し、route-icon-distinct.test.tsx で絵柄の重複を検査する。

#### State and data flow

GET /api/reconciliation は全期間で照合した後の期間投影を返す。web は状態・`actionRequiredCount` を再計算せず描画し、`reviewRows` は返却済み `rows` の review 行から表示する。検索・局所絞り込み・ページはコンポーネント状態、選択中 id は MF tx id で持つ。

#### Backend integration

照合画面は GET /api/reconciliation の結果を描き、一致度やステータスを再計算しない。書込後は ['reconciliation', period]・analysisHubQueryKey・['total-cashflow', period]・['summary', period] を invalidate し、ハブ・サイドバーのバッジ・総収支を追随させる。

#### Performance and observability

表示していないタブの API は呼ばない (C3)。候補の絞り込み・ページ送りはクライアント側で行い、再取得しない。

#### Frontend verification

reconciliation.dom.test.tsx で 3 列・KPI・キュー・候補一覧・詳細・下段プレビュー・選択中バーと 6 状態を検証する。下段右が `unmatchedFreee` ではなく `reviewRows` であること、狭幅で情報を減らしても主要操作が残ることも固定する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-reconciliation-decision-001 | 共通シェルの差分を全て今回直す | 照合ページ本体だけ / アイコンと文言だけ | 画像との差を一度に解消する | 全 20 画面に波及し shell 系テストを更新する |
| qa-ui-ux-web-rc-decision-006 | 候補一覧と詳細が主役、狭幅は縦積みで絞り込みを折りたたむ | KPI が主役 / 差を付けない | 誤照合の失敗コストが最も高い | 狭幅で行選択時に詳細へスクロール移動する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルドを Worker の ASSETS で配信する。
- Migration sequence: RouteIcon へのアイコン登録 → routeMetadata と共通シェル → 照合画面の 3 カラムと状態 → mutation と invalidate → DOM テスト更新。
- Rollback trigger/procedure: DOM テスト・check 系が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 状態の持ち方と invalidate 対象はアシスタントの推定 (inference-002)。RouteIcon の登録元は lucide-static v1.37.0 で、出典の最新確認は 1.46.0。
- Architecture fitness test: web に一致度・ステータスの計算が無いこと。検索語がネットワーク要求・URL に現れないこと。
- Load/failure/security validation: 狭幅で 3 カラムが縦積みになり横スクロールしない (S6)。
