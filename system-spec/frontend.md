---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G4, G5]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-frontend-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-reconciliation-decision-001`, `qa-ui-ux-web-rc-decision-006`, `qa-frontend-web-rc-inference-002` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは照合画面・共通シェル・アイコン群を OS ネイティブ UI で別実装するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは照合画面・共通シェル・アイコン群を OS ネイティブ UI で別実装するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは照合画面・共通シェル・アイコン群を OS ネイティブ UI で別実装するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは照合画面・共通シェル・アイコン群を OS ネイティブ UI で別実装するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは照合画面・共通シェル・アイコン群を OS ネイティブ UI で別実装するかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | Apple HIG の『選択と現在地を見失わせない』を、候補一覧の行選択を aria-selected と詳細パネルの見出しで示し、絞り込みやページを変えても選択中バーに件数を残して『選択をクリア』で外せる確定内容に反映した。書込中はボタンを無効化して二重送信を防ぎ、409 のときは取込中である旨と再試行を出す。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の境界を、web が照合の判定規則を持たず API の結果を描くだけにし、書込後の invalidate を reconciliation・analysis hub・total-cashflow・summary の 4 キーにまとめる確定内容に反映した。共通シェルの件数バッジも同じ取得結果を読み、画面ごとに件数を数え直さない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G4, G5

#### 主たる接地根拠: `qa-frontend-web-rc-observed-001`

**問**

照合画面のフロントエンド構成と、再利用できる部品・アイコン・テストは何か。

**答**

ルートは /analysis/:tab (AuthenticatedApp.tsx:50) → pages/Analysis.tsx → pages/analysis/Reconciliation.tsx。データ取得は TanStack Query 5 の useQuery で GET /api/business-spend の 1 本、スタイルは styles.css:1025-1121。再利用できる部品は DataTable・PageState (読込/空/失敗)・KpiCard・ConfirmDialog・共通 Button (素の <button> は DOM テストで落ちる)・ANALYSIS_HUB_ICONS、総収支 TotalCashflow.tsx の一括選択バー・useMutation・相手選択ラジオ・除外の復元。トークン正本は packages/core/src/design-tokens.ts。アイコンはライブラリを使わず components/RouteIcon.tsx に lucide-static v1.37.0 の SVG を 27 個自前登録しており、画像に要る search・download・circle-help・check・undo-2・funnel・x・chevron-down/left/right・shield-check・wallet (credit-card は登録済み)・file-pen・external-link・lock・cloud・message-circle・circle 等が未登録。route-icon-distinct.test.tsx が絵柄の重複を検査する。Layout.tsx は summary・imports・analysis hub の 3 クエリを持ち、改善要望は lazy の ImprovementRequestButton と /improvement 画面がある。既存テストは reconciliation.dom.test.tsx (3 件)・analysis-tabs / analysis-hub / analysis-navigation の DOM テスト。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/web/src/AuthenticatedApp.tsx, packages/web/src/pages/Analysis.tsx, packages/web/src/pages/analysis/Reconciliation.tsx, packages/web/src/pages/analysis/TotalCashflow.tsx, packages/web/src/components/{RouteIcon,Layout,ImprovementRequestButton}.tsx, packages/web/src/styles.css。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-reconciliation-decision-001`

**問**

画像 04-reconciliation.png の共通シェル (全画面共通部分) と現行の差分をどこまで今回直すか。差分: サイドバー下部『月次クローズの進捗 3/4』カード (現行は現在地表示のみ)、上部バー『防衛ライン：正常』表記・ダウンロード/ヘルプのアイコンボタン・アバター、フッター文言 (毎晩バックアップ/利用規約・プライバシー・データ出典・v1.0 を横並びリンク)。直すと全 20 画面に波及する。選択肢: (A) 全て今回直す。月次クローズ 3/4 は既存 4 ステップ (データ取込/仕分け/照合/月次レビュー) の完了判定から算出し、既存 shell 系 DOM テストも更新する (推奨) / (B) 照合ページ本体だけ / (C) アイコンと文言だけ。

**答**

(A) 全て今回直す を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T07:41:58Z)

#### 裏付け質疑: `qa-ui-ux-web-rc-decision-006`

**問**

照合画面の情報の優先順位 (狭い画面で何を上に残すか) をどうするか。選択肢: (A) 候補一覧と詳細が主役。①照合候補一覧+取引の詳細パネル (判定根拠と操作) ②対応キュー ③KPI 4 枚 ④下段 2 表 ⑤絞り込み。PC は画像の配置のまま。狭幅では KPI→キュー→一覧→詳細 (行選択で詳細へ移動)→下段の順に縦積みし、絞り込みは折りたたむ。誤照合が最も失敗コストが高いため根拠と操作を離さない (推奨) / (B) KPI が主役 / (C) 画像どおり差を付けない。

**答**

(A) 候補一覧と詳細が主役 を選択した。束の順位は ①照合候補一覧+取引の詳細パネル (一致の理由・一致度・操作ボタン・直前の操作) ②対応キュー ③KPI 4 枚 ④下段 2 表 ⑤絞り込み。PC は画像の配置を変えず主役を視覚的な強さで示す。狭幅では KPI→対応キュー→候補一覧→詳細 (行選択で詳細へスクロール移動)→下段 2 表 の順に縦積みし、絞り込みは折りたたみにする。落とすものは無く、加工は狭幅での折りたたみだけ。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-frontend-web-rc-inference-002`

**問**

照合画面の絞り込み・検索・ページ送り・選択状態をどこで持つか。

**答**

GET /api/reconciliation は期間内の候補全件 (KPI・キュー件数も同じ応答) を返し、データソース・ステータス・対象年月・キュー選択・検索語・ページ (10/20/50 件) は web のコンポーネント状態で絞る。検索語と絞り込みは URL にもサーバーにも送らない (期間は既存どおり localStorage 共有、タブは URL)。選択中の行 id は候補の key (MF tx id) で持ち、絞り込みを変えても見えない選択は選択中バーの件数に含めて『選択をクリア』で外せる。書込後は ['reconciliation', period]・analysisHubQueryKey・['total-cashflow', period]・['summary', period] を invalidate し、ハブ・サイドバーのバッジ・総収支を追随させる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に観測事実と利用者決定から導いた推定。単独では確定の根拠にせず、観測事実 (主根拠) の補足として qa_refs に載せる。answered_at は記録直前に date -u で実測した時刻。 前提: qa-backend-web-rc-decision-007 (1 回で返す GET)、docs/ui-decisions.md のタブ URL と期間 localStorage の既存判断、Layout.tsx の analysisHubQueryKey 共有。 / 回答時刻: 2026-09-15T08:59:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /analysis/reconciliation を 04-reconciliation.png どおりの照合画面にする。問いの見出しと説明文・5 タブ・KPI 4 枚 (事業支出 / MF未計上の件数と金額 / 要確認一致候補 / 解消済みの割合ドーナツ)・左の絞り込み (データソース・ステータス・対象年月・リセット) と対応キュー (要確認の候補 / MF未計上 / 金額の差異 / 日付の近い取引)・中央の照合候補一覧 (検索・一括チェック・ステータス・日付・MF の取引内容・金額・freee の候補・差額・一致度・ページ送りと件数切替)・右の取引の詳細パネル (MF の取引 / freee の候補 / 一致の理由 / 一致度バー / 同じ取引として照合 / 別の取引として処理 / 仕分けを開く / 直前の操作と元に戻す)・下段の 2 表 (MFにありfreeeにない支出 / 自動一致できなかった候補 と各導線)・下部の選択中バー (選択をクリア / 選択した取引を照合) を、トークン・共通 Button・PageShell の上に組む。読込・空・失敗・部分成功・確認の各状態も持つ。
- **G4**: 共通シェルを画像に揃える。サイドバーの文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト) とグループ・件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ページ見出し・パンくず・コマンドパレットのラベル追随、月次クローズ進捗 3/4 (データ取込/仕分け/照合は直近の締め月について自動判定、月次レビューは利用者の完了操作を月単位で D1 に保存し取消可)、ヘッダー (防衛ライン：正常 の表記・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター)、フッター (外部送信しない / 税務上の正本は freee / 毎晩バックアップ と 利用規約・プライバシー・データ出典・v1.0) と改善を送るボタン。
- **G5**: 画像で使われるアイコンを全て lucide-static 由来の SVG として RouteIcon (または同等の登録表) に追加し、KPI・キュー・ステータス・一致の理由・操作ボタン・ヘッダー・フッター・サイドバーで表示する。絵柄の重複検査テストを維持する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 照合画面が画像の全構成要素を描画する。 | DOM テストで見出し・KPI 4 枚・絞り込み・対応キュー 4 行・候補一覧 (列 8 と行選択・ページ送り)・詳細パネル・下段 2 表・選択中バーが描画され、読込・空・失敗・部分成功の各状態テストが緑である。 |
| O4 | 共通シェルの差分を実装する。 | shell 系 DOM テストをサイドバー新文言・件数バッジ・月次クローズ 3/4 (自動 3 + レビュー手動の保存と取消)・ヘッダーのアイコンボタン・フッターリンクで更新して緑、月次レビュー API の統合テストが緑である。 |
| O5 | 画像のアイコンを登録し表示する。 | 画像で使われるアイコンの一覧 (docs 記載) と RouteIcon の登録名が一致し、route-icon-distinct テストと各表示箇所の DOM テスト (svg の存在と aria-hidden) が緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Reconciliation.tsx を 3 カラム (絞り込み+対応キュー / 候補一覧 / 詳細パネル) と KPI 4 枚・下段 2 表・選択中バーの構成に作り直し、行選択で詳細パネルを切り替える。
- **I2**: 候補一覧の検索 (取引内容・金額・メモ)・絞り込み・キュー選択・ページ送りと件数切替を実装し、条件リセットを置く。
- **I4**: 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。
- **I5**: routeMetadata のラベルとグループを画像に揃え、件数バッジ・月次クローズ 3/4 (月次レビュー完了の保存と取消)・ヘッダーのアイコンボタン・フッター・改善を送るボタンを共通シェルに入れる。
- **I6**: 画像のアイコン一覧を docs に書き、RouteIcon に不足分を登録して各箇所で表示する。
- **I7**: 一致度・キュー・ステータス・月次クローズ判定の規則を docs に書き、docs/data-schema.md の古い候補条件を直し、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の依存方向を、web が照合の規則を持たない構成に適用した。照合画面は GET /api/reconciliation の結果を描き、一致度やステータスを画面側で再計算しない。検索・絞り込み・ページ送りは表示の都合なので web の状態に置く。Information Design card は同じ件数を 4 か所 (KPI・対応キュー・サイドバーの照合バッジ・ハブの行) に出すときの不一致の危険を示しており、書込後に reconciliation・analysis hub・total-cashflow・summary の queryKey をまとめて invalidate する設計 (qa-frontend-web-rc-inference-002) で 1 つの正本から描かれる状態を保つ。アイコンは外部ランタイムを足さず RouteIcon の lucide-static 登録表を広げ、重複検査テストを維持する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T08:59:56Z)

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
| tanstack-query-invalidation | 5.102.8 | TanStack (tanstack.com) | https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations | 2026-09-15T09:06:26Z | 2026-09-15T09:06:26Z |
| lucide-static-icons | 1.46.0 | Lucide Contributors (lucide.dev) | https://lucide.dev/license | 2026-09-15T09:06:26Z | 2026-09-15T09:06:26Z |
