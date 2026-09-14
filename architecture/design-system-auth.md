---
graph_node_id: "arch-design-system-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "デザインシステム共通化 — 未認証時の共通シェル"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["auth", "design-system"]
file_path: "architecture/design-system-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "eb4518709c7f24e440a5c5d197cdd861eba7f2817d9ca03dac0b3d01f885f66b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "c43d364880309fe1dc22bde3bf61a5cfb7eb4e996e2f3f9193b968df3aef3c59", "imported_at": "2026-09-13T08:15:21Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["packages/web/src/components/Layout.tsx", "packages/web/src/pages/Login.tsx"]
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
classification_reason: "system-spec の auth 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G2"]
---

# Architecture overview

デザインシステム共通化 — 未認証時の共通シェル。正本は `system-spec/auth.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: 認証は packages/api/src/index.ts の authGuard が /api/* を保護し、/api/auth/login でアプリ内セッションを発行する (Cloudflare Access 併用時は Access を使う)。wrangler の run_worker_first: /api/* により API は必ず Worker を通る。本サイクルで認証方式は変えない。DESIGN-SYSTEM.md はログイン画面にも同じ幅・配置のサイドバーを出し、未認証時は業務メニューをロック表示してヘルプ・プライバシー・ログインだけを使えるようにすると定める。共通シェル部品はこの未認証表示を持つ必要がある。改訂 (2026-09-14): PR #48 の利用者判断により、ログイン画面はシェルを出さない単一カラムのカードへ変わった。未認証時は共通シェルを描画せず、下表の「共通シェルの未認証表示」は現行実装では使わない。認可の正本が authGuard である点は変わらない。
- Quality attribute priorities: G2 に資する。Secure by Design card の『既定で安全・失敗時は閉じる』を、ログイン画面の共通シェルに適用した。DESIGN-SYSTEM.md はログイン画面にも同じサイドバーを出すと定めるが、未認証時の業務メニューはロック表示にし、実際の保護は authGuard が /api/* で担う。見た目の部品がリンクを表示しても、認可の判断を部品側へ移さない — 表示のロックは案内であって防御ではない、という区別を本章の確定内容にした。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
  - G2: route registry由来の20ルートを共通Layout/PageShellで描画する。標準操作はButtonを通し、固定アクション群を持つ画面はPageActionsを使う。ARIA固有controlはnative buttonの明示例外とする。
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
| authGuard | /api/* を保護する (変更しない) | Hono middleware | packages/api | Worker |
| 共通シェルの未認証表示 | 業務メニューをロック表示し、ヘルプ・プライバシー・ログインだけを使える | Layout.tsx | packages/web | web ビルド |

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

唯一の利用者と保守エージェント。表示のロックは案内であって防御ではない。

#### Identity and authorization

/api/auth/login のセッション発行と authGuard を変えない。認可の判断を見た目の部品へ移さない。

#### Data and secret protection

N/A: 秘密情報の扱いを変えない。

#### Application and supply-chain controls

外部フォント・CDN を追加しない。

#### Detection and response

N/A: 検知・対応の仕組みを変えない。

#### Security verification

未認証でログイン画面を描画したとき、サイドバー・ヘッダー・フッター・ロック表示のいずれも描画されないことを DOM テストで確かめる (PR #48 で改訂)。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| N/A | N/A: 本章のゴールに効く確定意思決定は無い | N/A | 本章は既存構成を変えない判断だけを持つ | N/A |

## Delivery, migration and rollback

- Build/deploy topology: typecheck、vite build、check:js-budget、strip:manifest の既存順序で配信する。
- Migration sequence: トークン正本の新設、写しの置換、lint 追加、共通部品の参照切替の順に進める。
- Rollback trigger/procedure: CI の check 系か lint が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 派生色 #7F9095 は背景 #F6F8F9 で 3.12:1 と余裕が小さい。背景色を変えるときは再計算する。
- Architecture fitness test: 文字用トークンは背景 #F6F8F9 と面 #FFFFFF の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色は 3:1 以上であることをテストが検証し、基準未満の値を入れると落ちる。装飾罫線トークン (#D7E0E2) は 1.4.11 の対象外として検査から外し、入力欄・チェックボックスの枠が装飾罫線トークンを参照していないことを同じテストで確かめる。
- Load/failure/security validation: 既存 check 系 (thead / mobile-layout / financial-figure / financial-routes) と security:content を緑に保つ (S6)。
