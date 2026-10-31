---
graph_node_id: "arch-budget-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "予算 — 期間別の年額表 budget_plans を足す追加のみの migration とバックアップ・復元への編入"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "database"]
file_path: "architecture/budget-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a27bde88c9d11399fcacdf470fb1e1a25db503a875d1b5b26b5ee648721353d3"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "a27bde88c9d11399fcacdf470fb1e1a25db503a875d1b5b26b5ee648721353d3", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-auth"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/routes/budget-plans.ts", "packages/core/src/dataset.ts", "packages/core/src/fingerprint.ts", "packages/core/src/types.ts", "docs/data-schema.md"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G3", "G5"]
---

# Architecture overview

予算 — 期間別の年額表 `budget_plans` を足す追加のみの migration とバックアップ・復元への編入。`system-spec/database.md` は承認時入力、本書は予算の保存単位・既存 `budgets` との関係・JSON の書き出しと復元への編入の制約を持つ。列と制約の逐語の正本は `specs/spec-budget-screen.md`。

## Context and drivers

- Business/technical context: `migrations/0000_init.sql` 55 行目の `budgets` は `(user_id TEXT, account TEXT, monthly_amount INTEGER, PRIMARY KEY(user_id, account))` で、期間と収入・支出の区別を持たない。`packages/api/src/db/schema.ts` 345〜349 行目が同じ定義。migrations の最新は `0047_classify_workbench.sql` で、`packages/api/src/schema-guard.ts` の `EXPECTED_D1_MIGRATION` も同じ。`packages/api/src/import-active.ts` の `JSON_SNAPSHOT_MUTATION_CONSUMERS` に `budgets` があり、変更時に JSON snapshot を無効化する。`packages/api/src/import-lifecycle.ts` 1511〜1514 行目は JSON の復元で `budgets` を消して入れ直す。行書き換えの migration で Deploy が止まった過去があり、追加のみを原則にしている (qa-budget-database-web-evidence-001)。
- Quality attribute priorities: G3・G5 に資する。Clean Architecture の data-access (1 期間ぶんの予算を 1 回の読取りで返せる主キー、根拠の表示のために別表を結合しない) と Google SRE の reliability (追加のみの migration 1 本で行の巻き戻しを要らなくし、毎晩のバックアップから予算が戻る) を適用する。
- Constraints: Cloudflare D1 (SQLite) + Drizzle。migration は追加のみで既存行を書き換えない。既存 `budgets` 表は残す (C3)。算出値 (自動提案・見通し・KPI) は保存せず、要求のたびに core で導出する。

## Goals and non-goals

- Goals:
  - G3: 予算を 予算対象の開始月 × 科目 の単位で、年額・収入 / 支出の区別・計画による調整額・調整の理由・更新時刻とともに保存する表 `budget_plans` を、追加のみの migration 1 本 (`0050` を予定) で設ける。同じ期間は上書きで、版は持たない (qa-budget-database-web-001)。
  - G3: 保存行の無い期間の初期値は既存 `budgets` の月額 × 12 を読み出して示すだけで、表へは書かない。
  - G5: `budget_plans` を JSON の書き出しと復元 (Dataset・`import-lifecycle`)、JSON snapshot の無効化、指紋の対象に加え、毎晩のバックアップから予算が戻るようにする。
- Non-goals:
  - 既存 `budgets` の行の書き換え・削除・列の追加
  - 予算の版・履歴の表
  - 自動提案・見通し・KPI の保存
  - 下書きの保存 (端末の localStorage に置く)

## System context and boundaries

- Users/external systems: api の予算の保存 route と JSON の復元 (`import-lifecycle.ts`) だけが `budget_plans` を書く。web は API 越しにしか触れない。
- Trust/deployment/data boundaries: `budget_plans` は `user_id` を主キーの先頭に持ち、読み書きは利用者単位で閉じる。migration の反映は既存の `migrate.yml` が行う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `migrations/0050_budget_plans.sql` (予定) | `budget_plans` の作成だけを行う | SQL | migrations | D1 |
| `budget_plans` | 利用者 × 予算対象の開始月 × 科目 の年額・区別・調整額・理由・更新時刻 | Drizzle | packages/api | D1 |
| `budgets` (既存・不変) | 期間を持たない科目別の月額。保存行の無い期間の初期値の出所 | Drizzle | packages/api | D1 |
| `loadDataset` (`store.ts`) | `budget_plans` を読み、Dataset に載せる | 関数 | packages/api | Worker |
| Dataset の JSON (`dataset.ts`)・指紋 (`fingerprint.ts`) | 予算の行を書き出し・読み込み・指紋に含める | 純関数 | packages/core | 同一 Worker |
| JSON の復元 (`import-lifecycle.ts`) | 復元時に `budget_plans` を消して入れ直す | 関数 | packages/api | Worker |
| `schema-guard.ts` | 期待する最新 migration を 0050 に上げ、未適用なら 503 | Hono ミドルウェア | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: `budget_plans` の読み書きは `WHERE user_id = ?` を必ず含む (`architecture/budget-auth.md`)。
- Errors/resilience: 値の範囲・長さの違反は zod で 400 にし、DB の CHECK でも止める。migration 未適用は `runtimeSchemaGuard` の 503。
- Observability/audit: N/A: 変更履歴の表を持たない。`updated_at` が最終保存時刻の正本。
- Configuration/secrets: N/A: 追加の設定・秘密情報を持たない。
- Compatibility/versioning: 新表の追加だけで既存表は変えないため、直前版の Worker が新しい schema の上でそのまま動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/budget-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/budget-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/budget-security.md`)

### Data architecture

#### Data domains and ownership

- Domains/entities/source of truth: 予算の計画 (`budget_plans`、予算対象ごとの年額の正本)・旧予算 (`budgets`、期間を持たない月額、初期値の出所としてだけ読む)・取込の明細 (前期実績の入力、予算では書かない)。自動提案・見通し・KPI・過不足・インパクトは正本を持たず、core が導く。
- Data ownership/stewardship: `budget_plans` の書込は予算の保存 route と JSON の復元に限る。
- Classification/residency: 利用者の事業の予算と計画の理由。D1 の既存の保管場所から動かさない。

#### Logical and physical model

- Conceptual/logical model: 以下の列は agent 推定・利用者未確認 (根拠 qa-budget-database-web-002)。
  - `budget_plans`: `user_id TEXT NOT NULL`・`period_start TEXT NOT NULL` ('YYYY-MM')・`account TEXT NOT NULL`・`kind TEXT NOT NULL` ('income' | 'expense')・`annual_amount INTEGER NOT NULL`・`plan_adjustment INTEGER NOT NULL DEFAULT 0`・`plan_reason TEXT` (100 字以内)・`updated_at TEXT NOT NULL`。主キーは `(user_id, period_start, account)`。
  - 年額と調整額は ±10,000,000,000 円以内の整数、科目名は 60 字以内 (agent 推定・利用者未確認、根拠 qa-budget-security-web-002)。
- Physical store/engine/version: Cloudflare D1 (SQLite)。Drizzle の schema 定義 (`schema.ts`) と migration の SQL を同じ変更で揃える。
- Schema/index/partition decisions: 主キーの並び `(user_id, period_start, account)` で 1 期間ぶんの読取りと削除が主キーの範囲で済むため、追加の索引を足さない。計画による調整額と理由を同じ行に持たせ、別表を結合しない。

#### Access and consistency

- Query/access patterns: 画面用の取得は予算対象 1 期間ぶんを `WHERE user_id = ? AND period_start = ?` で 1 回読む。予算の読み出し関数の入力として、Dataset の読込みで利用者の `budget_plans` を読む。
- Transaction/consistency/idempotency: 変更系フェンス内で現行 revision と `baseSavedAt` を照合し、dirty 科目の DELETE・nonnull 行の JSON INSERT・残存行の revision 更新・JSON snapshot の無効化を 1 回の D1 batch にする。途中で失敗しても前の予算が残り、stale な同じ本文の再送は 409 で止まる。
- Cache/replica/search consistency: N/A: キャッシュ・レプリカ・検索索引を持たない。

#### Lifecycle and governance

- Retention/archival/deletion: 予算の行は利用者が dirty patch の `annualAmount:null` で削除する。保存期間の定めは無い。
- Privacy/audit/lineage: 調整の理由は外部へ送らない。JSON バックアップ (R2 `backups/`、30 日保持) に含まれる。
- Data quality/contracts: `kind` の CHECK (`income` / `expense`)、`period_start` の書式、年額・調整額の範囲、理由の長さを zod と DB の両方で止める。

#### Migration and recovery

- Migration/backfill/dual-write/cutover: migration は `CREATE TABLE` だけの 1 本 (番号 0050 は予定。`origin/main` で番号を確かめてから確定する)。既存 `budgets` から埋め戻さず、保存行の無い期間は読み出し時に月額 × 12 を初期値にする。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を同じ変更で上げる。
- Backup/restore/RPO/RTO: `budget_plans` を Dataset の JSON (`dataset.ts`)・`loadDataset` / `loadBackupPayload`・`fingerprint.ts`・`JSON_SNAPSHOT_MUTATION_CONSUMERS` (`import-active.ts`)・JSON の復元 (`import-lifecycle.ts`) に加え、既存の毎晩のバックアップから予算が戻るようにする。旧形式の JSON (予算の行を持たない) の復元は `budget_plans` を空にするか残すかを `budgets` と同じ規則 (復元先が空なら DELETE を省く) に揃える。
- Rollback/forward-fix: 追加表は直前版の Worker に無視されるため、Worker を戻すだけで足りる。schema は戻さず forward-fix にする。

#### Data verification

migration を空の D1 と 0047 まで適用した D1 の両方に当て、既存の全表の行が 1 行も変わらないことを検査する。`schema.ts` と migration の列が一致することを既存の schema テストで確かめる。API 統合テストで、期間ごとの保存と同じ期間の上書き、保存行の無い期間で既存月額 × 12 が初期値になること、JSON の書き出し → 復元で `budget_plans` が戻ることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-decision-001 | 予算対象ごとの年額表を新設する (期間別の年額表) | 既存の月額のまま / 版つきの予算計画 | 画像の予算対象と年額入力を満たし、既存行を書き換えず、監査が除いた版管理も持ち込まない | 既存の予算の読み手を読み出し関数へ寄せる改修が要る |
| qa-budget-database-web-001 | 追加のみの migration 1 本にし、既存 `budgets` は残して書き換えない | `budgets` に期間の列を足して埋め戻す | Deploy が止まったときの復旧が軽く、直前版の Worker と共存できる | 2 つの表を読む規則 (保存行があれば新表、無ければ月額 × 12) を core に持つ |
| qa-budget-database-web-001 | 保存行の無い期間の初期値は読み出し時に作り、表へは書かない | 開いた時点で初期値を保存する | GET が書込を伴わず、既存行の書き換え 0 件を守れる | 保存するまで初期値は画面だけの値になる |
| qa-budget-database-web-001 | `budget_plans` を JSON バックアップ・復元・snapshot 無効化・指紋の対象に加える | 対象外にする | 毎晩のバックアップから予算が戻り、指紋が古いままにならない | 復元の write-set と Dataset の型が広がる |
| qa-budget-database-web-002 | 主キー `(user_id, period_start, account)`、保存は base revision つき dirty 科目の DELETE + JSON INSERT + revision 更新の 1 batch | 期間全行の置換 | 他画面の未編集行を古い値で上書きせず、競合を検知できる | web は dirty 行と base revision を送る |

## Delivery, migration and rollback

- Build/deploy topology: `migrate.yml` で D1 へ反映してから `deploy.yml` で Worker を配信する既存の順。
- Migration sequence: `origin/main` の fetch と番号確認 → migration の SQL と `schema.ts` の追加 → `EXPECTED_D1_MIGRATION` の更新 → Dataset・バックアップ・復元・指紋への編入 → ローカル D1 への適用とテスト → Migrate → Deploy。
- Rollback trigger/procedure: Deploy 後に不具合が出たら Worker を直前版へ戻す。schema は追加のみなので戻さない。Migrate だけ通って Deploy が止まった場合は Deploy を再実行する。

## Risks and verification

- Risk/assumption: 長い作業の間に main 側で別の migration が 0050 を使うと、git の衝突に出ずに番号が重なる。着手時と PR 前に `origin/main` を fetch して確かめる。
- Risk/assumption: `packages/api/src/deletion-full-reset.ts` は既存 `budgets` を消していない。`budget_plans` を全削除の対象にするかは system-spec に無く、既存 `budgets` と揃えて対象外にするかを仕様で決める。
- Risk/assumption: 旧形式のバックアップ JSON には予算の行が無い。復元で `budget_plans` を消すと予算が失われ、消さないと復元前の予算が残る。規則を `specs/spec-budget-screen.md` で固定し、復元のテストで確かめる。
- Architecture fitness test: migration に `UPDATE`・`DELETE`・`DROP`・`ALTER` が無いこと。`budget_plans` の読み書きに `user_id` の条件があること。`EXPECTED_D1_MIGRATION` が最新の migration と一致すること。
- Load/failure/security validation: 200 dirty 行の保存が 1 batch (3〜5 文) で書けること。batch の失敗で前の予算が残り、revision 不一致が 409 になること。
