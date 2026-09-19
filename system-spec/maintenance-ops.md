---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-household-maintenance-ops-web-004。裏付け質疑 (`qa_refs`): `qa-household-maintenance-ops-web-evidence-001`, `qa-household-maintenance-ops-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、保守運用ではモバイルアプリのバージョンごとの互換と、ストア審査を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、保守運用ではタブレット専用画面の回帰テスト (実機の画面幅) をどう回すかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、保守運用では Windows 版の更新失敗時の復旧手順とクラッシュ報告の扱いを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、保守運用では配布形式ごとの動作確認と不具合報告の窓口を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、保守運用では macOS の版更新ごとの互換確認と公証のやり直し手順を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 家計収支画面の回帰を検出する手順を既存の verify:full に載せる形へ反映した。core の不変条件テスト (総収支と一致・事業 + 個人 = 家計全体・6 区分の和 = 総支出・名義別の和 = 総収入・振替は台帳に現れない)、仕様フィクスチャでの画面の DOM テスト、owner-labels の API 統合テストを追加し、旧 household() の参照が残っていないことを検索で確かめる。規則の説明は docs/data-schema.md に集め、画面の決定は docs/ui-decisions.md に残す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G5

#### 主たる接地根拠: `qa-household-maintenance-ops-web-004`

**問**

家計収支画面の品質をどう保ち、規則をどこに残すか。

**答**

core の単体テストで不変条件 (総収支の総合と toBe で一致、全月で事業 + 個人 = 家計全体、6 区分の和 = 総支出、名義別の和 = 総収入、前年欠損で null、振替は台帳に現れない、対推定の決定論) を固定し、specs/spec-household-cashflow-screen.md のフィクスチャ (計算値を含む) で画面再現を DOM テストする。API 統合テストで未認証 401・フェンス違反・表示名の 400 (入力規則の境界。具体値は qa-household-maintenance-ops-web-003 (agent 推定) を参照)・正常更新 200 と再取得を確かめ、migration が既存行を書き換えないことを検査する。集計規則 (等式・欠損規則・6 区分の対応表・振替の対推定) は docs/data-schema.md に明記する。既存の総収支・推移・マトリックス・分析ハブの数値テストが緑のまま、pnpm lint (直書き色の検査を含む)・typecheck・初期 JS 予算を CI で通す。旧 household() の参照が残らないことを検索で確かめる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-maintenance-ops-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-maintenance-ops-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### 裏付け質疑: `qa-household-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、既存の検証コマンドと記録の場所について何を観測したか。

**答**

ルートの package.json は test (全パッケージの test と test:aux)、typecheck、lint (biome と check-design-tokens などの独自検査、security:content)、verify:full (test・typecheck・lint・build と web の check:* 群・preview:smoke) を持つ。design-system:fast は chart-series-contract や common-shell-routes の DOM テストを含む。docs/data-schema.md と docs/ui-decisions.md が集計規則と UI の決定の記録先として使われている。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

#### 裏付け質疑: `qa-household-maintenance-ops-web-003`

**問**

web の家計収支画面で、利用者が決めていない 推定規則を固定する境界テスト を何にするか。

**答**

振替の対推定は日付差 3 日と 4 日、同額が複数あるときの決定論をテストで固定する。名義ラベルは 20 文字と 21 文字、制御文字、重複の境界を API 統合テストで固定する。 これは agent の推定で、利用者は未確認である。画像と決定 001〜007 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様書 specs/spec-household-cashflow-screen.md を書く際に補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-18T12:02:30Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /household を 10-household.png どおりの画面にする。問いの見出し『家計の総収入・総支出・純収支は、どう変わりましたか？』と説明文、データの出典カード (取込元の代表名と件数・取込明細を確認)、期間タブ (既存の期間選択を引き継ぐ 1年 / 2年 / 3年 / 任意と対象範囲)、KPI 3 枚 (総収入・総支出・純収支と月平均・年換算) と前年差カード、月別の家計収支推移 (家計全体 / 事業 / 個人のタブ、当期の収入・支出の棒、純収支の折れ線、前年の収入・支出の点線、月送り)、事業と個人の内訳 (家計全体 = 事業 + 個人の等式と重複なしの注記)、生活費カテゴリ別の内訳表、名義別の収入、振替は収入・支出から除外、名義ラベルの設定、前年との比較 (増減と文章の要約)、下部の選択中バー (選択中の月と純収支・内訳の明細を確認) を、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持ち、ナビの名称を『家計収支』へ改める。
- **G2**: 家計の集計を core の純関数 1 か所に集め、総収支の台帳 (totalCashflowLedger) を正本にする。総収入・総支出・純収支と月平均・年換算、事業と個人の分解 (和が家計全体に一致)、前年同期間との比較 (前年に欠けた月があれば比較不能として null)、月別の収入・支出・純収支と前年系列、生活費カテゴリ 6 区分の集計と構成比・前年差、名義別の収入と前年差を同じ関数から算出し、GET /api/household をこの形へ拡張する。総収支画面の『総合』と家計画面の『家計全体』が同じ期間で同じ数字になることをテストで固定する。
- **G5**: 振替を家計の収入・支出から除外していることを利用者が確かめられるようにする。期間内に除外した振替の一覧 (日付・内容・金額・名義間) を出し、名義間は同額・逆符号・日付が近い振替 2 行を core の純関数で対にし、それぞれの口座の名義表示名から『本人 → パートナー』のように示す。対にならない行は『相手不明』と示す。スキーマは変えない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 家計収支画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・出典カード・期間タブ・KPI 3 枚と前年差カード・推移のタブ 3 つと凡例 5 系列と月送り・事業と個人の等式・生活費カテゴリ表・名義別収入・振替除外の一覧・名義ラベル設定・前年との比較・下部の選択中バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O2 | 家計の数字が総収支画面と一致し、等式が閉じる。 | core の単体テストで、同じ Dataset と期間に対し家計全体の総収入・総支出・純収支が totalCashflowLedger の総合と toBe で一致し、事業 + 個人 = 家計全体が全月で成り立ち、前年欠損月があるとき前年差が null になる。 |
| O5 | 振替の対推定が決定論で再現する。 | core の単体テストで、同額・逆符号・日付差の許容内の 2 行が対になり、許容外・同符号・3 行以上の競合が相手不明または一意な規則で解決され、同じ入力で同じ出力になる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Household.tsx を pages/household/ 配下へ分割し、問いの見出し・出典カード・KPI と前年差・推移チャート・事業と個人の等式・カテゴリ表と詳細パネル・名義別収入・振替除外・名義ラベル設定・前年との比較・下部の選択中バーの構成に作り直し、選択中の月とカテゴリとタブを URL に保つ。
- **I2**: 月別推移に家計全体 / 事業 / 個人のタブ、当期の収入・支出の棒、純収支の折れ線、前年の収入・支出の点線、月送り (< 2026年8月 >) を持たせ、月の選択を下部バーと同期する。
- **I3**: core に household-summary (仮称) を新設し、totalCashflowLedger の行集合から家計全体・事業・個人の総額と月別系列、前年比較、生活費 6 区分、名義別収入を 1 か所で算出する。旧 household() の独自定義は置き換える。
- **I4**: 生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる。
- **I7**: 振替の一覧と対推定を core の純関数にし、日付差の許容・同額・逆符号・一意性の規則を docs とテストで固定する。
- **I8**: routeMetadata の /household の名称を『家計収支』に改め、パンくず・figure-guides・glossary の記述を合わせる。

### 本章に効く確定意思決定

- **dec-household-categories**: 生活費の区分をどう作るか。画像の固定 6 区分へ寄せるか、金額上位 5 大項目とその他にするか。
  - 採択: 固定 6 区分へ寄せる (`opt-fixed-six`)
  - 目的適合: G1 の画像の表と一致し、G3 の詳細パネルで区分の意味が期間をまたいで一定になる。
- **dec-household-figure-source**: 画像の数値が算術で閉じない欄をどう扱うか。収入・支出を正本に差を計算するか、画像の純収支を正本にして前年の総支出を調整するか。
  - 採択: 収入・支出を正本に差を計算する (−¥80,000) (`opt-compute-from-income-expense`)
  - 目的適合: G2 の『数字は台帳の行から作る』と一致し、どの欄も算術で閉じる。見た目の数値は一部画像と変わる。
- **dec-household-ledger-source**: 家計収支の数字を何から作るか。総収支画面の台帳を正本にするか、現行の household() を拡張するか。
  - 採択: 総収支の台帳を正本にする (`opt-ledger-source`)
  - 目的適合: G2 の『家計の集計を 1 か所に集め、総収支と同じ行から作る』に直接答える。総収支の総合と家計全体が同じ行集合から出るため、両画面の数字が一致する。
- **dec-household-nav-name**: ナビの名称をどうするか。/household を『家計収支』へ改名するか、改名に加えて累計収支を新設するか。
  - 採択: /household を『家計収支』に改名する (`opt-rename-household`)
  - 目的適合: G1 の『10-household.png どおりの画面にする』に合わせ、画像の見出しと一致する。
- **dec-household-transfer-pairs**: 振替の欄で名義間の移動を見せるか。入出金の対を推定して表示するか、名義間の欄を出さないか。
  - 採択: 入出金の対を推定して表示する (`opt-transfer-pair-estimate`)
  - 目的適合: G5 の『振替を家計の収入・支出から除外していることを確かめられる』に、どこからどこへ動いたかまで見せて答える。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の『規則は名前と境界値テストで読めるようにする』を、本サイクルで新たに増える 3 つの規則の保守に適用した。(1) 生活費 6 区分の対応表は core の名前付き定数 1 か所に置き、事業側の支出が other に入ることを境界のテストで固定する。(2) 振替の対推定は TRANSFER_PAIR_MAX_DAYS=3 を名前付き定数にし、日付差 3 日と 4 日、同額が複数あるときの決定論 (日付差 → 日付 → id) をテストで固定する。(3) 名義ラベルの検証は 20 文字と 21 文字、制御文字、重複の境界を API 統合テストで固定する。いずれの規則も docs/data-schema.md に同じ名前で記す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T11:37:52Z)

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| vitest-expect | 5.0.1 | Vitest (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-18T11:39:30Z | 2026-09-18T11:39:30Z |
