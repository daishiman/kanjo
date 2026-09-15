---
graph_node_id: "arch-overview-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "概況画面改善 — 保留と月次レビューの D1 テーブル"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "database"]
file_path: "architecture/overview-screen-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "bfeaf5ba39566e3161ae33ad1b4f75d997d8aa9b311c48a7822051518930f67d"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/database.md", "source_version": "0.1.14", "source_digest": "bfeaf5ba39566e3161ae33ad1b4f75d997d8aa9b311c48a7822051518930f67d", "imported_at": "2026-09-14T13:09:32Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-14T13:09:32Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/store.ts", "packages/api/src/routes/imports.ts", "packages/api/src/canonical-mutation-fence.ts"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を data とし、architecture-data.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G2", "G3"]
---

# Architecture overview

概況画面改善 — 保留と月次レビューの D1 テーブル。正本は `system-spec/database.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: スキーマは `packages/api/src/db/schema.ts` (drizzle)、migration は `migrations/` で最新は 0039_account_login.sql。`packages/api/src/schema-guard.ts` の EXPECTED_D1_MIGRATION が実 DB より新しいと runtimeSchemaGuard が 503 を返し、schema-guard.test が一致を検査する。バックアップは `packages/api/src/store.ts` の BACKUP_SNAPSHOT_SQL (15 テーブルを明示列挙) と loadBackupPayload、復元は POST /api/restore (`packages/api/src/routes/imports.ts`)。書込は CANONICAL_MUTATION_ROUTES へ登録する。user_id は 'default'。D1 の migration に rollback は無い。
- Quality attribute priorities: G2, G3 に資する。バックアップ・復元での保持 (O3) と、定数・スキーマ・バックアップの同時整合を最優先にする。
- Constraints: C5: migration は前進のみで、migrate.yml が手動経路。deploy の自動判定は DROP/RENAME を blocked にする。新テーブルに集計列と明細本文の写しを持たない。

## Goals and non-goals

- Goals:
  - G3: review_snoozes と monthly_close_reviews を追加し、夜間バックアップと復元の対象に含める。
  - G2: 保留を内容指紋と共に持ち、未処理件数の計算に使える形にする。
- Non-goals:
  - 既存テーブルの変更・削除
  - 集計値の保存
  - データのバックフィル

## System context and boundaries

- Users/external systems: 読み書きは API ルートだけが行う。
- Trust/deployment/data boundaries: D1 kanjo-db。夜間バックアップは R2 kanjo-files に 30 日保持される。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| migration 0040 (新設) | CREATE TABLE/INDEX のみ、CHECK と主キー | SQL | migrations | D1 |
| review_snoozes | 保留の行と内容指紋 | drizzle schema | packages/api | D1 kanjo-db |
| monthly_close_reviews | 月次レビューの行 | drizzle schema | packages/api | D1 kanjo-db |
| EXPECTED_D1_MIGRATION | 期待するスキーマ版 | 定数 | packages/api | Worker |
| BACKUP_SNAPSHOT_SQL / loadBackupPayload / restore | 新テーブルのバックアップと復元 | SQL と JSON payload | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: user_id は 'default'。reviewed_by_user_id に actor の user id を入れる。
- Errors/resilience: スキーマ版不一致は 503。書込衝突は 409 canonical_write_busy。
- Observability/audit: reviewed_at と reviewed_by_user_id を記録として残す。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 追加のみで既存テーブルと既存バックアップ形式の読み込みを壊さない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: 下記 architecture-data.md を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

保留 (review_snoozes) と月次レビュー (monthly_close_reviews) は利用者の判断の記録で、packages/api が所有する。明細そのものは既存テーブルが持ち、新テーブルは参照キーと指紋だけを持つ。

#### Logical and physical model

提案 (推定・plan で確定): review_snoozes は主キー (user_id, item_kind, item_key) と snoozed_at・内容指紋。monthly_close_reviews は主キー (user_id, month) と reviewed_at・reviewed_by_user_id。item_kind と month の形式は CHECK で制約する。

#### Access and consistency

書込は CANONICAL_MUTATION_ROUTES で直列化し、PUT は主キーによる upsert で冪等にする。保留の有効性は読み取り時に内容指紋を照合して判定する。

#### Lifecycle and governance

保留は利用者の解除か指紋の不一致で無効になり、月境界で自動解除しない。月次レビューは利用者の取消まで残る。どちらも夜間バックアップ (30 日保持) に含める。

#### Migration and recovery

migration 0040 と EXPECTED_D1_MIGRATION・schema.ts・BACKUP_SNAPSHOT_SQL と payload・restore・CANONICAL_MUTATION_ROUTES を同じ変更で揃える。rollback は無いため、定義の誤りは前進の修正 migration で直す。

#### Data verification

O3: バックアップ→全消去→復元の往復で保留と月次レビューが残る API テスト。improvement-backup-exclusion.test.ts は新テーブルの入れ忘れを落とさないため、O3 が唯一の検査となる。schema-guard.test で定数と migration の一致を確かめる。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は dec-review-state-storage (D1 に 2 テーブル、夜間バックアップと復元の対象) を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: deploy.yml の plan-auto-migration.mjs が CREATE のみを自動適用対象と判定し、checkpoint → db:migrate:remote → check-d1-migrations.mjs → wrangler deploy の順に進む。
- Migration sequence: 0040 の追加と EXPECTED_D1_MIGRATION の更新を同じ PR に入れ、migration 適用後に Worker を配信する。
- Rollback trigger/procedure: D1 は戻さない。Worker を直前のビルドへ戻し、新テーブルは残す。定義の誤りは修正 migration で前進する。

## Risks and verification

- Risk/assumption: BACKUP_SNAPSHOT_SQL は明示列挙なので、テーブルを足しても自動ではバックアップに入らない。
- Architecture fitness test: O3 の往復テストと schema-guard.test を CI の test-api で常時実行する。
- Load/failure/security validation: 行数は明細数と月数に比例し、利用者 1 名では小さい。新テーブルに明細本文の写しが無いことをレビューで確かめる。
