---
graph_node_id: "arch-trends-screen-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "推移画面 — 実行環境とデプロイ (変更なし)"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen", "infrastructure"]
file_path: "architecture/trends-screen-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8a3c7ee5afbbb20f6044167c1ff0ff7dd1daa86713665a6d827b5ebd2b918362"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "8a3c7ee5afbbb20f6044167c1ff0ff7dd1daa86713665a6d827b5ebd2b918362", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: ["spec-trends-screen"]
related_nodes: ["spec-trends-screen", "arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", ".github/workflows/ci.yml", ".github/workflows/deploy.yml"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/trends-screen-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G3"]
---

# Architecture overview

推移画面 — 実行環境とデプロイ (変更なし)。正本は `system-spec/infrastructure.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-trends-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-infrastructure-web-trends-observed-002。api は packages/api/wrangler.jsonc の Cloudflare Worker (D1・R2・ASSETS のバインディング) で、web は同じ Worker の静的アセット。CI は ci.yml、デプロイは deploy.yml、migration は migrate.yml だが今回 migration は無い。
- Quality attribute priorities: G3 に資する。doctrine は Google SRE の単純さ: 新しい構成要素を足さず、既存の Worker の制限 (cloudflare-workers-limits) の中に収める。
- Constraints: C5: Cloudflare の無料枠内。

## Goals and non-goals

- Goals:
  - G3: 1 リクエストの D1 読取りを総収支 API と同じ量 (Dataset と freee 系 4 表を 1 回) に保つ。
- Non-goals:
  - 新しいバインディング
  - キャッシュ層
  - 環境の追加

## System context and boundaries

- Users/external systems: Cloudflare Workers 上の 1 つの Worker。
- Trust/deployment/data boundaries: 構成は変えない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker | api と web の静的アセット | wrangler.jsonc | リポジトリ (wrangler.jsonc・workflows) | Cloudflare Workers / GitHub Actions |
| CI / deploy | 検証と配信 | GitHub Actions | リポジトリ (wrangler.jsonc・workflows) | Cloudflare Workers / GitHub Actions |

## Cross-cutting contracts

- Identity/access: 既存の authGuard と mustChangePasswordFence の内側に置き、データは userId で絞る (arch-trends-screen-auth)。
- Errors/resilience: 配信は既存の deploy.yml だけ。
- Observability/audit: 既存の requestId とエラーログに従う。推移は読取専用で、監査記録の対象になる書込みは増えない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/trends は応答フィールドの追加だけで、既存の傾向判定のフィールドと値を残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存の本番とローカル (wrangler dev) のまま。

#### Compute and storage

D1 の読取りは総収支 API と同じ量で、CPU 時間は総収支の集計に比較期間の切り出しを足した程度。新しいストレージは無い。

#### IaC and delivery

wrangler.jsonc を変えない。deploy.yml の経路で配信する。

#### Secrets and access

新しい秘密は無い。

#### Reliability and recovery

戻すときは前の版の Worker へ戻す。データの巻き戻しは要らない。

#### Infrastructure verification

CI の ci.yml (test・typecheck・lint・build) が緑であること。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-INF-1 | 構成を変えない | 根拠と比較案は qa-infrastructure-web-trends-observed-002 を参照 | qa-infrastructure-web-trends-observed-002 の判断に従う | 本書の該当節に反映済み |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console を ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: migration を伴わない通常の配信。
- Rollback trigger/procedure: テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は無いのでデータの巻き戻しは要らない。

## Risks and verification

- Risk/assumption: CPU 時間の超過 → 対策: 比較期間の切り出しを同じ読込の再利用で行い、読込を 1 回に保つ
- Architecture fitness test: CI の ci.yml (test・typecheck・lint・build) が緑であること。
- Load/failure/security validation: pnpm verify:full (test・typecheck・lint・build・視覚検査) を緑に保つ。
