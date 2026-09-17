---
graph_node_id: "arch-trends-screen-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "推移画面 — core の指標定義・推移集計と GET /api/trends の拡張"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "backend"]
file_path: "architecture/trends-screen-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "169f10287b73a085df6421db8008b8220f23bc5f54ecddbb6c0596d4ef28f4e1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "169f10287b73a085df6421db8008b8220f23bc5f54ecddbb6c0596d4ef28f4e1", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/core/src/trend.ts", "packages/core/src/trend-metrics.ts", "packages/core/src/analysis-hub.ts", "packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/index.ts", "packages/api/src/routes/analytics.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

推移画面 — core の指標定義・推移集計と GET /api/trends の拡張。正本は `system-spec/backend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-backend-web-trends-observed-002。集計は packages/core/src/trend.ts (trendsReport、expenseSeriesByCategory、contributionBreakdown、monthlySides) と total-cashflow.ts (monthlyTotalCashflow)、比較期間は analysis-hub.ts の previousPeriod と period.ts の previousYearPeriod を土台にする。API は analytics.ts の GET /api/trends で、loadScoped が期間を解決し、all (全期間) と data (今回期間) を返す。数値の出所は総収支と同じ取引集合とし (qa-trends-decision-008)、analytics.ts の loadReviewSources が読む Dataset と freee 系 4 表 (freee_deals・duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions) から core の totalCashflowReport が返す matched・review・freeeOnly を行の単位にする。
- Quality attribute priorities: G2・G3・G5 に資する。doctrine は Clean Architecture: 依存方向を core (指標定義・集計・説明文の規則) ← api (クエリの検証と返却) ← web (表示) に揃え、計算を route に書かない。
- Constraints: C1: core は依存ゼロの純関数。C3: 外部送信しない。C4: trendsReport の既存の値を変えない。

## Goals and non-goals

- Goals:
  - G2: 指標定義の登録表 (income・expense・net) を core に置き、route は辞書で引く。
  - G3: 今回と比較期間の系列・KPI・詳細・カテゴリ行・取引先行・パレートを 1 つの純関数で返す。
  - G5: 規則を名前付きの関数と定数にし、境界値テストで固定する。
- Non-goals:
  - 集計値の保存
  - サーバ側キャッシュ
  - 収入・支出・純収支以外の指標の実装

## System context and boundaries

- Users/external systems: web SPA が唯一の呼出し元。外部サービスへは送らない。
- Trust/deployment/data boundaries: route は D1 の読取り (loadScoped) とクエリの検証だけを担う adapter。比較期間の切り出しと集計は core に閉じる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| trend-metrics.ts (新設) | MetricDefinition と登録表、指標 id の解決 | core | packages/core・packages/api | Worker kanjo-console |
| trendSourceRows (新設の純関数) | totalCashflowReport の結果を origin (mf/freee)・月・区分・カテゴリ・取引先・金額の行 (TrendSourceRow) へ平らにする | core | packages/core・packages/api | Worker kanjo-console |
| trendComparison (新設の純関数) | 今回と比較期間の行から系列・KPI・詳細・行・パレートを返す | core | packages/core・packages/api | Worker kanjo-console |
| describeDriver (新設の純関数) | 増減要因の説明文を決まった形で作る | core | packages/core・packages/api | Worker kanjo-console |
| GET /api/trends | クエリの検証、比較期間の Dataset の切り出し、既存応答への追加 | api | packages/core・packages/api | Worker kanjo-console |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: 範囲の別名 (all/biz/personal → total/business/household) は core の 1 か所で変換する。エラーは apiError(code, message)。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 architecture-backend.md を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

Hono の Cloudflare Worker (hono-zod-validator の検証の型を参照)。core は依存ゼロの TypeScript の純関数。

#### Domain and module boundaries

指標定義 (trend-metrics.ts)、推移比較 (trend.ts に追加)、期間 (period.ts・analysis-hub.ts を再利用)、説明文の規則 (trend.ts に追加)。既存の傾向判定の関数は変更しない。

#### API and service contracts

GET /api/trends に scope・metric・compare・month を足し、metrics・selection・comparePeriod・series・kpis・detail・categories・changePareto・topMovers を追加で返す。形式違反の scope・compare・month は既定値へ倒して selection に返し、400 は未登録 metric だけ (qa-trends-decision-011)。全期間では comparePeriod を null、compareUnavailable を all_period とし、kpis.change.basis を peak_month_mom にする (qa-trends-decision-010)。review (要確認の件数と金額、qa-trends-decision-012) と judgementBasis (値 mf_only、qa-trends-decision-013) も返す。

#### Data and transaction behavior

loadReviewSources を 1 回だけ呼び (Dataset と freee 系 4 表)、totalCashflowReport の行を月で切って今回と比較期間を作る。比較は previousPeriod(range) または previousYearPeriod(range)。要確認の件数と金額は totalCashflowReport の月次 reviewCount・reviewAmount から取り、行には含めない (qa-trends-decision-012)。傾向の判定 (rows/pareto/breakdown) は現行どおり trendsReport に MF の Dataset を渡す (qa-trends-decision-013)。freee 由来で settleAccount が空の行は account を null にする (qa-trends-decision-014)。書込は無い。

#### Async processing

N/A: 同期の読取り API だけで、非同期処理やキューは無い。

#### Security and resilience

クエリは列挙と形式で検証する。指標は辞書引きだけで解決する。比較データが無いときは null を返しエラーにしない。

#### Operations and verification

core の境界値テストと恒等式テスト、api の契約テスト (別名・既定値への倒し・未登録 metric の 400・既存フィールドの不変・同じ期間で総収支 API と合計が一致・要確認 0 件と 1 件以上・judgementBasis・口座が空の行) で固定する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-BE-1 | 指標は登録制にする | 根拠と比較案は qa-trends-decision-003 を参照 | qa-trends-decision-003 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-2 | 前期間は直前の同じ長さ (previousPeriod) | 根拠と比較案は qa-trends-decision-006 を参照 | qa-trends-decision-006 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-3 | 説明文は規則で生成し保存しない | 根拠と比較案は qa-trends-decision-002 を参照 | qa-trends-decision-002 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-4 | 比較期間は同じ読込から切り出す | 根拠と比較案は qa-backend-web-trends-observed-002 を参照 | qa-backend-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-5 | 数値の出所は総収支と同じ取引集合 | 根拠と比較案は qa-trends-decision-008 / dec-trends-datasource-001 を参照 | qa-trends-decision-008 / dec-trends-datasource-001 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-6 | 全期間では比較せず、KPI の増減は最も変化が大きい月の前月差 | 根拠と比較案は qa-trends-decision-010 を参照 | qa-trends-decision-010 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-7 | 要確認の明細は行に含めず件数と金額だけを返す | 根拠と比較案は qa-trends-decision-012 / dec-trends-review-rows-001 を参照 | qa-trends-decision-012 / dec-trends-review-rows-001 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-8 | 傾向の判定は MF の Dataset のまま計算し基準を返す | 根拠と比較案は qa-trends-decision-013 / dec-trends-judgement-source-001 を参照 | qa-trends-decision-013 / dec-trends-judgement-source-001 の判断に従う | 本書の該当節に反映済み |
| ADR-BE-9 | freee 由来で口座が空の行は account を null にする | 根拠と比較案は qa-trends-decision-014 を参照 | qa-trends-decision-014 の判断に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: 応答はフィールドの追加だけで、既存の呼出し側を壊さない。戻すときは前の版の Worker へ戻す。migration は無い。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: 既存の傾向判定の値が変わる → 対策: trend-contract.test.ts を変更せず通す
- Risk/assumption: 前期間の端 (データの先頭より前) → 対策: 空の月として扱う境界値テスト
- Risk/assumption: CPU 時間の増加 → 対策: 読込を総収支 API と同じ 1 回に保ち、比較期間の切り出しは配列の走査だけにする
- Risk/assumption: 総収支と数値がずれる → 対策: 同じ totalCashflowReport を通し、契約テストで総収支 API と合計を突き合わせる
- Risk/assumption: 要確認の件数が総収支とずれる → 対策: 契約テストで総収支 API の要確認の件数・金額と突き合わせる
- Architecture fitness test: core の境界値テストと恒等式テスト、api の契約テスト (別名・既定値への倒し・未登録 metric の 400・既存フィールドの不変・同じ期間で総収支 API と合計が一致・要確認 0 件と 1 件以上・judgementBasis・口座が空の行) で固定する。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
