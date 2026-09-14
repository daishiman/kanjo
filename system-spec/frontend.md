---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G2, G3, G4]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-frontend-web-ds-observed-005。裏付け質疑 (`qa_refs`): `qa-frontend-web-ds-decision-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではデザイントークン正本 (packages/core/src/design-tokens.ts) から CSS 変数とチャート色に加えて、ネイティブ UI ツールキット向けの色・寸法リソース (Swift/Kotlin/XAML 等の定数) も生成する写しの系統を設計し、そのずれ検出も用意する必要があった。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリではデザイントークン正本 (packages/core/src/design-tokens.ts) から CSS 変数とチャート色に加えて、ネイティブ UI ツールキット向けの色・寸法リソース (Swift/Kotlin/XAML 等の定数) も生成する写しの系統を設計し、そのずれ検出も用意する必要があった。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリではデザイントークン正本 (packages/core/src/design-tokens.ts) から CSS 変数とチャート色に加えて、ネイティブ UI ツールキット向けの色・寸法リソース (Swift/Kotlin/XAML 等の定数) も生成する写しの系統を設計し、そのずれ検出も用意する必要があった。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリではデザイントークン正本 (packages/core/src/design-tokens.ts) から CSS 変数とチャート色に加えて、ネイティブ UI ツールキット向けの色・寸法リソース (Swift/Kotlin/XAML 等の定数) も生成する写しの系統を設計し、そのずれ検出も用意する必要があった。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリではデザイントークン正本 (packages/core/src/design-tokens.ts) から CSS 変数とチャート色に加えて、ネイティブ UI ツールキット向けの色・寸法リソース (Swift/Kotlin/XAML 等の定数) も生成する写しの系統を設計し、そのずれ検出も用意する必要があった。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | Apple HIG の一貫性の原則を、見た目の値を画面ごとに持たせず共通部品とトークンだけから描くという実装上の制約に反映した。ボタンやチャートの色を画面側で上書きしないことが、画面間で同じ操作が同じ見た目になることを保証する。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の依存方向を、core (トークン正本) ← web (CSS 変数・charts.ts・部品) の一方向に反映した。core は web を知らず、写しのずれは lint が外側で検出する。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3, G4

#### 主たる接地根拠: `qa-frontend-web-ds-observed-005`

**問**

現行 web で、色の定義はどこにあり、図はどう色を得ていて、どこでずれているか。

**答**

(1) 画面の色の正本は packages/web/src/styles.css の :root (--bg #f6f8f9 / --ink #15262b / --ink-soft #617177 / --line #d7e0e2 / --primary #14353d / --accent #087f78 / --biz #087f78 / --warn #805a12 / --danger #b23a3a / --good #2e7d5b 等)。(2) packages/web/src/components/charts.ts は themeColor() が getComputedStyle(document.documentElement) でその CSS 変数を読み、コメントで『図の色の正本は styles.css の :root』と明言している。直書きは CSS を読めない環境 (SSR・jsdom・CSS 適用前) 向けの COLOR_FALLBACKS で、コメントは『styles.css と同じ値にしてある』とするが実際はずれている (biz #2f5da8 対 #087f78、ink #1d2a2c 対 #15262b、inkSoft #51625f 対 #617177、line #dde3e1 対 #d7e0e2)。CSS 変数を持たない neutral #7b8784 と VENDOR_EXTRA_COLORS 5 色は直書きのみ。(3) 前例として skills/report-design-system/assets/report.css を正本、packages/core/src/report-css.ts を写しとし、scripts/check-report-css.mjs が pnpm lint で一致を検査している。シェルは components/Layout.tsx が aside.sidebar・header.header・footer.footer・nav.tabbar を全ルート共通で描画する。web は React 18 + Vite の SPA で、API 契約 (packages/api の /api/*) は本サイクルで変えない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: charts.ts 30-130 行、styles.css :root、package.json の lint、scripts/check-report-css.mjs をアシスタントが R4-reopen の後に読み直した観測事実。qa-frontend-web-ds-observed-001 の誤記を訂正する。answered_at は読み直し直後の記録時刻で上限値。 / 回答時刻: 2026-09-13T07:54:32Z)

#### 裏付け質疑: `qa-frontend-web-ds-decision-004`

**問**

デザイントークンの「正本」をどこに置きますか？現在は styles.css と charts.ts(Chart.js用) に色が二重に書かれ、値もずれています。

**答**

『coreのTSを正本に (Recommended)』を選択。packages/core に依存ゼロの design-tokens.ts を置き、CSS 変数とチャート色はそこから作り、写しのずれは lint で検出する。 提示した選択肢: 『coreのTSを正本に (Recommended)』(packages/core の design-tokens.ts から CSS 変数とチャート色を作り、写しのずれは lint で検出。web/レポート/将来の成果物が同じ値を import できる) / 『styles.cssを正本に』(:root の CSS 変数だけを正本にし、チャートは実行時に getComputedStyle で読む。変更は少ないが、CSS を持たない成果物やテストでは値を取りにくい)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion の選択肢から明示選択した。answered_at は会話記録に残る回答の返却時刻 2026-09-13T04:54:53Z である。 質問文の『二重に書かれ値もずれている』は、charts.ts の COLOR_FALLBACKS (CSS を読めない環境向けの予備値) が styles.css とずれている事実を指す。当時の観測記録 qa-frontend-web-ds-observed-001 は Chart.js が CSS 変数を読めないと誤記していたが、選択肢 2 の説明は getComputedStyle で読む現行実装どおりで、利用者は実装に即した 2 案を比べて選んでいる。比較の記録は decisions[] の dec-design-token-source。 / 回答時刻: 2026-09-13T04:54:53Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。和文は OS の system-ui、金額・数値は自己配信する IBM Plex Mono Latin 400/600 だけを使い、全非 test source・dependencies・外部フォントURLの検査でこの配信契約を固定する。
- **G2**: route registry由来の20ルートを共通Layout/PageShellで描画する。標準操作はButtonを通し、固定アクション群を持つ画面はPageActionsを使う。ARIA固有controlはnative buttonの明示例外とする。
- **G3**: チャート (棒・線・内訳バー・凡例・軸・グリッド・ツールチップ) の配色と描画規約を 1 つにし、全ての図が共通トークンから色を得る。系列の意味色は FINAL-UI に合わせ、収入=青系、支出=赤系、純収支=ティールの線とする。
- **G4**: 今後の作成物が自動的に規約へ従うよう、トークン定義以外での色の直書きと、正本と写し (CSS 変数・チャート色) のずれを lint で機械検出し、使い方を規約文書として置く。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法のトークンを定義し、値の唯一の実装正本とする。 | 単体テストは schema・役割集合・alias・コントラストに必要な関係不変条件を値の転記なしで検査する。表示に影響する全トークン値は、版・承認参照・由来ファイルを持つ `docs/design-system/token-approval.json` の SHA-256 fingerprint と lint で照合し、未承認の値変更を拒否する。 |
| O2 | styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれと色構文の直書きを検出する lint を組み込む。 | pnpm lint が写しの不一致またはhex/rgb/hsl/CSS Color構文の未許可リテラルで exit 非0になり、一致時に exit 0 になる。 |
| O3 | Layout・PageShell・PageActions・Buttonを共通部品として定義する。route registry由来の20ルートは共通シェルとPageShellを経由し、標準操作はButtonを使う。ARIA固有controlはnative buttonの例外とする。 | route registry由来のDOMテストが全ルートのランドマークとPageShellを検査し、静的検査が標準variant/submitを直接所有するnative buttonを拒否する。 |
| O5 | トークンと共通部品の使い方を規約文書 (docs 配下) にまとめ、新しい画面・図をつくるときの参照先を 1 つにする。 | 規約文書が色の役割 (塗り/文字の分離)・タイポグラフィ・余白・シェル・ボタン・チャートの各節を持ち、README または AGENTS.md から参照されている。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。
- **I2**: どの画面を開いても、左に同じネイビーのサイドバー (220px)、上に同じヘッダー (64px・期間 1年/2年/3年/任意)、下に同じフッターが出る。
- **I3**: 月次の収入・支出・純収支の図は、どの画面でも収入が青い棒、支出が赤系の棒、純収支がティールの線で描かれる。
- **I4**: 誰かが画面のコードに #xxxxxx の色を直書きしたら、pnpm lint が落ちて共通トークンを使うよう促す。

### 本章に効く確定意思決定

- **dec-design-token-source**: デザイントークンの正本をどこに置くか
  - 採択: packages/core の design-tokens.ts を正本にし、CSS 変数とチャートの予備値を生成する (`core-ts`)
  - 目的適合: G1 の『依存ゼロの TypeScript 1 か所』に直接合う。テスト (O1・O4) が CSS を解析せず値を import でき、次サイクルでレポート側からも同じ値を import できる
- **dec-border-color-roles**: 境界色 #D7E0E2 (白に 1.34:1) を、WCAG 2.2 の 1.4.11 とどう両立させるか
  - 採択: 装飾罫線は #D7E0E2、部品を見分ける枠は 3:1 の派生色 (`split-roles`)
  - 目的適合: G5 の役割分離を境界へ広げ、画像の淡い罫線と部品の枠の 1.4.11 を両立する

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule をトークンの配置に適用した。トークン (役割名→値) は表示技術に依存しない最内側の方針なので packages/core に置き、CSS 変数 (styles.css の :root) はその外側の写しとして生成する。charts.ts は現行どおり getComputedStyle で CSS 変数を読む経路を残し、CSS を読めない環境向けの予備値 (COLOR_FALLBACKS) だけを core の値から取る — 現状ずれているのはこの予備値であり (qa-frontend-web-ds-observed-005)、正本を CSS から TS へ移しても実行時の読み方は変えずに済む。Information Design card は、同じ値を手で写す箇所が増えるほど利用者が見る色がずれることを示しており、ずれ検出 lint はその停止条件を機械化したものである。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T07:54:32Z)

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
| chartjs-colors | 2025-10-13 | Chart.js (www.chartjs.org) | https://www.chartjs.org/docs/latest/general/colors.html | 2026-09-13T05:06:15Z | 2026-09-13T05:06:15Z |
