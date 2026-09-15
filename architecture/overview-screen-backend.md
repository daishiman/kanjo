---
graph_node_id: "arch-overview-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "概況画面改善 — core 純関数の集計と未処理キュー API"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "backend"]
file_path: "architecture/overview-screen-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "8bec9a4a4bc145efdb1e58243d8ba834e181debde3245115c448c77ea0698cfe"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/backend.md", "source_version": "0.1.14", "source_digest": "8bec9a4a4bc145efdb1e58243d8ba834e181debde3245115c448c77ea0698cfe", "imported_at": "2026-09-14T13:09:32Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-14T13:09:32Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/routes/classify.ts", "packages/api/src/index.ts", "packages/core/src/analysis.ts", "packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/classify.ts", "packages/core/src/vendor-memory.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を backend とし、architecture-backend.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G1", "G2", "G3"]
---

# Architecture overview

概況画面改善 — core 純関数の集計と未処理キュー API。正本は `system-spec/backend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: 現行の概況は GET /api/summary (`packages/api/src/routes/analytics.ts`) が loadScoped で読み、core の overview() で事業だけを集計する。総合の月別値は core の totalCashflowReport (`packages/core/src/total-cashflow.ts`)、仕分けの未処理は classificationProgress().reviewPending (clsSrc=既定)、取込の失敗は import_runs.status にある。分類の解決順は rules → vendor_memory → MF中項目 → 既定で、vendor_memory は 3 件以上かつ 0.8 以上で自動適用される。
- Quality attribute priorities: G1, G2, G3 に資する。決定論 (同じ入力に同じ出力) と単一定義 (4 要素と 3 か所の件数が同じ計算から出る) を最優先にする。
- Constraints: C1: Workers + D1 + React SPA。C2: 外部送信なし (乱数・時刻・外部 API を集計に使わない)。C3: 期間は Dataset を切る。packages/core は依存ゼロの純関数に保つ。

## Goals and non-goals

- Goals:
  - G1: 範囲 (総合/事業/家計) ごとに直近 12 か月 vs 前 12 か月の KPI・推移・年次比較・支出内訳 (上位 5 + その他) を同じ月別系列から作る。
  - G2: 仕分け・照合・取込を全期間で数えた未処理キューと、4 段の信頼度付き推奨を返す。
  - G3: 月次クローズ 4 ステップを判定し、保留と月次レビューの書込 API を持つ。
- Non-goals:
  - 分類アルゴリズムの変更
  - AI/LLM による推定
  - 新しい非同期処理

## System context and boundaries

- Users/external systems: web (同一オリジン) だけが呼ぶ。外部システムへの送信は無い。
- Trust/deployment/data boundaries: ルートは Worker kanjo-console 内で authGuard の後に動き、D1 の行を読んで core に渡すだけにする。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 概況集計 (新設) | 範囲別の 4 要素と月次クローズ判定 | 純関数 | packages/core | core |
| core 未処理キュー (新設) | 3 種の集約、並び順、内容指紋、保留の適用 | 純関数 | packages/core | core |
| core 信頼度 (新設) | vendor_memory → ルール → MF中項目 → 推奨なし | 純関数 | packages/core | core |
| 概況ルート (新設) | D1 の行を読み core に渡す | GET /api/overview | packages/api | Worker |
| 未処理キュー・保留・月次レビューのルート (新設) | 入力検証と書込 | GET /api/review-queue、PUT/DELETE | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: /api/* 配下に置き、authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を通す。
- Errors/resilience: 入力検証違反は 400、書込衝突は 409 canonical_write_busy、スキーマ版不一致は 503。エラー本文は {error:{code,message}} を提案する (推定・plan で確定)。
- Observability/audit: 既存の Worker ログの範囲。月次レビューに reviewed_by_user_id を残す。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET /api/summary は変更しない。新 API は追加のみ。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 architecture-backend.md を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

Cloudflare Workers 上の既存 API。集計と判定は packages/core の純関数に置き、ルートは D1 の行を渡すだけにする。

#### Domain and module boundaries

総合は totalCashflowReport の月別値、事業は freee、家計は MF 家計側を入力にする。未処理の件数は仕分け (classificationProgress、clsSrc=既定)、照合 (totalCashflowReport の review)、取込 (import_runs.status=failed) を全期間で数える。

#### API and service contracts

確定: GET /api/overview、GET /api/review-queue、保留と月次レビューの PUT/DELETE。提案 (推定・plan で確定): ?scope=total|business|household、応答の kpi / trend / yearComparison / breakdown / closeStatus / dataUpdatedAt、PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey、PUT/DELETE /api/monthly-close/:month/review。入力検証は kind (classification|reconciliation|import)、itemKey (長さ上限)、month (YYYY-MM) で 400。

#### Data and transaction behavior

キューの順は照合 → 仕分け → 取込、同種別内は金額の絶対値の降順、同額は日付の新しい順。内容指紋は金額・日付・内容から作り、一致しなければ保留を無効にする。利用者の解除でも消え、月境界で自動解除しない。月次クローズは データ取込 (committed かつ未記録月でない)・仕分け 0・照合 0・月次レビュー行あり の 4 ステップで、保留中は件数から除くがステップ判定では未完了とする。信頼度は (1) vendor_memory の百分率 (四捨五入) と「過去 N 件中 M 件」、(2) ルール (百分率なし)、(3) MF中項目が「事業」で始まれば事業区分のみ、(4) 推奨なし。

#### Async processing

N/A: 新しい非同期処理を追加しない。既存 cron の夜間バックアップが新テーブルを含める変更は database 章が持つ。

#### Security and resilience

PUT/DELETE は冪等にし、CANONICAL_MUTATION_ROUTES に登録して直列化する。集計に乱数・時刻・外部送信を使わない。

#### Operations and verification

core 単体テストで O1 (4 要素の総額差 0)、O2 の指紋変更時の再計上、O5 (信頼度の決定論と推奨なし)。API テストで入力検証の 400、PUT の冪等、O3 の往復。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は dec-overview-aggregation-scope と dec-recommendation-confidence-source を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker ビルドと deploy.yml の経路 (migration 適用の後に wrangler deploy) で配信する。
- Migration sequence: core 純関数とその単体テスト、D1 migration と定数の同時更新、ルートの追加、web の差し替えの順に進める。
- Rollback trigger/procedure: API テストか smoke が落ちたら PR を差し戻し、配信済みなら Worker を直前のビルドへ戻す (新テーブルは残しても無害)。

## Risks and verification

- Risk/assumption: vendor_memory の件数が少ない取引先では一致率が不安定。件数を併記して読み違いを防ぐ。
- Architecture fitness test: 同一 fixture で 4 要素の合計が一致すること、同じ入力から同じ推奨が出ることを core 単体テストで常時検査する。
- Load/failure/security validation: 入力検証の境界値 (itemKey の長さ上限、不正な month) と 409 の衝突を API テストで確かめる。
