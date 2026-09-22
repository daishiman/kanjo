---
graph_node_id: "arch-import-screen-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "データ取込 — 検査・ファイル項目・レート制限の 3 表と import_runs の列を 0050 以降の追加だけで持つ"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "database"]
file_path: "architecture/import-screen-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "4b40739265566acb82504749214ed94e5071bf84a5375a7a1f898d1d3a1acd64"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "4b40739265566acb82504749214ed94e5071bf84a5375a7a1f898d1d3a1acd64", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-frontend", "arch-import-screen-backend", "arch-import-screen-auth", "arch-import-screen-security", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations", "packages/api/src/schema-guard.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/deletions.ts", "packages/api/src/scheduled-maintenance-budget.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-database.md"}]
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

データ取込 — 検査・ファイル項目・レート制限の 3 表と import_runs の列を 0050 以降の追加だけで持つ。`system-spec/database.md` は承認時入力、本書は表の責務・書き込みの置き場所・移行の制約を持つ。モデルの正本は `specs/spec-import-screen.md` (spec-import-screen) のデータモデルの節。

## Context and drivers

- Business/technical context: `imports` 表は id・user_id・filename・kind・months・row_count・status・r2_key・content_hash・duplicate_of・run_id・target_keys・failure_reason・fingerprint_version・committed_at を持つ。取込の束は `import_runs` (0008、status と failure_reason だけ)、書込の直列化は `import_writer_claims`、有効な対象は `import_active_targets`、取り消しは `import_deletion_operations`・`import_deleted_rows`・`import_deleted_targets` (0030、30 日)。`mf_transactions.import_id` と `freee_deals.import_id` が行の由来を持つ。最新の migration は `migrations/0049_ai_report_invariants.sql` (qa-imp-database-web-evidence-001)。
- Quality attribute priorities: G1〜G6 に資する。DDD card の『永続化するのはドメインの状態であって表示の都合ではない』と、Clean Architecture の data-access の境界、Google SRE の reliability を適用する。
- Constraints: D1 (SQLite) と Drizzle。migration は表と列の追加だけにし、既存の表の意味と行を変えない。

## Goals and non-goals

- Goals:
  - G2: 検査 1 要求を `import_inspections` (検査 ID・利用者・状態・期限 24 時間・作成時刻) の 1 行、ファイルごとの項目を `import_inspection_files` (ファイル項目 ID・検査 ID・利用者・ファイル名・取込元・対象期間・サイズ・内容ハッシュ・検査結果の要約・エラー種別・R2 の仮置きキー) に持つ。確定で `imports` と `import_runs` へ移し、R2 の仮置き原本は消す。検査行とファイル行は応答消失時の再送 receipt として期限まで残す。
  - G5: `import_runs` を取込 1 回 = 1 つの検査 ID の 1 行とし、ファイル数・取込明細数・新規追加・重複スキップ・サブスク候補・結果・前回データを残すの値と、履歴の非表示の時刻 `hidden_at` を列で足す。
  - G6: 取込のレート制限を `import_rate_limits` (利用者・経路の種別 (検査 / 確定)・1 分の時間枠の開始・回数、主キーはこの 3 つ) で数え、ログイン用の `password_login_rate_limits` とは分ける。
- Non-goals:
  - ステータスの文言や進捗 % の保存 (記録から導く)
  - 検査行への累計サイズの保存 (`import_inspection_files` から合計する)
  - 既存の `imports` と明細の行の書き換え

## System context and boundaries

- Users/external systems: api の取込の経路と夜間保守 (cron) だけが読み書きする。
- Trust/deployment/data boundaries: 全表が `user_id` を持ち、読み書きは利用者 ID で絞る (`architecture/import-screen-auth.md`)。原本と仮置きの実体は R2 にあり、表は鍵だけを持つ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `import_inspections` (新設) | 検査 1 要求の状態と期限 | D1 表 | 検査の経路 | D1 |
| `import_inspection_files` (新設) | ファイルごとの検査結果と仮置きキー | D1 表 | 検査の経路 | D1 |
| `import_rate_limits` (新設) | 利用者 × 経路の種別 × 1 分の時間枠の回数 | D1 表 | 入口のレート制限 | D1 |
| `import_runs` (列の追加) | 取込 1 回の影響の値と `hidden_at` | D1 表 | 確定の経路・削除の経路 | D1 |
| 既存の `imports` と明細 | ファイル単位の取込と行の由来 | D1 表 | 確定の経路 | D1 |

## Cross-cutting contracts

- Identity/access: 全表の読み書きは `user_id` で絞る。
- Errors/resilience: 確定は既存の書込の直列化の内側で行い、クエリ予算を超えるなら 1 件も書かない (`architecture/import-screen-backend.md`)。
- Observability/audit: N/A: 新しい信号を足さない。`import_runs` の影響の値が確定時の記録になる。
- Configuration/secrets: N/A: 表に秘密情報を持たない。
- Compatibility/versioning: 追加だけなので、旧 Worker は新しい表と列を読まないだけで動く。取り消し (30 日) の判定は既存の表のまま動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/import-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/import-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/import-screen-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/import-screen-security.md`)

### Data architecture

#### Data domains and ownership

`import_inspections` と `import_inspection_files` は検査の経路、`import_runs` の影響の列は確定の経路、`hidden_at` は履歴の削除の経路、`import_rate_limits` は入口のレート制限の 1 か所だけが書く (data-access の境界)。夜間保守は期限切れの検査行と古い時間枠を消すだけにする。

#### Logical and physical model

索引は `import_inspections(user_id, expires_at)`・`import_inspection_files(inspection_id)`・`import_runs(user_id, created_at)` (既存の `idx_import_runs_user_created` を使う)。`import_rate_limits` の主キーは (利用者・経路の種別・時間枠の開始)。ファイル追加の要求は種別『検査』に数える (qa-imp-decision-008)。ファイル名は制御文字を除いて 255 文字で切って記録する (qa-imp-decision-010)。

#### Access and consistency

検査 ID ごとの累計 (10 ファイル・30MB) は `import_inspection_files` のサイズと行数を合計して判定し、検査の行に合計を別に持たない。確定は検査行を読み、`imports` と `import_runs` へ書いた後、確定済み項目の R2 仮置き原本を消す。対応するファイル行は `r2_key=NULL`・`error_kind='committed'` にし、`summary_json.commit` に状態・行数・理由・重複候補数のみを残す。検査行と receipt は期限後の夜間保守で消す。影響の 3 数値は確定時の値として残す。

#### Lifecycle and governance

仮置きの期限は 24 時間。夜間保守が期限切れの検査行と 1 日より古い時間枠を 1 回 500 件まで消し、残りは翌日に回す (qa-imp-decision-010)。一括削除は `hidden_at` を付けるだけで `imports` と明細の行を消さず、取り消し (30 日) の判定に影響しない (qa-imp-decision-004)。一括削除は 1 要求 100 件まで。

#### Migration and recovery

migration は 0050 以降の新番号で、3 表の作成と `import_runs` の列の追加だけにする。既存の行は書き換えない。巻き戻しは新しい表と列を読まないことだけで済む。`schema-guard.ts` の必須の表の一覧に新しい表を加えるかは、既存の運用 (未適用の検出) に合わせて実装計画で決める。

#### Data verification

migration 適用後に `d1_migrations` に記録されること、3 表と列が Drizzle の schema と一致することを確かめる。API テストで、一括削除後に明細が残ること、確定後の検査行は期限まで receipt だけを持ち R2 仮置きが残らないこと、同一選択の再送で run が増えないこと、夜間保守が 500 件で止まり残りが翌日に回ることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-005 | 検査 1 行とファイル項目の子表に分ける | 検査だけの 1 表に JSON で持つ | ファイル項目 ID で除外・確定・累計が引ける | 表が 2 つ増える |
| qa-imp-database-web-004 | 影響の 3 数値を `import_runs` に確定時の値で残す (agent 推定) | 表示のたびに明細から数える | 取り消し・再取込の後も当時の値が変わらない | 列が増える |
| qa-imp-decision-004 | 一括削除は `hidden_at` を付けるだけ | 行を物理削除する | 明細と取り消しの判定に影響しない | 非表示の行が残る |
| qa-imp-database-web-004 | 取込のレート制限はログイン用と表を分ける (agent 推定) | `password_login_rate_limits` を共用 | 意味の違う計数を混ぜない | 表が 1 つ増える |
| qa-imp-decision-010 | 夜間保守の片づけは 1 回 500 件まで | 全件を 1 回で消す | CPU 時間とクエリ予算に収まる | 大量の期限切れは数日で消える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の D1 と Drizzle、`migrations/` の番号順。
- Migration sequence: 0050 以降で 3 表の作成と `import_runs` の列の追加 → Migrate の適用 → Worker の Deploy (`architecture/import-screen-infrastructure.md`)。
- Rollback trigger/procedure: Worker を戻すだけで、表と列は落とさない。

## Risks and verification

- Risk/assumption: 長時間の作業中に main で別の migration が 0050 を先に使うと番号が衝突する。着手時に最新番号を取り直す。
- Architecture fitness test: 新しい migration に既存の表の UPDATE・DELETE・DROP が無いこと。
- Load/failure/security validation: 累計の合計が索引 `import_inspection_files(inspection_id)` で 1 回の読み取りに収まること。
