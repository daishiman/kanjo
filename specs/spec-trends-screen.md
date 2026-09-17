---
graph_node_id: "spec-trends-screen"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "推移画面 仕様"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["trends-screen"]
file_path: "specs/spec-trends-screen.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "a01d36578c3ce33fa0a1db7d23dca6d289fd0cbe1477f95fba7ae6b1ebe6c0a5"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "a01d36578c3ce33fa0a1db7d23dca6d289fd0cbe1477f95fba7ae6b1ebe6c0a5", "imported_at": "2026-09-16T10:18:41Z"}
created_at: "2026-09-16T10:18:41Z"
updated_at: "2026-09-16T10:18:41Z"
depends_on: []
related_nodes: ["arch-trends-screen-ui-ux", "arch-trends-screen-frontend", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-auth", "arch-trends-screen-security", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops"]
resource_scope: ["packages/api/src/dataset.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/wrangler.jsonc", "packages/core/src/analysis-hub.ts", "packages/core/src/index.ts", "packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/core/src/trend-metrics.ts", "packages/core/src/trend.ts", "packages/core/test/trend-comparison.test.ts", "packages/core/test/trend-contract.test.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/src/components/Button.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/lib/api.ts", "packages/web/src/lib/charts.ts", "packages/web/src/lib/period.ts", "packages/web/src/pages/Classify.tsx", "packages/web/src/pages/analysis/Trends.tsx", "packages/web/src/pages/analysis/trends-scope.dom.test.tsx", "packages/web/src/pages/analysis/trends-screen.dom.test.tsx", "packages/web/src/styles", "packages/web/src/test-support/chart-test-doubles.tsx"]
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
classification_reason: "system-spec の要件定義書 (U1-U9) を推移画面サイクルの実装計画の入口として参照する単一の specification。API 変更 (GET /api/trends に scope・metric・compare・month を足し、総収支と同じ取引集合から推移・比較・カテゴリ行・取引先行を返す) があるため api-contract overlay を合成する。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-trends-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T10:18:41Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 推移画面 仕様

本書は `system-spec/00-requirements-definition.md` (承認 `appr-foundation-trends-001`、G3/G4/G5 の具体化は `appr-trends-datasource-001`、要確認の明細・口座が空の行は `appr-trends-review-001`) を dev-graph の specification として参照する入口である。今回の追加改善で更新した FR3・FR6・FR8・FR9・FR11・FR13 は本書と `docs/trends-screen.md` を実装時の上書き正本とし、生成済み system-spec に残る旧案 (KPI のカード分割と新画面内の旧判定開閉) は履歴として扱う。FR13 と8列の並べ替えは 2026-09-17 に仕様章 (ui-ux / frontend、qa-*-trends-observed-005) へ正規フローで反映済み。領域別の制約は architecture ノード (arch-trends-screen-ui-ux, arch-trends-screen-frontend, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-auth, arch-trends-screen-security, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops) に分ける。既存の傾向判定の計算規則そのものは互換 fallback のため `packages/core/src/trend.ts` と `packages/core/test/trend-contract.test.ts` を維持する。

## 目的と成功状態

収支が『いつ・なぜ』変わったかを、推移画面の 1 画面で掴めるようにする。利用者が推移を開いた時点で、選んだ期間の収入・支出・純収支の月次推移と、前期間または前年との差が総合/事業/家計で読め、最も変化が大きい月の増減要因 (どのカテゴリのどの取引先がいくら動いたか) が根拠の明細まで辿れる状態にする。指標は登録制にして、収支以外の推移もあとから同じ画面の型で追えるようにする (U1)。

ゴール (U3) の要旨:
- G1: /analysis/trends を 07-trends.png の情報階層に合わせ、期間選択と見出しは共通シェルに一元化する。比較条件・一体型KPI帯・収入棒/支出線/純収支線/比較点線/月次差棒/選択帯の推移・詳細・8列カテゴリ・符号付きパレートと上位 3・選択バーを並べる。新比較画面から旧判定を外し、新フィールドの無い旧 Worker 応答だけを fallback にする。
- G2: 推移の指標を登録制にする。指標定義 (id・表示名・月次系列の取り出し方・符号と良し悪しの向き・内訳の軸) を packages/core に置き、今回は収入・支出・純収支の 3 指標を登録する。画面・API・表は指標定義から描き、指標を足すときに画面と API の分岐を増やさない。
- G3: 数値は総収支と同じ取引集合 (freee 取引と MF 明細を消し込んだ後、totalCashflowReport と同じ数え方) から数え、総合・事業・家計の値を概況と総収支画面に一致させる。範囲 (総合/事業/家計)・指標・比較対象 (前期間=直前の同じ長さ / 前年=前年の同じ月範囲) を受け取り、今回と比較期間の月次系列・月次差・KPI・選択月の詳細・カテゴリ行・取引先行・パレートを core の純関数で算出して API で返す。比較期間は既存の Dataset を切る設計 (applyPeriod/sliceDataset) で切り出す。全期間では比較期間を作らない。要確認の MF 明細は総収支と同じく数えず、期間と選択月の要確認の件数と金額 (totalCashflowReport の月次 reviewCount・reviewAmount) を返す。開閉で残す傾向の判定は現行どおり MF 明細だけから trendsReport で計算し、その基準を返却に含める。
- G4: MF 由来の行から /classify へ月・範囲・カテゴリ・取引先の絞込クエリで遷移し、freee 由来は総収支画面を開く。期間は共通 usePeriod、範囲・指標・比較対象・選択月・カテゴリ・side・取引先は URL に保持する。同名カテゴリは `category + side` で区別する。
- G5: 増減額・増減率・構成比・寄与度・最も変化が大きい月・比較期間・増減要因の説明文の規則に加え、数値の出所・全期間の扱い・スパークラインの 12 か月・要確認の明細を含めない規則・傾向の判定の基準・口座が空の行の扱いを docs に明記し、境界値付きの core テストと DOM テストで固定する。

成功状態 (U5):
- S1 (G1): /analysis/trends で 07-trends.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell/chart の共通設定経由で、直書き色の lint が 0 件である。
- S2 (G2, G3): 3 指標×3 範囲×2 比較対象のどの組合せでも、画面の KPI・チャート・表の値が core の返却値と一致し、総合=事業+家計・純収支=収入-支出が成り立つ。総合・事業・家計の期間合計は同じ期間の総収支画面の値と一致する。
- S3 (G2): 指標定義を 1 件足すだけで画面と API に新しい指標が現れ、画面と API のコードに指標 id の分岐が無い。
- S4 (G4): 詳細パネルと選択バーからの遷移で、/classify が月・範囲・カテゴリ・取引先で絞り込んだ明細だけを表示し、推移の条件は URL から復元される。
- S5 (G5): 計算規則と説明文の規則が docs に書かれ、境界値テストを含む vitest が通り、既存の傾向判定のテスト (trend-contract.test.ts) も壊れていない。

## スコープ

- In:
  - 推移タブ (07-trends.png) の情報階層を共通シェル上に構築: 条件帯・一体型KPI帯・意味付き推移チャート・詳細・8列カテゴリ・符号付きパレート・上位 3・選択バー。旧傾向判定は旧 Worker fallback のみ
  - packages/core の推移集計の拡張と指標定義の登録制 (収入・支出・純収支)
  - GET /api/trends の条件 (範囲・指標・比較対象・選択月) と返却の拡張
  - 明細画面 /classify のカテゴリ・取引先の絞込クエリ
  - 計算規則と説明文の規則の docs (docs/trends-screen.md) とテスト
- Out:
  - 収入・支出・純収支以外の指標 (件数・口座別残高など) の実装。登録制の型だけ用意し、指標の追加は後続で行う
  - 取引先の名寄せ規則。MF 由来は明細の内容 (MfTx.c)、freee 由来は取引先 (FreeeDeal.partner) をそのまま取引先として集計する
  - 総収支画面 (TotalCashflow.tsx) の URL で月や取引を絞る機能。freee 由来の行からは期間だけを引き継いで開く
  - AI による説明文の生成と利用者のメモ入力
  - 共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更
  - 照合・総収支・マトリクス・診断の各タブの中身
  - web 以外の platform (専用アプリ)
  - D1 のスキーマ変更 (migration は足さない)
  - 消し込み・除外・要確認の規則の変更。総収支 (total-cashflow.ts) の規則をそのまま使う

## 用語と主体

| 用語 | 定義 |
|---|---|
| 数値の出所 | 総収支と同じ取引集合。freee 取引と MF 明細を totalCashflowReport と同じ判定で消し込み、事業の収入・支出は freee 側、家計は MF 側から数え、要確認の MF 明細は事業にも家計にも入れない。除外済みの freee 取引と MF 明細は数えない。 |
| 要確認の明細 | 総収支の判定で事業にも家計にも振り分けられない MF 明細。推移の数値には含めず、件数と金額だけを帯と詳細パネルに出す。 |
| 傾向の判定の基準 | 開閉部分の傾向判定 (MK 検定・手を打つ順番) は MF の明細だけ (trendsReport に渡す Dataset) で計算する。上半分の数字 (総収支と同じ取引集合) とは基準が違う。 |
| 口座 | MF 由来は明細の口座 (inst)、freee 由来は決済口座 (FreeeDeal.settleAccount)。freee 由来で空のときは『—』と表示し、口座別の件数と絞込の対象にしない。 |
| 由来 (origin) | 行が freee 取引から来たか (freee) MF 明細から来たか (mf)。遷移先と取引先の取り出し方を決める。 |
| 範囲 (scope) | 集計の対象。総合 (total)・事業 (business)・家計 (household)。総合は事業と家計の和。既存 API の all/biz/personal は同じ意味の別名として受ける。 |
| 指標 (metric) | 月次系列を返す登録済みの定義。今回は income (収入)・expense (支出)・net (純収支=収入-支出) の 3 件。 |
| 指標定義 | id・表示名・月次系列の取り出し方・符号と良し悪しの向き (増えると良いか悪いか)・内訳の軸 (カテゴリ・取引先) を持つ core の値。 |
| 今回期間 | 全体の期間選択 (usePeriod の span/from/to) で解決された月範囲。全期間のときは range が null。 |
| 比較対象 (compare) | previous (前期間=今回期間の直前で同じ月数、analysis-hub.ts の previousPeriod) または yoy (前年=前年の同じ月範囲、period.ts の previousYearPeriod)。 |
| 月次差 | 同じ位置の月の、今回の値から比較期間の値を引いた額。 |
| 増減額 / 増減率 | 期間合計の差 / 差を比較期間の値の絶対値で割った率。比較期間が 0 のときは率を出さない (null)。 |
| 構成比 | 行の今回合計を指標の今回期間合計で割った率。 |
| 寄与度 | 行の増減額を、指標全体の増減額で割った率。全体の増減が 0 のときは出さない (null)。 |
| 最も変化が大きい月 | 月次差の絶対値が最大の月。同値は新しい月を選ぶ。 |
| カテゴリ | 事業は freee の勘定科目 (accountNorm)、家計は MF の大項目 (big)。総合では同名でも混ぜず『事業 / 科目』『家計 / 大項目』の形で区別する (総収支の expenseCategories と同じキー)。 |
| 取引先 | MF 由来は明細の内容 (MfTx.c)、freee 由来は取引先 (FreeeDeal.partner) の文字列そのもの。名寄せしない。 |
| 増減要因 | 選択月のカテゴリ (必要に応じて取引先) のうち、月次差の絶対値が大きい順の上位 3 件。 |
| 主体 | SH1 利用者 (単独の個人事業主)、SH2 保守者 (同一人物とコーディングエージェント)。 |

## ユースケースとユーザーフロー

1. 月次の振り返りで利用者が /analysis/trends を開く。初期は範囲=総合、指標=支出、比較対象=前期間、選択月=最も変化が大きい月で表示される。数値は概況と総収支画面と同じ値になる。期間内に要確認の明細があれば、比較条件の帯に『要確認 N 件 (計 X 円) は含みません』と総収支画面へのリンクが出る。
2. 共通シェルの期間選択 (1年/2年/3年/任意) を押すと全体の期間が変わり、他の分析画面と同じ期間で再集計される。推移画面内には期間 UI を複製しない。全期間では比較を無効にし、KPI の増減は最大変化月の前月差にする。
3. 比較条件の帯で範囲・指標・比較対象を切り替えると、KPI・チャート・表・パレート・上位 3 が同じ条件の値に切り替わり、URL の検索パラメータが更新される。
4. チャートの月を押すと選択月が変わり、詳細パネル (収入・支出・純収支と比較期間の値、増減要因 上位 3、データの出典、該当明細を開く) が切り替わる。
5. カテゴリ表の行を開くと取引先別の内訳が出る。行を選ぶと選択バーに選択中の月とカテゴリ (取引先) と増減額・率が出る。
6. MF 由来の行では『該当明細を開く』または『増減の明細を確認』で /classify へ遷移し、月・範囲・カテゴリ・取引先で絞り込んだ明細が表示される。freee 由来の行では『総収支で確認』で総収支画面が同じ期間で開く。
7. 新比較画面では旧『傾向の判定』を重複表示しない。新フィールドの無い旧 Worker 応答だけは rolling deploy fallback として従来の判定を開いて表示できる。
8. URL を再読込または共有すると同じ条件の表示に戻る。

## 機能要件

- FR1 (I1): 共通ヘッダーの PeriodPicker と PageHeader を期間選択・問いの唯一の所有者とし、推移画面内に重複した期間帯や見出しを作らない。
- FR2 (I2): 問いの見出し『収支は、いつ・なぜ変わりましたか?』と説明の下に、範囲・指標・比較対象の 3 つの切替を 1 本の帯にまとめる。期間内に要確認の明細があれば、帯の末尾に『要確認 N 件 (計 X 円) は含みません』と総収支画面へのリンクを出す。
- FR3 (I3): 1本のKPI要約帯に、現在の値 (今回期間合計)、比較期間からの増減額と率、最も変化が大きい月とその月次差を置く。KPI の値は要確認の明細を含まない。
- FR4 (I4): 推移チャート。今回の収入は青の棒、支出は赤の線、純収支はティールの線、選んだ指標の比較期間は点線、月次差は符号付き棒、選択月は縦帯で示す。
- FR5 (I5): 詳細パネル。選択月の値、増減要因 上位3、代表出典＋他N件 (展開時に全件。口座空は『口座情報なし』)、要確認件数と金額、最大要因から導く初期CTAを出す。MF/mixed は『該当明細を開く』、freee は『総収支で確認』とし、どちらも選択月へ遷移する。
- FR6 (I6): カテゴリ、直近12か月、今回合計、比較期間、増減額、増減率、構成比、寄与度の8列を常に保つ。比較不能時の比較セルは『—』。カテゴリは単一トリガーで選択・展開し、取引先内訳を独立行で出す。スパークラインは欠損区間を跨がない。
- FR7 (I7): 増減の要因のパレート図 (絶対額降順に並べた符号付き棒と、絶対寄与の累計線) と、増減が大きい項目の上位 3 のカード。
- FR8 (I8): 下部の選択バー。選択中の月とカテゴリ (取引先) と増減額・率、originに応じた『該当明細を開く』または『総収支で確認』。
- FR9 (I9): 指標定義の登録表を core に置き、`visualRole`・`controlOrder`・`showInOverview` も正本化する。日本語label分岐を置かず、新指標は選択中なら必ず主図へ出す。
- FR10 (I10): /classify は category (大項目) と payee (明細の内容と完全一致) の初期値を URL から読み、既存の month・cls と組み合わせて絞り込む。payee は既存の検索 q とは別のクエリにする。
- FR11 (I11): 新比較画面から既存判定を外す。既存判定コンポーネントは旧 Worker 応答の rolling deploy fallback にだけ残す。
- FR12 (I12): 計算規則と説明文の規則を docs/trends-screen.md に表で書き、境界値テストで固定する。
- FR13 (I1 の具体化): 保存値が無い初回期間は直近1年。利用者が明示した全期間は保存・復元し、既定値で上書きしない。

## 非機能要件

- 性能: GET /api/trends は 1 リクエストで loadDataset と freee 系 4 表 (freee_deals・duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions) を 1 回ずつ読み (総収支 API と同じ読み取り)、今回と比較期間を同じ読み取り結果から切り出す。Workers の CPU 時間は総収支 API と同程度に収める。
- アクセシビリティ: WCAG 2.2 AA (文字 4.5:1、部品 3:1)。増減の良し悪しを色だけで伝えず、符号 (+/-) と文字 (増/減) を併記する。チャートには同じ値の表を読める代替を置く (カテゴリ表と KPI)。
- 互換: 既存の trendsReport の rows/pareto/breakdown の値と既存テストを壊さない。旧 /trends の転送を維持する。
- 保守: 集計は core に置き、api/web へ重複実装しない。指標 id の分岐を画面と API に書かない。
- データ保護: 取込データを外部へ送信しない。説明文は規則で作る。
- レスポンシブ: 狭幅では詳細パネルをチャートの下へ置き、表は横スクロールで扱う。

## UI・状態遷移

- 画面の縦の順: 共通シェルの期間選択・問い → 比較条件の帯 → 一体型KPI要約帯 → 推移チャートと詳細パネル → カテゴリ表 → パレート図と上位3 → 選択バー。
- URL 状態: scope、metric、compare、month、category、side (business|household)、payee。category と side は同名カテゴリを一意に識別する一組とし、選択解除時は両方を消す。期間は既存の span/from/to。
- 状態: 読込中 → 表示 → 条件変更で再取得 → 表示。比較期間が無くても8列骨格を保って比較セルを『—』にする。全期間では比較対象を無効にし、『1年』選択の案内とパレート非表示理由を残す。
- 選択月が期間外になった (期間を変えた) ときは、最も変化が大きい月へ戻す。
- category が今回と比較期間のどちらにも無いときは選択を外す。

## ビジネスルールと検証

| 規則 | 定義 | 境界 |
|---|---|---|
| 総合 | 事業と家計の和 | 事業・家計のどちらかが 0 でも成り立つ |
| 純収支 | 収入-支出 | 支出は正の額で持ち、純収支だけ符号付き |
| 数値の出所 | totalCashflowReport と同じ判定 (消し込み・除外・要確認) を行単位で適用した集合 | 期間合計は monthlyTotalCashflow の同じ月の値と一致する |
| 前期間 | 今回期間の直前で同じ月数 (previousPeriod) | データの先頭より前は空の月として扱う。全期間では作らない |
| 前年 | 前年の同じ月範囲 (previousYearPeriod) | 前年のデータが無い月は空。全期間では作らない |
| 全期間の増減 | 比較期間を作らず、KPI の増減は最も変化が大きい月とその前月の差 | 前月が無い (先頭月) ときは null |
| スパークライン | 今回期間の末月から遡る 12 か月 | 期間が 12 か月未満なら足りない月は空 |
| 増減額 | 今回合計-比較期間合計 | 比較期間が空なら null |
| 増減率 | 増減額 ÷ 比較期間合計の絶対値 | 比較期間合計が 0 なら null (表示は『—』) |
| 構成比 | 行の今回合計 ÷ 指標の今回合計 | 指標の今回合計が 0 なら 0 |
| 寄与度 | 行の増減額 ÷ 指標全体の増減額 | 全体の増減が 0 なら null。寄与度の和は 100% |
| 最も変化が大きい月 | 月次差の絶対値が最大の月 | 同値は新しい月。全月 0 なら最新月 |
| 増減要因 | 選択月のカテゴリ別月次差の絶対値の降順 上位 3 | 差が 0 の行は除く |
| 説明文 | 『{カテゴリ}が{取引先}など{件数}件で{増減額}{増/減}』の決まった形。取引先は差の絶対値が最大のもの | 取引先が 1 件なら『など』を付けない。外部送信・AI 生成はしない |
| 良し悪しの向き | 指標定義が持つ (支出は減ると良い、収入と純収支は増えると良い) | 表示は符号と文字を併記 |
| 集計対象 | 数値の出所の行と同じ。MF の計算対象外・振替は数えない | 要確認の MF 明細は事業・家計・総合のどれにも入れない |
| 要確認の明細 | 総収支の判定で要確認の MF 明細は数えず、件数と金額 (reviewCount・reviewAmount の期間合計と選択月の値) だけを返す。金額は収入と支出を区別しない絶対値の合計 (total-cashflow.ts の sumAbs と同じ) | 0 件なら帯の注記と詳細パネルの行を出さない |
| 傾向の判定の基準 | trendsReport に MF の Dataset を渡した結果をそのまま返し、基準 (mf_only) を併せて返す | 上半分の数字と一致しなくてよい |
| 口座が空の行 | freee 由来で settleAccount が空の行は『口座情報なし』。口座別の件数と絞込の対象にしない | 件数の合計は口座別件数の和より多くなりうる |
| 遷移先 | MF/mixed は /classify、freee は /analysis/total-cashflow。選択月driver由来CTAではmonthを渡す | 月と表示金額の粒度を一致させる |

検証: core の境界値テスト (比較期間 0・比較データ無し・全期間・増減 0・負の値・同値の最大変化月・12 か月未満のスパークライン・要確認 0 件と 1 件以上・口座が空の freee 行)、総収支との一致テスト (期間合計が monthlyTotalCashflow と一致)、3 指標×3 範囲×2 比較対象の恒等式テスト (総合=事業+家計、純収支=収入-支出、行の和=期間合計、寄与度の和=100%)、テスト用指標を 1 件足したときの返却テスト。

## API契約

変更する API は GET /api/trends の 1 本。明細画面の絞込は web のルート (/classify) の検索パラメータで、API は増やさない。

### API: GET /api/trends

#### 識別と目的

- operation: 推移の集計を返す読取専用 API。
- 目的: 範囲・指標・比較対象・選択月に応じた、今回と比較期間の月次系列・KPI・詳細・カテゴリ行・取引先行・パレートを 1 回で返す。既存の傾向判定 (rows/pareto/breakdown など) も互換のため同じ応答に残す。
- 実装: packages/api/src/routes/analytics.ts の analyticsRoute.get('/trends')。集計は packages/core の純関数で、数値の出所は totalCashflowReport と同じ判定を使う。

#### 認証・認可

- /api/* の authGuard() と mustChangePasswordFence() の内側で動く。署名付きセッション Cookie が必須。
- データは userId で絞った Dataset と freee 系 4 表だけを読む (loadReviewSources と同じ絞込)。未認証は 401、パスワード変更が必要な利用者は既存のフェンスの応答に従う。
- 書込は無く、canonicalMutationFence の対象外。

#### Request

- query:
  - from, to (YYYY-MM)、year (YYYY)、span (1|2|3): 既存の期間指定。loadScoped の resolvePeriodQuery がそのまま解決する。
  - scope: total|business|household。既存の all|biz|personal も受け、それぞれ total|business|household として扱う。省略時 total。
  - metric: 登録済みの指標 id (income|expense|net)。省略時 expense。
  - compare: previous|yoy。省略時 previous。
  - month: YYYY-MM。省略時・形式違反・期間外は最も変化が大きい月。
  - category: カテゴリ名。省略時・該当なしは選択なし。
  - side: business|household。scope=total の同名カテゴリを category との組で識別する。省略した旧 URL も従来どおり受ける。
  - payee: 取引先 (完全一致)。category と組み合わせる。省略時・該当なしは選択なし。
- body: なし。

#### Response

- 200 application/json。既存のフィールド (months, recordedMonths, unrecordedExpMonths, expenseTotal, monthlyAvg, rows, pareto, scope, scopeLabel, sides, monthlySides, coreCount, breakdown, counts, period) に加えて次を返す:
  - metrics: 登録済み指標の一覧 (id, label, betterWhen, visualRole, controlOrder, showInOverview)。
  - selection: 解決後の scope, metric, compare, month, side, category, payee。
  - comparePeriod: 比較期間の月範囲とラベル。全期間または比較できないときは null (理由 compareUnavailable: all_period|no_data を併せて返す)。
  - series: 指標ごとの今回の月次値と比較期間の月次値 (同じ位置の月で並べる)、選んだ指標の月次差。
  - kpis: current (今回合計)、change (増減額と増減率。全期間では最も変化が大きい月の前月差で basis: peak_month_mom を付ける)、peakMonth (最も変化が大きい月、月次差、主な要因の一文)。
  - detail: 選択月の各指標の今回値と比較値、drivers (上位 3 のカテゴリ・増減額・説明文・取引先・origin)、sources (MF 由来は口座名と件数、freee 由来は freee と件数)。
  - categories: カテゴリ行 (name, side 事業|家計, spark 直近 12 か月, current, compare, change, changeRate, share, contribution, payees)。payees は同じ列の取引先行で origin (mf|freee) を持つ。
  - changePareto: 増減額の絶対値の降順の行と累計構成比。
  - topMovers: 増減が大きい上位 3 のカテゴリ行。
  - review: 要確認の明細の件数と金額 (期間合計 count・amount と選択月の monthCount・monthAmount)。数値には含めない。
  - recommended: 選択月の最大driverから導く初期CTA。利用者が明示選択した focus とは分離する。
  - judgementBasis: 傾向の判定 (rows/pareto/breakdown) の基準。値は mf_only (MF の明細だけ)。
  - detail.sources の freee 由来で口座が空の行は account を null で返し、口座別の件数に数えない。
- 既存の scope フィールドは互換のため all|biz|personal の値のまま返し、新しい値は selection.scope に置く。

#### Validation・ビジネスルール

- scope・compare は許可値の列挙で検証し、未知の値は既定値へ倒す (既存の scope の挙動と同じ)。
- metric は登録済み定義の辞書で引き、未登録の id は 400 invalid_metric を返す。任意の関数名やキーを評価しない。
- month は YYYY-MM 形式で検証し、形式違反と今回期間の外の月は最も変化が大きい月へ倒す (400 にしない。古いブックマークで画面が出なくなるのを避ける loadScoped の方針と同じ)。
- category・side・payee は取得後の行との完全一致比較にだけ使い、SQL へ連結しない。該当が無ければ選択なしとして扱う。
- 計算規則は「ビジネスルールと検証」の表に従う。

#### Error contract

| status | code | 条件 |
|---|---|---|
| 400 | invalid_metric | 未登録の metric |
| 400 | 既存の期間エラー | from/to/year/span が resolvePeriodQuery で解決できない (既存の挙動を維持) |
| 401 | 既存 | 未認証 |
| 500 | 既存 | 予期しない失敗。応答本文に明細を含めない |

エラー本文は既存の apiError(code, message) の形。

#### 実行セマンティクス

- 読取専用で冪等。同じ query と同じデータに対して同じ応答を返す。
- loadDataset と freee 系 4 表の読み取りは 1 回ずつ。今回期間は applyPeriod(all, range)、比較期間は applyPeriod(all, previousPeriod(range) または previousYearPeriod(range)) で同じ all から切る。
- 全期間 (range が null) のときは比較期間を作らず comparePeriod を null (compareUnavailable: all_period) にする。compare の値は selection に保持するが集計には使わない。
- 数値は totalCashflowReport と同じ判定を行単位で返す core の関数から作り、その月次合計が monthlyTotalCashflow と一致する。要確認の件数と金額は同じ totalCashflowReport の月次 reviewCount・reviewAmount から取る。
- 傾向の判定 (rows/pareto/breakdown) は現行どおり trendsReport に MF の Dataset を渡して作る。

#### キャッシュ・ページング

- ページングは無い (月数とカテゴリ数は利用者 1 人の家計規模に限られる)。
- web 側は TanStack Query のキーに期間・scope・metric・compare・month を含め、条件ごとにキャッシュする。サーバ側のキャッシュは足さない。

#### 可観測性と監査

- 読取専用のため監査ログは増やさない。
- 失敗は既存のエラーハンドラのログに従い、明細の内容や取引先名をログへ出さない。

#### セキュリティ確認

- 入力は列挙と形式で検証し、辞書引き以外で指標を解決しない。
- 応答は JSON だけで、web は取引先名を React のテキストとして描画する (innerHTML を使わない)。
- 他の利用者のデータを読まない (userId で絞る)。

#### Contract tests

- packages/api のテストで、scope の別名 (all/biz/personal) が total/business/household と同じ値を返すこと。
- 未登録 metric が 400 invalid_metric を返し、形式違反の month・未知の scope/compare は既定値で 200 を返すこと。
- 全期間の指定で comparePeriod が null、kpis.change.basis が peak_month_mom になること。
- 総合・事業・家計の期間合計が同じ期間の GET /api/total-cashflow の値と一致すること。
- payee が完全一致の行だけを選ぶこと (部分一致で選ばない)。
- 既存フィールド (rows/pareto/breakdown) の値が拡張前と一致し、judgementBasis が mf_only であること。
- 要確認の MF 明細が 0 件のとき review.count が 0、1 件以上のとき count・amount が同じ期間の GET /api/total-cashflow の要確認の件数・金額と一致し、推移の数値に含まれないこと。
- freee 由来で口座が空の行が detail.sources で account null になり、口座別の件数に数えられないこと。
- compare=previous と yoy で comparePeriod が期待の月範囲になること。
- loadDataset と freee 系 4 表の読み取りが 1 回ずつであること (既存の analytics-period.test.ts と同じ静的検査の型)。

## データモデル

- D1 のスキーマは変えない。migration は足さない (最新は 0042 のまま)。
- 入力は loadDataset が D1 から読む既存の Dataset (MF 明細 MfTx の m・d・c・a・big・mid・inst・isTarget・isTransfer、事業/家計の区分) と、loadReviewSources と同じ freee_deals (FreeeDeal の month・date・io・partner・accountNorm・amount・settleAccount)・duplicate_verdicts・freee_deal_exclusions・mf_tx_exclusions。どれも既存の表。
- core に足す値の型: MetricDefinition (id, label, betterWhen, series の取り出し方, 内訳の軸)、TrendsSelection、TrendSeries、TrendKpis、TrendDetail、TrendCategoryRow (side と payees を含む)、TrendPayeeRow (origin を含む)、ChangeParetoRow、TrendSourceRow (totalCashflowReport と同じ判定を通った 1 行: month・side・io・category・payee・amount・origin・account。freee 由来で口座が空なら account は null)、TrendReviewSummary (要確認の件数と金額)。
- 集計値は保存しない。説明文も保存せず毎回生成する。
- バックアップ・復元の対象表は変わらない。

## 認証・認可

- 既存の認証 (メールアドレスとパスワードの署名付きセッション Cookie、users.session_generation による即時失効) をそのまま使う。
- データは TENANT_ID=default の単一テナントで、Dataset も freee 系 4 表も userId で絞る。
- 今回の変更は読取専用の集計と /classify の検索パラメータ追加だけで、新しい認証・認可の仕組みは足さない。

## エラー・例外・回復

- API のエラーは「Error contract」の表に従う。web は 400 invalid_metric のとき metric を既定値へ戻して再取得し、それ以外は既存のエラー表示と再試行ボタンを出す。month・scope・compare の誤りは API が既定値へ倒すのでエラーにならない。
- freee 取引や判定表が 0 件のときは MF 明細だけで数えた値になり (総収支と同じ挙動)、エラーにしない。
- 比較期間にデータが無いときはエラーにせず、8列骨格を保って比較セルを『—』にし、比較点線は出さない。
- 期間変更で選択月や選択カテゴリが存在しなくなったときは選択を外すか最も変化が大きい月へ戻し、URL も同じ値へ書き換える。
- /classify に存在しないカテゴリや取引先が渡されたときは 0 件表示と絞込の解除ボタンを出す。

## イベント・非同期処理

- 非同期処理・キュー・定期実行は無い。
- web は TanStack Query の取得だけを行い、条件変更のたびに再取得する (直前の値を表示しつつ読込中を示す)。

## 可観測性

- 新しいメトリクス・ログは足さない。既存の Worker のエラーログとフロントの既存エラー境界に従う。
- 視覚の確認は scripts/check-financial-visuals.mjs の headless Chrome 検査で行い、推移の図が期待どおりの枚数描画されることを確かめる。

## 互換性・移行・リリース

- 既存の GET /api/trends の応答フィールドは残し、追加だけを行う。scope の旧値も受ける。
- 旧 /trends から /analysis/trends への転送を維持する。
- データ移行は無い。リリースは既存の deploy.yml の経路で、migration を伴わない。
- 数値の出所が MF 明細だけから総収支と同じ集合に変わるため、事業・総合の推移の値は旧画面と変わる (概況・総収支と一致する側へ揃う)。既存の rows/pareto/breakdown (傾向判定) は旧来の Dataset の値のまま残し、開閉部分の見出しでその基準を示す。要確認の明細が残っている期間は、帯の注記で数値に含まれない件数と金額が分かる。
- 既存の trends-scope.dom.test.tsx と trend-contract.test.ts は壊さない。画面構成の変更で期待値を更新する場合は理由をテストに残す。
- ロールバックは web と api を同じ Worker として前の版へ戻すだけで、データの巻き戻しは要らない。

## テストと受入条件

- core (vitest): 指標定義 3 件、比較期間 (previous/yoy) の月範囲と全期間で比較なし、総収支 (monthlyTotalCashflow) との期間合計の一致、スパークラインの 12 か月、増減額・増減率・構成比・寄与度の境界値、要確認 0 件と 1 件以上の件数・金額と数値に含まれないこと、口座が空の freee 行の出典、最も変化が大きい月の同値と全 0、説明文の形 (取引先 1 件と複数件)、3 指標×3 範囲×2 比較対象の恒等式、テスト用指標 1 件の追加。
- api (vitest): 「Contract tests」の各項目。
- web (DOM テスト): 画像の主要ブロックの描画、比較条件の切替で KPI・表・チャートの系列が切り替わる、URL からの条件復元、月の選択で詳細パネルが切り替わる、単一カテゴリトリガーと独立した取引先内訳、初期 `recommended` と選択後 `focus` の CTA、MF 由来の `/classify` と freee 由来の月 query 付き `/analysis/total-cashflow`、/classify の category + payee 完全一致、全期間の8列と1年案内、追加指標の主図、意味色、スパークラインの null gap、新画面に旧判定が無いこと、要確認の注記、口座が空の『—』表示。
- 視覚: headless Chrome の検査で推移の図の描画枚数を確認する。
- 全体: package 全件 test・typecheck・lint・build / Worker dry-run・対象 DOM・分割視覚検査・preview:smoke が緑。
- 受入: S1〜S5 がすべて満たされる。

## 未決事項

- なし。利用者決定 14 件 (qa-trends-decision-001〜014) と意思決定 3 件 (dec-trends-datasource-001、dec-trends-review-rows-001、dec-trends-judgement-source-001) で、手を打つ順番の扱い・説明文の作り方・汎用性の範囲・明細への導線・期間タブ・前期間の定義・初期の選択月・数値の出所・スパークラインの月数・全期間の扱い・クエリの扱い・要確認の明細の扱い・傾向の判定の基準・口座が空の行の扱いが確定している。

## 確定意思決定

| id | 決定 | 根拠 |
|---|---|---|
| qa-trends-decision-001 | 既存の手を打つ順番は rolling deploy 中の旧 Worker fallback だけに残し、新比較画面からは重複を除く | 今回の目標画像との再比較 |
| qa-trends-decision-002 | 増減要因の説明文は規則で自動生成する | 利用者の選択 |
| qa-trends-decision-003 | 指標を登録制にし、今回は収入・支出・純収支を出す | 利用者の選択 |
| qa-trends-decision-004 | /classify に category と取引先の絞込を足す。取引先は名寄せしない | 利用者の選択 |
| qa-trends-decision-005 | 期間タブは全体の期間選択を操作する | 利用者の選択 |
| qa-trends-decision-006 | 前期間は直前の同じ長さ | 利用者の選択 |
| qa-trends-decision-007 | 初期の選択月は最も変化が大きい月 | 利用者の選択 |
| qa-trends-decision-008 / dec-trends-datasource-001 | 数値は総収支と同じ取引集合 (freee+MF の消し込み後) から数え、freee 由来の行は総収支画面を開く | 利用者の選択 (2 案比較、推奨案) |
| qa-trends-decision-009 | カテゴリ表のスパークラインは直近 12 か月 | 利用者の選択 |
| qa-trends-decision-010 | 全期間では比較を出さず、KPI の増減は最も変化が大きい月の前月差 | 利用者の選択 |
| qa-trends-decision-011 | 形式違反の month などは既定値へ倒し、400 は未登録 metric だけ。取引先は専用の payee で完全一致 | 利用者の選択 |
| qa-trends-decision-012 / dec-trends-review-rows-001 | 要確認の明細は数値に含めず、件数と金額を帯と詳細パネルに出して総収支へ導く | 利用者の選択 (2 案比較、推奨案) |
| qa-trends-decision-013 / dec-trends-judgement-source-001 | 傾向の判定は MF の明細だけで計算したまま、見出しに基準を明記する | 利用者の選択 (2 案比較、推奨案) |
| qa-trends-decision-014 | freee 由来で口座が空の行は『—』と表示し、口座で絞らない | 利用者の選択 |
