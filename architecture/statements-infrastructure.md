---
graph_node_id: "arch-statements-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "決算書 — 既存の Worker・D1・静的配信と ci / deploy / migrate の流れに乗せ、新しい基盤を足さない"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "infrastructure"]
file_path: "architecture/statements-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "9f317cd28a76d3182c8481438a351013f992e45b44247cfbd7b5ae24f2f7c90c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "9f317cd28a76d3182c8481438a351013f992e45b44247cfbd7b5ae24f2f7c90c", "imported_at": "2026-09-19T22:38:08Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T22:38:08Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml", ".github/scripts/plan-auto-migration.mjs", "packages/api/wrangler.jsonc", "packages/api/src/schema-guard.ts", "migrations"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G1", "G4"]
---

# Architecture overview

決算書画面 — 既存の Worker・D1・静的配信と ci / deploy / migrate の流れに乗せ、新しい基盤を足さない。`system-spec/infrastructure.md` は承認時入力、本書は infrastructure 制約を持つ。

## Context and drivers

- Business/technical context: `.github/workflows` に ci.yml・deploy.yml・migrate.yml。api は `packages/api/wrangler.jsonc` の Worker で D1 を DB binding として使う。`.github/scripts/plan-auto-migration.mjs` は pending migration の SQL を静的に判定し、行を失う・書き換える文を含むと自動適用を止める。#58 で初期 JS 予算の CI 実測値を記録している。
- Quality attribute priorities: G1・G4 に資する。Google SRE の信頼性 (巻き戻しやすさ) と運用 (トイルを増やさない)。
- Constraints: 新しい基盤・外部サービス・監視ジョブを足さない。

## Goals and non-goals

- Goals:
  - G4: migration 0046 を Deploy の自動適用で止めずに適用する。
  - G1: 決算書の部品を分割読込し、初期 JS 予算を超えない。
- Non-goals:
  - 新しいワークフロー・監視・外部サービス
  - Worker の分割

## System context and boundaries

- Users/external systems: GitHub Actions、Cloudflare (Workers・D1)。
- Trust/deployment/data boundaries: 既存の secrets と binding をそのまま使う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| migrate.yml / Deploy の自動適用 | 0046 を番号順に適用し d1_migrations に記録 | wrangler d1 migrations apply | D1 | GitHub Actions |
| runtimeSchemaGuard | 必須列に balance_entries.status と liability_audit_log を加え、未適用の環境で新経路を動かさない | Worker 起動時検査 | packages/api | Worker |
| web の分割読込 | 決算書の部品をルート単位の chunk にする | Vite | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 基盤の権限は変えない。
- Errors/resilience: migration 未適用の Worker は schema guard のエラー契約で止まる (既存の挙動)。
- Observability/audit: N/A: 新しい監視を足さない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: migration は追加のみ。旧 Worker と新しい schema が共存できる。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/statements-database.md`)
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Runtime and deployment topology

既存の Cloudflare Worker (packages/api) と web の静的配信。

#### Environments and configuration

既存の環境 (local・production) をそのまま使う。ローカルは `.dev.vars` と wrangler dev。

#### Networking and edge

N/A: 経路・ドメインを変えない。

#### Scalability and resilience

N/A: 負荷の性質を変えない (1 利用者 1 リクエストの集計)。

#### Operations and recovery

Deploy が止まった場合は既存の復旧手順 (manifest → Migrate APPLY → Deploy 再実行) に従う。0046 は追加のみなので、この手順を要しない想定。

#### Infrastructure verification

plan-auto-migration が 0046 を自動適用可と判定すること。js-budget が build:bundle 直後の実測で予算内であること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-infrastructure-web-002 | 新しい基盤を足さず既存の流れに乗せる | 専用の集計ジョブ | 集計は要求ごとの純関数で足り、運用対象を増やさない | 集計の重さは要求時に掛かる |
| qa-statements-decision-007 | migration を追加のみにする | audit_log の再構築 | 自動適用で止まらず、巻き戻しは Worker を戻すだけ | 監査が新表に分かれる |
| qa-statements-infrastructure-web-002 | 決算書の部品をルート単位で分割読込 | 初期 bundle に含める | 初期 JS 予算を守る | 初回の決算書表示で chunk を 1 回取る |

## Delivery, migration and rollback

- Build/deploy topology: ci.yml → deploy.yml (migrate の自動適用を含む)。
- Migration sequence: 0046 の適用 → 新 Worker → 新 web。
- Rollback trigger/procedure: Worker と web を直前の版へ戻す。0046 は残す。

## Risks and verification

- Risk/assumption: 並行サイクルの migration と番号が衝突すると適用順が崩れる。sync 前に origin/main を確かめ、衝突なら繰り下げる。
- Architecture fitness test: 0046 の SQL が plan-auto-migration の禁止文を含まないこと。
- Load/failure/security validation: js-budget の CI 実測。
