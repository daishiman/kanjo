---
graph_node_id: "arch-classify-bulk-save-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "明細仕分け一括保存 — 勘定科目の対応表の表を 1 つ足し、設定の変更履歴を承認つきで作り直し、一括保存を 1 回の batch で全件か無しに書くデータ設計"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "bulk-save", "database"]
file_path: "architecture/classify-bulk-save-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "12f08e168e97d84b37f27da2d8379f5e1d60a5431857d5c7688360f5d107d623"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.16", "source_digest": "12f08e168e97d84b37f27da2d8379f5e1d60a5431857d5c7688360f5d107d623", "imported_at": "2026-10-01T12:13:05Z"}
created_at: "2026-10-01T12:13:05Z"
updated_at: "2026-10-01T12:13:05Z"
depends_on: ["spec-classify-bulk-save"]
related_nodes: ["arch-classify-bulk-save-ui-ux", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-auth", "arch-classify-bulk-save-security", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops"]
resource_scope: ["migrations", ".github/migration-approvals.json", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/store.ts", "packages/api/src/classify-history.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/tx-edit-codec.ts", "packages/api/src/routes/admin-users.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/settings-screen.ts", "packages/api/src/routes/backups.ts", "scripts/seed-admin.mjs", "packages/core/src/categories.ts", "packages/core/src/settings-json.ts", "packages/core/src/classify.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/classify-bulk-save-database.md", "confidence": 1.0}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-10-01T12:13:05Z"}
serves_goals: ["G1", "G3", "G5"]
---
# Architecture overview

明細仕分け一括保存 — 勘定科目の対応表の表を 1 つ足し、設定の変更履歴を承認つきで作り直し、一括保存を json_each で束ねた 1 回の batch で書く。本書はデータの制約を持つ。契約の正本は `specs/spec-classify-bulk-save.md` (以下 spec) の「データモデル」で、`system-spec/database.md` (以下 database 章) と `system-spec/00-requirements-definition.md` (以下 00) は承認時の入力である。API と処理の流れは `architecture/classify-bulk-save-backend.md` (以下 backend 本書) が持ち、配信の順と承認のゲートの運用は `architecture/classify-bulk-save-infrastructure.md` (以下 infrastructure 本書) が持つ。本書はそれらを名指して参照するだけにする。行番号は 2026-10-01 に HEAD a63d35c で確かめた値。database 章の主な根拠は qa-classify-bulk-decision-070 で、章の中に残る旧い文言 (表・列・migration を足さないとした回答) は、同じ章の訂正 (qa-classify-bulk-database-web-003 の訂正) と 00 C2 で置き換わっている。本書は置き換わった後の文面だけを契約として書く。

## Context and drivers

- 元の指摘は、選択した項目の読み込みと取引一覧の取引設定がうまくできないこと。データの側では次の 4 つが動く。
  1. 取込直後の明細の多くに提案を付けるため、MF の大項目から勘定科目を引く対応表を、利用者が編集して持ち続ける状態として足す (根拠: 00 G2・I8 / database.md §本章での適用 / qa-classify-bulk-decision-049)。
  2. 一括保存の 1 要求を、無料プランの 1 起動の上限の中で、全件か無しで書く (根拠: 00 C4・O8 / qa-classify-bulk-delegated-001 / qa-classify-bulk-decision-057)。
  3. 区分に合うカテゴリの組が無い明細を『カテゴリなし』で保存し、その状態を列を足さずに持つ (根拠: 00 C2・I9 / qa-classify-bulk-decision-045)。
  4. 保存した明細の値が変わった項目ごとに履歴を残し、送り直しで履歴を増やさない (根拠: 00 G5・O9 / qa-classify-bulk-database-web-003)。
- 品質の優先順位: (1) 整合性 (1 回の batch で全件か無し) → (2) 1 要求のクエリ予算 (49 本以内) → (3) 足すものの少なさ (表 1 つ、既存の表への列 0) → (4) 戻しやすさ (表は残して Worker だけ戻す)。
- 上流指針: data-access は Clean Architecture、reliability は Google SRE (database.md §上流指針)。書き込みの文の組み立ては store と履歴の側の関数に閉じ、route は呼ぶだけにする。

**前サイクルとの関係**: 前のサイクルの `architecture/classify-database.md` (以下 前書) は正本のまま残し、書き換えない。本書は次の点を変える。

1. 前書「Quality attribute priorities」の「migration は追加のみ」と「Risks and verification」の fitness test (UPDATE・DROP を含まない) → 設定の変更履歴の作り直しという破壊的な migration を、既存の承認の仕組みで PR に承認を足して通す (根拠: 00 C2 / database.md §上流指針 reliability / qa-classify-bulk-decision-049)。
2. 前書「Goals and non-goals」の G5 と「Container and component view」(0047 の 1 本で 2 表を作り既存表へ列を足す) → 今回足す表は勘定科目の対応表の 1 つだけで、既存の表に列は足さない (根拠: 00 C2 / qa-classify-bulk-decision-049)。
3. 前書「Access and consistency」の「明細の境界で batch を切る」と、Risks の inClauseChunkSize による分割 → 編集と履歴を json_each で束ね、1 回の batch で全件か無しで書く (根拠: 00 C4 / qa-classify-bulk-database-web-002・qa-classify-bulk-database-web-003 / qa-classify-bulk-delegated-001 / qa-classify-bulk-decision-057)。
4. 前書「Data verification」の「保存 1 件ごとに履歴が増える」→ 値が変わった項目ごとに 1 行、同じ要求の行は同じ op_id、値が変わらない明細は 0 行 (根拠: 00 O9 / qa-classify-bulk-database-web-003)。
5. 前書 Risks の「バックアップの対象が system-spec に無い」→ 対応表をバックアップ・復元と設定の JSON (kanjo-settings の版 2) に含める (根拠: 00 C2・O3)。
6. 前書「Logical and physical model」の tx_edits への列の追加 → 『カテゴリなし』は列を足さず、tx_edits の大項目の欄に予約の値で持つ (根拠: 00 C2 / qa-classify-bulk-decision-045)。

引き継ぐもの: tx_edits と tx_history を正本とし source=bulk を使う形、canonicalMutationFence を通す形、下書きをブラウザに置く形、件数を保存せず毎回導く形、migration を Worker の配信より前に当てる順、着手時に origin/main で migration の番号を確かめる手順。

## Goals and non-goals

- Goals:
  - D1: 勘定科目の対応表を利用者ごとの表として 1 つ足し、同じ大項目は 1 行に限る。初期の 5 行は既存の持ち主 (user_id) に migration で入れ、利用者の作成のたびには入れない。新しい持ち主へ入れる時機は spec の未決事項 7 (根拠: 00 G2・I8・O3 / qa-classify-bulk-decision-049・qa-classify-bulk-decision-050 / spec「API: 勘定科目の対応表」の Validation)。
  - D2: 対応表の変更を設定の変更履歴に残す。そのために変更履歴の種類の制約を表の作り直しで改め、PR で承認する (根拠: 00 C2・I8 / qa-classify-bulk-decision-049)。
  - D3: 一括保存の編集と履歴を json_each で束ね、月次集計の差し替えと同じ 1 回の batch で書く。batch の失敗は保存対象の全件を write_failed にし、途中まで書かれた状態を残さない (根拠: 00 G1・C4・O8 / qa-classify-bulk-delegated-001 / qa-classify-bulk-decision-057)。
  - D4: 一括保存の 1 要求で D1 へ出すクエリを、batch の中の文も 1 本ずつ数えて 49 本以内にする予算を、データの側の文の数で守る (根拠: 00 C4・O8 / qa-classify-bulk-decision-033)。
  - D5: 『カテゴリなし』を tx_edits の大項目の欄に予約の値で持ち、履歴・集計・バックアップを今の列のまま通す (根拠: 00 C2・I9 / qa-classify-bulk-decision-045)。
  - D6: 設定の JSON の版を 2 にし、版 1 の JSON と対応表を持たない旧いバックアップは初期の 5 行として読む (根拠: 00 C2・O3)。
- Non-goals:
  - 『カテゴリなし』のための表と列。tx_edits・tx_history・category_options への列の追加 (00 C2)。
  - 下書き・選択・一括指定の値・保存前の内訳の永続化 (画面と要求の都合なので D1 に持たない。database.md §本章での適用)。
  - 提案と件数の保存 (毎回 core で導く)。
  - 対応表の中項目、税務の判断 (00 C4)。
  - 適用済みの migration (0000〜0057) の書き換え。Workers Paid への移行。

## System context and boundaries

| 表 | 書く経路 | 読む経路 | 本書の持ち分 |
|---|---|---|---|
| tx_edits | 一括保存・個別編集・復元 | 一覧・選択の読み出し・集計・バックアップ | 束ねた書き方、予約の値 |
| tx_history | 一括保存・個別編集 | 変更履歴の表示 | 項目ごとの行と op_id |
| monthly_agg | 一括保存の batch の中で差し替え | 総収支・家計の集計 | 予約の値を scope に出さない |
| import_active_targets | 正本を変える書き込みで指し先を消す | JSON 復元 | write-set に対応表を加える |
| 勘定科目の対応表 (新設) | migration・対応表の API・復元 | 提案・設定画面・設定の JSON・バックアップ | 表・制約・初期の 5 行 |
| settings_change_log | 設定画面・対応表の API・復元・migration | 設定画面の revision と履歴 | 種類の制約の作り直し |

- 境界の外: API の Request・Response・エラーの形と、読み込みから batch までの流れは backend 本書。認可と存在を明かさない扱いは `architecture/classify-bulk-save-security.md` と `architecture/classify-bulk-save-auth.md`。Deploy の手順と承認のゲートの運用は infrastructure 本書。
- 利用者の境界: 業務データの行は TENANT_ID='default' をキーに持ち (`packages/api/src/auth.ts:36`、`:257`・`:276` で `c.set('userId', TENANT_ID)`)、users.id は業務データのキーではない。対応表もこの同じキー (以下 テナントのキー) を user_id に持ち、読み出し・追加・削除はどれも user_id を条件に含める (根拠: database.md §上流指針 data-access / 00 G5)。

## Container and component view

- D1 (kanjo-db): migration はリポジトリ直下の `migrations/` に置き、wrangler は `packages/api/wrangler.jsonc` の migrations_dir (`../../migrations`) から当てる。適用済みの最新は `migrations/0057_improvement_request_screen.sql`。
- Drizzle の定義 (`packages/api/src/db/schema.ts`): 対応表の定義を足し、settingsChangeLog (:410-430) の target の enum (:416-418) に対応表の種類を足す。txEdits (:105-136) と txHistory (:1111-1127) は変えない。
- 書き込みの部品 (api):
  - `packages/api/src/store.ts`: 一括版の編集の文 (今の editWriteQueries :278-300 を json_each で束ねたもの)、aggregateReplacementQueries (:1937-1952)、loadBackupPayload (:1595-1630) への対応表の追加。
  - `packages/api/src/classify-history.ts`: 一括版の履歴の文 (今の historyWriteQueries :128-145 を束ねたもの)。
  - `packages/api/src/import-lifecycle.ts`: settingsChangeLogStatements (:649-667) を対応表の変更でも使う。
  - `packages/api/src/import-active.ts`: JSON_SNAPSHOT_MUTATION_CONSUMERS (:10-40) に対応表を加え、invalidateJsonSnapshotQuery (:59-) の consumer として渡せるようにする。
  - `packages/api/src/schema-guard.ts:4`: EXPECTED_D1_MIGRATION を 2 本目の migration の名前に上げる。
- 定数と変換 (core): `packages/core/src/categories.ts` に『カテゴリなし』の予約の値と初期の 5 行の定数、`packages/core/src/settings-json.ts` に版 2 と版 1 からの移行を置く。
- 変えないもの: 利用者の作成の 2 経路 (`scripts/seed-admin.mjs:101-104` の最初の管理者、`packages/api/src/routes/admin-users.ts:80-95` の招待)。どちらも users に行を足すだけで、業務データの持ち主を新しく作らない (spec「API: 勘定科目の対応表」の Validation)。

## Cross-cutting contracts

- クエリの予算: 一括保存の 1 要求は、読み込み・lease・batch の中の文をすべて数えて 49 本以内。1 回の batch の文は 50 以下。1 文の bound parameter は 100 以下 (`packages/api/src/d1-limits.ts:11`)。json_each に渡す JSON は D1_JSON_BIND_SAFE_BYTES (`packages/api/src/store.ts:1789`) 以下で、超えると d1JsonPayload (:1799) が書く前に throw する (:1802)。予算の名前と置き場所は backend 本書 (根拠: 00 C4・O8)。
- 原子性: D1 の batch は 1 つのトランザクションで、どれかの文が失敗すると batch 全体が巻き戻る (cloudflare-d1-batch 2026-06-22)。一括保存と対応表の変更は、正本の変更・履歴・派生の差し替え・JSON 復元の指し先の無効化を同じ batch に置く (根拠: database.md §上流指針 reliability)。
- フェンス: 一括保存は `packages/api/src/canonical-mutation-fence.ts:152` の consumers ['tx_edits','tx_history'] で通る。取込の lease (acquireImportWriter、同 :282) が取れなければ 409 で、書き込まない。対応表を書く経路の consumers には対応表と settings_change_log を持たせる (経路名は backend 本書)。
- 予約の値: 『カテゴリなし』の字面は core の 1 か所で定め、SQL・api・web はそこから引く。一括指定と編集の値としては受け付けず、同じ名前のカテゴリの候補は作れない (根拠: 00 I9・G5 / qa-classify-bulk-decision-045)。字面そのものは実装時に決める (00 U2 が委ねる。spec「未決事項」で閉じ方を持つ)。
- 2 つの履歴: 明細の値の変化は tx_history、設定 (対応表を含む) の変化は settings_change_log。どちらも保持は無期限で、行を消さない。

## Subtype architecture

- Frontend: N/A: 画面の状態と表示は `architecture/classify-bulk-save-frontend.md` が持つ。本書は画面が D1 に何も持たないことだけを決める。
- Backend: N/A: API と処理の流れは backend 本書が持つ。本書は書く文の形と順の制約だけを持つ。
- Infrastructure: N/A: Deploy の手順・Time Travel・承認のゲートの運用は infrastructure 本書が持つ。本書は migration の中身と承認に載せる値を持つ。
- Security: N/A: 認可と存在を明かさない扱いは security 本書と auth 本書が持つ。本書はすべての読み書きが user_id を条件に含めることだけを決める。

### Data architecture

#### Data domains and ownership

| 領域 | 表 | 正本の持ち主 | 本サイクルの変化 |
|---|---|---|---|
| 明細の編集 | tx_edits | 一括保存・個別編集 (api) | 書き方を json_each に束ねる。大項目の欄に予約の値が入る |
| 明細の変更履歴 | tx_history | 同上 | 値が変わった項目ごとに 1 行、同じ要求は同じ op_id |
| 月次集計 (派生) | monthly_agg | 正本から再計算できる | 一括保存の batch の中で差し替える (今と同じ) |
| JSON 復元の指し先 | import_active_targets | 取込と復元 | 対応表の変更でも消す |
| 勘定科目の対応表 | 新設 | 利用者 (対応表の API) | 表を作り、初期の 5 行を入れる |
| 設定の変更履歴 | settings_change_log | 設定の書き込み | 種類の制約を作り直す |
| カテゴリの候補 | category_options | 設定画面 | 表は変えない。予約の値と同じ名前を API が拒む (backend 本書) |

- D1 に持たないもの: 下書き (ブラウザ)、選択 (URL の sel)、一括指定の値、保存前の内訳、提案、保存した件数 (根拠: database.md §本章での適用 / 00 C2)。
- 対応表は利用者が決めて持ち続ける状態なので、取込のたびに作り直さない。取込の全置換 (mf_transactions の入れ替え) は対応表に触れない。

#### Logical and physical model

- 勘定科目の対応表 (新設。表と列の名前は実装時に決める (章 §確定内容 が委ねる。spec「データモデル」と同じ)):

| 論理の列 | 型 | 制約 | 根拠 |
|---|---|---|---|
| user_id | TEXT | NOT NULL。テナントのキー | 00 G5 |
| MF の大項目 | TEXT | NOT NULL | 00 G2 |
| 対応先の勘定科目 | TEXT | NOT NULL | 00 G2 |
| 更新時刻 | TEXT | NOT NULL (ISO 8601) | settings_norm_rules (`migrations/0054_settings_norm_rules.sql`) の前例に倣う案 (00 U2) |
| 更新者 | TEXT | NOT NULL | 同上 |

  - PRIMARY KEY は (user_id, MF の大項目)。同じ大項目の 2 行目を API が 400 にし (00 G5)、PK はそれをすり抜けた書き込みを止める最後の砦になる (根拠: qa-classify-bulk-decision-049)。
  - 外部キーと対応先の CHECK は置かない。勘定科目の一覧は利用者が編集する動的な集合なので、一覧に無い対応先は API が core の buildCandidates (`packages/core/src/categories.ts:85`) で 400 にする (00 G5)。
  - 中項目の列は持たない。科目を 1 つに決められる大項目だけを対応づける (根拠: 00 G2 / qa-classify-bulk-decision-050)。
- 初期の 5 行 (00 G2 の字面どおり。同じ大項目は 1 行、残りの 14 の大項目には行を入れない):

| MF の大項目 | 対応先の勘定科目 |
|---|---|
| 通信費 | 通信費 |
| 水道・光熱費 | 水道光熱費 |
| 交通費 | 旅費交通費 |
| 交際費 | 接待交際費 |
| 日用品 | 消耗品費 |

  - この 5 行の字面は、対応表の migration と core の定数の 2 か所に出る。2 か所の一致をテストで固定する。
- settings_change_log (作り直し): target の CHECK (`migrations/0056_settings_change_log.sql:10`、今は 'norm_rule'・'owner_label'・'stat_min_months'・'cash_override') に対応表の種類を 1 つ足す。種類の名前は実装時に決める。origin の CHECK ('screen'・'restore'・'migration')、PRIMARY KEY (user_id, seq)、索引 settings_change_log_target (user_id, target, target_key, seq) は変えない。対応表の行の履歴は target_key に MF の大項目を、before と after に対応先の値の JSON 文字列を入れ、作成は before が NULL、削除は after が NULL (0056 冒頭の規則と同じ)。
- tx_edits (変えない): 『カテゴリなし』は category_major (`packages/api/src/db/schema.ts:109`) に予約の値で入り、中項目 (category_mid) は空にする。列にも CHECK を足さない。検査は api の入口 (一括指定と編集の値は 400) と core が持つ (根拠: 00 C2・G5 / qa-classify-bulk-decision-045)。
- tx_history (変えない): field と source の enum (schema.ts:1111-1127) はそのまま。予約の値は before_value・after_value に表示値 (categoryText、`packages/api/src/classify-history.ts:46-50`) として入る。表示値どうしを比べる (historyEntries、同 :56) ので、送り直しでも差が出ず履歴が増えない (00 O9)。
- monthly_agg (変えない): 予約の値を scope に出さない。core が集計で大項目を未分類へ寄せる箇所 (`packages/core/src/classify.ts:414` の `r.big || '未分類'`) で予約の値も未分類に寄せる (根拠: 00 I9)。

#### Access and consistency

- 一括保存の書き込み: backend 本書が組む 1 回の batch に、データの側は次の文を出す。
  1. tx_edits の削除 (保存対象の txId の配列を json_each で 1 文に)。
  2. tx_edits の挿入 (空でない編集だけを json_each で 1 文に。空の編集は今の editIsEmpty (`packages/api/src/store.ts:271`) と同じく挿入しない)。
  3. tx_history の挿入 (値が変わった項目の行を json_each で 1 文に。変わった項目が無ければ文を出さない)。
  4. JSON 復元の指し先の無効化 (invalidateJsonSnapshotQuery(…, 'tx_edits')、今と同じ)。
  5. 月次集計の差し替え (aggregateReplacementQueries の削除と json_each の挿入の 2 文、今と同じ)。
  - 文の数は明細数で増えず、1 回の batch はおよそ 6 文、1 要求の合計はおよそ 25 本になる (根拠: qa-classify-bulk-delegated-001 / qa-classify-bulk-decision-033)。文の正確な並びと本数は実装時に決める (backend 本書と同じ)。
  - json_each に渡すのは 1 文に 1 つの JSON なので、bound parameter の上限 100 に当たらない。束ねた JSON が上限を超える要求は、書く前に分かるので batch を出さない (413 の形は backend 本書)。
- 同じ行を作ること: 束ねた版は、今の明細ごとの editWriteQueries と historyWriteQueries の並びと同じ行を作る。履歴の id は今の形 `${opId}:${txId}:${field}:${i}` (`packages/api/src/classify-history.ts:138`) を保ち、changed_at は要求で 1 つの時刻にする。同じ入力で両方の版を当て、表の中身が同じことをテストで確かめる。
- 全件か無し: batch がトランザクションとして巻き戻るので、失敗すると保存対象の全件が書かれていない状態に戻る。要求は 2xx で返り、全件が write_failed になる (根拠: 00 O8 / qa-classify-bulk-decision-057)。今の chunkByItem による明細ごとの部分成功 (`packages/api/src/routes/classify-bulk.ts:177`・`:195-203`) は使わない。
- 送り直し (00 O9): 2 回目の要求では、引き直した今の値と解決した値が同じなので、履歴の行は 0 になる。tx_edits は削除と挿入で同じ値に戻り (更新時刻だけが変わる)、月次集計は同じ正本から同じ行になる。
- 対応表の書き込み: 1 回の batch に、対応表の挿入か削除、settings_change_log の挿入 (今の settingsChangeLogStatements と同じく seq は `(SELECT ifnull(MAX(seq),0) FROM settings_change_log WHERE user_id=?)` に行の番号を足す。`packages/api/src/import-lifecycle.ts:649-667`)、JSON 復元の指し先の無効化を置く。変更履歴が増えると設定画面の revision (settingsRevision、`packages/api/src/routes/settings-screen.ts:204`) が進み、古い revision からの設定の保存は 409 になる (同 :515・:629)。
- 読み出し: 提案のために対応表を 1 要求につき 1 回だけ読む (user_id で絞った全行。同じ大項目は 1 行なので最大でも大項目の数)。この 1 本も予算に数える。

#### Lifecycle and governance

- 対応表の一生:
  - 作成: 既存の持ち主には対応表の migration で初期の 5 行を入れる (根拠: 00 O3 / qa-classify-bulk-decision-050)。利用者の作成のたびに `TENANT_ID` へ入れ直すことはしない。INSERT OR IGNORE でも、利用者が消した行は表に無いので入れ直されて戻り、追加・削除の契約 (spec AC-16) を破るからである (spec「API: 勘定科目の対応表」の Validation)。新しい持ち主へ入れる時機は spec の未決事項 7 が持つ。
  - 変更: 対応表の API だけが書き、毎回 settings_change_log に残す (00 G5)。
  - 削除: 行の削除は API から。利用者の削除で対応表は消さない (行のキーはテナントのキーで、users.id ではない)。全削除の対象 (`packages/api/src/deletion-full-reset.ts:11` の FULL_RESET_TABLES) には入れず、他の設定の表と同じ扱いにする。
- 設定の JSON: `packages/core/src/settings-json.ts:15` の版を 1 から 2 に上げ、対応表を加える。SETTINGS_JSON_MIGRATIONS (同 :60-66、今は空) に版 1 からの移行を足し、版 1 の JSON は初期の 5 行を補って読む。受けるのは今の版と 1 世代前だけで、範囲の外は unsupported_settings_version (同 :100-101) のまま (根拠: 00 C2・O3)。
- バックアップ・復元: loadBackupPayload (`packages/api/src/store.ts:1595-1630`) に対応表を加える。対応表を持たない旧いバックアップは、今の規則どおり読み込んで初期の 5 行にする。復元で対応表を書いたら、変更履歴に origin='restore' で残す (根拠: 00 C2)。
- JSON 復元の write-set: 対応表を JSON_SNAPSHOT_MUTATION_CONSUMERS (`packages/api/src/import-active.ts:10-40`) に加える。復元で設定と変更履歴を一緒に戻す今の規則 (settings_norm_rules と settings_change_log が並ぶ) に対応表も入れる。SETTINGS_SCREEN_CONSUMERS (`packages/api/src/canonical-mutation-fence.ts:38-44`) に入れるかは、対応表の経路を設定画面の保存に入れるかと一緒に実装時に決める (00 U2 が委ねる)。
- 予約の値の一生: tx_edits の行として作られ、バックアップは edits として運ぶ (`packages/api/src/tx-edit-codec.ts`)。復元しても字面は変わらない。旧い Worker が読むと、字面がカテゴリ名に見える (Risks)。
- 保持: tx_history と settings_change_log は無期限 (schema.ts:411 の注記)。行を消す文を足さない。
- 実データ: テストと検算は `samples/` と合成の行だけを使い、`data/` を読まない (AGENTS.md)。

#### Migration and recovery

- 現物の確認: HEAD a63d35c と origin/main (同じ a63d35c) で、`migrations/` の最新は `0057_improvement_request_screen.sql`、`packages/api/src/schema-guard.ts:4` の EXPECTED_D1_MIGRATION も同じ名前。並行するサブスク統合のブランチの worktree には、まだ main に入っていない `0058_subscription_merge_operations.sql` がある。
- 2 本の migration と順 (根拠: database.md §上流指針 reliability / 00 C2):
  1. 対応表の migration: 表の作成と、既存の利用者への初期の 5 行の投入。INSERT OR IGNORE … SELECT だけで、DROP・DELETE・UPDATE を含まないので承認は要らない。投入の前例は `migrations/0054_settings_norm_rules.sql:23-35`。投入先に選ぶ集合はテナントのキー (users.id ではない) で、どの表から選ぶかは実装時に決める。
  2. 作り直しの migration: settings_change_log の作り直しと、初期の 5 行の変更履歴の投入。DROP TABLE と ALTER TABLE … RENAME を含むので承認が要る。
  - 1 → 2 の順に固定する。初期の 5 行の変更履歴は新しい種類で書くので、種類の制約を改めた後にしか書けない。
- 作り直しの手順 (`migrations/0057_improvement_request_screen.sql` と同じ手順。SQLite は CHECK を後から替えられない):
  1. 新しい CHECK を持つ表を別の名前で作る (列・型・PK は今と同じ)。
  2. 列を明示した INSERT … SELECT で今の全行を写す。
  3. 今の表を DROP し、新しい表を RENAME する。
  4. 索引 settings_change_log_target を作り直す。
  5. 初期の 5 行の変更履歴を INSERT … SELECT で書く。changed_by は 'system'、origin は 'migration'、before は NULL、after は対応先の JSON、seq は利用者ごとの MAX(seq) に ROW_NUMBER を足す。これは 0056 が 0054 の行を履歴にした前例に倣う agent の案である (根拠: 00 U2)。
  - settings_change_log を参照する外部キーと TRIGGER は無いので、退避表は要らない。
- 番号の取り方: 着手時に origin/main を取り直し、最新の次から連番で 2 つ取る。今の最新は 0057 なので、サブスク統合が先に main へ入れば 0059・0060、入っていなければ 0058・0059 になる。spec の下書きが書く予定の番号 (0058・0059) はこの規則で振り直す。
- 番号が衝突したとき (相手が先に main へ入ったとき):
  - ファイル名が違えば git の衝突には出ないが、schema-guard.ts:4 の行は衝突する。同じ版で名前が違う migration が当たると schema-guard は behind (503) を返す (同 :30-35)。
  - 本番に当たる前なら、こちらを繰り上げる。直すもの: ファイルの git mv、ファイル冒頭の番号の注記 (0057 の冒頭の前例)、schema-guard.ts:4、`packages/api/src/deletion-schema.test.ts:62-63` の字面、`.github/migration-approvals.json` の filename と sha256 (本文が変わればもう一度計算する)、specs と architecture の番号。`system-spec` の章は据え置く。
  - 本番に当たった後は番号を変えない。相手の migration と表の意味が重ならないこと (同じ表を作る・同じ制約を改める) も、番号と一緒に確かめる。
- 承認: `.github/migration-approvals.json` (schema_version 1、baseline は 0056) の approvals に、作り直しの migration の filename・sha256・reason・approved_by を足し、PR の merge を承認とする。pnpm lint の check-migration-approvals (`.github/scripts/check-migration-approvals.mjs`) が承認の無い破壊的な migration を止める。判定 (`.github/scripts/plan-auto-migration.mjs:49-59` の DESTRUCTIVE_PATTERNS) は未適用の 1 本でも承認の無いものがあると全部を止める (:81・:112) ので、承認が無ければ対応表の migration も当たらない。承認は filename と sha256 の一致で見る (`.github/scripts/migration-approvals.mjs:54-56`) ので、承認の後に本文を直したら sha256 を取り直す。
- 当てる順と復元地点: Deploy は判定 → Time Travel の復元地点を記録 (`pnpm run db:checkpoint`) → `db:migrate:remote` → 未適用の検査 → Worker の配信 の順に進む (`.github/workflows/deploy.yml:73-85`)。運用の細部は infrastructure 本書。
- 戻し方: 表は残して Worker だけを戻す (Rollback)。データを戻す最後の手段は、記録した復元地点への Time Travel。

#### Data verification

- 単体・API テスト (O7 の pnpm test に入る):
  - 束ねた版と明細ごとの版で、tx_edits と tx_history の中身 (履歴の id を含む) が同じ。
  - 50 件・100 件の一括保存で D1 へのクエリが 49 本以内、1 回の batch の文が 50 以下 (00 O8)。
  - batch の中の 1 文を失敗させると、tx_edits・tx_history・monthly_agg が保存前と同じで、全件が write_failed (00 O8)。
  - 同じ要求を 2 回送ると、2 回目で tx_history の行数が増えず、月次集計が同じ (00 O9)。
  - 『カテゴリなし』で保存した明細は、tx_edits の category_major が予約の値、category_mid が空、monthly_agg の scope に予約の値が出ない (00 I9)。
  - 対応表の同じ大項目の 2 行目は PK で失敗し、対応表の変更ごとに settings_change_log に 1 行増える (00 G5)。
  - 版 1 の設定の JSON と対応表を持たない旧いバックアップを読むと、対応表が初期の 5 行になる (00 O3)。
  - 初期の 5 行の字面が、migration と core の定数で一致する。
  - schema-guard.ts:4 と最新の migration のファイル名が一致する (deletion-schema.test.ts)。
- 適用前に読むだけで確かめること: 予約の値と同じ字面が、category_major を持つ表 (mf_transactions・rules・tx_edits の category_major と base_major・cash_entries・tx_splits・vendor_memory。schema.ts:31・:80・:109・:112・:589・:635・:961) と category_options.major (:245) に 0 件。
- 適用後に読むだけで確かめること (本番とローカルの両方):
  - settings_change_log の行数が、作り直しの前の行数に初期の 5 行の履歴を足した数と同じ。
  - sqlite_master の settings_change_log の定義に、対応表の種類を含む CHECK がある。索引 settings_change_log_target がある。
  - 対応表の行数がテナントのキーごとに 5、対応表の種類の変更履歴が 5。
  - d1_migrations の最新が 2 本目の migration の名前で、Worker の schema-guard が ready。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| CBS-DB-01 | 勘定科目の対応表を利用者ごとの独立の表にし、PK を (user_id, MF の大項目) にする (qa-classify-bulk-decision-049・qa-classify-bulk-decision-070) | core の定数に固定する / 設定の JSON にだけ持つ / category_options に列を足す | 利用者が画面で編集して持ち続ける状態で、同じ大項目は 1 行という不変条件を PK で守れる。既存の表に列を足さない (00 C2) | migration・API・設定画面・変更履歴・設定の JSON・バックアップのすべてに対応表が加わる |
| CBS-DB-02 | 『カテゴリなし』を tx_edits.category_major の予約の値で持つ (qa-classify-bulk-decision-045) | 列を足す / 専用の表を足す / 空のままにする | 列も表も足さずに、カテゴリが無いという明細の状態を持てる。空は記録済みの空と区別できない | 予約の値を core の 1 か所で定め、集計・候補の検査・履歴で未分類と同じに通す必要がある (00 I9) |
| CBS-DB-03 | 一括保存の編集と履歴を json_each で束ね、月次集計の差し替えと同じ 1 回の batch で書く (qa-classify-bulk-delegated-001・qa-classify-bulk-decision-033) | 明細の境界で batch を分ける (前サイクル) / 小分けに送る / Workers Paid | 文の数が明細数で増えず 49 本以内に収まる。途中まで書かれた状態が残らない | 明細ごとの部分成功が無くなり、batch の失敗で全件が write_failed になる (qa-classify-bulk-decision-057) |
| CBS-DB-04 | 変更履歴の種類の制約を表の作り直しで改め、PR で承認する (00 C2) | CHECK を外した新しい表にする / 対応表の履歴を別の表に持つ / 対応表の変更を履歴に残さない | 設定の変更履歴を 1 つの表と 1 つの revision に保ち、既存の設定画面の履歴と競合の検出をそのまま使える | 破壊的な migration になり、承認の値 (sha256) を本文と一緒に保つ手間が増える |
| CBS-DB-05 | migration を、承認の要らない対応表の migration と、承認の要る作り直しの migration の 2 本に分ける (database.md §上流指針 reliability) | 1 本にまとめる | 承認の対象を破壊的な作り直しだけに絞り、表と初期の 5 行の追加を直しても承認を取り直さない | 2 本の順を 1 → 2 に固定する。片方だけが当たる状態は、承認が無ければ両方が止まる判定で防ぐ |
| CBS-DB-06 | 初期の 5 行を、作り直しの migration で変更履歴に origin='migration' で残す (00 U2 による agent の案) | 履歴に残さない | 0056 が既存の集計ルールを履歴にした前例と揃い、対応表のどの行も変更履歴から辿れる | migration の当たった時点で設定画面の revision が 1 回進む |
| CBS-DB-07 | 対応表に外部キーと対応先の CHECK を置かず、API が core の候補の一覧で検査する (00 G5) | 勘定科目の表への外部キー / 対応先の CHECK | 勘定科目の一覧は利用者が編集する動的な集合で、SQL の制約に固定できない | 候補の削除や改名で対応先が一覧から消えても、対応表の行は残る (Risks) |
| CBS-DB-08 | migration の番号は着手時の origin/main の次から取り、本番に当たる前なら繰り上げる (00 U2 による agent の案。infrastructure 本書と同じ) | spec の予定番号に固定する | 並行するブランチと番号を取り合っても、先に入った方を変えずに済む | 繰り上げのたびに schema-guard.ts:4・テストの字面・承認の sha256 を直す |

## Delivery, migration and rollback

- Migration sequence (データの側、1 つの PR の中の順):
  1. core に予約の値と初期の 5 行の定数を置く。適用前の確認 (予約の字面が 0 件) を読むだけの SQL で行う。
  2. 対応表の migration と、schema.ts の対応表の定義を足す。
  3. 作り直しの migration と、schema.ts の target の enum を改め、`.github/migration-approvals.json` に承認を足す。
  4. schema-guard.ts:4 と deletion-schema.test.ts の字面を 2 本目の名前に上げる。
  5. 一括版の編集と履歴の文、対応表の変更の文、設定の JSON の版 2、バックアップと write-set への追加。
- 本番への当て方: merge の後、Deploy が 2 本を Worker の配信より前に当てる。新しい Worker は対応表と新しい種類を前提にするので、この順を崩さない。
- 番号の衝突: 「Migration and recovery」の手順で、merge の前に origin/main を取り直して確かめる。
- Rollback:
  - Worker だけを戻し、表は残す。対応表を消す DROP は承認が要る破壊的な migration で、戻すたびに作らない。
  - 旧い Worker は、適用済みの版が期待より大きいので schema-guard で ready のまま動く (`packages/api/src/schema-guard.ts:30-35`)。旧い Worker は対応表を読まず、一括保存は明細ごとの batch に戻る。
  - 差し戻しの前に確かめること: 設定画面の最新行の読み出し (`packages/api/src/routes/settings-screen.ts:153-160`) は種類で絞らないので、旧い Worker にも対応表の種類の行が返る。旧い core がこの行を受けて壊れないかを確かめてから戻す。
  - 旧い Worker は版 2 の設定の JSON を unsupported_settings_version で拒む。戻している間は設定の JSON を読み込まない。
  - データまで戻す必要があるときの最後の手段は、Deploy が記録した復元地点への Time Travel。復元地点の後に書かれた明細の編集も戻るので、利用者に確かめてから行う。

## Risks and verification

| リスク | 起こり方 | 抑え方 |
|---|---|---|
| 消した初期の行が戻る | 業務データのキーが全員で同じテナントのキーなので、利用者の作成のたびに初期の 5 行を入れると、INSERT OR IGNORE でも利用者が消した行が戻る | 作成のたびには入れない (spec「API: 勘定科目の対応表」の Validation)。新しい持ち主へ入れる時機は spec の未決事項 7 で決め、O3 の API テスト (まだ対応表を持たない user_id に 5 行が入り、消した行が戻らない) で確かめる |
| 対応先が一覧から消える | カテゴリの候補の削除や改名で、対応表の対応先が勘定科目の一覧に無くなる | 対応表の行は残る (CBS-DB-07)。提案に使う前に core が一覧と照らす扱いは backend 本書 |
| 番号の衝突 | サブスク統合の 0058 が先に main へ入る | merge の前に origin/main を取り直し、繰り上げの手順で直す。schema-guard.ts:4 の衝突が合図になる |
| 作り直しの最中の書き込み | 作り直しの migration を当てている間に旧い Worker が設定を保存すると、表が無い瞬間に当たって失敗しうる | 作り直しを 1 つのファイルの中で続けて行い、窓を短くする。失敗した保存は書かれずに失敗として返るので、データは食い違わない |
| 開いていた設定画面の保存が 409 | 初期の 5 行の変更履歴で revision が進む | 一度だけ起こる。設定画面は読み直してから保存し直せる (409 の今の扱い) |
| 予約の字面との衝突 | MF のエクスポートや既存のカテゴリに、予約の値と同じ名前がある | 適用前に読むだけの SQL で 0 件を確かめる。予約の値と同じ名前のカテゴリの候補は作れない (00 G5) |
| 旧い Worker での見え方 | 差し戻した Worker では、予約の値がカテゴリ名に見える | Rollback の前に、予約の値で保存した明細の件数を読むだけで確かめ、利用者に知らせる |

- Fitness tests (CI で毎回動く):
  - 一括保存の 100 件で、D1 へのクエリが 49 本以内、1 回の batch の文が 50 以下。
  - 束ねた版と明細ごとの版が同じ行を作る。batch の失敗で 3 表が保存前と同じ。
  - 対応表の PK が同じ大項目の 2 行目を止める。初期の 5 行の字面が 3 か所で一致する。
  - check-migration-approvals が、承認の無い破壊的な migration を止める (今の lint のまま)。
- 適用後の確認は「Data verification」の読むだけの SQL で行い、結果を PR か Deploy の記録に残す。

## 実装で決めた名前 (SYS-CLASSIFY-BULK-P12)

本書が「実装時に決める」と委ねた名前と、実装が本書の記述から外れた点の記録。上の節は確定済みなので書き換えず、ここに足す。
列定義の正本は `docs/data-schema.md` の「勘定科目の対応表と変更履歴の種類(0059・0060 / feat-classify-bulk-save)」と
`packages/api/src/db/schema.ts` の `taxAccountMap` で、本節はそこへの対応だけを持つ。

| 本書の記述 | 実装で決めたこと | 場所 |
|---|---|---|
| 1 本目と 2 本目の migration | `0059_tax_account_map.sql` (表の作成と初期の 5 行) と `0060_settings_change_log_target.sql` (settings_change_log の作り直しと初期の 5 行の履歴)。サブスク統合が先に 0058 を使ったので 1 つずつ繰り上げた (OI-6) | `migrations/` |
| 勘定科目の対応表 | 表 `tax_account_map`、Drizzle の名前 `taxAccountMap`。列は `user_id`・`category_big`・`tax_account`・`created_at`・`updated_at` で、すべて TEXT NOT NULL。PK は (`user_id`, `category_big`) | `packages/api/src/db/schema.ts` |
| 列「更新時刻・更新者」 | 更新者の列は持たない。誰が変えたかは settings_change_log の `changed_by` に残すので、行に重ねて持たない。作成時刻と更新時刻を分け、設定だけの復元で値が変わらない行の作成時刻を保つ | 同上 |
| 変更履歴の種類 | `'tax_account_map'`。target_key は MF の大項目、before・after は `{categoryBig, taxAccount}` の JSON。削除は after が NULL | 0060、`routes/tax-account-map.ts` |
| 初期の 5 行の投入先 | テナントのキー `'default'` (`TENANT_ID`)。0059 が `INSERT OR IGNORE` で入れ、0060 が同じ 5 行の履歴を `changed_by='system'`・`origin='migration'` で入れる。利用者の作成では入れない (Risks の「消した初期の行が戻る」) | 0059・0060 |
| 対応先の検査 | 表に外部キーと CHECK を置かず、core の `taxAccountMapRowIssue` が大項目 (前後の空白を落として 1〜60 コードポイント、制御文字なし、予約の値でない) と対応先 (勘定科目の一覧の名前) を見る。行数の上限は 200 (`TAX_ACCOUNT_MAP_ROWS_MAX`) | `packages/core/src/tax-accounts.ts` |
| 設定画面の保存の consumer に入れるか | 入れた。`SETTINGS_SCREEN_CONSUMERS` に `tax_account_map` があり、設定画面の保存・設定だけの復元・バックアップからの復元のフェンスが対応表も覆う。対応表の追加と削除は consumers `['tax_account_map','settings_change_log']` で登録した | `packages/api/src/canonical-mutation-fence.ts` |
| JSON snapshot の無効化 | `JSON_SNAPSHOT_MUTATION_CONSUMERS` に `tax_account_map` を足した。対応表を変えると復元後の提案が変わるため | `packages/api/src/import-active.ts` |
| 全消去の対象 | `FULL_RESET_TABLES` にも、明細の削除の表 `DELETION_TABLES` にも入れていない (本書のとおり)。全データ復元 (`POST /api/restore`) も対応表を書かない | `packages/api/src/deletion-full-reset.ts`・`packages/api/src/deletion-lifecycle.ts` |
| schema-guard の期待値 | `EXPECTED_D1_MIGRATION='0060_settings_change_log_target.sql'` | `packages/api/src/schema-guard.ts` |
| 2 本目の承認 | 0060 の sha256 `05886f213b91aa700eadcb2afe93f6c44386e365702af22bf010bfc90599d0fc` を `.github/migration-approvals.json` に足した。PR の merge が承認になる | `.github/migration-approvals.json` |

- 「Data verification」の読むだけの SQL のうち、適用後の確認 (行数・CHECK・索引・d1_migrations の最新) は本番へ当てた後に行い、結果を PR か Deploy の記録に残す。ローカルの D1 では `tax-account-map-migration.integration.test.ts` が同じ点を確かめる。
- 新しい持ち主へ初期の 5 行を入れる時機 (spec の未決事項 7) は OI-4 として PR で判断を待つ。決まるまで、まだ対応表を持たない user_id に行は入らない。
