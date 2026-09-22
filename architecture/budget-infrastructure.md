---
graph_node_id: "arch-budget-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "予算 — 基盤を変えず行数上限と 1 回の D1 batch で無料枠に収める"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "infrastructure"]
file_path: "architecture/budget-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "d69bafe2c6f37b37fd1c18513b3e15eeb609d7830c50a59b0f9c67adbf1570fb"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "d69bafe2c6f37b37fd1c18513b3e15eeb609d7830c50a59b0f9c67adbf1570fb", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-security", "arch-budget-maintenance-ops", "arch-budget-auth"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml", "packages/api/wrangler.jsonc", "packages/api/src/schema-guard.ts", "packages/web/scripts/check-initial-js-budget.mjs", "package.json", "migrations"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G3"]
---

# Architecture overview

予算 — 基盤を変えず行数上限と 1 回の D1 batch で無料枠に収める。`system-spec/infrastructure.md` は承認時入力、本書は実行基盤・配信・資源の上限の制約を持つ。

## Context and drivers

- Business/technical context: api は Hono の Cloudflare Worker で D1 を使う (`packages/api/wrangler.jsonc`)。web は静的配信。CI は `.github/workflows/ci.yml`、D1 への migration は `migrate.yml`、配信は `deploy.yml`。migration の本番反映は既存の Deploy / Migrate の手順で、行書き換えの migration で Deploy が止まった過去がある。D1 Free は rows read 5 million / day・rows written 100,000 / day・5 GB (https://developers.cloudflare.com/d1/platform/pricing/) (qa-budget-infrastructure-web-evidence-001)。夜間バックアップは既存の scheduled ジョブが統合 JSON を R2 `backups/` へ書き 30 日保持する (`packages/api/src/index.ts`)。
- Quality attribute priorities: G3 に資する。Google SRE の reliability (予算の保存を 1 期間ぶんの D1 batch 1 回にまとめ、途中で失敗しても前の予算が残る。単独利用のため SLO は定めない) と operations (新しい資源を増やさず既存の Deploy / Migrate の手順 1 本で反映する) を適用する。
- Constraints: 構成は変えない。R2・キュー・新しいバインディング・外部サービスを足さない (qa-budget-infrastructure-web-001)。Worker の CPU 時間と D1 の読み書きの無料枠。初期 JS 予算 (`packages/web/scripts/check-initial-js-budget.mjs`) を超えない。

## Goals and non-goals

- Goals:
  - G3: 予算の保存を D1 の batch 1 回 (dirty 科目の DELETE + JSON INSERT + revision 更新 + snapshot 無効化) とし、200 行を上限に 3〜5 文へ収める。
  - G3: 画面用の取得を Dataset の読込み 1 回と予算の表の読取り 1 回に留め、算出を 1 回の要求で完結させる (agent 推定・利用者未確認、根拠 qa-budget-infrastructure-web-002)。
  - G3: 追加のみの migration 1 本を既存の Migrate / Deploy の手順で反映する (qa-budget-decision-001)。
- Non-goals:
  - R2・キュー・Durable Objects・新しいバインディングの追加
  - 外部 LLM・外部 API の呼出し
  - 環境 (本番・プレビュー) の構成変更・新しい運用手順

## System context and boundaries

- Users/external systems: ブラウザ → Cloudflare (静的配信と Worker) → D1。GitHub Actions が migration と配信を行う。
- Trust/deployment/data boundaries: 本番の D1 への書込は `migrate.yml` と Worker だけ。ローカルの wrangler は本番に触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| api Worker | 予算の取得と保存の経路を既存の Worker に載せる | HTTP | packages/api | Cloudflare Workers |
| D1 | `budget_plans` (新表) と既存 `budgets` | SQL | migrations | Cloudflare D1 |
| R2 `backups/` (既存) | 夜間バックアップの統合 JSON (予算の行を含むようになる) | R2 | packages/api | Cloudflare R2 |
| web の静的配信 | lazy route の予算画面 | HTTPS | packages/web | 静的配信 |
| `ci.yml` | lint・型・テスト・初期 JS 予算 | GitHub Actions | リポジトリ | CI |
| `migrate.yml` / `deploy.yml` | 追加 migration の反映と配信 | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: 既存の Worker の認証に従う (`architecture/budget-auth.md`)。
- Errors/resilience: 行数上限を超える保存は 400 で止め、Worker の CPU 時間の超過を起こさない。保存の失敗は保存バーの通知と下書きからの再保存で回復させる。
- Observability/audit: N/A: 新しい運用信号を追加しない。既存の Workers のログに従う。
- Configuration/secrets: 新しい環境変数・秘密情報を持たない。
- Compatibility/versioning: migration を先、Worker を後に配信する既存の順を守る。追加のみの migration なので、旧版の Worker が動いている間に新しい表ができても旧画面は影響を受けない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/budget-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: N/A: 本章の関心外 (`architecture/budget-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: 既存の本番とローカル (wrangler dev + vite)。新しい環境を作らない。
- Topology: 単一の Worker と単一の D1。リージョンや複製の構成を変えない。

#### Compute and storage

- Compute: 既存の api Worker。予算画面の算出は要求内で完結させ、非同期の実行基盤を足さない。
- Storage: 既存の D1 に `budget_plans` を 1 表足す。夜間バックアップの JSON が予算の行ぶん大きくなるが、R2 の保存先と保持期間は変えない。
- Capacity: 1 回の保存は dirty 行 200 件・3〜5 文以内。画面用の取得は `budget_plans` を含む Dataset の既存読込み 1 回。

#### IaC and delivery

- IaC: `wrangler.jsonc` を変えない。schema は migration の SQL で管理する。
- Delivery: `ci.yml` → `migrate.yml` (追加 migration) → `deploy.yml` (Worker と web)。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を migration と同じ変更で上げ、未適用の環境を 503 で止める。

#### Secrets and access

- Secrets: 新しい秘密情報を持たない。既存の GitHub Actions の secrets と Cloudflare の API トークンに従う。
- Access: 本番の D1 への migration は `migrate.yml` からだけ行う。

#### Reliability and recovery

- Failure modes: D1 batch は全か無かなので、保存の途中の失敗で予算が半端に書かれることは無く、前の予算が残る。409 `canonical_write_busy` は取込の洗替えと重なったときに返り、利用者の再送で回復する。下書きは保存成功まで端末に残る。
- Recovery: Worker は直前版へ戻せる。schema は追加のみなので戻さない。予算は夜間バックアップの JSON と D1 の Time Travel から戻せる。

#### Infrastructure verification

CI で lint・型・core / API / DOM のテストと初期 JS 予算 (`build:bundle` の直後の `check:js-budget`) を通す。migration をローカル D1 に当てて `schema-guard` が 503 を返さないことを確かめる。200 行の保存が 1 batch で書け、201 行が 400 になることを API 統合テストで確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-infrastructure-web-001 | 構成を変えず、R2・キュー・新バインディング・外部サービスを足さない | 自動提案を外部 API で出す / 保存をキューで非同期にする | 運用する部品が増えず無料枠のまま動く | 1 要求の量を上限で抑える |
| qa-budget-infrastructure-web-002 | 保存は D1 batch 1 回 (dirty DELETE + JSON INSERT + revision + snapshot、200 行上限) | 行ごとに要求する / 複数 batch に分ける | 途中失敗で前の予算が残り、1 回の書込みが 3〜5 文に収まる | 200 行を超える dirty 科目数は保存できない |
| qa-budget-infrastructure-web-002 | 画面用の取得は Dataset 1 回と予算の表 1 回の読取り (agent 推定・利用者未確認) | 部品ごとに別の要求で読む | 行読込を要求 1 回ぶんに抑える | 期間と開始月を変えるたびに画面全体を読み直す |
| qa-budget-decision-001 | 追加のみの migration 1 本を既存の Migrate / Deploy で反映する | 行書き換えの migration | Deploy が止まったときの復旧が軽い | 初期値は読み出し時に作る |

## Delivery, migration and rollback

- Build/deploy topology: GitHub Actions の `ci.yml` → `migrate.yml` → `deploy.yml`。
- Migration sequence: 追加 migration を Migrate で反映 → Worker と web を Deploy。
- Rollback trigger/procedure: Deploy 後の不具合は Worker と web を直前版へ戻す。Migrate が通って Deploy が止まった場合は Deploy を再実行する。migration は戻さない。

## Risks and verification

- Risk/assumption: 実績期間を変えるたびに Dataset 全体を読むため、期間タブの切替えを繰り返すと rows read が増える。利用者 1 人の操作では日次上限 5M に十分な余裕があると見込むが、実測は無い。
- Risk/assumption: 3 年の実績から季節性・増減率を科目ごとに出す算出が Workers の CPU 時間に収まるかは実測が無い。3 年分の固定データで API 統合テストを回して確かめる。
- Architecture fitness test: `wrangler.jsonc` のバインディングが増えていないこと。保存の route が 1 回の `db.batch` だけで書くこと。
- Load/failure/security validation: 200 行の保存と 3 年分の画面用の取得が Worker の CPU 時間内に収まること。
