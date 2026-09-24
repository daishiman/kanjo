---
graph_node_id: "arch-guide-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "使い方 — DB の表と列は足さず、ガイド本文は core の定数として版管理し、数値は既存の loadDataset の読み取りから毎回導く"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "database"]
file_path: "architecture/guide-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "262454a435c86a72714c047a24f18f51d84e187fbc5bb2a0e40d210dc847e07b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "262454a435c86a72714c047a24f18f51d84e187fbc5bb2a0e40d210dc847e07b", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/api/src/store.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "migrations", "packages/web/src/glossary.ts"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G2", "G3"]
---

# Architecture overview

使い方 — 本サイクルは DB の表・列・migration を 1 つも足さない。ガイド本文 (節・ステップ・よくある疑問・期間の表) は表示の都合なので DB に置かず core の定数として版管理する。防衛ラインの算出 (個人生活費と事業固定費の直近 3 か月平均) と集計結果 (総収支・振替除外) は変えず、既存 Dataset から今までどおり導く (qa-guide-database-web-002)。`system-spec/database.md` は承認時入力、本書は保存しないことの境界と読み取り経路の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 集計の Dataset は `packages/api/src/routes/analytics.ts:102-123` の `loadScoped` が `loadDataset` を 1 回だけ呼び (`analytics-period.test.ts:19` で固定)、`applyPeriod` (`core/src/period.ts:169`) で期間を切る。最終更新は imports の `committedAt` の最大 (`analytics.ts:225-228`)。ガイド本文は DB に無く、`packages/web/src/glossary.ts` (548 行) の定数と `Guide.tsx` の直書きである。防衛ラインは `core/src/analysis.ts:1093` の `defenseLine` が `Dataset.personal` の直近 3 か月と事業固定費から算出する (qa-guide-database-web-evidence-001)。
- Quality attribute priorities: G2・G3 に資する。DDD の『永続化するのはドメインの状態であって表示の都合ではない』を適用する (database 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: C2 (DB の列を足さない、防衛ラインの算出と既存の集計結果を変えない)。D1 の 1 リクエスト 50 query 上限 (既存の取込が張り付いているため loader の SELECT を増やさない、`analytics.ts` の `/statements` の注記)。

## Goals and non-goals

- Goals:
  - G2: 防衛ラインの値を既存の明細から毎回導き、説明文の根拠 (直近 3 か月) を core の定数 1 つにする。
  - G3: 使い方画面の数値が集計と同じ明細・同じ読み取り経路から出る。
- Non-goals:
  - ガイド本文の DB 保存・管理画面
  - 防衛ラインの保存や履歴
  - 新しい migration・索引・列

## System context and boundaries

- Users/external systems: api Worker の `/api/guide` が D1 を読む。
- Trust/deployment/data boundaries: 読むのは利用者自身の明細と取込の記録だけ (`user_id` で絞る既存の `loadDataset`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| D1 (既存の表) | 明細・取込の記録 | Drizzle (`packages/api/src/db/schema.ts`) | packages/api | D1 |
| `loadDataset` (`packages/api/src/store.ts`) | 利用者の Dataset を 1 回で読む | 関数 | packages/api | api Worker |
| `loadScoped` (`analytics.ts:102-123`) | 期間を切った data と全期間の all | 関数 | packages/api | 同上 |
| core の定数 (ガイド本文) | 節・ステップ・よくある疑問・期間の表 | TypeScript の定数 | packages/core | web chunk と api Worker |

## Cross-cutting contracts

- Identity/access: `loadScoped` が `c.get('userId')` (`analytics.ts:105`) を渡す既存の経路だけを使う。
- Errors/resilience: スキーマが期待と違えば既存の `runtimeSchemaGuard` が 503 で止める。期待 head は据え置く。
- Observability/audit: N/A: 書き込みが無いので監査対象の変更を生まない。
- Configuration/secrets: N/A。
- Compatibility/versioning: `schema-guard.ts` の `EXPECTED_D1_MIGRATION` は据え置く。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/guide-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/guide-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

明細と取込の記録は既存どおり api が持つ。ガイド本文は core が持ち、版管理はリポジトリの履歴で行う。防衛ラインと総収支は保存せず、読むたびに導く。

#### Logical and physical model

N/A: 表・列・索引を足さない。`migrations/` に新しいファイルを作らない。

#### Access and consistency

`/api/guide` は `loadScoped` の 1 回の `loadDataset` を読み、最終更新と月次の進捗は既存の読み取り (`loadCloseStatus`、`analytics.ts:203`) を使う。D1 への書き込みは 0 本。loader の SELECT を増やさない。

#### Lifecycle and governance

ガイド本文の変更はコードの変更として review と CI (check-glossary を含む lint) を通る。用語集の防衛ラインの説明 (`glossary.ts:45-49` の直書き) は core の算出定数から組む形へ置き換える。

#### Migration and recovery

migration を作らないので、巻き戻しは web と api のコードを戻すだけで済む。D1 の復旧手順 (夜間バックアップ) は変えない。

#### Data verification

`/api/guide` の totals が総収支画面の同じ期間の値と一致し、振替が入らないことを API テストで確かめる。`defenseLine` の既存テストが値を変えずに通ることを確かめる。`schema-guard.test.ts` の期待 head が変わらないこと。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-database-web-002 | 表・列・migration を足さない | ガイド本文や FAQ を表に持つ | 表示の都合を永続化しない。巻き戻しが容易 | 本文の変更はデプロイを要する |
| qa-guide-database-web-002 | ガイド本文を core の定数として版管理する | web の定数に残す | api と web が同じ本文を読む | core の chunk が増える |
| qa-guide-database-web-002 | 防衛ラインを保存せず既存 Dataset から導く | 算出結果の保存 | 算出を変えない決定 (qa-guide-decision-009) と整合 | 読むたびに計算する |

## Delivery, migration and rollback

- Build/deploy topology: 既存の D1 と api Worker。
- Migration sequence: N/A: migration なし。
- Rollback trigger/procedure: コードを戻すだけ。DB の状態は変わらない。

## Risks and verification

- Risk/assumption: `/api/guide` のために loader の SELECT を足すと、取込のリクエストが D1 の 50 query 上限を超える恐れがある。`loadScoped` の 1 回だけを使う。
- Risk/assumption: 本文を DB に置かないので、利用者が本文を直すことはできない (対象外)。
- Architecture fitness test: `migrations/` に本サイクルのファイルが無く、`EXPECTED_D1_MIGRATION` が不変であること。
- Load/failure/security validation: `analytics-period.test.ts` の `loadDataset` 1 回の固定が緑であること。
