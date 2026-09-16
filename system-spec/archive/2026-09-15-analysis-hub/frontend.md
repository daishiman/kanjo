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
| Web (web) | 確定 | 確定質疑: qa-frontend-web-ah-observed-001。裏付け質疑 (`qa_refs`): `qa-analysis-hub-decision-001`, `qa-analysis-hub-decision-004`, `qa-frontend-web-ah-decision-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではハブ画面を OS ネイティブ UI で別実装するかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではハブ画面を OS ネイティブ UI で別実装するかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではハブ画面を OS ネイティブ UI で別実装するかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではハブ画面を OS ネイティブ UI で別実装するかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではハブ画面を OS ネイティブ UI で別実装するかどうかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | Apple HIG の『状態を保ち、戻っても同じ場所に戻れる』を、選択中の分析を ?focus= で URL に保持し、行の選択では setSearchParams(..., { replace: true }) で履歴を積まずに置き換え、再読込・URL コピーでも同じ選択を再現する確定内容に反映した。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の境界を、web がハブの判定規則を持たず API の結果を描くだけにする確定内容に反映した。バッジとハブ画面は同じ queryKey の 1 回の取得を共有し、同じ件数を 2 か所で別々に計算しない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G5

#### 主たる接地根拠: `qa-frontend-web-ah-observed-001`

**問**

支出分析のフロントエンド構成 (ルーティング・データ取得・共通部品・既存テスト) は現行どうなっているか。

**答**

React 18 + react-router-dom 7 + TanStack Query 5 + Chart.js 4 の Vite SPA (packages/web)。AuthenticatedApp.tsx が /analysis と /analysis/:tab を AnalysisPage へ割り当て、routeMetadata.ts が APP_ROUTES (analysis は navGroup 確認・contentWidth data)・ANALYSIS_TABS (id/path/label/task/taskDetail/icon)・DEFAULT_ANALYSIS_TAB・LEGACY_ROUTE_REDIRECTS (/reconciliation・/matrix・/trends・/diagnosis)・SEARCH_ROUTES を正本として持つ。各タブは pages/analysis/ の Reconciliation.tsx (/api/business-spend, queryKey ['business-spend', 期間 key])・TotalCashflow.tsx (/api/total-cashflow、判定 POST /total-cashflow/verdicts、除外 /total-cashflow/freee-exclusions)・Matrix.tsx (/api/matrix)・Trends.tsx (/api/trends?scope=)・Diagnosis.tsx (/api/diagnosis) で、表示していないタブは遅延読み込みされ API を呼ばない (analysis-tabs.dom.test.tsx が検査)。期間は period.tsx の usePeriod() が selection/key/withPeriod(path) を返しクエリへ付ける。共通部品は components/Page.tsx (PageShell/PageHeader/TaskCopy/PageState/KpiCard/PageActions)・Button.tsx (primary/secondary/danger/text、native button は data-native-control と ARIA 必須で AST テストが検査、遷移は Link className='btn primary')・DataTable.tsx・charts.ts。トークンは packages/core/src/design-tokens.ts が正本で、styles.css の生成ブロックは scripts/check-design-tokens.mjs --write で作り、packages/web/src の色直書きは lint で落ちる。--aside-panel-w 320px は定義のみで未使用。URL コピーは ImprovementRequestButton.tsx・Improvement.tsx・Ai.tsx が navigator.clipboard を使う実装を持つ。タブ label を直接比べるテストは analysis-tabs.dom.test.tsx・navigation-ux.dom.test.tsx・common-shell-routes.dom.test.tsx (認証後 19 ルート + ログイン 1)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/web/src/{AuthenticatedApp.tsx,routeMetadata.ts,pages/Analysis.tsx,pages/analysis/*.tsx,period.tsx,components/{Page,Button,DataTable,Layout}.tsx,components/charts.ts,styles.css}, docs/design-system.md。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-analysis-hub-decision-001`

**問**

支出分析ハブ (03-analysis-hub.png) は既存の 5 タブとどうつなげるか。現行は /analysis を開くと照合タブへ転送される。選択肢: (A) /analysis をハブにし、各行やタブの『開く』で既存 /analysis/:tab 詳細へ進み、選択中の分析を ?focus= で URL に持ち URL コピーで共有できる (推奨) / (B) 転送を残し 5 タブすべての上部にハブ要素を常時表示する。

**答**

(A) /analysis をハブにする を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

#### 裏付け質疑: `qa-analysis-hub-decision-004`

**問**

画像の文言は現行と違う (タブ『照合/総収支/マトリクス/推移/診断』は現行『支出照合/トータル収支/増減マトリクス/支出トレンド/統計診断』、サイドバーの『明細仕分け/累計収支』も異なる)。どこまで画像に合わせるか。選択肢: (A) 支出分析の 5 タブ名とサイドバー子行 (件数バッジを含む) だけ短縮形に揃え、他画面のサイドバー文言と月次クローズ進捗の形は各画面のサイクルで扱う (推奨) / (B) サイドバー全体と月次クローズ 3/4 チェックリストも今回合わせる / (C) 文言は現行のまま構成だけ合わせる。

**答**

(A) 分析まわりだけ合わせる を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-14T11:33:07Z)

#### 裏付け質疑: `qa-frontend-web-ah-decision-003`

**問**

サイドバーの件数バッジのためにハブ API を全画面で使う。既存方針『表示していないタブの API は呼ばない』との関係と、データ更新時の扱いをどうするか。選択肢: (A) Layout とハブで同じクエリを共有。queryKey ['analysis-hub', 期間 key] を共有して 1 回の取得で両方をまかなう。『呼ばない』の対象は 5 タブ個別 API に限り、ハブ API は例外として docs に明記する。総収支の判定・除外や取込の更新後はこのキーを無効化し、staleTime で画面遷移ごとの再取得 (D1 読み取り) を抑える (推奨) / (B) バッジは支出分析内だけ。

**答**

(A) Layout とハブで同じクエリを共有 を選択した。サイドバー (components/Layout.tsx) とハブ画面は同一の queryKey ['analysis-hub', 期間 key] で GET /api/analysis/hub を共有し、TanStack Query のキャッシュで 1 回の取得を両方に使う。C3『表示していないタブの API は呼ばない』の対象は 5 タブ個別の API (/business-spend・/total-cashflow・/matrix・/trends・/diagnosis) に限り、ハブ API はその例外として docs/ui-decisions.md に明記する。総収支の判定 (POST /total-cashflow/verdicts)・freee 除外・取込などハブの件数を変える更新が成功したら invalidateQueries({ queryKey: ['analysis-hub'] }) で前方一致の無効化をする。staleTime を設けて、画面遷移のたびに loadDataset と freee 系 3 テーブルの D1 読み取りが走らないようにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の差し戻しを受けた再質問)。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-14T11:57:13Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /analysis を 03-analysis-hub.png どおりのハブ画面にする。短い問いの見出し・URL コピー・5 タブ・期間の収支サマリー (総収入/総支出/純収支と前 12 か月比、総収支の説明パネル)・分析ルート一覧 (# / 分析の視点 / 目的 / 現在の状態 / 要確認の優先度 / 次の操作)・右の選択中の分析パネル (わかること / 主なデータソース / 対象外のデータ / 開く)・分析の読み順 5 ステップ・下部の選択中分析バーを、共通シェル・トークン・Button の上に組む。
- **G2**: 選択中の分析を URL (?focus=<tab id>) で保持し、URL コピー・再読込・戻る操作でも同じ分析が選ばれた状態を再現する。既存の /analysis/:tab 詳細と旧 URL の転送は壊さない。
- **G5**: 支出分析まわりの文言を画像に揃える。5 タブ名を 照合/総収支/マトリクス/推移/診断 の短縮形にし、サイドバーの支出分析の子行に要確認件数バッジを付ける。他画面のサイドバー文言と月次クローズ進捗の形は対象外とする。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | /analysis がハブを描画し、/analysis/:tab と旧 URL の転送は既存どおり動く。 | DOM テストで /analysis がハブの見出し・サマリー・ルート一覧 5 行・読み順 5 ステップ・選択中の分析パネルを描画し、/analysis/reconciliation 等の既存 5 タブと旧 URL のテストが緑のままである。 |
| O2 | ?focus=<tab id> の読み書きと URL コピーを実装する。 | DOM テストで ?focus=total-cashflow を開くと総収支行と右パネルと下部バーが選択状態になり、行を選ぶと URL が置き換わり、不正な focus 値は既定値に落ち、URL コピーが現在の URL をクリップボードへ書く。 |
| O5 | 5 タブ名の短縮とサイドバー子行の件数バッジを入れる。 | routeMetadata の ANALYSIS_TABS label が短縮形になり、関連 DOM テスト (analysis-tabs / navigation-ux / common-shell-routes) を新しい文言で更新して緑、子行バッジは要確認 1 件以上の視点だけに件数を表示する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: /analysis の転送をやめ、ハブ画面 (AnalysisHub) を描画する。5 タブのリンクは既存 /analysis/:tab へ進む。
- **I2**: 分析ルート一覧の行選択で ?focus= を置き換え、右パネルと下部バーの内容を切り替える。URL コピーは現在の URL をクリップボードへ書き、成否を知らせる。
- **I3**: 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。
- **I6**: ANALYSIS_TABS の label を 照合/総収支/マトリクス/推移/診断 にし、サイドバー子行に要確認件数バッジを付ける。
- **I7**: 各視点の『わかること・主なデータソース・対象外のデータ』を routeMetadata の静的定義として構造化し、右パネルがそれを表示する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の依存方向を、web がハブの規則を持たない構成に適用した。ハブ画面とサイドバーのバッジは GET /api/analysis/hub の結果を表示するだけで、優先度や正常判定を画面側で再計算しない。各視点の『わかること・データソース・対象外』は判定ではなく静的な説明なので、routeMetadata に置く。Information Design card は、同じ件数を 2 か所 (ハブの一覧とサイドバーのバッジ) に出すときに値がずれる危険を示している。同一 queryKey の共有と、更新後の invalidateQueries (qa-frontend-web-ah-decision-003) は、この 2 か所を 1 つの取得結果から描くための適用である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

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
| react-router-use-search-params | 7.18.3 | Remix / Shopify (React Router) (api.reactrouter.com) | https://api.reactrouter.com/v7/interfaces/react-router.NavigateOptions.html | 2026-09-14T12:12:42Z | 2026-09-14T12:12:42Z |
| tanstack-query-invalidation | 5.102.8 | TanStack (tanstack.com) | https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation | 2026-09-14T11:57:54Z | 2026-09-14T11:57:54Z |
