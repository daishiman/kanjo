---
graph_node_id: "arch-ai-analysis-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "AI分析 — 基盤を変えず Migrate → Deploy の順で列の追加だけを反映する"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "infrastructure"]
file_path: "architecture/ai-analysis-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2dd60db420ad646ddde4503af53e0162b59f324570faa0ddfe547fc7b417fd88"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "2dd60db420ad646ddde4503af53e0162b59f324570faa0ddfe547fc7b417fd88", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-maintenance-ops"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G5"]
---

# Architecture overview

AI分析 — 基盤を変えず Migrate → Deploy の順で列の追加だけを反映する。`system-spec/infrastructure.md` は承認時入力、本書は配信構成を変えない判断と反映の順序の制約を持つ。規則の正本は spec-ai-analysis-screen の反映手順の節。

## Context and drivers

- Business/technical context: API は Cloudflare Worker (Hono) と D1 で、配信は `.github/workflows/deploy.yml`、D1 の migration 適用は `.github/workflows/migrate.yml` が担う。ルートの build は web の build と `wrangler deploy --dry-run` を行う (`package.json:16`)。AI 分析はアプリから LLM を呼ばず、外部の Claude Code / Codex がトークンで API を呼ぶ構成である (qa-ai-infrastructure-web-evidence-001)。
- Quality attribute priorities: G5 に資する。本章へ引く設計 card は 0 件で、reliability と operations の doctrine を反映の順序に適用する。
- Constraints: Workers のリクエスト body 上限は Free / Pro で 100MB、CPU 時間は Free 10ms・Paid 既定 30 秒で、D1 の待ち時間は CPU 時間に数えない。D1 の migration は `wrangler d1 migrations apply` が未適用分を順に実行し `d1_migrations` 表に記録する。

## Goals and non-goals

- Goals:
  - G5: migration 0046 を既存の Migrate の手順とゲートで適用してから Deploy する。
  - G5: 新しい secret・キュー・外部サービスの登録を発生させない。
- Non-goals:
  - アプリから LLM を呼ぶ経路・キュー・外部ストレージ (scope.out)
  - Worker・Workers Assets・D1 の binding の変更
  - 新しいワークフローの追加

## System context and boundaries

- Users/external systems: GitHub Actions (Migrate・Deploy)、Cloudflare (Worker・D1・Workers Assets)、外部のエージェント (既存の API を呼ぶだけ)。
- Trust/deployment/data boundaries: 本番 D1 への書き込みは Migrate ワークフローだけ。Worker の配信は Deploy ワークフローだけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `migrate.yml` | `migrations/` の未適用分を本番 D1 に適用する | GitHub Actions | D1 | ワークフロー |
| `deploy.yml` | Worker と web の資産を配信する | GitHub Actions | Worker | ワークフロー |
| `wrangler.jsonc` | Worker・D1・資産の binding | wrangler 設定 | リポジトリ | 変更なし |
| `schema-guard.ts` | 適用済み migration の先頭が前提より古ければ 503 | Hono middleware | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: N/A: 本章は配信基盤の関心で、アプリの認証は `architecture/ai-analysis-auth.md`。
- Errors/resilience: migration 前に新しい Worker が配信されても、`runtimeSchemaGuard` が 503 `schema_unavailable` で新経路を止める。
- Observability/audit: N/A: 新しい信号を追加しない。
- Configuration/secrets: 新しい secret を登録しない。LLM の鍵を Worker に持たせない。
- Compatibility/versioning: migration は列の追加だけで、適用後も旧 Worker は新しい列を読まないだけで動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/ai-analysis-database.md`)
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

構成は既存の Worker (Hono) + D1 + Workers Assets のまま。AI 分析はアプリが LLM を呼ばず、外部のエージェントが依頼ごとのトークンで既存の API を呼ぶので、キュー・外部ストレージ・LLM の鍵は要らない。

#### Compute and storage

使用するデータの件数は既存の表の件数読み取りで作り、D1 の待ち時間は CPU 時間に数えない。レポートと貼り付けには固定 4 MiB の request budget を置き、個別 field・配列の上限は契約 validator が別に検証する (`architecture/ai-analysis-security.md`)。保存先は既存の `ai_tasks` と `ai_reports` だけ。

#### IaC and delivery

`deploy.yml` と `migrate.yml` をそのまま使う。変更は `migrations/` への 0046 の追加と `EXPECTED_D1_MIGRATION` の更新だけで、ワークフローと `wrangler.jsonc` は変えない。

#### Secrets and access

N/A: 新しい secret は無い。トークンは依頼ごとにアプリが発行しハッシュだけを D1 に保存する既存の仕組みのまま。

#### Reliability and recovery

反映は Migrate → Deploy の順に固定する。0046 は列の追加だけなので、適用後に旧 Worker が動いていても壊れない。逆順で配信された場合は `runtimeSchemaGuard` が新経路を 503 で止め、Migrate の後に回復する。巻き戻しは Worker を戻すだけで、列は落とさない。

#### Infrastructure verification

ルートの build (`wrangler deploy --dry-run` を含む) が通ること、Migrate の手順で 0046 が `d1_migrations` に記録されること、配信後に既存のレポートが読めることを確かめる。初期 JS 予算は CI の実測で緑のまま保つ。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-infrastructure-web-001 | 基盤を変えない | アプリから LLM を呼ぶ経路を足す | 鍵・費用・キューを持たずに済み、データは利用者のコピーでだけ外へ出る | 進捗は外部の出来事の記録から導くしかない |
| qa-ai-infrastructure-web-001 | Migrate → Deploy の順で反映する | Deploy と同時に migration を当てる | 既存の手順とゲートをそのまま使える | 2 段の実行が要る |
| qa-ai-database-web-001 | migration を列の追加だけにする | 表の作り直し | 旧 Worker と共存でき、巻き戻しが Worker の差し戻しで済む | 使わなくなった列も残る |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker・Workers Assets・D1。
- Migration sequence: 0046 と `EXPECTED_D1_MIGRATION` の更新をマージ → Migrate の適用 → Deploy。
- Rollback trigger/procedure: 配信後の不具合は前の Worker を再配信する。D1 は列が残るだけで、戻す操作は要らない。

## Risks and verification

- Risk/assumption: Deploy が Migrate より先に走ると新経路が使えない時間が生じる。`runtimeSchemaGuard` が 503 で止め、データは壊れない。
- Architecture fitness test: `wrangler.jsonc` とワークフローに差分が無いこと。新しい secret の参照が無いこと。
- Load/failure/security validation: 上限ちょうどのレポートの受信が Worker の CPU 時間内に収まることを境界テストで確かめる。
