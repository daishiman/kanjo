---
graph_node_id: "arch-settings-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "設定 — 集計ルール・現金上書き・変更履歴を利用者単位の新表に追加のみで置き 既存行は写しの元として読むだけにする"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["settings", "database"]
file_path: "architecture/settings-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0f71b39eb0d4aef2864a0fb9b5ba913b68a72fb2d69bd08ef7a7792ef470f78f"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "0f71b39eb0d4aef2864a0fb9b5ba913b68a72fb2d69bd08ef7a7792ef470f78f", "imported_at": "2026-09-22T10:13:43Z"}
created_at: "2026-09-22T10:13:43Z"
updated_at: "2026-09-22T10:13:43Z"
depends_on: ["spec-settings-screen"]
related_nodes: ["arch-settings-ui-ux", "arch-settings-frontend", "arch-settings-backend", "arch-settings-security", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-auth"]
resource_scope: ["migrations/", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/src/import-active.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-pipeline.ts", "packages/api/src/index.ts", "packages/core/src/types.ts", "packages/core/src/dataset.ts", "packages/core/src/fingerprint.ts", "packages/core/src/period.ts", "docs/data-schema.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/settings-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-22T10:13:43Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

設定 — 集計ルール・現金上書き・変更履歴を利用者単位の新表に追加のみで置き 既存行は写しの元として読むだけにする。`system-spec/database.md` は承認時入力、本書は D1 の表・migration・バックアップと snapshot への編入の制約を持つ。API の書込みは `architecture/settings-backend.md`、逐語の正本は `specs/spec-settings-screen.md` (作成予定)。

## Context and drivers

- Business/technical context: `migrations/0000_init.sql` の `account_norm_map (user_id, raw, norm, PRIMARY KEY(user_id, raw))` は勘定科目の表記だけを持ち、種別・並び順・更新者を持たない。`cash_overrides (user_id, month, revenue, expense, PRIMARY KEY(user_id, month))` は月ごとの値だけで、空欄と 0 を区別せず、全期間・メモを持たない。core の `cashOverride` は `Record<string,{revenue,expense}>` で `dataset.ts`・`fingerprint.ts`・`period.ts` が扱う。最新の migration は `0050_budget_plans.sql` で、`schema-guard.ts` の `EXPECTED_D1_MIGRATION` がそれを指す。夜間バックアップの `loadBackupPayload` は owner_labels を含まない (qa-settings-database-web-evidence-001)。
- Quality attribute priorities: G2・G3・G5 に資する。新表の主キーの先頭を利用者にする。既存の account_norm_map と cash_overrides は写しの元として読むだけで行を消さない。`d1_migrations` で二重適用を防ぎ、途中で止まっても Deploy の再実行で収束させる。
- Constraints: migration は 0051 から追加のみ・既存行の書換 0 件 (C3)。`TENANT_ID=default`。変更履歴は追記のみ (qa-settings-decision-008)。

## Goals and non-goals

- Goals:
  - G2: 集計ルールを 種別 (勘定科目 / 取引先)・元の表記・正規化後のカテゴリ・並び順・更新者・最終更新で持つ (qa-settings-decision-001, 005)。
  - G3: 変更履歴を追記のみで持ち、『元に戻す』の直前の保存値を引けるようにする。移行や復元で入った値の更新者は『システム』(qa-settings-decision-008)。
  - G5: 現金上書きを 支払い・受け取り × 上書き値 (空欄と 0 を区別)・適用範囲 (全期間 / 月指定)・メモ で持ち、既存の月ごとの値は『月指定』として引き継ぐ (qa-settings-decision-003)。統計の最小月数は既定 6・範囲 3〜24 (qa-settings-decision-009)。
- Non-goals:
  - 既存の account_norm_map・cash_overrides の行の書換・削除
  - 明細の表への取引先ルールの書込み
  - 変更履歴の自動削除

## System context and boundaries

- Users/external systems: API (保存・取得・復元・取込時の正規化)、夜間バックアップ、snapshot と指紋の算出。
- Trust/deployment/data boundaries: D1 が正本。R2 のバックアップと退避は写し。すべての行は利用者 ID で閉じ、`TENANT_ID=default`。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

表名と列は仮称とする (agent 推定・利用者未確認、根拠 qa-settings-database-web-004)。

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 集計ルール表 (新設) | 利用者・種別・元の表記・正規化後のカテゴリ・並び順・更新者・最終更新 | Drizzle | D1 | migration |
| 現金上書き表 (新設) | 利用者・区分 (支払い / 受け取り)・適用範囲・月・上書き値 (NULL は空欄)・メモ | Drizzle | D1 | migration |
| 変更履歴表 (新設、追記のみ) | 利用者・対象・変更前後・由来 (画面 / 復元 / 移行)・更新者・時刻 | Drizzle | D1 | migration |
| 既存 account_norm_map・cash_overrides | 写しの元。読むだけ | 既存 | D1 | 既存 |
| owner_labels・統計の設定 | 既存の保存先をそのまま使う | 既存 | D1 | 既存 |
| バックアップの中身 | 全データ + 新表 + owner_labels | `loadBackupPayload` | R2 | Worker cron |

- 3 表とも主キーの先頭を利用者にする (agent 推定・利用者未確認、根拠 qa-settings-database-web-004)。変更履歴に由来の列を持たせる (agent 推定・利用者未確認、根拠 qa-settings-database-web-004)。

## Cross-cutting contracts

- Identity/access: すべての行を利用者 ID で閉じ、読み書きは利用者で絞る。更新者は `authGuard` の actor (`architecture/settings-auth.md`)。
- Errors/resilience: 書込みは 1 つの D1 batch で全部か何も書かない (`architecture/settings-backend.md`)。migration の途中停止は `d1_migrations` と Deploy の再実行で収束させる。
- Observability/audit: 変更履歴が監査の記録になる。追記のみで UPDATE・DELETE をしない。
- Configuration/secrets: N/A: 表に秘密情報を持たない。
- Compatibility/versioning: `EXPECTED_D1_MIGRATION` を最後の新 migration へ上げる。旧 Worker は新表を読まずに動く。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/settings-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/settings-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/settings-infrastructure.md`)
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/settings-security.md`)

### Data architecture

#### Data domains and ownership

- 『設定』の集まり (集計ルール・名義・統計・現金上書き) は利用者が所有し、画面の保存と復元だけが書く。変更履歴はその結果として追記される。
- 取込は集計ルールのうち勘定科目の行だけを読む。取込時の正規化は新表の勘定科目の行から読む (agent 推定・利用者未確認、根拠 qa-settings-database-web-004)。

#### Logical and physical model

- 集計ルールは (利用者, 種別, 照合キー) で一意にし、並び順を整数で持つ。照合キーは core の正規化 (NFKC・大小文字) の結果を保存する (`architecture/settings-backend.md`)。
- 現金上書きの上書き値は NULL を空欄、0 を『0 円で上書き』とする。適用範囲が全期間の行は月を持たない。
- 変更履歴は変更前後の値を JSON 文字列で持つ。
- core の `cashOverride` の型は区分・範囲・空欄を表せる形へ広げ、`dataset.ts`・`fingerprint.ts`・`period.ts` を追従させる。

#### Access and consistency

- 保存は 設定の変更・変更履歴の追記・snapshot の無効化 を 1 つの D1 batch にし、`baseSavedAt` で楽観排他する。
- 新表を `JSON_SNAPSHOT_MUTATION_CONSUMERS` とフェンスの consumers に加え、snapshot と指紋が新表の変更で無効になるようにする。
- 新表を設定 JSON・夜間バックアップ・snapshot の無効化の対象に加え、owner_labels もバックアップに含める (agent 推定・利用者未確認、根拠 qa-settings-database-web-004)。

#### Lifecycle and governance

- 変更履歴は無期限に保持する (agent 推定・利用者未確認、根拠 qa-settings-database-web-002)。
- 夜間バックアップの保持 30 日は据え置く (C5)。復元前の退避は R2 に置く (`architecture/settings-infrastructure.md`)。
- `docs/data-schema.md` に新表と空欄 / 0 の意味を書く。

#### Migration and recovery

- migration は 0051 (集計ルール)・0052 (現金上書き)・0053 (変更履歴) の 3 本か、0051 の 1 本にまとめる (agent 推定・利用者未確認、根拠 qa-settings-database-web-002)。番号は着手時と PR 前に origin/main で確かめる。
- 写しは `INSERT … SELECT` で、account_norm_map を種別『勘定科目』の行へ、cash_overrides を『月指定』の行へ入れ、更新者は『システム』、変更履歴に由来『移行』を追記する。既存の表は読むだけで、行の書換は 0 件。
- 既存 cash_overrides は空欄が 0 に潰れている。0 をそのまま月指定の 0 円として写すと集計を 0 円で上書きするので、0 を空欄として写すかを `specs/spec-settings-screen.md` で決める。
- `EXPECTED_D1_MIGRATION` を最後の新 migration に上げる。

#### Data verification

migration のテストで、新表ができること、既存 2 表の行数と値が前後で変わらないこと、写しの件数が元と一致し更新者が『システム』であること、二重適用しても行が増えないことを確かめる。API テストで、保存が 1 batch で全部か何も書かないこと、変更履歴が追記だけであること、新表の変更で snapshot が無効になり指紋が変わること、バックアップに新表と owner_labels が入ることを確かめる。`schema-guard` のテストで `EXPECTED_D1_MIGRATION` が最新を指すことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-settings-database-web-003 | 新表を追加し、既存 2 表は写しの元として読むだけにする | 既存表に列を足して書き換える | 既存行の書換 0 件で、戻すときに旧表が残る | 旧表と新表が並存する |
| qa-settings-decision-003 | 上書き値の NULL を空欄、0 を 0 円とし、適用範囲を持つ | 0 を空欄扱い | 利用者が 0 円で上書きする意図を表せる | 既存データの 0 の解釈を決める必要がある |
| qa-settings-decision-008 | 変更履歴は追記のみで、由来と更新者を持つ | 最新値だけを持つ | 『元に戻す』と監査が同じ記録で済む | 行が増え続ける |
| qa-settings-database-web-004 | 3 表とも主キーの先頭を利用者にする (agent 推定・利用者未確認) | 代理キーだけ | 利用者で閉じた読み書きが索引で済む | キーが長くなる |
| qa-settings-database-web-002 | migration を 0051〜0053 の 3 本か 0051 の 1 本にする (agent 推定・利用者未確認) | 既存 migration の編集 | 追加のみで `d1_migrations` が二重適用を防ぐ | 本数は spec で確定する |

## Delivery, migration and rollback

- Build/deploy topology: CI の Migrate で D1 に当ててから Worker を Deploy する。
- Migration sequence: 新表の作成 → 既存行の写し (`INSERT … SELECT`、更新者『システム』、履歴に『移行』) → `EXPECTED_D1_MIGRATION` の更新 → 読み書きの切替 → バックアップ・snapshot・指紋・設定 JSON への編入。
- Rollback trigger/procedure: Worker を直前版へ戻せば旧表を読んで動く。新表は残してよい。Deploy が途中で止まったら Migrate と Deploy を再実行して収束させる。

## Risks and verification

- Risk/assumption: 既存 cash_overrides の 0 を写す解釈を誤ると、全月の現金集計が 0 円で上書きされる。
- Risk/assumption: 旧 `PUT /api/settings` が account_norm_map を書き続けると新表との二重の正本になる (`architecture/settings-backend.md`)。
- Risk/assumption: 長い作業の間に main 側で migration 番号が進むと番号が衝突する。着手時と PR 前に確かめる。
- Architecture fitness test: 新 migration に既存表への UPDATE・DELETE・DROP が無いこと。変更履歴表への UPDATE・DELETE が無いこと。新表の全クエリが利用者で絞られていること。
- Load/failure/security validation: 集計ルール 500 行と履歴の累積での取得時間、batch の途中失敗で何も残らないこと、別利用者の行が読めないこと。
