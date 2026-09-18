---
graph_node_id: "feat-subscriptions-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "サブスク画面 (09-subscriptions) の作り直しと core 集計・見直し候補の単一化"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "subscriptions", "feature"]
file_path: "features/feat-subscriptions-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "4b15720a81f3bdf4649d3a5185fc91878bb7ae6ca21dd3049de5a2b4a8f21f77"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-subscriptions-screen.md", "source_version": "0.1.11", "source_digest": "0f378382bc04719e3f8ac37722ffb410e33e307359326ee71d5cbf6db03c7757", "imported_at": "2026-09-18T07:21:56Z"}
created_at: "2026-09-18T07:21:56Z"
updated_at: "2026-09-18T07:21:56Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
resource_scope: ["architecture/subscriptions-auth.md", "architecture/subscriptions-backend.md", "architecture/subscriptions-database.md", "architecture/subscriptions-frontend.md", "architecture/subscriptions-infrastructure.md", "architecture/subscriptions-maintenance-ops.md", "architecture/subscriptions-security.md", "architecture/subscriptions-ui-ux.md", "design/FINAL-UI/images/09-subscriptions.png", "docs/data-schema.md", "docs/design-system.md", "docs/ui-decisions.md", "migrations", "packages/api/src/ai/dataset.ts", "packages/api/src/db/schema.ts", "packages/api/src/expense-projection.integration.test.ts", "packages/api/src/overview.test.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/subs.ts", "packages/api/src/store.ts", "packages/api/src/subs-vendor-scope.test.ts", "packages/core/src/analysis.ts", "packages/core/src/dataset.ts", "packages/core/src/design-tokens.ts", "packages/core/src/expense-projection.ts", "packages/core/src/period.ts", "packages/core/src/subs.ts", "packages/core/test/analysis-contract.test.ts", "packages/core/test/expense-projection.test.ts", "packages/core/test/subs-contract.test.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/src/analysis-mutation-invalidation.dom.test.tsx", "packages/web/src/api.ts", "packages/web/src/chart-series-contract.test.ts", "packages/web/src/common-shell.dom.test.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/ReviewQueue.tsx", "packages/web/src/components/SubVendors.dom.test.tsx", "packages/web/src/components/SubVendors.tsx", "packages/web/src/figure-guides.ts", "packages/web/src/mobile-financial-layout.test.ts", "packages/web/src/mobile-financial-visualization.dom.test.tsx", "packages/web/src/pages/Subscriptions.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css", "packages/web/src/subs-review.dom.test.tsx", "specs/spec-subscriptions-screen.md"]
purpose: "サブスク画面を、『毎月の固定費に重複や見直し候補はありますか？』という問いに 1 画面で答え、見直すべき契約を見つけてその場で決着 (名称の統合・未登録候補の採用 / 除外・見直し候補の確認 / 除外) まで進められる場にする。銀行口座・クレジットカード・電子マネーの取引から検出した継続的な支払いを、月額の推定・年換算・カテゴリ・データの出典つきで一覧し、見直し候補の理由を読み、同じサービスの表記ゆれを 1 つにまとめられる状態にする。"
goal: "/subscriptions が 09-subscriptions.png の全構成要素 (問いの見出しと説明文・KPI 5 枚と前期間比・データソースのカバー率カードと最終更新 / 再取得・検索とステータス絞込と候補バッジと合計行を持つ一覧・カテゴリ別の月次推移・年換算の比較・右の詳細パネル (3 タブ・名称編集・生の取引名・直近の取引・データソース別件数・名称を統合・候補として確認)・検出理由カード・下部の選択バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、ロゴ画像を取得も表示もせず、数値と見直し候補が core の純関数 1 か所 (subscriptionsScreen) で算出されて GET /api/subscriptions と GET /api/subscriptions/vendors/:key が返し、KPI 件数・一覧バッジ・検出理由カード・サイドバーのバッジが同じ関数の結果を示し、名称の統合・カテゴリ・見直し判断が migration 0043 と既存表に保存され、旧 UI の操作を失わずに撤去された状態。"
scope_in: ["サブスク画面 (09-subscriptions.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。選択中のサブスクを URL に保ち、期間は既存 usePeriod を引き継ぐ。説明文は『不要な支出の見直しで』に直す", "サブスクの詳細パネル (概要 / 取引履歴 / 関連データの 3 タブ・正規化名とカテゴリの編集・マッチした生の取引名とソース種別・月額の推定と年換算・直近の取引 3 件と『すべて見る (N件)』・データソース別件数・名称を統合・候補として確認) と、生の取引名の選択で出る下部の選択バー", "packages/core の純関数: 推定月額 (年額払いは 12 等分)・年換算・前期間比・直近 12 か月・売上比・カテゴリ既定辞書と利用者上書き・口座名 3 分類とカバー率・カテゴリ別の月次推移と年換算比較・見直し候補の決定論 5 規則と定型文の理由・判断の指紋 (当たった全規則 + 基準金額) を subscriptionsScreen 1 か所に置く。既存 subscriptions() は他画面のため残す", "packages/api: GET /api/subscriptions の拡張 (集計値のみ) と GET /api/subscriptions/vendors/:key の新設 (analyticsRoute)、PUT /api/sub-vendors/:id への category 追加・POST /api/sub-vendors/:id/aliases・POST / DELETE /api/subscriptions/review-decisions の新設 (subsRoute)。aliases の上限を全経路で 50 件 × 100 文字へ揃える", "migration 0043: sub_vendors.category 列と、登録済みベンダーの見直し判断 (confirmed / dismissed と指紋) を保存する表の追加。既存行は書き換えない", "旧 UI (SubVendorsPanel・SubsCandidatesPanel・重複 / 急増アラート・ベンダー別前年比較表・一括登録) を詳細パネル・検出理由カード・ステータス絞込・行ごとの採用 / 除外へ吸収して撤去し、既存テストを新しい置き場所へ移す", "既存実装の是正: 照合の多重計算の畳み込み、見直し期限の判定日を期間の最新月へ、:id の整数検査と 400、同時要求での重複登録の防止、reviewQueue の invalidate、サイドバーのバッジを未判断の見直し候補数へ付け替え", "規則・文テンプレート・カテゴリ辞書・口座の手がかり語彙の docs 記載、検算済み fixture (月額 9,778・年換算 117,336 ほか) による core の境界値テスト・API テスト・DOM テスト、check-financial-visuals の更新とロゴ 0 件の検査"]
scope_out: ["サービスのロゴ・アイコン画像の取得と表示 (利用者指示によりコスト回避。頭文字の代替表示もしない)", "外部サービス・生成 AI による分類や理由文の生成 (決定論の規則と定型文で固定する)。AI 指示文側の候補定義は変えず差を報告する", "サイドバー / ヘッダー / フッター / 月次クローズ進捗の構造変更 (バッジの件数の定義だけを付け替える)", "他の画面 (総収支・推移・マトリックス・診断・照合など) の中身の作り直し (数値の一致確認だけを扱う)", "一覧の行チェックによる一括操作 (チェックだけ置く。§15.4 U-10)", "web 以外のプラットフォーム (web SPA 1 系統のレスポンシブで扱う)"]
acceptance: ["S1 (G1): /subscriptions で 09-subscriptions.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件、ロゴ画像の取得・表示が 0 件である。", "S2 (G2): 任意の行を選ぶと詳細パネルが同じ行の月額推定と年換算を示し、生の取引名を選んで統合すると aliases に反映され、再読込後も同じベンダーにまとまって表示される。", "S3 (G3): 見直し候補の規則と文テンプレートが docs に明記され、境界値テストで固定され、KPI 件数・一覧バッジ・検出理由カード・サイドバーのバッジが同じ件数 (未判断の候補数) を示す。", "S4 (G4): 一覧の合計行・カテゴリ別比較の合計・KPI の月額合計 (登録済みかつ継続中の推定月額の和) が互いに一致し、直近 12 か月の支払額と売上比が既存関数の値と一致する。数値の正本は core の検算済み fixture であり、画像の数値は写し取らない。", "S5 (G5): migration 0043 適用後に既存の登録ベンダー・除外・見直し日時が失われず、旧 UI にあった操作 (別名・対象科目の編集・四半期見直し・アラート・未登録候補の採用 / 除外) がすべて新しい画面から実行できる。"]
architecture_refs: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "I1..I7 は同じ集計契約 (core の subscriptionsScreen → GET /api/subscriptions と vendors/:key → 画面の一覧・詳細パネル・検出理由カード・サイドバーのバッジ) と同じ保存 (migration 0043 と既存表) を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『見直し候補を見つけてその場で決着させる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-subscriptions-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:21:56Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

サブスク画面を、『毎月の固定費に重複や見直し候補はありますか？』という問いに 1 画面で答え、見直すべき契約を見つけてその場で決着 (名称の統合・未登録候補の採用 / 除外・見直し候補の確認 / 除外) まで進められる場にする。銀行口座・クレジットカード・電子マネーの取引から検出した継続的な支払いを、月額の推定・年換算・カテゴリ・データの出典つきで一覧し、見直し候補の理由を読み、同じサービスの表記ゆれを 1 つにまとめられる状態にする。

規範 (要件・集計規則・確定意思決定) の正本は `specs/spec-subscriptions-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/subscriptions が 09-subscriptions.png の全構成要素 (問いの見出しと説明文・KPI 5 枚と前期間比・データソースのカバー率カードと最終更新 / 再取得・検索とステータス絞込と候補バッジと合計行を持つ一覧・カテゴリ別の月次推移・年換算の比較・右の詳細パネル (3 タブ・名称編集・生の取引名・直近の取引・データソース別件数・名称を統合・候補として確認)・検出理由カード・下部の選択バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、ロゴ画像を取得も表示もせず、数値と見直し候補が core の純関数 1 か所 (subscriptionsScreen) で算出されて GET /api/subscriptions と GET /api/subscriptions/vendors/:key が返し、KPI 件数・一覧バッジ・検出理由カード・サイドバーのバッジが同じ関数の結果を示し、名称の統合・カテゴリ・見直し判断が migration 0043 と既存表に保存され、旧 UI の操作を失わずに撤去された状態。

## スコープ

- スコープ内:
  - サブスク画面 (09-subscriptions.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。選択中のサブスクを URL に保ち、期間は既存 usePeriod を引き継ぐ。説明文は『不要な支出の見直しで』に直す
  - サブスクの詳細パネル (概要 / 取引履歴 / 関連データの 3 タブ・正規化名とカテゴリの編集・マッチした生の取引名とソース種別・月額の推定と年換算・直近の取引 3 件と『すべて見る (N件)』・データソース別件数・名称を統合・候補として確認) と、生の取引名の選択で出る下部の選択バー
  - packages/core の純関数: 推定月額 (年額払いは 12 等分)・年換算・前期間比・直近 12 か月・売上比・カテゴリ既定辞書と利用者上書き・口座名 3 分類とカバー率・カテゴリ別の月次推移と年換算比較・見直し候補の決定論 5 規則と定型文の理由・判断の指紋 (当たった全規則 + 基準金額) を subscriptionsScreen 1 か所に置く。既存 subscriptions() は他画面のため残す
  - packages/api: GET /api/subscriptions の拡張 (集計値のみ) と GET /api/subscriptions/vendors/:key の新設 (analyticsRoute)、PUT /api/sub-vendors/:id への category 追加・POST /api/sub-vendors/:id/aliases・POST / DELETE /api/subscriptions/review-decisions の新設 (subsRoute)。aliases の上限を全経路で 50 件 × 100 文字へ揃える
  - migration 0043: sub_vendors.category 列と、登録済みベンダーの見直し判断 (confirmed / dismissed と指紋) を保存する表の追加。既存行は書き換えない
  - 旧 UI (SubVendorsPanel・SubsCandidatesPanel・重複 / 急増アラート・ベンダー別前年比較表・一括登録) を詳細パネル・検出理由カード・ステータス絞込・行ごとの採用 / 除外へ吸収して撤去し、既存テストを新しい置き場所へ移す
  - 既存実装の是正: 照合の多重計算の畳み込み、見直し期限の判定日を期間の最新月へ、:id の整数検査と 400、同時要求での重複登録の防止、reviewQueue の invalidate、サイドバーのバッジを未判断の見直し候補数へ付け替え
  - 規則・文テンプレート・カテゴリ辞書・口座の手がかり語彙の docs 記載、検算済み fixture (月額 9,778・年換算 117,336 ほか) による core の境界値テスト・API テスト・DOM テスト、check-financial-visuals の更新とロゴ 0 件の検査
- スコープ外:
  - サービスのロゴ・アイコン画像の取得と表示 (利用者指示によりコスト回避。頭文字の代替表示もしない)
  - 外部サービス・生成 AI による分類や理由文の生成 (決定論の規則と定型文で固定する)。AI 指示文側の候補定義は変えず差を報告する
  - サイドバー / ヘッダー / フッター / 月次クローズ進捗の構造変更 (バッジの件数の定義だけを付け替える)
  - 他の画面 (総収支・推移・マトリックス・診断・照合など) の中身の作り直し (数値の一致確認だけを扱う)
  - 一覧の行チェックによる一括操作 (チェックだけ置く。§15.4 U-10)
  - web 以外のプラットフォーム (web SPA 1 系統のレスポンシブで扱う)

## 受入

- [ ] S1 (G1): /subscriptions で 09-subscriptions.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件、ロゴ画像の取得・表示が 0 件である。
- [ ] S2 (G2): 任意の行を選ぶと詳細パネルが同じ行の月額推定と年換算を示し、生の取引名を選んで統合すると aliases に反映され、再読込後も同じベンダーにまとまって表示される。
- [ ] S3 (G3): 見直し候補の規則と文テンプレートが docs に明記され、境界値テストで固定され、KPI 件数・一覧バッジ・検出理由カード・サイドバーのバッジが同じ件数 (未判断の候補数) を示す。
- [ ] S4 (G4): 一覧の合計行・カテゴリ別比較の合計・KPI の月額合計 (登録済みかつ継続中の推定月額の和) が互いに一致し、直近 12 か月の支払額と売上比が既存関数の値と一致する。数値の正本は core の検算済み fixture であり、画像の数値は写し取らない。
- [ ] S5 (G5): migration 0043 適用後に既存の登録ベンダー・除外・見直し日時が失われず、旧 UI にあった操作 (別名・対象科目の編集・四半期見直し・アラート・未登録候補の採用 / 除外) がすべて新しい画面から実行できる。

## アーキテクチャ参照

- `architecture_refs`: `arch-subscriptions-ui-ux`, `arch-subscriptions-frontend`, `arch-subscriptions-backend`, `arch-subscriptions-database`, `arch-subscriptions-auth`, `arch-subscriptions-security`, `arch-subscriptions-infrastructure`, `arch-subscriptions-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/subscriptions-ui-ux.md`, `architecture/subscriptions-frontend.md`, `architecture/subscriptions-backend.md`, `architecture/subscriptions-database.md`, `architecture/subscriptions-auth.md`, `architecture/subscriptions-security.md`, `architecture/subscriptions-infrastructure.md`, `architecture/subscriptions-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-subscriptions-screen` (feature ノードへの依存は無い)
- 依存理由: KPI 月額の定義 (推定月額の和)・見直し候補の 5 規則と指紋・カテゴリ解決・口座 3 分類・判断の 2 値・fixture の正本・別名上限 50 件 × 100 文字の決定が確定していないと、core の返り値型・API 応答・migration・テストの期待値が実装中に揺れるため。照合 (PR #54)・総収支 (#55)・推移 (#56)・マトリックス (#57) は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: `feat-reconciliation` の scope_out に「サブスクなど他画面の中身の作り直し (件数バッジの算出と導線リンクだけを扱う)」が明記されており、本 feature はそのサブスク画面のサイクルに当たる。サイドバーのバッジは件数の定義だけを付け替え、構造は変えない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-subscriptions-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-subscriptions-screen --feature-context features/feat-subscriptions-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-subscriptions-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は本体ファイルに加え、export の呼び出し元・新設 CSS クラスの定義先・型で結ばれた宣言・本体を import するだけのファイル (テストを含む) まで引いた (前サイクル feat-expense-matrix の教訓)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (未登録候補のバッジ文言・推移の系列数・カテゴリ色の割当・理由文の最終文言など) は `specs/spec-subscriptions-screen.md` §15.4 の未決事項を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
