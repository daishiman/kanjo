---
graph_node_id: "arch-overview-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "概況画面改善 — migration 自動適用と初期 JS 予算"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "infrastructure"]
file_path: "architecture/overview-screen-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "671310a31b86b6ddc1609a02219782f194486c056477d75828503b47e6afb11f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/infrastructure.md", "source_version": "0.1.14", "source_digest": "10b1fcf93c5c63d728e36c9fc18d48f15fc8e281adaef346d49cc73d529a4677", "imported_at": "2026-09-15T00:18:48Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-15T00:18:48Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml", ".github/scripts/plan-auto-migration.mjs", "packages/web/scripts/check-initial-js-budget.mjs", "packages/api/src/schema-guard.ts"]
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
classification_reason: "system-spec の infrastructure 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を infrastructure とし、architecture-infrastructure.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G3", "G5"]
---

# Architecture overview

概況画面改善 — migration 自動適用と初期 JS 予算。正本は `system-spec/infrastructure.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: Worker kanjo-console、D1 kanjo-db、R2 kanjo-files、cron 0 18 * * * の nightlyBackup (30 日保持) が `packages/api/wrangler.jsonc` に定義されている。`.github/workflows/deploy.yml` は `.github/scripts/plan-auto-migration.mjs` で DROP/RENAME を blocked にし、checkpoint → db:migrate:remote → check-d1-migrations.mjs → wrangler deploy → smoke 2 回の順に進む。`.github/workflows/migrate.yml` は手動経路。初期 JS は 110KiB 予算を `packages/web/scripts/check-initial-js-budget.mjs` が検査する。
- Quality attribute priorities: G3, G5 に資する。migration と Worker の配信順の整合 (503 を起こさない) と、初期 JS 予算の維持を最優先にする。
- Constraints: C1: Workers + D1 + React SPA。C5: migration は前進のみ。新しいクラウドサービスや有償プランを追加しない。

## Goals and non-goals

- Goals:
  - G3: migration 0040 を既存の自動適用経路に乗せ、EXPECTED_D1_MIGRATION を同時に更新して配信直後の 503 を防ぐ。
  - G5: 初期 JS 110KiB 予算と既存の配信構成を維持する。
- Non-goals:
  - 新しい Worker・D1・R2 リソースの追加
  - cron やバックアップ保持期間の変更
  - 配信パイプラインの手順の追加

## System context and boundaries

- Users/external systems: GitHub Actions と Cloudflare (Workers / D1 / R2)。
- Trust/deployment/data boundaries: 本番の D1 への migration は deploy.yml か migrate.yml からだけ行う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker kanjo-console | API と静的アセットの配信 | wrangler.jsonc | packages/api | Cloudflare Workers |
| D1 kanjo-db | 新テーブルを含むデータ | migrations | packages/api | Cloudflare D1 |
| R2 kanjo-files | 夜間バックアップ (30 日保持) | nightlyBackup | packages/api | Cloudflare R2 |
| deploy.yml | 自動 migration 判定・適用・配信・smoke | GitHub Actions | .github | CI/CD |
| check-initial-js-budget.mjs | 初期 JS 110KiB の検査 | node スクリプト | packages/web | CI |

## Cross-cutting contracts

- Identity/access: 配信の資格情報は既存の GitHub Actions secrets を使い、追加しない。
- Errors/resilience: EXPECTED_D1_MIGRATION が migration より先に進むと runtimeSchemaGuard が 503 を返す。同じ PR で揃える。
- Observability/audit: deploy 後の smoke 2 回と check-d1-migrations.mjs。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存の bindings 名と cron を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存の本番 1 環境 (Worker kanjo-console + D1 kanjo-db + R2 kanjo-files) を使う。構成は変えない。

#### Compute and storage

計算は既存 Worker の中で行い、保存は D1 の 2 テーブル追加だけ。R2 には既存の夜間バックアップが新テーブルを含めて書かれる。

#### IaC and delivery

wrangler.jsonc は変更しない。migration 0040 は CREATE のみなので plan-auto-migration.mjs が自動適用可と判定し、checkpoint → db:migrate:remote → check-d1-migrations.mjs → wrangler deploy → smoke の順で配信する。

#### Secrets and access

N/A: 新しい秘密情報や権限を追加しない。

#### Reliability and recovery

D1 に rollback は無い。障害時は Worker を直前のビルドへ戻し、新テーブルは残す。データの回復は既存の夜間バックアップ (30 日保持) と POST /api/restore で行う。

#### Infrastructure verification

CI の build ジョブで check-initial-js-budget.mjs を通す。schema-guard.test で EXPECTED_D1_MIGRATION と migration の一致を確かめる。deploy 後の smoke 2 回で稼働を確かめる。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は dec-review-state-storage (既存 D1 に行を足すだけで追加費用 0) を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: ci.yml の static-checks / test-core-web / test-api / build を通した後、deploy.yml で配信する。
- Migration sequence: migration 0040 と EXPECTED_D1_MIGRATION の更新を同じ PR に入れ、deploy.yml の migration 適用後に Worker を配信する。
- Rollback trigger/procedure: smoke か check-d1-migrations.mjs が落ちたら Worker を直前のビルドへ戻す。定義の誤りは前進の修正 migration で直す。

## Risks and verification

- Risk/assumption: EXPECTED_D1_MIGRATION の更新を忘れる、または migration より先に配信すると 503 になる。
- Architecture fitness test: schema-guard.test と check-d1-migrations.mjs で定数と適用済み migration の一致を検査する。
- Load/failure/security validation: 右パネル・ドロワー・段階的開示の追加で初期 JS 予算を超えないことを check-initial-js-budget.mjs で確かめる。
