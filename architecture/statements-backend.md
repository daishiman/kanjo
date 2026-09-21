---
graph_node_id: "arch-statements-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "決算書 — core の statementsScreen 1 か所と、GET /api/statements の screen-only 契約・PUT の項目単位 upsert"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "backend"]
file_path: "architecture/statements-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c7df4f617d6b5584de1046f01f33acd1da7e396a903ac403bbea6802927859fc"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "c7df4f617d6b5584de1046f01f33acd1da7e396a903ac403bbea6802927859fc", "imported_at": "2026-09-19T23:36:20Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T23:36:20Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["packages/core/src/statements-screen.ts", "packages/core/src/statements.ts", "packages/core/src/balances.ts", "packages/core/src/total-cashflow.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/balances.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G2", "G3", "G4", "G5"]
---

# Architecture overview

決算書画面 — core の statementsScreen 1 か所と、GET /api/statements の screen-only 契約・PUT の項目単位 upsert。`system-spec/backend.md` は承認時入力、本書は backend 制約を持つ。データ契約・フィクスチャ数値の正本は `specs/spec-statements-screen.md` §3・§6。

## Context and drivers

- Business/technical context: `packages/api/src/routes/analytics.ts:627-650` の GET /api/statements は loadScoped (data・all・period) の data から profitAndLoss・cashFlow・buildBalanceSheet を返す。`packages/api/src/routes/balances.ts` の PUT /api/balances/liabilities は zod strict・最大 4 行で、その月の manual 負債を全削除してから挿入する。core の `statements.ts` は profitAndLoss・cashFlow (決済列が無いと settlementUnknown) を持ち、`tax-accounts.ts` の 6 グループに売上原価は無い。
- Quality attribute priorities: G2・G3・G4・G5 に資する。Clean Architecture の Dependency Rule と、同じ数値契約を二重化しない API 境界。
- Constraints: Hono + zod + Drizzle on Cloudflare Workers。core は純関数 (D1・Hono を知らない)。

## Goals and non-goals

- Goals:
  - G2: core の statementsScreen が段階損益 (月別・合計)・前期比・構成比・計算式・主な内訳科目・出典・KPI を返す。
  - G3: CF の可否と原因件数 (未仕訳・現金口座の月欠け・科目未設定) を core が判定する。
  - G4: PUT は送られた項目だけを upsert / 削除し、他の項目と source=mf の行に触らない。
  - G5: 金額の上限・本文の大きさの上限・監査。
- Non-goals:
  - 直接法のキャッシュフロー計算書
  - 資産側の手入力 API
  - 既存 profitAndLoss / cashFlow / buildBalanceSheet の削除 (内部で再利用する)

## System context and boundaries

- Users/external systems: web の決算書画面。外部サービスは呼ばない。
- Trust/deployment/data boundaries: api は zod で受けた値を core と D1 に渡して JSON に写すだけ。計算規則は core に置く。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| statementsScreen (packages/core/src/statements-screen.ts) | `{current, previous, deals, balances, referenceMonth}` → screen。区分対応表・段階損益・前期比・構成比・計算式・内訳・出典・KPI・CF 可否と原因・BS の項目別 3 状態 | 純関数 | packages/core | core パッケージ |
| 区分対応表 | 仕入高・期首/期末商品棚卸高 → 売上原価、売上系 → 売上高、それ以外と未知 → 販管費 (外注工賃も販管費) | 定数 + 関数 | packages/core | core パッケージ |
| GET /api/statements | 期間クエリ + `ref=YYYY-MM` (期間外・不正値は期間の最終月へ丸め、丸めた月を `bs.referenceMonth` で返す)。前期は `applyPeriod(all, 前期範囲)` で切り、応答は `{ screen }` だけを返す | HTTP JSON | packages/api | Worker |
| PUT /api/balances/liabilities | `{month, lines:[{category, status: unset\|zero\|amount, amount?}]}` を zod strict で受け、送られた項目だけを upsert / 削除、監査 1 件、応答は保存後の bs | HTTP JSON | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: `/api/*` の authGuard と mustChangePasswordFence の内側。user_id は常にセッションから取り、本文から受けない。
- Errors/resilience: 不正な本文 400、本文超過 413 (bodyLimit 8 KiB)、未認証 401、取込中 409 (canonical-mutation-fence)。前期が 0 / 欠損なら % は null。
- Observability/audit: 保存ごとに liability_audit_log へ 1 件 (金額は残さない)。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET は `{ screen }` だけの単一契約とし、画面が読まない旧キー (pl/cf/bs/period) は返さない。PUT の本文形は変わるため、web とテストを同じ変更で更新する。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/statements-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/statements-database.md`)
- Security: N/A: 本章の関心外 (`architecture/statements-security.md`)

### Backend architecture

#### Service boundaries and responsibilities

core は計算、api は入出力と永続化。statementsScreen は既存の profitAndLoss・cashFlow・buildBalanceSheet を内部で再利用し、区分対応表と段階損益だけを新設する。

#### API and integration contracts

`screen` の TS インタフェースは spec §3 が正本。PL 行は `{id, label, current, previous, diff, diffRate|null, ratio, formula, topAccounts[3], monthly[]}`。月次 fixture の正本は千円配列で、core は各値を 1,000 倍した円として返す。CF は `{available, causes:{unclassified, missingCash:{months, settlementUnknown}, accountUnset}, operating?}` で、原因が 1 つでも立てば不可 (available=false)、1 つも無ければ可。unclassified=決算書区分の無い取引数、missingCash.months=Dataset.unrecordedExpMonths ∩ 期間、settlementUnknown=既存 cashFlow().settlementUnknown、accountUnset=科目が空の取引数。数えるのは core 1 か所で web は数え直さない。BS は基準月の項目別 `{category, status: unset|zero|amount, amount|null}` と `insufficient`。

#### Domain logic and transactions

恒等式 (売上総利益=売上高−売上原価、営業利益=売上総利益−販管費) を月別と合計で保つ。PUT は 1 リクエストを D1 の batch 1 回 (upsert / delete と監査 insert) で書き、途中で一部だけ残らないようにする。

#### Async processing and resilience

N/A: 非同期処理を足さない。保存は取込との直列化 (canonical-mutation-fence) の内側で同期に行う。

#### Backend observability

監査表への 1 件と既存のエラーログのみ。

#### Backend verification

core の契約テスト: 恒等式 (全月と合計)・前期比 (前期 0 / 欠損で null)・未知科目は販管費・構成比・CF 不能の原因件数・原因が無ければ可・settlementUnknown 単独で不可・unset と zero の区別・検算済みフィクスチャ (売上高 12,480,000 / 11,240,000 など)。API 統合テスト: 1 項目保存で他項目が残る・unset で行が消える・上限超過 400・本文超過 413・未認証 401・監査 1 件・取込中 409・source=mf の行に触れない。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-backend-web-002 | 決算書の数値を core の statementsScreen 1 か所で出す | api / web で分担 | 恒等式・前期比を 1 か所でテストできる | 旧 KPI の画面側計算を撤去する |
| qa-statements-decision-001 | 区分は固定の対応表 (青色申告決算書の売上原価欄に合わせる) | 利用者が区分を設定 | 利用者が推奨案を選んだ。設定 UI と保存が不要 | 未知の科目は販管費に入る (テストで固定) |
| qa-statements-screen-only-contract-001 | GET は `{ screen }` だけを返す | 旧キーとの併記 | core と API 型・fixture・テストを単一契約に保つ | 旧キーの利用箇所は同時に移行する |
| qa-statements-monthly-pl-unit-001 | core は千円 fixture を 1,000 倍した円で返す | 画像の `950`〜合計 `12,480` を万円として扱う | 画像値は千円として上部の円合計と整合し、変換境界を一か所に固定できる | web の月次表だけが円を万円へ換算する |
| qa-statements-backend-web-002 | PUT は送られた項目だけを upsert / 削除 | 月の全削除 + 挿入 (現行) | 1 項目の保存で他項目が消える現行の不具合を構造で防ぐ | 『未入力』に戻すには status=unset を明示で送る |
| qa-statements-decision-004 | CF は既存の営業 CF 概算 + 原因別件数 | 直接法 CF | 利用者が推奨案を選んだ。新しいデータが要らない | 概算であることを画面に明記する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。
- Migration sequence: core (区分対応表 → 段階損益 → 前期比・構成比・内訳 → CF 可否 → BS 3 状態 → statementsScreen) → GET の screen-only 化 → PUT の本文形と upsert → 監査 → 既存テストの更新。migration 0046 の後に PUT を切り替える。
- Rollback trigger/procedure: API 統合テストが落ちたら差し戻し。配信済みなら直前の Worker へ戻す (新列と新表は残っても旧 Worker は使わない)。

## Risks and verification

- Risk/assumption: 前期範囲を data (期間で切った後) から作ると前期が空になる。必ず loadScoped の all から applyPeriod で切る。
- Risk/assumption: 画像の `（万円）` ラベルを信じると 10 倍になる。core の千円 fixture は 1,000 倍して円にし、合計も円で算出する。web は各月・合計の円値を 10,000 で割って万円表示する。
- Architecture fitness test: core から D1・Hono を import しないこと。PUT が月単位の DELETE を発行しないこと。
- Load/failure/security validation: 1 兆円を超える金額と 8 KiB を超える本文が拒否されること。
