---
graph_node_id: "arch-design-system-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "デザインシステム共通化 — CSP と実データ混入の防止"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system", "security"]
file_path: "architecture/design-system-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c684e8612c3e2367f92e9901ccf61de4e10f6fb904a8ba9c7c0d05880b4dd41b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "87e8c5a76765563551fc0cd2e989c5876c4f64e05e391a6b32accb387bb7be5d", "imported_at": "2026-09-13T22:33:44Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["packages/web/public/_headers", "packages/web/src/styles.css"]
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
classification_reason: "system-spec の security 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G1", "G5"]
---

# Architecture overview

デザインシステム共通化 — CSP と実データ混入の防止。正本は `system-spec/security.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: 衝突しない。packages/web/public/_headers の CSP は default-src 'self'・script-src 'self'・style-src 'self' 'unsafe-inline'・font-src 'self' data: で、外部フォントや CDN を許していない。Web フォントを追加しない利用者決定 (qa-ui-ux-web-ds-decision-002) とトークンのビルド時同梱はこの CSP の範囲で完結し、実行時に外部から色やフォントを取得しない。チャートの色は canvas への描画値で、CSS 注入経路を増やさない。画面例やテストの表示値には匿名・架空のサンプルだけを使い、pnpm lint の security:content (guard-real-data) が公開文書の実データ混入を検査する。
- Quality attribute priorities: G1, G5 に資する。Secure by Design card の『攻撃面を増やさない』を、新規の外部Webフォント/CDNを追加しない決定と CSP の維持に結び付けた。和文は system-ui 系、金額は既存の IBM Plex Mono Latin 400/600 をアプリ資産として自己配信するため外部通信はなく、CSP を変えない。トークンもビルド時に同梱する。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
  - G1: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。
  - G5: 文字と部品は WCAG 2.2 AA のコントラスト (文字 4.5:1、部品を見分ける境界・図形 3:1) を維持する。FINAL-UI の値がこれを満たさない場合は役割を分けて両立させる: 塗り・アイコン・バッジ面には画像どおりの値、文字にはその色相で 4.5:1 を満たす派生色を使う。境界は、カード区切りや表の罫線などの装飾罫線には画像どおり #D7E0E2 (1.4.11 の対象外)、入力欄・チェックボックスなど部品を見分ける枠には同じ色相で 3:1 を満たす派生色を使う。
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
| _headers の CSP | default-src 'self' と font-src 'self' data: を維持 | Cloudflare static assets headers | packages/web/public | Workers static assets |
| security:content | 公開文書の実データ混入を検査 | pnpm lint | scripts | CI |

## Cross-cutting contracts

- Identity/access: authGuard と /api/auth/login を変えない。
- Errors/resilience: 写しのずれと直書き色は pnpm lint が exit 非 0 で止める。
- Observability/audit: 検証は CI のテストと lint に置き、実行時の信号は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: CSS 変数名と charts.ts の公開関数を維持する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

攻撃面を増やさないことが主眼。実行時に色やフォントを外部から取得しない。

#### Identity and authorization

N/A: 認証・認可を変えない (auth 章)。

#### Data and secret protection

画面例・テスト・画像の表示値は匿名・架空のサンプルだけを使う (C7)。

#### Application and supply-chain controls

新規の外部Webフォント/CDNは追加しない。IBM Plex Mono Latin 400/600 は既存依存から自己配信する。トークンはビルド時同梱。

#### Detection and response

pnpm lint の security:content (guard-real-data) が実データ混入を検出する。

#### Security verification

_headers の CSP に差分が無いことと、security:content が緑であることを確認する。

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
