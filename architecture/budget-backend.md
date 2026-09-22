---
graph_node_id: "arch-budget-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "予算 — 予算画面の算出と予算の読み出しを担う core 純関数 1 か所と取得・保存の 2 経路"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "backend"]
file_path: "architecture/budget-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "cd68f3959122014af143291a3f5a61039e84bbe13f348a0b7cd3a106585725d1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "cd68f3959122014af143291a3f5a61039e84bbe13f348a0b7cd3a106585725d1", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-database", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-auth"]
resource_scope: ["packages/core/src/budget-screen.ts", "packages/core/src/analysis.ts", "packages/core/src/diagnosis-detectors.ts", "packages/core/src/diagnosis-screen.ts", "packages/core/src/types.ts", "packages/core/src/index.ts", "packages/api/src/routes/budget-plans.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/store.ts", "packages/api/src/index.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

予算 — 予算画面の算出と予算の読み出しを担う core 純関数 1 か所と取得・保存の 2 経路。`system-spec/backend.md` は承認時入力、本書は前期実績・自動提案・見通し・KPI の算出の置き場所、画面用の取得と予算の保存の API、既存の予算の読み手の付け替えの制約を持つ。契約と算出規則の逐語の正本は `specs/spec-budget-screen.md`。

## Context and drivers

- Business/technical context: 既存の予算の API は `packages/api/src/routes/settings.ts` の `GET /api/budgets` (52 行目: `budgets`・`budgetTable`・`budgetOutlook` を返す)・`PUT /api/budgets` (57〜80 行目: zod で科目名 60 字・非負整数、delete+insert を `db.batch`、JSON snapshot の無効化)・`POST /api/budgets/suggest` (82 行目) だけである。core の `packages/core/src/analysis.ts` には `suggestBudgets` (910 行目: 固定費は直近 3 か月平均 × 95%、他は全期間平均)・`budgetTable` (937)・`budgetSummary` (983)・`budgetOutlook` (1027)・`defenseLine` (1090) があり、根拠の内訳・前期実績・月次の見通し・過不足・インパクトを返す関数は無い。`Dataset` は `biz.revenue` (売上高の月次)・`biz.categories`・`biz.expense` と `budgets` (科目 → 月額) を持ち、その他収入の系列は無い。`budgets` は `diagnosis-screen.ts` 371 行目・`diagnosis-detectors.ts` 283 / 724 行目 (予算カバー率)・`packages/api/src/routes/analytics.ts` 771 行目 (`budgetTable`) が読む (qa-budget-backend-web-evidence-001)。
- Quality attribute priorities: G2・G3・G5 に資する。Clean Architecture の Dependency Rule (core ← api ← web の一方向) と data-access の境界 (D1 の読み書きを route に閉じ、core は Dataset と予算の行集合だけを受け取る) を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1/Drizzle。算出を api / web に重複実装しない。外部の LLM を呼ばない (qa-budget-decision-003)。

## Goals and non-goals

- Goals:
  - G2: core に予算画面の算出 (仮称 `budgetScreen`、`packages/core/src/budget-screen.ts` を予定) を新設し、Dataset・実績期間・予算対象の開始月・保存済みの予算・計画による調整から、前期実績・自動提案とその各項・見通し・月次の実績と予算・今後の見通しの累計・KPI 4 つ・過不足カテゴリ・調整によるインパクトを 1 回で返す。
  - G3: 画面用の取得 1 本と、base revision つき dirty row patch の保存 1 本を設け、保存は `canonicalMutationFence` に登録する。保存行の無い期間は既存 `budgets` の月額 × 12 を初期値として返す。
  - G5: 基準月を含む予算対象の年額 ÷ 12 を返す core の予算の読み出し関数 (仮称) を設け、診断の予算カバー率・予算の着地見込み・analytics の既存の読み手をすべてこの関数へ寄せる。ヘッダの防衛ラインと防衛ライン余裕は同じ `defenseLine` を使う。
- Non-goals:
  - 外部の LLM による提案・取込データに無い外部データ (従業員数・業界中央値) の取得 (qa-budget-decision-003)
  - 予算の版管理・担当の表現
  - 個人 (家計) の予算
  - 旧 `GET` / `PUT /api/budgets` と `POST /api/budgets/suggest` の削除 (互換のため残し、画面は使わない)

## System context and boundaries

- Users/external systems: web (予算画面・診断・共通シェルのヘッダ)。外部サービスは呼ばない。
- Trust/deployment/data boundaries: core は D1 を知らず、Dataset と予算の行集合だけを受け取る。route は zod で受け、`loadDataset` と予算の表の読取りで入力を組んで純関数へ渡し、結果を返すか書くだけにする。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 予算画面の算出 (`budgetScreen` 仮称) | 行 (収入: 売上高・その他収入 / 支出: 事業の経費科目) ごとの前期実績・自動提案と各項・見通し・差額、月次の実績と予算、累計、KPI、過不足カテゴリ、調整によるインパクトを返す | 純関数 | packages/core | 同一 Worker |
| core 予算の読み出し関数 (仮称) | 基準月を含む予算対象の保存行があればその年額 ÷ 12、無ければ既存 `budgets` の月額を科目別に返す | 純関数 | packages/core | 同一 Worker |
| core `defenseLine` (既存) | 防衛ラインの月額。ヘッダと防衛ライン余裕の両方が使う | 純関数 | packages/core | 同一 Worker |
| core 診断・着地見込み (改修) | 予算カバー率・設定済み科目・`budgetTable` / `budgetOutlook` の入力を予算の読み出し関数から取る | 純関数 | packages/core | 同一 Worker |
| `GET /api/budget-screen` | 実績期間と予算対象の開始月を受け、`budgetScreen` の結果を返す | Hono route | packages/api | Worker |
| `PUT /api/budget-plans` | base revision と dirty 行を検証し、1 回の D1 batch で差分更新して JSON snapshot を無効化する | Hono route | packages/api | Worker |
| 旧 `/api/budgets` 系 (既存) | 互換のため残す。読み出しは予算の読み出し関数を経由させる | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 新経路はすべて既存 `/api/*` の認証・フェンス配下に置く (`architecture/budget-auth.md`)。フェンス登録と入力の上限は `architecture/budget-security.md`。
- Errors/resilience: クエリと本文は zod で検証し、違反・上限超過は 400。フェンスの競合は既存の 409、未適用のスキーマは既存の 503。エラー応答に内部の SQL・スタックを含めない。
- Observability/audit: N/A: 業務上の変更記録を新設しない。予算の保存行の `updated_at` が最終保存時刻の正本になる。
- Configuration/secrets: 追加の秘密情報を持たない。
- Compatibility/versioning: 旧 `/api/budgets` 系の応答形は変えない。`budgets` を直接読む箇所を予算の読み出し関数へ移し、同じ予算の値を 2 か所で作らない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/budget-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/budget-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: N/A: 本章の関心外 (`architecture/budget-security.md`)

### Backend architecture

#### Runtime and architecture pattern

- Runtime/framework/version: 既存の Cloudflare Workers + Hono + zod (`@hono/zod-validator`) + Drizzle (D1)。packages/core は依存ゼロの TypeScript 純関数。
- Pattern: 前期実績・自動提案の各項・見通し・過不足・インパクト・KPI は入出力を持たない計算として core に置き、api の route は入力の組み立てと書込だけを行う層構造 (Clean Architecture の Dependency Rule)。
- Selection rationale and rejected alternatives: KPI・一覧の合計・グラフの年合計・見通しの累計が同じ関数の 1 回の結果から出るため、O2 の一致を core の単体テストで確かめられる。route や web で合計を取り直す案は、同じ値が複数か所で作られてずれるため採らない。

#### Domain and module boundaries

- Bounded contexts/modules: 予算画面の算出 (前期実績・自動提案・見通し・KPI・過不足・インパクト)、予算の読み出し (基準月の月額)、防衛ライン (既存)。
- Dependency direction: core ← api ← web の一方向。core は D1 / Hono の型を参照しない。core は時刻を読まず、基準月と予算対象は引数で受け取る。
- Public/internal interfaces: 算出の規則は次のとおり。
  - 前期実績 = 実績期間の科目別合計 × 12 ÷ 実績の月数 (agent 推定・利用者未確認、根拠 qa-budget-backend-web-002)。
  - 自動提案 = 千円丸め (前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整)。各項を根拠として返す (qa-budget-backend-web-001)。
  - 増減率 = 直近 12 か月の合計 ÷ その前の 12 か月の合計 − 1、±30% で頭打ち。前の 12 か月が 0 か実績が 24 か月未満なら 0。季節性補正は 24 か月以上の実績があるときだけ、月ごとの平均からの偏りを見通しの月割に使い、年額には予算対象に掛かる月の偏りの差額を足す。丸めは千円単位の四捨五入 (いずれも agent 推定・利用者未確認、根拠 qa-budget-backend-web-002)。
  - 見通し = 実績のある月は実績、無い月は自動提案の月割 (季節性を反映)。過不足カテゴリの差額 = 見通し − 来期予算。調整によるインパクト = Σ(来期予算 − 自動提案)。
  - KPI: 年間収入予算 = 収入行の来期予算の和、年間支出予算 = 支出行の来期予算の和、予算純収支 = 収入予算 − 支出予算、防衛ライン余裕 = 年間収入予算 − `defenseLine(data).line` × 12 (qa-budget-decision-004)。
  - 行: 収入は『売上高』(`biz.revenue`) と、実績 0 の手入力行『その他収入』。支出は `data.biz.categories` (qa-budget-decision-002)。
  - 過不足の要因の文: 計画による調整の理由があればそれを、無ければ増減率・季節性のうち寄与の大きい項を文にする (agent 推定・利用者未確認、根拠 qa-budget-backend-web-002)。

#### API and service contracts

- Protocol/style/versioning: 同一オリジンの REST (JSON)。画面用の取得は `GET /api/budget-screen?period=<usePeriod の値>&start=YYYY-MM`、保存は `PUT /api/budget-plans` で本文 `{ start, baseSavedAt, rows: [{ account, kind, annualAmount, planAdjustment, planReason }] }`。`annualAmount:null` はその dirty 科目の削除を表す。
- Request lifecycle: ミドルウェア (認証 → パスワード変更 → スキーマ →フェンス) → zod → `loadDataset` → core 純関数 → JSON。保存は zod → フェンス内で現行 revision を照合 → dirty 科目の DELETE・nonnull 行の JSON INSERT・残存行の revision 更新・snapshot 無効化を 1 回の D1 batch → 新 revision を返す。
- Error taxonomy: 検証違反と行数上限超過は 400、未認証 401、フェンス競合は 409 `canonical_write_busy`、revision 不一致は 409 `budget_plan_conflict`、未適用スキーマは 503。

#### Data and transaction behavior

- Repository/data owner: `budget_plans` への書込は保存 route に閉じる。既存 `budgets` は読むだけで書かない (旧 `PUT /api/budgets` を除く)。
- Transaction/idempotency/concurrency: 保存は dirty 行だけの差分更新。D1 batch は全か無かで、変更系フェンス内の revision 照合により stale な本文を 409 で拒否する。未編集行は保持し、最後の行を削除した期間の revision は null へ戻る。
- Cache consistency/invalidation: サーバ側キャッシュを持たない。算出は要求のたびに行う。保存と JSON snapshot の無効化を同じ batch に入れ、予算だけ変わってバックアップの指紋が古いままの状態を作らない。
- 初期値: 保存行の無い期間は、既存 `budgets` の月額 × 12 を来期予算の初期値として返し、表へは書かない (qa-budget-decision-001)。

#### Async processing

- Queue/event/scheduler: N/A: 非同期処理・キュー・スケジューラを追加しない。算出と保存は 1 要求で完結する。
- Delivery/order/dedup/retry/DLQ: N/A: 保存の再試行は最新を再取得して revision と dirty 差分を rebase してから行う。

#### Security and resilience

- Authn/authz/input validation: `architecture/budget-auth.md` と `architecture/budget-security.md` に従う。利用者 id はセッションから取る。
- Timeout/retry/circuit breaker/load shedding: 1 回の保存 200 行の上限 (agent 推定・利用者未確認、根拠 qa-budget-security-web-002) と、画面用の取得を Dataset の読込み 1 回と予算の表の読取り 1 回に留めることで 1 要求の負荷を抑える (`architecture/budget-infrastructure.md`)。

#### Operations and verification

- Logs/metrics/traces/health/readiness: N/A: 新しい運用信号を追加しない。
- Unit/contract/integration/load/failure tests: core 単体テスト (`packages/core/test/budget-screen.test.ts` を予定) で O2 (年間収入予算 − 年間支出予算 = 予算純収支、一覧の来期予算の和 = KPI、グラフの月次予算の年合計 = KPI、防衛ライン余裕 = 年間収入予算 − `defenseLine().line` × 12、自動提案の各項と千円丸め、過不足の差額 = 見通し − 来期予算、インパクト = Σ(来期予算 − 自動提案)、保存行の無い期間の初期値 = 既存月額 × 12) を固定する。API 統合テスト (`packages/api/src/budget-screen.integration.test.ts` を予定) で O3 (期間ごとの保存と上書き、未認証 401、フェンス違反の拒否、不正値 400、診断の予算カバー率が新しい表の値から出る) を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-backend-web-001 | 予算画面の数値を core の純関数 1 か所から 1 回で返す | KPI・一覧・グラフを route や web で個別に集計する | KPI・一覧の合計・グラフの年合計・累計が構造的にずれない | `suggestBudgets` は画面では使わず、旧経路の互換のためだけに残る |
| qa-budget-backend-web-001 | 既存の予算の読み手を予算の読み出し関数へ寄せる | 診断は `budgets`、画面は新しい表をそれぞれ読む | 診断の予算カバー率と画面の設定済み科目が一致する (G5) | `diagnosis-detectors.ts`・`diagnosis-screen.ts`・analytics の入力を付け替える |
| qa-budget-decision-003 | 自動提案は決定論＋計画による調整の入力で出し、外部送信しない | 外部 LLM / 決定論のみ | 再現でき、利用者の計画を根拠に出せる | 取込データに無い根拠は利用者が入力した理由としてだけ出る |
| qa-budget-decision-004 | 防衛ライン余裕 = 年間収入予算 − `defenseLine` の月額 × 12 | 予算純収支 − 防衛ライン × 12 / 予算純収支と同じ | ヘッダと同じ関数を使い、純収支と重複しない | 支出予算の超過は予算純収支と並べて補う |
| qa-budget-decision-001 | 保存は base revision つき dirty row patch 1 本 | 期間全行の置換 | 未編集行を保持しながら競合を 409 で検知できる | 1 回の dirty 行数に上限を置く |
| qa-budget-backend-web-002 | 画面用の取得を `GET /api/budget-screen` 1 本にする (agent 推定・利用者未確認) | 予算の行と算出結果を別経路で取る | 画面の問い合わせが 1 本で済み、算出と保存行の食い違いが起きない | 実績期間と開始月の組ごとに問い合わせが分かれる |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: 追加 migration の反映 (`architecture/budget-database.md`) → core の `budgetScreen` と予算の読み出し関数 → 診断・着地見込み・analytics の付け替え → `GET /api/budget-screen` と `PUT /api/budget-plans` とフェンス登録 → web の画面 (`architecture/budget-frontend.md`)。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻し。算出値を保存しないため、データの巻き戻しは不要。`budget_plans` は追加表で直前版の Worker は読まないので、Worker を戻すだけで足りる (戻した間は診断が既存 `budgets` を読む)。

## Risks and verification

- Risk/assumption: 予算の読み出し関数の『今月』は core が時刻を読めないため、呼び出し側が基準月を渡す。診断と画面で基準月の取り方がずれると同じ関数でも値がずれる。基準月を決める箇所を 1 つにし、テストで突き合わせる。
- Risk/assumption: その他収入は現行の集計に系列が無く、前期実績と見通しが常に 0 になる。KPI の年間収入予算には来期予算だけが入り、過不足カテゴリには出ない (見通し 0 − 予算で常に減少側になる) ため、過不足の対象を支出行に限るかを `specs/spec-budget-screen.md` で固定する。
- Risk/assumption: `defenseLine` は個人生活費の直近 3 か月平均を含むが、予算は事業だけを対象とする。防衛ライン余裕の定義は利用者決定 (qa-budget-decision-004) どおりとし、? の説明に式を示す。
- Architecture fitness test: api ハンドラと web に前期実績・自動提案・KPI の計算が無いこと。core が D1 / Hono の型を参照しないこと。core の外で `data.budgets` を直接読む箇所が残らないこと。
- Load/failure/security validation: 3 年の実績と 200 行の予算で `GET /api/budget-screen` が Worker の CPU 時間内に収まること。201 行の保存が 400 を返すこと。
