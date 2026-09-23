---
graph_node_id: "arch-cash-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "現金入力 — 追加のみの migration 0052 で owner・transit_purpose・deleted_at を足し、既存行を書き換えずに論理削除と名義を持つ"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "database"]
file_path: "architecture/cash-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a956740a1c4085f5d7bff8b9f49d6a114c452b20336491a6ce713bca62b63c1d"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "a956740a1c4085f5d7bff8b9f49d6a114c452b20336491a6ce713bca62b63c1d", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/routes/cash.ts", "packages/api/src/deletion-schema.test.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G2", "G4"]
---

# Architecture overview

現金入力 — 追加のみの migration `0052` で `cash_entries` に `owner` (名義)・`transit_purpose` (業務の目的)・`deleted_at` (論理削除) を足し、`(user_id, deleted_at)` の索引を張る。既存行は書き換えない。入力経路は列を持たず `transit_from` の有無から導く。`system-spec/database.md` は承認時入力、本書は列・索引・読取条件・保持期間・移行の制約を持つ。

## Context and drivers

- Business/technical context: `cash_entries` は `packages/api/src/db/schema.ts:439-464` にあり、列は id・user_id・date・month・side・io・amount・description・category_major・category_mid・memo・transit_from・transit_to・transit_round・receipt_waived・created_at・updated_at。索引は `idx_cash_month` (user_id, month) だけ。最新 migration は `0049_ai_report_invariants.sql`。`deletion-retention.ts` の tombstone は取込削除の取り消し用で、本件とは別用途 (qa-cash-database-web-evidence-001)。
- Quality attribute priorities: G2・G4 に資する。DDD の『永続化するのは状態であって表示ではない』を適用し、入力経路や『未設定』の表示を列にしない (agent 推定・利用者未確認、design_applications)。上流指針は data-access と reliability (Google SRE)。
- Constraints: D1 (SQLite)。SQLite の `ALTER TABLE ... ADD COLUMN` は列の追加だけを行い既存行を書き換えない。migration は 0052 から採番し、既存行と `cashToDeal` / `cashToTx` の結果を変えない (C2)。

## Goals and non-goals

- Goals:
  - G2: `deleted_at` で論理削除を表し、30 日を過ぎた行を夜間に完全消去する。
  - G4: 名義を `owner` の CHECK で限り、削除中の行を全読取経路で外す。
- Non-goals:
  - 入力経路の列 (qa-cash-decision-004)
  - 既存行の owner の埋め戻し (NULL のまま『未設定』と表示する。qa-cash-database-web-003、agent 推定・利用者未確認)
  - 領収書の保存先 (qa-cash-decision-001)

## System context and boundaries

- Users/external systems: api の Worker だけが D1 を読み書きする。
- Trust/deployment/data boundaries: 全ての行は `user_id` を持ち、読み書きは `user_id` を条件にする (`architecture/cash-auth.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `migrations/0052_*.sql` | 列 3 本と索引 1 本の追加 | SQL | D1 | Migrate ワークフロー |
| `db/schema.ts` の `cashEntries` | Drizzle の型に 3 列と索引を足す | Drizzle | packages/api | Worker |
| `schema-guard.ts` | Worker が前提とする schema head | `EXPECTED_D1_MIGRATION` | packages/api | Worker |
| `store.ts` / `routes/settings.ts` の読取 | `deleted_at IS NULL` で絞る | SQL / Drizzle | packages/api | Worker |
| `import-lifecycle.ts` の JSON 復元 | 新しい列を含む INSERT | SQL | packages/api | Worker |
| 夜間 job `cash_soft_delete_purge` | 30 日超の完全消去 | SQL | packages/api | Worker scheduled |

## Cross-cutting contracts

- Identity/access: 行は `user_id` で分離する。
- Errors/resilience: CHECK 違反は API の zod で先に 400 にし、DB に届かせない。migration が未適用なら `runtimeSchemaGuard` が 503 を返す。
- Observability/audit: 完全消去の件数を夜間 job の JSON ログに出す (`architecture/cash-maintenance-ops.md`)。
- Configuration/secrets: N/A: 新しい設定は無い。
- Compatibility/versioning: 列は全て NULL 可で既定値を持たないため、旧 Worker の INSERT もそのまま通る。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/cash-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/cash-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

現金明細は利用者ごとの記録で、正本は `cash_entries`。取引・集計は `cash_entries` から作り直す派生物で、論理削除・復元のたびに同じ batch で作り直す (`architecture/cash-backend.md`)。

#### Logical and physical model

- `owner TEXT NULL CHECK (owner IN ('business','spouse','family'))`。語彙は core の `OWNER_VALUES` (`packages/core/src/types.ts:114`) と同じ (qa-cash-database-web-002、qa-cash-decision-002)。
- `transit_purpose TEXT NULL`。候補は API の zod で限る (`architecture/cash-security.md`)。
- `deleted_at TEXT NULL` (ISO 8601)。
- 索引 `(user_id, deleted_at)` を足す。既存の `idx_cash_month` は残す。
- 入力経路は `transit_from IS NOT NULL` なら交通費入力、それ以外は通常入力と導く (qa-cash-database-web-003、agent 推定・利用者未確認)。

#### Access and consistency

`deleted_at IS NULL` を cash_entries を読む全経路 5 本 — `loadCashEntries` (`store.ts:521-528`。一覧と `loadDataset` が使う)、`BACKUP_SNAPSHOT_SQL` (`store.ts:740` 起点、cash 節 `:793-795`。エクスポートと夜間バックアップが共有)、`loadImportRestoreSettingsSnapshot` (`store.ts:1070`、cash 節 `:1098-1103`。取込時の設定スナップショット)、`loadCategoryUsageContext` (`routes/settings.ts:374`、select は `:379`。科目使用状況)、PUT の既存行取得 (`routes/cash.ts`) — に掛ける (C2 / I3)。完全消去 job だけが削除中の行を読む。JSON 復元の「移行先の現金明細が 0 件か」の判定だけは削除中の行も数える (`loadImportRestoreSettingsSnapshot` の `destination_counts` (`store.ts:1128-1139`) に削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残る間は現金明細を復元せず理由を表示する。例外はこの件数 1 つだけで、削除中の行の中身はどの出力にも出さない (利用者決定 qa-cash-decision-009)。

#### Lifecycle and governance

削除 → `deleted_at` を入れる → 30 日以内なら復元で NULL に戻す → 30 日を過ぎた行は夜間 job が物理削除する (qa-cash-decision-003)。完全消去は 1 晩最大 500 行で、残りは翌晩に続ける (qa-cash-database-web-003、agent 推定・利用者未確認)。完全消去後の id の復元は 404。

#### Migration and recovery

0052 は `ALTER TABLE cash_entries ADD COLUMN` 3 本と `CREATE INDEX` 1 本だけで、UPDATE を含まない。`schema-guard.ts:4` の `EXPECTED_D1_MIGRATION` を 0052 の migration ファイル名へ進める (列の一覧ではなく migration 名で判定する。system-spec と一致)。列の存在は `PRAGMA table_info` で確かめるテスト (前例 `deletion-schema.test.ts:35`) で補う。夜間 cron の完全消去 job は `/api/*` に掛かる `runtimeSchemaGuard` の外で動くため、0052 の適用 (Migrate) を Worker の配備 (Deploy) より先に行う既存の順序で守る。JSON 復元の列リスト (`import-lifecycle.ts:1552` の `restoreCashEntryStatements`) に 3 列を足し、エクスポートと復元で削除中の状態と名義が往復するようにする (qa-cash-database-web-002)。

#### Data verification

migration の適用後に `PRAGMA table_info(cash_entries)` で 3 列、`PRAGMA index_list` で索引を確かめる。既存行の `cashToDeal` / `cashToTx` の結果が 0052 の前後で同じであることをテストで確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-database-web-002 | 3 列を NULL 可で追加し、既存行を書き換えない | 既定値つきで埋め戻す | 追加だけなので失敗時の影響が小さく、C2 を守れる | 既存行の owner は『未設定』 |
| qa-cash-decision-003 | `deleted_at` で論理削除し 30 日で完全消去 | 削除済みの別表へ移す | 同じ id のまま戻せ、表が 1 つで済む | 全読取経路に条件が要る |
| qa-cash-decision-004 | 入力経路は列を持たず導出 | `entry_route` 列 | 区間の有無と矛盾しない | 導出規則を core に置く |
| qa-cash-database-web-003 | 1 晩 500 行・既存 owner は NULL・担当者の既定 (agent 推定・利用者未確認) | 上限なしで消す | 夜間の D1 予算に収める | 大量削除は数晩に分かれる |
| qa-cash-database-web-002 | `(user_id, deleted_at)` の索引を足す | 索引なし | 完全消去と読取の絞り込みが全件走査にならない | 書込時の索引更新が 1 本増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Migrate ワークフロー (`.github/workflows/migrate.yml`) で 0052 を適用してから Deploy (`deploy.yml`)。
- Migration sequence: 0052 の SQL → `schema.ts` の型 → `EXPECTED_D1_MIGRATION` → 読取条件 → JSON 復元の列 → 完全消去 job。
- Rollback trigger/procedure: Worker を戻しても 0052 の列は落とさない (列の削除は行わない)。旧 Worker は `deleted_at` を読まないため、差し戻し中は削除中の行が再び見える。差し戻しの前に削除中の件数を確かめる。

## Risks and verification

- Risk/assumption: 完全消去 job は `runtimeSchemaGuard` の外で動くので、0052 未適用の D1 に新 Worker の cron が当たらないよう Migrate → Deploy の順を崩さない。
- Risk/assumption: `runtimeSchemaGuard` は列を見ないため、0052 の名前だけ記録されて列が欠ける状態は検出しない。PRAGMA のテストで補う。
- Architecture fitness test: 0052 に UPDATE / DELETE / DROP が無いこと。`cash_entries` の読取に `deleted_at` 条件の無いものが完全消去 job 以外に無いこと。
- Load/failure/security validation: 500 行の完全消去が夜間の D1 予算内に収まることを予算表のテストで確かめる (`architecture/cash-infrastructure.md`)。
