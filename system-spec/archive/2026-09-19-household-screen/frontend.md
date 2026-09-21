---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G3, G4]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-household-frontend-web-001。裏付け質疑 (`qa_refs`): `qa-household-frontend-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、フロントエンドでは React Native などのネイティブ実行環境で推移グラフと表を描き直すか、web の部品をどこまで共有するかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、フロントエンドではタブレット専用の画面分割 (表と詳細の常時 2 ペイン) を別ルートにするか、同じ家計画面の分岐にするかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、フロントエンドでは Electron などのシェルに web 資産を同梱するか、オフライン時に家計の集計をどこまで端末で持つかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、フロントエンドでは配布形式 (AppImage・Flatpak 等) ごとに web 資産の更新をどう届けるかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、フロントエンドでは WebView 版とネイティブ版のどちらで家計画面を描き、署名と自動更新をどう扱うかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | 表示の共通部品を使う規則を、家計収支画面の部品分割に反映した。ページの枠は PageShell / PageState、KPI は KpiCard、グラフは FinancialFigure と charts.ts の系列色、ボタンは共通 Button を使い、色は design-tokens のトークンだけで書く (直書き色は lint の check-design-tokens で落ちる)。下部の選択中バーは総収支と推移に個別実装があるため、家計画面でも同じ見た目の規約に合わせる。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | サーバ状態と画面状態を分ける規則を、家計収支画面の取得と選択に反映した。家計の本体・区分詳細・名義ラベルはどれも TanStack Query のサーバ状態として持ち、名義ラベルの保存後は家計・設定・明細のクエリを無効化して再取得する。seg・month・cat の選択は URL の状態として持ち、コンポーネント内に複製しない。ページは遅延読み込みのまま初期 JS 予算に含めない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G3, G4

#### 主たる接地根拠: `qa-household-frontend-web-001`

**問**

web の家計収支画面のフロントエンド構成 (ファイル分割・状態・取得・部品) をどう作るか。

**答**

Household.tsx を packages/web/src/pages/household/ へ分割する (画面の親、KPI と前年より、推移チャート、事業と個人の等式、カテゴリ表、カテゴリ詳細パネル、名義別収入、選択月の振替全件 (抜粋なし)、名義ラベル編集ダイアログ、前年との比較、下部バー)。選択中の対象 (seg)・月 (month)・区分 (cat) は useSearchParams で URL に保ち、期間は既存 usePeriod を使う。本体は TanStack Query で GET /api/household を 1 回取得し、カテゴリ詳細は cat と month が決まったときだけ GET /api/household/category を取得する (dependent query)。名義ラベルは GET / PUT /api/settings/owner-labels を useMutation で保存し、成功時に家計・設定・明細のクエリを無効化する。色は design-tokens のトークンだけ、ボタンは共通 Button、ページは PageShell / PageState、グラフは FinancialFigure と charts.ts の系列色。名義の表示は core の ownerLabel だけを通し、OWNER_LABEL の直参照を残さない。routeMetadata の /household の名称を『家計収支』へ改め、figure-guides と用語集を合わせる。ページは遅延読み込みのままにし、初期 JS 予算 (CI 実測) を超えない。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-18T12:02:30Z` — answered_at に承認時刻 2026-09-18T11:25:37Z を写していた。この回答は利用者の承認と決定 001〜007 を agent が具体化した文で、実際に記録したのは R2 の chunk を適用した 2026-09-18T11:36:56Z である。
>   - 変更: `answered_at` `'2026-09-18T11:25:37Z'` → `'2026-09-18T11:36:56Z'` (フィールドは訂正後の値。旧値はこの行にのみ残る)
> - `2026-09-18T12:02:30Z` — answered_at の訂正を記録した。本文の値は利用者の決定 001〜007 と承認の範囲に収まり、agent が補った値は含まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-household-cashflow-001) と利用者決定 qa-household-decision-001〜007 を、specs/spec-household-cashflow-screen.md へ具体化した回答 / 回答時刻: 2026-09-18T11:36:56Z)

#### 裏付け質疑: `qa-household-frontend-web-evidence-001`

**問**

frontend 章の裏付けとして、現行の家計画面と共通部品について何を観測したか。

**答**

packages/web/src/pages/Household.tsx は 657 行の 1 ファイルで、routeMetadata.ts:68-79 の /household はラベル『累計収支』・グループ『整える』(Layout.tsx:57)。共通部品は components/Page.tsx の PageShell / PageHeader / PageState / KpiCard / PageActions、period.tsx の usePeriod / PeriodPicker、trends/TrendDetailPanel.tsx (出典)、SortableTableHeader、FinancialFigure がある。下部の選択中バーは共通化されておらず、trends/ComparisonScreen.tsx:51 の tcf-selection-bar と TotalCashflow.tsx:1089 に個別実装がある。推移 (#56) は pages/analysis/trends/、マトリックス (#57) は pages/analysis/matrix/ へ分割した前例がある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /household を 10-household.png どおりの画面にする。問いの見出し『家計の総収入・総支出・純収支は、どう変わりましたか？』と説明文、データの出典カード (取込元の代表名と件数・取込明細を確認)、期間タブ (既存の期間選択を引き継ぐ 1年 / 2年 / 3年 / 任意と対象範囲)、KPI 3 枚 (総収入・総支出・純収支と月平均・年換算) と前年差カード、月別の家計収支推移 (家計全体 / 事業 / 個人のタブ、当期の収入・支出の棒、純収支の折れ線、前年の収入・支出の点線、月送り)、事業と個人の内訳 (家計全体 = 事業 + 個人の等式と重複なしの注記)、生活費カテゴリ別の内訳表、名義別の収入、振替は収入・支出から除外、名義ラベルの設定、前年との比較 (増減と文章の要約)、下部の選択中バー (選択中の月と純収支・内訳の明細を確認) を、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持ち、ナビの名称を『家計収支』へ改める。
- **G3**: 生活費カテゴリの行を選ぶと『カテゴリの詳細』パネルを出す。期間合計 `current`、選択月全件合計 `monthTotal`、選択月の最大 5 件プレビュー `transactions` を分離し、カテゴリのすべて見るは月とカテゴリで絞った明細へ遷移する。
- **G4**: 名義を『本人 / パートナー / 子ども / その他』で扱えるようにする。内部値 (business / spouse / family と未設定) は変えず、名義ラベル表を追加する追加のみの migration と、表示名の取得・更新 API を設ける。初期表示名は business→本人、spouse→パートナー、family→子ども、未設定→その他。『名義ラベルを編集』から表示名だけを変更でき、家計画面・設定画面・明細画面の名義表示がすべてこの表示名を参照する。更新 API は既存の authGuard・パスワード変更フェンス・スキーマガード・変更系フェンスの内側に置き、入力は zod で長さと文字種を検証する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 家計収支画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・出典カード・期間タブ・KPI 3 枚と前年差カード・推移のタブ 3 つと凡例 5 系列と月送り・事業と個人の等式・生活費カテゴリ表・名義別収入・振替除外の一覧・名義ラベル設定・前年との比較・下部の選択中バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O3 | カテゴリ詳細が選択と同期し、明細へ遷移できる。 | DOM テストで `current` / `monthTotal` / 最大 5 件の `transactions` プレビューの分離と、カテゴリのすべて見るの月・カテゴリ絞り込みを確かめる。 |
| O4 | 名義ラベルの編集が安全に保存され全画面に反映される。 | API 統合テストで、未認証 401・変更系フェンス違反の拒否・長さ超過と制御文字の 400・正常更新の 200 と再取得での反映を確認し、migration が既存行を 1 行も書き換えないことを検査する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Household.tsx を pages/household/ 配下へ分割し、問いの見出し・出典カード・KPI と前年差・推移チャート・事業と個人の等式・カテゴリ表と詳細パネル・名義別収入・振替除外・名義ラベル設定・前年との比較・下部の選択中バーの構成に作り直し、選択中の月とカテゴリとタブを URL に保つ。
- **I2**: 月別推移に家計全体 / 事業 / 個人のタブ、当期の収入・支出の棒、純収支の折れ線、前年の収入・支出の点線、月送り (< 2026年8月 >) を持たせ、月の選択を下部バーと同期する。
- **I4**: 生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる。
- **I5**: カテゴリ詳細の `current` / `monthTotal` / 最大 5 件の `transactions` プレビューを返す取得経路を設け、選択時にだけ取得する。カテゴリのすべて見るは明細画面を月・カテゴリ・対象で絞った URL で開く。
- **I6**: owner_labels 表と GET / PUT の表示名 API、名義ラベル編集ダイアログを作り、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる。
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
- **dec-household-owner-model**: 名義を『本人 / パートナー / 子ども / その他』で扱うとき、内部値を移行するか、内部値を残して表示名だけを編集可能にするか。
  - 採択: 内部値は残し表示名を編集可能にする (`opt-owner-display-label`)
  - 目的適合: G4 の表示名の要件を満たし、既存の business / spouse / family / unset を使う規則・明細を壊さない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の依存方向を、web が家計の集計規則を持たない構成に適用した。現行 Household.tsx は 657 行の 1 ファイルで前月比や名義の振り分けを画面側で組んでいるが、新しい構成では householdSummary の結果をそのまま描く部品群 (KPI・推移・6 区分の表・詳細パネル・名義別収入・振替・名義ラベル編集・下部バー) を pages/household/ に分ける。seg・month・cat の選択は URL に置き、再読込や共有で同じ画面へ戻れるようにする。カテゴリ詳細は選択が決まったときだけ取得する dependent query にし、本体の取得を 1 回に抑える。名義の表示は core の ownerLabel だけを通し、OWNER_LABEL の直参照を残さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T11:37:52Z)

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
| tanstack-query-dependent-queries | 5.103.1 | TanStack (github.com) | https://github.com/TanStack/query/releases/latest | 2026-09-18T11:39:30Z | 2026-09-18T11:39:30Z |
| react-router-searchparams | 8.4.0 | React Router (Remix / Shopify) (reactrouter.com) | https://reactrouter.com/api/hooks/useSearchParams | 2026-09-18T11:39:30Z | 2026-09-18T11:39:30Z |
