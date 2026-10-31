---
graph_node_id: "arch-improvement-screen-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "改善リクエスト — 削除から 30 日後の完全消去を新しい cron を足さず夜間の improvement_retention に相乗りさせ、audit_header_retention から 1 本回して D1 予算の合計 49 を保つ"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement", "infrastructure"]
file_path: "architecture/improvement-screen-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "ceb0b5c8ff5b5915d82a87ad1dd7fa1f755a1c7841e42d3ca41bb676b25535d6"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "ceb0b5c8ff5b5915d82a87ad1dd7fa1f755a1c7841e42d3ca41bb676b25535d6", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/index.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/scheduled-maintenance-budget.test.ts", "packages/api/src/audit-log.ts", "packages/api/src/routes/improvement.ts", "packages/api/src/schema-guard.ts", "migrations", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G4"]
---

# Architecture overview

改善リクエスト — 論理削除から 30 日を過ぎた依頼の行・履歴・R2 の画像を消す処理を、新しい cron を足さず既存の夜間 `0 18 * * *` の `improvement_retention` に相乗りさせる。D1 の 1 invocation あたりの予算は 49/49 で埋まっているので、`audit_header_retention` の削除前の読み取りを外して 3→2 本にし、その 1 本を `improvement_retention` の 3→4 本に回す。合計 49 と R2 のキーの形は変えない (qa-imp-infrastructure-web-001、qa-imp-decision-008 / D-imp-008)。`system-spec/infrastructure.md` は承認時入力、本書は夜間処理・D1 予算・配信経路の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: cron は `packages/api/wrangler.jsonc:31` の `["0 18 * * *"]` の 1 本だけ。`packages/api/src/index.ts:201` の `scheduledMaintenance` は `nightlyBackup` を先に済ませ、残り 7 job を `Promise.allSettled` で並べる (`improvement_retention` は :214)。`packages/api/src/scheduled-maintenance-budget.ts` は 8 job の予算を宣言し、上限 50 (`SCHEDULED_D1_QUERY_LIMIT`)、受け入れの最大 49、計画の最大 49 とする。内訳は nightly_backup 1・r2_cleanup 20・password_login_rate_limit_cleanup 2・improvement_retention 3 (:87)・deletion_undo_retention 12・audit_header_retention 3 (:91)・audit_detail_retention 6・cash_soft_delete_purge 2 で、合計 49 (qa-imp-infrastructure-web-evidence-001)。
- 現状との差分: `runImprovementRetention` (`packages/api/src/routes/improvement.ts:498`) は、完了から 30 日を過ぎた依頼を最大 500 件 SELECT し、R2 を 1 件ずつ消し、成功した ID だけを `json_each` の集合 UPDATE で添付・診断・トークンを消す。続けて `sweepImprovementOrphans` で孤立画像を照合する。本文・状態は残す。削除中の行を消す DELETE は無い。`runAuditHeaderRetention` (`packages/api/src/audit-log.ts:412`) は削除前の件数と容量 (:419)・DELETE・削除後の件数と容量を読み、`queries: 3` (:435) を返す。
- Quality attribute priorities: G4 に資する。Google SRE (reliability / operations) に従い、1 つの job の失敗が他の job とバックアップを止めない形を保つ。
- Constraints: Cloudflare Workers Free の 1 invocation あたり 50 クエリ (cloudflare-d1-limits、2026-04-21 版、2026-09-23 確認)。cron trigger は wrangler.jsonc で宣言する (cloudflare-workers-cron-triggers、2026-09-04 版、2026-09-23 確認)。本章が引く design card は 0 件。

## Goals and non-goals

- Goals:
  - G4: 論理削除から 30 日を過ぎた依頼の行・履歴・R2 の画像を夜間処理で完全に消す (qa-imp-decision-003、O4)。
  - G4: 完了から 30 日で添付・診断・トークンを消す現行の保持を保つ。
  - G4: `SCHEDULED_MAINTENANCE_D1_PLAN` の合計 49 と上限 50 の余白 1 本を保つ。
- Non-goals:
  - 新しい cron trigger・新しい Worker・Queue・Durable Object の追加
  - DB トリガで既存の UPDATE に連動させる方式、一覧を開いたときに消す方式 (D-imp-008 で不採用)
  - R2 のキーの形 `improvements/<userId>/<requestId>.jpg` (`packages/core/src/improvement.ts:348-349`) の変更
  - モバイル・タブレット・デスクトップの配布経路 (qa-imp-decision-005 で対象外)

## System context and boundaries

- Users/external systems: Cloudflare の Cron Trigger が api Worker の `scheduled` (`index.ts:408`) を呼ぶ。利用者の操作は関与しない。
- Trust/deployment/data boundaries: D1 (`DB`) と R2 (`FILES`) は同じ Worker のバインディング (`wrangler.jsonc:15-28`)。夜間処理は本文・診断・利用者 ID を Worker の外へ持ち出さず、ログにも出さない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Cron Trigger (`wrangler.jsonc:31`) | 毎晩 `0 18 * * *` に `scheduled` を呼ぶ | Workers scheduled event | Cloudflare | api Worker の設定 |
| `scheduledMaintenance` (`index.ts:201`) | 8 job を `Promise.allSettled` で独立に走らせ、job ごとに JSON ログを出す | 関数 | packages/api | api Worker |
| `runImprovementRetention` (`routes/improvement.ts:498`) | 完了から 30 日の添付の消去 + 論理削除から 30 日の行・履歴・画像の完全消去 + 孤立画像の照合 (4 本) | 関数 | packages/api | 同上 |
| `runAuditHeaderRetention` (`audit-log.ts:412`) | 監査ヘッダの 400 日保持。削除前の読み取りを外して 2 本 | 関数 | packages/api | 同上 |
| D1 予算表 (`scheduled-maintenance-budget.ts`) | job ごとの本数の宣言と合計 49 の検査 | 定数 + 検査関数 | packages/api | 同上 |
| migration 0057 (`migrations/`) | 表の作り直し (`deleted_at`・連番・履歴表)。詳細は `architecture/improvement-screen-database.md` | SQL | migrations | D1 |

## Cross-cutting contracts

- Identity/access: N/A: 夜間処理は利用者の資格情報を使わない。
- Errors/resilience: 完全消去は他の job と `Promise.allSettled` で独立させ、失敗しても他の job とバックアップを止めない。R2 の削除に成功した行だけを D1 で消し、失敗した行は D1 を触らず翌晩もう一度対象にする。1 晩 500 件を超えた分は翌晩に回す。いずれかの job が失敗したときに最後に `scheduled_maintenance_failed` を投げる現行 (`index.ts:400`) は保つ。
- Observability/audit: job ごとの JSON ログ (`improvement_retention` は `index.ts:290-307`) に、完全消去の対象件数・消した件数・失敗件数を足す (項目名は未定)。本文・利用者 ID・R2 のキーは載せない。`audit_header_retention` のログ (`index.ts:335` 以降) からは `beforeBytes` (:339) が消える。削除前の件数は、削除後の件数と消した件数の和で出す。
- Configuration/secrets: 新しい binding・var・secret を足さない。
- Compatibility/versioning: `EXPECTED_D1_MIGRATION` (`packages/api/src/schema-guard.ts:4`、現在 `0052_cash_entry_owner_soft_delete.sql`) を 0057 へ進める。0057 のファイル名は `0057_improvement_request_screen.sql`。`runtimeSchemaGuard` が migration の未適用を拒むので、D1 migration の適用を Worker のデプロイより先に済ませる。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/improvement-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/improvement-screen-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/improvement-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/improvement-screen-security.md`)

### Infrastructure architecture

#### Environments and topology

構成は変えない。Cloudflare Workers の api Worker 1 つが静的アセット (`wrangler.jsonc:8-14`、`/api/*` は Worker を先に通す)・D1・R2 をまとめて持ち、cron は 1 本。ローカルは `wrangler dev`、本番は `deploy.yml` の配信。

#### Compute and storage

`improvement_retention` の 4 本は、期限の検索・添付を消す UPDATE・削除中の行の DELETE・孤立画像の照合 (qa-imp-infrastructure-web-001)。完了から 30 日の行と論理削除から 30 日の行を 1 本の SELECT でまとめて拾い、R2 の画像を 1 件ずつ消してから 2 本の書き込みに振り分ける形になる (推定。検索を 1 本に収めるのは 4 本の内訳から導いたもので、SQL の形は backend と database の章で決める)。履歴は履歴表の `ON DELETE CASCADE` で行と一緒に消える (`architecture/improvement-screen-database.md`)。500 件の上限・ID を `json_each` の 1 パラメータに入れる現行の形 (D1 の bind 上限 100 を避ける) を DELETE にも使う。`audit_header_retention` は DELETE と削除後の読み取りの 2 本にする。

#### IaC and delivery

`wrangler.jsonc` は変えない。0057 は表を作り直すので `DROP TABLE` を含む見込み (推定) で、`.github/scripts/plan-auto-migration.mjs` の `DESTRUCTIVE_PATTERNS` (:45 以降) に当たる。その場合 `deploy.yml` は自動適用 (:73-78、Time Travel の復元地点を記録してから適用) を行わない。`migrate.yml` の手動経路 (confirm に `APPLY`、`approved_manifest`、Time Travel の復元地点の確認) で適用してから Worker をデプロイする。

#### Secrets and access

新しい secret は無い。必須の secret は `SESSION_SECRET` のまま (`wrangler.jsonc:38-41`)。

#### Reliability and recovery

R2 の削除は冪等で、D1 の書き込みは R2 の成功後だけに行う。D1 の書き込みが失敗したら、その回の全行を未処理として翌晩に回す (現行の形)。0057 の適用失敗は、Time Travel の復元地点へ戻す (`docs/runbooks/prod-d1-schema-recovery.md`、手順の追記は `architecture/improvement-screen-maintenance-ops.md`)。

#### Infrastructure verification

`scheduled-maintenance-budget.test.ts` (:173-182 の job 固定) を improvement_retention 4・audit_header_retention 2 に改め、合計 49 を確かめる。:257 のログ検査に完全消去の件数を足す。`audit-log-d8.test.ts` の `header.queries < 49` (:479) は緑のまま。`improvement-retention.test.ts` の系列で、論理削除から 30 日を過ぎた行が R2 の画像・履歴と一緒に消えること、R2 の削除に失敗した行が残って翌晩の対象になること、30 日未満の行と完了の本文が残ることを確かめる。`deletion-schema.test.ts:63` と `schema-guard.ts:4` を 0057 へ進める。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-infrastructure-web-001 | 新しい cron を足さず `improvement_retention` に相乗りさせる | 専用の cron | 1 invocation の予算と失敗の独立性を既存の枠組みで守れる | 完全消去は毎晩 1 回、最大 500 件 |
| qa-imp-decision-008 / D-imp-008 (borrow-slot) | `audit_header_retention` の削除前の読み取りを外し 3→2 本、`improvement_retention` を 3→4 本 | DB トリガで連動 / 一覧を開いたときに消す | 外す読み取りはログに書くだけで判定に使っていない。完全消去をアプリのコードとテストに明示できる | 合計 49 のまま。監査ヘッダのログから `beforeBytes` が消える |
| qa-imp-decision-003 | 論理削除から 30 日で行・履歴・R2 の画像を完全に消す | 物理削除 | 『元に戻す』の猶予を置ける | 削除中の行は 30 日 DB に残る (どの経路からも読まない) |
| qa-imp-infrastructure-web-001 | R2 のキーの形を変えない | 削除中の画像を別の接頭辞へ移す | 移動の書き込みと孤立の照合を増やさない | 論理削除中の画像は同じキーに残る |

## Delivery, migration and rollback

- Build/deploy topology: `deploy.yml` の配信 (web の build:artifact → migration の判定 → 適用 → 未適用の検査 → Worker のデプロイ)。
- Migration sequence: 0057 を手動経路で適用 (D1 バックアップ・Time Travel の復元地点の確認を先に) → `EXPECTED_D1_MIGRATION` を 0057 にした Worker をデプロイ → 翌晩の夜間処理のログで件数を確かめる。
- Rollback trigger/procedure: 夜間処理が `scheduled_maintenance_failed` を出し続ける、または予算の検査が落ちたら、Worker を前の版へ戻す。0057 が壊れたら Time Travel の復元地点へ戻し、`EXPECTED_D1_MIGRATION` が設定画面の 0056 を指す旧版をデプロイする。

## Risks and verification

- Risk/assumption: 予算の宣言は本数を数えるだけで、実際の本数と一致するかはテストが頼り。`improvement_retention` のテストで、実行時のクエリ数が 4 本以下であることを確かめる。
- Risk/assumption: 論理削除の行が 1 晩に 500 件を大きく超え続けると消し終わるまで日数がかかる。利用者ごとの依頼数から見て起こりにくい (推定)。
- Risk/assumption: 0057 が破壊的と判定されず自動適用に乗った場合でも、`deploy.yml` は Time Travel の復元地点を先に記録する。
- Architecture fitness test: `SCHEDULED_MAINTENANCE_D1_PLAN` の合計が 49 以下、job 名の集合が 8 つのまま。`wrangler.jsonc` の crons が 1 本のまま。
- Load/failure/security validation: R2 の削除失敗を注入したテストで他の job が走り切ること、ログに本文・利用者 ID・R2 のキーが出ないこと。
