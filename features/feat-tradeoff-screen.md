---
graph_node_id: "feat-tradeoff-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "トレードオフ画面 (15-tradeoff) の作り直しと候補・必要度・試算・推奨の導出の core 単一化"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "tradeoff", "feature"]
file_path: "features/feat-tradeoff-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0cd6383f1bef69d2823c0c3ef4311b2f5965f4511f53c2d243d88a2368d7a080"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-tradeoff-screen.md", "source_version": "0.1.11", "source_digest": "c8e0a9916717d3737901c4eff102ba3cf58bd829be74618be75c8b9514be9d16", "imported_at": "2026-09-21T22:47:09Z"}
created_at: "2026-09-21T22:47:09Z"
updated_at: "2026-09-21T22:47:09Z"
depends_on: ["spec-tradeoff-screen"]
related_nodes: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
resource_scope: [".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "architecture/tradeoff-auth.md", "architecture/tradeoff-backend.md", "architecture/tradeoff-database.md", "architecture/tradeoff-frontend.md", "architecture/tradeoff-infrastructure.md", "architecture/tradeoff-maintenance-ops.md", "architecture/tradeoff-security.md", "architecture/tradeoff-ui-ux.md", "design/FINAL-UI/images/15-tradeoff.png", "docs/spec-v1.1.md", "migrations", "packages/api/src/db/schema.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/schema-guard.test.ts", "packages/api/src/schema-guard.ts", "packages/core/src/analysis.ts", "packages/core/src/diagnosis-detectors.ts", "packages/core/src/index.ts", "packages/core/src/tradeoff-screen.ts", "packages/core/test/diagnosis-detectors-contract.test.ts", "packages/core/test/tradeoff-review-contract.test.ts", "packages/core/test/tradeoff-screen-contract.test.ts", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/analysis-query-invalidation.ts", "packages/web/src/api.ts", "packages/web/src/common-shell-routes.dom.test.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/pages/Tradeoff.tsx", "packages/web/src/pages/tradeoff", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css", "packages/web/src/tradeoff-review.dom.test.tsx", "specs/spec-tradeoff-screen.md"]
purpose: "トレードオフ画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が『新しい支出を増やすなら、何を見直しますか？』に 1 画面で答え切れる場にする。新しい支出を置くと、事業経費を科目×取引先で並べた見直し候補から削減先を選べ、core が決まったルールで出す推奨の組み合わせを参考に、年間の差額と防衛ラインへの影響を確かめてから条件を記録し、サブスク・予算・明細の画面で手を打てるようにする。アプリは LLM を呼ばず、試算の数字はすべて core の 1 か所から導く。"
goal: "/tradeoff が 15-tradeoff.png の構成 (見出しと問い・分析期間カード・1.新しい支出を設定 (支出名・金額・単発 / 毎月・開始月・メモ)・2.見直し候補の選択 (# / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ の表と検索・カテゴリ絞込・全クリア・すべて表示)・3.推奨の組み合わせ (上位 4 件と理由と関連ページ)・計算例 2 種・右側の試算結果と防衛ラインへの影響・下部の選択中バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、候補・推移・必要度 (決定 010 / 011)・理由・試算 (年額・差額・単発の計上、開始月は計算に効かない)・防衛ラインへの影響・推奨の順位が core の純関数 1 か所で導かれて右パネル・選択中バー・計算例が同じ値を示し、GET /api/tradeoff の作り直し・POST /api/tradeoff のサーバ再計算 (covered / verdict / value を受け取らず 422 で未知キーを拒否)・PUT /api/tradeoff/candidates/:key の新設と追加のみの migration 0050 (予定番号) で上書きと試算の履歴が残り、保存一覧と翌月の突合を画面から外しても既存の tradeoffReview・defenseLine・診断検知器の数字とテストが変わらない状態。"
scope_in: ["トレードオフ画面 (15-tradeoff.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Tradeoff.tsx を packages/web/src/pages/tradeoff/ 配下の部品 (ページ本体・新しい支出のフォーム・候補表・推奨の表・試算結果パネル・計算例・選択中バー) へ分割する (qa-tradeoff-frontend-web-001)", "期間を共通の usePeriod のまま使い、候補は期間の終了月から遡る 3 か月で作る (FR-1)", "packages/core の純関数: 科目×取引先の候補集計と直近 3 か月平均・推移の 3 区分・必要度の推定 (qa-tradeoff-decision-010 / 011、上書き優先)・自動の理由の文と関連ページ・試算 (年額・差額・判定・単発の計上、開始月は計算に効かない)・防衛ラインへの影響・推奨の組み合わせの列挙と評価と順位と理由・候補キーの組み立て・claimPart 正規化の export を 1 か所に置く", "packages/api: GET /api/tradeoff の応答の作り直し、POST /api/tradeoff の入力の作り直しとサーバでの再計算 (covered / verdict / selected.value を受け取らず、現在の候補に無いキーは 422)、PUT /api/tradeoff/candidates/:key の新設 (必要度とメモの upsert、user_id で分離)", "追加のみの migration (予定番号 0050): tradeoff_plans への start_month・memo 列の追加と新表 tradeoff_candidate_notes (一意索引 (user_id, candidate_key))。既存行は書き換えず、schema.ts と EXPECTED_D1_MIGRATION を同じ変更で進める", "選択中バー、候補表の検索・カテゴリ絞込・全クリア・すべて表示、推奨の理由と関連ページへのリンク、計算例、防衛ラインが出せないときの文、変更成功後の tradeoff query だけの invalidate", "docs/spec-v1.1.md の FR-09 への規則表 (候補・推移・必要度・理由・推奨の順位・防衛ラインへの影響) の明記と、core の境界値テスト・API の Contract tests・DOM テスト。tradeoff-review.dom.test.tsx は『突合の表示が無いこと』を確かめる形へ意図を置き換える"]
scope_out: ["共通シェル (ヘッダーの取引ライン・検索・ダウンロード・ヘルプ、サイドバー、フッター、月次クローズの進捗、改善を送る) の作り直し。既存の PageShell のまま使う", "保存済みの試算の一覧と翌月の突合の画面表示 (qa-tradeoff-decision-004)。既存の tradeoff_plans の行と tradeoffReview 関数・そのテストは残す", "アプリから LLM を呼ぶこと、AI分析レポートからの推奨の取り込み (qa-tradeoff-decision-003)", "既存の tradeoff_plans の行やテーブルの削除・書換、税・手数料の考慮", "既存の defenseLine・/api/defense-line・ヘッダーのバッジ・概要画面・診断の検知器・tradeoffCandidates (分析ハブの改善余地) の数字の変更", "画像の数値 (金額・件数・取引先名) の再現と、web 以外のプラットフォーム (web SPA 1 系統のレスポンシブで扱う)"]
acceptance: ["S1 (G1 / O1): /tradeoff で 15-tradeoff.png の構成要素 (見出しと問い・分析期間カード・1.新しい支出の 5 入力・2.候補表の 7 列と検索・カテゴリ絞込・全クリア・3.推奨の表と理由とリンク・計算例 2 種・右側の試算結果と防衛ラインへの影響・選択中バー) がすべて描画され、色はトークン・ボタンは共通 Button・期間は usePeriod 経由で、直書き色が 0 件、読込 / 空 / 失敗の各状態が DOM テストで固定されている。", "S2 (G2 / O2): 年額・差額・防衛ラインへの影響を core の 1 関数だけが決め、毎月 80,000・削減 85,000/月 で差額 −60,000 などの計算例が toBe で固定され、防衛ラインの境界 (試算後 0 = 維持、−1 = 割れる) と nodata、開始月を変えても結果が変わらないことがテストされ、右パネル・選択中バー・計算例の 3 か所が同じ値を示し、web と api に ×12・差額の式の重複が無い。", "S3 (G3 / O3): 候補が科目×取引先の経費全体から出て、必要度 (決定 010 の 4 行・検知器に当たっても下がらない 011)・推移 (±10% の境界)・理由 (当たりなし・当たりあり・メモ優先) が全行に付き、PUT で保存した必要度の上書きとメモが再読込後も残る。", "S4 (G4 / O4): 同じ入力で同じ推奨の上位 4 件と理由・関連ページが返り (toEqual)、届かない組み合わせが入らず、順位の各段で差が付く入力が固定されている。", "S5 (G5 / O5): 『この条件で試算』を押すたびに 1 行が追加され、サーバが core で再計算した covered (0〜1e10 の整数) と verdict だけが保存され、未知の候補キーは 422、zod の上限 +1 は 400、認証なしは 401、利用者 A / B が分離され、再訪時に最新の条件が復元され、migration 0050 の適用で既存の tradeoff_plans 行の更新が 0 件である。", "S6 (全体): typecheck・lint・verify:full・core / api / web のテスト・初期 JS 予算が緑で、既存の tradeoff-review-contract と diagnosis-detectors-contract のテストが緑のまま残る。受入は実行済みの最新のテスト証跡だけで判定する。"]
architecture_refs: ["arch-tradeoff-ui-ux", "arch-tradeoff-frontend", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-auth", "arch-tradeoff-security", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "候補と必要度と試算の純関数 (core) → GET の応答・POST のサーバ再計算・PUT の上書き (API) → start_month・memo 列と候補の上書き表 (migration 0050) → 候補表・推奨・試算結果・選択中バー (画面) → 利用者分離と未知キーの 422 (認可・入力検査) が同じ試算の契約を起点に連鎖する 1 つの価値単位で、画面だけ・API だけでは『新しい支出の捻出先を 1 画面で決めて記録する』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-tradeoff-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:47:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# 目的

> **生成投影:** 本書は `specs/spec-tradeoff-screen.md` を実装単位へ投影した計画文書であり、規則の正本ではない。重複する説明に差がある場合は spec を優先し、spec の変更後に本書と task / architecture を再生成・同期する。チェック欄と `active` / `ready` / `implementation_readiness` は計画状態であり、公開・本番適用・最新検証の完了は示さない。

トレードオフ画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が『新しい支出を増やすなら、何を見直しますか？』に 1 画面で答え切れる場にする。新しい支出を置くと、事業経費を科目×取引先で並べた見直し候補から削減先を選べ、core が決まったルールで出す推奨の組み合わせを参考に、年間の差額と防衛ラインへの影響を確かめてから条件を記録し、サブスク・予算・明細の画面で手を打てるようにする。アプリは LLM を呼ばず、試算の数字はすべて core の 1 か所から導く。

規範 (要件・候補と必要度と試算と推奨の規則・確定意思決定 qa-tradeoff-decision-001〜012) の正本は `specs/spec-tradeoff-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/tradeoff が 15-tradeoff.png の構成 (見出しと問い・分析期間カード・1.新しい支出を設定 (支出名・金額・単発 / 毎月・開始月・メモ)・2.見直し候補の選択 (# / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ の表と検索・カテゴリ絞込・全クリア・すべて表示)・3.推奨の組み合わせ (上位 4 件と理由と関連ページ)・計算例 2 種・右側の試算結果と防衛ラインへの影響・下部の選択中バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、候補・推移・必要度 (決定 010 / 011)・理由・試算 (年額・差額・単発の計上、開始月は計算に効かない)・防衛ラインへの影響・推奨の順位が core の純関数 1 か所で導かれて右パネル・選択中バー・計算例が同じ値を示し、GET /api/tradeoff の作り直し・POST /api/tradeoff のサーバ再計算 (covered / verdict / value を受け取らず 422 で未知キーを拒否)・PUT /api/tradeoff/candidates/:key の新設と追加のみの migration 0050 (予定番号) で上書きと試算の履歴が残り、保存一覧と翌月の突合を画面から外しても既存の tradeoffReview・defenseLine・診断検知器の数字とテストが変わらない状態。

## スコープ

- スコープ内:
  - トレードオフ画面 (15-tradeoff.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し。packages/web/src/pages/Tradeoff.tsx を packages/web/src/pages/tradeoff/ 配下の部品 (ページ本体・新しい支出のフォーム・候補表・推奨の表・試算結果パネル・計算例・選択中バー) へ分割する (qa-tradeoff-frontend-web-001)
  - 期間を共通の usePeriod のまま使い、候補は期間の終了月から遡る 3 か月で作る (FR-1)
  - packages/core の純関数: 科目×取引先の候補集計と直近 3 か月平均・推移の 3 区分・必要度の推定 (qa-tradeoff-decision-010 / 011、上書き優先)・自動の理由の文と関連ページ・試算 (年額・差額・判定・単発の計上、開始月は計算に効かない)・防衛ラインへの影響・推奨の組み合わせの列挙と評価と順位と理由・候補キーの組み立て・claimPart 正規化の export を 1 か所に置く
  - packages/api: GET /api/tradeoff の応答の作り直し、POST /api/tradeoff の入力の作り直しとサーバでの再計算 (covered / verdict / selected.value を受け取らず、現在の候補に無いキーは 422)、PUT /api/tradeoff/candidates/:key の新設 (必要度とメモの upsert、user_id で分離)
  - 追加のみの migration (予定番号 0050): tradeoff_plans への start_month・memo 列の追加と新表 tradeoff_candidate_notes (一意索引 (user_id, candidate_key))。既存行は書き換えず、schema.ts と EXPECTED_D1_MIGRATION を同じ変更で進める
  - 選択中バー、候補表の検索・カテゴリ絞込・全クリア・すべて表示、推奨の理由と関連ページへのリンク、計算例、防衛ラインが出せないときの文、変更成功後の tradeoff query だけの invalidate
  - docs/spec-v1.1.md の FR-09 への規則表 (候補・推移・必要度・理由・推奨の順位・防衛ラインへの影響) の明記と、core の境界値テスト・API の Contract tests・DOM テスト。tradeoff-review.dom.test.tsx は『突合の表示が無いこと』を確かめる形へ意図を置き換える
- スコープ外:
  - 共通シェル (ヘッダーの取引ライン・検索・ダウンロード・ヘルプ、サイドバー、フッター、月次クローズの進捗、改善を送る) の作り直し。既存の PageShell のまま使う
  - 保存済みの試算の一覧と翌月の突合の画面表示 (qa-tradeoff-decision-004)。既存の tradeoff_plans の行と tradeoffReview 関数・そのテストは残す
  - アプリから LLM を呼ぶこと、AI分析レポートからの推奨の取り込み (qa-tradeoff-decision-003)
  - 既存の tradeoff_plans の行やテーブルの削除・書換、税・手数料の考慮
  - 既存の defenseLine・/api/defense-line・ヘッダーのバッジ・概要画面・診断の検知器・tradeoffCandidates (分析ハブの改善余地) の数字の変更
  - 画像の数値 (金額・件数・取引先名) の再現と、web 以外のプラットフォーム (web SPA 1 系統のレスポンシブで扱う)

## 受入

- [ ] S1 (G1 / O1): /tradeoff で 15-tradeoff.png の構成要素 (見出しと問い・分析期間カード・1.新しい支出の 5 入力・2.候補表の 7 列と検索・カテゴリ絞込・全クリア・3.推奨の表と理由とリンク・計算例 2 種・右側の試算結果と防衛ラインへの影響・選択中バー) がすべて描画され、色はトークン・ボタンは共通 Button・期間は usePeriod 経由で、直書き色が 0 件、読込 / 空 / 失敗の各状態が DOM テストで固定されている。
- [ ] S2 (G2 / O2): 年額・差額・防衛ラインへの影響を core の 1 関数だけが決め、毎月 80,000・削減 85,000/月 で差額 −60,000 などの計算例が toBe で固定され、防衛ラインの境界 (試算後 0 = 維持、−1 = 割れる) と nodata、開始月を変えても結果が変わらないことがテストされ、右パネル・選択中バー・計算例の 3 か所が同じ値を示し、web と api に ×12・差額の式の重複が無い。
- [ ] S3 (G3 / O3): 候補が科目×取引先の経費全体から出て、必要度 (決定 010 の 4 行・検知器に当たっても下がらない 011)・推移 (±10% の境界)・理由 (当たりなし・当たりあり・メモ優先) が全行に付き、PUT で保存した必要度の上書きとメモが再読込後も残る。
- [ ] S4 (G4 / O4): 同じ入力で同じ推奨の上位 4 件と理由・関連ページが返り (toEqual)、届かない組み合わせが入らず、順位の各段で差が付く入力が固定されている。
- [ ] S5 (G5 / O5): 『この条件で試算』を押すたびに 1 行が追加され、サーバが core で再計算した covered (0〜1e10 の整数) と verdict だけが保存され、未知の候補キーは 422、zod の上限 +1 は 400、認証なしは 401、利用者 A / B が分離され、再訪時に最新の条件が復元され、migration 0050 の適用で既存の tradeoff_plans 行の更新が 0 件である。
- [ ] S6 (全体): typecheck・lint・verify:full・core / api / web のテスト・初期 JS 予算が緑で、既存の tradeoff-review-contract と diagnosis-detectors-contract のテストが緑のまま残る。受入は実行済みの最新のテスト証跡だけで判定する。

## アーキテクチャ参照

- `architecture_refs`: `arch-tradeoff-ui-ux`, `arch-tradeoff-frontend`, `arch-tradeoff-backend`, `arch-tradeoff-database`, `arch-tradeoff-auth`, `arch-tradeoff-security`, `arch-tradeoff-infrastructure`, `arch-tradeoff-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/tradeoff-ui-ux.md`, `architecture/tradeoff-frontend.md`, `architecture/tradeoff-backend.md`, `architecture/tradeoff-database.md`, `architecture/tradeoff-auth.md`, `architecture/tradeoff-security.md`, `architecture/tradeoff-infrastructure.md`, `architecture/tradeoff-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-tradeoff-screen` (feature ノードへの依存は無い)
- 依存理由: 必要度の規則 (決定 010 / 011)・試算の式と開始月の扱い (決定 005 / 009、FR-3)・推奨の列挙範囲と順位・候補キーの形・POST で受け取る項目と 422・migration 0050 の列と新表が確定していないと、core の返り値型・API 応答・migration・テストの期待値が実装中に揺れるため。AI分析 (#66)・明細仕分け (#65)・決算書 (#64)・家計収支 (#62)・診断 (#59) の各画面は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: 既存の feature はいずれもトレードオフ画面の中身を scope_in に持たない。分析ハブの `tradeoffCandidates` (改善余地) と `defenseLine` は読むだけで数字を変えない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-tradeoff-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-tradeoff-screen --feature-context features/feat-tradeoff-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-tradeoff-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は本体ファイルに加え、Tradeoff.tsx の import 先 (api.ts・共通部品・period)、Tradeoff.tsx を import するファイル (AuthenticatedApp.tsx と DOM テスト)、tradeoff_plans を参照する schema と schema-guard、tradeoff query の invalidate 表、反映手順の workflow まで引いた。新設予定の `packages/core/src/tradeoff-screen.ts`・`packages/core/test/tradeoff-screen-contract.test.ts`・`packages/web/src/pages/tradeoff/` は予定の置き場所であり、名前は該当 task の設計で確定する。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (本文で「agent 推定・利用者未確認」と注記した値: 候補表の 10 件、推移の初月 0、組み合わせの列挙範囲と順位、充足度の丸め、新表の形、文字数と金額の上限、422 の文、migration 番号など) は `specs/spec-tradeoff-screen.md` の未決事項を正本とし、該当 task の契約テストで確定する。候補キーは持ち越さず、spec の可逆な versioned JSON tuple 形式に従う。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
