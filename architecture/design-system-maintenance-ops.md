---
graph_node_id: "arch-design-system-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "デザインシステム共通化 — 規約の機械検出と規約文書"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system", "maintenance-ops"]
file_path: "architecture/design-system-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-design-system-foundation/completeness-findings.json", "evaluated_digest": "d81c4f38a04af0e0932f7a05c2f55cf87885aa55eeae8cd66f7cf442fb2b67ff"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-design-system-foundation/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "d81c4f38a04af0e0932f7a05c2f55cf87885aa55eeae8cd66f7cf442fb2b67ff", "imported_at": "2026-09-13T08:15:21Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure"]
resource_scope: ["package.json", "scripts/check-design-tokens.mjs", "docs/design-system.md"]
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
classification_reason: "system-spec の maintenance-ops 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/design-system-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G4"]
---

# Architecture overview

デザインシステム共通化 — 規約の機械検出と規約文書。正本は `system-spec/maintenance-ops.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-design-system-foundation.md`。

## Context and drivers

- Business/technical context: pnpm lint は biome check → sync-project-skills --check → check-glossary → check-report-css → check-graph-lineage → security:content を直列に実行する。check-report-css.mjs は『正本 report.css と写し report-css.ts がズレたら落とす』検査で、正本→写しのずれ検出を lint へ組み込む前例がすでにある。トークンの写しずれ検出と直書き検出は、この列に同じ型の node スクリプトとして足せる。
- Quality attribute priorities: G4 に資する。Clean Code card の『同じ知識を 1 か所に置く (DRY)』と『意図を名前で示す』を保守の仕組みに適用した。色の値を役割名で呼ぶ (例: 注意の塗りと注意の文字を別名にする) ことで、直書きの hex がコードに現れた時点で規約違反と判別できる。これを lint で機械検出するのは、人やエージェントのレビューに頼ると規約が今後の作成物へ届かないためである。
- Constraints: C1: packages/core は依存ゼロの純関数・純データに保つ (README アーキテクチャ節)。トークン正本はランタイム依存を持たない TypeScript の定数として置く。 C2: 初期 JS 予算 (packages/web の check:js-budget) を超えない。トークン導入で追加の外部ライブラリを入れない。

## Goals and non-goals

- Goals:
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
| pnpm lint の直列列 | biome、sync-project-skills、check-glossary、check-report-css、check-graph-lineage、security:content に写しずれと直書き検出を追加 | package.json scripts | repo root | CI |
| 規約文書 | 色の役割・タイポグラフィ・余白・シェル・ボタン・チャートの使い方 | docs 配下の Markdown | docs | repo |

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

N/A: 実行環境を変えない。

#### Compute and storage

N/A: 計算資源を追加しない。

#### IaC and delivery

check-report-css.mjs と同じ型の node スクリプトを lint 列へ足す。report 側は CSS 正本から TS 写しの向き、トークンは TS 正本から CSS 写しの向きであることを規約文書に明記する。

#### Secrets and access

N/A: 秘密情報を扱わない。

#### Reliability and recovery

lint が落ちたときの対処 (正本を直して写しを再生成する) を規約文書に書く。

#### Infrastructure verification

写しを 1 値ずらすと pnpm lint が exit 非 0、戻すと exit 0 になることを確かめる (O2)。

## Architecture decisions

決定本文・代替案・帰結の正本は docs/design-system/architecture-decision.md。本章は dec-design-token-source を参照し、運用固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: typecheck、vite build、check:js-budget、strip:manifest の既存順序で配信する。
- Migration sequence: トークン正本の新設、写しの置換、lint 追加、共通部品の参照切替の順に進める。
- Rollback trigger/procedure: CI の check 系か lint が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 派生色 #7F9095 は背景 #F6F8F9 で 3.12:1 と余裕が小さい。背景色を変えるときは再計算する。
- Architecture fitness test: 文字用トークンは背景 #F6F8F9 と面 #FFFFFF の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色は 3:1 以上であることをテストが検証し、基準未満の値を入れると落ちる。装飾罫線トークン (#D7E0E2) は 1.4.11 の対象外として検査から外し、入力欄・チェックボックスの枠が装飾罫線トークンを参照していないことを同じテストで確かめる。
- Load/failure/security validation: 既存 check 系 (thead / mobile-layout / financial-figure / financial-routes) と security:content を緑に保つ (S6)。
