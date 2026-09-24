---
graph_node_id: "arch-settings-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "設定 — 基盤を変えず cron を JST 2:00 へ移し、各回の成否・メモ・要約を R2 に残して失敗も一覧に出す"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "infrastructure"]
file_path: "architecture/settings-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6b7af8e430bf9e58190417f42bb9e68c682f79d5c790e70419330e6e5ef75192"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "6b7af8e430bf9e58190417f42bb9e68c682f79d5c790e70419330e6e5ef75192", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-database", "arch-settings-security", "arch-settings-maintenance-ops", "arch-settings-auth"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/index.ts", "packages/api/src/routes/settings.ts", "packages/api/src/nightly-backup.test.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/schema-guard.ts", ".github/workflows/ci.yml", ".github/workflows/migrate.yml", ".github/workflows/deploy.yml", "migrations"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G4"]
---

# Architecture overview

設定 — 基盤を変えず cron を JST 2:00 へ移し、各回の成否・メモ・要約を R2 に残して失敗も一覧に出す。`system-spec/infrastructure.md` は承認時入力、本書は夜間バックアップの実行時刻・各回の状態の置き場所・復元前の退避・保持・配信の制約を持つ。確定内容の正本は qa-settings-infrastructure-web-003 と決定 qa-settings-decision-007。

## Context and drivers

- Business/technical context: `packages/api/wrangler.jsonc` は R2 `FILES` → `kanjo-files`、D1 `DB`、cron `"0 18 * * *"` (JST 3:00)。`packages/api/src/index.ts` の `nightlyBackup` は `loadBackupPayload` の統合 JSON を R2 `backups/YYYY-MM-DD.json` に put し、30 日より古いものを消す。`scheduled` は `scheduledMaintenance` を `waitUntil` で走らせ、バックアップの失敗はログにしか出ない。R2 の list は 1000 件のページングを考えていない (30 件保持なので現状は実害なし) (qa-settings-infrastructure-web-evidence-001)。CI は `ci.yml`、migration は `migrate.yml`、配信は `deploy.yml`。既存の外形テストは `packages/api/src/nightly-backup.test.ts` (Miniflare)。
- Quality attribute priorities: G4 に資する。Google SRE の reliability (失敗した回も失敗として残し、復元前の自動退避を保持 30 日で消す。R2 の list は 1000 件ごとに cursor で続きを取る前提で書く) と operations (各回の成否・メモ・要約を R2 に残し、ログを見なくても画面から運用状態を確かめられる) を適用する (https://sre.google/books/、https://sre.google/workbook/)。Cron Triggers は UTC で評価される (https://developers.cloudflare.com/workers/configuration/cron-triggers/)。R2 の Workers API は put の `customMetadata` と list の `cursor` を持つ (https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。
- Constraints: 単一テナントの前提を変えない。cron の変更は `wrangler.jsonc` の 1 行で、保持 30 日は据え置く (C5・U7 対象外)。バックアップの中身は従来どおり全データ (決定 007)。外部送信 0 件。

## Goals and non-goals

- Goals:
  - G4: 夜間バックアップを毎日 JST 2:00 に実行する (qa-settings-decision-007)。cron 式は UTC 評価なので `"0 17 * * *"` (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004)。
  - G4: 各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせ、失敗した回も一覧に出す (qa-settings-infrastructure-web-003)。
  - G4: 設定の復元とバックアップからの設定の復元の直前に現在の設定を退避し、同じ保持 30 日で消す。
- Non-goals:
  - 保持期間 (30 日) の変更
  - バックアップの中身を設定だけにすること (中身は全データのまま)
  - 新しいバインディング・キュー・Durable Objects・外部の通知サービス
  - 環境 (本番・ローカル) の構成変更

## System context and boundaries

- Users/external systems: Cloudflare の Cron Trigger → api Worker の `scheduled` → D1 (読取り) → R2 (書込み)。ブラウザ → api Worker → R2 (一覧・比較・復元の読取り)。GitHub Actions が migration と配信を行う。
- Trust/deployment/data boundaries: 本番の R2 と D1 への書込みは Worker と `migrate.yml` だけ。ローカルの wrangler は本番に触れない。R2 のバックアップ本文は復元時に信頼境界の外の入力として検証する (`architecture/settings-security.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Cron Trigger (`wrangler.jsonc`) | 毎日 JST 2:00 に `scheduled` を起こす | `triggers.crons` | packages/api | Cloudflare Workers |
| `nightlyBackup` | 全データの統合 JSON を put し、成否・メモ・要約を残し、30 日より古い世代を消す | 関数 | packages/api | Worker |
| R2 `backups/` | 日ごとのバックアップ本文と失敗の記録 | R2 | packages/api | Cloudflare R2 |
| R2 の復元前の退避 | 復元直前の現在の設定 | R2 | packages/api | Cloudflare R2 |
| 一覧・比較の API | 状態・メモ・要約つきの一覧と、その日の設定と現在の設定の差分 | HTTP | packages/api | Worker |
| `ci.yml` / `migrate.yml` / `deploy.yml` | テスト、追加 migration の反映、Worker と web の配信 | GitHub Actions | リポジトリ | CI |

## Cross-cutting contracts

- Identity/access: 一覧・比較・復元は既存の Worker の認証に従う (`architecture/settings-auth.md`)。
- Errors/resilience: バックアップの put の失敗は失敗として一覧に出る記録を残し、後続の独立ジョブは既存どおり走らせる。退避に失敗したら復元を始めない。
- Observability/audit: 各回の状態・メモ・要約を R2 の各オブジェクトの `customMetadata` に置き、画面の一覧から見えるようにする (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004。U9 I6 にも語はある)。ログには R2 key・利用者情報を出さない既存の方針を保つ。
- Configuration/secrets: 新しい環境変数・秘密情報・バインディングを持たない (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004)。
- Compatibility/versioning: 既存の `backups/YYYY-MM-DD.json` のキーと中身の形は変えない。`customMetadata` を持たない過去の世代は状態『成功』・メモ空として一覧に出す (agent 推定・利用者未確認、本書の導出)。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/settings-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: N/A: 本章の関心外 (`architecture/settings-security.md`)

### Infrastructure architecture

#### Environments and topology

- Environments: 既存の本番とローカル (wrangler dev + vite)。新しい環境を作らない。
- Topology: 単一の Worker・単一の D1・単一の R2 バケット。リージョンや複製の構成を変えない。

#### Compute and storage

- Compute: 既存の api Worker の `scheduled`。算出 (設定部分の要約・比較の差分) は core の純関数で要求内に完結させる。
- Storage: R2 `backups/` に日ごと 1 本の全データ。状態・メモ・要約・形式の版は `customMetadata` に置く (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004)。失敗した回は `backups/YYYY-MM-DD.failed.json` の小さなマーカー (本文は理由コードのみ) を残す (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-002・-004)。復元前の退避は別プレフィックス `backups/pre-restore/` に置く (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004)。要約は集計ルール件数・名義の設定有無・統計の月数・現金上書きの件数 (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-002)。
- Capacity: 保持 30 日で世代は 30 本前後と退避。R2 の list は 1000 件ごとに `cursor` で続きを取る (agent 推定・利用者未確認、根拠 qa-settings-infrastructure-web-004)。

#### IaC and delivery

- IaC: `wrangler.jsonc` の `triggers.crons` の 1 行だけを変える (C5)。バインディングは変えない。schema は migration の SQL で管理する。
- Delivery: `ci.yml` → `migrate.yml` (設定の追加 migration) → `deploy.yml` (Worker と web)。cron の変更は Worker の配信と同時に効く。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` は migration と同じ変更で上げる。

#### Secrets and access

- Secrets: 新しい秘密情報を持たない。既存の GitHub Actions の secrets と Cloudflare の API トークンに従う。バックアップの要約・メモに秘密情報を入れない。
- Access: 本番の D1 への migration は `migrate.yml` からだけ。本番の R2 への書込みは Worker だけ。

#### Reliability and recovery

- Failure modes: put が失敗した回は失敗の記録だけが残り、前日の世代はそのまま使える。退避の put が失敗したら復元を 5xx で止め、設定は変えない。削除の失敗は次の回に持ち越す。
- Recovery: 設定の誤りは設定 JSON の復元か、一覧の『比較』→『復元』(設定だけ、取引は消さない、決定 010) で直す。取引を含む障害は D1 Time Travel を最後の手段に残す (`architecture/settings-maintenance-ops.md`)。Worker は直前版へ戻せる。

#### Infrastructure verification

`nightly-backup.test.ts` の系列 (Miniflare) で、成功の回が状態つきで保存されること、put を失敗させた回が一覧に『失敗』として出ること、30 日を過ぎた世代と退避が消えること、1000 件を超える list を cursor で読み切ることを確かめる。`wrangler.jsonc` の cron が JST 2:00 にあたる 1 行であることを設定の検査で固定する。CI で lint・型・テストを通す。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-decision-007 | 夜間バックアップを JST 2:00 にし、状態・メモ・要約を持たせて失敗も一覧に出す | 3:00 のまま説明文を合わせる | 画像どおりで、失敗を画面で気づける | cron の 1 行と一覧の API が変わる |
| qa-settings-infrastructure-web-003 | 中身は全データのまま、保持 30 日は据え置く | 設定だけを保存する / 保持を延ばす | 取引の障害にも従来どおり使え、容量は変わらない | 比較と復元は本文から設定部分を取り出す |
| qa-settings-infrastructure-web-004 | cron `"0 17 * * *"`・状態は `customMetadata`・失敗はマーカー・退避は `backups/pre-restore/` (agent 推定・利用者未確認) | D1 に実行記録の表を足す | 新しい表もバインディングも要らず、R2 だけで一覧が組める | list の key の解釈を 3 種 (本体・失敗・退避) に分ける |
| qa-settings-infrastructure-web-004 | 新しいバインディングを足さず、list は cursor で読む (agent 推定・利用者未確認) | 件数が少ないので 1 回の list で済ます | 退避で件数が増えても取りこぼさない | テストで 1000 件超を作る |

## Delivery, migration and rollback

- Build/deploy topology: GitHub Actions の `ci.yml` → `migrate.yml` → `deploy.yml`。
- Migration sequence: 追加 migration を Migrate で反映 → `nightlyBackup` の状態・失敗・退避・cursor の対応と一覧・比較の API → cron の 1 行 → Deploy。
- Rollback trigger/procedure: Deploy 後の不具合は Worker と web を直前版へ戻す (cron も戻る)。R2 に残った `customMetadata` と失敗のマーカーは旧版の一覧からは日付の重複として見えうるため、戻したら一覧を確かめる。migration は戻さない。

## Risks and verification

- Risk/assumption: 既存の削除は `backups/` 直下の key の 10 文字を日付として比べるため、`backups/pre-restore/` の key は日付に読めず 30 日を過ぎても消えない。退避のプレフィックスを分けるなら削除の解釈も同じ変更で直す。
- Risk/assumption: 既存の一覧 (`GET /api/backups`) も key の 10 文字を日付に読むため、`backups/YYYY-MM-DD.failed.json` を置くと同じ日付が 2 行出る。一覧は本体と失敗を 1 行にまとめる。
- Risk/assumption: key の日付は `new Date().toISOString()` の UTC 日付で、JST 2:00 (UTC 17:00) の実行では JST の前日の日付になる (現行の 3:00 も同じ)。画面の日付の見せ方を実装時に確かめる。
- Architecture fitness test: `wrangler.jsonc` のバインディングが増えていないこと。cron が 1 本で JST 2:00 にあたること。
- Load/failure/security validation: put の失敗・削除の失敗・退避の失敗のそれぞれで、設定と前日の世代が失われないこと。
