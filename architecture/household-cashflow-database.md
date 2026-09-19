---
graph_node_id: "arch-household-cashflow-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "家計収支 — owner_labels 表だけを足す追加のみの migration"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "database"]
file_path: "architecture/household-cashflow-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "06cac52233e70390939c023e2c62c85b27c991c3c1e26a623c4528de81400bba"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "06cac52233e70390939c023e2c62c85b27c991c3c1e26a623c4528de81400bba", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/routes/settings.ts", "packages/core/src/types.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G2", "G4"]
---

# Architecture overview

家計収支 — owner_labels 表だけを足す追加のみの migration。`system-spec/database.md` は承認時入力、本書は保存と読み取りの制約を持つ。DDL と契約の正本は `specs/spec-household-cashflow-screen.md` §11.3 / §11.4。

## Context and drivers

- Business/technical context: 名義の内部値は `packages/core/src/types.ts:114-147` の `OWNER_VALUES` (business / spouse / family) と導出値 unset で、表示名 `OWNER_LABEL` はコードに固定されている。D1 では `institution_owners`・`rules.owner`・`tx_edits.owner` (`migrations/0009`)・`tx_splits.owner` (`migrations/0035`) が CHECK で 3 値に固定されている。振替は `migrations/0022` の `mf_transactions.is_transfer` で、相手口座の列は無い。最新の migration は `0042_total_cashflow_operations_and_exclusion_reason.sql` (qa-household-database-web-evidence-001)。
- Quality attribute priorities: G2・G4 に資する。Clean Architecture の data-access (読み書きを settings の route 1 か所に置く) と Google SRE の reliability (追加のみで巻き戻しを軽くする) を適用する。
- Constraints: Cloudflare D1 (SQLite)。既存表の行を 1 行も書き換えない (qa-household-decision-002)。

## Goals and non-goals

- Goals:
  - G4: 名義の表示名を保存する `owner_labels` 表を追加のみの migration で新設する。
  - G2: 家計の集計は既存の明細・判定・除外の表からの読み取りだけで作り、集計値を保存しない。
- Non-goals:
  - 名義の内部値の移行や既存の名義列の書き換え
  - 振替の相手口座カラムの追加 (qa-household-decision-003)
  - 新しい索引の追加・初期データの投入

## System context and boundaries

- Users/external systems: api の settings route (表示名の読み書き) と家計の route (表示名の読み取り)。
- Trust/deployment/data boundaries: 保存は利用者単位 (`user_id`)。他の利用者の行を読めない・書けない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `owner_labels` 表 | 利用者ごとの 4 名義の表示名と更新時刻 | D1 表 (PK `(user_id, owner)`) | packages/api (D1) | D1 |
| 追加のみの migration | `owner_labels` を新設し、既存表に触れない | SQL ファイル (`migrations/`) | migrations | Migrate ワークフロー |
| settings route の読み書き | 4 行以下を 1 回で読み、欠けた名義を既定で補う。更新は 4 行の upsert をまとめて行う | Hono route | packages/api | Worker |
| `runtimeSchemaGuard` の必須表 | `owner_labels` が無い環境で新経路を 503 で止める | ミドルウェア | packages/api | Worker |
| 既存の明細・判定・除外の表 | 家計集計の入力 (読み取りのみ) | 既存の読み取り関数 | packages/api (D1) | D1 |

## Cross-cutting contracts

- Identity/access: 行は `user_id` で閉じ、`c.get('userId')` で絞る (`architecture/household-cashflow-auth.md`)。
- Errors/resilience: migration 未適用の環境は既存の 503 契約で止める。更新は一部だけ変わらないようにまとめて行う。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 追加のみ。行が無い名義は既定の表示名で動き、表が空でも画面は動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/household-cashflow-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/household-cashflow-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Storage model and ownership

`owner_labels` の列は `user_id`・`owner` (CHECK で business / spouse / family / unset)・`label` (長さの上限を CHECK で守る)・`updated_at`、主キーは `(user_id, owner)`。長さの上限値は仕様書の DDL に従う (正本は `specs/spec-household-cashflow-screen.md` §11.4。その値は agent 推定・利用者未確認 (根拠 qa-household-database-web-003))。migration の番号は実装時に origin/main を fetch して次の空き番号で確定する (並行ブランチと衝突しうる)。

#### Read path

表示名の読み取りは利用者の 4 行以下を 1 回で取り、欠けた名義は core の `DEFAULT_OWNER_LABELS` で補う。家計の route も同じ読み取りで得た保存値を `ownerLabel` に渡し、応答に `label` を載せる。

#### Aggregation inputs

家計の集計値は保存せず、要求のたびに既存の明細・判定・除外の表から `loadScoped` と `loadCashflowSources` で読んで導出する。家計専用の SQL と新しい索引を足さない。振替は既存の `is_transfer` だけで扱い、相手口座の列を足さない。

#### Data verification

migration が既存表の行を 1 行も書き換えないことを検査する。`runtimeSchemaGuard` の必須表に `owner_labels` が含まれ、未適用で 503 になること。表が空のとき既定の表示名が返ること。利用者 A の保存が利用者 B に見えないこと。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-household-owner-model | 内部値は残し、表示名だけを `owner_labels` に保存する | 内部値を移行して既存の名義列を書き換える | 既存の規則・明細を壊さず、行の書き換えで Deploy が止まる復旧手順が要らない | 表示名は 4 名義 × 利用者の小さな表になる |
| dec-household-transfer-pairs | 振替の対推定のために列を足さない | 相手口座カラムを追加 | スキーマを変えずに core の推定だけで名義間を示せる | 対にならない明細は相手不明として残る |
| dec-household-ledger-source | 家計の集計値を保存せず台帳から導出する | 集計値の表を持つ | 総収支と同じ行集合から出て数字が一致する | 要求ごとの走査が必要 (infrastructure 章で許容) |
| qa-household-database-web-004 | `owner_labels` を `runtimeSchemaGuard` の必須表へ加える | ガードに加えない | 未適用の Worker が新経路を中途半端に動かさない | migrate → deploy の順序を守る必要がある |

## Delivery, migration and rollback

- Build/deploy topology: `.github/workflows/migrate.yml` で D1 へ反映してから `.github/workflows/deploy.yml` で Worker を出す。
- Migration sequence: origin/main を fetch して番号を確定 → `owner_labels` の CREATE TABLE → schema 定義と必須表への追加 → settings route の読み書き。
- Rollback trigger/procedure: 追加のみなので、巻き戻しは Worker を直前版へ戻して表を使わないことで足りる。既存行の復元は不要。

## Risks and verification

- Risk/assumption: 並行ブランチと migration 番号が衝突しうる。実装時に origin/main を fetch して確定する。
- Architecture fitness test: migration に既存表への UPDATE / DELETE / ALTER が無いこと。`owner_labels` への書き込みが settings route の 1 か所だけであること。
- Load/failure/security validation: 未適用の環境で 503 になること。利用者をまたいだ読み書きが起きないこと。
