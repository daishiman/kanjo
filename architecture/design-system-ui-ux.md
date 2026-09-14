---
graph_node_id: "arch-design-system-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "デザインシステム共通化 — 表現規約と色の役割"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system", "ui-ux"]
file_path: "architecture/design-system-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f76d5193c0c0c6be9e05b7eba56c5c1811397e87dfb51b73f2f211570fac93d0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "90861d884f6550debe818e41909cbc5334ad7f75ef03e3172ef0f6373f19ee70", "imported_at": "2026-09-13T22:33:44Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["design/FINAL-UI/spec/DESIGN-SYSTEM.md", "packages/web/src/styles.css", "packages/web/src/components/Layout.tsx", "packages/web/src/components/charts.ts"]
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
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

デザインシステム共通化 — 表現規約と色の役割。正本は `system-spec/ui-ux.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: WCAG の相対輝度で計算した (白 / 背景): 文字 #15262B 15.62 / 14.67、補助 #617177 5.08 / 4.77、ネイビー #14353D 13.07 / 12.27、ティール #087F78 4.86 / 4.57、注意 #B97000 3.90 / 3.66、危険 #B33A3A 5.86 / 5.50、成功 #247A52 5.28 / 4.95、境界 #D7E0E2 1.34 / 1.26、部品の枠の派生色候補 #7F9095 3.32 / 3.12、画像から実測した収入系列 #599AE9 2.91 / 2.73、支出系列 #EB9099 2.34 / 2.19。文字 4.5:1 を満たさないのは注意色だけで、図形・部品 3:1 を満たさないのは境界色と 2 つの系列色である。1.4.11 は部品を識別するのに必要な視覚情報に適用され、装飾だけの罫線は対象外である (W3C Understanding SC 1.4.11)。
- Quality attribute priorities: G2, G3, G5 に資する。Information Design card の『残す・落とす・加工する』を共通シェルの領域配分に適用した。ヘッダーには全ページで常に要る現在地・全体期間・データ鮮度だけを残し、ページ固有の期間は『計画期間』など別名にして全体期間と混同させない — 期間の誤解が最も失敗コストの高い事故だからである (DESIGN-SYSTEM.md の避けるべき事故)。色は card の『加工には検証コストが伴う』を受けて、状態を表すときだけ使い、ページ全体を淡色で塗らない。加工は task に理由を書ける場合に限る: チャート系列色 (2.34:1・2.91:1) は識別という task のために色相を保って 3:1 へ暗くし、境界は『装飾罫線』と『部品を見分ける枠』に役割を分けて、前者は画像どおり #D7E0E2 を残し、後者だけを 3:1 の派生色へ加工する (利用者決定 qa-ui-ux-web-ds-decision-007)。罫線まで濃くすると、読む必要のない線が読むべき数字と競合するためである。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
  - G2: route registry由来の20ルートを共通Layout/PageShellで描画する。標準操作はButtonを通し、固定アクション群を持つ画面はPageActionsを使う。ARIA固有controlはnative buttonの明示例外とする。
  - G3: チャート (棒・線・内訳バー・凡例・軸・グリッド・ツールチップ) の配色と描画規約を 1 つにし、全ての図が共通トークンから色を得る。系列の意味色は FINAL-UI に合わせ、収入=青系、支出=赤系、純収支=ティールの線とする。
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
| 色の役割トークン | 塗り用と文字用、装飾罫線と部品の枠を別の役割名で持つ | design-tokens.ts の役割名 | packages/core | web ビルド |
| 共通シェル | サイドバー 220px・ヘッダー 64px・フッターの領域配分 | Layout.tsx | packages/web | web ビルド |
| チャート系列色 | 収入=青系・支出=赤系・純収支=ティール線を 3:1 以上で描く | charts.ts の themeColor | packages/web | web ビルド |

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

React 18 + Vite の SPA。見た目の値は CSS 変数と canvas 描画値として適用し、画面ごとの色決定を持たない。

#### Routes, screens and navigation

既存 20 ルートを共通シェルの下に置く。ヘッダーは現在地・全体期間・データ鮮度だけを持ち、ページ固有の期間は別名で表示する。

#### Component and design-system boundaries

色は役割で分ける。状態色は塗り (画像どおり) と文字 (4.5:1 の派生色)、境界は装飾罫線 #D7E0E2 と部品の枠 (3:1 の派生色) に分け、部品側で値を上書きしない。

#### State and data flow

N/A: 表現規約は状態を持たない。全体期間の保持は PR #45 の既存の仕組みを使う。

#### Backend integration

N/A: API 契約を変えない。

#### Performance and observability

トークン追加で初期 JS 予算 (check:js-budget) を超えない。

#### Frontend verification

コントラスト計算テスト (O4) が文字 4.5:1・部品の枠と系列色 3:1 を検証し、入力欄の枠が装飾罫線トークンを参照していないことを確かめる。

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
