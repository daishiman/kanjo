---
graph_node_id: "arch-design-system-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "デザインシステム共通化 — トークン正本と写しの導出"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system", "frontend"]
file_path: "architecture/design-system-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "d53fd701712c85bbb1f7c3dbc2be4a1f139bc1f4efd2a4a9ce910d5b8ed5af61"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "26fcc96ee685950911cfd893979243d5685559547fe037de554254f8ea57e008", "imported_at": "2026-09-13T22:33:44Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["packages/core/src/design-tokens.ts", "packages/web/src/styles.css", "packages/web/src/components/charts.ts", "packages/web/src/components/Layout.tsx", "scripts/check-design-tokens.mjs"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# Architecture overview

デザインシステム共通化 — トークン正本と写しの導出。正本は `system-spec/frontend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: (1) 画面の色の正本は packages/web/src/styles.css の :root (--bg #f6f8f9 / --ink #15262b / --ink-soft #617177 / --line #d7e0e2 / --primary #14353d / --accent #087f78 / --biz #087f78 / --warn #805a12 / --danger #b23a3a / --good #2e7d5b 等)。(2) packages/web/src/components/charts.ts は themeColor() が getComputedStyle(document.documentElement) でその CSS 変数を読み、コメントで『図の色の正本は styles.css の :root』と明言している。直書きは CSS を読めない環境 (SSR・jsdom・CSS 適用前) 向けの COLOR_FALLBACKS で、コメントは『styles.css と同じ値にしてある』とするが実際はずれている (biz #2f5da8 対 #087f78、ink #1d2a2c 対 #15262b、inkSoft #51625f 対 #617177、line #dde3e1 対 #d7e0e2)。CSS 変数を持たない neutral #7b8784 と VENDOR_EXTRA_COLORS 5 色は直書きのみ。(3) 前例として skills/report-design-system/assets/report.css を正本、packages/core/src/report-css.ts を写しとし、scripts/check-report-css.mjs が pnpm lint で一致を検査している。シェルは components/Layout.tsx が aside.sidebar・header.header・footer.footer・nav.tabbar を全ルート共通で描画する。web は React 18 + Vite の SPA で、API 契約 (packages/api の /api/*) は本サイクルで変えない。
- Quality attribute priorities: G1, G2, G3, G4 に資する。Clean Architecture card の Dependency Rule をトークンの配置に適用した。トークン (役割名→値) は表示技術に依存しない最内側の方針なので packages/core に置き、CSS 変数 (styles.css の :root) はその外側の写しとして生成する。charts.ts は現行どおり getComputedStyle で CSS 変数を読む経路を残し、CSS を読めない環境向けの予備値 (COLOR_FALLBACKS) だけを core の値から取る — 現状ずれているのはこの予備値であり (qa-frontend-web-ds-observed-005)、正本を CSS から TS へ移しても実行時の読み方は変えずに済む。Information Design card は、同じ値を手で写す箇所が増えるほど利用者が見る色がずれることを示しており、ずれ検出 lint はその停止条件を機械化したものである。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
  - G1: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。
  - G2: route registry由来の20ルートを共通Layout/PageShellで描画する。標準操作はButtonを通し、固定アクション群を持つ画面はPageActionsを使う。ARIA固有controlはnative buttonの明示例外とする。
  - G3: チャート (棒・線・内訳バー・凡例・軸・グリッド・ツールチップ) の配色と描画規約を 1 つにし、全ての図が共通トークンから色を得る。系列の意味色は FINAL-UI に合わせ、収入=青系、支出=赤系、純収支=ティールの線とする。
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
| design-tokens.ts | 役割名から値への対応の正本 (依存ゼロ) | export const 定数 | packages/core | core |
| styles.css の :root | 正本から導出した CSS 変数の写し | CSS custom properties | packages/web | web ビルド |
| charts.ts | getComputedStyle で CSS 変数を読み、予備値 COLOR_FALLBACKS は正本から取る | themeColor() | packages/web | web ビルド |
| 写しずれ lint | 正本と写しの不一致・直書き hex を検出 | pnpm lint の node スクリプト | scripts | CI |

## Cross-cutting contracts

- Identity/access: authGuard と /api/auth/login を変えない。
- Errors/resilience: 写しのずれと直書き色は pnpm lint が exit 非 0 で止める。
- Observability/audit: 検証は CI のテストと lint に置き、実行時の信号は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: CSS 変数名と charts.ts の公開関数を維持する。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

React 18 + Vite の SPA。図は Chart.js が canvas に描き、色は themeColor() が getComputedStyle で styles.css の変数を読む現行方式を維持する。

#### Routes, screens and navigation

components/Layout.tsx が aside.sidebar・header.header・footer.footer・nav.tabbar を全ルート共通で描画する構造を維持し、20 ルートすべてがこれを経由する。

#### Component and design-system boundaries

依存方向は core (トークン正本) から web (CSS 変数・charts.ts・部品) への一方向。core は web を知らない。charts.ts の予備値と neutral・VENDOR_EXTRA_COLORS の直書きを正本参照へ置き換える。

#### State and data flow

トークンはビルド時定数で実行時状態を持たない。

#### Backend integration

N/A: packages/api の /api/* 契約は変えない。

#### Performance and observability

外部ライブラリを追加せず、初期 JS 予算を守る。

#### Frontend verification

O1 のトークン値照合テスト、O2 の写しずれ lint、S1 の直書き hex 0 件検査、既存 check 系 (thead / mobile-layout / financial-figure / financial-routes) の緑維持。

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
