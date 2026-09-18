---
graph_node_id: "arch-subscriptions-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "サブスク画面 — 配信構成を変えずベンダー数 × 月数の計算量に収める"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "infrastructure"]
file_path: "architecture/subscriptions-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "bb164e7e24bdf08c42118ba28bafd7da1b202af00db698e1186e1a9eded03256"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "bb164e7e24bdf08c42118ba28bafd7da1b202af00db698e1186e1a9eded03256", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/subs.ts", "packages/core/src/expense-projection.ts", "packages/web/scripts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G4"]
---
# Architecture overview

サブスク画面 — 配信構成を変えずベンダー数 × 月数の計算量に収める。`system-spec/infrastructure.md` は承認時入力、本書は infrastructure 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: 配信は `packages/api/wrangler.jsonc` の Worker・Workers Assets (:8)・D1 (:15)・R2 (:23)・cron (:31 `0 18 * * *`) の 1 構成。現行の GET /subscriptions (`packages/api/src/routes/analytics.ts:459-476`) は利用者の freee 仕訳を全件読んでから期間の月で絞り (:467-471)、`sourceNeutralSubscriptions` (`packages/core/src/expense-projection.ts:264-293`) で照合と集計を行う。同じ照合 (`buildExpenseProjection`) は `sourceNeutralSubscriptionDeals` (:296-306) からも走り、GET /sub-vendors/candidates (`packages/api/src/routes/subs.ts:158-178`、freee 仕訳と Dataset を全件読む) とサイドバーのバッジ (`analytics.ts:197-203`) がそれぞれ呼ぶ。画面を開くと一覧・候補・バッジの 3 要求で同じ照合が 3 回走る。
- Quality attribute priorities: G4 に資する。Google SRE の reliability (失敗を部分的な誤りとして見せない) と operations (変更を小さく可逆に保つ、負荷特性を先に見積もる) を適用する。
- Constraints: Cloudflare Workers + D1。binding を増やさない。本サイクルで SLO を新たに定義しない。

## Goals and non-goals

- Goals:
  - G4: サブスク画面の数値を core 1 か所で算出する構成を、既存の配信構成と実行特性のまま載せる。初回応答はベンダー数 × 月数に比例させ、明細量に比例する処理を詳細の要求へ分ける (spec §13)。
- Non-goals:
  - binding・cron・R2・Workers Assets の変更
  - ロゴ用の外部画像取得・キャッシュ基盤
  - 新しい監視基盤・SLO

## System context and boundaries

- Users/external systems: Cloudflare Workers と D1 のみ。外部サービスを呼ばない。
- Trust/deployment/data boundaries: 既存 Worker の中の既存 route に経路を足すだけで、デプロイ単位は増えない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker (Hono) | GET /api/subscriptions (集計値)・GET /api/subscriptions/vendors/:key (詳細)・保存 API | HTTP | packages/api | Worker |
| D1 | 明細・登録・除外・カテゴリ・見直し判断 | SQL | packages/api | D1 |
| Workers Assets | web の静的配信 (変更なし) | 静的配信 | packages/web | Worker |
| R2 / cron | 既存のまま (本サイクルは使わない) | — | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: N/A: 本章の関心外 (`architecture/subscriptions-auth.md`)。
- Errors/resilience: 集計が失敗したら GET /api/subscriptions 全体を失敗として返し、画面全体を error にする (一部のカードだけ古い値や 0 を出さない)。詳細の失敗は一覧の表示を壊さない (取得が別経路であることの帰結)。
- Observability/audit: 新しい計測基盤を導入しない。JS バンドル予算は既存の測定 (build:bundle 直後) を使う。
- Configuration/secrets: `wrangler.jsonc` の binding を据え置く。
- Compatibility/versioning: migration 0043 は追加だけ (DROP・DELETE・UPDATE・RENAME なし) なので、main へのマージ後に Deploy が `plan-auto-migration.mjs` の判定 `apply` で自動適用する。手動の Migrate (APPLY) は使わない (`architecture/subscriptions-database.md`)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/subscriptions-backend.md`)
- Infrastructure: 下記 Infrastructure architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Infrastructure architecture

#### Runtime topology

既存 Worker・Workers Assets・D1・R2・cron の構成を変えない。新設経路は既存の subsRoute / analyticsRoute に足す。

#### Capacity and budget

初回の GET /api/subscriptions の計算はベンダー数 × 月数に比例させる (推定月額・継続中・カテゴリ別推移・候補の判定はいずれもベンダーごとの月次系列の上で行う)。明細件数に比例する取引履歴は詳細の要求に分け、上限つきで返す。

#### Response partitioning

一覧 (集計値のみ) と詳細 (選んだベンダーの明細) を別の要求にする。画面は詳細を行を選んだときだけ取る。

#### Reliability posture

集計の失敗は画面全体の error として見せ、部分的に誤った数値を出さない。保存 API の失敗は操作単位で返す。migration は加法的で、実装の差し戻しだけで旧状態へ戻れる。

#### Infrastructure verification

新しい binding・依存が増えていないこと。build:bundle 直後の js-budget が緑であること。1 要求で照合処理が 1 回であること。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-subs-infrastructure-web-004 | 配信構成と binding を変えない | ロゴ用の外部取得・キャッシュを足す | ロゴを取得しないため外部依存は要らない | 構成図は既存のまま |
| qa-subs-infrastructure-web-004 | 初回応答はベンダー数 × 月数に比例させ、明細は詳細へ分ける | 1 応答にまとめる | 初回表示を明細量に引きずらせない | 詳細は別要求で取る |
| qa-subs-infrastructure-web-004 | 集計が失敗したら画面全体を error にする | 取れたカードだけ描く | KPI と一覧の合計の食い違いを見せない | 部分表示を持たない |
| dec-subs-kpi-definition / dec-subs-review-candidate | KPI と候補を core 1 関数で算出する | 画面・バッジで個別に計算 | 同じ照合を 1 要求 1 回に畳める | バッジの要求も同じ関数を呼ぶ |
| dec-subs-category / dec-subs-coverage | カテゴリと口座分類は読むたびに算出 (保存しない) | 結果を保存 | 取込後の同期処理が要らない | 計算量はベンダー数 × 月数 + 口座数 × 月数 |
| dec-subs-fixture-authority | 性能の確認も検算済み fixture の規模で行う | 本番データで測る | 再現できる入力で比較できる | — |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker + 既存 web ビルド。binding 追加なし。
- Migration sequence: migration 0043 の Migrate → Worker の Deploy → web の配信。適用後の確認は GET /api/subscriptions の応答に category と reviewCount が含まれること。
- Improvement (既存実装の是正): 画面 1 回の表示で一覧・候補・バッジが同じ照合を 3 回走らせている (`analytics.ts:475`、`subs.ts:167`、`analytics.ts:198-203`)。候補を `subscriptionsScreen` の結果へ寄せると画面からの候補要求が消え、照合は一覧とバッジの 2 回になる。GET /subscriptions が全期間の freee 仕訳を読んでから絞っている箇所 (`analytics.ts:463-471`) は、前期間比と継続中の判定に直前の期間と直近 12 か月が要るため、読み取り範囲を必要な月までに限る余地として扱う。
- Rollback trigger/procedure: 計測が予算を超えたら差し戻す。インフラ構成を変えないため巻き戻しは実装のみ。

## Risks and verification

- Risk/assumption: 前期間比のために直前の同じ長さの期間も計算するため、集計の計算量はおおむね 2 倍になる。ベンダー数 × 月数の上界の内側に収まる見込み。
- Risk/assumption: 詳細の取引履歴に上限が無いと、明細の多いベンダーで応答が肥大する。上限つきで返す。
- Architecture fitness test: 月ごと・ベンダーごとのループ問い合わせが無いこと。新しい binding・依存が増えていないこと。
- Load/failure/security validation: 検算済み fixture の規模での実行時間の計測。build:bundle 直後の js-budget が緑であること。集計失敗時に画面全体が error になること。
