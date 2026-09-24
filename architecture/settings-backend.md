---
graph_node_id: "arch-settings-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "設定 — core の純関数で照合・現金上書き・設定 JSON を解き 全節の保存と変更履歴を 1 つの D1 batch に閉じ 復元は preview と本適用に分ける"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "backend"]
file_path: "architecture/settings-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "8ed202ee635561a574f5fb733a146afe35b10e295340e7e5a49f50d75ec1bb3c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "8ed202ee635561a574f5fb733a146afe35b10e295340e7e5a49f50d75ec1bb3c", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-database", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-auth"]
resource_scope: ["packages/core/src/", "packages/api/src/routes/settings.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts", "packages/api/src/public-validation.ts", "packages/api/src/store.ts", "packages/api/src/import-pipeline.ts", "packages/api/src/index.ts", "packages/api/src/nightly-backup.test.ts", "packages/web/src/api.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G2", "G3", "G4", "G5"]
---

# Architecture overview

設定 — core の純関数で照合・現金上書き・設定 JSON を解き 全節の保存と変更履歴を 1 つの D1 batch に閉じ 復元は preview と本適用に分ける。`system-spec/backend.md` は承認時入力、本書は core と API の責務分割・書込みの原子性・復元の手順・夜間バックアップの制約を持つ。表の形は `architecture/settings-database.md`、逐語の正本は `specs/spec-settings-screen.md` (作成予定)。

## Context and drivers

- Business/technical context: `packages/api/src/routes/settings.ts` (800 行) に `GET /settings`・`PUT /settings` (zValidator、account_norm_map の全件置換と `recomputeFromDeals`)・`GET /backups`・`GET /backups/:date`・`GET/PUT /settings/owner-labels` がある。フェンスは `canonical-mutation-fence.ts` の `CANONICAL_MUTATION_ROUTES` に `PUT /api/settings` (consumers account_norm_map・unrecorded_months・cash_overrides・analysis_settings) と `PUT /api/settings/owner-labels` を持つ。core は `normalizeAccount` (`normalize.ts`)・`resolveTx` (`classify.ts`)・現金集計 (`cash.ts`)・`validateOwnerLabels` (`owner-labels.ts`) を持つ。夜間バックアップ (`index.ts` の `nightlyBackup`) は全データを `backups/<UTC 日付>.json` に置き、30 日より古いものを消す (qa-settings-backend-web-evidence-001)。
- Quality attribute priorities: G2〜G5 に資する。依存の向きは web → api → core で、core は依存ゼロの純関数に保つ (Clean Architecture の Dependency Rule)。取引先ルールは集計時の純関数で効かせ、明細を書き換えない。全節の変更・変更履歴の追記・snapshot の無効化を 1 つの D1 batch にまとめる。
- Constraints: 書込み API は `CANONICAL_MUTATION_ROUTES` に登録し、読むだけの API は登録しない (C4)。入力は `publicJsonValidator` と Hono `bodyLimit` (超過は 413) を通す。`TENANT_ID=default`。既存の API を消さない。

## Goals and non-goals

- Goals:
  - G2: 集計ルールの照合 (勘定科目と取引先)、優先順位 手動 > 仕分けルール > 集計ルール(取引先) > 自動、並び順による優先度を core の純関数に置く (qa-settings-decision-001, 005)。照合は NFKC と大小文字を揃えた完全一致。
  - G3: 画面用の取得と全節の保存を 1 本ずつにする。保存は `baseSavedAt` が古ければ 409 で何も書かない。変更履歴は追記のみで、移行や復元で入った値の更新者は『システム』(qa-settings-decision-008)。
  - G4: 設定 JSON の出力と復元。版番号つき・厳密検証・サイズ上限・差分プレビュー・復元前の退避 (qa-settings-decision-006)。バックアップからの復元は設定だけで、設定 JSON の復元と同じ経路を通す (qa-settings-decision-010)。
  - G5: 現金上書きを 支払い・受け取り の 2 行、空欄と 0 の区別、適用範囲 (全期間 / 月指定)、メモで持ち、core の現金集計に効かせる (qa-settings-decision-003)。夜間バックアップは JST 2:00 に実行し、成否・メモ・要約を残し、失敗も一覧に出し、比較できる (qa-settings-decision-007)。
- Non-goals:
  - 取引先ルールで明細の行を書き換えること
  - バックアップからの全データ復元 (HTML 版からの初期移行は既存のまま残す)
  - 保持期間 30 日の変更

## System context and boundaries

- Users/external systems: web の設定画面。夜間の cron。R2 (バックアップと復元前の退避)。
- Trust/deployment/data boundaries: 値の規則 (照合・範囲・空欄 / 0・版) は core が正本で、API の zod は形だけを見る (agent 推定・利用者未確認、根拠 qa-settings-security-web-004)。利用者の識別は `authGuard` の actor から取る (`architecture/settings-auth.md`)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 設定画面の算出 | 画面用の値・照合・優先順位・現金上書きの解決・設定 JSON の検証と差分 | 純関数 (`settingsScreen` は仮称) | packages/core | Worker に同梱 |
| core 現金集計 | 上書き (全期間 / 月指定、空欄は上書きしない) を適用 | `cash.ts` の既存関数を拡張 | packages/core | Worker に同梱 |
| 画面の取得・保存 | 1 本の取得、1 回の保存 (batch・409・履歴・snapshot 無効化) | Hono route | packages/api | Worker |
| 変更履歴 | ルール単位の履歴の取得 | Hono route (読むだけ) | packages/api | Worker |
| 設定 JSON | 出力 (読むだけ)、復元の preview (読むだけ) と本適用 | Hono route | packages/api | Worker |
| バックアップ | 一覧 (状態・メモ・要約)・比較・設定だけの復元の preview と本適用 | Hono route | packages/api | Worker |
| 夜間バックアップ | JST 2:00 の取得・成否と要約の記録・30 日の削除 | `scheduled` (`index.ts`) | packages/api + R2 | Worker cron |

## Cross-cutting contracts

- Identity/access: 更新者は `authGuard` の actor から取り、表示はメールのローカル部 (agent 推定・利用者未確認、根拠 qa-settings-auth-web-004)。復元系は取込の writer lease と同じ直列化を取る (agent 推定・利用者未確認、根拠 qa-settings-auth-web-004)。
- Errors/resilience: 409 (他所の更新)・413 (本文上限)・400 (検証違反。何も書かない) を区別する。本文上限は画面の保存 64KB、復元 256KB、集計ルールは 500 行まで、未知キーは拒否 (agent 推定・利用者未確認、根拠 qa-settings-security-web-004)。
- Observability/audit: 変更履歴に 由来 (画面 / 復元 / 移行) と更新者を残す。夜間バックアップの成否は R2 の customMetadata に残す (agent 推定・利用者未確認、根拠 qa-settings-backend-web-004)。
- Configuration/secrets: `TENANT_ID=default`。cron は `wrangler.jsonc` の 1 行だけを変える (`architecture/settings-infrastructure.md`)。
- Compatibility/versioning: 設定 JSON は `format`・`version` を持ち、旧版は 1 世代まで受ける (agent 推定・利用者未確認、根拠 qa-settings-maintenance-ops-web-004)。既存の `GET/PUT /api/settings`・`/api/settings/owner-labels`・`/api/backups` は残す。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/settings-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/settings-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/settings-database.md`)
- Security: N/A: 本章の関心外 (`architecture/settings-security.md`)

### Backend architecture

#### Runtime and architecture pattern

- Cloudflare Workers (Hono)・D1 (Drizzle)・R2 の既存構成。route は入力の形を確かめて core を呼び、D1 と R2 を読み書きするだけにする。規則は core に置く。

#### Domain and module boundaries

- 集計ルール・名義・統計・現金上書きを 1 つの『設定』の集まりとして扱い、保存の単位にする (DDD の Aggregate)。変更履歴はその保存の結果として追記する。
- core の関数名は `settingsScreen` を仮称とする (agent 推定・利用者未確認、根拠 qa-settings-backend-web-004)。照合キーは NFKC → 大小文字の畳み込み → 前後空白の除去 (agent 推定・利用者未確認、根拠 qa-settings-backend-web-002)。

#### API and service contracts

パス名は次を仮置きとする (agent 推定・利用者未確認、根拠 qa-settings-backend-web-004)。フェンス登録の欄は C4 の規則 (書込みは登録、読むだけは登録しない) から決まる。

| Method / path (仮) | 役割 | フェンス登録 |
|---|---|---|
| GET /api/settings/screen | 画面用の取得 1 本 | しない |
| PUT /api/settings/screen | 全節の保存 (`baseSavedAt` 付き) | する |
| GET /api/settings/history?ruleId= | ルール単位の変更履歴 | しない |
| GET /api/settings/export | 設定 JSON の出力 | しない |
| POST /api/settings/restore/preview | 設定 JSON の差分プレビュー | しない (読むだけ) |
| POST /api/settings/restore | 設定 JSON の本適用 | する |
| GET /api/backups | 一覧に状態・メモ・要約を追加 | しない |
| GET /api/backups/:date/compare | 現在の設定との比較 | しない |
| POST /api/backups/:date/restore/preview | 設定だけの差分プレビュー | しない (読むだけ) |
| POST /api/backups/:date/restore | 設定だけの本適用 | する |

- 設定 JSON の形は `{format:'kanjo-settings', version:1, exportedAt, normRules[], ownerLabels, statMinMonths, cashOverrides[]}` (agent 推定・利用者未確認、根拠 qa-settings-backend-web-002)。
- フェンスの consumers には新表と owner_labels を載せ、`JSON_SNAPSHOT_MUTATION_CONSUMERS` にも新表を加える (`architecture/settings-database.md`)。

#### Data and transaction behavior

- 保存は 全節の変更・変更履歴の追記・snapshot の無効化 を 1 つの D1 batch にする。`baseSavedAt` が古ければ 409 で何も書かない。
- `recomputeFromDeals` は勘定科目のルールが変わった保存のときだけ走らせる (agent 推定・利用者未確認、根拠 qa-settings-backend-web-002)。取引先ルールは集計時に効くので再計算を要さない。
- 取込時の正規化は新表の勘定科目の行から読む (`architecture/settings-database.md`)。

#### Async processing

- 夜間バックアップは JST 2:00 (UTC 17:00) に動かす。全データを R2 に置き、customMetadata に成否・メモ・要約を持たせ、失敗も一覧に出るように残す。保持 30 日は据え置く (qa-settings-decision-007)。一覧・比較・復元は同期の API で、キューは使わない。

#### Security and resilience

- 復元は preview と本適用に分け、本適用の直前に現在の設定を R2 へ退避する (qa-settings-decision-006)。本適用は同じ検証をもう一度通し、preview の結果を信用しない。
- 書込み 3 本はフェンスの取込中判定に従う。preview と比較はフェンス対象外 (agent 推定・利用者未確認、根拠 qa-settings-auth-web-004)。
- CSV 出力はセル先頭の `= + - @` を無害化する (`architecture/settings-security.md`)。

#### Operations and verification

API テストで、保存が 1 batch で全部か何も書かないか、409 で何も書かないこと、変更履歴が追記だけであること、復元の検証違反で何も変えないこと、本適用の前に退避があること、バックアップからの復元が取引を変えないこと、書込み 3 本がフェンスに登録され読むだけの API が登録されていないこと、夜間バックアップが成否と要約を残し失敗も一覧に出ることを確かめる。core のテストで照合 (NFKC・大小文字・完全一致)・優先順位・並び順・現金上書き (空欄と 0、全期間と月指定) を確かめる。既存の `nightly-backup.test.ts` と settings の API テストを緑のまま保つ。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-decision-005 | 取引先ルールは集計時の純関数で効かせ、明細を書き換えない | 取込時に明細を書き換える | ルールを直せば過去分にも効き、戻せる | 集計のたびに照合が走る |
| qa-settings-backend-web-003 | 全節の保存・履歴の追記・snapshot 無効化を 1 つの D1 batch にし、古い `baseSavedAt` は 409 | 節ごとの保存 | 半端な保存が残らず、他画面との競合を検出できる | 保存の本文が大きくなる |
| qa-settings-decision-006, 010 | 復元は preview と本適用に分け、本適用の前に R2 へ退避。バックアップからも設定だけを同じ経路で戻す | 全データを戻す / preview 無し | 取引が消えず、戻した後でも戻し直せる | 退避の R2 オブジェクトが増える |
| qa-settings-decision-007 | 夜間バックアップを JST 2:00 にし、成否・メモ・要約を customMetadata に持たせる | 別表に記録 | D1 の表を増やさずに一覧が作れる | メタデータの上限に要約を収める必要がある |
| qa-settings-backend-web-004 | 新しい API を足し、既存 API を残す (agent 推定・利用者未確認) | 既存 `PUT /api/settings` を拡張 | 既存の取込・画面を壊さない | 旧 API と新 API が同じ設定を書きうる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Worker と cron。migration を先に当ててから Worker を出す (`architecture/settings-database.md`)。
- Migration sequence: core の照合・現金上書き・設定 JSON → 画面の取得と保存 (batch・409・履歴) → フェンス登録 → 設定 JSON の出力と復元 → バックアップの一覧・比較・復元 → 夜間バックアップの時刻と記録。
- Rollback trigger/procedure: API テストか本番の保存で不具合が出たら Worker を直前版へ戻す。migration は追加のみなので、旧 Worker は新表を読まずに動く。復元で壊した設定は R2 の退避から戻す。

## Risks and verification

- Risk/assumption: 旧 `PUT /api/settings` が account_norm_map を書き続けると、新表と正本が 2 つになる。旧経路を新表へ向けるか止めるかを `specs/spec-settings-screen.md` で決める。
- Risk/assumption: R2 のキーは UTC の日付で、JST 2:00 の実行では JST の日付と 1 日ずれる。キーと表示の日付の基準を決める (`architecture/settings-infrastructure.md`)。
- Risk/assumption: 差分プレビューは POST だが読むだけなのでフェンスに登録しない。登録すると取込中に preview ができなくなる。
- Architecture fitness test: core が api・web を import しないこと。書込み API がすべて `CANONICAL_MUTATION_ROUTES` にあり、読むだけの API が無いこと。取引先ルールの処理が明細の表を書かないこと。
- Load/failure/security validation: 集計ルール 500 行での保存と集計の時間、本文上限超過の 413、batch の途中失敗で何も残らないこと、退避の失敗で本適用しないこと。
