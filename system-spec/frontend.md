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
| Web (web) | 確定 | 確定質疑: qa-subs-review-decision-002。裏付け質疑 (`qa_refs`): `qa-subs-frontend-web-evidence-001`, `qa-subs-frontend-web-004`, `qa-subs-frontend-web-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、React Native などの別の描画基盤で一覧・詳細・グラフを作り直す必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、分割表示と回転に応じた詳細パネルの出し分けを実装する必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、Electron や Tauri などの殻に web の画面を載せる構成を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、同じく殻の選定と、WebView の差による描画差の検証を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、同じく殻の選定と、ネイティブのメニューとの統合を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | 詳細パネルのタブは WAI-ARIA の tabs パターン (tablist / tab / tabpanel、左右の矢印キーで移動) で作り、選んだベンダーは URL の vendor パラメータに保って再読込でも復元する形へ反映した。下部の選択バーは照合画面の SelectionActions と同じ操作語と配置にし、画面をまたいで同じ操作が同じ場所にあるようにする。読込中・0 件・取得失敗は既存の PageState の 3 状態で描き分ける。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | サブスク画面を pages/subscriptions/ 配下の部品 (Kpis・CoverageCard・SubscriptionTable・DetailPanel・CategoryTrendChart・AnnualComparison・ReasonCard・SelectionBar) へ分け、取得と変更のフックを 1 ファイルに集める形へ反映した。部品は取得を持たず props だけで描くため、DOM テストは fixture を渡すだけで書ける。旧 components/SubVendors.tsx の 614 行は、関連データタブと検出理由カードへ操作を移した後に撤去する。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G5

#### 主たる接地根拠: `qa-subs-review-decision-002`

**問**

(AskUserQuestion で 3 問を選択肢つきで提示) (1) 登録済みのサブスクが見直し候補になったとき、検出理由カードの『候補を採用』は何を意味させるか。選択肢: 『候補として確認』と同じ (推奨) / 見直しを済ませた記録 (resolved) / 未登録の候補だけに出す。(2) 『見直し候補として確認』(confirmed) にした候補を画面でどう扱うか。選択肢: 一覧に残し件数から外す (推奨) / すべて残す / すべてから外す。(3) 複数の規則に同時に当たったとき、同じ理由では再び出さないための指紋をどう作るか。選択肢: 当たった全規則+基準金額 (推奨) / 最優先の規則+基準金額。

**答**

(1) 『候補として確認』と同じ — 登録済みベンダーの見直し候補では、検出理由カードの『候補を採用』と詳細パネルの『候補として確認』はどちらも confirmed (見直す対象として残す) を記録する。保存する値は confirmed / dismissed の 2 つだけ。(2) 一覧に残し件数から外す — confirmed の候補は一覧の候補バッジを『確認済み』に変えて残し、KPI の『見直し候補 N 件』とサイドバーのバッジはまだ判断していない候補だけを数える。(3) 当たった全規則+基準金額 — 指紋は当たった規則の種類すべてと判定時の基準金額から作り、月は含めない。新しい規則が加わるか金額が変わったときだけ再び候補に出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion への利用者の明示選択 (2026-09-18T06:51:17Z)。各問に 2〜3 の選択肢と説明を示し、利用者が 3 問とも推奨案を選んだ。qa-subs-review-decision-001 (『つづけて』からの推定の採用) を置き換える。 / 回答時刻: 2026-09-18T06:51:17Z)

#### 裏付け質疑: `qa-subs-frontend-web-evidence-001`

**問**

frontend 章の裏付けとして、現行のサブスク画面はどう作られているか。

**答**

Subscriptions.tsx は useQuery で GET /api/subscriptions を 1 本取得し、KPI・表・グラフの値を画面側で整形して描いている。登録ベンダーの編集と未登録候補は components/SubVendors.tsx (614 行) の 2 パネルが別の取得 (GET /api/sub-vendors、GET /api/sub-vendors/candidates) と変更 (POST / PUT / DELETE /api/sub-vendors、POST /api/sub-vendors/exclusions、POST /api/sub-vendors/:id/review) を持つ。画面の登録は routeMetadata.ts:57-66 (id subscriptions、path /subscriptions、label サブスク)、サイドバーの所属は Layout.tsx:56 で『整える』、バッジは Layout.tsx:246 が reviewQueue の subscriptionCandidates を出している。共通部品は components/Page.tsx (PageShell / PageHeader / PageState / KpiCard / AnnualComparisonTable)、期間は period.tsx の usePeriod、表は DataTable.tsx、照合画面の詳細パネル (reconciliation/DetailPanel.tsx) と下部の選択バー (SelectionActions.tsx) が既にある。テストは web/src/subs-review.dom.test.tsx と components/SubVendors.dom.test.tsx。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/web/src の該当ファイルの読解 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-frontend-web-004`

**問**

web のサブスク画面の frontend 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定は次の 2 点である。(1) 旧 UI (登録ベンダー編集・四半期見直し・アラート・前年比較表・未登録候補パネル) は画像の部品へ吸収して撤去し、機能は失わない。(2) 画面の数値は画像を写さず、core が算出する検算済み fixture を正本とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で選択された dec-subs-legacy-ui と dec-subs-fixture-authority。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-frontend-web-006`

**問**

web のサブスク画面の frontend 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 画面は数値を再計算しない。KPI・一覧・合計行・カテゴリ別推移・年換算比較・候補の判定と理由文は API が返した値をそのまま描く。(2) 取得は 2 本に分ける。画面全体は GET /api/subscriptions (期間つき) の 1 本、詳細パネルは選んだベンダーについて GET /api/subscriptions/vendors/:key を選択後にだけ取得する (TanStack Query の依存クエリ)。(3) 変更 (統合・カテゴリ変更・未登録候補の採用 / 除外・見直し候補の確認 / 除外とその取消・四半期見直し) の成功後は、サブスク一覧・詳細・サイドバーのバッジ (reviewQueue) のクエリを無効化して揃える。(4) 部品は pages/subscriptions/ 配下に Kpis / CoverageCard / SubscriptionTable / DetailPanel / CategoryTrendChart / AnnualComparison / ReasonCard / SelectionBar として分け、照合画面の DetailPanel と SelectionActions の作りを踏襲する (共通化は 2 画面目の本サイクルでは行わず、同じ形を保つ)。(5) 旧 SubVendorsPanel / SubsCandidatesPanel は撤去し、その操作を DetailPanel の『関連データ』タブと ReasonCard へ移す。旧テストは新しい部品のテストへ移し替える。(6) 色はデザイントークンと既存の系列パレットだけを使い、カテゴリの色は固定順で割り当てる。 (7) 検出理由カードの『候補を採用』と詳細パネルの『候補として確認』は同じ confirmed を送る。未登録候補の行では、採用は登録、除外は除外の既存 API を呼ぶ。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存の web の構成 (照合・推移・マトリックス画面の分割と取得の分け方) の読解にもとづく agent の設計判断。 qa-subs-frontend-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /subscriptions を 09-subscriptions.png どおりの画面にする。問いの見出し『毎月の固定費に、重複や見直し候補はありますか？』と説明文、KPI 5 枚 (月額のサブスク合計・年換算の合計・直近 12 か月の支払額・売上比・見直し候補 N 件。月額と年換算は前期間比つき)、データソースのカバー率カード (銀行口座 / クレジットカード / 電子マネーの % と取込済み口座数) と最終更新・再取得、サブスク一覧 (ベンダー名・カテゴリで検索、ステータス絞込、行チェック、列=ベンダー名 / 正規化名 / ソース数 / 最新の金額 / 月額の推定 / 年換算 / カテゴリ / 候補、合計行)、月次のサブスク支出推移 (カテゴリ別の積み上げ棒と凡例)、年換算の比較 (カテゴリ別の月額 / 年換算 / 構成比 / 前期間比と合計行) を、既存のデザイントークン・共通 Button・PageShell・期間タブ (usePeriod) の上に組む。読込・空・失敗の各状態を持つ。ロゴ (サービスのアイコン) 画像は取得も表示もしない。
- **G2**: 一覧で選んだサブスクの『サブスクの詳細』パネルを実装する。正規化名・カテゴリ (変更可)・見直し候補バッジ、概要 / 取引履歴 / 関連データのタブ、正規化された名称 (編集可)、マッチした生の取引名 (チェックとソース種別)、月額の推定と年換算、直近の取引 3 件と『すべて見る (N件)』、データソース別件数、『名称を統合』『候補として確認』を出し、閉じるで解除できる。生の取引名を選ぶと画面下部に『N件の取引を選択中』バー (選択チップの解除・選択した N 件を統合・選択を解除) を出す。
- **G5**: 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | サブスク画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・KPI 5 枚と前期間比・カバー率カード 3 区分と最終更新と再取得・一覧 (検索 / ステータス絞込 / 9 列 / 合計行)・カテゴリ別推移の凡例と棒・年換算比較表 (合計行つき) が描画され、読込・空・失敗の状態テストが緑である。ロゴ画像要素が 0 件である。 |
| O2 | 行を選ぶと詳細パネルが開き、統合と確認の操作ができる。 | DOM テストで、行選択→詳細パネル (3 タブ・正規化名・生の取引名・月額推定・直近の取引・データソース・2 操作) 表示、生の取引名 2 件選択→下部バー『2件の取引を選択中』表示→統合 API 呼出し、閉じる / 選択を解除で状態が戻ることが緑である。 |
| O5 | 保存と旧機能の移設が壊れずに完了する。 | migration 0043 がローカル D1 に適用でき、統合・採用・除外・確認・カテゴリ変更の API 統合テストが緑、旧パネルのテストが新しい置き場所のテストへ移されて機能の欠落が 0 件、サイドバーのバッジ件数が画面の候補件数と一致する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Subscriptions.tsx を、問いの見出し・KPI 5 枚・カバー率カード・一覧 (検索 / ステータス絞込 / 候補バッジ / 合計行)・カテゴリ別推移・年換算比較・右の詳細パネル・検出理由カード・下部の選択バーの構成に作り直し、選択中のサブスクを URL に保つ。
- **I2**: 詳細パネルで正規化名とカテゴリを編集し、生の取引名を選んで『選択した N 件を統合』で既存ベンダーの aliases に加えられるようにする。
- **I5**: migration 0043 で sub_vendors に category を足し、登録済みベンダーの見直し候補への判断 (確認 / 除外) を保存する表を足して、既存の除外・見直し日時と一緒に扱う。
- **I6**: 旧 SubVendorsPanel / SubsCandidatesPanel / アラート / ベンダー別前年比較表を撤去し、その操作を詳細パネル・検出理由カード・ステータス絞込へ移したうえで、既存テストを新しい置き場所へ移す。
- **I7**: 検算済み fixture と見た目検査 (check-financial-visuals) を新しい構成へ更新し、ロゴ画像が無いことも検査する。

### 本章に効く確定意思決定

- **dec-subs-category**: サブスクのカテゴリ (エンタメ / クラウド / 仕事効率化 など) をどう決めるか。
  - 採択: core の既定辞書 (正規化名→カテゴリ、当たらなければ『その他』) + 利用者の変更を sub_vendors.category に保存 (`opt-dict-plus-override`)
  - 目的適合: G1 のカテゴリ列・カテゴリ別推移・年換算比較と G4 の集計を、取込直後から辞書で埋められる。辞書が外れても利用者が詳細パネルで直せば以後は上書きが勝つ。
- **dec-subs-coverage**: 『データソースのカバー率』の 銀行口座 / クレジットカード / 電子マネー をどう分類し、% と (分子/分母) を何で定義するか。
  - 採択: 口座名の手がかりで 3 分類 (paymentMethodOf を拡張)。(分子/分母) = 最新月まで取込済みの口座数 / 口座数、% = 期間の (口座×月) のうち取引がある割合 (`opt-account-name-3way`)
  - 目的適合: 取込済みのデータだけで画像の 3 区分と 2 種の数値を出せ、利用者の追加入力なしに G1 のカードが成立する。
- **dec-subs-persistence**: 名称の統合・候補の採用 / 除外・カテゴリ・見直し判断をどこに保存するか。
  - 採択: 既存表を再利用して拡張 — 統合=既存ベンダーの aliases 追加、採用=sub_vendors 登録、除外=sub_vendor_exclusions、category と見直し判断は migration 0043 で追加 (`opt-reuse-extend`)
  - 目的適合: 既存の照合 (matchSubVendor) と候補除外がそのまま新しい操作の保存先になり、G5 の『旧機能を失わない』と両立する。
- **dec-subs-legacy-ui**: 画像に無い既存の機能 (登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、ベンダー別前年比較表、未登録候補パネル) をどう扱うか。
  - 採択: 画像の部品 (詳細パネル・候補バッジ・検出理由カード・ステータス絞込) へ吸収し、旧 UI は撤去する (`opt-absorb-and-remove`)
  - 目的適合: 画面が画像どおりになり (G1)、旧機能の操作は詳細パネルと検出理由へ移って失われない (G5)。
- **dec-subs-fixture-authority**: 画像の数値 (一覧 8 行の月額の和 ¥9,778 に対し合計欄 ¥64,800 など、閉じていない) をテストの期待値にどう使うか。
  - 採択: 画像は構成・文言・配置の正本、数値は core が算出する検算済み fixture を正本とする (`opt-layout-from-image-numbers-from-fixture`)
  - 目的適合: 合計行 = 行の和、カテゴリ別合計 = 一覧合計 という G4 の一致条件を満たしたまま、画面は画像どおりに作れる。
- **dec-subs-kpi-definition**: KPI『月額のサブスク合計』『年換算の合計』と前期間比を何で定義するか。
  - 採択: 月額 = 最新月時点で継続中の各ベンダーの推定月額の和 (年額払いは 12 等分)。年換算 = 月額 ×12。前期間比 = 直前の同じ長さの期間の同じ定義の値との差 (`opt-sum-of-estimated-monthly`)
  - 目的適合: 一覧の『月額の推定』列の合計と KPI が同じ定義になり、合計行・カテゴリ別比較・KPI が一致する (G4)。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の『画面は外側の詳細であり、方針を持たない』をサブスク画面の部品分割に適用した。KPI・一覧・合計行・カテゴリ別推移・年換算比較・候補の理由文は API の値をそのまま描き、画面側で再集計しない。取得は画面全体の 1 本と、行を選んだときだけ走る詳細の 1 本に分け、変更の成功後は一覧・詳細・サイドバーのバッジのクエリをまとめて無効化する。旧 SubVendorsPanel と SubsCandidatesPanel の操作は詳細パネルの『関連データ』タブと検出理由カードへ移し、機能を落とさずに旧部品を撤去する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T03:48:08Z)

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
| tanstack-query-dependent-queries | 5.103.1 | TanStack (tanstack.com) | https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
| tanstack-query-invalidations-from-mutations | 5.103.1 | TanStack (tanstack.com) | https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
| react-router-searchparams | 8.4.0 | React Router (Remix / Shopify) (reactrouter.com) | https://reactrouter.com/api/hooks/useSearchParams | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
