# 推移画面 要件の基準線 (SYS-TRENDS-P01)

実装の前に、何を満たせば完了かを固定する。正本は `specs/spec-trends-screen.md`。
今回の追加改善は同書の上書き規則に従い、生成済み system-spec に残る旧案より優先する。
後続 phase が「どの要件を満たしたか」を同じ番号で指せるようにする。

## 前提

- D1 のスキーマは変えない。migration は足さない (最新は `migrations/0042_total_cashflow_operations_and_exclusion_reason.sql` のまま)。
- 既存テスト 3 本を壊さない。
  - `packages/core/test/trend-contract.test.ts`
  - `packages/web/src/trends-scope.dom.test.tsx`
  - `packages/api/src/analytics-period.test.ts`
- 消し込み・除外・要確認の規則は `packages/core/src/total-cashflow.ts` のまま使う。

## 機能要件 (FR1〜FR13)

- FR1 (I1): 共通ヘッダーの PeriodPicker と PageHeader を期間選択・問いの唯一の所有者とし、推移画面内に重複しない。
- FR2 (I2): 問いの見出し『収支は、いつ・なぜ変わりましたか?』と説明の下に、範囲・指標・比較対象の 3 つの切替を 1 本の帯にまとめる。期間内に要確認の明細があれば、帯の末尾に『要確認 N 件 (計 X 円) は含みません』と総収支画面へのリンクを出す。
- FR3 (I3): KPI は 3 つの値を一体型サマリー帯にまとめる。現在の値 (今回期間合計)、比較期間からの増減額と率 (全期間では最も変化が大きい月の前月差とその旨の注記)、最も変化が大きい月とその月次差と主な要因の一文。KPI の値は要確認の明細を含まない。
- FR4 (I4): 推移チャート。今回の収入は棒、支出・純収支は線、選んだ指標の比較期間は点線、月次差は符号付き棒、選択月は縦帯で示す。
- FR5 (I5): 詳細パネル。選択月の収入・支出・純収支と比較期間の値、増減要因 上位 3 (カテゴリ・増減額・説明文)、データの出典は代表 1 件 + 他 N 件に圧縮し詳細開示する。初期表示は選択月の最大 driver から `recommended` CTA を出し、選択後の `focus` とは分離する。MF / mixed は『該当明細を開く』、freee は『総収支で確認』とし、月・金額・href の粒度を揃える。
- FR6 (I6): カテゴリ、直近12か月、今回合計、比較期間、増減額、増減率、構成比、寄与度の8列を常に保つ。比較不能時は比較4セルを『—』にする。スパークラインは欠損区間を跨がず、カテゴリは単一トリガー、取引先内訳は独立行で開示する。
- FR7 (I7): 増減の要因のパレート図 (絶対額降順の符号付き棒と、同じ分母を使う絶対寄与の累計線) と、短い要因文を持つ上位 3 のカード。
- FR8 (I8): 初期詳細には `recommended` CTA、選択後は下部の `focus` 選択バーを出す。選択中の月とカテゴリ (取引先) と増減額・率、origin に応じた明細確認ラベルを表示する。
- FR9 (I9): 指標定義の登録表を core に置き、`visualRole`・`controlOrder`・`showInOverview` を表示契約の正本にする。画面は API の指標一覧から切替と主図を描き、追加指標の選択値を必ず主図へ出す。
- FR10 (I10): /classify は category (大項目) と payee (明細の内容と完全一致) の初期値を URL から読み、既存の month・cls と組み合わせて絞り込む。payee は既存の検索 q とは別のクエリにする。
- FR11 (I11): 新比較画面から既存判定を外す。新フィールドの無い旧 Worker 応答に限り rolling deploy の fallback として表示し、新画面と重複させない。
- FR12 (I12): 計算規則と説明文の規則を docs/trends-screen.md に表で書き、境界値テストで固定する。
- FR13 (I1 の具体化): 保存値が無い初回は直近1年。利用者が明示した全期間は保存・復元し、既定値で上書きしない。

## 成功状態 (S1〜S5)

- S1 (G1): /analysis/trends で 07-trends.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell/chart の共通設定経由で、直書き色の lint が 0 件である。
- S2 (G2, G3): 3 指標×3 範囲×2 比較対象のどの組合せでも、画面の KPI・チャート・表の値が core の返却値と一致し、総合=事業+家計・純収支=収入-支出が成り立つ。総合・事業・家計の期間合計は同じ期間の総収支画面の値と一致する。
- S3 (G2): 指標定義を 1 件足すだけで画面と API に新しい指標が現れ、画面と API のコードに指標 id の分岐が無い。
- S4 (G4): 詳細パネルと選択バーからの遷移で、/classify が月・範囲・カテゴリ・取引先で絞り込んだ明細だけを表示し、推移の条件は URL から復元される。
- S5 (G5): 計算規則と説明文の規則が docs に書かれ、境界値テストを含む vitest が通り、既存の傾向判定のテスト (trend-contract.test.ts) も壊れていない。

## Contract tests (10 項目)

1. packages/api のテストで、scope の別名 (all/biz/personal) が total/business/household と同じ値を返すこと。
2. 未登録 metric が 400 invalid_metric を返し、形式違反の month・未知の scope/compare は既定値で 200 を返すこと。
3. 全期間の指定で comparePeriod が null、kpis.change.basis が peak_month_mom になること。
4. 総合・事業・家計の期間合計が同じ期間の GET /api/total-cashflow の値と一致すること。
5. payee が完全一致の行だけを選ぶこと (部分一致で選ばない)。
6. 既存フィールド (rows/pareto/breakdown) の値が拡張前と一致し、judgementBasis が mf_only であること。
7. 要確認の MF 明細が 0 件のとき review.count が 0、1 件以上のとき count・amount が同じ期間の GET /api/total-cashflow の要確認の件数・金額と一致し、推移の数値に含まれないこと。
8. freee 由来で口座が空の行が detail.sources で account null になり、口座別の件数に数えられないこと。
9. compare=previous と yoy で comparePeriod が期待の月範囲になること。
10. loadDataset と freee 系 4 表の読み取りが 1 回ずつであること (既存の analytics-period.test.ts と同じ静的検査の型)。

## 確定意思決定 (17 件)

| id | 決定 |
|---|---|
| qa-trends-decision-001 | 既存の手を打つ順番は旧 Worker fallback だけに残し、新比較画面からは除く |
| qa-trends-decision-002 | 増減要因の説明文は規則で自動生成する |
| qa-trends-decision-003 | 指標を登録制にし、今回は収入・支出・純収支を出す |
| qa-trends-decision-004 | /classify に category と取引先の絞込を足す。取引先は名寄せしない |
| qa-trends-decision-005 | 期間タブは全体の期間選択を操作する |
| qa-trends-decision-006 | 前期間は直前の同じ長さ |
| qa-trends-decision-007 | 初期の選択月は最も変化が大きい月 |
| qa-trends-decision-008 | 数値は総収支と同じ取引集合 (freee+MF の消し込み後) から数え、freee 由来の行は総収支画面を開く |
| qa-trends-decision-009 | カテゴリ表のスパークラインは直近 12 か月 |
| qa-trends-decision-010 | 全期間では比較を出さず、KPI の増減は最も変化が大きい月の前月差 |
| qa-trends-decision-011 | 形式違反の month などは既定値へ倒し、400 は未登録 metric だけ。取引先は専用の payee で完全一致 |
| qa-trends-decision-012 | 要確認の明細は数値に含めず、件数と金額を帯と詳細パネルに出して総収支へ導く |
| qa-trends-decision-013 | 互換 fallback の傾向判定は MF の明細だけで計算したまま、見出しに基準を明記する |
| qa-trends-decision-014 | freee 由来で口座が空の行は『—』と表示し、口座で絞らない |
| dec-trends-datasource-001 | 数値の出所は総収支と同じ取引集合 (2 案比較の推奨案を利用者が選択) |
| dec-trends-review-rows-001 | 要確認の明細は数値に含めず件数と金額を出す (同上) |
| dec-trends-judgement-source-001 | 傾向の判定は MF の明細だけのまま基準を明記する (同上) |

## scope 表記と実在 path の対応 (8 件)

architecture・task の `resource_scope` の一部は、リポジトリの実際の配置と名前が違う。
実装はすべて右列の path に対して行った。

| scope の表記 | 実在の path | 備考 |
|---|---|---|
| `packages/api/src/dataset.ts` | `packages/api/src/store.ts` | `loadDataset` の定義 |
| `packages/web/src/lib/api.ts` | `packages/web/src/api.ts` | `TrendsResp` の型と取得関数 |
| `packages/web/src/lib/charts.ts` | `packages/web/src/components/charts.ts` | chart.js の共通設定 |
| `packages/web/src/lib/period.ts` | `packages/web/src/period.tsx` | `usePeriod` |
| `packages/web/src/pages/analysis/trends-scope.dom.test.tsx` | `packages/web/src/trends-scope.dom.test.tsx` | 既存テスト (壊さない対象) |
| `packages/web/src/styles` | `packages/web/src/styles.css` + `packages/web/src/pages/analysis/trends.css` | トークンは styles.css、画面固有は trends.css (新設) |
| `packages/core/src/trend-metrics.ts` | 同左 (新設) | 指標の登録表と推移の集計 |
| `packages/web/src/pages/analysis/trends-screen.dom.test.tsx` | 同左 (新設) | 画面の DOM テスト |
