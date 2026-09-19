---
graph_node_id: "arch-household-cashflow-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "家計収支 — 基盤を変えず要求ごとに導出する"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["household-cashflow", "infrastructure"]
file_path: "architecture/household-cashflow-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "b80d7f55fdb32981311d2c931a5bbc3d422edbe0ba5460e15b40ee1722e522b1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "b80d7f55fdb32981311d2c931a5bbc3d422edbe0ba5460e15b40ee1722e522b1", "imported_at": "2026-09-18T12:24:49Z"}
created_at: "2026-09-18T12:24:49Z"
updated_at: "2026-09-18T12:24:49Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml", "packages/api/wrangler.jsonc", "package.json", "migrations"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/household-cashflow-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:24:49Z"}
serves_goals: ["G2", "G4"]
---

# Architecture overview

家計収支 — 基盤を変えず要求ごとに導出する。`system-spec/infrastructure.md` は承認時入力、本書は実行基盤・容量・配信手順の制約を持つ。データ契約の正本は `specs/spec-household-cashflow-screen.md` §11。

## Context and drivers

- Business/technical context: `.github/workflows` には `ci.yml`・`deploy.yml`・`migrate.yml` がある。ルートの `package.json` は build (web の build と `wrangler deploy --dry-run`)、deploy (build:artifact と api の deploy)、`db:migrate:local` / `db:migrate:remote` を持つ。api は `packages/api/wrangler.jsonc` の Worker で、D1 を DB binding として使う。直近の #58 で初期 JS 予算の CI 実測値を記録している (qa-household-infrastructure-web-evidence-001)。
- Quality attribute priorities: G2・G4 に資する。Google SRE の reliability (要求ごとの導出を Worker の CPU 時間に収める) と operations (既存の CI と Deploy の手順をそのまま使う) を適用する。
- Constraints: Cloudflare Workers (Hono) + D1 + 静的資産の配信。新しいキャッシュ層・キュー・外部サービス・監視・通知を足さない。

## Goals and non-goals

- Goals:
  - G2: 家計集計を要求のたびに core の純関数で導出し、Worker の CPU 時間の範囲に収める。
  - G4: `owner_labels` の migration を既存の Migrate ワークフローと Deploy ワークフローの手順とゲートで反映する。
- Non-goals:
  - キャッシュ層・キュー・外部サービスの追加
  - 新しい監視・通知の追加
  - 実行基盤 (Workers / D1 / 静的資産の配信) の変更

## System context and boundaries

- Users/external systems: ブラウザ → Cloudflare の静的資産と Worker → D1。GitHub Actions が CI・Migrate・Deploy を実行する。
- Trust/deployment/data boundaries: 家計画面は既存と同じく遅延読み込みのルートとして配信する。D1 への schema 変更は Migrate ワークフローだけが行う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker (Hono) | 家計の 2 経路と名義ラベルの 2 経路を提供し、集計を要求ごとに導出する | HTTP | packages/api | `packages/api/wrangler.jsonc` |
| D1 | 既存の明細・判定・除外の表と新設の `owner_labels` | DB binding | D1 | Cloudflare |
| 静的資産 | 家計画面を遅延読み込みのチャンクとして配信する | HTTPS | packages/web | web ビルド |
| `ci.yml` | lint・typecheck・test・初期 JS 予算の検査に家計画面も含める | GitHub Actions | リポジトリ | CI |
| `migrate.yml` | `owner_labels` の migration を D1 へ反映する | GitHub Actions | migrations | CI |
| `deploy.yml` | migration の反映後に Worker と静的資産を出す | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: N/A: 基盤の認証設定は変えない (`architecture/household-cashflow-auth.md`)。
- Errors/resilience: migration 未適用の Worker は `runtimeSchemaGuard` の既存 503 契約で止まる。集計の失敗は画面の PageState error で再試行する。
- Observability/audit: N/A: 新しい監視・通知を設けない。
- Configuration/secrets: `wrangler.jsonc` の binding と秘密情報を追加しない。
- Compatibility/versioning: migration は追加のみで、既存の Worker 版から見ても既存表は不変。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/household-cashflow-database.md`)
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Runtime topology

既存の Cloudflare Workers (Hono) と D1、静的資産の配信をそのまま使う。家計の集計は同一 Worker 内の core 純関数で行い、外部サービスを呼ばない。

#### Capacity and budget

入力は期間最大 3 年分の台帳で、集計は行数に比例する 1 回の走査と、振替の対推定 (同額でまとめてから日付差で照合) で済む。したがってキャッシュ層やキューを足さない。web は初期 JS 予算 (CI の実測値) を超えない。

#### Response partitioning

本体 `GET /api/household` とカテゴリ詳細 `GET /api/household/category` を分け、詳細は選択時にだけ取得する。本体の応答に全区分の取引を含めない。

#### Reliability posture

`owner_labels` は追加のみの migration なので、巻き戻しは Worker を直前版へ戻して表を使わないことで足りる。migration の反映前に新しい Worker が出ても、`runtimeSchemaGuard` が新経路を中途半端に動かさない。

#### Infrastructure verification

`ci.yml` の lint・typecheck・test・初期 JS 予算の検査が家計画面を含めて緑。`migrate.yml` で `owner_labels` を反映してから `deploy.yml` で Worker を出す順序を守る。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-household-infrastructure-web-001 | 家計集計は要求ごとに導出し、キャッシュ層・キューを足さない | 集計結果のキャッシュ / 事前集計のキュー | 入力が最大 3 年分の台帳で 1 回の走査に収まり、運用対象を増やさない | 期間が大きくなると CPU 時間が伸びるため走査の線形性を保つ |
| qa-household-infrastructure-web-001 | `migrate.yml` → `deploy.yml` の既存手順で `owner_labels` を反映する | 手動で D1 に適用する | 既存のゲートを通り、反映の順序が記録に残る | migration を含む変更は 2 段の実行が要る |
| qa-household-infrastructure-web-001 | 新しい監視・通知を設けない | 家計経路専用の監視を足す | 既存の CI と Deploy の検査で回帰を止められる | 実行時の異常検知は既存の範囲に留まる |
| dec-household-ledger-source | 総収支と同じ台帳の読み取り (`loadCashflowSources`) を使う | 家計専用の読み取りと表を足す | 読み取りの経路と負荷の性質が総収支と同じになる | 総収支の読み取りの変更が家計にも効く |

## Delivery, migration and rollback

- Build/deploy topology: `ci.yml` (lint・typecheck・test・初期 JS 予算) → `migrate.yml` (D1) → `deploy.yml` (Worker と静的資産)。
- Migration sequence: origin/main を fetch して migration 番号を確定 → `migrate.yml` で `owner_labels` を反映 → `deploy.yml` で Worker を出す。
- Rollback trigger/procedure: Deploy 後に不具合が出たら Worker を直前版へ戻す。追加のみなので表は残したまま使わない。

## Risks and verification

- Risk/assumption: migration の反映前に Worker が出ると新経路が失敗する。`runtimeSchemaGuard` の 503 で止め、反映順序を守る。
- Architecture fitness test: `wrangler.jsonc` に新しい binding が無いこと。家計の経路が外部サービスを呼ばないこと。
- Load/failure/security validation: 最大 3 年分の台帳で集計が Worker の CPU 時間に収まること。初期 JS 予算を超えないこと。
