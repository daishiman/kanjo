---
graph_node_id: "arch-household-cashflow-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "家計収支 — pages/household への分割とサーバ状態・URL 状態の分離"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "frontend"]
file_path: "architecture/household-cashflow-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fd7bf9ce3e6ed5e891d35f44afbfff54b5f0d4be5afb2295ae1a9fbbbab21493"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "6dac265091684f5892afc368f27a7fbcdb0c9bbc4f69109a47eea70afaeb6dff", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["packages/web/src/pages/household/", "packages/web/src/pages/Household.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/figure-guides.ts", "packages/web/src/glossary.ts", "packages/web/src/period.tsx", "packages/web/src/components/charts.ts", "packages/web/src/api.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G1", "G3", "G4"]
---

# Architecture overview

家計収支 — pages/household への分割とサーバ状態・URL 状態の分離。`system-spec/frontend.md` は承認時入力、本書は web の部品分割・状態・取得の制約を持つ。文言・数値・データ契約の正本は `specs/spec-household-cashflow-screen.md`。

## Context and drivers

- Business/technical context: `packages/web/src/pages/Household.tsx` は 657 行の 1 ファイルで、`routeMetadata.ts:68-79` の `/household` はラベル『累計収支』・グループ『整える』(`Layout.tsx:57`)。共通部品は `components/Page.tsx` の PageShell / PageHeader / PageState / KpiCard / PageActions、`period.tsx` の usePeriod / PeriodPicker、`FinancialFigure` がある。下部の選択中バーは共通化されておらず、`trends/ComparisonScreen.tsx:51` と `TotalCashflow.tsx:1089` に個別実装がある。推移は `pages/analysis/trends/`、マトリックスは `pages/analysis/matrix/` へ分割した前例がある (qa-household-frontend-web-evidence-001)。
- Quality attribute priorities: G1・G3・G4 に資する。Apple HIG (表示の共通部品を使う) と Clean Architecture の Dependency Rule (サーバ状態と画面状態を分ける) を適用する。
- Constraints: React 18 + react-router-dom + TanStack Query。色は design-tokens のトークンだけ (直書き色は lint の check-design-tokens で落ちる)。ページは遅延読み込みのまま初期 JS 予算 (CI 実測) を超えない。

## Goals and non-goals

- Goals:
  - G1: `Household.tsx` を `packages/web/src/pages/household/` へ分割し、画像の構成に作り直す。ナビ・パンくず・`figure-guides.ts`・用語集を『家計収支』へ合わせる。
  - G3: カテゴリ詳細を `cat` と `month` が決まったときだけ取得する dependent query にする。
  - G4: 名義ラベル編集ダイアログを useMutation で保存し、名義の表示を core の `ownerLabel` だけに通す。
- Non-goals:
  - 下部の選択中バーの共通部品化 (既存の個別実装の規約に合わせるに留める)
  - 画面側での集計・率・構成比の再計算
  - 新しいチャートライブラリの追加

## System context and boundaries

- Users/external systems: 利用者のブラウザ。取得先は同一オリジンの `/api/household`・`/api/household/category`・`/api/settings/owner-labels`。
- Trust/deployment/data boundaries: web は集計規則と名義の解決規則を持たない。表示名はサーバが付けた `label` を描く。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 画面の親 | PageShell / PageState、URL 状態 (`seg` / `month` / `cat`) の読み書き、本体クエリ | ルート要素 | packages/web | web ビルド (遅延読み込み) |
| KPI と前年より | KpiCard 3 枚と前年差カード | props | packages/web | web ビルド |
| 推移チャートと事業・個人の等式 | FinancialFigure と `charts.ts` の系列色、タブ・月送り・前年点線 | props | packages/web | web ビルド |
| カテゴリ表と詳細パネル | 6 区分の表、選択時に取得する詳細 (dependent query) | props + query | packages/web | web ビルド |
| 名義別収入と振替一覧 | サーバが返した表示名で描く | props | packages/web | web ビルド |
| 名義ラベル編集ダイアログ | GET / PUT `/api/settings/owner-labels`、フィールドエラー、成功時の無効化 | useMutation | packages/web | web ビルド |
| 前年との比較と下部バー | 決定論の文章を描く、選択月と純収支と明細導線 | props | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 認証済みシェル内の画面で、401 は既存の取得層の扱いに従う (`architecture/household-cashflow-auth.md`)。
- Errors/resilience: 本体は PageState error と再試行、詳細パネルと名義ラベル保存の失敗はカード内のインライン表示。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: `OWNER_LABEL` の直参照を残さない (家計・設定・明細の名義表示は `ownerLabel` 経由)。期間は既存 `usePeriod` / localStorage を引き継ぎ、ブラウザ URL に期間パラメータを複製しない。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/household-cashflow-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外 (`architecture/household-cashflow-security.md`)

### Frontend architecture

#### Rendering and application pattern

SPA のクライアント描画。ページは既存と同じく遅延読み込みのルートとして配信し、初期 JS 予算に含めない。分割は推移・マトリックスの前例に倣い、画面の親とカード単位の部品に分ける。

#### Routes, screens and navigation

`/household` のまま。`routeMetadata.ts` の名称を『家計収支』へ改め、グループは『整える』。`figure-guides.ts` と用語集 (`glossary.ts`) の記述を合わせる。遷移先 URL の組み立て規則の正本は `specs/spec-household-cashflow-screen.md` §5.3 / §6.2 / §8。

#### Component and design-system boundaries

ページの枠は PageShell / PageState、KPI は KpiCard、グラフは FinancialFigure と `charts.ts` の系列色、ボタンは共通 Button。下部の選択中バーは総収支と推移の個別実装と同じ見た目の規約に合わせる。直書き色を置かない。

#### State and data flow

サーバ状態 (家計の本体・区分詳細・名義ラベル) はすべて TanStack Query で持つ。表示選択 (`seg` / `month` / `cat`) は `useSearchParams` で URL の状態として持ち、コンポーネント内に複製しない。期間の正本は既存 `usePeriod` / localStorage。名義ラベルの保存成功時に家計・設定・明細のクエリを無効化して再取得する。

#### Backend integration

本体は `GET /api/household` を 1 回取得する。カテゴリ詳細は `cat` と `month` が決まったときだけ `GET /api/household/category` を取得する (`cat=none` では取得しない)。応答の形の正本は `specs/spec-household-cashflow-screen.md` §11.1〜§11.3。

#### Performance and observability

詳細を本体レスポンスに入れず選択時に取得することで初期表示を軽くする。ページは遅延読み込みのまま、初期 JS 予算は CI の実測値で守る。

#### Frontend verification

O1 の DOM テスト (全構成要素と読込・空・失敗。振替のみ・除外行のみも空)。O3 の DOM テスト (行の選択で詳細が開き、`current`=期間合計、`monthTotal`=選択月合計、`transactions`=最大 5 件プレビューが分離され、カテゴリのすべて見るが絞った URL へ遷移する)。選択月の振替全件 (抜粋なし) がカード内に出て振替用のすべて見るが無いこと。URL の `seg` / `month` / `cat` と localStorage の期間がリロードで復元すること。名義ラベル保存後に家計・設定・明細の表示名が再取得されること。lint (check-design-tokens) と初期 JS 予算の検査が緑。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-household-frontend-web-001 | `Household.tsx` を `pages/household/` 配下へ分割する | 1 ファイルのまま拡張 | 推移・マトリックスの前例と揃い、カード単位でテストできる | 旧ファイルの参照を付け替える |
| qa-household-frontend-web-001 | 選択は URL、サーバ由来の値は TanStack Query に分ける | コンポーネント内 state に複製 | リロードで復元でき、取得の再試行と無効化を 1 か所で扱える | URL の既定値の解決を画面の親に置く |
| qa-household-frontend-web-001 | カテゴリ詳細は dependent query で選択時に取得 | 本体レスポンスに全区分の詳細を含める | 初期表示が軽く、失敗をパネル内に閉じられる | 選択のたびに往復が 1 回増える |
| dec-household-owner-model | 名義の表示は `ownerLabel` とサーバの `label` だけを通す | `OWNER_LABEL` の直参照を残す | 表示名の変更が家計・設定・明細へ一斉に効く | 保存後に 3 画面のクエリを無効化する |
| dec-household-nav-name | ナビの名称を『家計収支』へ改める | 『累計収支』を残し新画面を足す | 画面を 1 つに保ち、画像の見出しと一致する | `figure-guides.ts` と用語集も同時に直す |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド (遅延読み込みのルート)。
- Migration sequence: `pages/household/` の骨格と URL 状態 → 本体クエリと KPI・推移 → カテゴリ表と詳細の dependent query → 名義・振替 → 名義ラベルダイアログと無効化 → 前年との比較・下部バー → ナビ・`figure-guides.ts`・用語集 → 旧 `Household.tsx` の削除。
- Rollback trigger/procedure: DOM テスト・lint・初期 JS 予算の検査が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 下部バーが共通化されていないため、見た目が他画面とずれうる。既存 2 実装の規約に合わせ、design-system:fast の既存 DOM テストを緑に保つ。
- Architecture fitness test: web に `OWNER_LABEL` の直参照が無いこと。web に集計・率の計算が無いこと。直書き色が 0 件であること。
- Load/failure/security validation: 詳細取得の失敗で画面全体が失敗にならないこと。初期 JS 予算を超えないこと。
