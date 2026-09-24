---
graph_node_id: "arch-improvement-screen-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "改善リクエスト — migration 0054 で improvement_requests を作り直して状態を 4 つに改め、利用者ごとの連番・論理削除・履歴表を足し、既存の行・画像・トークンを 1 件も落とさずバックアップの外に置く"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement-screen", "database"]
file_path: "architecture/improvement-screen-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e78afa978af55888a889ff64954168736d8321c4bc8c4cf83d9b0bdfc691c6a9"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "e78afa978af55888a889ff64954168736d8321c4bc8c4cf83d9b0bdfc691c6a9", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["migrations", "packages/api/src/improvement/contract.ts", "packages/api/src/schema-guard.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/store.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/routes/improvement.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G3", "G4"]
---

# Architecture overview

改善リクエスト — migration 0054 で `improvement_requests` を作り直す (新しい表を作り、行を写し、古い表を消し、名前を変える)。変更は次のとおり (qa-imp-database-web-001)。

- 状態の CHECK を open/in_progress/done/reconfirm に変え、wontfix の行は done へ移して、理由を履歴に 1 行残す。
- 利用者ごとの連番 `seq` を足す。UNIQUE(user_id, seq) を張り、採番表で番号を再利用しない。既存の行は作成順に番号を振る。
- 論理削除の列 `deleted_at` を足す。
- 件名 (`title`) を NULL 許容にする。
- 履歴の表を足す (依頼の行を ON DELETE CASCADE で参照する)。

既存の行・画像のキー・トークンのハッシュは 1 件も落とさない。表は夜間バックアップの対象外のままにする。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を 0054 に進める。`system-spec/database.md` は承認時入力で、本書は表の形・書き込み元・移行・復旧の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: `migrations/0029_improvement_requests.sql` の表は、id TEXT PK・user_id・title (CHECK 1..120)・body (CHECK 1..4000)・route・status (CHECK open/in_progress/done/wontfix)・screenshot_key・screenshot_size・diagnostics_json・diagnostics_omitted・token_hash UNIQUE・token_expires_at・token_fetch_count・copied_at・copied_target・done_at・purged_at・created_at・updated_at を持つ。索引は `idx_improvement_requests_user (user_id, created_at)` と、部分索引の `idx_improvement_requests_purge (status, done_at) WHERE purged_at IS NULL` である。連番・論理削除・履歴の列や表は無い。最新の migration は `0052_cash_entry_owner_soft_delete.sql` で、`schema-guard.ts:4` と `deletion-schema.test.ts:63` がこの名前を固定している。`BACKUP_SNAPSHOT_SQL` (`store.ts:802`。evidence 記録時は :796) はこの表を含まない (qa-imp-database-web-evidence-001)。この表を REFERENCES する表は 0052 までに無い (grep で 0 件)。
- Quality attribute priorities: G3 (導出値は保存しない) と G4 (分離・論理削除・完全消去・バックアップ除外)。上流指針は Clean Architecture の data-access 境界と、Google SRE の reliability。
- Constraints: D1 (SQLite)。SQLite は CHECK を後から変えられない (sqlite-alter-table) ので、表の作り直しが要る。D1 では `PRAGMA foreign_keys=OFF` が無視される (`migrations/0026_balance_entries.sql:47-48`、cloudflare-d1-foreign-keys)。migration の番号は 0054 から始める。1000 字を超える既存の本文は保ち、全読み取り経路で deleted_at を除く (C2)。新しい Cron は足さず、`BACKUP_SNAPSHOT_SQL` に入れない (C3)。

## Goals and non-goals

- Goals:
  - G3: 概要 (本文の先頭行から最大 40 字)・IMP 番号の表示形・件数・関連する依頼は導出値として保存しない。core の improvement-screen が毎回導く。
  - G4: 利用者ごとの連番、論理削除と 30 日後の完全消去 (履歴も CASCADE で消える)、既存データの保全、バックアップ除外を DB の形で守る。
- Non-goals:
  - 件名の列の削除 (既存の値を失わないよう残し、新規の行は NULL にする)
  - 端末内のローカル DB と同期 (qa-imp-decision-005)
  - 関連する依頼の保存 (qa-imp-decision-006)

## System context and boundaries

- Users/external systems: api (`routes/improvement.ts`) だけが読み書きする。夜間の `improvement_retention` job が完全消去と添付の消去を行う。
- Trust/deployment/data boundaries: 行はすべて `user_id` を持ち、読み取りは必ず `user_id` で絞る。画像の本体は R2 に置き、D1 はキーだけを持つ。キーの形 (`improvements/<userId>/<requestId>.jpg`) は変えない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `improvement_requests` (0054 で作り直し) | 依頼の本体。seq・deleted_at を足し、title を NULL 許容に、状態の CHECK を 4 つに | SQL / Drizzle | packages/api | D1 |
| 採番表 (0054 で新設) | 利用者ごとの最後の番号。削除しても戻さない | SQL | packages/api | D1 |
| 履歴表 (0054 で新設) | 作成・状態の変更・再発行・削除・復元の事実を追記 | SQL、依頼を ON DELETE CASCADE で参照 | packages/api | D1 |
| `migrations/0054_improvement_request_screen.sql` | 作り直しと移し替え | SQL | repo | wrangler d1 migrations |
| `packages/api/src/schema-guard.ts` | 期待する最新 migration の固定 | 定数 | packages/api | Workers |

採番表と履歴表の名前・列、移行順序の正本は `migrations/0054_improvement_request_screen.sql` とする。計画時の番号 0053 は取込画面に使用されたため、本機能は 0054 になった。

## Cross-cutting contracts

- Identity/access: 全クエリを `user_id` で絞る。認可は `architecture/improvement-screen-auth.md` に従う。
- Errors/resilience: 0054 は 1 つの migration として適用され、途中で落ちたら表は元のまま残る (Cloudflare D1 migrations。0026 のコメントにも同じ前提がある)。書き込みは依頼の行と履歴の行を同じ D1 batch に入れる。
- Observability/audit: 履歴表が依頼ごとの監査記録になる。行は追記だけで、書き換えない。
- Configuration/secrets: トークンは引き続きハッシュだけを保存する (`token_hash` UNIQUE)。
- Compatibility/versioning: `EXPECTED_D1_MIGRATION` を 0054 のファイル名に進める。0054 を当てる前の D1 では、Worker が新しい経路を動かさない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/improvement-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外

### Data architecture

#### Data domains and ownership

改善リクエストの領域は packages/api が単独で持つ。他の領域の表からは参照されない。書き込み元は列ごとに 1 経路に限る (上流指針 data-access)。

- `seq`: 作成時に、採番表の更新と同じ batch でだけ付ける。
- `deleted_at`: 削除で付け、復元でだけ外す。
- 夜間の完全消去: 期限を過ぎた行を読み、行を消す。
- 履歴の行: 作成・状態の変更・再発行・削除・復元の各経路が、依頼の行と同じ batch で書く。

取引先名の辞書 (`transactions.partner`) と名義の表示名 (`owner_labels`、0045) は読むだけで、この領域には写さない。

#### Logical and physical model

改善リクエストは利用者ごとの連番で追う Entity なので、`seq` を列に持つ。採番表の最後の番号は、削除しても戻さない (qa-imp-decision-007)。概要・IMP 番号の表示形・件数・関連する依頼は、他の値から決まる導出値なので保存しない (DDD の Entity / Value Object。章の『本章での適用』はアシスタントの推定)。3 桁 (999) を超えたときの番号の表示は core の管轄で、未決である。

作り直す表には、今の索引 `(user_id, created_at)`、部分索引 `(status, done_at) WHERE purged_at IS NULL`、`token_hash` の UNIQUE、新しい UNIQUE(user_id, seq) を張り直す。削除から 30 日の完全消去を探す索引を足すかどうかは、agent 推定・利用者未確認とする。本文の CHECK を 1000 字に狭めると、1000 字を超える既存の行が写せない。そのため 1000 字の上限は API の zod で新規の作成だけに掛け、DB の CHECK は 4000 字のままにする (C2 からの agent 推定・利用者未確認)。

#### Access and consistency

`improvement_requests` を読む全経路に `deleted_at IS NULL` を掛ける。経路は一覧・件数・詳細・画像・指示文・コピー記録・状態・agent の 2 経路・関連する依頼である (backend 章)。書き込みの一貫性は D1 batch で取る。作成は採番表・依頼の行・履歴の行を 1 batch で書くので、UNIQUE(user_id, seq) が競合したら batch 全体が失敗する。

#### Lifecycle and governance

- 完了 (done) から 30 日: 今の処理のまま、添付・診断・トークンを消し、本文と状態は残す (`runImprovementRetention`)。
- 削除 (deleted_at) から 30 日: 夜間処理で R2 の画像を消し、行を DELETE する。履歴は ON DELETE CASCADE で一緒に消える (qa-imp-decision-003)。夜間の D1 の枠は D-imp-008 (borrow-slot) で 1 本を回す。
- バックアップ: 依頼の表も履歴の表も `BACKUP_SNAPSHOT_SQL` に入れない。`improvement-backup-exclusion.test.ts` がこの不在を固定する。

D1 で CASCADE が効くのは FK の検査が有効な場合である。完全消去のテストで、履歴の行が 0 件になることを確かめる。

#### Migration and recovery

0054 の手順は次のとおり (上流指針 reliability)。

1. 新しい依頼の表を作る。
2. 旧表の行を写す。wontfix は done に移し、`seq` は利用者ごとに created_at (同時刻なら id) の順で振る。title は値をそのまま写す。
3. 採番表に、利用者ごとの最大の `seq` を入れる。
4. 旧表を消し、新しい表の名前を変える。
5. 索引を張り直す。
6. 履歴表を作る (名前を変えたあとに作り、FK の参照先を新しい表にする)。
7. 旧 wontfix の行ごとに、理由の履歴を 1 行入れる。

旧 wontfix の行で `done_at` が NULL なら、0054 の適用時刻を入れる。既に値があれば保つ。これは `migrations/0054_improvement_request_screen.sql` の実装に従う。

適用前に D1 のバックアップを取る手順を runbook に置く (runbook の置き場所は `architecture/improvement-screen-maintenance-ops.md` の管轄)。順序は Migrate → Deploy にする。失敗したときは、既存の `docs/runbooks/prod-d1-schema-recovery.md` の復旧の型に従う。

#### Data verification

前例の `cash-migration-0052.test.ts` と同じ型の `improvement-migration-0054.test.ts` で、0053 までを流した DB に旧形の行を置き、0054 を当てて次を確かめる。

- 行数・id・screenshot_key・token_hash が変わらないこと。
- wontfix が 0 件になり、done と履歴 1 行に移ること。
- seq が利用者ごとに 1 から作成順に振られ、採番表が最大値を持つこと。
- 1000 字を超える既存の本文がそのまま残ること。

`deletion-schema.test.ts:63` の期待値を 0054 のファイル名に更新する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-database-web-001 | 0054 で表を作り直す (新表 → 写す → 旧表を消す → 名前を変える) | ALTER TABLE で列だけ足す | SQLite は CHECK を後から変えられず、状態の張り替えに作り直しが要る | 索引と UNIQUE を張り直す必要がある。適用前のバックアップが要る |
| qa-imp-decision-001 | wontfix を done と履歴 1 行に移す | wontfix を残す | 画像の 4 状態と揃い、理由を失わない | 旧 wontfix の done_at を決める必要がある |
| qa-imp-decision-007 | 利用者ごとの seq と採番表。削除しても再利用しない | 全体の連番 / MAX+1 で採番 | 番号が利用者の中で安定し、削除で番号が戻らない | 作成時に採番表を同じ batch で更新する |
| qa-imp-decision-003 | deleted_at による論理削除と、30 日後の完全消去 (履歴は CASCADE) | 即時の物理削除 | 『元に戻す』で同じ番号に戻せる | 全読み取り経路に条件が要る |
| qa-imp-database-web-001 | 件名の列は残して NULL 許容にし、概要や件数は保存しない | 列を消す / 概要を保存する | 既存の値を失わず、導出値の二重管理を避ける | 既存行の概要に件名と本文のどちらを使うかは core の未決事項 |

## Delivery, migration and rollback

- Build/deploy topology: wrangler d1 migrations で 0054 を当て、そのあと Worker を Deploy する。
- Migration sequence: 適用前の D1 バックアップ → 0054 (作り直し・移し替え・履歴表) → `EXPECTED_D1_MIGRATION` の更新と Deploy → 夜間の完全消去の有効化。
- Rollback trigger/procedure: migration テストか本番の schema guard が赤なら止める。0054 は表の形を変えるので、コードだけを戻しても旧コードとは合わない。戻すときは、適用前に取ったバックアップと `docs/runbooks/prod-d1-schema-recovery.md` の手順に従う。

## Risks and verification

- Risk/assumption: D1 では FK の検査を切れない。履歴表を旧表の名前変更より先に作ると、参照先がずれる。手順で履歴表を最後に作り、migration テストで CASCADE を確かめる。
- Risk/assumption: seq の既存行への採番で、同じ created_at の行の順序が決まらないと、実行ごとに番号が変わる。id を第 2 キーにする (agent 推定・利用者未確認)。
- Risk/assumption: 旧 wontfix の done_at が NULL のまま done に移ると、30 日の添付消去の対象にならない。値の決め方を実装前に確定する。
- Architecture fitness test: 概要・番号の表示形・件数・関連を保存する列が無いこと。`BACKUP_SNAPSHOT_SQL` に両表が無いこと。
- Load/failure/security validation: migration テスト (行・画像のキー・トークンの保全、wontfix の移し替え、seq の採番、長い本文の保全) と、完全消去のテスト (R2 の画像と履歴が消える) を通す。
