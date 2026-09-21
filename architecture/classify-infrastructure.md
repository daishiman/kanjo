---
graph_node_id: "arch-classify-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "明細仕分け — 基盤を変えず件数上限と batch の区切りで無料枠に収める"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "infrastructure"]
file_path: "architecture/classify-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6de2efee9fda877fe65cd1545eba12549dbf0d9e7d9797f186235936a5ef4027"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "6de2efee9fda877fe65cd1545eba12549dbf0d9e7d9797f186235936a5ef4027", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-security", "arch-classify-maintenance-ops", "arch-classify-auth"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml", "packages/api/wrangler.jsonc", "packages/api/src/d1-limits.ts", "package.json", "migrations"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

明細仕分け — 基盤を変えず件数上限と batch の区切りで無料枠に収める。`system-spec/infrastructure.md` は承認時入力、本書は実行基盤・配信・資源の上限の制約を持つ。

## Context and drivers

- Business/technical context: 実行基盤は Cloudflare Workers (api、Hono) と D1、web は静的配信。CI は `.github/workflows/ci.yml`、D1 への migration は `migrate.yml`、配信は `deploy.yml`。`packages/api/wrangler.jsonc` のバインディングは既存の D1 などで、仕分けのための R2・キュー・新バインディングは無い。`packages/api/src/d1-limits.ts` は `D1_MAX_BOUND_PARAMS = 100` と `inClauseChunkSize` を持つ (qa-classify-infrastructure-web-evidence-001)。
- Quality attribute priorities: G2・G3・G5 に資する。構成を変えず (qa-classify-infrastructure-web-001)、1 要求の読み書きの量を上限で抑えて無料枠の中で動かす。
- Constraints: D1 Free の上限は rows read 5M/日・rows written 100k/日 (agent 推定・利用者未確認、根拠 qa-classify-infrastructure-web-002)。Worker の CPU 時間の上限。外部サービスを呼ばない。

## Goals and non-goals

- Goals:
  - G2: 一覧と件数を期間の明細の 1 回の読込から導き、要求ごとの行読込を表示期間 (最大 3 年) に抑える。
  - G3: 一括保存 1 回 100 件、D1 batch 1 回あたり最大 50 文 (agent 推定・利用者未確認、根拠 qa-classify-infrastructure-web-002) で書き、batch の区切りを明細の境界に合わせる。
  - G5: 保存フィルタと履歴を既存の D1 に置き、新しい保管先を足さない。
- Non-goals:
  - R2・キュー・Durable Objects・新しいバインディングの追加
  - 外部 LLM・外部 API の呼出し
  - 環境 (本番・プレビュー) の構成変更

## System context and boundaries

- Users/external systems: ブラウザ → Cloudflare (静的配信と Worker) → D1。GitHub Actions が migration と配信を行う。
- Trust/deployment/data boundaries: 本番の D1 への書込は `migrate.yml` と Worker だけ。ローカルの wrangler は本番に触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| api Worker | 仕分けの新経路を既存の Worker に載せる | HTTP | packages/api | Cloudflare Workers |
| D1 | 手当て・分割・ルール・保存フィルタ・履歴 | SQL | migrations | Cloudflare D1 |
| web の静的配信 | lazy route の仕分け画面 | HTTPS | packages/web | 静的配信 |
| `ci.yml` | lint・型・テスト | GitHub Actions | リポジトリ | CI |
| `migrate.yml` / `deploy.yml` | 追加 migration の反映と配信 | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: 既存の Worker の認証に従う (`architecture/classify-auth.md`)。
- Errors/resilience: 上限を超える要求は 400 で止め、Worker の CPU 時間の超過を起こさない。
- Observability/audit: N/A: 新しい運用信号を追加しない。既存の Workers のログに従う。
- Configuration/secrets: 新しい環境変数・秘密情報を持たない。
- Compatibility/versioning: migration を先、Worker を後に配信する既存の順を守る。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/classify-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: N/A: 本章の関心外 (`architecture/classify-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: 既存の本番とローカル (wrangler dev + vite)。新しい環境を作らない。
- Topology: 単一の Worker と単一の D1。リージョンや複製の構成を変えない。

#### Compute and storage

- Compute: 既存の api Worker。一括保存・ルールのプレビューと適用は要求内で完結させ、非同期の実行基盤を足さない。
- Storage: 既存の D1 に 2 表と列を足す。R2 を使わず、証憑を保存しない。
- Capacity: 一覧とプレビューは表示期間の明細を 1 回の SQL で読む (agent 推定・利用者未確認、根拠 qa-classify-infrastructure-web-002)。`IN (...)` は `inClauseChunkSize` で区切り、バインド変数 100 を超えない。

#### IaC and delivery

- IaC: `wrangler.jsonc` を変えない。schema は migration の SQL で管理する。
- Delivery: `ci.yml` → `migrate.yml` (追加 migration) → `deploy.yml` (Worker と web)。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を migration と同じ変更で上げ、未適用の環境を 503 で止める。

#### Secrets and access

- Secrets: 新しい秘密情報を持たない。既存の GitHub Actions の secrets と Cloudflare の API トークンに従う。
- Access: 本番の D1 への migration は `migrate.yml` からだけ行う。

#### Reliability and recovery

- Failure modes: batch の失敗はその batch の明細だけを失敗として返し、他の明細に波及させない。409 `canonical_write_busy` は取込の洗替えと重なったときに返り、利用者の再送で回復する。
- Recovery: Worker は直前版へ戻せる。schema は追加のみなので戻さない。D1 の Time Travel に従う。

#### Infrastructure verification

CI で lint・型・core / API / DOM のテストを通す。migration をローカル D1 に当てて `schema-guard` が 503 を返さないことを確かめる。一括保存 100 件とルール適用 (3 年分の期間) の API 統合テストで、batch の区切りとバインド変数の上限を守ることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-infrastructure-web-001 | 構成を変えず、R2・キュー・新バインディングを足さない | ルール適用をキューで非同期に行う | 運用する部品が増えず無料枠のまま動く | 1 要求の量を上限で抑える |
| qa-classify-infrastructure-web-002 | D1 batch 1 回あたり最大 50 文で、区切りを明細の境界に合わせる (agent 推定・利用者未確認) | 1 要求を 1 batch で書く | 1 明細の書込が batch をまたがず、失敗の範囲が明細単位になる | 100 件の一括保存は複数の batch になる |
| qa-classify-infrastructure-web-002 | プレビューと適用は表示期間 (最大 3 年) を 1 回の SQL で読む (agent 推定・利用者未確認) | 全期間を読む | 行読込を期間に比例させ、無料枠を守る | 期間の外の明細はルールの対象外になる |
| qa-classify-infrastructure-web-001 | 外部サービスを呼ばない | 外部 LLM で提案する | 費用・可用性・外部送信の問題が出ない | 提案は決定論の規則に限る |

## Delivery, migration and rollback

- Build/deploy topology: GitHub Actions の `ci.yml` → `migrate.yml` → `deploy.yml`。
- Migration sequence: 追加 migration を Migrate で反映 → Worker と web を Deploy。
- Rollback trigger/procedure: Deploy 後の不具合は Worker と web を直前版へ戻す。Migrate が通って Deploy が止まった場合は Deploy を再実行する。migration は戻さない。

## Risks and verification

- Risk/assumption: ルール適用やプレビューを繰り返すと、3 年分の明細の読込が rows read の日次上限に近づく。1 要求の読込を表示期間に限り、画面のプレビューは入力の確定ごとに 1 回だけ要求する。
- Risk/assumption: 履歴を全ての変更経路で書くため rows written が増える。一括保存 100 件 × 変更項目数の行になり、日次上限 100k に対して利用者 1 人では十分な余裕があると見込むが、実測は無い。
- Architecture fitness test: `wrangler.jsonc` のバインディングが増えていないこと。`IN (...)` の組み立てが `inClauseChunkSize` を通ること。
- Load/failure/security validation: 100 件の一括保存と 3 年分のプレビューが Worker の CPU 時間内に収まること。
