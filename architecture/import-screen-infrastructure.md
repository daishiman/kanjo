---
graph_node_id: "arch-import-screen-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "データ取込 — 仮置きを既存 R2 の専用接頭辞に置き、片づけを既存の夜間保守に載せて、基盤は D1 の表の追加だけにする"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "infrastructure"]
file_path: "architecture/import-screen-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2e050c28b0a7fc383a43286e8c150e1d4551196f7a0b6f57310c26f729ff084c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "2e050c28b0a7fc383a43286e8c150e1d4551196f7a0b6f57310c26f729ff084c", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-frontend", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-auth", "arch-import-screen-security", "arch-import-screen-maintenance-ops"]
resource_scope: [".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "packages/api/wrangler.jsonc", "migrations", "packages/api/src/index.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/schema-guard.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:53:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6"]
---

# Architecture overview

データ取込 — 仮置きを既存 R2 の専用接頭辞に置き、片づけを既存の夜間保守に載せて、基盤は D1 の表の追加だけにする。`system-spec/infrastructure.md` は承認時入力、本書は配信構成・資源の使い方・反映の順序の制約を持つ。規則の正本は `specs/spec-import-screen.md` (spec-import-screen) の非機能要件の節と互換性・移行・リリースの節。

## Context and drivers

- Business/technical context: packages/api は Cloudflare Workers の Hono アプリで、設定は `packages/api/wrangler.jsonc`。D1 と Drizzle で表を持ち、原本は R2 の `FILES` バインディング (`kanjo-files`) に保存する。夜間保守は cron `0 18 * * *` で動く (`packages/api/src/index.ts` の scheduledMaintenance)。migration はリポジトリ直下の `migrations/` に番号順で置く (qa-imp-infrastructure-web-evidence-001)。
- Quality attribute priorities: G1〜G6 に資する。Google SRE の reliability (反映の順序・メモリの上限) と operations (既存の deploy・migrate・cron をそのまま使う) を適用する。
- Constraints: Worker 1 isolate のメモリ 128MB、request body の上限 (Free/Pro 100MB)、CPU 時間 (既定 30 秒)。新しいバインディング・外部サービス・キューは足さない。

## Goals and non-goals

- Goals:
  - G2: 仮置きの原本を既存の R2 (`FILES`) の接頭辞 `import-staging/{user_id}/{inspection_id}/{file_id}` に置き、確定時に既存の取込の鍵へコピーしてから仮置きを消す。応答消失後の再送には R2 原本ではなく、D1 の最小結果 receipt を使う。
  - G2: 期限切れの仮置きと検査行を既存の夜間保守が 1 回あたり 500 件まで消し、残りは翌日に回す。同じ夜間保守で `import_rate_limits` の 1 日より古い時間枠を消す (qa-imp-decision-010)。
  - G6: 検査の 1 要求は multipart 本文 (最大 30MB) を読んだ後、1 ファイルずつ順にパースと展開 (最大 60MB) をして R2 へ置き、前のファイルの展開結果を手放してから次へ進む (qa-imp-decision-007)。
- Non-goals:
  - 新しいバインディング・R2 バケット・キュー・外部サービス・secret
  - Worker のプランや制限値の変更
  - 配信経路 (Workers Assets) の変更

## System context and boundaries

- Users/external systems: GitHub Actions (deploy・migrate)、Cloudflare (Workers・D1・R2・Cron Triggers)。
- Trust/deployment/data boundaries: 仮置きは本番の R2 の同じバケットの専用接頭辞に閉じ、確定済みの原本とは鍵の接頭辞で分ける。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker (既存) | 検査・確定・履歴の経路 | Hono | packages/api | Cloudflare Workers |
| D1 (既存) | 検査・ファイル項目・レート制限の表 | D1 binding `DB` | packages/api | D1 |
| R2 `FILES` (既存) | 仮置き (`import-staging/` 接頭辞) と確定済みの原本 | R2 binding | packages/api | R2 |
| 夜間保守 (既存の cron) | 期限切れの仮置きと検査行、古い時間枠の片づけ | scheduled handler | packages/api | Cron Triggers |
| deploy / migrate ワークフロー (既存) | Migrate → Deploy の反映 | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: 追加の資格情報は無い。既存のワークフローの権限のまま。
- Errors/resilience: 仮置きが確定前に消えても、検査のやり直しで回復できる。
- Observability/audit: N/A: 新しい信号を足さない。夜間保守の処理件数は既存の保守の予算の枠に載せる。
- Configuration/secrets: `wrangler.jsonc` のバインディングと cron は変えない。
- Compatibility/versioning: migration は表の追加だけなので、適用後に旧 Worker が動いていても新しい表を読まないだけで壊れない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/import-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/import-screen-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/import-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/import-screen-security.md`)

### Infrastructure architecture

#### Environments and topology

ローカル (wrangler dev)・CI・本番の 3 つ。本番は既存の 1 Worker + D1 + R2 + Workers Assets のまま。取込のために新しい環境や Worker は足さない。

#### Compute and storage

計算は既存の Worker の中で行う。検査は 1 ファイルずつ順に処理し、同時に展開するのは 1 ファイルだけにする (ピーク約 90MB、agent 推定・未実測)。保存は D1 の新しい 3 表と、R2 の `import-staging/` 接頭辞。検査と確定の D1 クエリは既存のクエリ予算に収める。レート制限の計数も D1 の表で持つ。

#### IaC and delivery

設定は `packages/api/wrangler.jsonc` のまま変えない。migration は D1 の番号順 (0050 以降) で追加し、反映は既存の migrate → deploy のワークフローの順にする。

#### Secrets and access

N/A: 新しい secret は発生しない。既存の Cloudflare の資格情報とワークフローの権限をそのまま使う。

#### Reliability and recovery

反映の順序を Migrate → Deploy に固定する。仮置きの片づけは 1 回 500 件までにして夜間保守の CPU 時間とクエリ予算に収め、残りは翌日に回す。確定時は既存の鍵へコピーしてから仮置きを消すので、途中で失敗しても原本を失わない。

#### Infrastructure verification

Migrate の手順で新しい migration が `d1_migrations` に記録されること、夜間保守のテストで 500 件の上限と翌日への繰越が効くこと、`wrangler.jsonc` のバインディングと cron に差分が無いことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-003 | 仮置きは既存 R2 の専用接頭辞に置く | 新しいバケット・D1 に本文を持つ | バインディングを増やさず、確定時は同じバケット内のコピーで済む | 接頭辞で確定済みと分ける |
| qa-imp-decision-007 | 1 ファイルずつ順に展開して手放す | 全ファイルを並行に処理 | 128MB の中に収める | 検査の待ち時間がファイル数に比例する |
| qa-imp-decision-010 | 片づけは既存の夜間保守で 1 回 500 件まで | 新しい cron・キュー | 基盤を増やさない | 大量の期限切れは数日で消える |
| qa-imp-infrastructure-web-002 | レート制限の計数は D1 の表 (agent 推定) | Workers の Rate Limiting binding・KV | バインディングを足さない | 1 要求ごとに D1 の書き込みが 1 回増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の deploy・migrate ワークフロー。
- Migration sequence: 0050 以降の migration の Migrate → Worker の Deploy → web の配信。
- Rollback trigger/procedure: Worker と web の配信を戻す。表は追加だけなので落とさない。R2 の `import-staging/` に残った仮置きは夜間保守が期限後に消す。

## Risks and verification

- Risk/assumption: ピーク約 90MB は、展開後 60MB の xlsx をパースしたときの膨張を数えていない推定である (評価の low の申し送り)。実測の手順と、収まらない場合の後退策 (展開後の上限を下げる) は `architecture/import-screen-maintenance-ops.md` に置く。
- Risk/assumption: 夜間保守は 1 invocation の D1 query 予算を `scheduled-maintenance-budget.ts` で合成しており (`SCHEDULED_D1_QUERY_LIMIT` 50、現行 7 job の `SCHEDULED_MAINTENANCE_JOB_NAMES`、計画上限 `SCHEDULED_D1_QUERY_PLAN_MAX` 47)、新しい job は既存枠を再配分しない限り足せない。仮置きと検査行・古い時間枠の片づけを足すときは、この予算の中で query 数を割り当て、500 件を少数の文にまとめる方法を実装計画で決める。
- Architecture fitness test: `wrangler.jsonc` のバインディング・cron と、ワークフローの定義に差分が無いこと。夜間保守の予算のテスト (`scheduled-maintenance-budget.test.ts`) が新しい job を含めて緑であること。
- Load/failure/security validation: 10 ファイル・合計 30MB の検査が CPU 時間 (既定 30 秒) とクエリ予算に収まること。
