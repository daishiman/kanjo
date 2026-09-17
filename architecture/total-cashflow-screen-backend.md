---
graph_node_id: "arch-total-cashflow-screen-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "総収支画面 — core 規則関数と総収支 API の拡張"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "backend"]
file_path: "architecture/total-cashflow-screen-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "ade57808041002ca585aa08c609e6ba85dc2877a2fbd7e44142561cc27dd05f2"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "ade57808041002ca585aa08c609e6ba85dc2877a2fbd7e44142561cc27dd05f2", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/core/src/total-cashflow.ts", "packages/core/src/analysis-hub.ts", "packages/core/src/period.ts", "packages/api/src/index.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/routes/duplicate-verdict-bindings.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/imports.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G3", "G4", "G5"]
---

# Architecture overview

総収支画面 — core 規則関数と総収支 API の拡張。正本は `system-spec/backend.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-backend-web-tc-observed-001。API は Hono の Cloudflare Worker で、/api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence を掛けてから totalCashflowRoute をマウントする。GET /api/total-cashflow は loadScoped(c) で期間を解決し、freee_deals・duplicate_verdicts・freee_deal_exclusions を userId で読み、core の totalCashflowReport へ渡して months・review・matched・freeeOnly 等を返す。POST /total-cashflow/verdicts は最大 200 件を upsert、POST /total-cashflow/freee-exclusions は reason (1〜200 字) 付きで最大 200 件、DELETE は除外を外す。core の取り決め: 消し込みの肯定条件は発生日一致かつ金額一致だけで支払先は使わない、一致組は freee を正とする、要確認の MF 明細は 4 つの束に入れない、口座は否定条件 (accountsConflict) だけ、±3 日 (REVIEW_NEAR_DAYS) は要確認、候補は日付の近い順に 3 件 (REVIEW_MAX_CANDIDATES)、要確認理由は 4 種、集計値は保存しない (dec-aggregation-strategy-001)。無いもの: 期間合計と前期比、セグメント別系列、一致度、3 区分と件数、完全一致候補の一致度と判定状態、除外理由の区分、判定の取消 API、操作履歴。現行の書込み route は invalidateJsonSnapshotQuery を呼ばず canonical-mutation-fence にも登録されていない (qa-infrastructure-web-tc-observed-004)。
- Quality attribute priorities: G3・G4・G5 に資する。doctrine は Clean Architecture: 依存方向を core (一致度・3 区分・前期比・進捗) ← api (route と操作履歴の記録) ← web (表示) に反映し、一致度の計算を route に書かず core の純関数に閉じる。データアクセスは loadScoped と freee 系 3 テーブルの読取りに判定・除外・操作履歴の書込みを足した範囲に限り、書込みは 1 操作 1 batch、core には D1 を知らない配列だけを渡す。
- Constraints: C1: core は依存ゼロの純関数、api/web へ重複実装しない。 C3: 消し込みの不変条件を変えない。 C5: migration gate と runtime schema guard を通す。

## Goals and non-goals

- Goals:
  - G3: 一致度・3 区分・セグメント別合計と前年同期比・判定進捗・自動一致の候補を core の純関数で算出し、GET に加算して 1 回で返す。
  - G4: 判定・除外・取消の書込みを操作履歴付きで行い、条件付きの取消 route を足す。3 表のバックアップと復元に route 側で対応する。
  - G5: 規則を名前付き定数と core の境界値テストで固定する。
- Non-goals:
  - 自動寄せの廃止
  - 集計値の保存
  - 取消のやり直し経路、サーバ側の古さの上限

## System context and boundaries

- Users/external systems: web SPA が唯一の呼出し元。外部サービスへは送らない。
- Trust/deployment/data boundaries: 既存ゲート列の内側に route を置き、D1 の読み書きは userId で絞る。規則は packages/core/src/total-cashflow.ts に閉じ、route は D1 の読取り・書込みと操作履歴の記録だけを担う adapter に留める。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 総収支規則関数 | 一致度・3 区分・セグメント別合計・前年同期比・進捗・自動一致の候補、除外後の review 判定の 1 条件 | TypeScript 純関数 (totalCashflowReport の結果を受け取る) | packages/core | web/api に同梱 |
| core previousYearPeriod | 開始月と終了月を 12 か月前へずらした期間 (ハブの previousPeriod とは名前を分ける) | TypeScript 関数 | packages/core | 同上 |
| GET /api/total-cashflow | 読取りと core への受け渡し、応答の加算 | Hono route | packages/api | Worker |
| 書込み route 4 本 | verdicts・freee-exclusions (POST/DELETE)・operations/{id}/undo。更新と操作履歴と invalidateJsonSnapshotQuery を同じ batch | Hono route + zod | packages/api | Worker |
| routes/imports.ts 復元 | 復元 payload の 3 key を zod で検証し復元へ渡し件数に加える | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 既存ゲート列の後にマウントし、全読み書きを userId で絞る。
- Errors/resilience: 入力超過は 400 で全体を拒否、取消の不一致は 409、他人・不存在の id は 404。前年同期の欠けは null で例外にしない。
- Observability/audit: 操作履歴が判定・除外・取消の記録を兼ねる。既存 requestId を使う。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: GET の既存フィールドを残し、除外の旧 {reason} を memo+other として受ける。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 architecture-backend.md を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

Cloudflare Workers 上の Hono。設計知識は Clean Architecture card の Dependency Rule、DDD card の集約 (消し込みの不変条件を 1 つの集約境界として扱い、『同じ取引にする』を same の記録だけに留めて matched と総額を画面操作から守る)、API Design Patterns card (GET への加算で往復を 1 回に保つ、取消は条件付き要求)。出典は hono-zod-validator 0.9.1。

#### Domain and module boundaries

一致度の配点・3 区分・セグメント別合計と前年同期比・判定進捗は入出力を持たない業務規則なので core の純関数に置く。除外した freee が唯一の候補だった明細を要確認から出す条件も route ではなく core の review 判定に置く (qa-total-cashflow-decision-015)。除外した freee の区分を MF 明細へ引き継がず公私仕分けに従わせる (qa-total-cashflow-decision-014)。

#### API and service contracts

一致度 (0〜100 の整数) = 金額 40 + 日付 30/20/10/5/0 (dayGap の絶対値 0/1/2/3/4 以上) + 口座 15/8/0 (一致/片側の情報なし/accountsConflict) + 摘要 15/8/0 (normalizeInstitution と同じ正規化の後に一致/含む/それ以外)。3 区分: 重複候補 = review のうち候補ちょうど 1 件で理由が『発生日が一致しません』または『取込月と表示日の月が一致しません』、要確認 = 残りの review、freee除外 = excluded。3 区分の和は review 件数 + excluded 件数。自動一致の候補は matched のうち by=auto で一致度 78〜100、判定状態は same 記録があれば『同じ』無ければ『未判定』。取消は POST /operations/{id}/undo で、id が kind が undo でなく undone_at が空の書込み操作のうち最新の 1 操作と一致するときだけ操作前の値へ戻し、一致しなければ何も変えず 409 (qa-backend-web-tc-inference-006)。応答の形は spec の API契約に従う。

#### Data and transaction behavior

除外後の数え方: 除外した freee 取引は総額から外れ、対応していた MF 明細は resolveTx の結果で事業か家計に数える。要確認の明細のうち、除外を考えずに引いた候補がちょうど 1 件でその freee が除外されているものは理由にかかわらず review から出して resolveTx で数え、候補 0 件と候補 2 件以上の明細は review に残る。前年同期比: 前年同期間の全ての月がデータ範囲にあるときだけ前年値を出し、1 か月でも欠ければ null。差額 = 当期 − 前年値、率 = 差額 / |前年値| で前年値 0 のとき率は null。進捗『N件中M件』は表示中区分の対象件数 N と記録済み件数 M。書込み route 4 本は canonical-mutation-fence.ts に consumers (verdicts は duplicate_verdicts と total_cashflow_operations、freee-exclusions は freee_deal_exclusions と total_cashflow_operations、undo は 3 表) 付きで登録し、書込みと同じ D1 batch で invalidateJsonSnapshotQuery (同じ consumers) を呼ぶ (qa-backend-web-tc-inference-007)。

#### Async processing

N/A: 非同期処理・キュー・cron を追加しない。

#### Security and resilience

zod で verdict の許可値・件数上限 (200)・reasonCode の許可リスト・memo の長さを検証する。取消の二重送信・通信の再試行・別タブの古い表示からの送信が、利用者の見ていない 1 つ前の操作を戻さないよう、最新の未取消操作との一致だけを条件にする。復元と書込みが重なって古いスナップショットが利用者の判断を上書きしないよう fence と無効化を掛ける。routes/imports.ts は復元 payload の 3 key を検証し、旧バックアップに key が無ければ既存の行を残す。

#### Operations and verification

core の境界値テスト (日付差 3 日と 4 日、候補 1 件と 2 件、前年同期の月の欠け、前年値 0、唯一の候補を除外した月ずれ明細、除外前後の事業/家計の入れ替わり、自動一致の組で摘要だけが違う) と、API 統合テスト (判定後の総額が不変条件どおり、取消後の総額一致、同じ id の再送と古い id で 409、他人の id で 404、復元で 3 表が戻る)。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-total-cashflow-decision-002 / 008 | 自動寄せを維持し『同じ取引にする』は same の記録だけ | 自動寄せをやめ判定まで隔離 / 確認まで保留 | 集約の不変条件を画面操作から守る | matched と総額は same 記録で変わらない |
| qa-total-cashflow-decision-003 | 除外理由を reason_code と memo に分ける | 自由記述 1 列のまま | 区分バッジと一括設定ができる | body を広げ旧 {reason} を memo+other で受ける |
| qa-total-cashflow-decision-006 | 前期比は前年の同じ期間 | 直前の同じ長さ | 季節の影響を除ける | core に previousYearPeriod を足しハブと名前を分ける |
| qa-total-cashflow-decision-014 / 015 | 除外後は公私仕分けに従い、唯一の候補を除外した明細は集計へ | 区分を引き継ぐ / 要確認に残す | 集計規則を 1 つに保つ | core の review 判定に 1 条件を足す |
| qa-total-cashflow-decision-018 | 3 表をバックアップに加える | 判定と除外だけ / 加えない | 復元しても判定・除外理由・操作履歴が戻る | route を fence に登録し無効化を呼ぶ |
| qa-backend-web-tc-inference-006 / 007 | 規則の配点と取消の条件付き要求、書込み route の fence 登録と同一 batch の無効化 | route に規則を置く / 条件なしの取消 | 二重押下・再試行・古いタブで意図しない操作を戻さない | inference-005 を置き換え、007 は 006 を補う (アシスタント推定) |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker kanjo-console の総収支 route を拡張し、ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: core の規則関数と previousYearPeriod と境界値テスト → migration (arch-total-cashflow-screen-database) → route の加算・書込みの操作履歴・undo route・fence 登録と無効化 → 復元 payload の検証 → web の切替。
- Rollback trigger/procedure: core テスト・統合テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は追加のみで旧 Worker が読んでも壊れない。

## Risks and verification

- Risk/assumption: 変更箇所に packages/api/src/import-lifecycle-pure.test.ts の routeSources への routes/total-cashflow.ts 追加と consumers・route 列挙の期待値、db/schema.ts が挙がっていない (findings low)。除外を考えない候補が 2 件以上あり全部除外済みの明細が review に残る点が decision-015 の含意とずれる余地 (findings low)。適用文に『前期比』の表記が残る (findings low)。
- Architecture fitness test: 一致度・区分・前期比の計算が core にあり route に無いこと。書込み route 4 本が fence に登録され consumers の列挙テストが通ること。
- Load/failure/security validation: 1 リクエストの D1 読取りを d1-limits.ts の上限内に収め、items_json を D1_MAX_BOUND_PARAMS に合わせて分割する。既存の test / typecheck / lint を緑に保つ (S6)。
