---
graph_node_id: "arch-subscriptions-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "サブスク画面 — migration 0043 で category と見直し判断だけを足す"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "database"]
file_path: "architecture/subscriptions-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a134f80aef224140a8f2e00afd7b0a78840fd535a82953fb4bce53bb90648132"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "a134f80aef224140a8f2e00afd7b0a78840fd535a82953fb4bce53bb90648132", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["packages/api/src/db/schema.ts", "migrations", "packages/api/src/store.ts", "packages/api/src/routes/subs.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G4", "G5"]
---
# Architecture overview

サブスク画面 — migration 0043 で category と見直し判断だけを足す。`system-spec/database.md` は承認時入力、本書は data 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: `packages/api/src/db/schema.ts:221-233` の `sub_vendors` (0005 作成、0020 で accounts、0023 で reviewed_at を追加) は名前・別名 (JSON 配列文字列)・対象科目 (JSON 配列文字列)・並び順・最後に見直した日時を持ち、カテゴリの列は無い。`:236-247` の `sub_vendor_exclusions` (0021) は候補から外した支払先を `(user_id, vendor_key)` の一意索引つきで持つ。読み出しは `packages/api/src/store.ts` の `loadSubVendors` (:1334) / `loadSubVendorExclusions` (:1355)、登録の変更後は `recomputeFromDeals` (:1669) で集計を作り直す。口座名は `mf_transactions.institution` にある。最新の migration は `migrations/0042_total_cashflow_operations_and_exclusion_reason.sql`。画面が新たに要る保存は、カテゴリの上書きと、登録済みベンダーの見直し判断の 2 つだけである。
- Quality attribute priorities: G4・G5 に資する。Clean Architecture の gateways/repositories boundary (core は保存形式を知らない)、Google SRE の『変更を小さく可逆に保つ』を適用する。
- Constraints: Cloudflare D1 + Drizzle。migration は加法的にし、既存行を書き換えない。口座種別は保存せず、読むたびに口座名から分類する。

## Goals and non-goals

- Goals:
  - G4: 画面の数値を既存明細・既存の登録と除外・新しい 2 つの保存だけから導出できるようにする (spec §13, §14)。
  - G5: 名称の統合・候補の採用 / 除外は既存表を再利用し、category と見直し判断だけを migration 0043 で足す。
- Non-goals:
  - 口座種別・推定月額・候補の結果の保存 (すべて読むたびに算出する)
  - 既存行の書き換え・既存列の型変更
  - 統合の履歴表 (統合の取消は aliases からの削除で表す)

## System context and boundaries

- Users/external systems: D1 のみ。外部ストレージを増やさない。
- Trust/deployment/data boundaries: 読み書きは全て `userId` で絞る (`architecture/subscriptions-auth.md`)。core の集計関数は D1 を知らない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| sub_vendors (既存 + `category TEXT NULL`) | 登録ベンダー・別名 (統合の保存先)・対象科目・見直し日時・カテゴリの上書き | Drizzle `subVendors` | packages/api | D1 |
| sub_vendor_exclusions (既存) | 未登録候補の除外 | Drizzle `subVendorExclusions` | packages/api | D1 |
| sub_vendor_review_decisions (新設) | 登録済みベンダーの見直し判断 (id, user_id, vendor_key, decision, rule_fingerprint, decided_at)、`(user_id, vendor_key)` 一意 | Drizzle (schema.ts に追加) | packages/api | D1 |
| migrations/0043 | 上記 2 つの加法的変更 | SQL | migrations | D1 Migrate |
| store の読み出し | userId で絞った登録・除外・判断の読み出し | 関数 | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 全ての読み書きの条件に `c.get('userId')` を含める。`:id` / `vendor_key` は userId と組で引く。
- Errors/resilience: 見直し判断は `(user_id, vendor_key)` で upsert し、二度押しで行を増やさない。取消は該当行の削除。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 接続情報は既存 binding のまま。
- Compatibility/versioning: category は NULL 許容で既定値を持たず、既存行は NULL のまま (辞書が当たる)。schema.ts を migration と同じ内容に更新する。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/subscriptions-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/subscriptions-security.md`)

### Data architecture

#### Storage model and ownership

名称の統合 = 既存ベンダーの `aliases` へ追加、未登録候補の採用 = `sub_vendors` への登録、除外 = `sub_vendor_exclusions`、カテゴリの上書き = `sub_vendors.category`、登録済みベンダーの見直し判断 = `sub_vendor_review_decisions` (dec-subs-persistence)。判断は confirmed / dismissed の 2 値だけで、adopted を持たない。`rule_fingerprint` には当たった規則の種類すべて (表示順) + 判定時の基準金額を入れ、月は含めない (qa-subs-review-decision-002)。

#### Read path

GET /api/subscriptions は既存の明細・登録・除外に加え、判断表を userId で 1 回読む。dismissed の判断は指紋が一致する候補を隠すためだけに使い、指紋が変わった候補は再び未判断として返す。詳細 (GET /api/subscriptions/vendors/:key) の取引履歴は上限つきで返す。

#### Aggregation inputs

口座の 3 分類は保存せず、`mf_transactions.institution` の口座名から読むたびに分類する。推定月額・継続中・候補の結果も保存しない (入力が変われば結果も変わる導出値のため)。

#### Data verification

migration 適用後、GET /api/subscriptions の応答に category と reviewCount が含まれることを確かめる。既存行の件数と値が適用前後で変わらないこと。判断の upsert が二重行を作らないこと。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-subs-persistence | 既存表を再利用し、category (ADD COLUMN) と判断表 (CREATE TABLE) だけを 0043 で足す | サブスク専用の新表群 | 既存の照合 (`matchSubVendor`) と候補除外がそのまま保存先になる | 統合の取消は aliases からの削除で表し、履歴は持たない |
| qa-subs-review-decision-002 | 判断は confirmed / dismissed の 2 値、`(user_id, vendor_key)` 一意で upsert、指紋に月を含めない | adopted を含む 3 値 / 月ごとの行 | 1 ベンダー 1 判断で足り、同じ理由の再提示を防げる | 最後の判断だけが残る |
| dec-subs-category | 利用者の上書きを `sub_vendors.category` (NULL = 辞書に従う) に保存 | 別表 | 登録ベンダーに 1 対 1 で付く値なので列で足りる | 未登録候補のカテゴリは保存できず辞書だけで決まる |
| dec-subs-coverage | 口座種別を保存しない | 口座ごとの種別表 | 口座名から毎回導出でき、保存すると取込のたびに同期が要る | 分類できない口座は別に数える |
| dec-subs-kpi-definition / dec-subs-review-candidate | 推定月額・候補の結果を保存しない | 結果のキャッシュ表 | 導出値を保存すると入力との食い違いが生まれる | 毎回の計算量はベンダー数 × 月数 |
| dec-subs-legacy-ui / dec-subs-fixture-authority | 旧 UI の保存 (別名・対象科目・reviewed_at・除外) をそのまま使い、fixture は保存を介さず core に渡す | 旧 UI 用の列を整理する | 旧機能を失わない | 既存列は残す |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker + D1。binding の追加なし。
- Migration sequence: `migrations/0043_*.sql` で `ALTER TABLE sub_vendors ADD COLUMN category TEXT` と `CREATE TABLE sub_vendor_review_decisions` (一意索引 `(user_id, vendor_key)`) → schema.ts を同じ内容に更新 → Migrate → Deploy の順。適用後の確認は GET の応答に category と reviewCount が含まれること。
- Improvement (既存実装の是正): 候補除外の重複検査は全件を読んで `vendorKey(e.partner)` を比べている (`packages/api/src/routes/subs.ts:191-193`)。保存済みの `vendor_key` 列と一意索引に任せる形 (挿入の競合を ok として扱う) にすると、読み出しが消え同時要求でも 500 にならない。判断表も同じ upsert の形にする。
- Rollback trigger/procedure: migration は加法的なので、実装を差し戻せば旧画面は新しい列と表を無視して動く。列と表の削除は行わない。
- Backup/restore (P10 で追加): `category`・`reviewed_at` と `sub_vendor_review_decisions` を canonical backup の snapshot と復元の write-set・lease 対象 (`import-active.ts`) に加える。キーの無い旧 JSON は復元先の値を保ち、空配列は「判断なし」として置き換える。
- 判断の追従 (P10 で追加): 判断は `vendor_key` に付くので、名前の変更 (PUT) で同じ batch の中で付け替え、登録の解除 (DELETE) で消す。

## Risks and verification

- Risk/assumption: Migrate より先に Deploy すると、新しい列と表を読む API が失敗する。手順を Migrate → Deploy に固定する。
- Risk/assumption: 名前の同名チェックはアプリ側で行っており (`subs.ts:93-96`)、`sub_vendors` には `(user_id, name)` の一意制約が無い。本サイクルの確定範囲では制約を足さず、統合 API も同じアプリ側の検査に従う。
- Architecture fitness test: 0043 に既存行を書き換える文 (UPDATE / DELETE) が無いこと。schema.ts と 0043 の列定義が一致すること。
- Load/failure/security validation: 読み書きが `userId` で絞られていること。判断の upsert が二重行を作らないこと。
