---
graph_node_id: "arch-ai-analysis-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "AI分析 — task出来事とレポート不変条件をD1で守る migration 0046/0047"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "database"]
file_path: "architecture/ai-analysis-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "1a0540e072013253e364b82ad4a3f1e91124019fd5baba6c85772025d47dcbfb"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "1a0540e072013253e364b82ad4a3f1e91124019fd5baba6c85772025d47dcbfb", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations", "packages/api/src/schema-guard.ts", "packages/api/src/routes/ai.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G2", "G5"]
---

# Architecture overview

AI分析 — 0046でai_tasksの出来事を追加し、0047でレポート版の一意性と1依頼1レポートを守る。`system-spec/database.md` は承認時入力、本書は保存形と書き込みの持ち主の制約を持つ。

## Context and drivers

- Business/technical context: `ai_tasks` (`packages/api/src/db/schema.ts:589-611`) は id・user_id・period_from/to・report_type・supplement・parent_report_id・token_hash・expires_at・used_at・copied_at・copied_target・report_id・created_at を持ち、連番・データ取得時刻・差し戻し・取消の列は無い。`ai_reports` (`schema.ts:620-640`) は version・parent_report_id・title・summary・body_json・archived_at を持つ。migration は `migrations/` 直下の連番で、最新は `0045_owner_labels.sql` (qa-ai-database-web-evidence-001)。
- Quality attribute priorities: G2・G5 に資する。DDD の『永続化するのはドメインの状態であって表示の都合ではない』を列の選び方に適用する。
- Constraints: D1 (SQLite)。本文・参照を失わない。段階・進捗・版の説明は保存しない。

## Goals and non-goals

- Goals:
  - G2: `ai_tasks` に `seq`・`data_fetched_at`・`rejected_at`・`reject_count` (既定 0)・`canceled_at` を足し、段階を記録から導けるようにする。
  - G2: `(user_id, seq)` に一意索引を張り、利用者ごとの T-番号を欠番なく振る。
  - G5: 0047 は旧重複版を作成順に連番化し、本文と参照を保持したまま以後の競合を拒否する。
- Non-goals:
  - レポート本文の削除、版の説明の列追加
  - 段階名・進捗 % の列
  - 既存行への連番の後付け

## System context and boundaries

- Users/external systems: api の AI 経路だけが `ai_tasks` を読み書きする。
- Trust/deployment/data boundaries: 読み書きは route 側に閉じ、core の段階の導出は時刻列を受け取るだけで D1 を知らない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `migrations/0046_*.sql` | `ai_tasks` への 5 列と一意索引の追加 | SQL | D1 | Migrate ワークフロー |
| `migrations/0047_*.sql` | 版系列の一意索引と1依頼1レポートtrigger | SQL | D1 | Migrate ワークフロー |
| `schema.ts` の `aiTasks` | drizzle の列定義 | drizzle | packages/api | Worker |
| `schema-guard.ts` | Worker が前提とする migration の先頭を 0046 に進める | Hono middleware | packages/api | Worker |
| AI 経路 | 出来事ごとに 1 列だけを書く | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 全ての読み書きに `user_id` の条件を含める (`architecture/ai-analysis-auth.md`)。
- Errors/resilience: 連番の衝突は一意索引で検出し、1 回だけ採番し直す。
- Observability/audit: N/A: 新しい信号を追加しない。出来事の時刻列が依頼ごとの記録を兼ねる。
- Configuration/secrets: 追加の秘密情報を持たない。
- Compatibility/versioning: 列は NULL 許容 (`reject_count` だけ既定 0) で、旧 Worker は新しい列を読まない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/ai-analysis-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/ai-analysis-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

`ai_tasks` は依頼の出来事の記録、`ai_reports` は受信したレポートの版で、どちらも利用者ごとに閉じる。後から導けない出来事 (データを取りに来た、差し戻した、取り消した、採番した) だけを列にし、導ける値 (段階・進捗・T-番号の文字列・版の説明) は保存しない。

#### Logical and physical model

0046の追加列は `seq`、`data_fetched_at`・`rejected_at`・`canceled_at`、`reject_count`。0047は `(user_id, report_type, period_from, period_to, version)` を一意にし、同じ `task_id` の新規レポートをtriggerで拒否する。

#### Access and consistency

書き込みは各経路1か所に置く。`data_fetched_at` は初回値を保持し、応答直前CASで取消・期限・受信との競合を確定する。task claim と report INSERT は同じ D1 batch で成功またはrollbackし、版番号はINSERT内の `MAX(version)+1` で決める。

#### Lifecycle and governance

既存行の `seq` は NULL のままで、画面は T-番号の代わりに『旧』と作成日を出す (agent 推定・利用者未確認、根拠 qa-ai-database-web-003)。削除は結果の無い依頼だけで、キャンセルした依頼は行を残す。受信済みの依頼とレポートは従来どおり消さない。

#### Migration and recovery

0046は追加だけ。0047は既存の重複版を本文・参照を失わず作成日時/id順に連番化してから一意索引を作る。旧task重複は保持し、triggerは今後のINSERTだけを止める。`EXPECTED_D1_MIGRATION` は0047で、適用前のWorkerは503 `schema_unavailable` になる。本番適用前にはD1 backup/time-travel確認を行う。

#### Data verification

migration の後に既存の依頼とレポートが一覧と詳細で読めること (S6)、既存行の `seq` が NULL のままであることを確かめる。同じ利用者で依頼を続けて発行したとき T-0001 から欠番なく振られること、別の利用者の連番が独立していることを API テストで確かめる。`EXPECTED_D1_MIGRATION` と `migrations/` の最新が一致することは既存のテスト (`packages/api/src/index.test.ts` などが import) が検知する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-database-web-001 | 追加のみの migration 0046 で 5 列を足す | 段階名の列 1 本 | 出来事の時刻が残り、段階の規則を変えても再計算で済む | 列が 5 本増える |
| qa-ai-database-web-001 | `ai_reports` は変えない | 版の説明の列を足す | 補足指示から導けるので二重に持たない | 版の説明は依頼が消えると既定文になる |
| qa-ai-database-web-003 | 連番を max(seq)+1 と一意索引で採番 (agent 推定・利用者未確認) | 採番用の表を持つ | 表を増やさず、衝突は索引で検出できる | 衝突時に 1 回の採り直しが要る |
| qa-ai-database-web-003 | 既存行は `seq` NULL のまま『旧』と表示 (agent 推定・利用者未確認) | 作成日順に連番を後付け | 既存行を書き換えない | 旧行の ID 欄は T-番号にならない |

## Delivery, migration and rollback

- Build/deploy topology: D1 の migration は既存の Migrate ワークフロー、Worker は既存の Deploy ワークフロー。
- Migration sequence: `0046` の SQL と `schema.ts` の列 → `EXPECTED_D1_MIGRATION` を 0046 へ → Migrate の適用 → Deploy。
- Rollback trigger/procedure: 適用後の不具合は Worker を戻して対処し、列は落とさない。

## Risks and verification

- Risk/assumption: 同じ利用者が同時に依頼を発行すると連番が衝突する。一意索引で検出し、採り直しを 1 回に限ってテストで固定する。
- Architecture fitness test: `0046` に `UPDATE` と `DROP` が無いこと。段階名・進捗の列が無いこと。
- Load/failure/security validation: 採番は `user_id` の索引で 1 行を読む。migration 前の Worker で新経路が 503 になることを確かめる。
