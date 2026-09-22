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

予算画面を、『実績に合う予算へ、どこを調整しますか？』という問いに 1 画面で答え切る場にする。利用者が実績の期間 (1年 / 2年 / 3年 / 任意) と予算対象の 12 か月を選ぶと、年間収入予算・年間支出予算・予算純収支・防衛ライン余裕を最初に掴み、月次の実績・予算・見通しのグラフと今後の見通し (累計) で来期の姿を確かめ、予算一覧で科目ごとに前期実績・来期予算・自動提案・差額・見通しを見比べ、右のパネルで自動提案の根拠 (前期実績・増減率・季節性補正・計画による調整) と月別の実績推移を読んだうえで来期予算を入力できる。過不足が見込まれる科目と、入力内容が自動提案に比べて年間の収支をどう動かすかをその場で示し、入力中の下書きは画面を離れても失われず、未保存の項目数を見ながらまとめて保存できる。予算は予算対象の 12 か月ごとに科目別の年額で保存し、他の画面 (診断の予算カバー率・予算の着地見込み) も同じ core の 1 か所から導く。取込データは外部へ送信しない。

## U2 背景 (background)

現行の /budget (packages/web/src/pages/Budget.tsx、317 行の 1 ファイル) は、事業の経費科目ごとに月額を 1 つ入力して直近 3 か月平均と比べる表と、年間の着地見込み表だけで、期間 (usePeriod) に連動しない。D1 の budgets 表 (migrations/0000_init.sql) は (user_id, account, monthly_amount) で期間を持たず、収入の予算・予算対象の 12 か月・前期実績・月次の見通しグラフ・自動提案の根拠の内訳・過不足科目・調整のインパクト・下書きの自動保存と離脱確認がどの層にも無い。推奨値は core の suggestBudgets (固定費は直近 3 か月平均 × 95%、他は全期間平均) だけで根拠を返さない。design/FINAL-UI/images/14-budget.png はこれらを 1 画面に統合した完成形で、design/FINAL-UI/spec/AUDIT.md は『未実装の版管理/担当表現を除去。推奨、リセット、実績差、見通しへ整理』と指摘している。総収支・推移・マトリックス・サブスク・家計収支・決算書・明細仕分けを同じ流儀で作り直し終えた今、『計画』段階の入口である予算画面を揃える時期にある。画像の見出し帯の『取引ライン』は既存ヘッダの『防衛ライン』の誤記と見なし、共通シェル (サイドバー・ヘッダ・月次クローズの進捗・フッタ) は作り直さない。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | /budget を 14-budget.png どおりの画面にする。パンくず『計画 / 予算』、期間タブ (usePeriod の 1年 / 2年 / 3年 / 任意と期間送り)、見出し『予算』と問い『実績に合う予算へ、どこを調整しますか？』と説明文、予算対象 (12 か月の開始月の選択と『来期の12か月の予算を編集できます。』)、KPI 4 枚 (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕と説明の ? )、月次の実績・予算・見通しのグラフ (収入 実績 / 収入 予算 / 支出 実績 / 支出 予算の棒と見通し (収支) の折れ線、実績と見通しの境目の縦線と期間の注記)、今後の見通し (累計収入・累計支出・累計純収支と見通しコメント)、予算一覧 (カテゴリ検索 Ctrl+K・実績から提案・すべてリセット・選択チェック・# ・カテゴリ・前期実績・来期予算・自動提案・差額・見通し・来期予算 (入力))、右の科目パネル (提案の根拠 / 関連データのタブ、自動提案の値と前期差、この値を適用、推奨の根拠、計算の詳細 (前期実績・増減率・計画による調整・季節性補正・推奨値)、月別の実績推移 (過去 12 か月)、主な根拠データ、適用前の値、この行を元に戻す、閉じる)、予算の過不足カテゴリ (支出の増加が見込まれる / 支出の減少が見込まれる のタブと件数、# ・カテゴリ・見通し・差額・要因)、調整によるインパクト (自動提案と比べた年間の支出差・予算純収支・増加要因の科目と注意書き)、下部の保存バー (未保存 N 項目・最終保存時刻と下書きの自動保存・リセット・予算を保存) を、既存のデザイントークン・共通部品 (PageHeader・KpiCard・Button・ConfirmDialog・PeriodPicker) の上に組み、画面専用の部品は pages/budget/ に置く。画像の『AI・統計推奨』は外部推論をしないため『自動提案』と表示する。読込・空 (実績 0 か月)・失敗の各状態を持つ。 |
| G2 | 予算画面の数値を core の純関数 1 か所 (budget-screen) から導く。前期実績は選択した実績期間の科目別合計を 12 か月あたりに換算した額、自動提案は 前期実績 × (1 + 過去 12 か月の増減率) + 季節性補正 + 計画による調整 を千円に丸めた額で、各項を根拠として返す。見通しは実績のある月は実績、無い月は自動提案の月割 (季節性を反映) とし、今後の見通しの累計・過不足カテゴリ (見通し − 来期予算) ・調整によるインパクト (来期予算 − 自動提案) を同じ関数から出す。KPI は 年間収入予算 = 収入行の来期予算の和、年間支出予算 = 支出行の来期予算の和、予算純収支 = 収入予算 − 支出予算、防衛ライン余裕 = 年間収入予算 − 防衛ライン (既存 core の defenseLine の月額) × 12 とし、一覧の合計・KPI・グラフの年合計が一致することをテストで固定する。収入の行は取込データにある『売上高』と、現行の集計に系列が無いため実績 0 の手入力行として置く『その他収入』、支出の行は事業の経費科目 (data.biz.categories) とする。外部の LLM は呼ばない。 |
| G3 | 予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。 |
| G4 | 予算の編集作業を失わない。来期予算の入力・この値を適用・実績から提案 (全行に自動提案を入れる)・計画による調整の入力は下書きとして端末の localStorage に予算対象の期間単位で自動保存し、下書きを自動保存した時刻と最終保存時刻を示し、保存に成功したら消し、次回に復元できる。未保存の項目数を保存バーに出し、この行を元に戻す (保存済みの値へ) ・すべてリセット / リセット (全行を保存済みの値へ、確認つき) を持ち、未保存のまま離れるときは確認する。 |
| G5 | 予算の数値が他画面とずれない。ヘッダの防衛ラインと防衛ライン余裕は同じ defenseLine、診断の予算カバー率と予算画面の設定済み科目は同じ予算の読み出し関数から導き、既存の診断・概要・家計収支・総収支・決算書の数値テストが緑のままである。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 予算画面が画像の全構成要素を描画する。 | DOM テストで、パンくず・期間タブ・問いの見出し・予算対象・KPI 4 枚・月次グラフ (凡例 5 種と境目)・今後の見通し・予算一覧の全列と操作・科目パネルの 2 タブと全欄・過不足カテゴリの 2 タブ・調整によるインパクト・保存バーが描画され、『AI』の語が無く『自動提案』がある。読込・空・失敗の状態テストが緑である。 |
| O2 | KPI・一覧・グラフ・見通しの数値が core の 1 か所から出て互いに一致する。 | core の単体テストで、同じ Dataset・実績期間・予算対象に対し 年間収入予算 + (−年間支出予算) = 予算純収支、一覧の来期予算の和 = KPI、グラフの月次予算の年合計 = KPI、防衛ライン余裕 = 年間収入予算 − defenseLine().line × 12、自動提案 = 千円丸め(前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整) の各項、過不足カテゴリの差額 = 見通し − 来期予算、調整によるインパクト = Σ(来期予算 − 自動提案) が固定される。 |
| O3 | 予算が期間ごとに保存され、既存の読み手が同じ値を読む。 | API 統合テストで、PUT が期間ごとに保存し同じ期間は上書きされ、未認証 401・フェンス違反の拒否・不正値の 400 を確かめる。migration が既存行を 1 行も書き換えないことを検査し、保存行の無い期間で既存月額 × 12 が初期値になること、診断の予算カバー率が新しい表の値から出ることを確かめる。 |
| O4 | 編集中の作業が失われない。 | DOM テストで下書きの自動保存・復元・保存成功での消去・未保存 N 項目の件数・この行を元に戻す・すべてリセットの確認・離脱確認を確かめる。 |

## U5 成功基準 (success_criteria)

- S1 (G1): /budget で 14-budget.png の構成要素がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件である。実績 0 か月で空状態になる。『AI』の表示が 0 件である。
- S2 (G2): 同じ入力で KPI・一覧の合計・グラフの年合計・見通しの累計が一致し、自動提案の各項 (前期実績・増減率・季節性補正・計画による調整) が根拠として表示される値と一致する。外部送信が 0 件である。
- S3 (G3): 予算が予算対象の期間ごとに D1 に残り、migration は追加のみで既存行の書き換えが 0 件である。保存行の無い期間では既存月額 × 12 が初期値になる。
- S4 (G4): 下書きが画面の再読込後に復元でき、保存成功で消え、未保存のまま離れると確認が出る。
- S5 (G5): 防衛ライン・予算カバー率が他画面と同じ関数から出て、既存の診断・概要・家計収支・総収支・決算書・明細仕分けの数値テストが緑のまま、pnpm lint・typecheck・初期 JS 予算を CI で通す。既知の逸脱・未実施・一部適合は受入 PASS に数えない。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (個人事業主とその家族の家計を 1 人で管理する): 月次クローズを終えたあと、過去の実績をもとに来期 12 か月の事業の予算を立て、自動提案の根拠を確かめながら自分の計画 (採用・値上げ・広告など) を加えて調整し、どの科目が予算を超えそうか・その調整で年間の手元がどう変わるかを保存前に知りたい。
- SH2 保守者 (同一人物、および Claude Code などのコーディングエージェント): 予算・自動提案・見通し・防衛ライン余裕の定義が core の純関数 1 か所と docs・テストで固定され、予算画面・診断・ヘッダの数値がずれないこと。

## U7 スコープ (scope)

- **対象 (in)**: 予算画面 (14-budget.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直しと pages/budget/ 配下への分割, core の予算画面の算出 (前期実績・自動提案と根拠の内訳・見通し・KPI・過不足カテゴリ・調整によるインパクト) の一本化と、既存 budgets の読み手の参照先の統一, 予算対象の期間別の年額表 (計画による調整額と理由を含む) の追加のみの migration と GET / PUT API、canonicalMutationFence への登録, 下書きの localStorage 自動保存・復元・離脱確認・未保存件数・行単位 / 全体のリセット, docs (予算画面の設計判断・算出規則の正本) とテスト (core 単体・API 統合・DOM・描画確認)
- **対象外 (out)**: 予算の版管理・担当の表現 (AUDIT.md の指摘どおり除く), 外部 LLM による推奨・画像の『従業員数』『類似企業の業界中央値』など取込データに無い外部データの取得, 個人 (家計) の予算。今回の予算は事業の収入と経費科目を対象とする, 共通シェル (サイドバー・ヘッダ・月次クローズの進捗・フッタ・改善を送る) の作り直し, トレードオフ画面の変更, web 以外の専用アプリ (対象は web のみ)

## U8 制約 (constraints)

- C1 技術: pnpm monorepo (core は依存ゼロの純関数、api は Hono の Cloudflare Worker と D1/Drizzle、web は React 18 + react-router-dom 7 + TanStack Query 5)。算出は core に置き api/web へ重複実装しない。
- C2 デザイン: docs/design-system.md に従い、色は design-tokens.ts 由来のトークンだけ、共通部品 (PageHeader・KpiCard・Button・ConfirmDialog・PeriodPicker) と usePeriod を使う。画面専用の部品は pages/budget/ に置く。
- C3 データ: D1 の migration は追加のみで既存行を書き換えない。既存 budgets 表は残す。変更系 API は canonicalMutationFence の内側に置く。
- C4 秘匿: 外部 LLM を呼ばず、取込データを外部へ送信しない。
- C5 性能: 初期 JS 予算 (check-initial-js-budget) を超えない。グラフは既存のグラフ実装に揃える。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | Budget.tsx を pages/budget/ 配下へ分割し、見出し・期間タブ・予算対象・KPI 4 枚・月次グラフ・今後の見通し・予算一覧・科目パネル・過不足カテゴリ・調整によるインパクト・保存バーの構成に作り直す。期間タブを 2年 にすると前期実績と自動提案が過去 2 年の実績から計算し直される。 | G1, G2 |
| I2 | core に予算画面の算出 (仮称 budgetScreen) を新設し、前期実績・自動提案と根拠の内訳 (前期実績・増減率・季節性補正・計画による調整)・見通し・KPI・過不足カテゴリ・調整によるインパクトを 1 か所で出す。人件費の行を選ぶと、右のパネルでその内訳から推奨値が組み上がる様子と過去 12 か月の月別実績が見える。 | G2 |
| I3 | 予算対象の期間別の年額表を追加のみの migration で設け、GET / PUT /api/budget-plans と fence 登録を行い、診断の予算カバー率など既存の budgets の読み手を同じ読み出し関数へ寄せる。 | G3, G5 |
| I4 | 来期予算を自動提案より下げると、調整によるインパクトに年間の支出抑制額と予算純収支が即座に出る。入力の途中で別画面へ移って戻ると、下書きが復元され未保存の項目数が出る。 | G2, G4 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-budget-001`

予算画面サイクルの上位概念 U1-U9 を利用者が承認。画像 design/FINAL-UI/images/14-budget.png を正本とする。選択肢は『この内容で承認 / 修正して再提示』で、利用者は承認を選択 (2026-09-21T13:32:28Z、回答受領直後の実測時刻)。範囲外: 版管理・担当・外部LLMと外部データ・個人(家計)の予算・共通シェルの作り直し・トレードオフ画面・web 以外の専用アプリ。basis=user-decision。

#### この承認を名指ししている質疑: `qa-budget-ui-ux-web-001`

**問**

web の予算画面 (/budget) の UI-UX 要件は何か。画面の構成要素・文言・選択・編集・通知・状態・アクセシビリティをどうするか。

**答**

上から (1) パンくず『計画 / 予算』、期間タブ 1年 / 2年 / 3年 / 任意 と期間送り (usePeriod と PeriodPicker)。(2) 見出し『予算』と問い『実績に合う予算へ、どこを調整しますか？』、説明文『過去の実績をもとに、来期の予算を計画しましょう。』と、自動提案を参考に事業の優先順位で調整できる旨の 2 文目、右に予算対象 (12 か月の開始月の選択と『来期の12か月の予算を編集できます。』)。(3) KPI 4 枚: 年間収入予算・年間支出予算・予算純収支 (収入予算 − 支出予算) ・防衛ライン余裕 (年間収入予算 − 防衛ライン × 12、? で定義を示す) (qa-budget-decision-002, 004)。(4) 月次の実績・予算・見通しのグラフ (収入 実績・収入 予算・支出 実績・支出 予算の棒と見通し (収支) の折れ線、実績と見通しの境目の縦線と期間の注記) と、右に今後の見通し (累計収入・累計支出・累計純収支) と見通しコメント (数値から決定論で組む文)。(5) 予算一覧: カテゴリ名で検索 (Ctrl + K)・実績から提案・すべてリセット、列は選択・#・カテゴリ・前期実績・来期予算 (保存済み)・自動提案・差額 (来期予算 − 前期実績)・見通し・来期予算 (入力)。収入の行 (売上高・その他収入) と支出の行 (事業の経費科目) を 1 表に置く (qa-budget-decision-002)。(6) 右の科目パネル: 提案の根拠 / 関連データのタブ、自動提案の値と前期差、この値を適用、推奨の根拠の文、計算の詳細 (前期実績・増減率・計画による調整・季節性補正・推奨値)、計画による調整額と理由の入力 (qa-budget-decision-003)、月別の実績推移 (過去 12 か月の棒)、主な根拠データ、適用前の値、この行を元に戻す、閉じる。(7) 予算の過不足カテゴリ (来期見通し) の 支出の増加が見込まれる / 支出の減少が見込まれる のタブと件数、表 (#・カテゴリ・見通し・差額・要因)。(8) 調整によるインパクト: 入力内容を自動提案と比べた年間の支出差と予算純収支、差の大きい科目名、注意書き。(9) 下部の保存バー: 未保存 N 項目・最終保存の時刻と下書きを自動保存した旨・リセット・予算を保存。未保存のまま離れるときは確認する。画像の『AI・統計推奨』『AI提案と比較』は外部推論をしないため『自動提案』と表示する (qa-budget-decision-003)。見出し帯の『取引ライン』は既存ヘッダの『防衛ライン』のままとし、共通シェルは作り直さない。診断からの ?account= はその行を選んで科目パネルを開く。読込・空 (実績 0 か月)・失敗の各状態を持つ。差額と過不足は色だけで区別せず符号と文言を併記する。数値は画像のモックではなく実データから core で算出したものを出し、『従業員数 +2名予定』のような取込データに無い根拠は、利用者が入力した計画による調整の理由としてだけ出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-frontend-web-001`

**問**

web の予算画面のフロントエンド要件は何か。構成・状態・取得と更新・下書き・URL をどうするか。

**答**

Budget.tsx を pages/budget/ 配下の container と画面専用の部品に分け、pages/Budget.tsx は互換の re-export だけを残す。数値の算出は core の予算画面の関数に任せ、web の view-model.ts は書式 (円・万円・符号・率) と文言の組立てだけを持ち、core の計算を書き直さない。取得は TanStack Query で実績期間 (usePeriod) と予算対象の開始月を鍵に 1 本の画面用 API から受け、保存は PUT で予算対象の全行をまとめて送り、成功で画面と分析派生の問い合わせを無効化する。入力・この値を適用・実績から提案・計画による調整は下書きとして localStorage に予算対象ごとに自動保存し、保存成功とログアウトで消し、次回に復元する。未保存の項目数は保存済みの値との差分から数え、未保存のまま画面を離れる (ルート遷移・再読込) ときは確認する。色は design-tokens.ts のトークンだけを使い、共通部品 (PageHeader・KpiCard・PageState・Button・ConfirmDialog・PeriodPicker) を使う。グラフは新しいライブラリを足さず既存の描画方式に揃え、初期 JS 予算を超えない。予算対象の開始月と選んだ科目は URL に持ち、診断からの ?account= を受け付ける (qa-budget-decision-001, 003)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-backend-web-001`

**問**

web の予算画面のバックエンド要件は何か。算出・API・既存の読み手との整合をどうするか。

**答**

core に予算画面の算出を純関数として新設し、Dataset・実績期間・予算対象・保存済みの予算・計画による調整から、前期実績・自動提案 (前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整 を千円に丸めた額) とその各項・見通し (実績のある月は実績、無い月は自動提案の月割)・月次の実績と予算・今後の見通しの累計・KPI (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕 = 年間収入予算 − defenseLine の月額 × 12)・過不足カテゴリ (見通し − 来期予算) ・調整によるインパクト (Σ(来期予算 − 自動提案)) を 1 回で返す (qa-budget-decision-002〜004)。行は収入 (売上高・その他収入) と支出 (事業の経費科目) で、その他収入は現行の集計に系列が無いため実績 0 の手入力行とする。api は画面用の取得 1 本と、予算対象の全行をまとめて上書きする保存 1 本を設け、zod で検証し、保存は canonicalMutationFence に登録する。保存行の無い期間は既存 budgets の月額 × 12 を初期値として返す (qa-budget-decision-001)。既存の budgets の読み手 (診断の予算カバー率・予算の着地見込み・analytics) は、今月を含む予算対象の年額 ÷ 12 を返すcore の読み出し関数を経由し、同じ値を 2 か所で計算しない。旧 GET/PUT /api/budgets と POST /api/budgets/suggest は互換のため残すが、画面は使わない。外部の LLM は呼ばない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-database-web-001`

**問**

web の予算画面のデータベース要件は何か。保存単位・移行・既存表との関係・復元をどうするか。

**答**

予算を予算対象の 12 か月 (開始月) ×科目の単位で、年額・収入 / 支出の区別・計画による調整額・調整の理由・更新時刻とともに保存する新しい表を、追加のみの migration 1 本で設ける (qa-budget-decision-001〜003)。同じ期間は上書きで、版は持たない。主キーの先頭は利用者とし、利用者で区切る。既存の budgets 表は残し、1 行も書き換えない。保存行の無い期間を開いたときの初期値は既存 budgets の月額 × 12 を読み出して示すだけで、表へは書かない。新しい表は JSON の書き出しと復元 (Dataset・import-lifecycle) と JSON snapshot の無効化の対象に加え、毎晩のバックアップから予算が戻るようにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-auth-web-001`

**問**

web の予算画面の認証・認可要件は何か。

**答**

新しい認証方式は作らない。予算画面の取得と保存の API は /api/* の authGuard と mustChangePasswordFence の内側に置き、利用者 id はセッションから取り、要求の本文や URL からは受け取らない。予算の表は利用者で区切り、他の利用者の予算を読み書きできない。下書きは端末の localStorage に置くため、保存成功とログアウトで消す (qa-budget-decision-001)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-security-web-001`

**問**

web の予算画面のセキュリティ要件は何か。

**答**

入力はすべて zod で検証し、年額・調整額は整数で範囲を制限し、科目名と計画による調整の理由は長さを制限して React の既定のエスケープで描画する。予算の保存は canonicalMutationFence に登録し、取込の洗替えと直列化する。取込データと予算を外部へ送信せず、自動提案は外部の LLM を呼ばずに決定論で出す (qa-budget-decision-003)。下書きには調整の理由が入るため、保存成功とログアウトで消し、サーバへは保存操作でだけ送る。CSP (packages/web/public/_headers) は緩めない。1 回の保存の行数に上限を置く。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-infrastructure-web-001`

**問**

web の予算画面のインフラ要件は何か。

**答**

構成は変えない。既存の Cloudflare Worker と D1 の上に載せ、R2・キュー・新しいバインディング・外部サービスを足さない (qa-budget-decision-003)。無料枠 (Workers の CPU 時間・D1 の読み書き) の範囲で動くよう、予算の保存は行数に上限を置いて D1 の batch でまとめて書き、算出は 1 回の要求で完結させる。追加のみの migration 1 本を既存の Deploy / Migrate の手順で反映する (qa-budget-decision-001)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

#### この承認を名指ししている質疑: `qa-budget-maintenance-ops-web-001`

**問**

web の予算画面の保守運用要件は何か。テスト・文書・反映手順をどうするか。

**答**

core の単体テストで、KPI の各式 (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕 = 年間収入予算 − defenseLine の月額 × 12) ・一覧の合計と KPI とグラフの年合計の一致・自動提案の各項と千円丸め・見通しの月次と累計・過不足の差額・調整によるインパクト・保存行の無い期間の初期値 (既存月額 × 12) を固定する (qa-budget-decision-001, 004)。api のテストで期間ごとの保存と上書き・未認証・フェンス・不正値・利用者の区切り・migration が既存行を書き換えないことを、web の DOM テストで画像の構成要素・下書きの復元と消去・未保存件数・元に戻す・リセットの確認・離脱確認・診断からの ?account= を確かめる。既存の診断・概要・家計収支・総収支・決算書・明細仕分けの数値テストを緑のまま保ち、pnpm lint・typecheck・初期 JS 予算を CI で通す。画面仕様・設計・設計判断・証跡を既存の作り直しと同じ場所に残す。migration は既存の Migrate の手順書に従って反映する。既知の逸脱・未実施・一部適合は受入 PASS に数えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)


## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| dec-budget-storage-unit | 予算の保存単位をどうするか (期間を持たない科目別の月額 1 つか、予算対象の 12 か月ごとの年額か)。 | confirmed | opt-period-annual-table:期間別の年額表を追加 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': 'D1 の新しい表 1 つで無料枠内。追加のみの migration 1 本と読み出し関数の保守費。'} / free=D1 Free: rows read 5 million / day、rows written 100,000 / day、storage 5 GB。 / fit=画像の予算対象 12 か月・年額入力と一致し、既存の月額を初期値に引き継げる。 / pros=画像と一致する, 既存行を書き換えない / cons=既存の読み手を読み出し関数へ寄せる改修が要る / risks=読み手の寄せ漏れで値がずれる。テストで固定する / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/d1/platform/pricing/, https://developers.cloudflare.com/d1/reference/migrations/<br>opt-keep-monthly:既存の月額のまま / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '改修が最小で費用は無い。'} / free=D1 Free: rows read 5 million / day、rows written 100,000 / day、storage 5 GB。 / fit=期間を持てず、画像の予算対象と年額入力を満たせない。 / pros=改修が小さい / cons=画像と一致しない, 収入の予算を持てない / risks=来期と今期の予算を区別できない / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/d1/platform/pricing/<br>opt-versioned-plans:版つきの予算計画 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '表 2 つで無料枠内。版の比較・復元の UI と運用費が加わる。'} / free=D1 Free: rows read 5 million / day、rows written 100,000 / day、storage 5 GB。 / fit=デザイン監査 (AUDIT.md) が除くとした版管理を再導入してしまう。 / pros=過去の計画を辿れる / cons=監査の指摘に反する, 画面が複雑になる / risks=版の取り違え / lock-in=なし / ops=中 / evidence=https://developers.cloudflare.com/d1/platform/pricing/, https://developers.cloudflare.com/d1/reference/migrations/ | opt-period-annual-table — 画像の予算対象と年額入力を満たし、既存行を書き換えずに月額を引き継げる唯一の案で、監査が除いた版管理も持ち込まない。 (注意: 既存の budgets の読み手を 1 つの読み出し関数へ寄せる; confidence=high; checked=2026-09-21T13:35:48Z) | opt-period-annual-table @ 2026-09-21T13:26:07Z | G3, G5 |
| dec-budget-income-scope | 収入 (売上高・その他収入) も予算の対象にするか。 | confirmed | opt-include-income:収入も予算にする / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '行の種別を 1 列足すだけで無料枠内。'} / free=D1 Free: rows read 5 million / day、rows written 100,000 / day、storage 5 GB。 / fit=画像の売上高・その他収入の行と、年間収入予算・予算純収支・防衛ライン余裕の KPI を満たす。 / pros=画像と一致する, 純収支と防衛ライン余裕を出せる / cons=その他収入は現行の集計に系列が無く実績 0 の手入力行になる / risks=その他収入の実績が 0 と誤解される。注記で補う / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/d1/platform/pricing/<br>opt-expense-only:支出だけ / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '改修が小さく費用は無い。'} / free=D1 Free: rows read 5 million / day、rows written 100,000 / day、storage 5 GB。 / fit=年間収入予算・予算純収支・防衛ライン余裕の 3 枚を出せない。 / pros=改修が小さい / cons=画像の KPI 3 枚を欠く / risks=画面の問いに答え切れない / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/d1/platform/pricing/ | opt-include-income — KPI 4 枚のうち 3 枚が収入予算に依存し、支出だけでは画面の問いに答え切れない。 (注意: その他収入は実績 0 の手入力行であることを画面に示す; confidence=high; checked=2026-09-21T13:35:48Z) | opt-include-income @ 2026-09-21T13:26:07Z | G1, G2 |
| dec-budget-suggestion-source | 『AI・統計推奨』の値 (自動提案) をどう出すか。 | confirmed | opt-deterministic:決定論のみ / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': 'Worker 内の計算だけで無料枠内。'} / free=Workers Free: CPU 10 ms / request。 / fit=前期実績・増減率・季節性補正の根拠を出せるが、取込データに無い事業計画は反映できない。 / pros=再現できる, 外部送信なし / cons=事業計画を反映できない / risks=画像の『事業計画による増加』を出せない / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/platform/limits/<br>opt-deterministic-with-plan:決定論＋計画調整の入力 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': 'Worker 内の計算と D1 の列 2 つで無料枠内。'} / free=D1 Free: rows read 5 million / day、rows written 100,000 / day、storage 5 GB。 Workers Free: CPU 10 ms / request。 / fit=決定論の根拠に加え、利用者が入力した計画による調整額と理由を推奨値と根拠に出せ、画像の根拠欄を満たす。 / pros=画像の根拠欄を満たす, 外部送信なし / cons=入力欄が増える / risks=理由の文字列に機微情報が入る。外部へ送らない / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/d1/platform/pricing/<br>opt-external-llm:外部 LLM で提案 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': 'API 課金が従量で発生し、無料枠を超える。'} / free=外部 LLM API の無料枠は用途を満たさない。 / fit=文章の根拠を作れるが、フッタの『取込データは外部送信しません』に反する。 / pros=文章が柔らかい / cons=外部送信, 再現できない / risks=情報漏えい / lock-in=高 (特定 API に依存) / ops=中 / evidence=https://developers.cloudflare.com/workers/platform/limits/ | opt-deterministic — 外部送信をせずに再現できる根拠を出せ、入力欄を増やさずに済む。 (注意: 事業計画は根拠に出せないことを画面に示す; confidence=medium; checked=2026-09-21T13:35:48Z) | opt-deterministic-with-plan @ 2026-09-21T13:26:07Z | G2 |
| dec-budget-defense-margin | KPI の『防衛ライン余裕』を何で数えるか。 | confirmed | opt-income-minus-line:収入予算 − 防衛ライン × 12 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '計算だけで費用は無い。'} / free=外部資源を使わない。 / fit=ヘッダと同じ defenseLine を使い、年間収入予算が 1 年の防衛ラインをどれだけ上回るかを示す。 / pros=ヘッダと一致する, 定義が短い / cons=支出予算を見ない / risks=支出予算が防衛ラインを超えても余裕が正に見える。予算純収支と並べて補う / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/platform/limits/<br>opt-net-minus-line:予算純収支 − 防衛ライン × 12 / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '計算だけで費用は無い。'} / free=外部資源を使わない。 / fit=支出予算を二重に引く形になり、定義が直感とずれる。 / pros=保守的な値になる / cons=支出を二重に数える / risks=値が常に小さく出て誤解される / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/platform/limits/<br>opt-income-minus-expense-budget:収入予算 − 支出予算 (純収支と同じ) / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'none', 'tco': '計算だけで費用は無い。'} / free=外部資源を使わない。 / fit=予算純収支と同じ値になり、KPI が重複する。 / pros=単純 / cons=KPI が重複する / risks=防衛ラインの意味が失われる / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/platform/limits/ | opt-income-minus-line — ヘッダの防衛ラインと同じ関数を使い、予算純収支と重複しない意味を持つ。 (注意: ? の説明に式を示す; confidence=high; checked=2026-09-21T13:35:48Z) | opt-income-minus-line @ 2026-09-21T13:26:07Z | G2, G5 |
