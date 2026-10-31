---
graph_node_id: "arch-guide-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "使い方 — core に guide-screen・信頼度の段階関数・shiftedPeriod・防衛ラインの算出期間の定数を置き、GET /api/guide は loadScoped の結果を core に渡して { screen } に写すだけにする"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "backend"]
file_path: "architecture/guide-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "d0cb72d133251ca361263ca8bebba44f3d9a531a938fceab8f5234c89a1d7847"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "d0cb72d133251ca361263ca8bebba44f3d9a531a938fceab8f5234c89a1d7847", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/core/src/analysis.ts", "packages/core/src/period.ts", "packages/core/src/classify-status.ts", "packages/core/src/guide-screen.ts", "packages/core/src/index.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G2", "G3"]
---

# Architecture overview

使い方 — `packages/core/src/guide-screen.ts` (新設) が節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・ガイド内検索を純関数で導き、信頼度の段階関数と期間の前後移動 `shiftedPeriod` も core に置く。`defenseLine` の算出 (直近 3 か月平均) と `/defense-line` の応答は変えず、その算出期間を core の名前付き定数として公開し、ガイドと用語集の説明文を同じ定数から組む。api は `analyticsRoute` に `GET /api/guide` を足し、`loadScoped` の結果を core に渡して `{ screen }` に写すだけにする (qa-guide-backend-web-002)。`system-spec/backend.md` は承認時入力、本書は層の分け方・API 契約・読み取りの制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 集計系の経路は `packages/api/src/routes/analytics.ts` (825 行) に集まり、`/summary` (:137)・`/overview` (:252)・`/diagnosis` (:411)・`/statements` (:713、`{ screen }` を返す)・`/defense-line` (:749) が `loadScoped` (:102-123) で期間を切った Dataset を core に渡して JSON にする。`defenseLine` は `core/src/analysis.ts:1093` で、:1095 の `pMonths.slice(-3)` に 3 を直書きしている。期間の前後移動は web 側 `pages/statements/view-model.ts:121` にだけある (qa-guide-backend-web-evidence-001)。
- Quality attribute priorities: G2・G3 に資する。Clean Architecture の Dependency Rule、API Design の『資源ごとに 1 つの形を返す』、DDD のユビキタス言語 (『防衛ライン』の 1 語、qa-guide-decision-010) を適用する (backend 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: core は依存ゼロの純関数。api は Hono 4.13.8 の Cloudflare Worker と D1/Drizzle。`loadDataset` は `loadScoped` の 1 回だけ。

## Goals and non-goals

- Goals:
  - G2: 信頼度の境界 (80 / 50) と防衛ラインの算出期間 (3 か月) を core の名前付き定数に置き、説明文と計算が同じ値を読む (qa-guide-decision-008 / 009)。
  - G3: ガイドの導出を core の `guide-screen` の 1 か所にし、api は写すだけ、web は描くだけにする。
- Non-goals:
  - `defenseLine` の算出・数値と `/defense-line`・`/summary` の応答の変更 (qa-guide-decision-009)
  - `/api/guide` での防衛ラインの値の計算
  - 要確認の閾値 `REVIEW_CONFIDENCE_THRESHOLD = 80` (`classify-status.ts:43`) の変更
  - D1 への書き込み

## System context and boundaries

- Users/external systems: web (使い方画面)。
- Trust/deployment/data boundaries: `/api/guide` は `/api/*` の authGuard (`index.ts:107`)・`mustChangePasswordFence` (:109)・`runtimeSchemaGuard` (:110) の内側に置く。`analyticsRoute` は `index.ts:119` で結線されている。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `core/src/guide-screen.ts` (新設) | 節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・検索の導出 | 純関数 `buildGuideScreen` ほか (名前は agent 推定・利用者未確認) | packages/core | web chunk と api Worker に同梱 |
| core の信頼度の段階関数 (新設) | % → 高 / 中 / 低 | 純関数と境界の定数 | packages/core | 同上 |
| core の `shiftedPeriod` (移設) | 期間の前後移動 | 純関数 | packages/core (現物は packages/web) | 同上 |
| core の防衛ラインの算出期間の定数 | `defenseLine` と説明文が読む 3 | 名前付き定数 | packages/core | 同上 |
| `routes/analytics.ts` の `GET /guide` | `loadScoped` → core → JSON | Hono route | packages/api | api Worker |

## Cross-cutting contracts

- Identity/access: `loadScoped` が `c.get('userId')` (`analytics.ts:105`) で絞った Dataset だけを読む (`architecture/guide-auth.md`)。
- Errors/resilience: 壊れた期間指定は `resolvePeriodQuery` (`core/src/period.ts:198`) で全期間に倒し 400 にしない。エラーの形は既存の `{ error: { code, message } }`。
- Observability/audit: 既存の API エラーログの流儀で code を残す。金額と利用者 id は出さない。
- Configuration/secrets: N/A: 新しい設定・秘密情報を持たない。
- Compatibility/versioning: 既存経路の応答は変えない。`index.ts:20,33,53-57` の *-screen の export に `guide-screen` を足し、:30-31 の注記 (初期バンドルに引き込まない) に従う。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/guide-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/guide-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/guide-database.md`)
- Security: N/A: 本章の関心外 (`architecture/guide-security.md`)

### Backend architecture

#### Runtime and architecture pattern

既存の `/statements` と同じく `loadScoped` → core → `{ screen }` の 3 段に揃える。`loadDataset` の呼び出しは `loadScoped` の 1 回のまま増やさない。

#### Domain and module boundaries

ガイドの節・現在値・検索と、信頼度の段階・期間の前後移動は入出力のない計算なので core に置く。web 側 `guide-sections.ts` の現在値合成 (`GUIDE_CURRENT` :46、`buildGuideSections` :117) は core へ移す。`shiftedPeriod` は core の `period.ts` の近く (`applyPeriod` :169、`resolvePeriodQuery` :198) に置く (置き場所は agent 推定・利用者未確認)。

#### API and service contracts

`GET /api/guide` は既存の期間クエリ (`from` / `to`・`year`・`span`) を受け、200 `{ screen }` を返す。`screen` は `period` (applied・label・定義文)・`totals` (income・expense・net、振替除外)・`dataUpdatedAt`・`sources`・`closeStatus` を持つ (qa-guide-backend-web-004、agent 推定・利用者未確認)。節・よくある疑問の本文は core の定数で web も読めるが、数値は必ず API の値を使う。エラーは既存の 401 unauthorized・403 password_change_required・503 schema_unavailable だけで、新しい code を足さない。

#### Data and transaction behavior

読み取りだけ。`dataUpdatedAt` は取込の `committedAt` の最大 (`analytics.ts:225-228` と同じ導出)、`closeStatus` は `/overview` と同じ `loadCloseStatus` (`analytics.ts:203`) と core の `monthlyCloseStatus` (`overview.ts:442`) から得る。`loadCloseStatus` に渡す項目の取り方は /overview と同じ導出を使う (agent 推定・利用者未確認)。totals は総収支画面と同じ既存の導出を呼び、新しい集計規則を足さない。

#### Async processing

N/A: 非同期処理・scheduled job を足さない。

#### Security and resilience

`/api/guide` は検索語を受け取らない (検索はブラウザ内)。期間クエリは既存の検証を通す。失敗時も web は本文を描けるので、API は数値だけに責任を持つ。

#### Operations and verification

core の単体テストで信頼度の境界 (49/50/79/80)、防衛ラインの説明文が定数から組まれること、guide-screen の節・よくある疑問・期間の表・このページの数値・検索、`shiftedPeriod` を固定する。API テストで `/api/guide` の Contract tests (`specs/spec-guide-screen.md`) を確かめる。`defenseLine` の既存テストは値を変えずに通す。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-backend-web-002 | ガイドの導出を core の `guide-screen` に置く | web の `guide-sections.ts` に残す | 導出が 1 か所になり、api と web で割れない | 現在値合成の移設が要る |
| qa-guide-backend-web-002 | 防衛ラインの算出期間を名前付き定数として公開し、説明文をそこから組む | 説明文に 3 か月を直書き | 算出を変えたとき説明だけ取り残されない | `analysis.ts:1095` の直書きを定数に置き換える (値は不変) |
| qa-guide-backend-web-002 | 信頼度の段階関数と `shiftedPeriod` を core に置く | 画面ごとに実装 | 境界と期間の送りが 1 つの関数になる | 決算書の import が変わる |
| qa-guide-backend-web-004 | 応答を `{ screen }` の 1 形にする (agent 推定・利用者未確認) | 数値ごとの別経路 | 1 回の読み取りで画面が揃う | 応答の細部は利用者未確認 |
| qa-guide-backend-web-004 | `/api/guide` は防衛ラインの値を計算しない | ガイドにも値を出す | 防衛ラインの読み取り経路を増やさない | 説明文だけを出す |

## Delivery, migration and rollback

- Build/deploy topology: 既存の api Worker に 1 経路足す。
- Migration sequence: core の定数と段階関数 → `shiftedPeriod` の移設 → `guide-screen` → `GET /api/guide` → Contract tests。
- Rollback trigger/procedure: API テスト・core テストのどれかが赤なら差し戻す。書き込みも migration も無いので、コードを戻すだけで済む。

## Risks and verification

- Risk/assumption: 防衛ラインの定数化で `slice(-3)` の値を取り違えると数値が変わる。`defenseLine` の既存テストを値を変えずに通すことで確かめる。
- Risk/assumption: totals を総収支画面と別の関数で導くと、同じ期間で値が割れる。同じ期間で一致することを API テストで固定する。
- Architecture fitness test: web と api に、ガイドの節・現在値の合成・信頼度の境界の比較が core 以外に 0 件 (grep)。
- Load/failure/security validation: 他の利用者のセッションで `/api/guide` がこの利用者の数値を返さない (O5)。
