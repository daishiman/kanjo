---
graph_node_id: "arch-subscriptions-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "サブスク画面 — URL の選択・2 本の取得・部品境界と旧 UI の吸収"
project_id: "kanjo"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "frontend"]
file_path: "architecture/subscriptions-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0385cef0f9a5fc253c897319fd57272535bb16b673021801905ecf18a0299dcb"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/frontend.md", "source_version": "0.1.14", "source_digest": "0385cef0f9a5fc253c897319fd57272535bb16b673021801905ecf18a0299dcb", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["packages/web/src/pages/Subscriptions.tsx", "packages/web/src/components/SubVendors.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/ReviewQueue.tsx", "packages/web/src/api.ts", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/pages/analysis/reconciliation", "packages/core/src/design-tokens.ts"]
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
classification_reason: "system-spec の frontend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-frontend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G1", "G2", "G5"]
---
# Architecture overview

サブスク画面 — URL の選択・2 本の取得・部品境界と旧 UI の吸収。`system-spec/frontend.md` は承認時入力、本書は frontend 制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: 現行 `packages/web/src/pages/Subscriptions.tsx` (305 行) は `['subscriptions', key]` の 1 クエリ (:23-26) で `/subscriptions` を叩くが、描画の途中で集計をしている — ベンダーごとの合計 (:61-64)、上位以外を『その他』に畳む月次の和 (:79-82)、ツールチップの月合計 (:267)。0 件のときは空状態の下に `SubVendorsPanel` を描き (:55)、通常時も末尾に同じパネルを描く (:296)。`packages/web/src/components/SubVendors.tsx` (614 行) は登録・別名・対象科目・見直し・未登録候補・一括登録を 1 ファイルに持ち、core の `subsConfidence` を画面側で呼び (:419)、一括登録は `/sub-vendors` を 1 件ずつ順に POST する (:443-460)。変更後の invalidate 対象 `SUBS_KEYS` (:17, :26-31) には `['subscriptions']` `['sub-vendors']` `['sub-candidates']` `['summary']` はあるが、サイドバーのバッジを出す `useReviewQueue` (`packages/web/src/components/ReviewQueue.tsx:28-34`、`REVIEW_QUEUE_KEY`) が入っていない。選択状態を URL に持つ仕組みは無い。
- Quality attribute priorities: G1・G2・G5 に資する。Clean Architecture の Dependency Rule (画面は集計規則を持たない)、Apple HIG の『選択と現在地を見失わせない』『待たせるときは何が起きているかを示す』を適用する。
- Constraints: React 18 + react-router-dom 7 + TanStack Query 5。既存トークン・共通部品・WCAG 2.2 AA。新しい外部依存・チャートライブラリを増やさない (既存の JS バンドル予算)。

## Goals and non-goals

- Goals:
  - G1: 画像の構成 (spec §3〜§8, §11) を `pages/subscriptions/` 配下の部品で組み、読込・空・失敗の各状態を持つ。
  - G2: 選択を URL (`?vendor=<照合キー>`) に保ち、詳細パネル (spec §6) と下部の選択中バー (spec §10) から統合・確認・カテゴリ変更を行う。
  - G5: 旧 UI の機能 (別名・対象科目・四半期見直し・アラート・未登録候補) を画像の部品へ移し、旧パネルを撤去する。共通シェルは変えない。
- Non-goals:
  - 画面側での集計・候補判定・理由文の生成
  - サイドバー・ヘッダー・フッターの作り直し
  - 照合画面の DetailPanel / SelectionActions との共通化

## System context and boundaries

- Users/external systems: 利用者 1 名。ブラウザのみ。
- Trust/deployment/data boundaries: web は API の応答を描き、利用者の操作を API へ送るだけ。金額・カテゴリ・候補・理由文は越境させない。外部 URL (ロゴ) を取得しない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| SubscriptionsPage | 期間 (usePeriod) と `?vendor=` を読み、部品を配置する | ルート `/subscriptions` | packages/web | web ビルド |
| 取得と変更のフック (1 ファイル) | 一覧クエリ・詳細クエリ (依存クエリ)・PUT category / 統合 / 見直し判断 / 採用 / 除外の mutation と invalidate | TanStack Query | packages/web | web ビルド |
| Kpis / CoverageCard | KPI 5 枚とカバー率カード (spec §3, §4) | props | packages/web | web ビルド |
| SubscriptionTable | 検索・ステータス絞込・行チェック・9 列・候補バッジ・合計行 (spec §5) | props + URL | packages/web | web ビルド |
| DetailPanel | 3 タブ (概要 / 取引履歴 / 関連データ)・正規化名とカテゴリ・生の取引名の選択・2 操作 (spec §6) | props + URL | packages/web | web ビルド |
| CategoryTrendChart / AnnualComparison | カテゴリ別推移と年換算比較 (spec §7, §8) | props | packages/web | web ビルド |
| ReasonCard | 検出理由と 3 操作 (spec §9) | props | packages/web | web ビルド |
| SelectionBar | 『N件の取引を選択中』と統合・解除 (spec §10) | props | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: 既存の認証済みシェル配下。web 側で追加の認可判定を持たない。
- Errors/resilience: 一覧と詳細は別のクエリキー・別のエラー表示にする。一覧の失敗は PageState error、詳細の失敗はパネル内に留める。mutation の失敗は操作した部品の近くに文で出す。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 変更後は一覧・詳細・reviewQueue を invalidate し、サイドバーのバッジと画面の件数を同時に更新する。旧 `['sub-candidates']` のクエリと `/sub-vendors/candidates` 依存は画面から外す。

## Subtype architecture

- Frontend: 下記 Frontend architecture を合成
- Backend: N/A: 本章の関心外 (`architecture/subscriptions-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

SPA のクライアント描画。ページは配置だけを持ち、部品は `pages/subscriptions/` 配下の Kpis / CoverageCard / SubscriptionTable / DetailPanel / CategoryTrendChart / AnnualComparison / ReasonCard / SelectionBar に分ける。取得と変更のフックは 1 ファイルに集め、部品は props だけを受ける。

#### Routes, screens and navigation

`/subscriptions` のまま。選択中のサブスクは `?vendor=<照合キー>` に保ち、再読込・戻る・共有で復元する。× で閉じると URL から消す。期間は既存の usePeriod をそのまま使う。

#### Component and design-system boundaries

照合画面 (`packages/web/src/pages/analysis/reconciliation/DetailPanel.tsx`・`SelectionActions.tsx`) の作りを踏襲するが、共通化はしない (画面ごとに操作の語彙が違い、共通部品にすると両方の変更が連動する)。タブは WAI-ARIA の tabs パターン。ロゴの位置には何も置かず、頭文字も描かない。候補バッジと増減は文字と記号を併記する。色は既存トークンのみ。

#### State and data flow

サーバ状態は TanStack Query、選択中のベンダーは URL、生の取引名のチェックと下部バーの選択はページ内のローカル state (URL に載せない。統合を実行するか選択を解除すると空になる)。ステータス絞込は『すべてのステータス / 見直し候補 / 登録済み / 未登録の候補』で、確認済みは一覧に残し候補バッジを『確認済み』にする。『候補を採用』『候補として確認』は登録済みベンダーでは同じ confirmed の送信、『候補から除外』は dismissed の送信。未登録の候補の採用は既存の POST /api/sub-vendors、除外は既存の POST /api/sub-vendors/exclusions を呼ぶ (qa-subs-review-decision-002)。

#### Backend integration

一覧は GET /api/subscriptions (期間つき) の 1 本、詳細は `?vendor=` があるときだけ GET /api/subscriptions/vendors/:key を依存クエリで取る。カテゴリの変更は PUT /api/sub-vendors/:id、統合は POST /api/sub-vendors/:id/aliases、見直し判断は POST / DELETE /api/subscriptions/review-decisions。合計行・カテゴリ別の和・KPI は API の値をそのまま描き、画面で足し直さない。

#### Performance and observability

詳細は選んだときだけ取る (初回表示を明細量に引きずらせない)。取得中は各カードの骨格を保つ。新しい依存を増やさず、JS バンドル予算は build:bundle 直後に測る。

#### Frontend verification

O1 / O2 の DOM テスト (`architecture/subscriptions-ui-ux.md` の Frontend verification と同じ観測点)。URL を直接開いて `?vendor=` の詳細が復元されること。mutation 後にサイドバーのバッジが更新されること (reviewQueue の invalidate)。web に集計 (reduce による金額の和) が残っていないこと。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-subs-frontend-web-006 | 選択を URL (`?vendor=<照合キー>`) に保ち、詳細は依存クエリで取る | ローカル state | 再読込・共有で選択が失われない。他画面 (照合 / 推移 / マトリックス) の慣例と揃う | 照合キーが URL に出る (値は利用者自身のベンダー名の正規化) |
| qa-subs-frontend-web-006 | 部品を `pages/subscriptions/` に分け、取得と変更のフックを 1 ファイルに集める | 1 ファイルの大きなページ | invalidate の対象を 1 か所で揃えられ、バッジの更新漏れ (現行 SUBS_KEYS) を構造で防ぐ | フックの戻り値が部品の props 契約になる |
| qa-subs-frontend-web-006 | 照合画面の DetailPanel / SelectionActions を踏襲し、共通化はしない | 共通部品へ抽出 | 語彙と操作が画面ごとに違い、共通化すると変更が連動する | 似た構造のコードが 2 か所に残る |
| dec-subs-legacy-ui | 旧 SubVendorsPanel / SubsCandidatesPanel / アラート / 前年比較表を撤去し、関連データタブ・検出理由カード・ステータス絞込へ移す | 旧パネルを残す | 画像どおりにしつつ旧機能を失わない | 旧 DOM テストを移設する |
| dec-subs-kpi-definition / dec-subs-fixture-authority | 金額は API の値をそのまま描く。期待値は検算済み fixture | 画面で足し直す | 合計行・KPI・カテゴリ別比較の一致を core 側で保証する | 現行 :61-64 / :79-82 / :267 の画面側集計を消す |
| dec-subs-category / dec-subs-coverage / dec-subs-persistence | カテゴリ・カバー率は API の値を描き、カテゴリ変更は PUT /api/sub-vendors/:id | 画面で辞書を持つ | 辞書と上書きを core 1 か所に置く | 詳細パネルに選択肢を出すため辞書の列挙を API から受ける |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: 取得と変更のフック (invalidate に reviewQueue を含める) → URL 契約 → Kpis / CoverageCard → SubscriptionTable → DetailPanel (依存クエリ) → SelectionBar → CategoryTrendChart / AnnualComparison → ReasonCard → 旧 UI の撤去と旧テストの移設。
- Rollback trigger/procedure: DOM テスト・js-budget・check 系が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 画面側の集計 (Subscriptions.tsx:61-64 / :79-82 / :267) と core の値が並存すると、合計行と KPI が食い違う。新構成では金額の和を web に書かない。
- Risk/assumption: 変更後の invalidate に reviewQueue が無い現状 (SubVendors.tsx:17) のままだと、登録・除外・確認の直後にサイドバーのバッジが古い数を出し続ける。フック 1 ファイルで対象を揃える。
- Risk/assumption: 一括登録が 1 件ずつの順次 POST (SubVendors.tsx:443-460) のため、途中失敗で一部だけ登録される。新 UI で一括採用を残すかは spec §5 に従い、残す場合も失敗した名前を表示する現行の扱いを引き継ぐ。
- Architecture fitness test: web に金額の和・候補判定・`subsConfidence` 呼出しが無いこと。`?vendor=` の直開きで詳細が復元されること。
- Load/failure/security validation: js-budget を超えないこと (build:bundle 直後に測る)。`dangerouslySetInnerHTML` と外部画像 URL が本画面に無いこと。
