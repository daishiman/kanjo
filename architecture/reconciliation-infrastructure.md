---
graph_node_id: "arch-reconciliation-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "照合画面 — 既存 Worker への route 追加と操作履歴の夜間削除"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "infrastructure"]
file_path: "architecture/reconciliation-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-16-reconciliation/completeness-findings.json", "evaluated_digest": "80ce90a07bbc669ca0a008a166b4199aa4576f5d8c235f74a592e50216f9a978"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-16-reconciliation/infrastructure.md", "source_version": "0.1.14", "source_digest": "80ce90a07bbc669ca0a008a166b4199aa4576f5d8c235f74a592e50216f9a978", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/d1-limits.ts", "packages/api/src/index.ts", "packages/api/src/scheduled-maintenance-budget.ts", ".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G3"]
---

# Architecture overview

照合画面 — 既存 Worker への route 追加と操作履歴の保持。`system-spec/archive/2026-09-16-reconciliation/infrastructure.md` は承認時入力、本書は infrastructure 制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: packages/api/wrangler.jsonc の Worker が SPA を Workers Assets (binding ASSETS) で配信し、D1 (DB)・R2 (FILES)・cron (0 18 * * *) を持つ。GitHub Actions は ci.yml・deploy.yml (追加だけの D1 migration を自動適用)・migrate.yml (破壊的 migration の手動承認)。照合改善は既存 Worker に route を足し、追加だけの migration と SPA 画面の更新を行うだけで、binding・Worker・デプロイ経路の変更は無い (qa-infrastructure-web-rc-observed-001)。
- Quality attribute priorities: G3 に資する。Google SRE の容量計画 (D1 読取り本数を /total-cashflow と同程度、一括 200 件で打ち切り) と『運用対象を増やさない』を適用する。単独利用のため SLO は定義しない。
- Constraints: 予算は既存の Cloudflare 現行プランの範囲 (C5)。D1 のクエリ上限 (cloudflare-d1-limits) と batch の原子性。

## Goals and non-goals

- Goals:
  - G3: 照合 API と追加 migration を既存の Worker と deploy.yml 自動適用経路で配信する。操作履歴の 90 日保存は操作時 batch で運用する。
- Non-goals:
  - Worker・binding・cron の追加や変更
  - migrate.yml の手動承認を要する破壊的 migration

## System context and boundaries

- Users/external systems: Cloudflare Workers・D1・R2・GitHub Actions。新しい外部サービスは無い。
- Trust/deployment/data boundaries: 1 Worker が SPA と API を配信し D1 を読み書きする。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker (wrangler.jsonc) | SPA 配信 (ASSETS) と API | HTTP / scheduled | packages/api | Worker |
| D1 (DB) | 照合判断・除外・操作履歴・月次レビュー | binding DB | packages/api | D1 DB |
| actions route | 次の操作の batch 内で reconciliation_actions の 90 日超を削除する | HTTP handler | packages/api | Worker |
| deploy.yml / migrate.yml | 追加だけの migration の自動適用 / 破壊的 migration の手動承認 | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: N/A: インフラ側の権限・binding を変えない。
- Errors/resilience: 取消を 1 回の D1 batch にして途中失敗で状態が分かれないようにする。
- Observability/audit: N/A: 新しい監視対象を追加しない。単独利用のため SLO は定義しない。
- Configuration/secrets: N/A: binding・環境変数・秘密情報を追加しない。
- Compatibility/versioning: 追加だけの migration で既存 D1 と互換を保つ。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存の 1 Worker (SPA + API) と D1・R2。トポロジーは変えない。

#### Compute and storage

GET /api/reconciliation は既存 /total-cashflow と同程度の D1 読取りに保つ。0041 の新表 2 つは既存 D1 に置く。

#### IaC and delivery

wrangler.jsonc の binding・cron を変えない。migration 0041 は追加のみ (新表 2 つ) なので deploy.yml の自動適用経路に乗る。

#### Secrets and access

N/A: 秘密情報・アクセス権を追加しない。

#### Reliability and recovery

reconciliation_actions の created_at が 90 日より古い行は、次の POST actions の D1 batch 内で削除する。既存 cron・binding・Worker は変えない。

#### Infrastructure verification

ci.yml の既存検査と、migration が既存 D1 に冪等に適用されること (O3)。夜間処理の削除対象が 90 日超の行だけであることをテストで確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-database-web-rc-decision-008 | 操作履歴を 90 日保存し、次の操作時に期限切れを削除する | 履歴を保存しない / cron を増やす | D1 cron 予算を増やさず保持期間を守る | 操作が無い間は削除が遅延する |

## Delivery, migration and rollback

- Build/deploy topology: ci.yml → deploy.yml の既存経路。
- Migration sequence: 追加だけの migration を deploy.yml が自動適用 → Worker の新 route と夜間削除を配信。
- Rollback trigger/procedure: 直前のビルドへ戻す。migration は追加だけなので巻き戻しは不要。

## Risks and verification

- Risk/assumption: 90 日削除の方式と migration が自動適用経路に乗る判断はアシスタントの推定 (inference-002)。
- Architecture fitness test: wrangler.jsonc の binding・cron に差分が無いこと。
- Load/failure/security validation: GET /api/reconciliation の D1 読取り本数が d1-limits.ts の上限内であること。
