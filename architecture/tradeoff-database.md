---
graph_node_id: "arch-tradeoff-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "トレードオフ — 追加のみの migration で試算条件の列と候補ごとの上書きの表を足す"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "database"]
file_path: "architecture/tradeoff-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f83a4e3de0ac081a8399e78ef1a668a510a56fa1757973a401ed8834ddae0c26"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "f83a4e3de0ac081a8399e78ef1a668a510a56fa1757973a401ed8834ddae0c26", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations", "packages/api/src/schema-guard.ts", "packages/api/src/routes/analytics.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G3", "G5"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — 追加のみの migration で試算条件の列と候補ごとの上書きの表を足す。`system-spec/database.md` は承認時入力、本書は表と列と migration の制約を持つ。正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「データモデル」。

## Context and drivers

- Business/technical context: `tradeoff_plans` (`migrations/0000_init.sql:85-95`、`packages/api/src/db/schema.ts:610-620`) は id, user_id, title, amount, recurring, selected, covered, verdict, created_at を持ち、開始月とメモが無い。上書きの表は無い。`freee_deals` は候補の集計に要る列を持つ。最新の migration は `0049_ai_report_invariants.sql` (qa-tradeoff-database-web-evidence-001)。
- Quality attribute priorities: G3・G5。追加のみの schema 進化 (C3)。
- Constraints: D1 (SQLite)。行を書き換える migration を作らない。

## Goals and non-goals

- Goals:
  - G3: 候補ごとの上書き (必要度・メモ) を新表 `tradeoff_candidate_notes` に置く (qa-tradeoff-database-web-001 / 003)。
  - G5: `tradeoff_plans` に `start_month`・`memo` を ADD COLUMN し、`selected` の JSON に候補キーを含める。
- Non-goals:
  - 候補・推定値・差額の保存
  - 既存行の書き換え・削除

## System context and boundaries

- Users/external systems: api の route だけが読み書きする。
- Trust/deployment/data boundaries: 全行を `user_id` で分ける。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `tradeoff_plans` (+ start_month, memo) | 試算の記録 (履歴) | D1 表 | packages/api | D1 |
| `tradeoff_candidate_notes` | 候補ごとの上書き | D1 表 | packages/api | D1 |
| `freee_deals` | 候補の元 (読むだけ) | D1 表 | packages/api | D1 |
| migration 0050 (予定番号) | 列と表の追加 | SQL | migrations | D1 |

## Cross-cutting contracts

- Identity/access: `user_id` で絞る (`architecture/tradeoff-auth.md`)。
- Errors/resilience: 一意索引 `(user_id, candidate_key)` で upsert の重複を防ぐ。
- Observability/audit: `created_at` / `updated_at`。
- Configuration/secrets: N/A。
- Compatibility/versioning: 既存行は NULL として読み、`tradeoffReview` は壊れない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

試算の記録と上書きは利用者ごと。候補は `freee_deals` からの導出で、所有しない。

#### Logical and physical model

`tradeoff_candidate_notes(user_id TEXT NOT NULL, candidate_key TEXT NOT NULL, need TEXT NULL (low/mid/high), memo TEXT NULL, updated_at TEXT NOT NULL)`、一意索引 `(user_id, candidate_key)`。`tradeoff_plans.start_month TEXT NULL (YYYY-MM)`、`tradeoff_plans.memo TEXT NULL`。候補キーは core の `tradeoffCandidateKey(account_norm, partner)` が作る `v1:${JSON.stringify([account_norm, partner])}` とし、`parseTradeoffCandidateKey` で可逆解析する。0050 は未公開・未適用のため旧 `account|partner` 形式は保存・移行しない。

#### Access and consistency

上書きは `INSERT ... ON CONFLICT(user_id, candidate_key) DO UPDATE`。need と memo が両方 NULL なら行を消す。記録は 1 行の INSERT。

#### Lifecycle and governance

記録は追加だけで消さない。上書きは利用者の操作で消える (自動へ戻す)。

#### Migration and recovery

0050 は CREATE TABLE と ALTER TABLE ADD COLUMN だけ。番号はマージ時点の最新 +1 に付け替える (qa-tradeoff-maintenance-ops-web-003)。`EXPECTED_D1_MIGRATION` を同じ変更で進める。

#### Data verification

api テストで 0050 適用後の既存行の更新 0 件、upsert の一意、両方 NULL で削除、利用者の分離を確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-database-web-001 | 追加のみの migration | 既存表の作り直し | 旧 Worker と既存行が壊れない | 旧行は NULL を持つ |
| qa-tradeoff-database-web-003 | 上書きを別表で候補キーごとに 1 行 (agent 推定・利用者未確認) | tradeoff_plans に JSON で持つ | 記録と上書きの寿命が違う | 候補キーの形に依存する |
| qa-tradeoff-decision-008 | 押すたびに追加 | 最新 1 行を更新 | 履歴が残る | 行が増え続ける |

## Delivery, migration and rollback

- Build/deploy topology: D1。
- Migration sequence: 0050 を Migrate → Deploy (`architecture/tradeoff-infrastructure.md`)。
- Rollback trigger/procedure: 追加だけなので Worker を戻すだけでよい。

## Risks and verification

- Risk/assumption: 番号の衝突。マージ時点の最新 +1 に付け替え、lineage の追跡下は据え置く。
- Architecture fitness test: 0050 に UPDATE / DELETE / DROP が無い。
- Load/failure/security validation: 候補キー 300 字以下 (`architecture/tradeoff-security.md`)。
