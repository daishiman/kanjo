---
graph_node_id: "arch-trends-screen-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "推移画面 — 画面構成と情報の優先順位"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "ui-ux"]
file_path: "architecture/trends-screen-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2aff85c9bd8fecec74b9336f8c9f1fcef9ff6108694c9fc32537facd1c88c7a1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "df9c1fc1cd967d0ec23330dad3158f44b6673c5dea5d60aded1a566da392eb72", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/analysis/Trends.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/lib/charts.ts", "packages/web/src/styles", "design/FINAL-UI/images/07-trends.png"]
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
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G1", "G4", "G5"]
---

# Architecture overview

推移画面 — 画面構成と情報の優先順位。正本は `system-spec/ui-ux.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-ui-ux-web-trends-observed-005 (初回の期間と8列の並べ替えを確定。画面構成は observed-002/004 を継承)。design/FINAL-UI/images/07-trends.png の構成を正とし、AUDIT.md の『比較条件をヘッダー直下へ集約』に従う。月次の振り返りで頻度が高く誤読の損失が大きいのは『どの月にいくら変わったか』と『その原因』なので、KPI と選択月の詳細を最上位に置き、既存の手を打つ順番は開閉式の根拠へ下げる (qa-trends-decision-001)。
- Quality attribute priorities: G1・G4・G5 に資する。doctrine は Apple HIG の明瞭さと階層: 問い→条件→答え (KPI)→根拠 (チャート・表)→行動 (明細へ) の順に並べる。WCAG 2.2 AA を維持し、増減は符号と文字を併記して色だけに頼らない (wcag22-use-of-color)。
- Constraints: C2: docs/design-system.md のトークン・共通 Button・PageShell だけを使う。C4: 旧 /trends の転送を維持する。

## Goals and non-goals

- Goals:
  - G1: 画像の情報階層を、共通期間選択・共通ページ見出し・比較条件の帯・KPI 3 枚・推移チャート・詳細パネル・カテゴリ表と展開行・パレート図・上位 3・選択バーの順で置く。共通シェルと同じ UI は画面内に複製しない。
  - G4: 詳細パネルと選択バーから絞込済みの明細へ 1 操作で移れる。
  - G5: 説明文と増減の表記規則を画面と docs で一致させる。
- Non-goals:
  - 共通シェル (サイドバー・ヘッダー・フッター) の変更
  - 専用アプリの画面
  - 利用者のメモ入力欄

## System context and boundaries

- Users/external systems: 利用者 (SH1) が月次の振り返りで開く。保守者 (SH2) は画面が指標定義から描かれることを前提に指標を足す。
- Trust/deployment/data boundaries: 画面は API の返却値を描くだけで、値の計算をしない。色・余白は design-tokens.ts のトークン、図の色は charts.ts の系列色だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 共通期間選択 | `Layout` が全体の期間選択を 1 か所だけ提供 | usePeriod / PeriodPicker | packages/web | Worker kanjo-console の静的アセット |
| 比較条件の帯 | 範囲・指標・比較対象の 3 切替を 1 行に並べ、要確認の明細があれば末尾に件数と金額の注記と総収支へのリンクを出す (qa-trends-decision-012) | SegmentSwitch | packages/web | Worker kanjo-console の静的アセット |
| KPI 3 枚 | 現在値・増減・最も変化が大きい月 | KpiCard | packages/web | Worker kanjo-console の静的アセット |
| 推移チャートと詳細パネル | 広幅は横並び、狭幅は縦積み | chart.js / DetailPane | packages/web | Worker kanjo-console の静的アセット |
| カテゴリ表 | 直近 12 か月のスパークライン付きの行と取引先の展開行 (qa-trends-decision-009)。8見出し (カテゴリ・12か月の変化量・今回合計・比較期間・増減額・増減率・構成比・寄与度) を 昇順→降順→元の順序 で並べ替え、展開行は親に付いて動く (qa-ui-ux-web-trends-observed-005) | DataTable / SortableTableHeader | packages/web | Worker kanjo-console の静的アセット |
| パレート図と上位 3 | 増減の要因の集中を示す | chart.js / カード | packages/web | Worker kanjo-console の静的アセット |
| 選択バー | 下部固定。選択中の月とカテゴリと明細への導線 | 総収支の選択バーの型 | packages/web | Worker kanjo-console の静的アセット |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: URL の検索パラメータ (scope・metric・compare・month・category・side・payee) が画面状態の正本。表記: 増減は『+12,300 円 (増)』のように符号・額・文字を並べ、率は比較期間が 0 のとき『—』。
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

React 18 の SPA。共通シェルの期間と見出しに続けて意味ブロックを縦積みにし、推移チャートと詳細パネルだけを広幅で横並びにする。

#### Routes, screens and navigation

/analysis/trends (支出分析ハブのタブ)。旧 /trends は転送を維持する。明細への遷移先は、MF 由来の行が /classify?month=...&cls=...&category=...&payee=...、freee 由来の行が /analysis/total-cashflow (qa-trends-decision-008)。

#### Component and design-system boundaries

PageShell・PageHeader・KpiCard・Button・FinancialFigure・DataTable と総収支の SegmentSwitch・DetailPane・選択バーの型を再利用し、新しい色や余白の値を足さない。

#### State and data flow

条件は URL が正本。期間は usePeriod で、保存値が無い初回だけ直近1年 (span=1)、利用者が明示した全期間は復元して上書きしない (FR13 / qa-ui-ux-web-trends-observed-005)。選択月の初期値は API が返す最も変化が大きい月 (qa-trends-decision-007)。全期間では比較の帯を『比較なし』と表示する (qa-trends-decision-010)。要確認の注記は API の review が 1 件以上のときだけ出す (qa-trends-decision-012)。

#### Backend integration

GET /api/trends の 1 回の返却で画面全体を描く。傾向の判定の見出しは judgementBasis から『MF の明細だけで判定』と出す (qa-trends-decision-013)。freee 由来で口座が空の出典は『—』と表示する (qa-trends-decision-014)。

#### Performance and observability

条件変更中は直前の値を薄く残して再描画のちらつきを抑える。視覚は headless Chrome の検査で確認する。

#### Frontend verification

DOM テストで意味ブロックと chart 系列、初回期間の既定値、8列の aria-sort と3状態ソート、傾向の判定の開閉と遅延 mount、要確認の注記、口座が空の行の『—』、符号と文字、`category + side` の URL を確認する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-UX-1 | 手を打つ順番は開閉式で残す | 根拠と比較案は qa-trends-decision-001 を参照 | qa-trends-decision-001 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-2 | 比較条件を見出し直下の 1 本の帯へ集約する | 根拠と比較案は AUDIT.md と qa-ui-ux-web-trends-observed-002 を参照 | AUDIT.md と qa-ui-ux-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-3 | 初期の選択月は最も変化が大きい月 | 根拠と比較案は qa-trends-decision-007 を参照 | qa-trends-decision-007 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-4 | 全期間では比較を出さない | 根拠と比較案は qa-trends-decision-010 を参照 | qa-trends-decision-010 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-5 | 要確認の明細は数値に含めず、帯に件数と金額を注記する | 根拠と比較案は qa-trends-decision-012 / dec-trends-review-rows-001 を参照 | qa-trends-decision-012 / dec-trends-review-rows-001 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-6 | 傾向の判定の見出しに基準 (MF の明細だけ) を明記する | 根拠と比較案は qa-trends-decision-013 / dec-trends-judgement-source-001 を参照 | qa-trends-decision-013 / dec-trends-judgement-source-001 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-7 | 口座が空の行は『—』と表示する | 根拠と比較案は qa-trends-decision-014 を参照 | qa-trends-decision-014 の判断に従う | 本書の該当節に反映済み |
| ADR-UX-8 | 保存値が無い初回の期間は直近1年、明示した全期間は保持する | 全期間を既定にすると比較と増減表が初回に空になる | qa-ui-ux-web-trends-observed-005 (I1 の具体化) に従う | 本書の該当節に反映済み |
| ADR-UX-9 | カテゴリ表の8見出しを並べ替え可能にし、並べ替えない表は種別を明示する | 並べ替え不可のまま / 画面ごとの独自実装 | qa-ui-ux-web-trends-observed-005 (I6 の具体化) に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: 画面の作り直しは 1 回のリリースで置き換える。データ移行は無く、戻すときは前の版の Worker へ戻す。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: 画像との構成のずれ → 対策: DOM テストで意味の順と系列を固定し、視覚検査で主要 2 図の名前と重複不在を確認する
- Risk/assumption: 色だけの増減表示 → 対策: 符号と文字の併記をテストで確認する
- Risk/assumption: 狭幅での崩れ → 対策: 既存のレスポンシブ規則に従い、表を横スクロールにする
- Risk/assumption: 基準の違う 2 種類の数字の誤読 → 対策: 傾向の判定の見出しに基準を明記し、要確認の件数を帯に出す
- Architecture fitness test: DOM テストで意味ブロックと chart props、傾向の判定の遅延 mount、`category + side` の URL、符号と文字を確認する。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
