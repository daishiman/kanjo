---
graph_node_id: "arch-cash-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "現金入力 — DELETE を論理削除にし、復元と一括の経路を足して、削除中の行を読む全経路から外す"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "backend"]
file_path: "architecture/cash-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c3b9b94a0b805e19f69d52b6fe19b4513b5f1a77956b42807fdd01f42f5c6305"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "c3b9b94a0b805e19f69d52b6fe19b4513b5f1a77956b42807fdd01f42f5c6305", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: ["spec-cash-screen"]
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/api/src/routes/cash.ts", "packages/api/src/store.ts", "packages/api/src/routes/settings.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/cash-lifecycle.test.ts", "packages/core/src/cash.ts", "packages/core/src/cash-screen.ts", "packages/core/src/index.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/cash-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G2", "G3", "G4"]
---

# Architecture overview

現金入力 — `DELETE /api/cash-entries/:id` を論理削除 (`deleted_at` を入れる) に変え、`POST /api/cash-entries/:id/restore`・`POST /api/cash-entries/bulk-delete`・`POST /api/cash-entries/bulk-restore` を足す。削除中の行は `cash_entries` を読む全経路で `deleted_at IS NULL` により外し、取引・集計は同じ D1 batch で作り直す。合計・絞り込み・ページ・入力経路・交通費合計は core の `cash-screen.ts` に置く。`system-spec/backend.md` は承認時入力、本書は経路・トランザクション・読取条件の制約を持つ。

## Context and drivers

- Business/technical context: `packages/api/src/routes/cash.ts` (276 行) は GET (`:175`)・POST (`:198`)・PUT (`:214`)・DELETE (`:250`) を持つ。書込後は `recomputeFromDeals` / `planRecomputeFromDeals` が同じ D1 batch で取引と集計を作り直し、`invalidateJsonSnapshotQuery` で JSON スナップショットを無効化する (qa-cash-backend-web-evidence-001)。DELETE は `cash_entries` と `tx_edits` を物理削除する (`cash.ts:270-271`)。core の `packages/core/src/cash.ts` (309 行) は `cashToDeal`・`cashToTx`・`buildTransitEntry`・`findCashDealDuplicates` を持つ。
- Quality attribute priorities: G2・G3・G4 に資する。Clean Architecture (判定は core、api は JSON に写す) を適用する (agent 推定・利用者未確認、design_applications)。上流指針は application-architecture と data-access。
- Constraints: Hono Worker + D1 / Drizzle。D1 の 1 request あたりの query 数は `CASH_PARENT_DELETE_QUERY_LEDGER` (`cash.ts:43-54`) と `planCashParentDeleteQueries` で上限未満を宣言している。既存行と `cashToDeal` / `cashToTx` の結果を変えない (C2)。

## Goals and non-goals

- Goals:
  - G2: 削除は論理削除、復元で同じ id の行を戻す。30 日後の完全消去は夜間 job (`architecture/cash-infrastructure.md`)。
  - G3: `cash-screen.ts` に合計・絞り込み・ページング・入力経路・交通費合計を置き、core の `index.ts` から export する。交通費の合計は片道 × (往復なら 2) (qa-cash-backend-web-001)。
  - G4: 削除中の行を一覧・集計・スナップショット・科目使用状況へ混ぜない。他人の行・完全消去済みの行は 404。
- Non-goals:
  - 領収書ファイルの受け取り (qa-cash-decision-001)
  - 入力経路の列 (qa-cash-decision-004。`transit_from IS NOT NULL` から導く)
  - 新しい外部 API・レート制限

## System context and boundaries

- Users/external systems: web (`/cash`)。夜間の完全消去は scheduled から呼ばれる。
- Trust/deployment/data boundaries: 全経路は `/api/*` の `authGuard` (`index.ts:104`)・`runtimeSchemaGuard` (`:107`)・`canonicalMutationFence` (`:108`) の後ろに置き (`app.route('/api', cashRoute)` は `index.ts:115`)、`userId` を条件にする (`architecture/cash-auth.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `routes/cash.ts` | GET / POST / PUT / DELETE / restore / bulk-delete / bulk-restore | Hono + zod | packages/api | Worker |
| `store.ts` の `loadCashEntries` | 利用者の現金明細を読む (`deleted_at IS NULL`) | 関数 | packages/api | Worker |
| `store.ts` の `BACKUP_SNAPSHOT_SQL` / `loadImportRestoreSettingsSnapshot` | エクスポートと夜間バックアップが共有するスナップショット / 取込時の設定スナップショット | SQL | packages/api | Worker |
| `routes/settings.ts` の科目使用状況 | 科目の使用件数と置換 | 関数 | packages/api | Worker |
| `canonical-mutation-fence.ts` | 書込経路の登録 | 正規表現表 | packages/api | Worker |
| `core/cash-screen.ts` | 合計・絞り込み・ページ・入力経路・交通費合計 | 純関数 | packages/core | Worker / web |

## Cross-cutting contracts

- Identity/access: 全経路で `userId` を条件にし、他人の id は存在しないものとして 404 を返す (qa-cash-auth-web-001)。
- Errors/resilience: 入力不正は 400 `invalid_input`、見つからない・他人・完全消去済み・削除中の行への PUT は 404 `not_found`。一括は 1 件でも該当すれば全体 404 で何も変えない。
- Observability/audit: 完全消去の件数は夜間 job の JSON ログに出す (`architecture/cash-maintenance-ops.md`)。
- Configuration/secrets: N/A: 新しい設定・秘密情報は無い。
- Compatibility/versioning: POST / PUT は `owner` と `transit_purpose` を任意で受け、既存のクライアントの本文は通る。GET の応答形 `{entries, candidates, months, duplicates}` は保つ。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/cash-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/cash-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/cash-database.md`)
- Security: N/A: 本章の関心外 (`architecture/cash-security.md`)

### Backend architecture

#### Runtime and architecture pattern

既存の Hono ルートに経路を足す。判定 (合計・入力経路・交通費合計・入力検証の規則) は core、api は D1 の読み書きと JSON への写しだけ (G3)。

#### Domain and module boundaries

`cash-screen.ts` は `cash.ts` と同じく依存ゼロの純関数で、既存の `*-screen.ts` (ai / diagnosis / statements / subs) を前例にする。`cashToDeal` / `cashToTx` は変えない (C2)。

#### API and service contracts

- `DELETE /api/cash-entries/:id`: `deleted_at` を入れる。取引と集計を同じ batch で作り直す (qa-cash-backend-web-002)。
- `POST /api/cash-entries/:id/restore`: `deleted_at` を NULL に戻す。完全消去済みは 404。科目が科目表から消えていても行は戻し、検証は次の編集時に行う (qa-cash-backend-web-003、agent 推定・利用者未確認)。
- `POST /api/cash-entries/bulk-delete` / `bulk-restore`: id の配列を 100 件まで受け (同、agent 推定・利用者未確認)、他人・完全消去済みの id を 1 件でも含めば全体 404、1 batch で処理する (qa-cash-decision-006)。
- `PUT /api/cash-entries/:id`: 既存行の取得に `deleted_at IS NULL` を足し、削除中の行は 404。
- 3 経路を `canonical-mutation-fence.ts` の `CANONICAL_MUTATION_ROUTES` に登録する。現行の登録 (`:42-48`、POST `^/api/cash-entries$` と PUT / DELETE `^/api/cash-entries/[^/]+$`) は `/:id/restore` と `bulk-*` の POST に一致しない。

#### Data and transaction behavior

`deleted_at IS NULL` を掛ける読取経路は cash_entries を読む全経路 5 本 で、名前は system-spec と一致する (C2 / I3)。
- `loadCashEntries` (`store.ts:521-528`)。GET・checkCategory 経由の `loadDataset` (`store.ts:358`、`:396`) もこれを使う。
- `BACKUP_SNAPSHOT_SQL` (`store.ts:740` 起点、cash 節 `:793-795`)。`loadBackupSourceSnapshot` (`:841`) → `loadBackupPayload` (`:1306`、エクスポートと夜間バックアップが共有) が読む。
- 取込時の設定スナップショット `loadImportRestoreSettingsSnapshot` (`store.ts:1070`、cash 節 `:1098-1103`)。
- 科目使用状況の `loadCategoryUsageContext` (`routes/settings.ts:374`、cash の select は `:379`)。
- PUT の既存行取得 (`cash.ts:214` 以降)。

JSON 復元の「移行先の現金明細が 0 件か」の判定だけは削除中の行も数える (`loadImportRestoreSettingsSnapshot` の `destination_counts` (`store.ts:1128-1139`) に削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残る間は現金明細を復元せず理由を表示する。例外はこの件数 1 つだけで、削除中の行の中身はどの出力にも出さない (利用者決定 qa-cash-decision-009)。

削除・復元・一括は `planRecomputeFromDeals` で削除後 / 復元後の現金明細から取引と集計を作り直し、`invalidateJsonSnapshotQuery` と同じ batch に入れる。JSON 復元の INSERT (`import-lifecycle.ts:1549` 付近の `restoreCashEntryStatements`) の列リストに `owner`・`transit_purpose`・`deleted_at` を足す (qa-cash-database-web-002)。

#### Async processing

完全消去は夜間 job `cash_soft_delete_purge` が行い、request では行わない (`architecture/cash-infrastructure.md`)。

#### Security and resilience

zod で候補と長さを限る (`architecture/cash-security.md`)。一括の query 数は `planCashParentDeleteQueries` と同じ形の予算表で上限未満を宣言し、超えるなら拒否する。

#### Operations and verification

API テストで 削除 → 一覧と集計から消える → 復元で同じ id が戻る、PUT が削除中の行で 404、一括に他人の id を混ぜると全体 404 で何も変わらない、101 件で 400、各読取経路に削除中の行が出ない、を確かめる。既存の `cash-lifecycle.test.ts`・`transit-lifecycle.test.ts` を緑のまま保つ。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-cash-decision-003 | DELETE を論理削除にし、30 日後に夜間で完全消去 | 物理削除のまま | 『元に戻す』で同じ行を戻せる | 全読取経路に条件が要る |
| qa-cash-decision-006 | restore・bulk-delete・bulk-restore を足し、一括は全体 404 で 1 batch | 1 件ずつ呼ぶ | 部分成功が無く、集計の作り直しが 1 回で済む | 一括の query 予算を宣言する |
| qa-cash-decision-004 | 入力経路は列を持たず `transit_from` の有無から導く | `entry_route` 列 | 既存行を書き換えずに済み、値が矛盾しない | 導出は core に 1 か所 |
| qa-cash-backend-web-003 | 一括 100 件・完全消去済みの復元 404・科目消失でも復元 (agent 推定・利用者未確認) | 復元時に科目を検証して拒否 | 取り返しの操作を失敗させない | 次の編集時に科目の検証が走る |
| qa-cash-backend-web-001 | 交通費合計を core から export する | web と api で別々に計算 | 数字が 1 か所から出る | core のテストで固定する |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker デプロイ。migration 0052 の適用後に配る (`architecture/cash-infrastructure.md`)。
- Migration sequence: core `cash-screen.ts` → 読取経路への `deleted_at IS NULL` → DELETE の論理削除化 → restore / bulk → fence 登録 → JSON 復元の列 → 夜間 job。
- Rollback trigger/procedure: API テストが赤なら差し戻す。Worker を戻しても 0052 の列は残る。旧 Worker は `deleted_at` を読まないため、差し戻し中は削除中の行が一覧に再び出る。差し戻す前に削除中の行の件数を確かめる。

## Risks and verification

- Risk/assumption: 読取経路を 1 つでも取りこぼすと削除中の行が集計やバックアップに混ざる。経路ごとに API テストを 1 件置く。
- Risk/assumption: 科目の置換 UPDATE (`routes/settings.ts:605-613`) は削除中の行にも当たり得る。復元後の行が新しい科目になるのは許容か、条件を足すかを実装時に spec-cash-screen で確かめる。
- Risk/assumption: 現行 DELETE は `tx_edits` も物理削除する (`cash.ts:271`)。論理削除で同じ行を戻す (S2) には手動編集を残す扱いが要り、実装時に確かめる。
- Architecture fitness test: `cash_entries` を読む SQL / Drizzle 式を grep し、`deleted_at` 条件の無い読取が上記の完全消去 job 以外に無いこと。
- Load/failure/security validation: 一括 100 件で D1 の query 予算内に収まることを予算表のテストで確かめる。
