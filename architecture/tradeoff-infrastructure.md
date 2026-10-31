---
graph_node_id: "arch-tradeoff-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "トレードオフ — 構成を変えず、EXPECTED_D1_MIGRATION と Migrate → Deploy に従う"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["tradeoff", "infrastructure"]
file_path: "architecture/tradeoff-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "ecbe51bb97c8d67d6a6bf138061ee63143b09d1c24a47b8f6542a5e1d8c4fd04"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "ecbe51bb97c8d67d6a6bf138061ee63143b09d1c24a47b8f6542a5e1d8c4fd04", "imported_at": "2026-09-21T22:35:02Z"}
created_at: "2026-09-21T22:35:02Z"
updated_at: "2026-09-21T22:35:02Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-maintenance-ops"]
resource_scope: [".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "wrangler.jsonc", "migrations", "packages/api/src/schema-guard.ts", "package.json"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/tradeoff-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:35:02Z"}
serves_goals: ["G1", "G5"]
---
# Architecture overview

> 本書は spec から生成した領域別投影であり、規則の正本ではない。差異は `specs/spec-tradeoff-screen.md` を優先し、spec 変更後に再生成・同期する。

トレードオフ — 構成を変えず、EXPECTED_D1_MIGRATION と Migrate → Deploy に従う。`system-spec/infrastructure.md` は承認時入力、本書は配信と反映の制約を持つ。正本は `specs/spec-tradeoff-screen.md` (spec-tradeoff-screen) の「互換性・移行・リリース」。

## Context and drivers

- Business/technical context: api は Cloudflare Worker と D1、web は静的配信。`EXPECTED_D1_MIGRATION` は `'0051_budget_plans.sql'` (`packages/api/src/schema-guard.ts:4`)。Migrate と Deploy は `.github/workflows/migrate.yml` / `deploy.yml` (qa-tradeoff-infrastructure-web-evidence-001)。
- Quality attribute priorities: G1・G5。既存構成の維持。
- Constraints: 新しい binding や外部サービスを足さない (qa-tradeoff-infrastructure-web-001)。

## Goals and non-goals

- Goals:
  - G1: lazy import のまま初期 JS 予算 (`check:js-budget` の CI 実測) を超えない。
  - G5: migration 0051 と `EXPECTED_D1_MIGRATION` を同じ変更で進め、Migrate → Deploy に従う。
- Non-goals:
  - 構成・binding・secret の追加

## System context and boundaries

- Users/external systems: GitHub Actions と Cloudflare。
- Trust/deployment/data boundaries: 既存どおり。
- Context diagram: `system-spec/index.md`。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker (api) | 3 経路 | Hono | packages/api | Cloudflare Workers |
| D1 | 記録と上書き | SQL | migrations | Cloudflare D1 |
| 静的配信 (web) | 画面 | HTTP | packages/web | 既存の配信 |
| migrate.yml / deploy.yml | 反映の順序とゲート | GitHub Actions | .github | CI |

## Cross-cutting contracts

- Identity/access: 既存。
- Errors/resilience: runtimeSchemaGuard が migration の未適用を検出する。
- Observability/audit: 既存。
- Configuration/secrets: 追加なし。
- Compatibility/versioning: 0051 は追加だけで旧 Worker と両立する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存の環境のまま。

#### Compute and storage

組み合わせの列挙は最大 781 通りで、Worker の CPU 時間の上限に収まる。

#### IaC and delivery

`wrangler.jsonc` を変えない。Migrate → Deploy の順。

#### Secrets and access

追加なし。

#### Reliability and recovery

0051 は追加だけなので Worker の巻き戻しで戻せる。

#### Infrastructure verification

`schema-guard.test.ts` の期待値を 0051 に進める。初期 JS 予算の CI 実測。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-tradeoff-infrastructure-web-001 | 構成を変えない | 別 Worker | 運用が増えない | 既存の上限に従う |
| qa-tradeoff-maintenance-ops-web-003 | EXPECTED_D1_MIGRATION とテストを同じ変更で進める (agent 推定・利用者未確認) | 別 PR | 未適用の Worker を止められる | 番号の付け替え時に両方を直す |

## Delivery, migration and rollback

- Build/deploy topology: 既存。
- Migration sequence: Migrate (0051) → Deploy。
- Rollback trigger/procedure: Deploy 後の不具合は Worker を戻す。0051 はそのまま残してよい。

## Risks and verification

- Risk/assumption: マージ時点で別の migration が先に入る。番号をマージ時点の最新 +1 に付け替える。
- Architecture fitness test: 新しい binding が無い。
- Load/failure/security validation: JS 予算は `build:bundle` の直後に測る。
