---
graph_node_id: "feat-household-cashflow"
artifact_kind: "feature"
artifact_subtypes: []
title: "家計収支画面 (10-household) の作り直しと totalCashflowLedger 正本の core 集計・名義表示名"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "household-cashflow", "feature"]
file_path: "features/feat-household-cashflow.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fa4dfe13ece1363b0554373be99bf838fe6d25ce40387cfa49fc63be8319750b"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-household-cashflow-screen.md", "source_version": "0.1.11", "source_digest": "be2c8fd794707b896e5bc862a775a02d37c08ab61e5f4691a7b961fe1ff9b34c", "imported_at": "2026-09-18T12:40:05Z"}
created_at: "2026-09-18T12:40:05Z"
updated_at: "2026-09-18T12:40:05Z"
depends_on: ["spec-household-cashflow-screen"]
related_nodes: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/10-household.png", "docs/data-schema.md", "docs/ui-decisions.md", "migrations", "packages/api/src/ai/dataset.ts", "packages/api/src/cashflow-sources.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/settings.ts", "packages/api/src/schema-guard.ts", "packages/core/src/analysis.ts", "packages/core/src/chart-aggregates.ts", "packages/core/src/classify.ts", "packages/core/src/exports.ts", "packages/core/src/household-summary.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/types.ts", "packages/core/test/household-categories-contract.test.ts", "packages/web/src/api.ts", "packages/web/src/components/Page.tsx", "packages/web/src/components/charts.ts", "packages/web/src/figure-guides.ts", "packages/web/src/glossary.ts", "packages/web/src/pages/Household.tsx", "packages/web/src/pages/household/", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "specs/spec-household-cashflow-screen.md"]
purpose: "家計収支画面を、『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る場にする。期間を選ぶと家計全体の総額と前年差を最初に掴み、月別推移で『いつ』、事業と個人・生活費カテゴリ・名義別の収入で『どこが』動いたかを確かめ、振替を二重に数えていないと納得したうえで、選んだ月やカテゴリの明細へ一直線に降りられる状態にする。家計全体の数字は総収支画面の『総合』と必ず一致させる。"
goal: "/household が 10-household.png の全構成要素 (問いの見出しと出典カード・期間タブ・KPI 3 枚と前年差・月別推移 (家計全体 / 事業 / 個人のタブ、当期の棒と純収支の折れ線、前年の点線、月送り)・事業 + 個人 = 家計全体の内訳・生活費 6 区分の表とカテゴリの詳細パネル・名義別の収入・振替の除外一覧・名義ラベルの設定・前年との比較・下部の選択中バー・読込 / 空 / 失敗) をトークンと共通部品で描画し、集計が totalCashflowLedger を正本とする core の純関数 1 か所で算出されて GET /api/household と GET /api/household/category が返し、名義の表示名が owner_labels 表と GET / PUT /api/settings/owner-labels で家計・設定・明細の全画面に効き、URL の seg / month / cat と usePeriod / localStorage の期間から選択が復元でき、ナビ・パンくずが『家計収支』になり、既存の総収支・推移・マトリックス・分析ハブのテストが緑のままの状態。"
scope_in: ["家計収支画面 (10-household.png の全構成要素と読込・空・失敗の各状態) の作り直し。Household.tsx を packages/web/src/pages/household/ 配下へ分割し、期間は usePeriod / localStorage、URL は seg / month / cat だけを正本にする。空は選択期間の集計対象台帳行 0 件とし、振替のみ・除外行のみも空にする", "packages/core の家計集計純関数 household-summary (totalCashflowLedger の行集合から家計全体・事業・個人の総額と月平均・年換算、月別系列と前年系列、前年比較と欠損時 null、生活費 6 区分と構成比・前年差、名義別収入と前年差、選択月の振替全件 (抜粋なし) と対推定)。旧 household() と HouseholdData を置き換え、参照元 (api の analytics route と ai/dataset、web の api.ts) を付け替える", "生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる", "GET /api/household の拡張と GET /api/household/category (期間合計 current・選択月合計 monthTotal・最大 5 件の transactions プレビュー・明細導線) の新設。クエリは zod の許可リストで検証し不正は 400", "owner_labels 表の追加のみの migration、runtimeSchemaGuard の必須表への追加、GET / PUT /api/settings/owner-labels (認証・パスワード変更フェンス・変更系フェンスの内側、表示名の長さと文字種の検証)、名義ラベル編集ダイアログ、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる", "カテゴリの詳細パネル・下部の選択中バー・明細画面への遷移 (月・カテゴリ・対象で絞る URL。期間は usePeriod / localStorage)", "routeMetadata・パンくず・figure-guides・glossary の /household の名称を『家計収支』へ改める", "集計規則 (家計全体 = 事業 + 個人、前年比較の欠損規則、6 区分の対応表、振替の対推定) の docs 記載と、core の不変条件テスト・API 統合テスト・migration 検査・DOM テスト"]
scope_out: ["『累計収支』画面の新設 (対応するデザイン画像が無いため。利用者決定)", "名義の内部値 (business / spouse / family) の変更と既存行の書き換え (表示名の編集で目的を満たすため。利用者決定)", "明細への相手口座カラムの追加 (振替の名義間は対推定で示す。利用者決定)", "共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の作り直し (名称の統一のみ扱う)", "総収支・推移・マトリックス・分析ハブの各画面の中身の作り直し (数値の一致確認だけを扱う)", "集計結果の永続化・キャッシュ層・新しい索引・新しい外部依存やチャートライブラリの導入", "スマートフォン・タブレット・デスクトップ向け専用アプリ (web のみ。既存の利用者決定)"]
acceptance: ["S1 (G1): /household で 10-household.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。ナビとパンくずの名称が『家計収支』である。期間内の集計対象台帳行 0 件 (振替のみ・除外行のみを含む) で空状態になる。", "S2 (G2): 同じ期間で家計画面の家計全体 (総収入・総支出・純収支) と総収支画面の総合が toBe で一致し、事業 + 個人 = 家計全体が全月で閉じ、前年差の算出が総収支画面の前年比較と同じ欠損規則に従う。", "S3 (G3): カテゴリ行の選択で詳細パネルと下部の選択中バーが同じ期間・同じ対象を示し、current が期間合計、monthTotal が選択月全件の合計、transactions が最大 5 件のプレビューとして分離され、カテゴリのすべて見るが対象の月とカテゴリで絞った明細へ遷移する。", "S4 (G4): 名義ラベルの更新が認証・変更系フェンス・入力検証を通った場合だけ保存され、家計・設定・明細の各画面の名義表示が更新後の表示名になる。migration は追加のみで既存行の書き換えが 0 件である。", "S5 (G5): 選択月の除外振替が家計カード内に全件 (抜粋なし) 現れ、振替用の循環する『すべて見る』導線が無く、その合計が家計の総収入・総支出に 1 円も含まれていない。名義間の表示が対推定規則どおりで、規則は docs に明記されテストで固定されている。", "S6 (G1-G5): URL は seg / month / cat のみを持ち、期間は usePeriod / localStorage から復元する。既存の総収支・推移・マトリックス・分析ハブの数値テストが緑のままで、初期 JS 予算 (CI 実測) を超えない。既知の逸脱・未実施・一部適合は PASS に数えない。"]
architecture_refs: ["arch-household-cashflow-ui-ux", "arch-household-cashflow-frontend", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-auth", "arch-household-cashflow-security", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "I1..I8 は同じ集計契約 (totalCashflowLedger を正本とする core 純関数 → GET /api/household と /api/household/category → 画面の選択・詳細パネル・下部バー) と名義表示名の一本化を起点に連鎖する 1 つの価値単位で、画面だけ・API だけ・名義だけでは『家計の変化を確かめて明細へ降りる』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-household-cashflow.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-fzu", "linked_at": "2026-09-18T13:37:36Z", "sync_state": "linked"}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T12:40:05Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

家計収支画面を、『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る場にする。期間を選ぶと家計全体の総額と前年差を最初に掴み、月別推移で『いつ』、事業と個人・生活費カテゴリ・名義別の収入で『どこが』動いたかを確かめ、振替を二重に数えていないと納得したうえで、選んだ月やカテゴリの明細へ一直線に降りられる状態にする。家計全体の数字は総収支画面の『総合』と必ず一致させる。

規範 (要件・集計規則・確定意思決定) の正本は `specs/spec-household-cashflow-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/household が 10-household.png の全構成要素をトークンと共通部品で描画し、集計が totalCashflowLedger を正本とする core の純関数 1 か所で算出されて `GET /api/household` と `GET /api/household/category` が返し、名義の表示名が `owner_labels` 表と `GET` / `PUT /api/settings/owner-labels` で家計・設定・明細の全画面に効き、表示選択 (`seg` / `month` / `cat`) が URL、期間が `usePeriod` / localStorage から復元でき、ナビ・パンくずが『家計収支』になり、既存の総収支・推移・マトリックス・分析ハブのテストが緑のままの状態。

## スコープ

- スコープ内:
  - 家計収支画面 (10-household.png の全構成要素と読込・空・失敗の各状態) の作り直し。`Household.tsx` を `packages/web/src/pages/household/` 配下へ分割し、期間は `usePeriod` / localStorage、URL は `seg` / `month` / `cat` だけを正本にする。空は選択期間の集計対象台帳行 0 件とする
  - packages/core の家計集計純関数 `household-summary` (totalCashflowLedger の行集合から家計全体・事業・個人の総額と月平均・年換算、月別系列と前年系列、前年比較と欠損時 `null`、生活費 6 区分と構成比・前年差、名義別収入と前年差、選択月の振替全件 (抜粋なし) と対推定)。旧 `household()` と `HouseholdData` を置き換え、参照元 (api の analytics route と `ai/dataset.ts`、web の `api.ts`) を付け替える
  - 生活費 6 区分と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる
  - `GET /api/household` の拡張と `GET /api/household/category` の新設。クエリは zod の許可リストで検証し不正は 400
  - `owner_labels` 表の追加のみの migration、`runtimeSchemaGuard` の必須表への追加、`GET` / `PUT /api/settings/owner-labels`、名義ラベル編集ダイアログ、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる
  - カテゴリの詳細パネル・下部の選択中バー・明細画面への遷移 (月・カテゴリ・対象で絞る URL。期間は usePeriod / localStorage)
  - routeMetadata・パンくず・figure-guides・glossary の /household の名称を『家計収支』へ改める
  - 集計規則の docs 記載と、core の不変条件テスト・API 統合テスト・migration 検査・DOM テスト
- スコープ外:
  - 『累計収支』画面の新設 (対応するデザイン画像が無いため。利用者決定)
  - 名義の内部値の変更と既存行の書き換え (利用者決定)
  - 明細への相手口座カラムの追加 (利用者決定)
  - 共通シェルの作り直し (名称の統一のみ扱う)
  - 総収支・推移・マトリックス・分析ハブの各画面の中身の作り直し (数値の一致確認だけを扱う)
  - 集計結果の永続化・キャッシュ層・新しい索引・新しい外部依存やチャートライブラリの導入
  - スマートフォン・タブレット・デスクトップ向け専用アプリ (web のみ)

## 受入

- [ ] S1 (G1): /household で 10-household.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。ナビとパンくずの名称が『家計収支』である。
- [ ] S2 (G2): 同じ期間で家計画面の家計全体と総収支画面の総合が `toBe` で一致し、事業 + 個人 = 家計全体が全月で閉じ、前年差の算出が総収支画面の前年比較と同じ欠損規則に従う。
- [ ] S3 (G3): カテゴリ行の選択で詳細パネルと下部の選択中バーが同じ期間・同じ対象を示し、`current`=期間合計、`monthTotal`=選択月全件合計、`transactions`=最大 5 件プレビューが分離され、カテゴリのすべて見るが対象の月とカテゴリで絞った明細へ遷移する。
- [ ] S4 (G4): 名義ラベルの更新が認証・変更系フェンス・入力検証を通った場合だけ保存され、家計・設定・明細の各画面の名義表示が更新後の表示名になる。migration は追加のみで既存行の書き換えが 0 件である。
- [ ] S5 (G5): 選択月の除外振替が家計カード内に全件 (抜粋なし) 現れ、振替用の循環する『すべて見る』導線が無く、その合計が家計の総収入・総支出に 1 円も含まれていない。名義間の表示が対推定規則どおりで、規則は docs に明記されテストで固定されている。
- [ ] S6 (G1-G5): 既存の総収支・推移・マトリックス・分析ハブの数値テストが緑のままで、初期 JS 予算 (CI 実測) を超えない。

## アーキテクチャ参照

- `architecture_refs`: `arch-household-cashflow-ui-ux`, `arch-household-cashflow-frontend`, `arch-household-cashflow-backend`, `arch-household-cashflow-database`, `arch-household-cashflow-auth`, `arch-household-cashflow-security`, `arch-household-cashflow-infrastructure`, `arch-household-cashflow-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/household-cashflow-*.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-household-cashflow-screen` (feature ノードへの依存は無い)
- 依存理由: 家計の定義 (totalCashflowLedger 正本)・名義モデル (内部値を残し表示名を編集)・振替の対推定・画面名・数値の正本 (収入と支出、差は計算値)・生活費 6 区分という 6 決定が確定していないと、core の返り値型・API 応答・テストの期待値が実装中に揺れるため。総収支 (#55)・推移 (#56)・マトリックス (#57) は main に取り込み済みで、未完了の feature に依存しない。
- 重複の不在: 既存 feature に家計収支画面を扱うものは無い。`feat-total-cashflow-screen` とは数値の一致を取るだけで機能を重複させない。
- 後続: 『累計収支』は対応する画像ができた時点で別 feature として起票する。本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-household-cashflow-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-household-cashflow --feature-context features/feat-household-cashflow.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-household-cashflow` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (振替の日付差の許容幅・表示名の長さ上限と許可文字種・migration 番号・主な取引の件数) は `specs/spec-household-cashflow-screen.md` の agent 推定注記を正本とし、該当 task の契約テストで確定する。
- resource_scope の引き方: 前サイクル (`feat-expense-matrix`) で、scope が仕様に名前の出るファイルと一致して巻き添えのファイルが落ちた。本 feature では旧 `household()` と `OWNER_LABEL` の参照元 (`packages/api/src/ai/dataset.ts`・`packages/core/src/exports.ts`・`packages/core/src/chart-aggregates.ts`・`packages/web/src/api.ts`) を検索で引いて先に含めた。plan では各 task の scope について、export 名の呼び出し元・import している側・型で結ばれた宣言を同じ手順で引くこと。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
