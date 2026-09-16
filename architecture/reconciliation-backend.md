---
graph_node_id: "arch-reconciliation-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "照合画面 — core 照合判定と照合専用 API"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "backend"]
file_path: "architecture/reconciliation-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "bfbefb61b4bb32b77bc6aab54ba11ce0b6c87dbf960052820f9a6df74cca2ed0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "bfbefb61b4bb32b77bc6aab54ba11ce0b6c87dbf960052820f9a6df74cca2ed0", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["packages/core/src/expense-projection.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/analysis-hub.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/routes/duplicate-verdict-bindings.ts", "packages/api/src/routes/analysis-hub.ts", "packages/api/src/routes/improvement.ts", "packages/api/src/store.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G2", "G3", "G4"]
---

# Architecture overview

照合画面 — core 照合判定と照合専用 API。`system-spec/backend.md` は承認時入力、本書は backend 制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: `reconcileBizDuplicates` を唯一の照合判定器とし、`reconciliationReport` が画面向けの 5 状態・KPI・キュー・`actionRequiredCount`・期間投影を導出する。判断と除外は共通 bind を通し、API は core の結果を再計算しない。
- Quality attribute priorities: G2・G3・G4 に資する。判定規則を core の純関数に置き、route は adapter に留める。対応必要総数を `actionRequiredCount` に一本化し、照合・ハブ・サイドバー・月次クローズのずれを無くす。
- Constraints: C1: core は依存ゼロの純関数、判定を api/web へ重複実装しない。 C4: 照合の判断は duplicate_verdicts を総収支と共用し、一括操作は最大 200 件。

## Goals and non-goals

- Goals:
  - G2: 一致度・一致の理由・5 状態・対応キュー・KPI・`actionRequiredCount` を core の 1 か所で算出する。意味は仕様正本の「状態・件数・投影の正本」を参照する。
  - G3: GET /api/reconciliation、POST /api/reconciliation/actions (最大 200 件・部分成功)、POST /api/reconciliation/actions/:id/undo を新設する。
  - G4: 月次クローズ 3 ステップの自動判定と月次レビュー完了の保存・取消を提供する。
- Non-goals:
  - 既存 GET /api/business-spend と GET /api/total-cashflow の廃止 (残す)
  - freee / MoneyForward への書き戻し
  - 新しい非同期処理・キャッシュ層の追加

## System context and boundaries

- Users/external systems: web SPA (照合画面・サイドバー・ハブ・総収支) が唯一の呼出し元。外部システムの追加は無い。
- Trust/deployment/data boundaries: 既存ゲート列 (authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence) の内側に新 route を置き、D1 の読み書きは userId で絞る。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core `reconciliationReport` | 一致度・理由・5 状態・キュー・KPI・`actionRequiredCount` を一度だけ算出する | TypeScript 関数 | packages/core | web/api に同梱 |
| core 月次クローズ判定 (推定名 monthlyCloseStatus) | 4 ステップの完了を返す | TypeScript 関数 | packages/core | web/api に同梱 |
| core buildExpenseProjection | 判断と除外を受け取り、照合レポートと同じ入力を使う | TypeScript 関数 | packages/core | web/api に同梱 |
| GET /api/reconciliation | KPI・`actionRequiredCount`・候補一覧・下段プレビュー・直前の操作を 1 回で返す | Hono route | packages/api | Worker |
| POST /api/reconciliation/actions と /:id/undo | 照合 / 別取引 / 除外 / 一括の保存と直前の操作の取消 | Hono route | packages/api | Worker |
| 既存 total-cashflow / analytics route | 総収支・事業支出の既存 API (残す) | Hono route | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: authGuard と mustChangePasswordFence の後にマウントし、全ての読み書きを userId で絞る。undo は reconciliation_actions の user_id 一致を条件にする。
- Errors/resilience: 一括は件ごとの成否を返す部分成功。201 件以上は 400。取込と重なった書込は 409 canonical_write_busy。
- Observability/audit: 操作の事実を reconciliation_actions に残す。既存 requestId を使い、新しい監視は追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存 API は残す。buildExpenseProjection の引数追加に伴い expense-projection のテストと呼出し元を追随させる。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: 下記 architecture-backend.md を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Backend architecture

#### Runtime and architecture pattern

Cloudflare Workers 上の Hono。依存方向は core ← api route adapter ← web で、照合の業務規則は core の純関数に置く。

#### Domain and module boundaries

状態・キュー・`actionRequiredCount`・全期間照合から期間投影する順序は [`specs/spec-reconciliation.md`](../specs/spec-reconciliation.md#状態件数投影の正本) を唯一の正本とする。backend は `reconciliationReport` の戻り値を再計算せず各 API へ渡す。

#### API and service contracts

GET /api/reconciliation、POST /api/reconciliation/actions、POST /api/reconciliation/actions/:id/undo を提供する。分類・件数・投影は仕様正本、計算式の詳細は `docs/data-schema.md`、逐語フィールドは core 型と契約テストを参照し、本書には複製しない。

#### Data and transaction behavior

判断は duplicate_verdicts、freee 除外は freee_deal_exclusions、MF 除外・操作履歴・月次レビュー完了は新表に保存する (qa-reconciliation-decision-002)。派生値は保存せず毎回導出し、月次クローズの照合ステップには全期間の `actionRequiredCount` を渡す。

#### Async processing

N/A: 新しい非同期処理を追加しない。履歴の 90 日削除は次の POST actions の batch 内で行う。

#### Security and resilience

既存ゲートの後にマウントし userId で絞る。書込は zValidator で検証し、canonicalMutationFence の対象に加える (security 章)。

#### Operations and verification

core 単体テストが境界値・5状態・`actionRequiredCount`・全期間照合後の期間投影を検証する。API は照合ページ=ハブ (同期間)、サイドバー=月次クローズ (全期間) と操作契約を検証する。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-reconciliation-decision-002 | 既存表を再利用し拡張する (duplicate_verdicts 共用、取消 API・MF 除外・履歴表を追加) | 照合専用の新テーブル / DB 変更なしで直前 1 操作の逆操作だけ | 総収支と判断結果が一致し、取消と MF 除外を持てる | migration を追加し総収支と件数を揃える責務を負う |
| qa-reconciliation-decision-003 | 単純な加点規則の一致度を core に置く | 一致度を出さずチェック表示だけ | 画像の一致度 % と 2 キューを定義でき、テストで固定できる | 規則を docs と境界値テストで保守する |
| qa-backend-web-rc-decision-007 | 照合専用 API を新設し既存 API は残す | 既存 total-cashflow API を拡張 | 照合画面の 1 応答にまとめ、総収支の契約を変えない | route が 3 本増える |
| qa-backend-web-rc-decision-010 | 解消率は除外を分母から外し、分母 0 は『対象なし』で完了 | 除外も解消に数える / 分母 0 を 0% | 対応不要の除外で進み具合を水増ししない | 分母 0 の表示と完了扱いをテストで固定する |
| qa-backend-web-rc-decision-011 / 012 | 内容類似は文字 bigram の Dice 係数、カナ/英字違いが 0 になる限界は docs に明記 | 完全・部分一致 / 編集距離 / Dice+読み替え辞書 | 依存を足さず短い日本語摘要の部分一致を拾える | アマゾン / Amazon.co.jp は 0 |
| qa-backend-web-rc-decision-013 | 『似ている』のしきい値は 0.5 以上、内容点は連続値 | 0.3 以上 / 0 より大きい | 略称を拾い別会社を落とす | JR東日本 / 東日本旅客鉄道 (0.40) は金額の差異キューに出ない |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker に route を足し、ci.yml / deploy.yml の既存経路で配信する。
- Migration sequence: 追加だけの migration (新表) → core の照合判定関数と境界値テスト → buildExpenseProjection とハブのバッジの判断反映 → api の照合 route・月次レビュー route と統合テスト → web が照合 API を使う。
- Rollback trigger/procedure: core テスト・統合テストが落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。migration は追加だけなので既存データは失われない。

## Risks and verification

- Risk/assumption: status の判定定義と関数名はアシスタントの推定 (inference-002)。backend.md の設計本文と O2 の測定文にしきい値 0.5 が未反映 (completeness-findings low)。内容点の丸め規則・Dice の重複 bigram の数え方・0.5 ちょうどの比較方法は実装時に決めて docs とテストへ書く。
- Architecture fitness test: api route と web が状態・`actionRequiredCount` を再計算しないこと。同じ投影scopeの利用箇所で値が一致すること。
- Load/failure/security validation: GET /api/reconciliation の D1 読取りを既存 /total-cashflow と同程度に保つ。一括 201 件で 400。既存の test / typecheck / lint を緑に保つ (S6)。
