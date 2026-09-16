---
graph_node_id: "arch-reconciliation-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "照合画面 — 判断・除外・操作履歴・月次レビューの保存と派生値の線引き"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "database"]
file_path: "architecture/reconciliation-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-16-reconciliation/completeness-findings.json", "evaluated_digest": "1b216ebc004b3b0b5cb8c739b22c382e1fb2c211bd33b7dac2c4e566eceb11e0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-16-reconciliation/database.md", "source_version": "0.1.14", "source_digest": "1b216ebc004b3b0b5cb8c739b22c382e1fb2c211bd33b7dac2c4e566eceb11e0", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations/0036_duplicate_verdicts.sql", "migrations/0037_freee_pairing_and_exclusions.sql", "migrations/0039_account_login.sql", "packages/api/src/store.ts", ".github/workflows/deploy.yml"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

照合画面 — 判断・除外・操作履歴・月次レビューの保存と派生値の線引き。`system-spec/archive/2026-09-16-reconciliation/database.md` は承認時入力、本書はデータ制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: D1 (binding DB、drizzle-orm)。照合判断は migrations/0036_duplicate_verdicts.sql の duplicate_verdicts (user_id・tx_id・stable_key・fingerprint_version・verdict same/different・freee_key)、freee 側除外は 0037_freee_pairing_and_exclusions.sql の freee_deal_exclusions (Drizzle 定義は packages/api/src/db/schema.ts:130-159)。最新 migration は 0039_account_login.sql。MF 側の除外表・照合操作の履歴表・月次レビュー完了表は無い。deploy.yml は追加だけの D1 migration を自動適用し、列や行を失う変更だけを migrate.yml の手動承認へ倒す (qa-database-web-rc-observed-001)。
- Quality attribute priorities: G3・G4 に資する。DDD の『永続化するのはドメインの状態であって表示の都合ではない』を適用し、利用者の意思だけを保存して派生値を保存しない。取消は原子的な 1 単位にする。
- Constraints: C4: 照合の判断は duplicate_verdicts を総収支と共用し結果を一致させる。一括操作は最大 200 件。

## Goals and non-goals

- Goals:
  - G3: MF 側除外表・照合操作の履歴表を追加し、元に戻すを操作前の判断状態への書き戻しで実現する。
  - G4: 月次レビュー完了を月単位で保存し取消可能にする。
- Non-goals:
  - 一致度・キュー・KPI・解消率・月次クローズの自動 3 ステップの保存
  - duplicate_verdicts への列追加・既存列の変更
  - 端末内保持・オフライン同期 (専用アプリは対象外)

## System context and boundaries

- Users/external systems: 書き手・読み手は packages/api の照合 route と月次レビュー route。外部システムは無い。
- Trust/deployment/data boundaries: 全ての行を user_id で持ち、route が userId で絞る。migration 0041 は追加だけ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| duplicate_verdicts (既存 0036) | 照合判断 same/different を総収支と共用で保持する | D1 テーブル / Drizzle | packages/api (D1) | D1 DB |
| freee_deal_exclusions (既存 0037) | freee 側の除外を保持する | D1 テーブル / Drizzle | packages/api (D1) | D1 DB |
| mf_tx_exclusions (新設) | MF 側の除外を保持する | D1 テーブル / Drizzle | packages/api (D1) | D1 DB |
| reconciliation_actions (新設) | 照合操作の事実 (before/after・created_at・取消済み) を 90 日保持する | D1 テーブル / Drizzle | packages/api (D1) | D1 DB |
| monthly_close_reviews (既存 0040) | 月次レビュー完了を月単位で保持する | D1 テーブル / Drizzle | packages/api (D1) | D1 DB |

## Cross-cutting contracts

- Identity/access: 全ての行を user_id で絞る。undo は reconciliation_actions の user_id 一致を条件にする。
- Errors/resilience: 取消は before を D1 batch で書き戻し、判断・除外・履歴の取消済みフラグが途中で分かれないようにする。
- Observability/audit: reconciliation_actions が操作の事実を 90 日残す。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存 2 表の形を変えず、総収支の読み書きはそのまま動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: 下記 architecture-data.md を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

利用者の意思 (判断 duplicate_verdicts・除外 freee_deal_exclusions と mf_tx_exclusions・操作の事実 reconciliation_actions・月次レビュー完了 monthly_close_reviews) を保存する。派生値は core が毎回導出する。

#### Logical and physical model

migration 0041 で mf_tx_exclusions と reconciliation_actions を CREATE する。monthly_close_reviews は既存 0040 を共用する。判断は共通 bind が tx_id→stable_key の順で明細へ結び直す。

#### Access and consistency

照合判断を duplicate_verdicts に一本化して総収支と共用する。派生件数は保存せず、core の `actionRequiredCount` を照合・ハブ・サイドバー・月次クローズで共用する。取消は D1 batch の 1 単位。

#### Lifecycle and governance

元に戻すは直前の操作 1 件 (一括なら一括単位)。履歴表には全操作を 90 日保存し、取消済みの操作は再取消できない。中間の操作を戻すには各行の判断を解除する (qa-database-web-rc-decision-008)。月次レビュー完了は月単位で保存し取消できる (qa-reconciliation-decision-005)。

#### Migration and recovery

0041 で新表 2 つを CREATE し、deploy.yml の自動適用経路に乗せる。既存 D1 に冪等に適用し、バックフィルは行わない。

#### Data verification

API 統合テストで元に戻すと KPI とキューが操作前の値に戻ること、migration が既存 D1 に冪等に適用されること、取消済みの操作を再取消できないことを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-reconciliation-decision-002 | 既存表を再利用し、MF 除外・操作履歴を新表で足す | 照合専用の新テーブル / DB 変更なし | 総収支と照合で利用者判断を共用する | 両画面が同じ行を書き換える |
| qa-database-web-rc-decision-008 | 直前の操作 1 件の取消+履歴 90 日保存 | 履歴から任意の操作を戻す / 履歴を保存しない | 取消の対象を 1 つにし判断状態の食い違いを避けつつ事実は残す | 90 日削除の運用が要る |
| qa-reconciliation-decision-005 | 月次レビュー完了を既存 monthly_close_reviews に保存 (取消可) | 4 つとも自動 / 判定なし | 利用者の確認行為を記録できる | 既存表を共用する |

## Delivery, migration and rollback

- Build/deploy topology: 追加だけの migration を deploy.yml が自動適用する。
- Migration sequence: 0041 の新表 2 つを CREATE → schema.ts の Drizzle 定義 → route の読み書き。
- Rollback trigger/procedure: 追加だけなのでアプリを直前のビルドへ戻しても既存表は動く。新表の削除は破壊的変更として migrate.yml の手動承認を要する。

## Risks and verification

- Risk/assumption: 新表の逐語の列定義は章に無い。90 日削除の方式は推定 (qa-infrastructure-web-rc-inference-002)。
- Architecture fitness test: 派生値 (一致度・キュー・KPI・解消率) を保存する列が無いこと。取消が 1 回の batch であること。
- Load/failure/security validation: 全ての行が user_id で絞られ、他利用者の履歴を取り消せないこと。
