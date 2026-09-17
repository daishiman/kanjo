---
graph_node_id: "arch-trends-screen-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "推移画面 — React 画面・URL 状態・明細画面の絞込"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "frontend"]
file_path: "architecture/trends-screen-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "5f4e7cea1423f7049bc11f11acebc53f7cf91c3f0f8bea29d8646d85d0a7ab97"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "851fd5fe646985b855bc4003a77c28fa70a5031bd86ea4663b9dd08709356aff", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/analysis/Trends.tsx", "packages/web/src/pages/Classify.tsx", "packages/web/src/lib/api.ts", "packages/web/src/lib/charts.ts", "packages/web/src/lib/period.ts", "packages/web/src/components/Page.tsx", "packages/web/src/test-support/chart-test-doubles.tsx", "packages/web/scripts/check-financial-visuals.mjs"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G1", "G2", "G4"]
---

# Architecture overview

推移画面 — React 画面・URL 状態・明細画面の絞込。正本は `system-spec/frontend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-frontend-web-trends-observed-005 (初回期間と並べ替えの置き場所を確定。部品構成は observed-002/004 を継承)。packages/web は React 18 + react-router-dom 7 + TanStack Query 5 + chart.js 4 (react-chartjs-2)。実装後は `Trends.tsx` を取得と URL 同期に絞り、表示責務を `pages/analysis/trends/` に分割する。Classify.tsx は month・cls・category・payee を URL から読む。
- Quality attribute priorities: G1・G2・G4 に資する。doctrine は Clean Architecture: 画面は API の返却値と指標一覧を描くだけにし、指標 id の分岐を持たない (G2)。
- Constraints: C1: 集計を web に重複実装しない。C2: トークンと共通部品だけを使う。C4: 旧傾向判定の固有契約を維持する。

## Goals and non-goals

- Goals:
  - G1: 共通シェルを重複させず、問い→条件→KPI→推移と詳細→カテゴリ→要因→行動の読み順を作る。
  - G2: 指標の切替は API の metrics 一覧から描き、指標ごとの分岐を書かない。
  - G4: 条件を URL に保持し、/classify に category と payee の絞込を足す。
- Non-goals:
  - クライアント側での集計
  - 取引先の名寄せ
  - 推移専用の期間選択

## System context and boundaries

- Users/external systems: ブラウザの利用者。API は同じ Worker の /api/trends。
- Trust/deployment/data boundaries: web は表示と URL 状態だけを持つ。値は API の返却をそのまま使い、表示用の書式化 (円・率・符号) だけを行う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| TrendsPage | 条件の解決、取得、期間・URL 同期 | Trends.tsx | packages/web | Worker kanjo-console の静的アセット |
| ComparisonScreen | 読み順と各表示部品の配置 | trends/ComparisonScreen.tsx | packages/web | Worker kanjo-console の静的アセット |
| TrendSeriesPanel | 今回の収入棒・支出線・純収支線、選択指標の比較点線・月次差の棒・選択月の縦帯 | trends/TrendSeriesPanel.tsx + view-model.ts | packages/web | Worker kanjo-console の静的アセット |
| CategoryBreakdown | スパークライン付きの行と取引先の展開行。8見出しの並べ替えは `sortedRowsBy` で親カテゴリだけを並べ、展開行を親に付けて動かす | trends/CategoryBreakdown.tsx | packages/web | Worker kanjo-console の静的アセット |
| PeriodProvider | 保存値が無い初回だけ直近1年 (`INITIAL_SELECTION`)、壊れた保存値も直近1年、明示した全期間は復元 | period.tsx | packages/web | Worker kanjo-console の静的アセット |
| 表の並べ替え | 比較規則 (`sortedRowOrder` / `sortedRowsBy`) と見出し部品 (44px 以上のタップ領域・aria-sort) | table-sort.ts / components/SortableTableHeader.tsx | packages/web | Worker kanjo-console の静的アセット |
| ChangeFactors | 符号付き増減棒・絶対寄与の累計線・上位 3 | trends/ChangeFactors.tsx + view-model.ts | packages/web | Worker kanjo-console の静的アセット |
| ClassifyPage の絞込 | category と payee の初期値を URL から読む | Classify.tsx | packages/web | Worker kanjo-console の静的アセット |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: TanStack Query のキーは ['trends', 期間, scope, metric, compare, month, category, side, payee]。URL の読み書きは useSearchParams (react-router-use-search-params)。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

関数コンポーネントと hooks。混合チャートは chart.js の bar と line を 1 枚に重ねる (chartjs-mixed-chart)。

#### Routes, screens and navigation

/analysis/trends。『該当明細を開く』『増減の明細を確認』は、行の origin が mf なら navigate('/classify?' + 検索パラメータ)、freee なら navigate('/analysis/total-cashflow') で遷移する (qa-trends-decision-008)。要確認の注記のリンクも /analysis/total-cashflow を開く (qa-trends-decision-012)。

#### Component and design-system boundaries

PageShell・PageHeader・KpiCard・Button・FinancialFigure・DataTable・SegmentSwitch・DetailPane・自作 SVG スパークラインを再利用する。

#### State and data flow

URL → 条件 → useQuery → 描画。期間は usePeriod (span/from/to) で、初回の既定値は PeriodProvider だけが持つ (画面ごとに持たない)。並べ替えの状態は表ごとのローカル state で、URL には載せない。選択月が期間外になったら API の最も変化が大きい月へ戻し URL を置き換える (replace)。

#### Backend integration

`api.ts` の `getTrends` が型付きで呼ぶ。形式違反の条件は API が既定値へ倒して selection に返すので、画面は selection で URL を置き換える。400 は未登録 metric だけ。応答は review・judgementBasis・`selection.side` と、detail.sources の account が null の行を型に含める。

#### Performance and observability

placeholderData で直前の値を残す。チャートの再生成を条件変更時だけに限る。

#### Frontend verification

DOM テストは chart props を捕捉し、収入・支出・純収支、比較点線、月次差、選択帯、パレートの符号と絶対累計を意味で確認する。視覚は headless Chrome で主要 2 図の名前、重複図の不在、横はみ出しを確認する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-FE-1 | 条件は URL を正本にする | 根拠と比較案は qa-trends-decision-005 と G4 を参照 | qa-trends-decision-005 と G4 の判断に従う | 本書の該当節に反映済み |
| ADR-FE-2 | 指標の切替は API の一覧から描く | 根拠と比較案は qa-trends-decision-003 を参照 | qa-trends-decision-003 の判断に従う | 本書の該当節に反映済み |
| ADR-FE-3 | /classify の取引先は専用の payee パラメータで明細の内容と完全一致で絞る | 根拠と比較案は qa-trends-decision-004 と qa-trends-decision-011 を参照 | qa-trends-decision-004 と qa-trends-decision-011 の判断に従う | 本書の該当節に反映済み |
| ADR-FE-4 | freee 由来の行は総収支画面を開く | 根拠と比較案は qa-trends-decision-008 を参照 | qa-trends-decision-008 の判断に従う | 本書の該当節に反映済み |
| ADR-FE-5 | 要確認の件数と金額は API の review をそのまま描く | 根拠と比較案は qa-trends-decision-012 / dec-trends-review-rows-001 を参照 | qa-trends-decision-012 / dec-trends-review-rows-001 の判断に従う | 本書の該当節に反映済み |
| ADR-FE-6 | 口座が null の出典は『—』と表示し口座で絞らない | 根拠と比較案は qa-trends-decision-014 を参照 | qa-trends-decision-014 の判断に従う | 本書の該当節に反映済み |
| ADR-FE-7 | 並べ替えの比較規則は table-sort.ts、見出しは SortableTableHeader に一本化し、生の table は data-table-kind を宣言する | 画面ごとの独自ソート | qa-frontend-web-trends-observed-005 に従い、table-sort-coverage.test.ts が静的に監査する | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: web と api は同じ Worker で同時に配信する。旧応答のフィールドも残るため、配信順のずれで画面が壊れない。戻すときは前の版へ戻す。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: URL と画面状態の不一致 → 対策: URL 復元の DOM テストで固定する
- Risk/assumption: /classify の既存の絞込との干渉 → 対策: month・cls と組み合わせたテストを足す
- Risk/assumption: チャートの描画崩れ → 対策: 視覚検査で確認する
- Architecture fitness test: DOM テストは chart props と URL の `category + side`、初回期間の既定値 (period-picker.dom.test.tsx)、8列の3状態ソートを確認する。table-sort-coverage.test.ts が生の table の種別宣言を監査する。視覚は主要 2 図の名前と閉じた旧傾向判定が chart を mount しないことを確認する。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
