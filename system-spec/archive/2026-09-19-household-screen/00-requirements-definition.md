---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

家計収支画面を、『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る場にする。利用者が期間 (1年 / 2年 / 3年 / 任意) を選ぶと、家計全体の総収入・総支出・純収支とその前年差を最初に掴み、月別の推移で『いつ』動いたかを、事業と個人の内訳・生活費カテゴリ・名義別の収入で『どこが』動いたかを確かめ、振替を二重に数えていないことを納得したうえで、選んだ月やカテゴリの明細まで一直線に降りて手を打てる状態にする。家計全体の数字は総収支画面の『総合』と必ず一致し、事業と個人の和が家計全体に重複なく閉じることを、画面と集計の両方で保証する。

## U2 背景 (background)

現行の /household (packages/web/src/pages/Household.tsx、657 行の 1 ファイル) はナビ上『累計収支』という名前で、選んだ 1 か月の KPI 4 枚・事業と個人の月別表・収入計と支出計の棒グラフ・生活費の大項目別 (全期間)・前月比・名義別収入 (事業 / 妻 / 家族)・中項目別収入を縦に並べた読み物で、問いの見出しも前年との比較も無い。集計は core の household() が担うが、事業入金と事業立替を家計の収支に含める独自定義で、総収支画面の totalCashflowLedger (事業 = freee、家計 = MF の家計行、振替と二重計上は除外) と数字が一致しない。前年比較・振替の一覧・名義ラベルの編集はどの層にも無く、名義は D1 の CHECK 制約で business / spouse / family の 3 値に固定され表示名はハードコードされている。design/FINAL-UI/images/10-household.png はこれらを 1 画面に統合した完成形で、design/FINAL-UI/spec/AUDIT.md も『家計の総収入・総支出・純収支と 1/2/3 年比較が弱い。最上位 KPI と事業/個人比較を追加』と指摘している。総収支 (#55)・推移 (#56)・マトリックス (#57) を同じ流儀で作り直し終えた今、残る『整える』段階の中心画面として揃える時期にある。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | /household を 10-household.png どおりの画面にする。問いの見出し『家計の総収入・総支出・純収支は、どう変わりましたか？』と説明文、データの出典カード (取込元の代表名と件数・取込明細を確認)、期間タブ (既存の `usePeriod` / localStorage を正本とする 1年 / 2年 / 3年 / 任意と対象範囲)、KPI 3 枚 (総収入・総支出・純収支と月平均・年換算) と前年差カード、月別の家計収支推移、事業と個人の内訳、生活費カテゴリ別の内訳表、名義別の収入、選択月の振替全件 (抜粋なし) の除外一覧、名義ラベルの設定、前年との比較、下部の選択中バーを、既存のデザイントークン・共通 Button・PageShell の上に組む。ブラウザ URL は `seg` / `month` / `cat` のみを持つ。選択期間の集計対象台帳行 0 件 (振替のみ・除外行のみを含む) を空とし、読込・空・失敗の各状態を持ち、ナビの名称を『家計収支』へ改める。 |
| G2 | 家計の集計を core の純関数 1 か所に集め、総収支の台帳 (totalCashflowLedger) を正本にする。総収入・総支出・純収支と月平均・年換算、事業と個人の分解 (和が家計全体に一致)、前年同期間との比較 (前年に欠けた月があれば比較不能として null)、月別の収入・支出・純収支と前年系列、生活費カテゴリ 6 区分の集計と構成比・前年差、名義別の収入と前年差を同じ関数から算出し、GET /api/household をこの形へ拡張する。総収支画面の『総合』と家計画面の『家計全体』が同じ期間で同じ数字になることをテストで固定する。 |
| G3 | 生活費カテゴリの行を選ぶと『カテゴリの詳細』パネルを出す。カテゴリ名・選択期間の合計 `current`・前年比・選択月の全件合計 `monthTotal`・選択月の最大 5 件プレビュー `transactions`・カテゴリのすべて見る・集計ルールの説明と分類ルールの確認導線を示し、閉じるで解除できるようにする。期間合計・月合計・プレビューの和を混同しない。 |
| G4 | 名義を『本人 / パートナー / 子ども / その他』で扱えるようにする。内部値 (business / spouse / family と未設定) は変えず、名義ラベル表を追加する追加のみの migration と、表示名の取得・更新 API を設ける。初期表示名は business→本人、spouse→パートナー、family→子ども、未設定→その他。『名義ラベルを編集』から表示名だけを変更でき、家計画面・設定画面・明細画面の名義表示がすべてこの表示名を参照する。更新 API は既存の authGuard・パスワード変更フェンス・スキーマガード・変更系フェンスの内側に置き、入力は zod で長さと文字種を検証する。 |
| G5 | 振替を家計の収入・支出から除外していることを利用者が確かめられるようにする。期間内に除外した振替の一覧 (日付・内容・金額・名義間) を出し、名義間は同額・逆符号・日付が近い振替 2 行を core の純関数で対にし、それぞれの口座の名義表示名から『本人 → パートナー』のように示す。対にならない行は『相手不明』と示す。スキーマは変えない。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 家計収支画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・出典カード・期間タブ・KPI 3 枚と前年差カード・推移のタブ 3 つと凡例 5 系列と月送り・事業と個人の等式・生活費カテゴリ表・名義別収入・振替除外の一覧・名義ラベル設定・前年との比較・下部の選択中バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O2 | 家計の数字が総収支画面と一致し、等式が閉じる。 | core の単体テストで、同じ Dataset と期間に対し家計全体の総収入・総支出・純収支が totalCashflowLedger の総合と toBe で一致し、事業 + 個人 = 家計全体が全月で成り立ち、前年欠損月があるとき前年差が null になる。 |
| O3 | カテゴリ詳細が選択と同期し、明細へ遷移できる。 | DOM テストで、行の選択 (クリックとキーボード) で詳細パネルが開き、`current` が期間合計、`monthTotal` が選択月全件合計、`transactions` が最大 5 件のプレビューとして分離され、カテゴリのすべて見るが月とカテゴリで絞った明細画面の URL へ遷移する。 |
| O4 | 名義ラベルの編集が安全に保存され全画面に反映される。 | API 統合テストで、未認証 401・変更系フェンス違反の拒否・長さ超過と制御文字の 400・正常更新の 200 と再取得での反映を確認し、migration が既存行を 1 行も書き換えないことを検査する。 |
| O5 | 振替の対推定が決定論で再現する。 | core の単体テストで、同額・逆符号・日付差の許容内の 2 行が対になり、許容外・同符号・3 行以上の競合が相手不明または一意な規則で解決され、同じ入力で同じ出力になる。 |

## U5 成功基準 (success_criteria)

- S1 (G1): /household で 10-household.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。ナビとパンくずの名称が『家計収支』である。集計対象台帳行 0 件 (振替のみ・除外行のみ) で空状態になる。
- S2 (G2): 同じ期間で家計画面の家計全体 (総収入・総支出・純収支) と総収支画面の総合が一致し、事業 + 個人 = 家計全体が全月で閉じ、前年差の算出が総収支画面の前年比較と同じ欠損規則に従う。
- S3 (G3): カテゴリ行の選択で詳細パネルと下部の選択中バーが同じ期間・同じ対象を示し、`current` / `monthTotal` / 最大 5 件の `transactions` プレビューが分離され、カテゴリのすべて見るが対象の月とカテゴリで絞った明細へ遷移する。
- S4 (G4): 名義ラベルの更新が認証・変更系フェンス・入力検証を通った場合だけ保存され、家計・設定・明細の各画面の名義表示が更新後の表示名になる。migration は追加のみで既存行の書き換えが 0 件である。
- S5 (G5): 選択月の除外振替が家計カード内に全件 (抜粋なし) 現れ、振替用の循環する『すべて見る』導線が無く、その合計が家計の総収入・総支出に 1 円も含まれていない。名義間の表示が対推定規則どおりで、規則は docs に明記されテストで固定されている。
- S6 (G1-G5): URL は `seg` / `month` / `cat` のみ、期間は `usePeriod` / localStorage から復元する。既存の総収支・推移・マトリックス・分析ハブの数値テストが緑のままで、初期 JS 予算 (CI 実測) を超えない。既知の逸脱・未実施・一部適合は PASS に数えない。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (個人事業主とその家族の家計を 1 人で管理する): 月次クローズの『整える』段階で、家計全体の収入と支出の差が前年と比べてどう動いたか、それが事業と個人のどちらから・どの生活費カテゴリから・誰の収入から来たかを 1 画面で確かめ、振替を二重に数えていないと納得したうえで、気になる月やカテゴリの明細へ降りて手を打ちたい。名義は家族の呼び方で表示したい。
- SH2 保守者 (同一人物、および Claude Code などのコーディングエージェント): 家計の集計規則 (家計全体 = 事業 + 個人、前年比較の欠損規則、生活費 6 区分、振替の対推定、名義表示名) が core の純関数 1 か所と docs・テストで固定され、総収支画面と数字がずれないこと。

## U7 スコープ (scope)

- **対象 (in)**: 家計収支画面 (10-household.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直しと、ナビ・パンくずの名称を『家計収支』へ改めること, core の家計集計純関数 (totalCashflowLedger を正本とする家計全体・事業・個人、前年比較、月別系列、生活費 6 区分、名義別収入、振替一覧と対推定), GET /api/household の拡張と、カテゴリ内訳 (主な取引) の取得経路, 名義ラベル表の追加 migration と表示名の取得・更新 API、名義ラベル編集 UI、既存画面の名義表示の参照先の一本化, カテゴリの詳細パネル・下部の選択中バー・明細画面への遷移 (月・カテゴリ・対象で絞る URL。期間は usePeriod / localStorage), docs への集計規則 (等式・欠損規則・6 区分の対応表・振替の対推定) の明記と回帰テスト
- **対象外 (out)**: 『累計収支』の新設: 対応するデザイン画像が無いため今回は追加しない (利用者決定), 名義の内部値 (business / spouse / family) の変更と既存行の書き換え: 表示名の編集で目的を満たせるため行わない (利用者決定), 共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の作り直し: 既存実装をそのまま使う, 明細への相手口座カラムの追加: 振替の名義間は対推定で示す (利用者決定), スマートフォン・タブレット・デスクトップ向け専用アプリ: web のみ (既存の利用者決定)

## U8 制約 (constraints)

- C1 技術: pnpm monorepo (core は依存ゼロの純関数、api は Hono の Cloudflare Worker と D1/Drizzle、web は React 18 + react-router-dom 7 + TanStack Query 5)。集計は core に置き api/web へ重複実装しない。
- C2 デザイン: docs/design-system.md に従い、色は design-tokens.ts 由来のトークンだけ、ボタンは共通 Button、ページは PageShell。グラフは既存の FinancialFigure と系列色の定義を使う。
- C3 migration: D1 の migration は追加のみ (新表・新カラム) とし、行を書き換える migration は作らない。本番反映は既存の Deploy / Migrate の手順とゲートに従う。
- C4 セキュリティ: /api/* の authGuard・mustChangePasswordFence・runtimeSchemaGuard・canonicalMutationFence の内側に置く。入力は zod で検証し、利用者が入力した表示名は React の既定エスケープで描画して HTML として解釈しない。取込データを外部へ送信しない。
- C5 性能: 初期 JS 予算 (CI 実測) を超えない。家計画面は遅延読み込みのまま、カテゴリ内訳は選択時に取得する。
- C6 数値の正本: 10-household.png の数値はモックアップであり、算術が閉じない欄は計算値へ置き換えてフィクスチャにする (利用者決定に従う)。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | Household.tsx を pages/household/ 配下へ分割し、問いの見出し・出典カード・KPI と前年差・推移チャート・事業と個人の等式・カテゴリ表と詳細パネル・名義別収入・振替除外・名義ラベル設定・前年との比較・下部の選択中バーの構成に作り直し、選択中の月とカテゴリとタブだけを URL に保つ。期間は `usePeriod` / localStorage を正本にする。 | G1, G3 |
| I2 | 月別推移に家計全体 / 事業 / 個人のタブ、当期の収入・支出の棒、純収支の折れ線、前年の収入・支出の点線、月送り (< 2026年8月 >) を持たせ、月の選択を下部バーと同期する。 | G1 |
| I3 | core に household-summary (仮称) を新設し、totalCashflowLedger の行集合から家計全体・事業・個人の総額と月別系列、前年比較、生活費 6 区分、名義別収入を 1 か所で算出する。旧 household() の独自定義は置き換える。 | G2 |
| I4 | 生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる。 | G2, G3 |
| I5 | カテゴリ詳細の期間合計 `current`、選択月全件合計 `monthTotal`、最大 5 件の `transactions` プレビューを返す取得経路を設け、選択時にだけ取得する。カテゴリのすべて見るは明細画面を月・カテゴリ・対象で絞った URL で開く。 | G3 |
| I6 | owner_labels 表と GET / PUT の表示名 API、名義ラベル編集ダイアログを作り、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる。 | G4 |
| I7 | 振替の一覧と対推定を core の純関数にし、日付差の許容・同額・逆符号・一意性の規則を docs とテストで固定する。 | G5 |
| I8 | routeMetadata の /household の名称を『家計収支』に改め、パンくず・figure-guides・glossary の記述を合わせる。 | G1 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-household-cashflow-001`

家計収支画面サイクルの上位概念 U1-U9 を利用者が承認。画像 design/FINAL-UI/images/10-household.png を正本とする。選択肢は『この内容で承認 / 修正して再提示』で、利用者は承認を選択。同時に 家計の定義=totalCashflowLedger 正本 / 名義=内部値を残し表示名編集 (owner_labels) / 振替=名義間の対推定 / 画面名=家計収支へ改名 (累計収支は新設しない) / 数値の正本=収入・支出 (差は計算値) / カテゴリ=固定6区分 の 6 決定を承認。実測時刻 2026-09-18T11:25:37Z。basis=user-decision。

#### この承認を名指ししている質疑: `qa-household-target-platforms-001`

**問**

家計収支画面サイクルで、web 以外 (スマートフォン・タブレット・Windows / Linux / macOS のデスクトップ) の専用アプリを対象にするか。

**答**

対象にしない。上位概念の範囲外 (scope.out) に『スマートフォン・タブレット・デスクトップ向け専用アプリ: web のみ』を置き、利用者が U1-U9 をこの内容で承認した (appr-foundation-household-cashflow-001)。狭い画面は既存 web のレスポンシブ規約 (2・3 カラムの縦積み、表の横スクロール) の中で扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / U1-U9 承認 (scope.out に web 以外を明記) / 回答時刻: 2026-09-18T11:25:37Z)

#### この承認を名指ししている質疑: `qa-household-frontend-web-001`

**問**

web の家計収支画面のフロントエンド構成 (ファイル分割・状態・取得・部品) をどう作るか。

**答**

Household.tsx を packages/web/src/pages/household/ へ分割する (画面の親、KPI と前年より、推移チャート、事業と個人の等式、カテゴリ表、カテゴリ詳細パネル、名義別収入、振替一覧、名義ラベル編集ダイアログ、前年との比較、下部バー)。選択中の対象 (seg)・月 (month)・区分 (cat) は useSearchParams で URL に保ち、期間は既存 usePeriod を使う。本体は TanStack Query で GET /api/household を 1 回取得し、カテゴリ詳細は cat と month が決まったときだけ GET /api/household/category を取得する (dependent query)。名義ラベルは GET / PUT /api/settings/owner-labels を useMutation で保存し、成功時に家計・設定・明細のクエリを無効化する。色は design-tokens のトークンだけ、ボタンは共通 Button、ページは PageShell / PageState、グラフは FinancialFigure と charts.ts の系列色。名義の表示は core の ownerLabel だけを通し、OWNER_LABEL の直参照を残さない。routeMetadata の /household の名称を『家計収支』へ改め、figure-guides と用語集を合わせる。ページは遅延読み込みのままにし、初期 JS 予算 (CI 実測) を超えない。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-18T12:02:30Z` — answered_at に承認時刻 2026-09-18T11:25:37Z を写していた。この回答は利用者の承認と決定 001〜007 を agent が具体化した文で、実際に記録したのは R2 の chunk を適用した 2026-09-18T11:36:56Z である。
>   - 変更: `answered_at` `'2026-09-18T11:25:37Z'` → `'2026-09-18T11:36:56Z'` (フィールドは訂正後の値。旧値はこの行にのみ残る)
> - `2026-09-18T12:02:30Z` — answered_at の訂正を記録した。本文の値は利用者の決定 001〜007 と承認の範囲に収まり、agent が補った値は含まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-household-cashflow-001) と利用者決定 qa-household-decision-001〜007 を、specs/spec-household-cashflow-screen.md へ具体化した回答 / 回答時刻: 2026-09-18T11:36:56Z)

#### この承認を名指ししている質疑: `qa-household-auth-web-001`

**問**

家計収支画面と名義ラベルの API は、誰がどの条件で読み書きできるか。

**答**

既存のログイン (セッション cookie) を変えず、家計の API (GET /api/household・GET /api/household/category) と名義ラベルの API (GET / PUT /api/settings/owner-labels) を /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側に置く。未認証は 401、一時パスワードのままは既存のフェンスで止める。データは利用者単位 (user_id) で閉じ、他の利用者の家計や表示名を読めない・書けない。名義ラベルの更新は利用者本人の表示設定であり、管理者専用の権限を新設しない。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-18T12:02:30Z` — answered_at に承認時刻 2026-09-18T11:25:37Z を写していた。この回答は利用者の承認と決定 001〜007 を agent が具体化した文で、実際に記録したのは R2 の chunk を適用した 2026-09-18T11:36:56Z である。
>   - 変更: `answered_at` `'2026-09-18T11:25:37Z'` → `'2026-09-18T11:36:56Z'` (フィールドは訂正後の値。旧値はこの行にのみ残る)
> - `2026-09-18T12:02:30Z` — answered_at の訂正を記録した。本文の値は利用者の決定 001〜007 と承認の範囲に収まり、agent が補った値は含まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-household-cashflow-001) と利用者決定 qa-household-decision-001〜007 を、specs/spec-household-cashflow-screen.md へ具体化した回答 / 回答時刻: 2026-09-18T11:36:56Z)

#### この承認を名指ししている質疑: `qa-household-infrastructure-web-001`

**問**

家計収支画面のために配信・実行・DB 反映の基盤をどう変えるか。

**答**

基盤は変えない。既存の Cloudflare Workers (Hono) と D1、静的資産の配信をそのまま使い、家計画面は既存と同じく遅延読み込みのルートとして配信する。集計は要求のたびに core の純関数で導出し、新しいキャッシュ層・キュー・外部サービスを足さない (Workers の CPU 時間の範囲内。期間は最大 3 年分の台帳)。owner_labels の migration は既存の Migrate ワークフロー (.github/workflows/migrate.yml) と Deploy ワークフローの手順とゲートで反映し、行を書き換えない追加のみなので巻き戻しは表の不使用で足りる。初期 JS 予算は CI の実測値で守る。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-18T12:02:30Z` — answered_at に承認時刻 2026-09-18T11:25:37Z を写していた。この回答は利用者の承認と決定 001〜007 を agent が具体化した文で、実際に記録したのは R2 の chunk を適用した 2026-09-18T11:36:56Z である。
>   - 変更: `answered_at` `'2026-09-18T11:25:37Z'` → `'2026-09-18T11:36:56Z'` (フィールドは訂正後の値。旧値はこの行にのみ残る)
> - `2026-09-18T12:02:30Z` — answered_at の訂正を記録した。本文の値は利用者の決定 001〜007 と承認の範囲に収まり、agent が補った値は含まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-household-cashflow-001) と利用者決定 qa-household-decision-001〜007 を、specs/spec-household-cashflow-screen.md へ具体化した回答 / 回答時刻: 2026-09-18T11:36:56Z)

#### この承認を名指ししている質疑: `qa-household-ui-ux-web-004`

**問**

web の家計収支画面 (/household) の UI-UX 要件は何か。画面の構成要素・文言・切替・選択・詳細パネル・名義ラベル編集・状態・アクセシビリティを 10-household.png のとおりに確定する。

**答**

上から (1) 問いの見出し『家計の総収入・総支出・純収支は、どう変わりましたか？』と説明文、右上に『データの出典』カード (代表の取込元と他 N 件・取込明細を確認)。(2) KPI 3 枚 (総収入・総支出・純収支と月平均・年換算) と『前年より』カード (純収支の前年差と決定論の一文)。(3) 月別の家計収支推移: 家計全体 / 事業 / 個人のタブ、凡例 5 系列 (収入・支出の当期の棒、純収支の折れ線、収入・支出の前年の点線)、月送り ‹ 2026年8月 ›、選択月の帯。下端に『事業と個人の内訳』と等式『家計全体 = 事業 + 個人』と重複なしの注記。(4) 左に生活費カテゴリ 6 区分の表 (当期・前年・増減額・構成比・合計)、右に『カテゴリの詳細』パネル (金額・前年比・主な取引 5 件・すべて見る・集計の説明と分類ルールへの導線、× で閉じる)。既定の選択の規則は qa-household-ui-ux-web-003 (agent 推定) を参照。(5) 名義別の収入 / 振替は収入・支出から除外 (名義間の対推定と相手不明) / 名義ラベルの設定 (編集ダイアログ。入力規則は qa-household-security-web-003 (agent 推定) を参照) の 3 カラム。(6) 前年との比較 3 枚と文章の要約。(7) 下部固定バー『選択中: 2026年8月 / 純収支 / 内訳の明細を確認』。読込・空・失敗、前年欠損の各状態を持つ。選択 (seg / month / cat) は URL に保つ。行と棒はキーボードで選べ、増減は符号と矢印を併記して色だけに頼らない。ナビとパンくずは『家計収支』。画像の算術が閉じない欄は計算値を正本にする。文言・数値・フィクスチャの正本は specs/spec-household-cashflow-screen.md。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-ui-ux-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-ui-ux-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### この承認を名指ししている質疑: `qa-household-backend-web-004`

**問**

家計の集計ロジックと API をどこに置き、どの契約で返すか。

**答**

家計の集計は core の新しい純関数 householdSummary (household-summary.ts) 1 か所に集め、入力は総収支画面と同じ totalCashflowLedger の行集合とする (利用者決定 qa-household-decision-001)。旧 household() と HouseholdData は置き換えて削除する。台帳行へ名義 (freee 行は business、MF 行は resolveTx の owner、未解決は unset) を追加する。1 回の呼び出しで家計全体・事業・個人の総額と月平均・年換算、前年同期間 (欠けた月があれば null)、月別系列と前年同月、生活費 6 区分 (対応表は core の定数 1 か所。qa-household-decision-007)、名義別収入、振替一覧と対推定 (同額・逆符号の入出金を組にする。qa-household-decision-003。日付の許容幅と同点の決め方は qa-household-backend-web-003 (agent 推定) を参照) を返す。数値は収入・支出を正本にし、差・率・構成比は計算値にする (qa-household-decision-006)。api は GET /api/household をこの形へ拡張し、選択時だけの GET /api/household/category (主な取引 5 件と区分の月合計) と GET / PUT /api/settings/owner-labels を設ける。期間は loadScoped、freee・判定・除外は loadCashflowSources で読み、クエリと本文は zod で検証する。不変条件 (総収支の総合と一致、事業 + 個人 = 家計全体、6 区分の和 = 総支出、名義別の和 = 総収入、振替は台帳に現れない) をテストで固定する。契約の正本は specs/spec-household-cashflow-screen.md §11-§12。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-backend-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-backend-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### この承認を名指ししている質疑: `qa-household-database-web-004`

**問**

家計収支画面のために D1 のスキーマをどう変えるか。

**答**

名義の表示名を保存する owner_labels 表だけを追加する (追加のみの migration。次の空き番号は実装時に origin/main を fetch して確定する)。列は user_id・owner (CHECK で business / spouse / family / unset)・label (長さの上限を CHECK で守る。具体値は qa-household-database-web-003 (agent 推定) を参照)・updated_at、主キーは (user_id, owner)。行が無い名義は既定の表示名 (本人 / パートナー / 子ども / その他) を使い、初期データを投入しない。名義の内部値と既存表 (institution_owners・rules.owner・tx_edits.owner・tx_splits.owner) の行は 1 行も書き換えない (利用者決定 qa-household-decision-002)。家計の集計値は保存せず要求のたびに導出する。振替の対推定のために相手口座カラムを足さない (qa-household-decision-003)。runtimeSchemaGuard の必須表へ owner_labels を加える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-database-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-database-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### この承認を名指ししている質疑: `qa-household-security-web-004`

**問**

家計収支画面で新しく生じる入力・出力・外部送信のリスクにどう備えるか。

**答**

新しい入力は名義ラベルの表示名だけで、zod の許可リスト (長さ・使える文字・名義間の重複) で検証し (具体値は qa-household-security-web-003 (agent 推定) を参照)、違反は 400 とフィールド別のエラーを返す。D1 の CHECK 制約でも長さを守る。表示名は React の既定のエスケープで描画し、dangerouslySetInnerHTML を使わない。家計 API のクエリ (month・key・期間) も zod で enum と書式を検証し、期間外の月は 400。応答は利用者本人のデータだけで、明細の内容・取引先はこれまでどおり画面に出すが外部へ送信しない (取込データの外部送信なし)。振替の対推定は表示だけで、データを書き換えない。更新系は既存の canonicalMutationFence の内側に置く。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-security-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-security-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

#### この承認を名指ししている質疑: `qa-household-maintenance-ops-web-004`

**問**

家計収支画面の品質をどう保ち、規則をどこに残すか。

**答**

core の単体テストで不変条件 (総収支の総合と toBe で一致、全月で事業 + 個人 = 家計全体、6 区分の和 = 総支出、名義別の和 = 総収入、前年欠損で null、振替は台帳に現れない、対推定の決定論) を固定し、specs/spec-household-cashflow-screen.md のフィクスチャ (計算値を含む) で画面再現を DOM テストする。API 統合テストで未認証 401・フェンス違反・表示名の 400 (入力規則の境界。具体値は qa-household-maintenance-ops-web-003 (agent 推定) を参照)・正常更新 200 と再取得を確かめ、migration が既存行を書き換えないことを検査する。集計規則 (等式・欠損規則・6 区分の対応表・振替の対推定) は docs/data-schema.md に明記する。既存の総収支・推移・マトリックス・分析ハブの数値テストが緑のまま、pnpm lint (直書き色の検査を含む)・typecheck・初期 JS 予算を CI で通す。旧 household() の参照が残らないことを検索で確かめる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: qa-household-maintenance-ops-web-001 から利用者が決めていない具体値を除いた版。値の範囲は利用者承認 (appr-foundation-household-cashflow-001) と決定 qa-household-decision-001〜007 に収まる。除いた値は qa-household-maintenance-ops-web-003 (agent-inference) に分けた。 / 回答時刻: 2026-09-18T12:14:43Z)

- この承認を名指ししているが**現在どの決着済みセルからも参照されていない質疑**: `qa-household-ui-ux-web-001`, `qa-household-backend-web-001`, `qa-household-database-web-001`, `qa-household-security-web-001`, `qa-household-maintenance-ops-web-001` — R4-reopen で差し替えられた旧版であり、接地根拠としては効いていない (本文と基準は spec-state.json の qa_log と reopen_log に残る)

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| dec-household-categories | 生活費の区分をどう作るか。画像の固定 6 区分へ寄せるか、金額上位 5 大項目とその他にするか。 | confirmed | opt-fixed-six:固定 6 区分へ寄せる / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '大項目から 6 区分への対応表を core に 1 か所置くだけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=G1 の画像の表と一致し、G3 の詳細パネルで区分の意味が期間をまたいで一定になる。 / pros=前年との比較で区分が入れ替わらない, 画像の表と一致する / cons=対応表に無い大項目は『その他』に入る / risks=対応表の漏れで『その他』が膨らむ。境界テストで確かめる必要がある / lock-in=なし。 / ops=対応表とテストの保守。 / evidence=https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html, https://vitest.dev/api/expect.html<br>opt-top5-plus-other:金額上位 5 大項目 + その他 / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '集計時に並べ替えるだけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=データに追随するが、期間ごとに区分が変わり前年との比較が崩れる。画像とも一致しない。 / pros=対応表の保守が要らない / cons=当期と前年で並ぶ区分が異なり得る / risks=増減額の比較が成立しない行が出る / lock-in=なし。 / ops=保守は小さいが説明が難しい。 / evidence=https://vitest.dev/api/expect.html | opt-fixed-six — 前年との比較は区分が一定でないと成り立たず、画像の表も固定 6 区分である。 (注意: 事業側の支出は『その他』に入ることを境界テストで固定する; confidence=high; checked=2026-09-18T11:23:19Z) | opt-fixed-six @ 2026-09-18T11:25:32Z | G1, G3 |
| dec-household-figure-source | 画像の数値が算術で閉じない欄をどう扱うか。収入・支出を正本に差を計算するか、画像の純収支を正本にして前年の総支出を調整するか。 | confirmed | opt-compute-from-income-expense:収入・支出を正本に差を計算する (−¥80,000) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '計算で出すだけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=G2 の『数字は台帳の行から作る』と一致し、どの欄も算術で閉じる。見た目の数値は一部画像と変わる。 / pros=全欄が算術で閉じる, テストで数値を検算できる / cons=画像の純収支 +¥120,000 と表示が変わる / risks=画像との差を不具合と誤解される。仕様書に差の理由を残す必要がある / lock-in=なし。 / ops=フィクスチャの期待値を計算値で持つ。 / evidence=https://vitest.dev/api/expect.html<br>opt-image-net-as-source:純収支 +¥120,000 を正本にし前年の総支出を 5,164,000 に調整する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'フィクスチャの調整だけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=画像の見た目には一致するが、前年の値を画像に合わせて作ることになり、台帳から作るという G2 に反する。 / pros=画像と数値が一致する / cons=前年の総支出を実データと無関係に決めることになる / risks=調整した値がほかの欄 (前年比・構成比) とさらに食い違う / lock-in=なし。 / ops=調整の理由を別途保守する必要がある。 / evidence=https://vitest.dev/api/expect.html | opt-compute-from-income-expense — 画像の値を合わせるために入力を作ると、台帳から作るという原則が崩れる。計算値を正本にすれば全欄が検算できる。 (注意: 画像と異なる欄は仕様書の『画像の算術が閉じない欄』に理由とともに列挙する; confidence=high; checked=2026-09-18T11:23:19Z) | opt-compute-from-income-expense @ 2026-09-18T11:25:32Z | G1, G2 |
| dec-household-ledger-source | 家計収支の数字を何から作るか。総収支画面の台帳を正本にするか、現行の household() を拡張するか。 | confirmed | opt-ledger-source:総収支の台帳を正本にする / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'core の純関数を 1 つ置き換えるだけで追加費用なし。旧 household() と HouseholdData の削除で保守対象が減る。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=G2 の『家計の集計を 1 か所に集め、総収支と同じ行から作る』に直接答える。総収支の総合と家計全体が同じ行集合から出るため、両画面の数字が一致する。 / pros=総収支と家計の数字が構造的に一致する, 事業入金・事業立替の独自定義が消え、説明が 1 通りになる / cons=旧 household() を使う箇所の書き換えが要る / risks=台帳の変更が家計にも波及するため、総収支側の回帰テストが家計の回帰も兼ねる必要がある / lock-in=なし。純関数の差し替えで戻せる。 / ops=一致を検査する単体テストを 1 本足すだけ。 / evidence=https://vitest.dev/api/expect.html, https://developers.cloudflare.com/workers/platform/limits/<br>opt-extend-household:現行 household() を拡張する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '既存関数へ欄を足すだけで追加費用なし。ただし集計規則が 2 系統のまま残る。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=画像の欄は埋められるが、家計全体と総収支の総合が別の規則で計算されるため、G2 の『1 か所に集める』に反する。 / pros=変更量が小さい, 既存の画面を壊しにくい / cons=総収支と家計で同じ期間の数字が食い違い得る, 事業入金を家計に含める独自定義が残る / risks=利用者が 2 画面の差を不具合と受け取り、どちらを信じるか判断できなくなる / lock-in=なし。 / ops=2 系統の規則を並行して保守し続ける必要がある。 / evidence=https://vitest.dev/api/expect.html | opt-ledger-source — G2 は集計の一本化そのものを目的にしており、拡張案では 2 系統が残る。一致を toBe で検査できるのは台帳を正本にしたときだけである。 (注意: 旧 household() の参照が残っていないことを検索で確かめる, 総収支側の変更時に家計のテストも走るようにする; confidence=high; checked=2026-09-18T11:19:20Z) | opt-ledger-source @ 2026-09-18T11:20:19Z | G2, G1 |
| dec-household-nav-name | ナビの名称をどうするか。/household を『家計収支』へ改名するか、改名に加えて累計収支を新設するか。 | confirmed | opt-rename-household:/household を『家計収支』に改名する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'ナビとパンくずの文言変更だけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=G1 の『10-household.png どおりの画面にする』に合わせ、画像の見出しと一致する。 / pros=URL を変えないためブックマークが壊れない, 変更が文言に閉じる / cons=旧名称に慣れた利用者が一時的に迷う / risks=テストが旧名称を固定していると落ちる。文言の検索で洗い出す必要がある / lock-in=なし。 / ops=文言の一括確認だけ。 / evidence=https://reactrouter.com/api/hooks/useSearchParams<br>opt-rename-and-cumulative:改名し累計収支も新設する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '新しい画面・API の実装が要る。費用はかからないが作業量が大きい。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=画像に累計収支の画面は無く、G1 の範囲を超える。 / pros=累計の推移を別画面で見られる / cons=画像に無い画面を作ることになる, 初期 JS 予算を圧迫する / risks=範囲が膨らみ家計収支画面の完成が遅れる / lock-in=なし。 / ops=新画面の保守が増える。 / evidence=https://reactrouter.com/api/hooks/useSearchParams | opt-rename-household — 画像を正解とする方針で、累計収支は画像に無い。改名だけで G1 を満たせる。 (注意: ナビ・パンくず・ページタイトルの 3 か所を揃える; confidence=high; checked=2026-09-18T11:19:20Z) | opt-rename-household @ 2026-09-18T11:20:19Z | G1 |
| dec-household-owner-model | 名義を『本人 / パートナー / 子ども / その他』で扱うとき、内部値を移行するか、内部値を残して表示名だけを編集可能にするか。 | confirmed | opt-owner-display-label:内部値は残し表示名を編集可能にする / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'owner_labels 表を追加のみの migration で足すだけで追加費用なし。既存行の書き換えが無い。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=G4 の表示名の要件を満たし、既存の business / spouse / family / unset を使う規則・明細を壊さない。 / pros=既存行を 1 行も書き換えない, 巻き戻しは表を使わないだけで済む / cons=内部値と表示名の対応を 1 か所 (core の ownerLabel) で管理する必要がある / risks=OWNER_LABEL の直参照が残ると表示名が画面によって食い違う / lock-in=なし。 / ops=既定の表示名の補完と検証のテストを保守する。 / evidence=https://developers.cloudflare.com/d1/reference/migrations/, https://github.com/OWASP/ASVS/blob/master/README.md<br>opt-owner-migrate:内部値を self/partner/child/other へ移行する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '費用はかからないが、4 表の CHECK 制約と既存行を書き換える migration が要る。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=表示と内部値が揃い読みやすいが、G4 の要件以上の変更になる。 / pros=内部値と表示名が一致する / cons=institution_owners・rules・tx_edits・tx_splits の行書き換えが要る / risks=行を書き換える migration で Deploy が止まった過去がある (復旧に manifest→Migrate→Deploy の再実行が要った) / lock-in=なし。 / ops=移行時の検証と巻き戻し手順の準備が要る。 / evidence=https://developers.cloudflare.com/d1/reference/migrations/ | opt-owner-display-label — G4 は表示名の扱いを求めており、内部値の移行は要件を超える。行の書き換えを伴う migration は Deploy 停止の前例があり、追加のみの方が安全である。 (注意: 名義の表示は core の ownerLabel だけを通す, 表示名は 1〜20 文字・制御文字不可・重複不可で検証する; confidence=high; checked=2026-09-18T11:19:20Z) | opt-owner-display-label @ 2026-09-18T11:20:19Z | G4 |
| dec-household-transfer-pairs | 振替の欄で名義間の移動を見せるか。入出金の対を推定して表示するか、名義間の欄を出さないか。 | confirmed | opt-transfer-pair-estimate:入出金の対を推定して表示する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '表示時に純関数で対を組むだけで追加費用なし。データは書き換えない。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=G5 の『振替を家計の収入・支出から除外していることを確かめられる』に、どこからどこへ動いたかまで見せて答える。 / pros=画像の振替欄を再現できる, 相手不明を明示でき、除外の理由が読める / cons=推定の規則 (日付の許容幅・同点の決め方) を決めて保守する必要がある / risks=推定が誤ると名義間の移動を誤って示す。相手不明として出す逃げ道が要る / lock-in=なし。 / ops=境界の単体テストで規則を固定する。 / evidence=https://vitest.dev/api/expect.html, https://developers.cloudflare.com/workers/platform/limits/<br>opt-transfer-no-pairs:名義間の欄は出さない / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '実装が最小で追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間と D1 の範囲内) / fit=除外した合計額は示せるが、どの名義間の移動かが分からず G5 の確認が弱くなる。 / pros=推定の誤りが起きない / cons=画像の振替欄と一致しない / risks=利用者が除外の妥当性を確かめられない / lock-in=なし。 / ops=保守対象が増えない。 / evidence=https://vitest.dev/api/expect.html | opt-transfer-pair-estimate — G5 は除外を利用者が確かめられることを求めており、対が見えないと確かめる手段が無い。表示だけの推定なので誤ってもデータは壊れない。 (注意: 対にならない振替は『相手不明』として出す, 推定の許容幅と同点の決め方は名前付き定数とテストで固定する; confidence=high; checked=2026-09-18T11:19:20Z) | opt-transfer-pair-estimate @ 2026-09-18T11:20:19Z | G5 |
