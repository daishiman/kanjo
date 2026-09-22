---
graph_node_id: "arch-cash-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "現金入力 — 完全消去を既存の夜間 cron に独立 job で相乗りさせ、新しい binding・cron・外部サービスを足さない"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "infrastructure"]
file_path: "architecture/cash-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "11a259426013adb293cb3c3d9e2ac948aa5394cdc30fd8fd4641747d444774a3"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "11a259426013adb293cb3c3d9e2ac948aa5394cdc30fd8fd4641747d444774a3", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/index.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/api/src/schema-guard.ts", "migrations", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml"]
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
classification_reason: "system-spec の infrastructure 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G2"]
---

# Architecture overview

現金入力 — 30 日を過ぎた論理削除行の完全消去を、既存の cron `0 18 * * *` (JST 03:00) の `scheduledMaintenance` に独立 job `cash_soft_delete_purge` として足す。他の job と `Promise.allSettled` で独立させ、`SCHEDULED_MAINTENANCE_D1_PLAN` に query 数を宣言し、1 晩の上限を超えた分は翌晩に続ける。新しい binding・cron・外部サービスは足さない。`system-spec/infrastructure.md` は承認時入力、本書は実行基盤・予算・配信順序の制約を持つ。

## Context and drivers

- Business/technical context: `packages/api/wrangler.jsonc` の `triggers.crons` は `["0 18 * * *"]` の 1 本 (夜間バックアップ D1 → R2)。`scheduled` は `ctx.waitUntil(scheduledMaintenance(env))` (`index.ts:390-391`) を呼ぶ。`scheduledMaintenance` (`index.ts:196`) はバックアップを先に `allSettled` し (`:200`)、残り 6 job を `Record` + `satisfies` で型結合して (`:203-213`) `Promise.allSettled` で待つ (`:221`)。夜間の D1 予算は `scheduled-maintenance-budget.ts` で、上限 50・受理 49・計画上限 `SCHEDULED_D1_QUERY_PLAN_MAX` 47 (`:14`)、現行 7 job の計画 (`:77` 以降) は合計 47 (qa-cash-infrastructure-web-evidence-001)。完全消去 job の 2 本を足して計画を 49 にし、計画上限を 49 へ上げる (利用者決定 qa-cash-decision-008)。
- Quality attribute priorities: G2 に資する。上流指針は reliability と operations (Google SRE)。本章に適用した設計知識カードは無い。
- Constraints: Cloudflare Workers と D1・R2。cron triggers は既存の 1 本の範囲で使う。夜間処理の予算内に相乗りさせる (C3)。

## Goals and non-goals

- Goals:
  - G2: 削除から 30 日を過ぎた行を夜間に完全消去し、上限を超えた分は翌晩に続ける。
- Non-goals:
  - 新しい cron・binding・キュー・外部サービス
  - request 内での完全消去
  - 本番 D1 の保持期間・バックアップ方針の変更

## System context and boundaries

- Users/external systems: Cloudflare の cron trigger。
- Trust/deployment/data boundaries: 完全消去は Worker 内部の scheduled で動き、HTTP の入口を持たない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| cron `0 18 * * *` | 夜間処理の起動 (既存) | `wrangler.jsonc` | Cloudflare | Worker |
| `scheduledMaintenance` | 各 job を独立に実行 | `Promise.allSettled` | packages/api | Worker |
| `cash_soft_delete_purge` | 30 日超の `cash_entries` を 1 晩 500 行まで物理削除 | 関数 | packages/api | Worker |
| `scheduled-maintenance-budget.ts` | job 名と query 数の宣言 | 定数 + 検査 | packages/api | Worker |
| Migrate / Deploy ワークフロー | 0050 の適用と配信 | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: job は利用者のセッションを持たず、全利用者の期限切れ行を対象にする。
- Errors/resilience: job の失敗は他の job に波及しない (`allSettled`)。失敗した晩の分は翌晩に再び対象になる。
- Observability/audit: 消去件数を JSON ログに出し、500 行の上限に達したら warn を出す (`architecture/cash-maintenance-ops.md`)。
- Configuration/secrets: N/A: 新しい設定・secret は無い。
- Compatibility/versioning: 0050 の適用前に新 Worker が動くと `/api/*` は `runtimeSchemaGuard` が 503 を返す。夜間 cron の完全消去 job はこの guard の外で動くため、0050 の適用 (Migrate) を Worker の配備 (Deploy) より先に行う既存の順序で守る。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/cash-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/cash-database.md`)
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

ローカル・CI・本番の既存 3 環境のまま。本番の夜間処理は既存の cron 1 本で起動する。

#### Compute and storage

完全消去は D1 の `cash_entries` だけを対象にし、R2 には触れない。`deleted_at` が 30 日より前の行を 1 晩最大 500 行、`(user_id, deleted_at)` の索引で絞って消す (qa-cash-database-web-003、agent 推定・利用者未確認)。消去対象は既に一覧・集計から外れているため、取引と集計の作り直しは要らない。

#### IaC and delivery

`wrangler.jsonc` は変えない。`SCHEDULED_MAINTENANCE_JOB_NAMES` (`scheduled-maintenance-budget.ts:16-24`) に `cash_soft_delete_purge` を足し、`SCHEDULED_MAINTENANCE_D1_PLAN` に D1 クエリ 2 本を宣言し、`concurrentJobs` の `Record` に足す。計画の合計は 47 → 49 になり、`SCHEDULED_D1_QUERY_PLAN_MAX` を 47 → 49 に上げる。受理上限 49 の内側、ハード上限 50 まで 1 本の余裕を残し、既存 job の枠は変えず cron も足さない (qa-cash-decision-008)。宣言漏れは typecheck で止まる。migration 0050 は既存の Migrate ワークフロー (`.github/workflows/migrate.yml`) で適用してから Deploy (`deploy.yml`) する。

#### Secrets and access

N/A: 新しい secret・binding は無い (既存の `DB`)。

#### Reliability and recovery

独立 job なので、完全消去の失敗がバックアップや他の保持 job を止めない。上限超過分と失敗分は翌晩に続く。完全消去は取り返せないため、30 日の猶予中は夜間バックアップ (30 日保持) にも削除中の行は載らない点に留意する (`architecture/cash-database.md`)。

#### Infrastructure verification

`scheduled-maintenance-budget.test.ts` で job 名の集合と、計画の合計が計画上限と等しい 49 であること (`total === PLAN_MAX`) を、API テストで 29 日目の行が残り 31 日目の行が消えること・500 行を超えた分が次回に残ることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-infrastructure-web-001 | 既存 cron に独立 job で相乗りする | 専用の cron を足す | 新しい基盤を増やさず、既存の独立実行の枠組みに載る | 夜間の D1 予算を分け合う |
| qa-cash-decision-003 | 30 日で完全消去、上限超過分は翌晩 | 1 晩で全件 | 1 invocation の query 上限を越えない | 大量削除は数晩に分かれる |
| qa-cash-infrastructure-web-001 | 予算表に宣言し typecheck で結合する | 宣言せずに足す | 合算の上限超過を CI で止められる | 計画上限の見直しが要る |
| qa-cash-decision-008 | 計画上限 `SCHEDULED_D1_QUERY_PLAN_MAX` を 47 → 49 に上げる | 既存 job の枠を割り直す / 別の cron を足す | 既存 job を変えず、受理上限 49 の内側でハード上限 50 まで 1 本残る | 夜間予算の空きは 0 になり、次の job は再び見直しが要る |
| qa-cash-database-web-003 | 1 晩 500 行 (agent 推定・利用者未確認) | 上限なし | 夜間の実行時間と query 数を抑える | warn で上限到達を知らせる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Migrate → Deploy。
- Migration sequence: 0050 を Migrate で適用 → `EXPECTED_D1_MIGRATION` を 0050 にし、予算表に job を宣言 (計画上限 49) した Worker を Deploy → 完全消去 job を有効化。
- Rollback trigger/procedure: 夜間ログで job の失敗か想定外の件数が出たら、job を外した Worker を配る。消えた行は戻らないため、job の有効化は論理削除と復元の API テストが緑になった後にする。

## Risks and verification

- Risk/assumption: 夜間予算は `cash_soft_delete_purge` の 2 本を足して計画 49 / 計画上限 49 になる (qa-cash-decision-008)。予算表のテスト (`total === PLAN_MAX`) で 49 を固定する。以後 job を足すには改めて予算の見直しが要る。
- Risk/assumption: 1 晩 500 行と 30 日の境界は agent 推定を含む。定数は 1 か所に置く。
- Architecture fitness test: `SCHEDULED_MAINTENANCE_JOB_NAMES` と `concurrentJobs` のキー集合が一致すること (typecheck)。計画の合計が計画上限 49 と等しく、受理上限 49 以下であること。
- Load/failure/security validation: 完全消去 job を失敗させたテストで、他の job の結果が得られることを確かめる。
