---
graph_node_id: "arch-analysis-hub-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "支出分析ハブ — 既存 Worker への GET 追加と D1 読取り量"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "infrastructure"]
file_path: "architecture/analysis-hub-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-15-analysis-hub/completeness-findings.json", "evaluated_digest": "4b1ce946c94ccd2fa3494fb4f49d4331a93aa9bab31e4fe46672baac023becb1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-15-analysis-hub/infrastructure.md", "source_version": "0.1.14", "source_digest": "4b1ce946c94ccd2fa3494fb4f49d4331a93aa9bab31e4fe46672baac023becb1", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-database", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/d1-limits.ts", ".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G3"]
---

# Architecture overview

支出分析ハブ — 既存 Worker への GET 追加と D1 読取り量。正本は `system-spec/infrastructure.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: packages/api/wrangler.jsonc が Worker kanjo-console を定義し、ASSETS (静的アセット)・D1 binding DB・R2 binding FILES・cron 0 18 * * * を持つ。CI は .github/workflows の ci.yml・deploy.yml・migrate.yml。本サイクルの追加は GET ルート 1 本と画面 1 つだけで、binding・cron・migration・デプロイ経路は変えない。D1 の 1 invocation あたりのクエリ上限は d1-limits.ts に Free 50 / Paid 1000 として置かれている。
- Quality attribute priorities: G3 に資する。ハブ API の D1 読取りを既存 /total-cashflow と同程度に保ち、web 側 staleTime (frontend 章 decision-003) で画面遷移ごとの再取得を抑えて invocation 数の増加を抑える。
- Constraints: C1: 既存構成 (core・api Hono Worker + D1・web) を維持する。 C3: ハブ表示中は API 1 本だけを呼ぶ。

## Goals and non-goals

- Goals:
  - G3: 既存 Worker と既存デプロイ経路のまま GET /api/analysis/hub を配信し、D1 の制限内で動かす。
- Non-goals:
  - Worker・binding・cron・R2 の追加や変更
  - migration・migrate.yml の実行内容の変更
  - キャッシュ層 (KV など) や新しい環境の追加

## System context and boundaries

- Users/external systems: 利用者のブラウザと Cloudflare。外部システムの追加は無い。
- Trust/deployment/data boundaries: Worker kanjo-console 1 系統で静的アセットと /api/* を配信する。D1 DB は既存 binding を読むだけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker kanjo-console | 静的アセットと /api/* (ハブ route を含む) を配信する | HTTP | packages/api | Cloudflare Workers |
| D1 DB | 取引集計と freee 照合データの保存 (変更しない) | D1 binding | packages/api | Cloudflare D1 |
| ci.yml / deploy.yml / migrate.yml | 検証・配信・migration 適用 (変更しない) | GitHub Actions | リポジトリ | GitHub Actions |

## Cross-cutting contracts

- Identity/access: N/A: Cloudflare・GitHub の権限を変えない。
- Errors/resilience: D1 のクエリ上限を超えないよう、ハブ API の読取り本数を /total-cashflow と同程度に保つ。
- Observability/audit: N/A: 監視・ログ設定を追加しない。
- Configuration/secrets: N/A: wrangler.jsonc の binding・vars・secret を変えない。
- Compatibility/versioning: 既存デプロイ経路と cron の動作を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存の Worker kanjo-console 1 系統。環境の追加は無い。

#### Compute and storage

Worker に GET ルートを 1 本足すだけ。D1 は既存テーブルの読取りのみ、R2 は使わない。1 リクエストの D1 読取りは /total-cashflow と同程度で、Free 50 / Paid 1000 クエリ/invocation の上限内に収める。

#### IaC and delivery

wrangler.jsonc を変えない。ci.yml の検証と deploy.yml の配信をそのまま使う。

#### Secrets and access

N/A: 秘密情報・アクセス権を追加しない。

#### Reliability and recovery

スキーマ変更が無いので、コードの配信と migration の順序に依存しない。問題があれば直前のビルドへ戻す。

#### Infrastructure verification

wrangler.jsonc と workflows に差分が無いこと、ci.yml の既存ジョブが緑であることを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-002 | 集約 API を既存 Worker に 1 本足す | 既存 5 API を同時に呼ぶ | 呼出しが 1 本になり invocation とクエリ本数が読みやすい | 読取り本数を d1-limits の範囲で見積もる |
| qa-frontend-web-ah-decision-003 | サイドバーとハブでクエリを共有し staleTime を設ける | バッジは支出分析内だけ | 全画面でバッジを出すと呼出しが増えるため、共有と staleTime で抑える | staleTime の値は実装時に決める |

## Delivery, migration and rollback

- Build/deploy topology: ci.yml (test → typecheck → lint → build ほか) を通った変更を deploy.yml で Worker へ配信する。migrate.yml は実行対象が増えない。
- Migration sequence: core → api → web の順でコードを入れ、1 回の配信でまとめて出す。インフラ側の移行作業は無い。
- Rollback trigger/procedure: 配信後にハブ API の D1 制限超過やエラー増加が出たら直前のビルドへ戻す。migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: どの画面でもサイドバーがハブ API を読むため、staleTime が短すぎると invocation が増える。staleTime の値と算定基準は章に無い (completeness-findings low)。
- Architecture fitness test: wrangler.jsonc・.github/workflows・migrations に本サイクルの差分が無いこと。
- Load/failure/security validation: ハブ API の 1 リクエストあたり D1 クエリ本数が d1-limits.ts の上限を下回ることを実装時に確かめる。infrastructure.web の qa_refs に observed-001 が無い点は判定に影響しない (findings low)。
