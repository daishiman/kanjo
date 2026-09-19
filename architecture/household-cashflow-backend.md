---
graph_node_id: "arch-household-cashflow-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "家計収支 — 総収支台帳を入力にする core 純関数 1 か所と 3 経路の API"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "backend"]
file_path: "architecture/household-cashflow-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "d727e6d8bf6bed1ff035e0a6e0da835b610fc4589035eb823ece7500a2bd2215"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "05968afeedc3f4ae572a389eb14e57436114352c58442d5b78104aafd8ca45b4", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["packages/core/src/household-summary.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/analysis.ts", "packages/core/src/types.ts", "packages/core/src/classify.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/settings.ts", "packages/api/src/cashflow-sources.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

家計収支 — 総収支台帳を入力にする core 純関数 1 か所と 3 経路の API。`system-spec/backend.md` は承認時入力、本書は集計とデータ契約の制約を持つ。契約と集計規則の正本は `specs/spec-household-cashflow-screen.md` §11 / §12。

## Context and drivers

- Business/technical context: `GET /api/household` は `packages/api/src/routes/analytics.ts:528-531` で `loadScoped` の data を core の `household(data)` に渡して返すだけで、専用の zod 検証を持たない。`household()` は `packages/core/src/analysis.ts:771-790`、`HouseholdData` は同 529-548 にあり、前年比較を持たない独自定義である。総収支の台帳 `totalCashflowLedger` (`packages/core/src/total-cashflow.ts`) の行 `TrendSourceRow` は名義を持たない。振替は `MfTx.isTransfer` (`types.ts:80`) で、`isMfCountable` (`types.ts:92-94`) が台帳から除く (qa-household-backend-web-evidence-001)。
- Quality attribute priorities: G2・G3・G5 に資する。Clean Architecture の Dependency Rule (core ← api ← web の一方向) と data-access の境界 (永続化を route 側に閉じる) を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1。家計専用の SQL を増やさない。

## Goals and non-goals

- Goals:
  - G2: core に `householdSummary` (`household-summary.ts`) を新設し、`totalCashflowLedger` の行集合から家計全体・事業・個人・前年・月別系列・6 区分・名義別収入を 1 回の呼び出しで算出する。
  - G3: 選択時だけの `GET /api/household/category` で区分の期間合計、選択月合計、最大 5 件の主な取引を別フィールドで返す。
  - G5: 選択月の振替全件 (抜粋なし) の一覧と対推定を core の純関数にする。
- Non-goals:
  - 旧 `household()` と `HouseholdData` の温存 (置き換えて削除する)
  - 家計の集計値の保存
  - 振替の対推定のための相手口座カラムの追加 (qa-household-decision-003)

## System context and boundaries

- Users/external systems: web (家計収支画面・設定画面・明細画面の名義表示)。外部サービスは呼ばない。
- Trust/deployment/data boundaries: core は D1 を知らず台帳の行集合だけを受け取る。route が期間を解決し、`loadScoped` と `loadCashflowSources` で読み、純関数へ渡して JSON へ写す。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core `totalCashflowLedger` (拡張) | 台帳行に名義 (`owner: Owner \| 'unset'`) を追加する。freee 行は `business`、MF 行は `resolveTx` の owner | 純関数 | packages/core | 同一 Worker |
| core `householdSummary` | 総額・月平均・年換算・前年・変化・事業/個人・月別系列・6 区分・名義別・振替・出典を返す | 純関数 | packages/core | 同一 Worker |
| core 6 区分の対応表 | 区分 key と MF 大項目の対応を定数 1 か所に置く | 定数 | packages/core | 同一 Worker |
| core 振替の対推定 | 同額・逆符号の入出金を決定論で組にし、残りを相手不明にする | 純関数 | packages/core | 同一 Worker |
| core `DEFAULT_OWNER_LABELS` / `ownerLabel` | 保存値が無い名義を既定の表示名で補う | 純関数 | packages/core | 同一 Worker |
| `GET /api/household` | 期間 + `month` を受け、`householdSummary` 1 回の結果を返す | Hono route | packages/api | Worker |
| `GET /api/household/category` | `key` + `month` + 期間を受け、期間合計 `current`、選択月全件合計 `monthTotal`、最大 5 件の `transactions` プレビュー、`totalCount` を返す | Hono route | packages/api | Worker |
| `GET` / `PUT /api/settings/owner-labels` | 4 名義の表示名を読み書きする | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 3 経路とも既存 `/api/*` の認証・フェンス配下に置く (`architecture/household-cashflow-auth.md`)。
- Errors/resilience: クエリと本文は zod で検証し、`month` の書式違反と期間外の月は 400。エラー応答に内部の SQL・スタックを含めない。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: 追加の秘密情報を持たない。
- Compatibility/versioning: `GET /api/household` の形は置き換える (旧 `HouseholdData` を削除し利用箇所を移す)。台帳行への名義の追加は加法的で、総収支・推移は名義を読まないので数値は変わらない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/household-cashflow-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/household-cashflow-database.md`)
- Security: N/A: 本章の関心外

### Backend architecture

#### Aggregation rules

入力は `totalCashflowLedger(...)` の `ledger.rows` で、家計画面は独自の選別を持たない。区分は `side === 'business'` を事業、`side === 'household'` を個人とする。前年は `previousYearPeriod(range)` の月がすべて既知のときだけ算出し、欠けがあれば `previousYear` / `change` / 各行の前年値を `null` にする (総収支画面と同じ規則)。率は前年値 0 のとき `null`。未記帳月は平均の分母に入れない。数値は収入・支出を正本にし、差・率・構成比は計算値にする。6 区分の和は総支出で、事業側の支出は `other` に入る。

#### Outlier selection

本章に偏りの選定は無い。代わりに振替の対推定を決定論で行う。対象は期間内の MF 明細で `isTransfer === true` のもの。組は同額・逆符号・日付差の許容内で作り、1 明細は 1 組にしか入らない。許容日数と同点の決め方は仕様書の規則に従う (正本は `specs/spec-household-cashflow-screen.md` §6.2。その値は agent 推定・利用者未確認 (根拠 qa-household-backend-web-003))。名義は各明細の `resolveTx(...).owner`。

#### API contract

`GET /api/household` は既存の期間パラメータ + `month` を受ける。表示名 (`label`) はサーバで `ownerLabel` を適用して返す。`GET /api/household/category` は `key` を 6 区分の enum で受け、`other` のときは事業と家計の内訳を加える。`PUT /api/settings/owner-labels` は 4 キーすべて必須で部分更新しない。契約の逐語は `specs/spec-household-cashflow-screen.md` §11.1〜§11.3。

#### Data access

データアクセスは route 側に閉じる。期間は `loadScoped`、freee の取引・判定・除外は総収支と同じ `loadCashflowSources` で読み、前年同期間の読み取りは `loadScoped` の範囲拡張で行う。純関数には表示期間と前年の範囲を分けて渡す。区分詳細の主な取引も同じ行集合の絞り込みで作る。

#### Backend verification

core 単体テストで不変条件 5 つ (`summary.total` = 総収支の総合、全月で事業 + 個人 = 家計全体、6 区分の和 = 総支出、名義別の和 = 総収入、振替は `ledger.rows` に現れない)、前年欠損で `null`、対推定の決定論を固定する。API テストで `month` の 400、`current` / `monthTotal` / 5 件プレビューの分離、選択月の振替全件 (抜粋なし)、集計対象台帳行 0 件 (振替のみ・除外行のみを含む) の `empty=true` を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-household-ledger-source | 総収支の台帳 (`totalCashflowLedger`) を家計集計の入力にする | 現行 `household()` を拡張 | 総収支の総合と家計全体が同じ行集合から出て、両画面の数字が一致する | 旧 `household()` と `HouseholdData` を削除し利用箇所を移す |
| dec-household-owner-model | 名義の内部値を残し、表示名は `ownerLabel` で付ける | 内部値を本人 / パートナー等へ移行 | 既存の規則・明細を壊さない | 名義の解決は台帳の中で行い、api と web は解決規則を持たない |
| dec-household-categories | 6 区分の対応表を core の定数 1 か所に置く | 金額上位 5 大項目 + その他 | 期間をまたいで区分の意味が一定で、docs とテストで一致を検査できる | 事業側の支出を `other` に入れる |
| dec-household-transfer-pairs | 振替は入出金の対を core の純関数で推定する | 名義間を出さない | 除外した振替がどこからどこへ動いたかまで見せられる | 対にならない明細は相手不明として返す |
| dec-household-figure-source | 差・率・構成比は収入・支出から計算する | 画像の値を正本にする | どの欄も算術で閉じる | 率は前年値 0 で `null` |
| qa-household-backend-web-004 | 詳細は別経路 `GET /api/household/category` で選択時に返す | 本体に全区分の取引を含める | 本体応答が軽くなる | 経路が 1 本増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: 台帳行へ名義を追加 → 6 区分の対応表と `ownerLabel` → `householdSummary` と振替の対推定 → `GET /api/household` の付け替え → `GET /api/household/category` 新設 → owner-labels 経路 (migration の後) → 旧 `household()` の削除。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻し。集計値を保存しないためデータの巻き戻しは不要。

## Risks and verification

- Risk/assumption: 家計と総収支で集計が二重実装されると数字が食い違う。同じ台帳の行集合を入力にし、総合との `toBe` 一致をテストで固定する。
- Architecture fitness test: api ハンドラと web に集計ロジックが無いこと。core が D1 / Hono の型を参照しないこと。旧 `household()` の参照が残らないこと。
- Load/failure/security validation: 集計が台帳の行数に比例する 1 回の走査で Worker の CPU 時間内に収まること。クエリ違反が 400 を返すこと。
