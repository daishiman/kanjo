---
graph_node_id: "arch-subscriptions-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "サブスク画面 — core の subscriptionsScreen 1 か所と既存 API の延長"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "backend"]
file_path: "architecture/subscriptions-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "102b53266ca9482459d9e09387eee03cbf38511e454facd753abccbfde75e7c0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "102b53266ca9482459d9e09387eee03cbf38511e454facd753abccbfde75e7c0", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["packages/core/src/analysis.ts", "packages/core/src/subs.ts", "packages/core/src/expense-projection.ts", "packages/core/src/cash.ts", "packages/core/src/analysis-hub.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/subs.ts", "packages/api/src/store.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G3", "G4", "G5"]
---
# Architecture overview

サブスク画面 — core の subscriptionsScreen 1 か所と既存 API の延長。`system-spec/backend.md` は承認時入力、本書は backend 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: 集計は `packages/core/src/analysis.ts` の `subscriptions()` (:414-472) にあり、KPI の `monthlyTotal` は最新記帳月の実支払、`annualized` はその ×12、`revenueShare` は直近 3 か月平均 ÷ 売上平均。アラートは dup / spike (:455-465)。四半期見直しは `subsReviewStatus` (:1485、`SUBS_REVIEW_INTERVAL_MONTHS=3` は :1464)。`subscriptions()` は `tradeoffCandidates` (:1313) と AI 用の `packages/api/src/ai/dataset.ts:169` からも呼ばれる。検出は `packages/core/src/subs.ts` — `vendorKey` (:31-37)、`matchSubVendor` (:58-74)、`subsCandidates` (:105-170)、`subsConfidence` (:196-216)、`autoRegisterable` (:219)。API は `packages/api/src/routes/analytics.ts:459-476` の GET /subscriptions が `sourceNeutralSubscriptions` (`packages/core/src/expense-projection.ts:264-293`) を返す。同じ明細の照合 (`buildExpenseProjection`) は `sourceNeutralSubscriptionDeals` (:296-306) からも走り、これを GET /sub-vendors/candidates (`packages/api/src/routes/subs.ts:158-178`)、サイドバーのバッジ (`analytics.ts:197-203`、`subsCandidates` の件数・上限 20)、AI の指示文 (`packages/api/src/routes/ai.ts:168-172`、上限 10) がそれぞれ別に呼ぶ。GET /sub-vendors (`subs.ts:52-87`) は四半期見直しの日付を route の `new Date()` で決める (:82-85)。カテゴリ、見直し候補の判定、口座の 3 分類 (`packages/core/src/cash.ts:71-80` の `paymentMethodOf` は cash / card / account / unknown の 4 値で電子マネーが無い)、サブスク用の前期間比はコードに無い。汎用の `previousPeriod` は `packages/core/src/analysis-hub.ts:38` にある。
- Quality attribute priorities: G3・G4・G5 に資する。Clean Architecture の Dependency Rule (core ← api ← web の一方向) と application-architecture / data-access の境界 (core は D1 を知らない) を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1 + Drizzle。集計を web 側や API ハンドラ側へ複製しない。理由文の生成に AI を呼ばない。

## Goals and non-goals

- Goals:
  - G3: 見直し候補を core の純関数で決定論的に判定し、KPI の件数・一覧の候補バッジ・検出理由カード・サイドバーのバッジに同じ結果を出す。
  - G4: サブスク画面の数値を core の `subscriptionsScreen(data, deals, vendors, decisions, period)` 1 か所で算出し、GET /api/subscriptions をその形へ拡張する (spec §13)。
  - G5: 保存 API は既存の /api/sub-vendors 系を延長し、見直し判断だけを新設する。
- Non-goals:
  - 外部 AI・ロゴ取得の経路
  - 総収支・推移・分析ハブの集計の変更 (数値は突き合わせるが定義は変えない)
  - AI レポート (ai.ts / ai/dataset.ts) の候補定義の変更

## System context and boundaries

- Users/external systems: web (サブスク画面・サイドバーのバッジ)。外部サービスは呼ばない。
- Trust/deployment/data boundaries: core は `Dataset`・照合後の明細・登録ベンダー・見直し判断・期間だけを受け取る。route が userId で読み出して純関数へ渡し、結果を JSON へ写す。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core `subscriptionsScreen` | 推定月額・継続中・KPI (月額 / 年換算 / 前期間比 / 直近 12 か月 / 売上比)・カテゴリ・口座 3 分類とカバー率・カテゴリ別推移と年換算比較・見直し候補と理由文 | 純関数 | packages/core | core ビルド |
| core カテゴリ辞書 | 正規化名 → カテゴリの既定辞書 (vendorKey / NFKC で照合)、当たらなければ『その他』 | 定数 + 関数 | packages/core | core ビルド |
| core 口座分類 | `paymentMethodOf` を拡張し 銀行口座 / クレジットカード / 電子マネー (NFKC)、分類できない口座は別に数える | 純関数 | packages/core | core ビルド |
| GET /api/subscriptions | 期間つきで subscriptionsScreen の結果 (集計値のみ) を返す | HTTP JSON | packages/api (analyticsRoute) | Worker |
| GET /api/subscriptions/vendors/:key | 詳細パネル用 — 生の取引名とソース種別・直近 3 件と件数・データソース別件数・取引履歴 (上限つき) | HTTP JSON | packages/api | Worker |
| PUT /api/sub-vendors/:id (category 追加) / POST /api/sub-vendors/:id/aliases | カテゴリの上書き / 名称の統合 | HTTP JSON | packages/api (subsRoute) | Worker |
| POST / DELETE /api/subscriptions/review-decisions | 登録済みベンダーの見直し判断 (confirmed / dismissed) とその取消 | HTTP JSON | packages/api | Worker |
| 既存 POST /api/sub-vendors / POST /api/sub-vendors/exclusions | 未登録候補の採用 / 除外。POST /api/sub-vendors は応答に作成 `id` を足した (`{ok, id}`、加法のみ。詳細で統合先をその場で作って自動で選ぶため) | HTTP JSON | packages/api (subsRoute) | Worker |

## Cross-cutting contracts

- Identity/access: 新設経路は既存 subsRoute / analyticsRoute に足し、`/api/*` の authGuard と mustChangePasswordFence の内側に置く。`:id` / `:key` は userId と組で引く (`architecture/subscriptions-auth.md`)。
- Errors/resilience: 入力の許可リスト違反は 400、見つからない `:id` / `:key` は 404。エラー応答に SQL・スタック・内部パスを含めない。集計が失敗したら GET /api/subscriptions 全体を失敗として返す (部分的な数値を返さない)。
- Observability/audit: 監査ログに明細金額・取引先名を書かない。
- Configuration/secrets: 追加の設定値・秘密情報を持たない。
- Compatibility/versioning: GET /api/subscriptions は応答を拡張する (画面は同時に作り直す)。`subscriptions()` を使う `tradeoffCandidates` と AI 用 dataset は既存の定義のまま動き続けることをテストで確かめる。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/subscriptions-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/subscriptions-database.md`)
- Security: N/A: 本章の関心外 (`architecture/subscriptions-security.md`)

### Backend architecture

#### Aggregation rules

入力は既存の `sourceNeutralSubscriptions` の照合後の明細で、別経路で明細を数え直さない。推定月額は、直近 12 か月の支払い間隔が 11〜13 か月なら年額払いとして最新の支払額 ÷ 12、それ以外は最新の支払額。継続中は、月払いなら最新月か前月に支払いがあること、年額払いなら直近 12 か月に支払いがあること。KPI 月額 = 最新月時点で継続中の各ベンダーの推定月額の和、年換算 = 月額 ×12、前期間比 = `previousPeriod` で取った直前の同じ長さの期間に同じ関数を同じ定義で当てた値との差 (dec-subs-kpi-definition)。カテゴリは既定辞書 → `sub_vendors.category` の上書きが勝つ (dec-subs-category)。カバー率の (分子/分母) = 最新月まで取込済みの口座数 / 口座数、% = 期間の (口座×月) のうち取引がある割合 (dec-subs-coverage)。

#### Review candidate rules

規則は 5 つ — 同じカテゴリ (その他を除く) に継続中が 2 件以上 / 既存 dup の条件 (二重請求の疑い) / 既存 spike の条件 (急増) / 直前の支払額からの値上げ (5% 以上が 2 か月続く) / 四半期見直しの期限切れ (`subsReviewStatus.due`)。複数に当たるときは 二重請求 → 急増 → 値上げ → 重複 → 期限切れ の順に並べる。理由文は規則ごとの定型文に金額・件数・月数を差し込む。指紋は当たった規則の種類すべて (表示順) + 判定時の基準金額で、月は含めない。候補は 未判断 / 確認済み の 2 状態で返し、指紋が一致する dismissed は返さない。KPI『見直し候補 N 件』とサイドバーのバッジは未判断の候補だけを同じ関数で数える (qa-subs-review-decision-002)。判定の基準日は route の `new Date()` ではなく、core へ渡す期間 (最新月) から決める。

#### API contract

GET /api/subscriptions は期間クエリを受け、集計値のみを返す (明細の行は返さない)。GET /api/subscriptions/vendors/:key は生の取引名とソース種別・直近 3 件と総件数・データソース別件数・取引履歴 (上限つき) を返す。PUT /api/sub-vendors/:id に category を加法的に足す。POST /api/sub-vendors/:id/aliases は既存ベンダーの aliases に選んだ取引名を加える (名前自身と重複は除く現行 `cleanAliases` の規則を引き継ぐ)。POST /api/subscriptions/review-decisions は `{vendorKey, decision: confirmed | dismissed}` を受けて (user_id, vendor_key) で upsert し、DELETE で取り消す。登録済みベンダーには adopted を持たない。

#### Data access

読み出しは route が userId で絞り、core は D1 / Hono の型を参照しない。サイドバーのバッジ (`/review-queue`) と GET /api/subscriptions は同じ core 関数から件数を取り、`subsCandidates(…, 20, …).length` の別定義を置き換える。照合後の明細を得る処理 (`buildExpenseProjection`) は 1 回の要求で 1 回だけ走らせる。

#### Backend verification

core の単体テストで 5 規則の境界値・並び順・理由文テンプレート・指紋・2 状態を固定する。KPI 月額 = 一覧の推定月額の和 = カテゴリ別合計、last12 = 既存 `last12Total`、既存 `sourceNeutralSubscriptions`・総収支 / 推移の数値と突き合わせて一致させる。API テストで許可リスト違反 400・他利用者の `:id` / `:key` 404。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-subs-kpi-definition | KPI 月額 = 継続中の推定月額の和 (年額払いは 12 等分)、年換算 ×12、前期間比は同じ定義の差 | 最新月の実支払 (現行 `monthlyTotal`) | 一覧の『月額の推定』列の合計と KPI が同じ定義になる | 現行の `subscriptions()` の KPI とは値が変わる。`tradeoffCandidates` 側は既存定義のまま |
| dec-subs-review-candidate | 決定論 5 規則 + 定型文 | AI 生成 / スコア閾値 | KPI・バッジ・理由カード・サイドバーを同じ関数で出せる | 規則と文テンプレートを docs とテストで固定する |
| qa-subs-review-decision-002 | 登録済みの判断は confirmed / dismissed の 2 値。指紋 = 当たった規則すべて (表示順) + 基準金額、月を含めない | adopted を持つ / 最優先規則だけの指紋 | 同じ理由で再び出さず、規則や金額が変われば再提示できる | 月をまたいでも同じ理由なら再提示しない |
| dec-subs-category | 既定辞書 (vendorKey / NFKC) → `sub_vendors.category` の上書きが勝つ、当たらなければ『その他』 | 利用者入力のみ / AI 推定 | 取込直後から埋まり、直せば以後は上書きが勝つ | 辞書の更新は core の変更 |
| dec-subs-coverage | `paymentMethodOf` を拡張して 3 分類、分類できない口座は別に数える | 利用者が口座種別を入力 | 追加入力なしで画像のカードが成立する | 口座名の手がかりに当たらない口座が出る |
| dec-subs-persistence | 既存 /api/sub-vendors 系を延長し、見直し判断だけ新設 | サブスク専用 API 群を新設 | 既存の照合 (`matchSubVendor`) と候補除外がそのまま保存先になる | aliases の上限を全経路で 50 件 × 100 文字へ揃える (利用者決定 2026-09-18) |
| dec-subs-legacy-ui / dec-subs-fixture-authority | 旧 UI の機能は API で失わず、数値の期待値は検算済み fixture | 画像の数値を期待値にする | 画像の合計欄は閉じていない | fixture は core のテストに置く |
| qa-subs-backend-web-007 | `subscriptionsScreen` は照合後の明細を入力にし、別経路で数え直さない | 画面ごとに再計算 | 総収支 / 推移と同じ明細から数える | 照合処理の重複呼出しを畳む |
| dec-subs-persistence (既定を採用 2026-09-18) | 読取り (GET /api/subscriptions・GET /api/subscriptions/vendors/:key) は analyticsRoute、書込み (review-decisions・aliases・category) は subsRoute に置く | 全経路を subsRoute へ移す | 読取りは Dataset の読込と期間の切り方を analyticsRoute と共有でき、書込みは既存の sub-vendors 系の検証と同じ場所に集まる | 1 つの画面の経路が 2 ファイルに分かれる。invalidate するクエリキーは §13.2 の一覧で揃える |
| qa-subs-backend-web-007 (既定を採用 2026-09-18) | 見直し期限の判定日は route の `new Date()` ではなく、期間の最新月の月末 | 要求時刻のまま | 同じ期間なら同じ結果になり、fixture で固定できる | 過去期間を見ると当時の期限で判定される |
| dec-subs-legacy-ui (既定を採用 2026-09-18) | 旧 UI の一括登録ボタンは撤去し、未登録候補の採用は行ごとの既存 POST /api/sub-vendors で行う | 旧一括登録を残す | 一括登録は途中失敗で残りが止まる (`SubVendors.tsx:443-460`)。行単位なら失敗が 1 件に閉じる | API は変えないので旧経路の利用者データは失わない |
| dec-subs-category (既定を採用 2026-09-18) | 未登録候補のカテゴリは既定辞書だけで決め、上書きは登録後に PUT category で行う | 未登録のまま上書きを保存する表を足す | 上書きの保存先を sub_vendors 1 か所に保てる | 未登録候補が辞書に無ければ『その他』に入る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: カテゴリ辞書と口座 3 分類 → 推定月額・継続中・KPI・前期間比 → 見直し候補 5 規則と理由文・指紋 → `subscriptionsScreen` → GET /api/subscriptions 拡張 → GET /api/subscriptions/vendors/:key → PUT category / POST aliases / review-decisions → `/review-queue` のバッジを同じ関数へ付け替え。migration 0043 の適用 (`architecture/subscriptions-database.md`) を API の配信より先に行う。
- Improvement (既存実装の是正): `sourceNeutralSubscriptionDeals` と `sourceNeutralSubscriptions` が同じ照合を二重に走らせる構造 (`expense-projection.ts:264-306`) を、1 回の照合結果を両者で使う形へ畳む。候補の再計算経路 (`subs.ts:158-178`・`analytics.ts:197-203`) を `subscriptionsScreen` の結果へ寄せる。見直しの基準日を route の `new Date()` (`subs.ts:82-85`) から期間の最新月へ移す。`:id` の検査を `Number.isInteger` で 400 に揃える (現行は POST /:id/review :223 だけが 400、PUT :115 / DELETE :141 は NaN のまま 404)。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻し。migration 0043 は加法的なので、実装の差し戻しだけで旧画面が動く。

## Risks and verification

- Risk/assumption: KPI 月額の定義が実支払から推定月額の和へ変わる。`subscriptions()` を共有する `tradeoffCandidates` (:1313) と AI 用 dataset (`ai/dataset.ts:169`) まで定義を変えると別画面の数値が動くため、`subscriptions()` 自体は残し、画面用の定義は `subscriptionsScreen` に置く。
- Risk/assumption: サイドバーのバッジ (上限 20 の未登録候補数) と AI 指示文の候補 (上限 10) と画面の見直し候補が別定義で並存している。バッジは本サイクルで同じ関数へ寄せ、AI 側は対象外として残る差を報告する。
- Risk/assumption: 同名チェック (`subs.ts:93-96`, :117-122) と候補除外の重複検査 (:191-193) はアプリ側で全件を読んで比較しており、同時要求で重複しうる (除外は `(user_id, vendor_key)` の一意索引があるため挿入が失敗して 500 になりうる)。
- Architecture fitness test: api ハンドラと web に集計・候補判定が無いこと。core が D1 / Hono の型を参照していないこと。KPI 件数とバッジ件数が同じ関数から出ていること。
- Load/failure/security validation: 集計がベンダー数 × 月数に比例すること。照合処理が 1 要求で 1 回であること。許可リスト違反の 400 と他利用者の 404。
- P10 で追加した契約: 集計と詳細の GET は `Cache-Control: private, no-store`。判断の POST は表示中の期間を query に付け、その期間の指紋で保存する (バッジは直近 1 年で数えるので、1 年以外の判断ではバッジが減らないことがある。後続課題)。
