---
graph_node_id: "arch-classify-bulk-save-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "明細仕分け一括保存 — 1 起動 49 本の予算と対応表 migration の承認つき配備"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "bulk-save", "infrastructure"]
file_path: "architecture/classify-bulk-save-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "9a4eaa14ba4a71c8800747bed11d35d5562cc2635086f9f3b92a0bedb72837e9"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.16", "source_digest": "9a4eaa14ba4a71c8800747bed11d35d5562cc2635086f9f3b92a0bedb72837e9", "imported_at": "2026-10-01T12:13:05Z"}
created_at: "2026-10-01T12:13:05Z"
updated_at: "2026-10-01T12:13:05Z"
depends_on: ["spec-classify-bulk-save"]
related_nodes: ["arch-classify-bulk-save-ui-ux", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-auth", "arch-classify-bulk-save-security", "arch-classify-bulk-save-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", ".github/workflows/deploy.yml", ".github/workflows/ci.yml", ".github/scripts/plan-auto-migration.mjs", ".github/scripts/plan-auto-migration.test.mjs", ".github/scripts/check-d1-migrations.mjs", ".github/scripts/check-migration-approvals.mjs", ".github/migration-approvals.json", "migrations", "packages/api/src/schema-guard.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/d1-limits.ts", "packages/api/src/routes/classify-bulk.ts", "packages/api/src/store.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/users.ts", "scripts/seed-admin.mjs", "packages/core/src/settings-json.ts", "docs/ci-cd-operations.md", "package.json"]
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/classify-bulk-save-infrastructure.md", "confidence": 1.0}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-10-01T12:13:05Z"}
serves_goals: ["G1", "G4"]
---
# Architecture overview

明細仕分けの一括保存と取引一覧の改善について、実行基盤と配備の制約を持つ文書。既存の Worker kanjo-console・Workers Assets・D1 kanjo-db の構成と binding を変えずに、一括保存の 1 要求で D1 へ出す問い合わせを読み込みと書き込みの合計で 49 本以内に収め、勘定科目の対応表の migration 2 本 (うち 1 本は破壊的) を既存の Deploy で本番の D1 へ届ける (根拠: 00 C2・C4 / infrastructure.md §上流指針 / qa-classify-bulk-decision-070)。

- 正本: 値・エラーコード・受入条件の文面は `specs/spec-classify-bulk-save.md` (以下 spec) に従い、本書と食い違えば spec を優先する。`system-spec/infrastructure.md` と `system-spec/00-requirements-definition.md` (以下 00) は承認時の入力である。
- 行番号: commit a63d35c の現物を 2026-10-01 に開いて確かめた値である。
- 分担: 本書は実行環境・D1 の上限と無料枠・migration の適用と本番への反映・環境の違いを持つ。O1〜O9 の測り方、ログと観測、運用の手順、回帰を止めるテストと CI のゲートは `architecture/classify-bulk-save-maintenance-ops.md` が持ち、本書では繰り返さない。
- 対象の platform は web だけである。モバイル・タブレット・デスクトップ専用アプリの配布経路は検討しない (根拠: infrastructure.md §カテゴリ別収集状態 / qa-classify-bulk-decision-067)。

## Context and drivers

以下の現物の観測は着手前 (HEAD a63d35c) の記録である。到達点は各節と spec を参照する。

- Business/technical context:
  - 実行基盤: `packages/api/wrangler.jsonc` は Worker kanjo-console (:3)・main `src/index.ts` (:4)・compatibility_date 2026-08-24 (:5)・nodejs_compat (:6)・assets の ASSETS binding と run_worker_first `/api/*` (:8-14)・D1 kanjo-db の DB binding (:15-22)・R2 kanjo-files (:23-28)・cron `0 17 * * *` (:29-32)・observability (:33-36、head_sampling_rate 1)・secret SESSION_SECRET (:37-41)・vars ACCESS_AUD と ACCESS_TEAM_DOMAIN (:42-46) を持つ。Durable Objects と Queues の binding は無い。
  - 一括保存の書き方: `packages/api/src/routes/classify-bulk.ts` は MAX_BATCH_STATEMENTS 50 (:43-44) と MAX_BULK_ITEMS 100 (:45-46) を持ち、各 batch に 3 文を予約して (:176) 明細を区切り (:177)、batch ごとに `db.batch` を呼ぶ (:192)。1 回の batch が 50 文を超えると例外にする (:191)。分けた batch はすべて同じ起動の本数に数えられるため、50 件の保存で 200 本を超える (根拠: qa-classify-bulk-infrastructure-web-evidence-002)。
  - 問い合わせ予算の前例: `packages/api/src/scheduled-maintenance-budget.ts` は「batch() も中の statement 数で数える」(:4-6) 規則で、上限 50 (:13) から 1 本を残した 49 本 (:14・:21) を 8 つの job (:23-32) に配る。`packages/api/src/import-lifecycle.ts` は D1_FREE_QUERY_LIMIT 50 (:304) と lease の最悪 4 本 (:306) を持ち、sumPlan (:323) が合計 50 未満のときだけ受理する。
  - 束ねた書き込みの前例: `packages/api/src/store.ts:1937-1953` の aggregateReplacementQueries は、json_each に 1 パラメータで行を渡し、行数によらず INSERT を 1 文に保つ。JSON の大きさは D1_JSON_BIND_SAFE_BYTES 1,900,000 (store.ts:1789) で事前に検査し、超えると D1BulkPayloadError (store.ts:1791-1796) を投げる (根拠: qa-classify-bulk-infrastructure-web-evidence-002)。
  - 配備: `.github/workflows/deploy.yml` は 1 つの job の中で、web のビルド (:71-72) → migration の判定 (:73-75) → Time Travel の復元地点の記録 (:76-78) → `db:migrate:remote` (:79-81) → 未適用の検査 (:82-83) → `wrangler deploy` (:84-85) → 30 秒後と 90 秒後のスモーク (:86-89) の順に進む。並行は production-mutation の concurrency (:27-29、cancel-in-progress false) で直列にする。
  - schema の前提: `packages/api/src/schema-guard.ts:4` の EXPECTED_D1_MIGRATION は `0057_improvement_request_screen.sql` で、d1_migrations の先頭 (:26) が期待より古ければ業務の D1 アクセスの前に 503 で止める (:28-35・:80)。
- Quality attribute priorities: 優先順は次のとおりで、G1・G4 に資する。
  1. 信頼性: 一括保存が無料枠の 1 起動の上限に当たって途中で止まる経路を残さない (Google SRE の reliability)。
  2. 配備の安全: 破壊的な migration を承認なしに本番へ当てず、D1 と Worker の版の不一致を残さない (Google SRE の operations)。
  3. 費用: 無料枠のまま動かし、固定費を足さない。
  4. 初期表示: 初期 JS 予算 110KiB を守る。
- Constraints:
  - Cloudflare 無料枠では、1 回の Worker 起動で D1 へ出す問い合わせは合計 50 本まで。上限は batch ごとではなく起動の合計である。batch 内の文を 1 本ずつ数えるかは公式に明記が無く、リポジトリの安全側の規則に従って 1 本ずつ数える (根拠: 00 C4 / infrastructure.md §確定内容 / qa-classify-bulk-infrastructure-web-evidence-002、出典 cloudflare-d1-limits)。
  - 1 文の bound parameter は 100 まで。束ねた JSON は 1 つの文字列の上限 2,000,000 bytes に収める (根拠: infrastructure.md §上流指針 reliability、出典 cloudflare-d1-limits・cloudflare-d1-json)。
  - D1 の batch は 1 つのトランザクションとして実行され、全件が保存されるか全件が保存されないかのどちらかになる (根拠: qa-classify-bulk-delegated-001)。
  - Workers Paid は月額の固定費がかかり、無料枠で動かす条件から外れる (根拠: 00 C4 / qa-classify-bulk-decision-033 / qa-classify-bulk-delegated-001、出典 cloudflare-workers-pricing)。
  - 表の追加は勘定科目の対応表の 1 つに限り、既存の表に列は足さない。設定の変更履歴の種類の制約は表の作り直しで改め、PR で承認する (根拠: 00 C2 / qa-classify-bulk-decision-070)。
  - lint・typecheck・test・skills:test・初期 JS 予算・verify:full を緑に保つ (根拠: 00 C4・O7)。

**前サイクルとの関係**: `architecture/classify-infrastructure.md` は /classify 画面を作った前のサイクルの文書で、正本のまま残す。本書はそれを引き継いだ上で、次の 6 点を定める。前の文書は書き換えない。

- (a) 引き継ぐ: 同書「Goals and non-goals」の Non-goals (R2・キュー・Durable Objects・新しい binding を足さない) と、外部サービスを呼ばないこと。今回も binding・cron・環境変数を足さない (根拠: qa-classify-bulk-infrastructure-web-002)。
- (b) 引き継ぐ: 同書「Compute and storage」の Capacity にある `inClauseChunkSize` と bound parameter 100 の扱い。今回は選択の読み出しにも当て、txId を 1 文に 50 件まで束ねる (根拠: infrastructure.md §上流指針 reliability)。
- (c) 変える: 同書「Goals and non-goals」の G3、「Architecture decisions」の 2 行目、「Reliability and recovery」の「batch 1 回あたり最大 50 文で区切りを明細の境界に合わせ、失敗はその batch の明細だけ」を、「書き込みは json_each で束ねた 1 回の batch、失敗したら保存対象の全件が write_failed、1 起動の合計は 49 本以内」に改める (根拠: qa-classify-bulk-delegated-001 / qa-classify-bulk-decision-057 / qa-classify-bulk-infrastructure-web-002)。
- (d) 変える: 同書「Compute and storage」の Storage「既存の D1 に 2 表と列を足す」と「Reliability and recovery」の「schema は追加のみなので戻さない」を、「勘定科目の対応表の 1 表を足し、設定の変更履歴を作り直す破壊的な migration 1 本を PR で承認して当てる」に改める (根拠: 00 C2 / qa-classify-bulk-decision-070)。
- (e) 変える: 同書「IaC and delivery」と「Delivery, migration and rollback」の「`ci.yml` → `migrate.yml` → `deploy.yml`」を、現物どおり「CI → Deploy job の中の判定 → 復元地点 → migrate → Worker の deploy」に改める。`migrate.yml` は R2 の残件確認が要る 0040 の手動経路だけで、本件では使わない (`.github/workflows/migrate.yml:1`)。
- (f) 変える: 同書「Context and drivers」の Constraints に、1 起動あたり合計 50 本の上限を足す。同書の日次の行数の上限 (agent 推定) は今回の章が扱わないので、本書の契約にしない (根拠: qa-classify-bulk-infrastructure-web-evidence-002)。

## Goals and non-goals

- Goals:
  - G1: 一括保存の 1 要求を、50 件でも 100 件でも、読み込みと書き込みの合計で 49 本以内にする。書き込みは json_each で束ねた 1 回の batch にする (根拠: 00 O8 / infrastructure.md §To-Be / qa-classify-bulk-delegated-001)。
  - G1: 書く前に、1 回の batch の文が 50 本を超えるか、束ねた JSON が 2MB を超えると分かった要求は、413 too_many_classify_changes で返して書かない (根拠: 00 O8 / infrastructure.md §上流指針 reliability / qa-classify-bulk-decision-070)。
  - G1・G4: 一括保存・一覧・選択の読み出しで提案を算出するために勘定科目の対応表を読む 1 本を、49 本の内訳に含める。これは agent の読みで、利用者は未確認である (根拠: qa-classify-bulk-infrastructure-web-002 の訂正 2026-10-01T09:47:30Z)。
  - G4: 一覧の応答を表示中のページの行だけにし、Worker が 1 回で運ぶ JSON を小さくする。初期 JS 予算 110KiB は check:js-budget で守る (根拠: infrastructure.md §上流指針 reliability / 00 C4)。
  - C2: 勘定科目の対応表の migration 2 本を、既存の Deploy の流れで本番の D1 に当てる。破壊的な方は `.github/migration-approvals.json` への追加を PR で承認してから当てる (根拠: infrastructure.md §上流指針 operations / qa-classify-bulk-decision-070)。
- Non-goals:
  - binding・cron・環境変数・secret・compatibility_date の変更。R2・Durable Objects・Queues・Workers Paid の追加 (根拠: qa-classify-bulk-infrastructure-web-002 / qa-classify-bulk-delegated-001)。
  - 画面から小分けに順送りする方式と、一括保存の上限 (100 件) を下げる方式 (根拠: qa-classify-bulk-delegated-001)。
  - 夜間保守の 8 job と配分 49/49 の変更。一括保存は要求の経路で完結し、夜間の枠を使わない。
  - 警報・SLO・監視基盤の新設。観測は `architecture/classify-bulk-save-maintenance-ops.md` の範囲に留める。
  - web 以外の platform 向けの配布経路 (根拠: qa-classify-bulk-decision-067)。

## System context and boundaries

- Users/external systems:
  - 利用者のブラウザは Workers Assets (画面) と Worker (/api/*) に接続する。一括保存・選択の読み出し・一覧・勘定科目の対応表の API はすべて既存の Worker の経路で、Worker が読み書きするのは D1 kanjo-db だけである。外部の API は呼ばない。
  - R2 と cron は本件の要求の経路では使わない。既存の nightly_backup (`packages/api/src/index.ts:212`) は、これまでどおり loadBackupPayload (`store.ts:1595`) の統合 JSON を R2 の backups/ へ置く。勘定科目の対応表がこの JSON に加わるかは `architecture/classify-bulk-save-database.md` が持つ。
  - 運用者は GitHub Actions の結果と Cloudflare の observability を見る。見方は `architecture/classify-bulk-save-maintenance-ops.md` が持つ。
- Trust/deployment/data boundaries:
  - 信頼境界は既存のまま。/api/* は run_worker_first (wrangler.jsonc:13) で必ず Worker の認証を通る。認証と所有者の規則は `architecture/classify-bulk-save-auth.md` が持つ。
  - デプロイの単位は Worker 1 本 (画面のアセットを含む) と D1 1 つで、増えない。
  - 本番の D1 の schema を変えるのは Deploy job の `db:migrate:remote` (deploy.yml:79-81) と、0040 のための手動の Migrate だけである。ローカルの `db:migrate:local` (package.json:27) は本番に触れない。
- Context diagram: `system-spec/index.md` の章相互参照と、spec の「スコープ」を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker kanjo-console (`packages/api`) | 一括保存・選択の読み出し・一覧・勘定科目の対応表の API。1 起動の問い合わせを 49 本以内に保つ | HTTP (/api/*) | api | Deploy の `wrangler deploy` |
| Workers Assets (ASSETS) | 明細仕分けと設定の画面の配信。初期 JS 110KiB | 静的配信 | web | Worker と同じ deploy |
| D1 kanjo-db (DB) | 明細の編集・取引の履歴・月次集計・勘定科目の対応表 (新設)・設定の変更履歴 (作り直し) | D1 binding | api | migration |
| R2 kanjo-files (FILES) と cron | 夜間バックアップ。本件では変えない | R2 binding・scheduled | api | 変更なし |
| `migrations/` の新しい 2 本 | 対応表の表を作り既存の利用者に初期 5 行を入れるもの、変更履歴の種類の制約を作り直すもの | SQL | リポジトリ | Deploy の migrate |
| `.github/migration-approvals.json` | 作り直しの 1 本の filename・sha256・reason・approved_by | JSON | リポジトリ | PR の merge が承認 |
| `.github/scripts/plan-auto-migration.mjs` | 未適用の migration を自動で当ててよいか判定する | Node | リポジトリ | Deploy |
| `.github/scripts/check-d1-migrations.mjs` | 未適用が残ったまま Worker を出さない | Node | リポジトリ | Deploy |
| `packages/api/src/schema-guard.ts` | Worker が前提とする schema の先頭を、新しい 2 本の後ろの方へ進める | middleware | api | Worker |
| D1 の上限の定数 (api の 1 か所) | 1 起動 50 本・受理 49 本・batch・bound 100・JSON 2MB を 1 か所から読む | TypeScript の定数 | api | Worker |

## Cross-cutting contracts

規範は spec に従い、本書は契約表を複製しない。

- Identity/access: spec「認証・認可」と `architecture/classify-bulk-save-auth.md`。インフラの側では、新しい secret と環境変数を足さない。
- Errors/resilience: 413 too_many_classify_changes (書く前の予算超過)・write_failed (書き込みの batch の失敗で保存対象の全件)・409 canonical_write_busy は spec「エラー・例外・回復」と `architecture/classify-bulk-save-backend.md`。本書が持つのは、その境界が無料枠の上限から来ることだけである。
- Observability/audit: `architecture/classify-bulk-save-maintenance-ops.md`。observability の設定 (wrangler.jsonc:33-36) は変えない。
- Configuration/secrets: N/A: binding・vars・secret を足さない。wrangler.jsonc は本件で変わらない。
- Compatibility/versioning:
  - 設定の JSON (kanjo-settings) を版 2 にし、勘定科目の対応表を持たない版 1 と旧いバックアップは初期 5 行として読む (根拠: 00 C2・O3)。旧い Worker は版 2 を読めない (`packages/core/src/settings-json.ts:15・:29`)。
  - EXPECTED_D1_MIGRATION を新しい 2 本の後ろの方へ、migration と同じ変更で進める。
  - 旧い Worker は、新しい 2 本が当たった D1 でも ready と判定される (schema-guard.ts:28-35 は、適用済みの番号が期待より大きければ ready)。

## Subtype architecture

- Frontend: N/A: 画面の部品と状態は `architecture/classify-bulk-save-frontend.md` が持ち、本書は初期 JS 予算が配備を止めない位置だけを持つ。
- Backend: N/A: API の契約と一括保存の 5 段は `architecture/classify-bulk-save-backend.md` が持ち、本書は 1 起動の問い合わせの予算だけを持つ。
- Infrastructure: 下記の「Infrastructure architecture」を合成する。
- Data: N/A: 対応表の表と変更履歴の作り直しの文、2 本の順序は `architecture/classify-bulk-save-database.md` が持ち、本書は本番への当て方だけを持つ。
- Security: N/A: 入力検証・履歴・CSP は `architecture/classify-bulk-save-security.md` が持つ。

### Infrastructure architecture

#### Environments and topology

- Local/test/staging/production parity:
  - 環境は次の 4 つで、staging は置かない。
    - ローカル: vite (4175 番) と wrangler dev、ローカルの D1 (`db:migrate:local`、package.json:27)。
    - テスト: Miniflare (workerd) のインメモリ D1。統合テストは `migrations/` を全件読んで当てる (`packages/api/test/household.integration.test.ts:25-41` ほか)。api のテストは直列で走る (`packages/api/vitest.config.ts:8-9`)。
    - CI: GitHub Actions の `.github/workflows/ci.yml`。本番の D1 に触れない。
    - 本番: Worker kanjo-console と D1 kanjo-db。構成は変わらず、schema だけが 2 本ぶん進む。
  - 本番への入口は Deploy だけである。Deploy は main への push で CI が成功したとき (workflow_run、deploy.yml:16-20・:33-35) か、main での手動実行 (workflow_dispatch、:21) で走る。手動実行のときだけ lint・typecheck・test を job の中でやり直す (:53-61)。
  - Deploy の job は environment production (deploy.yml:38) の secrets で動き、timeout は 20 分 (:37) である。本件で job の構成と timeout は変えない。
  - 本番へ届かなかったときは report の job (deploy.yml:91-93) が「本番に反映されていません」の Issue を開き、次に届いた配信が閉じる。migration の判定で止まった配信もこの Issue に残る。
  - 新しい 2 本は、テストでもローカルでも本番でも同じ `migrations/` から当たる。テスト用の別の schema を作らない。
  - 初期 JS 予算は、CI の方がローカルより約 0.5〜0.67KiB 大きく出る (`docs/ci-cd-operations.md` §9「初期JS予算がCIだけで落ちるとき」)。予算の判定は CI の結果で行う。
- Regions/zones/network/trust boundaries: N/A: Cloudflare の配置と信頼境界を変えない。
- DNS/TLS/edge/ingress/egress: N/A: 新しい経路・ドメイン・外部への通信を足さない。

#### Compute and storage

- Runtime/compute/scaling:
  - 1 起動の問い合わせ予算: 一括保存の 1 要求は、ミドルウェアから書き込みまでの全部を合計 49 本以内にする。現物で数えた内訳は次のとおりで、合計は O8 の API テストが数えて固定する (測り方は `architecture/classify-bulk-save-maintenance-ops.md`)。

    | 経路 | 現物の本数 | 位置 |
    |---|---|---|
    | 認証 (セッションの検証と利用者の読み出し) | 既存のまま | `packages/api/src/auth.ts:245` |
    | schema の先頭の確認 | キャッシュが外れたときだけ 1 (30 秒) | `schema-guard.ts:26・:47` |
    | lease の取得と解放 | 取得は最悪 4、解放は 1 | `import-lifecycle.ts:306`、`canonical-mutation-fence.ts:282・:297-298` |
    | 明細の読み出し | 12〜14 | `store.ts:524` (loadDataset) |
    | 取引先の記憶と候補の算出 | 1 と 2 | `store.ts:230` (loadVendorMemories)、qa-classify-bulk-infrastructure-web-evidence-002 |
    | 勘定科目の対応表の読み出し | 1 (agent の読み) | qa-classify-bulk-infrastructure-web-002 の訂正 |
    | 書き込みの batch | 明細数によらない定数 | json_each で束ねる (qa-classify-bulk-delegated-001) |

  - 1 要求は明細数によらず約 25 本という見積もり (根拠: qa-classify-bulk-delegated-001) は、lease と schema の確認を含めた実測で確かめ直す。各経路の本数の配分は実装時に決める (spec「非機能要件」と `architecture/classify-bulk-save-backend.md` が委ねる)。
  - batch 内の文は 1 本ずつ数える。`db.batch` を 2 回に分けても上限は増えない (根拠: qa-classify-bulk-infrastructure-web-evidence-002)。
  - 選択の読み出しは txId を 1 文に 50 件まで束ね、bound parameter 100 の内に収める (根拠: infrastructure.md §上流指針 reliability)。`packages/api/src/d1-limits.ts:11・:17` の D1_MAX_BOUND_PARAMS と inClauseChunkSize を使う。
  - D1 の上限の値は api の 1 か所に置き、一括保存・取込・夜間保守がそこから読む (根拠: maintenance-ops.md §確定内容 qa-classify-bulk-backend-web-007 の訂正 2026-09-30T14:11:48Z)。今は import-lifecycle.ts:304・scheduled-maintenance-budget.ts:13・classify-bulk.ts:44・store.ts:1789・d1-limits.ts:11 に分かれている。置き場所のファイルは実装時に決める (同訂正が委ねる)。
- Database/object/cache/queue:
  - D1 に勘定科目の対応表の表を 1 つ足す。行は MF の大項目の名前と勘定科目の 1 組で、同じ大項目は 1 行だけ持つ (根拠: 00 G2・C2)。列の定義は `architecture/classify-bulk-save-database.md` が持つ。
  - 設定の変更履歴 settings_change_log の種類の CHECK (`migrations/0056_settings_change_log.sql:10`) は norm_rule・owner_label・stat_min_months・cash_override の 4 種で、対応表の種類が無い。これを表の作り直しで改める (根拠: 00 C2 / qa-classify-bulk-decision-070)。
  - 『カテゴリなし』は予約の値で持ち、表と列を足さない (根拠: 00 C2 / qa-classify-bulk-decision-070)。
  - R2・キャッシュ・キューは使わない。
- Capacity and cost budgets:
  - 束ねた JSON の 2MB の検査は、月次集計の置き換え (aggregateReplacementQueries) では利用者の月次集計の全行の大きさで決まり、明細の件数では決まらない (根拠: 00 §意思決定支援 decision-005-d1-query-budget の risks)。
  - 費用: Workers Free と D1 の無料枠のまま。有料の機能を足さない (根拠: qa-classify-bulk-decision-033)。
  - 初期 JS 予算 110KiB (`packages/web/scripts/check-initial-js-budget.mjs:8`) は CI の `pnpm build` (ci.yml:90) が守る。Deploy の `build:artifact` (packages/web/package.json:10) は予算を検査しない (deploy.yml:66-70)。

#### IaC and delivery

- IaC tool/state/locking:
  - 基盤の定義は `packages/api/wrangler.jsonc` で、本件では変えない。
  - D1 の状態は `migrations/` の連番と d1_migrations 表が持つ。新しい 2 本の番号は、着手時に origin/main の最新の次から取る。HEAD の最新は 0057 である。
  - 破壊的かどうかは plan-auto-migration.mjs の DESTRUCTIVE_PATTERNS (`.github/scripts/plan-auto-migration.mjs:49-59`) が判定する。DROP TABLE・DROP COLUMN・DELETE FROM・TRUNCATE・UPDATE … SET・ALTER TABLE … RENAME が当たる。
    - 対応表の表を作り、既存の利用者に初期 5 行を INSERT … SELECT で入れる 1 本は、どれにも当たらず自動で当たる。
    - 変更履歴の作り直し (新しい表を作る → 全行を写す → 旧い表を DROP → 新しい表を RENAME) は DROP TABLE と RENAME に当たり、承認が要る。前例は 0057 の承認 (`.github/migration-approvals.json`) である。
- CI/CD stages, approvals, provenance:
  - PR の CI (ci.yml) は lint・typecheck・test:aux (skills:test を含む)・テスト (core・web)・テスト (api)・ビルドを走らせ、verify ジョブ (ci.yml:95) が全部の成功を確かめる。main の必須チェックは verify の 1 本である。
  - 作り直しの 1 本は `docs/ci-cd-operations.md` §6.2 の手順で承認する。
    1. 行が失われないことをテストで確かめる (前例 `packages/api/src/improvement-migration-0057.test.ts`、補助 `migration-test-support.ts`)。テストの配置は `architecture/classify-bulk-save-maintenance-ops.md` が持つ。
    2. `.github/migration-approvals.json` の approvals に filename・sha256・reason・approved_by を足す。baseline は 0056 で、それより後の migration が検査の対象になる。
    3. `pnpm lint` の中の `.github/scripts/check-migration-approvals.mjs` が、未承認・承認後の本文の変更・存在しない migration への承認を落とす。
    4. merge が承認である。
  - Deploy は未適用の migration をまとめて判定する。未承認の破壊的な migration が 1 つでもあれば blocked で exit 1 になり (plan-auto-migration.mjs:131-134)、migrate も Worker の deploy も走らない。承認済みなら apply で、復元地点を記録してから当てる。
- Immutable artifacts/config promotion: Worker と画面は同じ `wrangler deploy` で出る。設定の昇格は無く、環境ごとの値は増えない。

#### Secrets and access

- Secret authority/rotation/injection:
  - 新しい secret を足さない。SESSION_SECRET (wrangler.jsonc:37-41) と Deploy の environment production の secrets (deploy.yml:38-41) は変えない。
  - ローカルの `packages/api/.dev.vars` は読まず、git の操作に含めない。
- Human/service access and least privilege:
  - 本番の D1 の schema を変えるのは Deploy の job だけで、人が手で `wrangler d1 migrations apply --remote` を打たない。
  - 破壊的な migration の承認者は approvals の approved_by に名前で残り、承認は適用後も消さず監査記録として残す (`docs/ci-cd-operations.md` §6.2)。
  - D1 の Time Travel の restore は、影響範囲について承認を得てから人が行う (`docs/ci-cd-operations.md` §10.2)。

#### Reliability and recovery

- SLO/alerts/on-call: N/A: 個人利用のため、SLO・警報・当番を置かない。止まったときの調べ方は `architecture/classify-bulk-save-maintenance-ops.md` が持つ。
- 上限の扱い:
  - 書き込みは 1 回の batch で、1 つのトランザクションとして全件が保存されるか全件が保存されない。途中まで書かれた状態は残らない (根拠: qa-classify-bulk-delegated-001)。
  - batch が失敗したら、要求を 2xx で返して保存対象の全件を write_failed にする (根拠: 00 G1・O8 / qa-classify-bulk-decision-057)。
  - 予算を超えると分かった要求は、書く前に 413 で返す。上限に当たってから失敗する経路を作らない (根拠: infrastructure.md §上流指針 reliability)。
- Backup/restore/RPO/RTO/DR:
  - 夜間バックアップは cron `0 17 * * *` のまま、loadBackupPayload を 1 statement の snapshot として読む枠 (scheduled-maintenance-budget.ts の nightly_backup 1 本) を変えない。
  - Worker だけを戻すときは `wrangler rollback` を使い、その後に git revert の PR で本番とリポジトリを揃える (`docs/ci-cd-operations.md` §10.1)。
  - D1 を戻すときは、Deploy が migrate の直前に記録した復元地点 (deploy.yml:76-78) から Time Travel で restore する (`docs/ci-cd-operations.md` §10.2)。逆向きの migration は書かない。
  - RPO・RTO の目標値は置かない。

#### Infrastructure verification

- `packages/api/wrangler.jsonc` の binding・cron・vars・secrets が本件の前後で変わらないこと。
- O8 の API テストで、50 件・100 件の一括保存がどちらも 49 本以内であること。テストの置き場所と数え方は `architecture/classify-bulk-save-maintenance-ops.md` が持つ。
- 新しい 2 本がインメモリ D1 で全件適用でき、作り直しの前後で settings_change_log の行が失われないこと。
- `packages/api/src/schema-guard.test.ts:63-67` (EXPECTED_D1_MIGRATION が最新の migration と一致) と、`packages/api/src/deletion-schema.test.ts:63` の値を同じ変更で直して緑にすること。
- `.github/scripts/plan-auto-migration.test.mjs` と `check-migration-approvals.mjs` が、作り直しの 1 本を承認なしで blocked、承認ありで apply と判定すること。
- CI の `pnpm build` で初期 JS 予算 110KiB を通ること。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-INF-01 | 書き込みを json_each で束ねた 1 回の batch にする (根拠: qa-classify-bulk-delegated-001 / qa-classify-bulk-decision-033) | 画面から小分けに順送りする。一括の上限を下げる。Workers Paid にする | 50 件も 100 件も 1 回で保存でき、無料枠のまま動く。途中まで書かれた状態が残らない | 失敗すると保存対象の全件が write_failed になり、明細ごとの部分成功は無くなる。store と履歴の書き込み関数を変える |
| ADR-INF-02 | 1 起動の合計を 49 本以内にし、batch 内の文も 1 本ずつ数える (根拠: qa-classify-bulk-infrastructure-web-002 / qa-classify-bulk-infrastructure-web-evidence-002) | batch ごとに 50 文までとして数える | 公式は起動の合計を上限とし、batch 内の数え方に明記が無いので安全側に寄せる | lease・schema の確認・対応表の読み出しも予算に入り、O8 で実測して固定する |
| ADR-INF-03 | 予算を超えると分かった要求は、書く前に 413 too_many_classify_changes で返す (根拠: infrastructure.md §上流指針 reliability / 00 O8) | 書いてから失敗させ write_failed にする | 送り直しても結果が変わらない失敗を、書き込みの失敗と分けられる | 予算の検査を書き込みの前の段に置く (`architecture/classify-bulk-save-backend.md`) |
| ADR-INF-04 | binding・cron・環境変数を足さず、既存の api Worker の経路として配備する (根拠: qa-classify-bulk-infrastructure-web-002 / infrastructure.md §上流指針 operations) | 一括保存を別の Worker かキューに分ける | 運用する部品が増えず、配備の単位が変わらない | 1 起動の上限の中に収める設計の責任が api に残る |
| ADR-INF-05 | 対応表の 1 表と変更履歴の作り直し 1 本を既存の Deploy で当て、作り直しは approvals を PR で足して承認する (根拠: 00 C2 / qa-classify-bulk-decision-070) | 変更履歴を使わず別の記録に残す。手動の Migrate で当てる | 既存の承認の仕組みと Time Travel の復元地点をそのまま使える | 承認が無いと Deploy 全体が止まる。0057 と同じく行が失われないテストが要る |
| ADR-INF-06 | D1 の上限の値を api の 1 か所に置く (根拠: maintenance-ops.md §確定内容 qa-classify-bulk-backend-web-007 の訂正) | 各ルートに定数を置いたままにする | 上限の変更が 1 か所で済み、読み違いを防ぐ | 取込と夜間保守の定数の import を付け替える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI と Deploy のまま。main への merge で Deploy が走り、判定 → 復元地点 → migrate → 未適用の検査 → Worker の deploy → スモーク 2 回の順に進む (deploy.yml:71-89)。
  - web のビルドは migration より前に置かれている (deploy.yml:62-65)。ビルドが落ちたとき「D1 だけ新しく Worker は旧版」の不一致を残さないためで、本件でもこの順を変えない。
  - migration の適用は Worker の配信より前である (deploy.yml:6)。新しい Worker は schema-guard が期待する版に D1 が達するまで業務の D1 経路を 503 で閉じるので、逆順にすると配信の直後に一括保存が 503 になる。
- Migration sequence:
  1. 着手時に origin/main を取り直し、migration の番号の空きを確かめる。別のサイクル (サブスク統合) も 0058 を予定しているので、先に main に入った方の次を取る。
  2. 対応表の表を作る 1 本と、変更履歴を作り直す 1 本を書く。2 本の順序と、初期 5 行の投入を変更履歴に残すかは `architecture/classify-bulk-save-database.md` に従う。インフラの側の制約は、変更履歴へ新しい種類を書く文が作り直しより後に当たることだけである。
  3. 作り直しの行が失われないテストを書き、approvals に追加する (§6.2)。
  4. EXPECTED_D1_MIGRATION と deletion-schema.test.ts:63 の値を、後ろの方の 1 本へ同じ変更で進める。
  5. 利用者の作成の経路 (`packages/api/src/users.ts:247・:255`、`scripts/seed-admin.mjs:101`) は変えない。どちらも users に行を足すだけで業務データの持ち主を作らず、作成のたびに初期 5 行を入れ直すと利用者が消した行が戻る。新しい持ち主へ入れる時機は spec の未決事項 7 が持つ。
  6. PR の CI を緑にして merge する。Deploy は 2 本をまとめて判定し、作り直しが承認済みなら apply で当てる。
  - 旧い Worker が動いている間に新しい schema が当たる。旧い Worker は ready と判定され (schema-guard.ts:28-35)、作り直した CHECK は旧い 4 種を含むので、旧い Worker の設定の書き込みは通る。
- Rollback trigger/procedure:
  - trigger: スモークが落ちたとき。または本番で一括保存か設定の保存が spec と違う結果を返すとき。
  - Worker だけの不具合: `wrangler rollback` で直前の版へ戻し、git revert の PR を作る (§10.1)。新しい表と作り直した CHECK は残るが、旧い Worker はそのまま動く。
  - D1 の不具合: 復元地点から Time Travel で restore する (§10.2)。restore すると、その後に書かれた明細の編集と設定の変更も戻るので、影響範囲を承認してから行う。
  - Worker を戻した後に、利用者が版 2 の設定の JSON を読み込むと、旧い Worker は unsupported_settings_version を返す (settings-json.ts:29)。戻す期間は版 2 の読み込みができないことを、戻した記録に書く。
  - Deploy が migration の判定で止まったときは、§9 の表のとおり、承認を足す PR を merge して Deploy を再び走らせる。

## Risks and verification

- Risk/assumption: 49 本の内訳に、対応表を読む 1 本を含める判断は agent の読みで、利用者は未確認である。実測で 49 本を超えるときは、spec の決定に戻って問い直す (根拠: qa-classify-bulk-infrastructure-web-002 の訂正)。
- Risk/assumption: batch 内の文を 1 本ずつ数えるかは公式に明記が無い。安全側の数え方を採るので、実際の上限に対しては余裕が残る側に誤る (根拠: qa-classify-bulk-infrastructure-web-evidence-002)。
- Risk/assumption: 束ねた JSON の 2MB は、月次集計の全行の大きさで決まる。利用期間が延びて月次集計が育つと、件数の少ない一括保存でも 413 に当たりうる (根拠: 00 §意思決定支援 decision-005-d1-query-budget の risks)。
- Risk/assumption: 変更履歴の作り直しは、旧い Worker が動いている間に当たる。作り直しの途中の書き込みは、Deploy の concurrency と lease では止まらない。行が失われないことはテストで確かめ、適用の直前に復元地点を記録する。
- Risk/assumption: migration の番号は、別のサイクルと 0058 で衝突しうる。git の衝突には出ないので、着手時と merge の直前に origin/main で確かめる。
- Risk/assumption: 初期 JS 予算は CI の方が大きく出る。ローカルで上限ぎりぎりを通しても CI で赤になりうる (`docs/ci-cd-operations.md` §9)。
- Architecture fitness test:
  - wrangler.jsonc の binding・cron・vars・secrets の数が変わらないこと。
  - D1 の上限の値を持つ定数が api の 1 か所だけにあること。
  - 一括保存の経路で `db.batch` の呼び出しが 1 回であること。
  - approvals の baseline より後の破壊的な migration が、すべて approvals に載っていること (check-migration-approvals.mjs)。
- Load/failure/security validation:
  - 50 件と 100 件の一括保存が 49 本以内で、書き込みの batch の失敗で全件が write_failed になり、予算の超過で 413 が返ること (00 O8)。
  - 同じ要求を 2 回送っても二重に保存されないこと (00 O9)。
  - lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0 であること (00 O7)。検査の手順は `architecture/classify-bulk-save-maintenance-ops.md` が持つ。
