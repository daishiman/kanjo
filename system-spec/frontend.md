---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G2, G3]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-cash-frontend-web-001。裏付け質疑 (`qa_refs`): `qa-cash-frontend-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、frontend ではReact Native などの別実装と、core の純関数の共有方法を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、frontend ではタブレット用レイアウトの分岐とタッチ操作の当たり判定を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、frontend ではElectron などの殻と Web 版の差分管理を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、frontend では殻の描画エンジンの差による表示崩れを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、frontend ではネイティブメニューと Web 側の操作の二重実装を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | 下部固定の追加バーに安全領域の余白を足し、狭い画面では入力と一覧を縦に積み、表は横スクロールの容器に入れる形へ反映した。下書きの保存時刻は文で示す。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | pages/cash/ の画面本体を view-model・draft・入力 2 種・一覧・ResultNotices に分け、view-model だけが core を呼ぶ形へ反映した。部品は描画と入力の受け渡しだけを持つ。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3

#### 主たる接地根拠: `qa-cash-frontend-web-001`

**問**

web の現金入力画面をどう分割し、状態をどこに持つか。

**答**

Cash.tsx を pages/cash/ 配下 (画面本体・view-model.ts・draft.ts・通常入力・交通費入力・一覧・ResultNotices) に分け、view-model は core の cash-screen を呼んで描くだけにする。タブ・月・絞り込み・ページは URL の検索パラメータに持ち、再読込と共有で同じ表示に戻す。入力途中の値は draft.ts が localStorage に自動保存して保存時刻を示し、追加成功と『入力をクリア』で消す。追加・更新・削除・復元の後は TanStack Query の現金明細と集計の query を無効化する。初期 JS 予算に収まるよう画面は既存どおり遅延読込する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-cash-001) と決定 qa-cash-decision-001〜004 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-frontend-web-evidence-001`

**問**

frontend 章の裏付けとして、現行実装について何を観測したか。

**答**

ルートは packages/web/src/routeMetadata.ts:33-44 の id 'cash' / path '/cash'。他の作り直し済み画面は pages/<screen>/ に分割され、明細仕分けは packages/web/src/pages/classify/draft.ts (localStorage の下書き) と ResultNotices.tsx (元に戻すトースト) を持つ。画面ごとの描画検査は packages/web/package.json の check:ai-screen などの KANJO_VISUAL_SCOPE 付き check-financial-visuals.mjs で行う。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-21T15:20:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /cash を 17-cash.png どおりの画面にする。問いの見出しと説明、共通の期間 (1年 / 2年 / 3年 / 任意) と対象期間カード、通常入力 / 交通費入力のタブ、現金明細の入力 (日付・事業/個人・収支・金額・内容・カテゴリ・担当者・メモ 0/200・入力をクリア・現金明細を追加・下書き自動保存の表示)、交通費の入力 (出発駅・到着駅・入替・片道運賃・往復・合計金額・業務の目的・メモ・交通費として追加)、現金明細の一覧 (月送り・キーワード検索・4 種の絞り込み・詳細検索・収入/支出/差額の合計・選択・編集/削除・ページング)、インラインの削除確認と元に戻す、空状態、下部固定の追加バーを描く。
- **G2**: 記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。
- **G3**: 画面の数字と判定を core の 1 か所から導く。合計・絞り込み・ページング・入力経路・交通費の合計・入力検証を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 現金入力画面が画像の全構成要素を描画する (領収書欄を除く)。 | DOM テストで、問いの見出し・対象期間カード・2 つのタブ・通常入力の全項目とメモの文字数・交通費入力の全項目と入替・合計金額の自動計算・一覧の月送り/検索/4 種の絞り込み/合計 3 枚/表/ページング・インライン削除確認・元に戻すトースト・空状態・下部固定バーの存在を確認し、全て通る。 |
| O2 | 下書きと論理削除で記録が欠けない。 | DOM テストで入力→再描画後に下書きが復元されること、API テストで削除→元に戻すで同じ id が一覧に戻ること、削除中の行が集計 (cashToDeal / cashToTx の入力) に 0 件であることが通る。 |
| O3 | 画面の導出が core の 1 か所に集まる。 | core の cash-screen の単体テストが合計・絞り込み・ページング・入力経路・交通費合計を固定し、web と api に同じ計算の重複が無い (grep で 0 件)。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Cash.tsx を pages/cash/ 配下へ分割し、問いの見出し・対象期間カード・タブ・入力 2 枚・一覧・下部固定バーの構成に作り直す。選択中のタブ・月・絞り込み・ページを URL に保つ。
- **I2**: core に cash-screen を新設し、合計 (収入・支出・差額)、絞り込み (キーワード・収支・カテゴリ・名義・入力経路・金額と日付の範囲)、ページング、入力経路、交通費合計を純関数で導く。
- **I3**: cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。
- **I4**: 入力途中の内容をブラウザ内に自動保存し、保存時刻を表示し、復元する。『入力をクリア』で下書きも消す。
- **I5**: 削除をインライン確認にし、削除完了トーストの『元に戻す』で同じ行を復活させる。空状態では画面内だけのサンプル表示と『はじめての明細を入力』を出す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の依存方向を、web が合計と絞り込みの計算を持たない構成に適用した。現行 Cash.tsx は 724 行に入力・表・月の集計を抱えているので、pages/cash/ の view-model が core の cash-screen を呼んで描画用の形へ写すだけにし、下書きの保存は draft.ts、元に戻すの表示は ResultNotices に分ける。URL の検索パラメータを表示条件の正本にするので、同じ URL を開けば同じ一覧と合計になる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:23:17Z)

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
| tanstack-query-invalidation | 5.103.2 | TanStack (github.com) | https://github.com/TanStack/query/blob/main/packages/react-query/package.json | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
| react-router-searchparams | 8.4.0 | React Router (Shopify / Remix team) (reactrouter.com) | https://reactrouter.com/api/hooks/useSearchParams | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
| mdn-localstorage | 2026-07-28 | Mozilla (MDN Web Docs) (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
