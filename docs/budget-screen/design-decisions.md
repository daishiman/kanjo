# 予算画面の設計判断(feat-budget-screen)

`/budget`(予算)を `design/FINAL-UI/images/14-budget.png` に合わせて作り直したときの判断の記録。画面仕様の正本は `specs/spec-budget-screen.md`、設計の正本は `architecture/budget-*.md`(8 本)。規則の番号(BR-xx)・受入の番号(AT-xx)・未決事項の番号(Q-x)は仕様書のものをそのまま使う。

## 1. 数値は core の 1 か所から出す

- 画面の数値は `packages/core/src/budget-screen.ts` の `budgetScreen`(実績から行の土台を作る)と `applyBudgetInputs`(入力を当てて KPI・一覧・グラフ・見通し・過不足・インパクトを出す)の 2 関数から出す。API の `GET /api/budget-screen` は保存済みの入力で `applyBudgetInputs` を呼んだ結果を返す。web は入力中の下書きで同じ関数を呼び直す。こうして、保存後と入力中で計算の規則が分かれないようにした(AT-08・AT-09)。
- core は現在時刻と乱数を読まない。「今月」は api が `Dataset.budgetAsOf` に入れた日本時間の年月を使う(BR-23)。
- 規則の要点は次のとおり(詳細は仕様書 BR-01〜BR-25)。

| 規則 | 要点 |
|---|---|
| BR-02 前期実績 | 実績期間の月次合計 × 12 ÷ 月数(円未満四捨五入)。その他収入は 0 |
| BR-03 増減率 | 直近 12 か月 ÷ その前の 12 か月 − 1 を ±30% で切る。実績 24 か月未満、または前の 12 か月が 0 なら 0 |
| BR-04 季節性補正 | 予算対象に掛かる月の偏り − 実績期間の偏りの換算(Q-5 の読み) |
| BR-05 自動提案 | 千円丸め(前期実績 × (1 + 増減率) + 季節性補正 + 計画による調整) |
| BR-07 見通し | 予算対象の月に実績があれば実績、無い月は round(自動提案 ÷ 12 + 月の偏り) |
| BR-09 KPI | 年間収入予算・年間支出予算は来期予算の和(空の行は 0)。予算純収支は差 |
| BR-10 防衛ライン余裕 | 年間収入予算 − 防衛ラインの月額 × 12 |
| BR-13 差額 | 来期予算 − 前期実績 |
| BR-14 過不足 | 見通し − 来期予算。**支出の行だけ**で、来期予算が空の行は出さない。インパクトは支出の行の Σ(来期予算 − 自動提案) |
| BR-22 `monthlyBudgetsAt` | 月を含む期間のうち `period_start` が最も新しいものの 年額 ÷ 12。該当が無ければ既存 `budgets` |
| BR-23 `budgetsInEffect` | 既存の読み手(予算表・着地見込み・診断)が読む月額。基準月は `budgetAsOf`、無ければ最終実績月の翌月 |

- 既存の読み手(`analysis.ts` の予算表と着地見込み、`diagnosis-detectors.ts`、`diagnosis-screen.ts` の予算カバー率)は `data.budgets` を直接読まず、`budgetsInEffect` を読む。予算画面で保存した年額が、診断にも同じ値で届く。

## 2. 画像(§7.12)との差

- 画像の数値はモックとして扱い、実データで出す(Q-1)。画像どおりの数値の fixture は作っていない。KPI と一覧の桁違いのような画像内の不一致は再現せず、KPI = 一覧の和になることをテストで固定した(AT-03)。
- 予算対象の既定は「実績期間の終了月の翌月から 12 か月」。既定では予算対象に実績の月が無いため、グラフの実績の棒と境目の縦線は出ない(Q-2)。開始月を過去へ動かすと出る。
- 一覧の accessible name は『予算一覧』にした(Q-3)。診断の受け口テスト(`diagnosis-next-action-receivers.dom.test.tsx`)の表名を追随させた。
- ブラウザの戻る・進むでは離脱の確認を出さない(Q-4)。画面内のリンクだけ確認を出す。下書きは入力停止の 800ms 後に保存し、期間切替・unmount・pagehide は待ち時間内でも dirty patch を同期的に退避する。

## 3. 実装で選んだ手段

### 3.1 グラフは SVG を自前で描く

`BudgetMonthlyChart.tsx`(月次)と `BudgetAccountPanel.tsx`(科目の月別推移)は Chart.js を使わずに SVG を描く。棒 4 系列と折れ線 1 本、境目の縦線だけで、Chart.js の lazy chunk を読み込むほどの描画は要らないため(C5。初期 JS と遅延 chunk を増やさない)。色は `budget.css` のクラスがトークンから当てる。予算の棒は枠線と薄い塗り、実績の棒は塗りで区別し、色だけに意味を持たせない。同じ数値を、視覚的に隠した表でも添えている。

### 3.2 確認とタブは狭い共通部品に寄せる

「すべてリセット」「チェックした行をリセット」と画面内リンクでの離脱確認は、既存の `ConfirmDialog` と `useConfirmDialog` を組み合わせる。確認の見た目・Esc・`showModal`・初期フォーカスをページ内へ重複実装しない。同期処理でも同じ部品を使えるよう、閉じるボタンの文言だけ `dismissLabel` で差し替える。

科目パネルと過不足カテゴリの 2 種類のタブは、小さな `AccessibleTabs` を共有する。共有範囲は role / `aria-selected` / roving tabindex / 左右・Home・End キーに限り、予算固有の本文や状態は抽象化しない。

### 3.3 保存の batch の文数(Q-7)

**結論: 全行置換をやめ、base revision つき dirty row patch を 3〜5 文で実装した。**

`PUT /api/budget-plans` は `baseSavedAt` を必須（未保存期間は null）にし、`canonicalMutationFence` の内側で現行 revision と照合する。不一致は 409 `budget_plan_conflict` で、D1 へは書かない。一致したときだけ、次を 1 回の `DB.batch` で送る。

1. dirty 科目を JSON 配列でまとめて DELETE（1 文）
2. `annualAmount` が null でない dirty 行を `json_each` で INSERT（1〜2 文）
3. 期間に残る行の `updated_at` を同じ新 revision へ進める（1 文）
4. JSON snapshot を無効化する（1 文）

削除だけなら 3 文、最大 200 行でも 5 文以内。未編集行を古い画面の値で上書きせず、同じ base からの同時保存は一方だけが成功する。最後の保存行を消すと revision は null になり、その後の `baseSavedAt:null` の同時作成も一方だけが成功する。API 統合テストが競合・別行保持・削除・200 行・snapshot・空期間境界を固定している。

## 4. 未決事項の最終状態

P12 のタスク仕様が挙げた 7 件の状態を記す。本書は値を決めない。実装によって事実上決まったものは、その実装を書き写している。

| 事項 | 状態 | 内容 |
|---|---|---|
| Q-7 保存の batch の文数と D1 の上限 | **実装で決着** | §3.3 のとおり 3〜5 文。上限 50 に対して十分な余裕がある |
| 収入の行の差額の色 | **仕様の値で実装、利用者は未確認** | 一覧の差額は、収入の行も支出の行と同じく + を赤系、− を緑系にし、符号の文字を併記した(`view-model.ts` の `diffClass`)。色は補助で、意味は符号と列見出しが担う。収入の増加を緑にしたい場合は、`diffClass` に行の種別を渡す変更で済む |
| 年額の下限 | **未決のまま** | zod(`budget-plan-schema.ts`)は年額・調整額とも整数で ±10,000,000,000 まで。年額を 0 以上には絞っていない。DB には金額の CHECK を置かない。JSON の復元で古い値を入れられるようにするため(`migrations/0050_budget_plans.sql` の冒頭に理由を書いた) |
| snapshot とバックアップの整合 | **実装で決着** | `budget_plans` は変更系フェンスの consumer(`canonical-mutation-fence.ts`)、JSON snapshot の無効化(保存の batch)、復元の write-set(`import-lifecycle.ts`。空でなければ DELETE してから入れる)、取込中の表の一覧(`import-active.ts`)のすべてに入れた。片方だけに入って snapshot が古い予算を返すことは無い |
| その他収入の扱い | **実装で決着(表示の文言は利用者未確認)** | 『その他収入』は `manualOnly=true`、前期実績 0、増減率 0 で、一覧に『実績なし・手入力』を併記する。過不足は支出の行だけに付く(BR-14)。そのため、その他収入が過不足カテゴリ・インパクト・見通しコメントの増加要因に出ることは無い |
| Q-5 増減率と季節性補正の読み方 | **仕様の読みで実装、利用者は未確認** | 直近 12 か月とその前の 12 か月は、実績期間の終了月から全実績で数える。季節性補正は、予算対象の偏り − 実績期間の偏りの換算。別の読みを選ぶ場合は、system-spec の backend 章を直してから本書と `budget-screen.ts` を直す |
| migration の番号 | **0050 に繰り上げて決着** | 実装時には 0048・0049 が AI 分析に使われていたため 0050 にした。`schema-guard.ts` と active な仕様・feature・architecture・task の参照は `0050_budget_plans.sql` に統一した。`.dev-graph/plans/` の promotion receipt は計画時点の不変証跡なので、旧予定番号 0048 を履歴として保持する |

## 5. 配信(P13)について

配信は単一の PR で、web ビルド・Worker・D1 migration 0050 を同時に出す。migration は表を足すだけで、既存の `budgets` を書き換えない。そのため、戻すときは PR を revert するだけで、表は消さない。

merge の直前に origin/main を fetch し直し、0050 がまだ空いているかを確かめる。埋まっていたら次の空き番号へ繰り上げ、`schema-guard.ts`・本書・`docs/data-schema.md` の参照を揃える。

## 6. この決定を古びさせないために

- `packages/core/test/budget-screen.test.ts` は、BR-01〜BR-25 の算出を手計算の定数で固定する。KPI = 一覧の和 = グラフの年合計 = 見通しの累計の一致と、`monthlyBudgetsAt` の期間の選び方も固定する。
- `packages/web/src/pages/budget/budget.dom.test.tsx` は AT-01〜12・AT-14・AT-20・AT-22 を固定する。範囲は、構成要素、下書きでの組み替え、保存・リセット・離脱の確認、`?account=` の絞り込み、外部送信 0 件。`packages/web/src/budget-outlook.dom.test.tsx` は、来期見通しと過不足の組み替えを手計算の定数で固定する。
- `packages/api/src/budget-screen.integration.test.ts` は、認証とフェンスの内側で動くこと、200 行の保存、snapshot の無効化、JSON の書き出しと復元を固定する。`packages/api/src/budget-migration-0050.test.ts` は、0050 を当てても既存の行が書き換わらないことを固定する。

## 7. 証跡の索引(P11)

受入の各項目から、証跡のテストと再現コマンドへ辿るための表。テストは `describe` の見出しで示す。再現コマンドは次の 4 本で、どれもリポジトリ直下で実行する。

| 記号 | 再現コマンド | 対象 |
|---|---|---|
| C | `pnpm --filter @kanjo/core exec vitest run test/budget-screen.test.ts` | `packages/core/test/budget-screen.test.ts` |
| A | `pnpm --filter @kanjo/api exec vitest run src/budget-screen.integration.test.ts src/budget-migration-0050.test.ts src/import-lifecycle-pure.test.ts` | api の統合テスト・migration 検査・フェンスの分類 |
| W | `pnpm --filter @kanjo/web exec vitest run src/pages/budget/budget.dom.test.tsx src/budget-outlook.dom.test.tsx src/diagnosis-next-action-receivers.dom.test.tsx src/components/AccessibleTabs.dom.test.tsx` | web の DOM テスト |
| V | Vite を起動後 `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 pnpm --filter @kanjo/web check:budget-visual` | 1024×1536 の実 Chrome と参照画像の構造契約 |
| Q | `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @kanjo/web build` | 全体。web の build の中で初期 JS 予算を測る |

| 受入 | 証跡(ファイル › describe) | 再現 |
|---|---|---|
| AT-01 | budget.dom › 見出しと予算対象 (AT-01)。パンくず・期間タブ・期間送りは Layout の共通テスト | W |
| AT-02 | budget.dom › KPI と見通し (AT-02・AT-04) | W |
| AT-03 | budget.dom › 月次グラフ (AT-03) | W |
| AT-04 | budget.dom › KPI と見通し (AT-02・AT-04)、core › 画面の数値が 1 か所から出る | W・C |
| AT-05 | budget.dom › 予算一覧 (AT-05) | W |
| AT-06 | budget.dom › 科目パネル (AT-06)、core › 増減率・季節性・自動提案 | W・C |
| AT-07 | budget.dom › 過不足とインパクト (AT-07・AT-08)、budget-outlook.dom、core › 文と過不足カテゴリ | W・C |
| AT-08 | budget.dom › 過不足とインパクト (AT-07・AT-08) | W |
| AT-09 | budget.dom › 保存バーと保存 (AT-09) | W |
| AT-10 | budget.dom › 下書き・リセット・離脱確認 (AT-10) | W |
| AT-11 | budget.dom › 状態 (AT-11)、api › GET /budget-screen(実績が無ければ empty) | W・A |
| AT-12 | budget.dom › 語と色 (AT-12) | W |
| AT-13 | core › 画面の数値が 1 か所から出る (AT-13)、丸め | C |
| AT-14 | budget.dom › 期間タブ (AT-14)、api › GET /budget-screen(実績期間を変えると前年実績が変わる) | W・A |
| AT-15 | api › PUT /budget-plans(dirty patch・別行保持・削除・revision 競合・401・他利用者・400)。`import-lifecycle-pure.test.ts` は変更系フェンスの対象であることも固定する | A |
| AT-16 | api › GET /budget-plans と GET /budget-screen の legacy、migration › 0050 budget_plans | A |
| AT-17 | api › 既存の読み手 (BR-23) と JSON の往復、core › 既存の読み手の予算 (BR-22〜BR-25) | A・C |
| AT-18 | api › PUT /budget-plans(snapshot の無効化)と 既存の読み手と JSON の往復、core › 既存の読み手の予算 | A・C |
| AT-19 | api › GET /budget-screen(余裕は防衛ラインと一致する: `/api/defense-line` の line と同値)。ヘッダはその `/api/defense-line` を読む。画面の KPI の添え書き(月額 × 12)は budget.dom › KPI と見通し | A・W |
| AT-20 | budget.dom › 診断からの受け口 (AT-20)、diagnosis-next-action-receivers.dom | W |
| AT-21 | 直書き色の lint を含む全体のゲート。初期 JS は 107.28KiB / 110KiB(2026-09-22 の実測) | Q |
| AT-22 | budget.dom › 外部送信 (AT-22) | W |

成功状態 S1〜S5 は AT の束で判定する。S1 = AT-01〜03・05・11・12・21、S2 = AT-04・06〜08・13・22、S3 = AT-15〜18、S4 = AT-09・10、S5 = AT-17・19・21。

- AT-14 の DOM 側(期間タブを押すと取り直す)は索引を作る時点で欠けていたため、テストを足した。`withPeriod` を外した実装で落ちることを確かめてある。
- migration の番号は 0050 に繰り上げ、active な仕様と実装の参照を統一した(§4)。

## 8. 独立最終レビュー(P10)

scope_out の各項目を差分から確かめ、侵犯は 0 件だった。

| scope_out | 確かめた方法 | 結果 |
|---|---|---|
| 既存 budgets 表の削除・書き換え | `migrations/0050_budget_plans.sql` は `CREATE TABLE budget_plans` だけで、budgets への DROP・ALTER・UPDATE・DELETE・INSERT が 0 件 | 無し |
| 旧 API の削除 | api の差分に `/api/budgets` の削除行が 0 件。予算が未保存の間は旧 budgets を読む(BR-22) | 無し |
| 外部 LLM・外部データ | 差分に外部 host への fetch や LLM SDK の追加が 0 件。『自動提案』は core の決定論 | 無し |
| 版管理・担当者・承認フロー / 個人(家計)の予算 | 差分にそれらの列・画面の追加が 0 件。予算対象は事業だけ | 無し |
| 共通シェルの作り直し | `Layout.tsx` の差分はログアウトで下書きを消す 2 行だけ(仕様が指定した変更) | 無し |
| トレードオフ画面・web 以外のアプリ | 該当する追加が 0 件 | 無し |

AT-01〜AT-22 は §7 の索引どおり合格。最終コマンドの件数と状態は、この文書の §9 に実測結果として追記する。

## 9. 2026-09-22 改善レビューの状態と証跡

- 実装の対象ゲート: web 40/40、api 61/61。最終の package 全体検査は core 1006 PASS / 6 skip、api 846 PASS、web unit 906 PASS で、web render shards も PASS。`pnpm test:aux`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm preview:smoke` も PASS した。web の初期 JS は 108.06KiB / 110KiB。
- 実ブラウザ: `docs/budget-screen/evidence/budget-1024x1536.png` と `.json`。1024px で一覧 469px / 右パネル 240px（1.95:1）として一覧を主に保ち、選択 checkbox は見た目 18px / 操作領域 44px / 行高 45px、横 overflow 0、KPI アイコン 4、グラフ 4 系列の x 位置分離、期間注記がグラフ下、初期人件費パネル、予算領域の最小文字 12px、runtime error 0 を機械検査した。
- 12ui-design: `12ui improve ... --dry-run` は PASS。実変換は magic-link サインインと最大 US$0.55 の購入境界があるため未実行とし、上記の無課金・匿名 fixture の実 Chrome 証跡で代替した。
- task の `pending` は default branch への promotion 前という公開状態で、受入テストの失敗を意味しない。計画の正本 `task-graph.json` は各 node の `depends_on` と同じ 12 本を top-level `edges` にも持つ形へ正規化し、`plan-structure.*` は 13 task / 12 edge / 起点 P01 として正本から再生成した。生成投影を手編集していない。
