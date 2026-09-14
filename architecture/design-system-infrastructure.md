---
graph_node_id: "arch-design-system-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "デザインシステム共通化 — 配信構成と JS 予算"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system", "infrastructure"]
file_path: "architecture/design-system-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e3255c549ffd63a81eada5c7846c5f4ddb8a67590a930a0f652fa4d69efb74a4"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "d26a9eb5fda7ca0d9e4c407106b69b2b84de2bff328260b18a78dd6f5abcf9df", "imported_at": "2026-09-13T22:33:44Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-maintenance-ops"]
resource_scope: ["packages/web/package.json", "packages/web/scripts/check-initial-js-budget.mjs"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G1", "G4"]
---

# Architecture overview

デザインシステム共通化 — 配信構成と JS 予算。正本は `system-spec/infrastructure.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: 配信は Cloudflare Workers (kanjo-console) の静的アセット (../web/dist、not_found_handling: single-page-application) と /api/* の Worker 1 系統である。web の build は typecheck → vite build → check:js-budget (check-initial-js-budget.mjs による初期 JS 予算) → strip:manifest の順で、トークンの追加でこの予算を超えてはならない。トークンは依存ゼロの定数なので外部ライブラリを増やさない。CI では headless Chrome を使う check 系 (thead / mobile-layout / financial-figure / financial-routes) が画面の崩れを検査する。
- Quality attribute priorities: G1, G4 に資する。本章へ引く card は 0 件である。未着手ではなく、配信構成 (Workers の静的アセット + /api/* の Worker) を変えないサイクルで、infrastructure 固有に適用すべき設計知識が無いことを確認した上での確定である。本章に効く制約は初期 JS 予算 (check:js-budget) で、トークンを依存ゼロの定数にする判断はこの予算を守るための選択として記録する。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
  - G1: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。
  - G4: 今後の作成物が自動的に規約へ従うよう、トークン定義以外での色の直書きと、正本と写し (CSS 変数・チャート色) のずれを lint で機械検出し、使い方を規約文書として置く。
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
| kanjo-console Worker | 静的アセット (SPA) と /api/* の配信 1 系統 | wrangler 設定 | packages/api | Cloudflare Workers |
| web build | typecheck、vite build、check:js-budget、strip:manifest | pnpm build | packages/web | CI |

## Cross-cutting contracts

- Identity/access: authGuard と /api/auth/login を変えない。
- Errors/resilience: 写しのずれと直書き色は pnpm lint が exit 非 0 で止める。
- Observability/audit: 検証は CI のテストと lint に置き、実行時の信号は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: CSS 変数名と charts.ts の公開関数を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 architecture-infrastructure.md を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

配信構成を変えず、ビルド成果物だけを差し替える。

#### Compute and storage

N/A: 計算資源・ストレージを変えない。

#### IaC and delivery

wrangler 設定は変えない。build の順序と初期 JS 予算の検査をリリース前の防壁として維持する。

#### Secrets and access

N/A: 秘密情報と権限を変えない。

#### Reliability and recovery

失敗時は既存のデプロイ手順で直前のビルドへ戻す。

#### Infrastructure verification

CI の headless Chrome による check 系 (thead / mobile-layout / financial-figure / financial-routes) を回し続ける。pointer:none 環境を前提に否定形 2 段で分岐する (C6)。

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
