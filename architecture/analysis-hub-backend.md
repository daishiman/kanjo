---
graph_node_id: "arch-analysis-hub-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "支出分析ハブ — core 集計関数と集約 API"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "backend"]
file_path: "architecture/analysis-hub-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "04a49e39d41c790206872981560233225e7cc5e6750d62314d60c2bd3d5a653d"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "04a49e39d41c790206872981560233225e7cc5e6750d62314d60c2bd3d5a653d", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/expense-projection.ts", "packages/core/src/analysis.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/ai/dataset.ts", "packages/api/src/store.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

支出分析ハブ — core 集計関数と集約 API。正本は `system-spec/backend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: packages/api は Hono の Worker で、/api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を掛ける。各分析 route は loadScoped(c) で resolvePeriodQuery (from/to/year/span) と applyPeriod を通し、PeriodMeta (applied/label/full/years/monthCount) を得る。ハブに要る値のうち既にあるのは、照合の要確認件数 (/business-spend の summary.reviewCount と unbooked.length、buildExpenseProjection)、総収支の重複候補件数 (totalCashflowReport の review.length)、月別の totalIncome/totalExpense/totalBalance、tradeoffCandidates (月額)、previousPeriod / yearAgoPeriod (api/ai/dataset.ts に閉じている)。無いのは期間合計の API、前期間比、優先度、マトリクスの正常判定 (unrecordedExpMonths だけ)、数値の改善余地 (diagnosis は文字列)、集約エンドポイント。loadScoped は期間で切ったデータしか渡さないため、前期間比には all からの切り出しが要る。
- Quality attribute priorities: G3 と G4 に資する。Clean Architecture の Dependency Rule (core ← api route adapter ← web) を適用し、判定規則を core の純関数に閉じてテストで固定する。集約を 1 本にして非表示タブ API を呼ばない方針 (C3) と両立させる。
- Constraints: C1: packages/core は依存ゼロの純関数に保ち、api/web へ集計を重複実装しない。 C4: 総収支は freee を正本とした消し込み済みの値を使い、未判断の重複候補は 4 区分の合計に入れない。

## Goals and non-goals

- Goals:
  - G3: ハブ表示中の呼出しを GET /api/analysis/hub の 1 本にし、期間メタ・収支サマリー (前期間比)・5 視点の状態・優先度を返す。前期間計算は core へ移し AI 側もそれを使う。
  - G4: 優先度・マトリクス正常判定・改善余地の規則を docs に書き、core の境界値テストで固定する。
- Non-goals:
  - 既存 5 API (/business-spend・/total-cashflow・/matrix・/trends・/diagnosis) の契約変更
  - D1 スキーマ・migration の変更と派生値の保存
  - 非同期処理・キャッシュ層の追加

## System context and boundaries

- Users/external systems: web SPA (ハブ画面とサイドバー) が唯一の呼出し元。外部システムの追加は無い。
- Trust/deployment/data boundaries: 既存ゲート列の内側にハブ route を置き、D1 の読取りは userId で絞る。集計ロジックは packages/core に閉じ、route は読取り・期間解釈・受け渡しだけを持つ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core ハブ集計関数 | 期間合計・前期間比・5 視点の状態・優先度・改善余地を純関数で算出する | TypeScript 関数 | packages/core | web/api に同梱 |
| core previousPeriod | 直前の同じ月数の期間を返す (api/ai/dataset.ts から移設) | TypeScript 関数 | packages/core | web/api に同梱 |
| GET /api/analysis/hub | loadDataset・totalCashflowReport 相当の読取りを core へ渡し 1 応答にまとめる | Hono route | packages/api | Worker |
| 既存 5 分析 route | 各詳細タブ用の API (変更しない) | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: authGuard と mustChangePasswordFence の後にマウントし、全読取りを userId で絞る。
- Errors/resilience: 前期間の月が 1 か月でも欠けたら比較値を null にし、例外にしない。既存ゲートの 401/403 はそのまま返す。
- Observability/audit: N/A: 実行時の信号を追加しない。既存 requestId を使い、検証は core と API 統合テストに置く。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存 5 API の応答を変えない。previousPeriod の移設後も AI 側の出力を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 architecture-backend.md を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

Cloudflare Workers 上の Hono。依存方向は core ← api route adapter ← web で、ハブの判定規則は core の純関数に置く。

#### Domain and module boundaries

packages/core にハブ集計関数と previousPeriod を置き、expense-projection (要確認件数)・total-cashflow (重複候補件数)・analysis (tradeoffCandidates・unrecordedExpMonths) の既存関数を再利用する。packages/api はハブ route を足すだけで集計を持たない。

#### API and service contracts

GET /api/analysis/hub を新設する。Query は既存と同じ from/to/year/span。応答は期間メタ、収支サマリー (総収入・総支出・純収支と前期間比)、5 視点の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前期間比・診断の改善余地) と優先度。逐語のフィールド名は実装 task の型と契約テストで確定する。

#### Data and transaction behavior

読取りのみでトランザクションを持たない。前期間比は all から previousPeriod(p) の月を切り出して算出し、前期間の月が 1 か月でも欠ければ null。総収支は totalCashflowReport の不変条件を再利用し、未判断の重複候補を合計に入れない。

#### Async processing

N/A: 非同期処理・キュー・cron を追加しない。

#### Security and resilience

既存ゲートの後にマウントし、userId で絞る。GET なので canonicalMutationFence の対象外。

#### Operations and verification

core テストで優先度 (要確認 0/1 件)・マトリクス正常判定 (未記録月 0/1)・改善余地 (tradeoff 候補 0 件)・前期間の欠け (0/1 か月) の境界を固定し、API 統合テストで認証付き 200 と期間メタを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-002 | core 純関数 + 集約 API GET /analysis/hub を新設し、前期間計算を core へ移す | 既存 5 API を同時に呼び、前期間比と改善余地を省く | 同時呼出しは C3 と衝突し、前期間比と改善余地を出せない | ルートを 1 本足し、AI 側も core の previousPeriod を使う |
| qa-analysis-hub-decision-003 | 優先度・正常判定・改善余地を単純な規則で定義し docs とテストで固定する | 件数と前期間比だけにする | 規則を明文化するとハブの 5 視点すべてに状態を出せる | 規則を変えると境界値テストが落ちる |
| qa-backend-web-ah-decision-003 | 前期間は直前の同じ長さ (previousPeriod)、ラベル『前 N か月』、1 か月でも欠けたら null | yearAgoPeriod / 1 年選択時だけ比較 | 任意の期間で比較でき、欠けを 0% と誤読させない | inference-002 を置き換える |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console に GET ルートを足し、ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: core に previousPeriod を移し AI 側の参照を切替 → core のハブ集計関数と境界値テスト → api のハブ route と統合テスト → web がハブ API を使う。
- Rollback trigger/procedure: core テスト・統合テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。スキーマ変更が無いので migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: backend.web の qa_refs に置換済みの qa-backend-web-ah-inference-002 が supersede 宣言なしで残る (completeness-findings medium)。前期間の規則は decision-003 を正本として読む。
- Architecture fitness test: ハブ集計が core の純関数にあり、api のハブ route が集計ロジックを持たないこと。境界値テストが規則の変更で落ちること。
- Load/failure/security validation: 1 リクエストの D1 読取りを既存 /total-cashflow と同程度に保ち、d1-limits.ts の上限内に収める。既存の test / typecheck / lint を緑に保つ (S6)。
