---
graph_node_id: "arch-analysis-hub-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "支出分析ハブ — スキーマを変えない派生値"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis-hub", "database"]
file_path: "architecture/analysis-hub-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "321660b14e75d908a0b4de239886de8e63a4a85a30ac53700f7daa4b90fff231"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "321660b14e75d908a0b4de239886de8e63a4a85a30ac53700f7daa4b90fff231", "imported_at": "2026-09-14T12:23:44Z"}
created_at: "2026-09-14T12:23:44Z"
updated_at: "2026-09-14T12:23:44Z"
depends_on: ["spec-analysis-hub"]
related_nodes: ["arch-analysis-hub-ui-ux", "arch-analysis-hub-frontend", "arch-analysis-hub-backend", "arch-analysis-hub-auth", "arch-analysis-hub-security", "arch-analysis-hub-infrastructure", "arch-analysis-hub-maintenance-ops"]
resource_scope: ["packages/api/src/store.ts", "packages/api/src/routes/total-cashflow.ts", "migrations"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/analysis-hub-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T12:23:44Z"}
serves_goals: ["G3"]
---

# Architecture overview

支出分析ハブ — スキーマを変えない派生値。正本は `system-spec/database.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-analysis-hub.md`。

## Context and drivers

- Business/technical context: ハブ API は読取りのみ。loadDataset は monthly_agg・restored_monthly_agg などの集計テーブルを userId で読み、総収支の件数には freee_deals・duplicate_verdicts・freee_deal_exclusions を読む。ハブに要る値 (期間合計・前期間比・5 視点の状態・優先度・改善余地) はすべてこれらから算出できるため、新しいテーブル・列・migration は不要。最新 migration は 0039_account_login.sql のまま。GET なので canonicalMutationFence の対象外。
- Quality attribute priorities: G3 に資する。DDD の観点で派生値を保存せず、集計の正本を既存テーブルと core の規則に一本化して二重正本を避ける。SRE の観点ではスキーマ変更 0 でデプロイ順序の障害源を作らない。
- Constraints: C1: 集計は packages/core の純関数に置く。 C4: 総収支は freee 正本で、未判断の重複候補を合計に入れない。

## Goals and non-goals

- Goals:
  - G3: 既存テーブルの読取りだけでハブ集計を返し、D1 読取りを既存 /total-cashflow と同程度に保つ。
- Non-goals:
  - D1 スキーマ・migration の変更
  - ハブ集計・優先度・前期間比などの派生値の保存やキャッシュテーブル
  - 取込・判定・除外など書込系の変更

## System context and boundaries

- Users/external systems: ハブ route が唯一の新しい読取り元。外部システムの追加は無い。
- Trust/deployment/data boundaries: D1 binding DB は既存どおり。全クエリを userId で絞り、利用者をまたぐ集計をしない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| monthly_agg / restored_monthly_agg ほか | 月別の収支・支出の集計元 (変更しない) | D1 テーブル | packages/api (migrations) | D1 |
| freee_deals / duplicate_verdicts / freee_deal_exclusions | 総収支の重複候補件数の算出元 (変更しない) | D1 テーブル | packages/api (migrations) | D1 |
| loadDataset (store.ts) | userId で絞った Dataset を組み立てる | TypeScript 関数 | packages/api | Worker |
| core ハブ集計関数 | Dataset から派生値を算出する (保存しない) | TypeScript 関数 | packages/core | Worker に同梱 |

## Cross-cutting contracts

- Identity/access: 全読取りを userId で絞る。
- Errors/resilience: 前期間の月が欠けるデータは null として扱い、欠損を 0 で埋めない。
- Observability/audit: N/A: データ系の信号・監査を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: スキーマを変えないため既存 migration 列と既存 API の読取りは不変。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: 下記 architecture-data.md を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

取引集計 (monthly_agg ほか) と freee 照合 (freee_deals・duplicate_verdicts・freee_deal_exclusions) の既存ドメインを読むだけ。ハブの派生値の規則は packages/core が所有する。

#### Logical and physical model

N/A: テーブル・列・インデックスを追加も変更もしない。ハブ集計は応答時に算出する値で物理モデルを持たない。

#### Access and consistency

読取りのみで、1 リクエストの中で loadDataset と総収支の読取りを行う。前期間比は all から previousPeriod の月を切り出して算出する。書込が無いため整合性の境界は既存どおり。

#### Lifecycle and governance

派生値を保存しないので保持期間・削除の規則は増えない。元データのライフサイクルは既存どおり。

#### Migration and recovery

N/A: migration は 0039_account_login.sql のままで、バックフィル・復旧手順は発生しない。

#### Data verification

core テストが Dataset のフィクスチャから期間合計・前期間比 (欠け 0/1 か月)・要確認件数・未記録月・改善余地を境界値付きで検証する。migrations に新しいファイルが無いことを差分で確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-analysis-hub-decision-002 | core 純関数 + 集約 API を新設し、既存テーブルから都度算出する | 既存 5 API を同時に呼ぶ | 集約 API でも読取り元は既存テーブルで足り、スキーマを変えずに済む | 派生値を保存せず、読取り量を d1-limits の範囲に保つ |
| qa-backend-web-ah-decision-003 | 前期間は previousPeriod、1 か月でも欠けたら null | yearAgoPeriod / 1 年選択時だけ比較 | 欠損を 0 で埋めずに済む | 前期間の月の有無を集計時に判定する |

## Delivery, migration and rollback

- Build/deploy topology: migrate.yml の実行対象は増えない。既存 deploy 経路で Worker だけを更新する。
- Migration sequence: N/A: スキーマ変更が無い。core → api → web の順でコードだけを入れる。
- Rollback trigger/procedure: ハブ API の読取りで D1 の制限超過や誤集計が出たら直前のビルドへ戻す。migration の巻き戻しは不要。

## Risks and verification

- Risk/assumption: 1 リクエストで loadDataset と総収支の読取りを両方行うため、D1 のクエリ本数が /total-cashflow より増える可能性がある。Free 50 / Paid 1000 クエリ/invocation の上限内に収める前提。
- Architecture fitness test: migrations 配下にハブ用の新ファイルが無く、ハブ集計を保存する書込クエリが無いこと。
- Load/failure/security validation: 既存の test / typecheck / lint を緑に保つ (S6)。全読取りが userId で絞られていることを統合テストで確かめる。
