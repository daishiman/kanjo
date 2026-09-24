---
graph_node_id: "arch-improvement-screen-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "改善リクエスト — 状態の遷移・一覧・関連・履歴の判定を core の improvement-screen に置き、API は zod で検証して D1 batch 1 つで依頼と履歴を書き、削除中の行を全経路で読まず、夜間に 30 日後の完全消去を他 job の枠 1 本で回す"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement-screen", "backend"]
file_path: "architecture/improvement-screen-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "136ec3272f0380ac094b034440a4ee1dfa6b96e93b427f3752cc5cad2cb78ffb"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "136ec3272f0380ac094b034440a4ee1dfa6b96e93b427f3752cc5cad2cb78ffb", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-database", "arch-improvement-screen-auth", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/api/src/routes/improvement.ts", "packages/api/src/improvement/contract.ts", "packages/api/src/improvement/redact.ts", "packages/core/src/improvement.ts", "packages/core/src/improvement-screen.ts", "packages/core/src/index.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/index.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-backend.md"}]
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

改善リクエスト — 状態の体系と許される遷移、概要の切り出し、IMP 番号の表示、検索・件数タブ・10 件ずつのページング、関連する依頼 3 件、アクティビティの表示、診断の表示用要約を、core に新設する `packages/core/src/improvement-screen.ts` の純関数に置く。`packages/api/src/routes/improvement.ts` は 3 つだけを担う。入力を zod で検証すること、core が許した遷移を D1 batch 1 つで書くこと (依頼の行と履歴の行を同じ batch に入れる)、結果を JSON に写すことである (qa-imp-backend-web-001)。`deleted_at IS NULL` の条件を improvement_requests を読む全経路に掛ける。30 日後の完全消去は夜間 job で行い、D1 予算は他 job の枠を 1 本回して 49 を保つ (D-imp-008)。`system-spec/backend.md` は承認時入力で、本書は API の境界・経路・書き込みの単位・夜間処理の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 現行 api は `routes/improvement.ts` (561 行) に次の経路を持つ。POST /improvements (multipart、:130)、一覧 GET (:242)、詳細 GET :id (:254)、画像 GET :id/screenshot (:267)、指示文 POST :id/prompt (:311)、コピー記録 POST :id/copied (:359)、状態 POST :id/status (:374)、agent 用の GET :id/agent/data (:443) と :id/agent/screenshot (:472)。DELETE は無く、一覧には検索・件数・ページングが無い。一覧は利用者で絞って作成の新しい順に最大 200 件を返す (:242-251)。指示文は `improvement/contract.ts` の `buildImprovementPrompt` (:185) が組み立てる (qa-imp-backend-web-evidence-001)。夜間の `runImprovementRetention` (:498) は、完了から 30 日を過ぎた行の添付・診断・トークンだけを消し、本文と状態は残す。結線は `index.ts:103` (agent)、`:132` (利用者)、`:214` (夜間 job) にある。
- Quality attribute priorities: G3 (導出の一元化) と G4 (分離・検証・論理削除・完全消去・再発行・バックアップ除外)。上流指針は Clean Architecture の Dependency Rule と gateways/repositories boundary。
- Constraints: Hono + zod + Drizzle + D1 + R2 (C1)。migration 0054 の後の表を前提にする (C2、`architecture/improvement-screen-database.md`)。新しい Cron は足さない。夜間の D1 予算 `SCHEDULED_D1_QUERY_PLAN_MAX=49` (`scheduled-maintenance-budget.ts:14`) を超えない (C3)。

## Goals and non-goals

- Goals:
  - G3: 導出を core の improvement-screen 1 か所に置き、api と web に同じ計算を持たない (O3、grep で 0 件)。
  - G4: 経路ごとに利用者で分離し (他人の id は 404)、zod で検証する (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と大きさ)。削除は論理削除にし、『元に戻す』で同じ id と番号に戻す。30 日後に本文・画像・履歴を完全消去する。指示文のトークンは再発行する。バックアップには含めない (O4)。
- Non-goals:
  - 手動の関連付け (qa-imp-decision-006)
  - 件名の入力と検証 (qa-imp-decision-002。列は残るが API は受け取らない)
  - 新しい Cron と外部の job 基盤 (C3)
  - web 以外の client 向けの認証方式 (qa-imp-decision-005)

## System context and boundaries

- Users/external systems: web (セッション Cookie)、外部の coding agent (指示文のトークン `imp_` を Bearer で送る。`agentGuard` :399)、Cron (`scheduledMaintenance`)。
- Trust/deployment/data boundaries: 利用者の経路は `userId` で絞り、agent の経路はトークンのハッシュと id の一致で絞る。サーバでは本文・関連ページ・診断を core の規則で再マスクする (`architecture/improvement-screen-security.md`)。R2 の画像は形式と大きさを検証して保存し、API を通してだけ返す。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `packages/core/src/improvement-screen.ts` (新設) | 状態と遷移、概要、IMP 番号、検索・件数・ページング、関連 3 件、アクティビティ、診断要約 | 純関数 | packages/core | api と web に同梱 |
| `packages/core/src/improvement.ts` | 既存の定数 (保持 30 日・トークン 24 時間と 20 回・画像 2MB)、`redactSecrets`、状態の型 | 純関数と定数 | packages/core | 同上 |
| `packages/api/src/improvement/contract.ts` | Drizzle の表定義、zod スキーマ、応答の写し、指示文 | 型と関数 | packages/api | Workers |
| `packages/api/src/routes/improvement.ts` | 経路・D1 batch・R2 の読み書き・夜間の保持処理 | Hono の route | packages/api | Workers |
| `packages/api/src/scheduled-maintenance-budget.ts` | 夜間 job ごとの D1 クエリ数の枠 | 定数表 | packages/api | Workers |

`improvement-screen.ts` はファイル名まで章に明記されていない。既存の `*-screen` と同じ命名に揃えた agent 推定・利用者未確認の名前である。

## Cross-cutting contracts

- Identity/access: 利用者の経路はすべて `userId` と id の組で 1 行を引く。見つからなければ、他人の行か存在しない行かを区別せず 404 を返す。削除中 (`deleted_at` あり) の行も同じく 404 とする (agent 推定・利用者未確認。章は「どこからも読まない」までを決めている)。
- Errors/resilience: zod の違反は 400 にし、欄ごとの理由を返す。core が許さない遷移は 409 にする (agent 推定・利用者未確認)。完全消去後の指示文の再発行は、今の `purged` の扱い (410) を保つ。削除と復元は冪等で、同じ状態へ何度送っても結果は変わらない。
- Observability/audit: 状態の変更・再発行・削除・復元を履歴の行として追記し、書き換えない。夜間 job の結果は今の `improvement_retention` の構造化ログ (`index.ts:290-307`) に、完全消去の件数を足す (agent 推定・利用者未確認)。
- Configuration/secrets: トークンは平文を保存しない (今の `token_hash`)。値そのものはログにも応答にも出さない (:396)。
- Compatibility/versioning: 経路のパスは今のものを保ち、削除 (DELETE /api/improvements/:id) と復元 (POST /api/improvements/:id/restore) を足す。この 2 経路は backend 章の『適用された設計知識』にある、アシスタントの推定 (利用者未確認) である。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` を 0054 に進め、0054 を当てる前の D1 では新しい経路を動かさない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/improvement-screen-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/improvement-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/improvement-screen-database.md`)
- Security: N/A: 本章の関心外 (`architecture/improvement-screen-security.md`)

### Backend architecture

#### Runtime and architecture pattern

Cloudflare Workers 上の Hono。依存の向きは api → core の一方向にする。core は D1・R2・Hono を知らない。今の api にある判定のうち、`:381` の「done のときだけ `doneAt` を付ける」も core の遷移結果 (done_at を付けるか外すか) を受け取る形に移す。

#### Domain and module boundaries

集約は依頼 1 件で、その下に履歴の行が並ぶ。状態は open (受付) / in_progress (対応中) / done (完了) / reconfirm (再確認) の 4 つにする (qa-imp-decision-001)。どの状態からどの状態へ移れるかは core が決める。遷移表の中身は章に無く、core の設計で決める未決事項である。関連する依頼は、同じ関連ページ (route) を持つ本人の他の依頼を新しい順に最大 3 件とし、削除中の行は含めない (qa-imp-decision-006)。

#### API and service contracts

| 経路 | 用途 | 変更点 |
|---|---|---|
| GET /api/improvements | 一覧 | 検索語・件数タブ・10 件ずつのページングを受け、core が絞り込み・件数・ページを返す |
| GET /api/improvements/:id | 詳細 | 履歴と関連する依頼 3 件を足す |
| POST /api/improvements | 作成 | 件名を受け取らない。本文 1000 字・プライバシー確認 2 つを検証する。seq を採番する |
| GET /api/improvements/:id/screenshot | 画像 | 削除中を除く |
| POST /api/improvements/:id/prompt | 指示文の再発行 | 履歴に 1 行を追記する |
| POST /api/improvements/:id/copied | コピー記録 | 削除中を除く |
| POST /api/improvements/:id/status | 状態の変更 | 候補は 4 状態。遷移の可否は core が判定し、履歴に 1 行を追記する |
| DELETE /api/improvements/:id | 論理削除 (新設・推定) | deleted_at を付け、履歴に 1 行を追記する。冪等 |
| POST /api/improvements/:id/restore | 復元 (新設・推定) | deleted_at を外し、同じ id と番号に戻す。冪等 |
| GET /api/improvements/:id/agent/data・/agent/screenshot | agent 用 | 削除中を除く |

一覧の検索・タブ・ページのクエリ名、応答の形、10 件目以降の返し方 (offset か cursor か) は章に無く、agent 推定・利用者未確認とする。zod の検証は Hono の validator で行う (hono-zod-validator 4.13.8)。本文の 1000 字は新規の作成だけに掛け、1000 字を超える既存の本文はそのまま読めるようにする (C2)。

#### Data and transaction behavior

書き込みは、依頼の行の更新と履歴の行の追記を同じ D1 batch に入れる。対象は作成・状態の変更・再発行・削除・復元である (DDD の Aggregate と Domain Event)。作成では、採番表の更新・依頼の行・履歴の行を同じ batch で書く。取引先名を伏字にするための辞書は、作成のときに利用者自身の `transactions.partner` だけを 1 本のクエリで読む。読み取りのすべての経路に `deleted_at IS NULL` を掛ける。経路は一覧・件数・詳細・画像・指示文・コピー記録・状態・agent の 2 経路・関連する依頼である。経路の一覧を仕様に持ち、経路ごとの API テストで条件の抜けを見つける。

#### Async processing

新しい Cron は足さず、今の `scheduledMaintenance` の `improvement_retention` job (`index.ts:214`) を拡張する。削除から 30 日を過ぎた行について、R2 の画像を消し、行を DELETE する。履歴の行は ON DELETE CASCADE で一緒に消える (qa-imp-decision-003)。D1 の枠は D-imp-008 のとおり、`audit_header_retention` を 3→2 本、`improvement_retention` を 3→4 本にして、合計 49 を保つ。完了から 30 日の添付の消去は今の処理のまま残す。完全消去と添付消去を 1 クエリ増でどう組み合わせるか (SELECT を 1 本にまとめるか) は未決である。`audit_header_retention` の減らし方は qa-imp-decision-008 で決まっている。この job が削除の前後で読む件数と容量は、ログに書くだけで判定には使わない。そこで削除後の 1 回だけを読み、削除前の件数は削除後の件数と消した件数の和で出す。R2 のキーの形 (`improvements/<userId>/<requestId>.jpg`) は変えない。

#### Security and resilience

利用者の分離は、全経路で `userId` と id を組にした条件で守る。agent の経路は今の `agentGuard` (期限・回数・purged の区別) を保ち、削除中の行も拒否する。R2 の削除は冪等なので、D1 の更新に失敗した行は次の夜に拾い直す (今の :519-547 の方針)。夜間バックアップ (`store.ts:802` の `BACKUP_SNAPSHOT_SQL`) には、依頼の表も履歴の表も入れない。

#### Operations and verification

既存の api テスト 4 本 (`improvement-lifecycle` / `-redaction` / `-retention` / `-backup-exclusion`) を新しい契約に合わせる。そのうえで次を足す。削除 → 復元で同じ id と番号に戻ること。削除中の行が一覧と件数に 0 件で、画像・指示文・agent の経路でも読めないこと。他の利用者の依頼が 404 になること。30 日経過の完全消去で R2 の画像と履歴が消えること。夜間の予算の合計が 49 のままであること。core の improvement-screen の単体テストでは、遷移・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約を固定する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-backend-web-001 | 判定と導出を core の improvement-screen に置き、API は写すだけ | routes に計算を残す | 導出の置き場所が 1 か所になり、純関数で速く検証できる | api の今の判定 (:381 など) を core へ移す作業が要る |
| qa-imp-decision-001 | 状態を open/in_progress/done/reconfirm にし、遷移は core が判定する | 現行の wontfix を残す | 画像のタブと揃い、完了を 30 日の起点に保てる | 0054 で wontfix の行を移す必要がある |
| qa-imp-decision-003 | 削除は論理削除 + 復元にし、30 日後に夜間で完全消去 | 即時の物理削除 | 誤削除を取り返せる。完全消去も保証できる | 全経路に deleted_at の条件が要る |
| qa-imp-decision-006 | 関連する依頼は同じ関連ページから最大 3 件を自動導出 | 手動の紐付け | 保存する関係が要らない | 関連ページの無い依頼では 0 件になる |
| qa-imp-decision-008 | 完全消去の DELETE は `audit_header_retention` から 1 本借りる (borrow-slot) | 予算の上限を上げる / 別の Cron | 49/49 のまま、完全消去をコードとテストに明示できる | 監査ヘッダ保持の削除前の件数は、読まずに計算で出す値になる |

## Delivery, migration and rollback

- Build/deploy topology: 既存の Workers に同梱する。Migrate (0054) → Deploy の順にする (`architecture/improvement-screen-database.md`)。
- Migration sequence: core improvement-screen と単体テスト → contract.ts の表定義と zod → 読み取りの全経路に deleted_at の条件 → 作成 (件名なし・seq) → 状態・再発行の履歴 → 削除と復元の経路 → 夜間の完全消去と予算の付け替え → `EXPECTED_D1_MIGRATION` の更新。
- Rollback trigger/procedure: API テストと verify:full のどれかが赤なら差し戻す。0054 の後の表は旧コードの前提と違う (件名 NULL・reconfirm・`seq`)。schema guard は期待番号より新しい適用済み番号を許容するため、旧 Worker だけを戻しても停止しない。作成失敗や表示の乱れを確認し、必要なら database 章の Time Travel 復旧手順に従う。

## Risks and verification

- Risk/assumption: `deleted_at IS NULL` を 1 経路でも付け忘れると、削除した依頼が読める。経路の一覧と API テストを 1 対 1 で持つ。
- Risk/assumption: 旧 wontfix の行には done_at が無い (現行は done のときだけ付ける)。done へ移したあと 30 日の添付消去の起点が無い。移すときに何を done_at にするかは database 章の未決事項である。
- Risk/assumption: `audit_header_retention` の削除前の件数を計算で出す形にすると、ログの値が今と食い違うおそれがある。予算表のテストと、監査の保持テストの両方で確かめる。
- Architecture fitness test: api と web に遷移・概要・番号・件数・関連の計算が 0 件であること (O3 の grep)。
- Load/failure/security validation: 他人の id が 404 になること、zod の違反が 400 で欄ごとの理由を返すこと、agent の経路がトークンの期限・回数・削除中を区別して拒否することを API テストで確かめる。
