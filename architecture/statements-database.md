---
graph_node_id: "arch-statements-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "決算書 — balance_entries に状態列を足し、監査は新表 liability_audit_log で持つ追加のみの migration 0046"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "database"]
file_path: "architecture/statements-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a72d7ffaaa1919526a5975eb739dc52250162c735a4a024818a3f05924fbbbe8"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "a72d7ffaaa1919526a5975eb739dc52250162c735a4a024818a3f05924fbbbe8", "imported_at": "2026-09-19T22:38:08Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T22:38:08Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/routes/balances.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

決算書画面 — balance_entries に状態列を足し、監査は新表 liability_audit_log で持つ追加のみの migration 0046。`system-spec/database.md` は承認時入力、本書は data 制約を持つ。DDL の正本は `migrations/0046_liability_status.sql`。

## Context and drivers

- Business/technical context: `migrations/0026_balance_entries.sql` は id・user_id・month・date・side・category・amount・source ('mf' | 'manual')・created_at・updated_at と UNIQUE(user_id, month, side, category)。『0円』と『未入力』を区別する列が無い。`migrations/0033_audit_log.sql` は action を CHECK で閉じ、0034・0039 は CHECK を広げるため audit_log_new を作って RENAME する再構築をしている。`.github/scripts/plan-auto-migration.mjs` は DROP TABLE・DROP COLUMN・DELETE FROM・UPDATE…SET・ALTER TABLE…RENAME を自動適用しない。最新は 0044。
- Quality attribute priorities: G4・G5 に資する。既存行を書き換えない (C4)、Deploy が自動適用で止まらない。
- Constraints: Cloudflare D1 (SQLite)。ADD COLUMN の NOT NULL には既定値が要り、既存列の CHECK は変えられない。

## Goals and non-goals

- Goals:
  - G4: 項目ごとに『未入力 / 0円 / 金額』を保存できる。
  - G5: 保存操作を金額なしで監査する。
- Non-goals:
  - audit_log の CHECK 拡張 (表の再構築)
  - 段階損益・前期比・原因件数の保存 (明細から導出できる)
  - 既存行の書き換え・移送

## System context and boundaries

- Users/external systems: api の balances route と statements route だけが読み書きする。
- Trust/deployment/data boundaries: すべての行は user_id で分離し、クエリは常に user_id と組で引く。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| balance_entries.status | `'zero'` / `'amount'`。既定 'amount' で既存行はそのまま金額あり | 列 | D1 | migration 0046 |
| liability_audit_log | id・user_id・actor_user_id・month・changed_json (項目ごとの状態遷移と件数、金額なし)・occurred_at | 表 | D1 | migration 0046 |
| drizzle schema.ts | 列と表の型 | TS | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: user_id と組で引く。actor_user_id はセッションの利用者。
- Errors/resilience: CHECK (status IN ('zero','amount')) で不正な状態を DB でも拒む。
- Observability/audit: liability_audit_log に保存ごと 1 件。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 追加のみ。旧 Worker は status 列を読まず、既定値 'amount' で旧 Worker の挿入も成立する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/statements-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/statements-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data model and ownership

『未入力』は行を持たないことで表す。『0円』は status=zero・amount=0 の行、『金額』は status=amount の行。既存の UNIQUE(user_id, month, side, category) がそのまま『1 項目 1 状態』を保証する。source=mf の行は取込が所有し、手入力の保存は触れない。

#### Storage and access patterns

保存は (user_id, month, side='liability', category) の upsert、unset は同じキーの delete (source='manual' に限る)。読みは基準月の負債行を 1 回で引く。

#### Consistency and transactions

1 回の PUT の upsert / delete と監査 insert を D1 の batch 1 回で書く。

#### Migration and compatibility

`migrations/0046_liability_status.sql`:
`ALTER TABLE balance_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'amount' CHECK (status IN ('zero','amount'));` と
`CREATE TABLE liability_audit_log (...)` (user_id に index)。
ADD COLUMN と CREATE TABLE だけなので plan-auto-migration の自動適用で止まらない。`0045_owner_labels.sql` が先に存在したため、計画時の 0045 から 0046 へ繰り下げた。

#### Retention and deletion

既存の利用者データ削除の経路に liability_audit_log を加える (利用者の削除で監査も消す)。

#### Data verification

migration 適用前後で既存行の amount・source が変わらないこと、既存行の status が 'amount' になること、CHECK が 'unset' を拒むこと。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-database-web-002 | status 列を足し、未入力は行の不在で表す | status に 'unset' を含めて行を持つ | 既存の UNIQUE と『行が無い = 未入力』の既存解釈をそのまま使える | unset への変更は delete になる |
| qa-statements-decision-007 | 監査は新表 liability_audit_log | audit_log の CHECK を再構築で拡張 | 再構築は DROP TABLE と RENAME を含み Deploy の自動適用で止まり、C4 に反する | 監査が 2 表に分かれる |
| qa-statements-decision-007 | 監査に金額を残さない | 変更前後の金額を残す | 監査表が金額の複製にならない | 金額の履歴は追えない (状態遷移と件数のみ) |

## Delivery, migration and rollback

- Build/deploy topology: 既存の migrate.yml と Deploy の自動適用。
- Migration sequence: 0046 を適用 → runtimeSchemaGuard の必須列に status と liability_audit_log を加えた Worker を配信。
- Rollback trigger/procedure: Worker を戻すだけでよい。列と表は残しても旧 Worker は使わない (DROP はしない)。

## Risks and verification

- Risk/assumption: 並行サイクル (家計収支) と migration 番号が衝突する。sync 前に origin/main を fetch して番号を確かめる。
- Risk/assumption: runtimeSchemaGuard の必須列を足し忘れると、migration 未適用の環境で新しい保存経路が途中まで動く。
- Architecture fitness test: 0046 に DROP・DELETE・UPDATE…SET・RENAME が無いこと (plan-auto-migration の判定)。
- Load/failure/security validation: 既存行の不変性テスト。
