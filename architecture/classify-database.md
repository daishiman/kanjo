---
graph_node_id: "arch-classify-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "明細仕分け — 2 表と既存表への列を足す追加のみの migration"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "database"]
file_path: "architecture/classify-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "64a5feecbecad51c781e6e8fcf07d055304f0a93cba019ee29d5586aa3be8aba"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "64a5feecbecad51c781e6e8fcf07d055304f0a93cba019ee29d5586aa3be8aba", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-auth"]
resource_scope: ["migrations", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/routes/classify.ts", "packages/api/src/deletion-full-reset.ts", "packages/core/src/types.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G2", "G4", "G5"]
---

# Architecture overview

明細仕分け — 2 表と既存表への列を足す追加のみの migration。`system-spec/database.md` は承認時入力、本書は保存フィルタ・取引の履歴・ルールと手当ての追加列の置き場所と整合の制約を持つ。列と制約の逐語の正本は `specs/spec-classify-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/db/schema.ts` の `rules` (75 行) は `keyword`・`cls`・`category_major`・`category_mid`・`owner`・`sort_order` だけを持ち、取引先・適用範囲・分割の型の列が無い。`tx_edits` (96 行) は明細ごとの手当てで、`origin` は `manual` / `vendor_memory`、`note`・`institution` 列を持つが、支払方法の上書きと確定時の提案一致の列は無い。保存フィルタと取引の履歴の表は無い。`packages/api/src/schema-guard.ts` の `EXPECTED_D1_MIGRATION` は `0045_owner_labels.sql` (qa-classify-database-web-evidence-001)。
- Quality attribute priorities: G2・G4・G5 に資する。追加のみ (expand) の schema 変更で直前版の Worker と共存させ、行の書き換えを伴う migration を作らない (qa-classify-database-web-001)。
- Constraints: Cloudflare D1 (SQLite) + Drizzle。1 要求あたりのバインド変数は `packages/api/src/d1-limits.ts` の `D1_MAX_BOUND_PARAMS = 100`。件数や集計値を保存せず、要求のたびに core で導出する。

## Goals and non-goals

- Goals:
  - G2: 確定時に提案と一致していたかを `tx_edits` の追加列に残し、区分 (未整理 / 手動変更 / 完了) の判定を後から提案が変わっても揺れないものにする。値が無い既存の手入力は手動変更として扱う (agent 推定・利用者未確認、根拠 qa-classify-database-web-003)。
  - G4: `rules` に取引先・適用範囲・分割の型の列を足し、ルールの作成・プレビュー・適用が同じ行を読む。
  - G5: 保存フィルタ (`saved_filters`) と取引の履歴 (`tx_history`) の表を新設し、利用者単位で持つ。
- Non-goals:
  - 既存行を書き換える migration (値の埋め戻し・列の型変更・列の削除)
  - 分類ステータスや件数の保存 (毎回導出する)
  - 下書きの保存 (端末の localStorage に置く)
  - 証憑の表・R2 への保存

## System context and boundaries

- Users/external systems: api の classify route と deletions route だけが書く。web は API 越しにしか触れない。
- Trust/deployment/data boundaries: 全ての新表は `user_id` を持ち、読み書きは利用者単位で閉じる。migration の反映は既存の `migrate.yml` が行う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `migrations/0046_classify_workbench.sql` (番号は予定) | 2 表の作成と既存 2 表への列の追加を 1 本で行う | SQL | migrations | D1 |
| `saved_filters` | 利用者ごとの名前付き絞り込み条件 | Drizzle | packages/api | D1 |
| `tx_history` | 明細の変更 1 件ごとの記録 (項目・変更前・変更後・経路・操作 id) | Drizzle | packages/api | D1 |
| `rules` (列の追加) | 取引先・適用範囲・分割の型 | Drizzle | packages/api | D1 |
| `tx_edits` (列の追加) | 支払方法の上書き・確定時の提案一致 | Drizzle | packages/api | D1 |
| `schema-guard.ts` | 期待する最新 migration を 0046 に上げ、未適用なら 503 | Hono ミドルウェア | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 新表の読み書きは `WHERE user_id = ?` を必ず含む (`architecture/classify-auth.md`)。
- Errors/resilience: 一意制約違反 (同名の保存フィルタ) と件数上限は 400 系で返す。migration 未適用は `runtimeSchemaGuard` の 503。
- Observability/audit: `tx_history` が業務上の変更記録。各変更経路の書込と同じ D1 batch に入れる。
- Configuration/secrets: N/A: 追加の設定・秘密情報を持たない。
- Compatibility/versioning: 追加列はすべて NULL 可か既定値付きにし、直前版の Worker が新しい schema の上でそのまま動くようにする。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/classify-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/classify-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/classify-security.md`)

### Data architecture

#### Data domains and ownership

- Domains/entities/source of truth: 明細 (取込の正本、仕分けでは書かない)・手当て (`tx_edits`、利用者の確定の正本)・分割 (`tx_splits`)・ルール (`rules`)・保存フィルタ (`saved_filters`)・取引の履歴 (`tx_history`)。分類ステータスと件数は正本を持たず、手当て・ルール・vendor_memory・明細から core が導く。
- Data ownership/stewardship: 書込は classify route (手当て・分割・ルール・保存フィルタ・履歴) と deletions route (削除と取消、履歴の追記) に限る。
- Classification/residency: 利用者の家計と事業の取引内容。D1 の既存の保管場所から動かさない。

#### Logical and physical model

- Conceptual/logical model: 以下の列は agent 推定・利用者未確認 (根拠 qa-classify-database-web-002・-003)。
  - `saved_filters`: `id`・`user_id`・`name` (1〜40 字)・`query_json` (2000 字以内)・`created_at`・`updated_at`。`(user_id, name)` で一意。利用者あたり 20 件まで。
  - `tx_history`: `id`・`user_id`・`tx_id`・`changed_at`・`field`・`before_value`・`after_value`・`source` (CHECK で `auto` / `manual` / `rule` / `bulk` / `split` / `delete` / `undo`)・`op_id`。索引は `(user_id, tx_id, changed_at)`。
  - `rules` への追加: `payee` (NULL 可)・`scope` (`all` / `unconfirmed`、既定 `all`)・`split_template_json` (NULL 可)。
  - `tx_edits` への追加: `payment_method` (`cash` / `card` / `account`、NULL 可)・確定時に提案と一致していたかの列 (NULL 可、NULL は手動変更)。
- Physical store/engine/version: Cloudflare D1 (SQLite)。Drizzle の schema 定義 (`schema.ts`) と migration の SQL を同じ変更で揃える。
- Schema/index/partition decisions: 履歴は明細単位で新しい順に読むため `(user_id, tx_id, changed_at)` の索引だけを足す。分割やパーティションは行わない。

#### Access and consistency

- Query/access patterns: 一覧は期間の明細を 1 回で読み、core で区分と件数を出す。履歴は 1 明細ずつ新しい順に読む。一括保存では明細 id を `IN (...)` で読み、`inClauseChunkSize` で区切る。
- Transaction/consistency/idempotency: 1 明細の手当て・分割・履歴を同じ D1 batch に入れ、書込は成功して履歴だけ欠ける状態を作らない。batch の区切りは明細の境界に合わせる。変更系は `canonicalMutationFence` で取込の洗替えと直列化する。
- Cache/replica/search consistency: N/A: キャッシュ・レプリカ・検索索引を持たない。

#### Lifecycle and governance

- Retention/archival/deletion: 保存フィルタは利用者が削除する。取引の履歴の保存期間は system-spec に定めが無く、既定では明細の削除 (`deletion-full-reset.ts` の全削除を含む) と一緒に消すかを仕様で決める。
- Privacy/audit/lineage: 履歴の `op_id` で一括保存・ルール適用・取消の 1 操作に属する行をまとめる。削除と取消も履歴に残す。
- Data quality/contracts: `source` の CHECK、名前と条件 JSON の長さ、`(user_id, name)` の一意で不正な値を DB でも止める。

#### Migration and recovery

- Migration/backfill/dual-write/cutover: migration は追加のみの 1 本 (`0046_classify_workbench.sql` を予定、agent 推定・利用者未確認、根拠 qa-classify-database-web-002)。着手時に `origin/main` を fetch して番号の衝突を確かめる。埋め戻しはせず、NULL を既存の意味 (支払方法は導出値、提案一致は手動変更) で読む。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を同じ変更で上げる。
- Backup/restore/RPO/RTO: 既存の D1 の Time Travel と JSON バックアップに従う。追加の RPO/RTO を定めない。
- Rollback/forward-fix: 追加表と追加列は直前版の Worker に無視されるため、Worker を戻すだけで足りる。schema は戻さず forward-fix にする。

#### Data verification

migration を空の D1 と 0045 まで適用した D1 の両方に当て、既存行が変わらないことと、追加列が NULL / 既定値で入ることを確かめる。`schema.ts` と migration の列が一致することを既存の schema テストで確かめる。API 統合テストで、各変更経路 (手動・一括・ルール・分割・削除・取消) の後に `tx_history` が 1 件ずつ増えること、同名の保存フィルタと 21 件目が拒まれることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-database-web-001 | 追加のみの migration 1 本にし、行を書き換えない | 既存の手当てに区分を埋め戻す | 直前版の Worker と共存でき、Deploy が止まったときの復旧が軽い | NULL を既存の意味で読む規則を core に持つ |
| qa-classify-database-web-003 | 確定時の提案一致を `tx_edits` の列に残す (agent 推定・利用者未確認) | 表示のたびに現在の提案と比べる | 後から提案が変わっても区分が揺れない | 記録の無い既存の手入力は手動変更になる |
| qa-classify-database-web-001 | 保存フィルタと履歴を D1 に、下書きを localStorage に置く | 全部を localStorage に置く | フィルタと履歴は端末をまたいで残り、下書きはサーバの書込を増やさない | 下書きは端末をまたがない |
| qa-classify-database-web-002 | 履歴を変更経路と同じ D1 batch で書く (agent 推定・利用者未確認) | 履歴を後から非同期で書く | 書込と記録の不一致が起きない | batch あたりの文数が増え、区切りを明細の境界に合わせる |
| qa-classify-database-web-001 | 件数・区分を保存せず毎回導出する | 集計表を持つ | 正本が 1 か所で、ずれの修復が要らない | 一覧の要求ごとに期間の明細を読む |

## Delivery, migration and rollback

- Build/deploy topology: `migrate.yml` で D1 へ反映してから `deploy.yml` で Worker を配信する既存の順。
- Migration sequence: `origin/main` の fetch と番号確認 → migration の SQL と `schema.ts` の追加 → `EXPECTED_D1_MIGRATION` の更新 → ローカル D1 への適用とテスト → Migrate → Deploy。
- Rollback trigger/procedure: Deploy 後に不具合が出たら Worker を直前版へ戻す。schema は追加のみなので戻さない。Migrate だけ通って Deploy が止まった場合は Deploy を再実行する。

## Risks and verification

- Risk/assumption: 長い作業の間に main 側で別の migration が 0046 を使うと、git の衝突に出ずに番号が重なる。着手時と PR 前に `origin/main` を fetch して確かめる。
- Risk/assumption: `saved_filters`・`tx_history` を JSON バックアップと復元の対象、全削除 (`deletion-full-reset.ts`) の対象に含めるかが system-spec に無い。含めない場合、全削除の後に明細の無い履歴と保存フィルタが残る。仕様で決め、全削除のテストで確かめる。
- Risk/assumption: 一括保存 100 件の `IN (...)` は `D1_MAX_BOUND_PARAMS = 100` に `user_id` を足すと超えるため、`inClauseChunkSize` で区切る。
- Architecture fitness test: migration に `UPDATE`・`DROP`・列の型変更が無いこと。新表の読み書きに `user_id` の条件があること。`EXPECTED_D1_MIGRATION` が最新の migration と一致すること。
- Load/failure/security validation: 100 件の一括保存が batch の区切りを守って書けること。batch の失敗が他の明細の結果を巻き込まないこと。
