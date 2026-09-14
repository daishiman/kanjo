---
graph_node_id: "arch-design-system-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "デザインシステム共通化 — サーバ境界の不変条件"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["backend", "design-system"]
file_path: "architecture/design-system-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c913e39989a62947c7a431acf571b278efaf5e896ae650be92fc230b05c61e22"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "58c252551b1ba2c531913f4d13d7b959a11fb20a5fced89658cde126787dfd90", "imported_at": "2026-09-13T22:33:44Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["packages/core/src/design-tokens.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G1"]
---

# Architecture overview

デザインシステム共通化 — サーバ境界の不変条件。正本は `system-spec/backend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: 中心概念はデザイントークンで、役割名 (面・文字・境界・主色・状態色・チャート系列・文字サイズ・余白・角丸・影・動き・シェル寸法) から値への対応である。状態色は『塗り用』と『文字用』の 2 つの役割を持つ (利用者決定 qa-ui-ux-web-ds-decision-002)。これは入出力を持たない純データなので、packages/core (README のアーキテクチャ節で依存ゼロの純関数と定める層) に置き、web がビルド時に取り込む。packages/api (Hono on Workers) の処理・ルート・入出力は変えない。core は既に report-css.ts のような表示用の純データを持っており、同じ置き方である。
- Quality attribute priorities: G1 に資する。3 枚の card のうち本章に効いたのは Clean Architecture の境界の判断だけで、API 設計と DDD の集約は本サイクルで適用対象が無い。デザイントークンは入出力も業務ルールも持たない純データであり、Worker の API 契約・ルート・集約を増やさないことが、表示の関心をサーバ側へ漏らさないという境界の適用になる。API design patterns と DDD card は、トークンをリモート設定として配信する案を採らない理由 (ビルド時同梱で足りる) の確認に使っただけで、確定内容を変えていない。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
  - G1: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。
- Non-goals:
  - 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
  - 新機能の追加
  - API・データベースの変更
  - ネイティブアプリ (スマートフォン・タブレット・デスクトップ)

## System context and boundaries

- Users/external systems: 利用者 1 名と保守エージェント。外部システムの追加は無い。
- Trust/deployment/data boundaries: Cloudflare Workers の静的アセットと /api/* の Worker 1 系統。トークンはビルド時に同梱し、実行時に外部から取得しない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| packages/api (Hono on Workers) | 変更しない。表示の関心を持たない | /api/* | packages/api | Worker |
| packages/core | 表示用の純データ (トークン) を依存ゼロで持つ | TypeScript 定数 | packages/core | core |

## Cross-cutting contracts

- Identity/access: authGuard と /api/auth/login を変えない。
- Errors/resilience: 写しのずれと直書き色は pnpm lint が exit 非 0 で止める。
- Observability/audit: 検証は CI のテストと lint に置き、実行時の信号は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: CSS 変数名と charts.ts の公開関数を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 architecture-backend.md を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

Hono on Cloudflare Workers。本サイクルで処理・ルート・入出力を変えない。

#### Domain and module boundaries

トークンは入出力も業務ルールも持たない純データなので core に置き、api へは入れない。core には report-css.ts という同じ置き方の前例がある。

#### API and service contracts

N/A: API 契約の追加・変更はない。トークンをリモート設定として配信しない。

#### Data and transaction behavior

N/A: トランザクションを伴う変更はない。

#### Async processing

N/A: 非同期処理の追加はない。

#### Security and resilience

サーバ側の authGuard と CSP を変えない。

#### Operations and verification

packages/api の既存テストが緑のままであることを S6 で確認する。

## Architecture decisions

決定本文・代替案・帰結の正本は docs/design-system/architecture-decision.md。本章は dec-design-token-source と dec-border-color-roles を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: typecheck、vite build、check:js-budget、strip:manifest の既存順序で配信する。
- Migration sequence: トークン正本の新設、写しの置換、lint 追加、共通部品の参照切替の順に進める。
- Rollback trigger/procedure: CI の check 系か lint が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 派生色 #7F9095 は背景 #F6F8F9 で 3.12:1 と余裕が小さい。背景色を変えるときは再計算する。
- Architecture fitness test: 文字用トークンは背景 #F6F8F9 と面 #FFFFFF の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色は 3:1 以上であることをテストが検証し、基準未満の値を入れると落ちる。装飾罫線トークン (#D7E0E2) は 1.4.11 の対象外として検査から外し、入力欄・チェックボックスの枠が装飾罫線トークンを参照していないことを同じテストで確かめる。
- Load/failure/security validation: 既存 check 系 (thead / mobile-layout / financial-figure / financial-routes) と security:content を緑に保つ (S6)。
