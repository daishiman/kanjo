---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G2, G5]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-diagnosis-frontend-web-001。資するゴール: G1, G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS / Android)を提供していたなら、診断画面の本カテゴリでは端末向けの描画方式と、チャート部品の置き換えを決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS / Android)を提供していたなら、診断画面の本カテゴリでは端末向けの描画方式と、チャート部品の置き換えを決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末向けの描画方式と、チャート部品の置き換えを決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末向けの描画方式と、チャート部品の置き換えを決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末向けの描画方式と、チャート部品の置き換えを決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-diagnosis-001`

2026-09-17T21:57:21Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で診断画面サイクルの foundation (U1・G1-G6・対象外・制約) を『この内容で承認』と回答した。先行する利用者決定 (同日 2026-09-17T21:51:23Z より前の同一セッション): 健全性スコア=固定費比率30%・貯蓄率30%・収支の安定性25%・データカバー率15%の重みで 0-100 へ合成する規則ベースの指標とし内訳を開閉表示する、改善アクションの対応状況=D1 の新表 (照合の reconciliation_actions と同じ型) へ保存して期間切替と再取込をまたいで引き継ぐ。指標切替 (支出/収入/純収支) と旧統計表の開閉保持も承認に含まれる。

#### この承認を名指ししている質疑: `qa-target-platforms-diagnosis-001`

**問**

診断画面 (08-diagnosis) の作り直しは、どの platform を対象にしますか。web / mobile / tablet / desktop-windows / desktop-linux / desktop-macos の6 種それぞれについて、対象に含めるか外すかを決めてください。

**答**

対象は web のみとする。mobile / tablet / desktop-windows / desktop-linux / desktop-macos の 5 種は本サイクルの対象外とする。

理由: 本プロダクト kanjo は Cloudflare Workers 上の API (packages/api) と、ブラウザへ配信する SPA (packages/web、React 18 + react-router-dom 7) の 2 つだけで構成されており、専用アプリの成果物・配布経路・ビルド設定はリポジトリに存在しない。直前の総収支画面 (PR #55)・照合画面 (PR #54)・推移画面 (PR #56) の各サイクルも同じ理由で web のみを対象としており、本サイクルで方針を変える理由がない。上位概念の対象外 (scope.out) にも『web 以外の platform』を明記して利用者承認済み (appr-foundation-diagnosis-001)。

なお web はレスポンシブで提供するため、スマートフォンのブラウザからも閲覧できる。ここで対象外にしたのは『専用アプリという成果物』であって『小さい画面』ではない。小さい画面での表示は ui-ux / frontend の web セルで扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (上位概念 scope.out) + リポジトリ構成の観測 (packages/ 配下は api / core / web のみ) / 回答時刻: 2026-09-17T22:01:23Z)

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | 表とウォーターフォールで積む順序を同一にし、同じ事実が 2 つの表現で食い違わないようにした。チャートは chart.js の bar の floating bar ([start, end]) で描き、プラグインを足さずに既存の色トークンと yen 書式へそろえる。ステータス変更は楽観更新せずサーバ返却を正として invalidate し、合計金額が一瞬ずれて見える状態を作らない。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 画面は improvements[] を描くだけの層に保ち、検知器 id の分岐と金額の再計算を持たない。次のアクションの行き先もサーバが返す経路名を Link へ渡すだけにして、どの課題がどこへ繋がるかという業務判断を画面側へ写さない。1 ファイルに詰めず、優先順位表・ウォーターフォール・診断根拠・詳細パネル・健全性内訳を子コンポーネントへ分ける。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G5

#### 主たる接地根拠: `qa-diagnosis-frontend-web-001`

**問**

診断画面のフロントエンドはどう作りますか。既存の web 構成 (React 18 / react-router-dom 7 / TanStack Query 5 / chart.js 4) のどこに何を置き、検知器の種類をどう扱いますか。

**答**

既存構成をそのまま使い、新しいライブラリは入れない。

**配置**: 画面は packages/web/src/pages/analysis/Diagnosis.tsx を作り直す。1 ファイルに詰め込まず、改善アクション表・ウォーターフォール・診断根拠・詳細パネル・健全性内訳を同ディレクトリ配下の子コンポーネントへ分ける。KpiCard / PageState / DataTable / HowTo / Term は既存のものを再利用し、新しい表示部品を作る前に既存 components を探す。

**データ取得**: TanStack Query 5 の useQuery を使い、queryKey に期間キーと条件の帯 (範囲・指標・比較対象) を含める。api ヘルパと usePeriod の withPeriod を通し、fetch を直接書かない。ステータス変更は useMutation で、成功時にdiagnosis の queryKey を invalidate する。楽観更新はせず、サーバ返却を正とする (合計金額がずれて見えるのを避けるため)。

**検知器の分岐を持たない (G2)**: 画面側に検知器 id の switch / if を書かない。サーバが返す improvements[] の各要素が、表示に必要な値 (ラベル・説明・年間インパクト・手間・根拠・次のアクション先) を自分で持つ。既存 Diagnosis.tsx の kindLabel / judgePill のような『種類名を画面が知っている』マップは、汎用の見た目マップ (severity → pill class) 以外には作らない。次のアクション先はサーバが返す経路名をreact-router-dom の Link へ渡すだけにする。

**チャート**: ウォーターフォールは chart.js 4 の bar で、各バーの value を [start, end] の floating bar として与えて表現する (専用プラグインを足さない)。既存チャートと同じ色トークンと目盛り書式 (yen) を使う。

**状態の所有**: 期間は既存 `usePeriod` が localStorage で分析画面間に共有する。範囲・指標・比較対象・選択行・畳み・統計開閉は searchParams に持ち、再読み込みと共有リンクで診断固有の表示が戻るようにする。

**型**: 返却形の型は packages/web/src/api.ts の DiagnosisData を拡張し、packages/core の型と齟齬が出ないようにする。any を置かない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存実装の観測 (packages/web/src/pages/analysis/*.tsx、api.ts、period.ts、package.json の依存) + G1/G2/G5 / 回答時刻: 2026-09-17T22:01:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /analysis/diagnosis を 08-diagnosis.png どおりの構成にする。期間タブ (1年/2年/3年/任意) と期間表示、問いの見出し『次に改善すると、最も効くのはどこですか?』と説明、条件の帯 (分析の範囲 事業/家計/総合・表示する指標 支出/収入/純収支・比較対象 前期間/前年)、診断結果カード (最も効く改善の見出しと年間改善余地の金額・補足・信頼度・データカバー率)、健全性カード (0-100 のスコアと区分)、主なシグナル 3 件、改善アクションの優先順位の表 (# ・優先度・課題・年間改善インパクト・対応の手間・ステータス・次のアクション)、改善インパクトの見込みのウォーターフォールチャート (改善余地合計→項目ごとの削減→改善後の支出見込み) と注記、診断根拠の表 (データソース・対象期間・カバー率・主な内容)、完了すると変わる指標 (年間支出・固定費比率・月次収支の平均・貯蓄率の before→after)、選択した項目の詳細パネル (優先度・タイトル・説明・概要/関連データ/明細サンプルのタブ・なぜ優先度が高いのか・関連する数値・主な内訳・実行ボタン 2 つ)、下部の選択バー (選択中の課題・年間改善インパクト・対応の手間・実行ボタン) を、共通シェル・トークン・共通 Button/PageShell・chart.js の共通設定の上に組む。既存の科目別プロファイル表と自動診断は『統計の詳細を表示』で開閉できる根拠として下部に残す。
- **G2**: 改善余地の見つけ方を登録制にする。検知器の定義を packages/core に置き、各候補が impactBasis・scope・metric・claimKeys・対象 query 付き nextAction を自己記述する。`detectImprovements()` が条件の帯と claim overlap を適用し、`diagnosisScreen()` が画面応答を合成する。画面・APIに検知器 id の分岐を増やさない。
- **G5**: 診断から根拠と実行先へ辿れるようにする。各 Improvement の nextAction が対象 query を含む URL を持ち、画面は Link へ渡すだけとする。`/classify` は month / cls / category / payee、`/budget` は account、`/subscriptions` は account または vendor / month、`/analysis/reconciliation` は month / payee / amount を用途別に渡し、値は percent encode する。期間は usePeriod / localStorage、範囲・指標・比較対象・選択・畳みは URL に保持する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 診断タブが画像の全ブロックを描画する。 | DOM テストで期間タブ・見出し・条件の帯・診断結果カード・健全性カード・主なシグナル 3 件・改善アクションの表・ウォーターフォールチャート・診断根拠の表・完了すると変わる指標・詳細パネル (3 タブ)・選択バーが描画され、科目別プロファイルは開閉で表示されることを確認する。色・余白・部品はトークンと共通 Button/PageShell/chart の共通設定経由で、直書き色の lint が 0 件である。 |
| O2 | 検知器を足すときに画面と API を編集しなくてよい。 | 検知器定義を 1 件足したテストで、画面の表・ウォーターフォール・詳細パネルと API の返却に新しい課題が現れ、packages/web と packages/api のコードに検知器 id の分岐が 0 件であることを静的検査とテストで確認する。 |
| O5 | 診断から根拠と実行先へ辿れる。 | 課題の種類ごとに実行ボタンを押した DOM テストで、/classify・/budget・/subscriptions・/analysis/reconciliation・/analysis/total-cashflow が期待した絞込クエリで開き、条件が URL から復元されることを確認する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 診断タブの上部に期間タブ (1年/2年/3年/任意) と期間表示を置き、全体の期間選択と同期させる。
- **I2**: 問いの見出し『次に改善すると、最も効くのはどこですか?』の下に、分析の範囲・表示する指標・比較対象の 3 つの切替を 1 本の帯にまとめて置く。
- **I3**: 診断結果カードに、最も効く改善の見出し (例『固定費の見直しで年間 ¥148,000 の改善余地』)・補足・信頼度・データカバー率を出す。
- **I5**: 主なシグナルを 3 件まで、順位付きで短文と根拠の数値つきで出す。
- **I6**: 先頭の有効項目を primary improvement として要約する。改善アクション表を master、選択項目の詳細を detail とし、行を選ぶと詳細パネルと固定アクションバーが同じ action_key へ連動する。
- **I7**: 改善インパクトの見込みをウォーターフォールチャートで出す。左端に改善余地の合計、中間に項目ごとの削減 (負の棒)、右端に改善後の支出見込みを置き、『年間 ¥X の改善で支出を Y% 削減できます』の注記を添える。
- **I8**: 診断根拠の表に、データソース (銀行口座・クレジットカード・電子マネー・手入力データ) ごとの対象期間・カバー率・主な内容と、全体のデータカバー率を出す。
- **I9**: 完了すると変わる指標として、年間支出・固定費比率・月次収支の平均・貯蓄率の before→after と差分を出す。
- **I10**: 選択した項目の詳細パネルに、優先度・タイトル・説明・タブ (概要/関連データ/明細サンプル)・なぜ優先度が高いのか・関連する数値 (今回/前期間/増減額/増減率/対象期間/信頼度)・主な内訳 (カテゴリ)・実行ボタン 2 つを出し、閉じるとパネルが畳まれる。
- **I11**: 下部の固定アクションバーに、選択中の課題・年間改善インパクト・対応の手間と対象 query 付きの主たる実行ボタンを表示する。本文を隠さない末尾余白を確保する。
- **I13**: 既存の科目別プロファイル表と自動診断は『統計の詳細を表示』で開閉できる根拠として下部に残し、どの基準で数えたか (MF 明細の事業側だけか) を明記する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture の依存方向 (内側は外側を知らない) を、検知器の種類を画面に漏らさない形で適用した。improvements[] の各要素が表示に必要な値 (ラベル・年間インパクト・手間・根拠・次のアクション先) を自分で持ち、画面は種類 id で分岐しない。既存 Diagnosis.tsx の kindLabel / judgePill のような『画面が科目名と種類を知っている』写像は、severity → pill class の汎用写像を除いて作らない。期間は `usePeriod` / localStorage に置き、範囲・指標・比較対象・選択行・畳み・統計開閉だけを URL に載せる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-17T23:25:04Z)

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

### Information Design (表現物の情報設計) — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/information-design.md`

#### 目的

保持しているデータを、受け手が**その利用文脈で最短の認知コストで目的を達成できる形**へ翻訳する。「見た目を良くする」ことではなく、情報の意味的な順序付け・取捨選択・加工を設計判断として明示し、視覚表現をその写像として導出できる状態にする。

#### 解決する問題

- 保存形式 (DB の値・API のフィールド) をそのまま表示形式として採用し、受け手が頭の中で変換させられる (生年月日を見せて年齢を計算させる、絶対日時を見せて「何日前か」を計算させる)。
- 全要素が同じ大きさ・同じ濃度で並び、どこから見ればよいか分からない (強弱の欠如)。
- ラベル・罫線・説明文など「無くても伝わる要素」が削られず、本体の情報を圧迫する。
- 最初に一つの形式 (表・リスト・箇条書き・JSON ダンプ) を作ってしまい、他の形式との比較機会が失われる (早期形式固定)。
- 装飾が「今風に見せる」ために使われ、操作可能性・状態・重要度といった意味を運んでいない。
- 情報の物理的な近さがグループの意味と一致せず、無関係な要素が隣接して誤読を生む。
- 「設計」と「デザイン」を別工程・別担当に分割し、前工程の出力が後工程の到達可能な品質の上限を決めてしまう。

#### 適用条件

- 人間が読む表現物を生成・レビューするとき (UI 画面、report、slide、ダッシュボード、CLI 出力、通知、エラーメッセージ、仕様書)。
- 出せる情報量が受け手の一度に処理できる量を上回り、取捨選択が避けられないとき。
- 受け手と利用文脈が一つに定まる、または文脈ごとに別表現を作る余地があるとき。

#### 非適用条件

- 機械が消費する成果物 (JSON/DB スキーマ/ログの構造化フィールド) — ここでは網羅性・安定性・後方互換が優先し、削減や加工はむしろ有害。
- 監査・法定表示・原本性が要件で、**元の値をそのまま**提示する義務があるとき (加工は併記に留める)。
- 習熟した専任者が長時間・大量に操作する高密度業務画面。一覧性と一括操作の効率が学習容易性より重い場合、表形式・高密度・等価表示が正解になりうる (Nielsen のユーザビリティ 5 指標のうち efficiency を優先する状況)。
- 探索的な使い捨て成果物で、寿命が短く投資が回収できないとき。

#### トレードオフ・失敗モード

- **学習容易性 ⇄ 効率性**: 情報を削って強弱を付けるほど初見は分かりやすくなるが、熟練者の一覧性・一括操作は落ちる。どちらを取るかは context of use が決めるのであって、原則が決めるのではない。
- **加工 ⇄ 検証コスト**: 表示値を加工するほど元データとの突合テストが増える。加工の各件に「どの task を助けるか」を書けないなら加工しない。
- 優先順位付けを飛ばしたまま視覚変数だけ調整し、「なんとなく今風」だが読み順が崩れた表現物を作る (最頻の失敗)。
- 削減を進めすぎて、文脈を持たない受け手が識別できなくなる (会員 No. のラベルまで落とす等)。削減の停止条件は「ラベルなしで受け手が識別できるか」。
- 「シンプルにする」を目的化し、必要な状態表示・エラー理由・可逆性の手がかりまで削る。
- 原則を checklist 化して機械適用し、非適用条件 (高密度業務画面・監査表示) に当てはめて品質を落とす。
- 強弱を色だけで表現し、色覚特性・モノクロ印刷・低コントラスト環境で情報が消える。

#### goalへの寄与

- 要件定義段階で「この表現物の受け手・task・優先順位」を宣言させることで、実装後の主観的な「なんかダサい」を**設計判断への差し戻し**に変換できる (レビューが好みの表明でなくなる)。
- 順位・グループ・削除理由・加工理由が構造化データとして残るため、生成 AI・人間のどちらが作っても同じ根拠で検証できる。決定論ゲート (`../../../scripts/validate-information-priority.py`) が手順の順序制約 (装飾より前に順位が確定していること) を機械検査する。
- 成果は「見た目の評価」ではなく outcome で測る: 目的達成までの操作数・初見での到達率・誤操作率・問い合わせ件数。装飾の量では測らない。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| chartjs-bar-floating | 2025-10-13 | Chart.js (www.chartjs.org) | https://www.chartjs.org/docs/latest/charts/bar.html | 2026-09-17T22:05:46Z | 2026-09-17T22:05:46Z |
| tanstack-query-invalidation | 5.103.1 | TanStack (tanstack.com) | https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation | 2026-09-17T22:05:46Z | 2026-09-17T22:05:46Z |
| react-router-use-search-params | 8.4.0 | Remix Software (React Router) (reactrouter.com) | https://reactrouter.com/api/hooks/useSearchParams | 2026-09-17T22:05:46Z | 2026-09-17T22:05:46Z |
