---
graph_node_id: "arch-overview-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "概況画面改善 — 既存 authGuard への新 API の収容"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "auth"]
file_path: "architecture/overview-screen-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "7b2a00f87b3e0e35a03081090d9b49bf52de1daecf407015aa6da8145e157b6f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/auth.md", "source_version": "0.1.14", "source_digest": "30046c2b1e2c1624ca0896fdc06b323adb88c061ae579513c0a6a081d3f9833a", "imported_at": "2026-09-15T00:18:48Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-15T00:18:48Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/src/index.ts", "packages/web/src/components/Layout.tsx"]
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
classification_reason: "system-spec の auth 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を security とし、architecture-security.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G5"]
---

# Architecture overview

概況画面改善 — 既存 authGuard への新 API の収容。正本は `system-spec/auth.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/auth.ts` の authGuard が `packages/api/src/index.ts` で /api/* に掛かり、続けて mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence が動く。Worker は run_worker_first で /api/* を先に処理する。ログイン方式は利用者アカウント (メールアドレスとパスワード) で、本サイクルでは変えない。
- Quality attribute priorities: G5 に資する。認証必須の維持と、新 API が既存の保護列から外れないことを最優先にする。
- Constraints: 認証方式・ログイン画面・セッションを変えない。単一利用者 (user_id 'default')。

## Goals and non-goals

- Goals:
  - G5: 新 API (概況集計・未処理キュー・保留・月次レビュー) を /api/* 配下に置くだけで authGuard の保護を受ける形にする。
  - G5: 月次レビューの記録者として actor の user id を残す。
- Non-goals:
  - 認証方式・ログイン画面・セッション管理の変更
  - 役割 (ロール) による認可の導入

## System context and boundaries

- Users/external systems: 利用者 1 名。外部の認証基盤は使わない。
- Trust/deployment/data boundaries: 認証境界は /api/* の入口。静的アセットとログイン API 以外の API は認証後だけ到達できる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| authGuard | /api/* の認証 | Hono middleware | packages/api | Worker |
| mustChangePasswordFence | パスワード変更必須時の遮断 | middleware | packages/api | Worker |
| 新 API ルート | 概況・未処理キュー・保留・月次レビュー | /api/* | packages/api | Worker |
| web のバッジ取得 | ロック中は取得しない (enabled: !locked) | React Query | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 新 API は既存の middleware 列の後ろに置く。独自の認証判定を持たない。
- Errors/resilience: 未認証は既存どおり 401。パスワード変更必須は既存の遮断に従う。
- Observability/audit: monthly_close_reviews.reviewed_by_user_id に actor の user id を入れる。
- Configuration/secrets: N/A: 秘密情報を追加しない。
- Compatibility/versioning: 認証 API とセッションの形を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は保留・月次レビューの記録と、未処理キューが返す明細情報。主体は認証済みの利用者 1 名。脅威は未認証での API 到達と、ロック中の取得である。

#### Identity and authorization

既存の authGuard とセッションで識別する。単一利用者のため認可は認証済みか否かだけで、ロール判定は持たない。

#### Data and secret protection

新 API は明細本文を新テーブルに写さない。秘密情報を追加しない。

#### Application and supply-chain controls

新 API を /api/* 配下へ置き、middleware 列 (authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence) を迂回するルート登録をしない。依存ライブラリを追加しない。

#### Detection and response

既存の認証失敗の扱いに従う。新しい検知基盤は追加しない。

#### Security verification

API テストで新 API への未認証アクセスが 401 になることを確かめる。DOM テストでロック中にバッジを取得しないことを確かめる。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。認証に関する新しい決定は無く、dec-review-state-storage の D1 案が既存の認証の内側に収まることを前提として参照する。

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker 配信経路で、認証の構成は変えない。
- Migration sequence: ルートの追加時に middleware 列の後ろへ登録する。
- Rollback trigger/procedure: 未認証で到達できる経路が見つかったら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: ルートを middleware の前に登録すると認証を迂回する。登録位置を index.ts の既存構造に揃える。
- Architecture fitness test: 新 API すべてに未認証リクエストを送り 401 を確かめる API テスト。
- Load/failure/security validation: パスワード変更必須状態で新 API が遮断されることを API テストで確かめる。
