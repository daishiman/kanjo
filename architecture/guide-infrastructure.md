---
graph_node_id: "arch-guide-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "使い方 — 新しい Worker・binding・cron・環境変数を足さず、/api/guide は既存の api Worker に載せ、画面は遅延 chunk にして初期 JS 110KiB の予算を守る"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "infrastructure"]
file_path: "architecture/guide-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "00053ca510de65ebd9915185fd8438088ba8875359d36ba66752c54b25ce906f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "00053ca510de65ebd9915185fd8438088ba8875359d36ba66752c54b25ce906f", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/index.ts", "packages/web/scripts/check-initial-js-budget.mjs", "packages/web/package.json", "packages/web/src/AuthenticatedApp.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G1", "G4"]
---

# Architecture overview

使い方 — 本サイクルは基盤に何も足さない。`GET /api/guide` は既存の api Worker (Hono、`packages/api/src/index.ts`) の `analyticsRoute` に 1 経路として載り、D1 binding・Workers Assets・cron (`0 18 * * *`) はそのまま使う。使い方画面は既存どおり遅延 chunk (`AuthenticatedApp.tsx:39` の `lazy`) で読み、初期 JS の予算 110KiB (`check-initial-js-budget.mjs:8`) を超えない (qa-guide-infrastructure-web-001)。`system-spec/infrastructure.md` は承認時入力、本書は配置と予算の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: api Worker は `wrangler.jsonc` の `main` (:4)・`assets` (:8)・`d1_databases` (:15)・`crons` (:31、`["0 18 * * *"]`) で構成される。web は Workers Assets から配信され、初期 JS は `build` の中で `check:js-budget` (`packages/web/package.json:9`・:15) が gzip 110KiB で止める (qa-guide-infrastructure-web-evidence-001)。
- Quality attribute priorities: G1・G4 に資する。SRE の reliability (api が失敗しても本文を描く) と operations (cron・binding・環境変数を足さない) を適用する。Clean Architecture 等の card は本章で 0 件。
- Constraints: Cloudflare Workers Static Assets (出典 cloudflare-workers-static-assets、2026-07-03 確認)。単一の api Worker。

## Goals and non-goals

- Goals:
  - G1: 使い方画面の本文を、api が落ちている間も描ける配置にする (本文は chunk の定数、数値だけ api)。
  - G4: 基盤の変更面を 0 にして、秘密情報・binding の追加に伴う誤設定を生まない。
- Non-goals:
  - 新しい Worker・Durable Object・KV・R2・Queue
  - cron の追加・時刻変更
  - 環境変数・secret の追加
  - CSP・配信経路の変更

## System context and boundaries

- Users/external systems: 利用者のブラウザ → Workers Assets (web) と api Worker (`/api/*`)。
- Trust/deployment/data boundaries: 既存の 1 Worker の中に閉じる。D1 は既存の binding だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| api Worker (`packages/api/src/index.ts`) | `/api/guide` を含む業務 API | HTTP | packages/api | Cloudflare Workers |
| Workers Assets (`wrangler.jsonc:8`) | web の静的配信 | HTTP | packages/web | 同上 |
| 使い方の遅延 chunk (`AuthenticatedApp.tsx:39`) | 本文・目次・検索 | ES module | packages/web | Workers Assets |
| `check-initial-js-budget.mjs` | 初期 JS gzip 110KiB の上限 | build の一段 | packages/web | CI |

## Cross-cutting contracts

- Identity/access: `architecture/guide-auth.md` のとおり。
- Errors/resilience: `/api/guide` の失敗時も本文・目次・検索を描き、数値の欄だけを「取得できませんでした」にする (`architecture/guide-ui-ux.md`)。
- Observability/audit: 既存の Workers のログのまま。新しい計測を足さない。
- Configuration/secrets: N/A: 環境変数・secret を足さない。
- Compatibility/versioning: `wrangler.jsonc` を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/guide-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/guide-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Environments and topology

既存の本番・ローカル (wrangler dev) のまま。使い方のための環境を足さない。

#### Compute and storage

計算は既存の api Worker の 1 リクエスト内で `loadScoped` → core → `{ screen }`。保存先は足さない (`architecture/guide-database.md`)。

#### IaC and delivery

`wrangler.jsonc` を変えない。配信は既存の `deploy` (`package.json` の `build:artifact` → api の deploy) のまま。

#### Secrets and access

N/A: 新しい秘密情報を持たない。

#### Reliability and recovery

本文は chunk の定数なので api の障害に影響されない。巻き戻しはコードを戻して再デプロイするだけ (migration なし)。

#### Infrastructure verification

`pnpm build` の中の `check:js-budget` が 110KiB 以下で緑であること。使い方画面が遅延 chunk のままであること (初期 JS に入らない)。`wrangler.jsonc` の差分が 0 であること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-infrastructure-web-001 | `/api/guide` を既存の api Worker に載せる | ガイド専用の Worker | 認証境界と D1 binding をそのまま使える | api Worker の経路が 1 本増える |
| qa-guide-infrastructure-web-001 | 画面を遅延 chunk のままにする | 初期 JS に含める | 110KiB の予算を守る | 初回表示で chunk を 1 つ読む |
| qa-guide-infrastructure-web-001 | cron・binding・環境変数を足さない | 定期の再集計 | 数値は読むたびに導くので不要 | 数値の計算は要求時に行う |

## Delivery, migration and rollback

- Build/deploy topology: 既存の `deploy` (web の `build:artifact` → api の deploy)。
- Migration sequence: N/A: 基盤の変更なし。
- Rollback trigger/procedure: `check:js-budget` が赤、または本番で `/api/guide` が 5xx を返し続けるならコードを戻して再デプロイする。

## Risks and verification

- Risk/assumption: core の guide-screen を web が読むと chunk の中に core の関数が入る。遅延 chunk 側に入り、初期 JS に漏れないことを `check:js-budget` で確かめる。`check:js-budget` は `build:bundle` の直後に走る (build:artifact 後は manifest が無い)。
- Risk/assumption: 本文を api からも返す設計にすると、api 障害時に本文が消える。本文は chunk の定数を正とする。
- Architecture fitness test: `wrangler.jsonc` に差分が無いこと。
- Load/failure/security validation: `/api/guide` を 503 にした描画検査で本文が描かれること (`architecture/guide-maintenance-ops.md` の check:guide-screen)。
