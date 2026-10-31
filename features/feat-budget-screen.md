---
graph_node_id: "feat-budget-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "予算画面 (14-budget) の作り直しと期間別の年額予算・自動提案・防衛ライン余裕の core 一本化"
project_id: "kanjo"
domain: "budget"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "plans", "defense-line", "feature"]
file_path: "features/feat-budget-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "6053a52dbc20ad36091baff49ea504951d67daf2980976391a80dffc1a927d26"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-budget-screen.md", "source_version": "0.1.11", "source_digest": "39365eb48c18b250990bd13ee26da1231ce8ffe16991a3fb9a92b1d3949c628d", "imported_at": "2026-09-21T14:21:48Z"}
created_at: "2026-09-21T14:21:48Z"
updated_at: "2026-09-21T14:21:48Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-auth", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "design/FINAL-UI/images/14-budget.png", "design/FINAL-UI/spec/AUDIT.md", "docs/budget-screen/", "docs/data-schema.md", "docs/runbooks/prod-d1-schema-recovery.md", "docs/ui-decisions.md", "migrations", "package.json", "packages/api/src/ai", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/db/schema.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/budget-plans.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/settings.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/wrangler.jsonc", "packages/core/src/analysis.ts", "packages/core/src/budget-screen.ts", "packages/core/src/dataset.ts", "packages/core/src/diagnosis-detectors.ts", "packages/core/src/diagnosis-screen.ts", "packages/core/src/fingerprint.ts", "packages/core/src/index.ts", "packages/core/src/types.ts", "packages/core/test", "packages/core/test/budget-outlook-contract.test.ts", "packages/web/public/_headers", "packages/web/scripts/check-initial-js-budget.mjs", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/analysis-query-invalidation.ts", "packages/web/src/api.ts", "packages/web/src/budget-outlook.dom.test.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Term.tsx", "packages/web/src/diagnosis-next-action-receivers.dom.test.tsx", "packages/web/src/glossary.ts", "packages/web/src/pages/Budget.tsx", "packages/web/src/pages/budget/", "packages/web/src/period.tsx", "packages/web/src/route-task-detail.test.tsx", "packages/web/src/routeMetadata.ts", "scripts/check-design-tokens.mjs", "scripts/hooks/guard-real-data.sh", "specs/spec-budget-screen.md"]
purpose: "利用者が過去の実績を根拠に来期 12 か月の予算を科目ごと (収入を含む) に決められ、自動提案がどの数値から組み上がったかを確かめ、事業の計画を調整額と理由として足し、その結果が年間の純収支と防衛ラインの余裕にどう効くかをその場で見られ、入力の途中で画面を離れても作業を失わない状態にする。予算の数値は core の純関数 1 か所 (budget-screen.ts) から導き、ヘッダの防衛ライン・診断の予算カバー率・予算の着地見込みと同じ関数を共有させて画面どうしで値をずらさない。"
goal: "/budget が 14-budget.png の全構成要素 (パンくず・期間タブと期間送り・見出しと問い・予算対象の開始月・KPI 4 枚 (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕)・月次グラフ (凡例 5 種と実績/見通しの境目)・今後の見通しの累計とコメント・予算一覧 (検索・実績から提案・すべてリセット・収入行が先頭)・科目パネル (自動提案と計算の詳細・計画による調整・月別推移)・過不足カテゴリ・調整によるインパクト・保存バー (未保存 N 項目・下書き自動保存)・読込 / 空 / 失敗) をトークンと共通部品で描画し、数値が core の budgetScreen / applyBudgetInputs 1 か所から出て KPI・一覧の和・グラフの年合計・見通しの累計が一致し、予算が migration 0050 の期間別の年額表 budget_plans に追加のみで残り、既存 budgets の読み手が monthlyBudgetsAt 経由で同じ値を読み、GET /api/budget-screen・GET/PUT /api/budget-plans が認証と変更系フェンスの内側で動き、外部送信 0 件で既存の数値テストが緑のままの状態。"
scope_in: ["/budget の作り直し (14-budget.png の全構成要素と読込・空 (実績 0 か月)・失敗の各状態)。Budget.tsx (317 行) を packages/web/src/pages/budget/ 配下の container と画面専用部品へ分け、pages/Budget.tsx は互換の re-export 1 行だけ残す", "core の budgetScreen (前期実績・自動提案と根拠の内訳 (前期実績・増減率・季節性補正・計画による調整)・見通し・月次の実績と予算・見通しの累計・KPI 4 つ・過不足・インパクト) と applyBudgetInputs・monthlyBudgetsAt の新設 (packages/core/src/budget-screen.ts)", "収入の行 (売上高・その他収入) を予算の対象に加える (利用者決定 opt-include-income)", "自動提案は決定論 + 利用者が入力する計画による調整 (利用者決定 opt-deterministic-with-plan)", "防衛ライン余裕 = 年間収入予算 − 防衛ラインの月額 × 12 (利用者決定 opt-income-minus-line)", "GET /api/budget-screen・GET /api/budget-plans・PUT /api/budget-plans の新設 (変更系フェンス登録)", "migration 0050_budget_plans.sql (追加のみ。予算対象の期間別の年額表。利用者決定 opt-period-annual-table。番号は予定) と runtimeSchemaGuard への反映", "budget_plans を JSON の書き出しと復元 (Dataset・import-lifecycle) と JSON snapshot の無効化の対象に加える", "既存 budgets の読み手 (診断の予算カバー率・予算の着地見込み・analytics の予算表) を monthlyBudgetsAt 経由に寄せる", "下書きの端末保存と復元・未保存 N 項目・この行を元に戻す・リセット (確認つき)・未保存のまま離れるときの確認", "診断からの ?account= の受け口と routeMetadata の予算の task / taskDetail の文言更新", "設計判断の docs (docs/budget-screen/design-decisions.md) と core 単体・API 統合・migration 検査・DOM テスト"]
scope_out: ["予算の版管理・担当者・承認フロー (利用者決定で版つき案 opt-versioned-plans を退けた。同じ期間は上書き)", "外部 LLM による提案と外部データ (従業員数の推移・類似企業の業界中央値)。取込データを外部へ送らない (C4)。画像の該当文言は計画による調整の理由としてだけ出す", "個人 (家計) の予算 (家計の支出は防衛ラインの算出にだけ効く)", "共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗・『改善を送る』) の作り直し。ヘッダの『取引ライン：正常』は誤記として既存の『防衛ライン』を保つ", "トレードオフ画面", "web 以外の専用アプリ", "旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除 (互換のため残す)", "既存 budgets 表の削除・書き換え (1 行も書き換えない)"]
acceptance: ["S1 (G1): /budget に 14-budget.png の構成要素 (§7.1 の全領域) がすべて描画され、色・余白・部品はトークンと共通部品を通し、直書き色の lint が 0 件。実績 0 か月で空状態になり、画面に『AI』の文字列が 0 件である。", "S2 (G2): 同じ入力で KPI・一覧の来期予算の和・グラフの月次予算の年合計・今後の見通しの累計が一致し、自動提案の各項が科目パネルの『計算の詳細』と一致する。外部送信 0 件。", "S3 (G3): 予算が予算対象の期間ごとに D1 に残り、migration は追加のみで既存行の書き換えが 0 件。保存行の無い期間は既存 budgets の月額 × 12 が初期値になる。", "S4 (G4): 下書きが再読込後に復元でき、保存成功で消え、未保存のまま離れると確認が出る。", "S5 (G5): 防衛ライン・予算カバー率が他画面と同じ関数から出て、既存の診断・概要・家計収支・総収支・決算書・明細仕分けの数値テストが緑のまま。lint・typecheck・初期 JS 予算を CI で通す。"]
architecture_refs: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-auth", "arch-budget-security", "arch-budget-infrastructure", "arch-budget-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "画面・core の budgetScreen / monthlyBudgetsAt・budget-plans API・migration 0050 は同じ『期間別の年額』の契約を起点に連鎖する 1 つの価値単位で、画面だけ・API だけ・算出だけでは『実績を根拠に来期予算を決め、その効き目を確かめて保存する』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-budget-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T14:21:48Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# 目的

利用者が過去の実績を根拠に来期 12 か月の予算を科目ごと (収入を含む) に決められ、自動提案がどの数値から組み上がったかを確かめ、事業の計画を調整額と理由として足し、その結果が年間の純収支と防衛ラインの余裕にどう効くかをその場で見られ、入力の途中で画面を離れても作業を失わない状態にする。予算の数値は core の純関数 1 か所 (budget-screen.ts) から導き、ヘッダの防衛ライン・診断の予算カバー率・予算の着地見込みと同じ関数を共有させて画面どうしで値をずらさない。

規範 (要件・算出規則・確定意思決定・API 契約) の正本は `specs/spec-budget-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/budget が 14-budget.png の全構成要素 (パンくず・期間タブと期間送り・見出しと問い・予算対象の開始月・KPI 4 枚 (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕)・月次グラフ (凡例 5 種と実績/見通しの境目)・今後の見通しの累計とコメント・予算一覧 (検索・実績から提案・すべてリセット・収入行が先頭)・科目パネル (自動提案と計算の詳細・計画による調整・月別推移)・過不足カテゴリ・調整によるインパクト・保存バー (未保存 N 項目・下書き自動保存)・読込 / 空 / 失敗) をトークンと共通部品で描画し、数値が core の budgetScreen / applyBudgetInputs 1 か所から出て KPI・一覧の和・グラフの年合計・見通しの累計が一致し、予算が migration 0050 の期間別の年額表 budget_plans に追加のみで残り、既存 budgets の読み手が monthlyBudgetsAt 経由で同じ値を読み、GET /api/budget-screen・GET/PUT /api/budget-plans が認証と変更系フェンスの内側で動き、外部送信 0 件で既存の数値テストが緑のままの状態。

## スコープ

- スコープ内:
  - /budget の作り直し (14-budget.png の全構成要素と読込・空 (実績 0 か月)・失敗の各状態)。Budget.tsx (317 行) を packages/web/src/pages/budget/ 配下の container と画面専用部品へ分け、pages/Budget.tsx は互換の re-export 1 行だけ残す
  - core の budgetScreen (前期実績・自動提案と根拠の内訳 (前期実績・増減率・季節性補正・計画による調整)・見通し・月次の実績と予算・見通しの累計・KPI 4 つ・過不足・インパクト) と applyBudgetInputs・monthlyBudgetsAt の新設 (packages/core/src/budget-screen.ts)
  - 収入の行 (売上高・その他収入) を予算の対象に加える (利用者決定 opt-include-income)
  - 自動提案は決定論 + 利用者が入力する計画による調整 (利用者決定 opt-deterministic-with-plan)
  - 防衛ライン余裕 = 年間収入予算 − 防衛ラインの月額 × 12 (利用者決定 opt-income-minus-line)
  - GET /api/budget-screen・GET /api/budget-plans・PUT /api/budget-plans の新設 (変更系フェンス登録)
  - migration 0050_budget_plans.sql (追加のみ。予算対象の期間別の年額表。利用者決定 opt-period-annual-table。番号は予定) と runtimeSchemaGuard への反映
  - budget_plans を JSON の書き出しと復元 (Dataset・import-lifecycle) と JSON snapshot の無効化の対象に加える
  - 既存 budgets の読み手 (診断の予算カバー率・予算の着地見込み・analytics の予算表) を monthlyBudgetsAt 経由に寄せる
  - 下書きの端末保存と復元・未保存 N 項目・この行を元に戻す・リセット (確認つき)・未保存のまま離れるときの確認
  - 診断からの ?account= の受け口と routeMetadata の予算の task / taskDetail の文言更新
  - 設計判断の docs (docs/budget-screen/design-decisions.md) と core 単体・API 統合・migration 検査・DOM テスト
- スコープ外:
  - 予算の版管理・担当者・承認フロー (利用者決定で版つき案 opt-versioned-plans を退けた。同じ期間は上書き)
  - 外部 LLM による提案と外部データ (従業員数の推移・類似企業の業界中央値)。取込データを外部へ送らない (C4)。画像の該当文言は計画による調整の理由としてだけ出す
  - 個人 (家計) の予算 (家計の支出は防衛ラインの算出にだけ効く)
  - 共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗・『改善を送る』) の作り直し。ヘッダの『取引ライン：正常』は誤記として既存の『防衛ライン』を保つ
  - トレードオフ画面
  - web 以外の専用アプリ
  - 旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除 (互換のため残す)
  - 既存 budgets 表の削除・書き換え (1 行も書き換えない)

## 受入

- [ ] S1 (G1): /budget に 14-budget.png の構成要素 (§7.1 の全領域) がすべて描画され、色・余白・部品はトークンと共通部品を通し、直書き色の lint が 0 件。実績 0 か月で空状態になり、画面に『AI』の文字列が 0 件である。
- [ ] S2 (G2): 同じ入力で KPI・一覧の来期予算の和・グラフの月次予算の年合計・今後の見通しの累計が一致し、自動提案の各項が科目パネルの『計算の詳細』と一致する。外部送信 0 件。
- [ ] S3 (G3): 予算が予算対象の期間ごとに D1 に残り、migration は追加のみで既存行の書き換えが 0 件。保存行の無い期間は既存 budgets の月額 × 12 が初期値になる。
- [ ] S4 (G4): 下書きが再読込後に復元でき、保存成功で消え、未保存のまま離れると確認が出る。
- [ ] S5 (G5): 防衛ライン・予算カバー率が他画面と同じ関数から出て、既存の診断・概要・家計収支・総収支・決算書・明細仕分けの数値テストが緑のまま。lint・typecheck・初期 JS 予算を CI で通す。

受入の詳細 (AT-01〜AT-22) は `specs/spec-budget-screen.md` の「受入条件」を正本とし、本書へ複製しない。

## アーキテクチャ参照

- `architecture_refs`: `arch-budget-ui-ux`, `arch-budget-frontend`, `arch-budget-backend`, `arch-budget-database`, `arch-budget-auth`, `arch-budget-security`, `arch-budget-infrastructure`, `arch-budget-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/budget-*.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-budget-screen` (feature ノードへの依存は無い)
- 依存理由: 収入を予算に含めるか・自動提案の出どころ (決定論 + 計画調整)・防衛ライン余裕の式・保存単位 (期間別の年額表) が確定していないと、core の返り値型・API 応答・migration の列・テストの期待値が実装中に揺れるため。
- 重複の不在: 既存 feature に予算画面を扱うものは無い。`feat-classify-screen`・`feat-household-cashflow` 等とは数値テストが緑のままであることを確かめるだけで機能を重複させない。診断の予算カバー率は `monthlyBudgetsAt` 経由へ寄せるが、診断の画面は変えない。
- 後続: 無し。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-budget-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-budget-screen --feature-context features/feat-budget-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-budget-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S5 の evidence が揃う場合だけ done にする。
- 前提条件として持ち越す未決事項: Q-7 (PUT の batch 文数と D1 の 1 呼び出しあたりのクエリ上限) は保存 API を実装する task の前提条件とし、公式の上限を確かめて `docs/budget-screen/design-decisions.md` に記すまで batch の形を確定しない。収入行の差額の色 (arch-budget-ui-ux Risks)・年額の下限 (arch-budget-security Risks)・Q-5 (増減率と季節性補正の読み)・Q-10 (agent 推定値) は `specs/spec-budget-screen.md` の未決事項と各 arch ノードを正本とする。migration 番号 0050 は予定番号で、着手時に main の最新番号と突き合わせる。
- resource_scope の引き方: 既存 `budgets` は `routes/imports.ts`・`routes/analytics.ts`・`routes/settings.ts`・`import-lifecycle.ts`・`import-active.ts` から読まれ、`routeMetadata.ts` の予算の文言は `route-task-detail.test.tsx` が旧文言 (±10%) で固定しているため、先に scope へ含めた。plan では各 task の scope について、export 名の呼び出し元・import している側・型で結ばれた宣言を同じ手順で引くこと。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
