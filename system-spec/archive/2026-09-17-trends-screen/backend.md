---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-backend-web-trends-observed-004。裏付け質疑 (`qa_refs`): `qa-trends-decision-002`, `qa-trends-decision-003`, `qa-trends-decision-006`, `qa-trends-decision-008`, `qa-trends-decision-009`, `qa-trends-decision-010`, `qa-trends-decision-011`, `qa-trends-decision-012`, `qa-trends-decision-013`, `qa-trends-decision-014`, `qa-target-platforms-trends-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、推移画面の本カテゴリではアプリ向けに集計結果を先に計算して配る API の版管理を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、推移画面の本カテゴリではアプリ向けに集計結果を先に計算して配る API の版管理を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、推移画面の本カテゴリではアプリ向けに集計結果を先に計算して配る API の版管理を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、推移画面の本カテゴリではアプリ向けに集計結果を先に計算して配る API の版管理を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、推移画面の本カテゴリではアプリ向けに集計結果を先に計算して配る API の版管理を決める必要があった。対象を web のみとする利用者承認 (qa-target-platforms-trends-001 / appr-foundation-trends-001、2026-09-16) によりその検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-trends-001`

2026-09-16T09:27:37Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で推移画面サイクルの foundation (U1・G1-G5・対象外・制約) を『この内容で承認』と回答。先行する利用者決定 (2026-09-16T09:16:35Z / 09:19:14Z): 手を打つ順番=開閉式で残す、要因の説明=規則で自動生成、汎用性=指標を登録制、明細への導線=/classify に絞込を足す、期間タブ=全体の期間選択を操作、前期間=直前の同じ長さ、初期の月=最も変化が大きい月。

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 集計規則を core の純関数 (totalCashflowReport と推移の集計) に置き、api は D1 から読んで渡すだけにした。依存は api → core の内向きだけで、core は D1 も Hono も知らない。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | D1 の読み取りを analytics.ts の loadScoped と loadReviewSources に閉じ、core には行の配列だけを渡す。推移のために core から DB を触る経路は作らない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G5

#### 主たる接地根拠: `qa-backend-web-trends-observed-004`

**問**

推移の集計と API は既存のどこを土台にしますか?要確認の明細と傾向の判定はどの集合から数えますか?

**答**

上半分の数値 (系列・KPI・詳細・カテゴリ行・取引先行・パレート) は packages/core/src/total-cashflow.ts の totalCashflowReport と同じ集合から数える (qa-trends-decision-008)。totalCashflowReport は freee 取引・重複判定・freee 除外・MF 除外を受け、消し込み後の matched・freeeOnly・excluded・review と月次 months を返す。推移ではこの結果を行 (origin=mf/freee・月・区分・カテゴリ・取引先・口座・金額) へ平らにする新しい純関数を足し、その行から今回と比較期間の集計を作る。この集計は trendsReport を土台にせず、行を入力にする新しい関数として trend.ts に置く。要確認 (review) の MF 明細は総収支と同じく行に入れず、months の reviewCount・reviewAmount を期間と選択月で合計して返す (qa-trends-decision-012)。開閉で残す傾向の判定は現行どおり trendsReport(data: Dataset, scope) に MF の Dataset を渡して計算し、値を変えない (C4、qa-trends-decision-013)。返却の傾向の判定の部分には基準が MF 明細であることを示す値を付ける。比較期間は analysis-hub.ts の previousPeriod と period.ts の previousYearPeriod で作る。カテゴリの軸は expenseCategories と同じく事業は freee の勘定科目、家計は MF の大項目で、同名でも混ぜない。freee 行の口座は settleAccount で、空なら null を返し口座別の件数に数えない (qa-trends-decision-014)。API は packages/api/src/routes/analytics.ts の GET /api/trends で、loadScoped の期間 (from/to/year/span) と loadReviewSources と同じ 4 表の読み取りを使う。scope=total|business|household (all/biz/personal は互換で受ける)・metric・compare=previous|yoy・month・category・payee を足し、指標定義の登録表から系列を引く。全期間では比較期間を返さない (qa-trends-decision-010)。スパークラインの系列は直近 12 か月 (qa-trends-decision-009)。既存の rows/pareto/breakdown は互換のため残す。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: R4-reopen (2026-09-16T10:11:28Z、要確認の明細と傾向の判定の出所の利用者決定の反映) の後に既存コードを読み直した再観測 (worktree 07推移画面改善。packages/core/src/total-cashflow.ts の totalCashflowReport と月次行の reviewCount・reviewAmount、packages/core/src/trend.ts の trendsReport(data: Dataset, scope))。answered_at は読解直後に date -u で実測した時刻。 / 回答時刻: 2026-09-16T10:11:30Z)

#### 裏付け質疑: `qa-trends-decision-002`

**問**

画像の増減要因の説明文(例『春のキャンペーンに伴う広告出稿の増加』)は、何から作りますか?選択肢: (A) 規則で自動生成 (推奨) / (B) 利用者がメモを書く / (C) AI で生成。

**答**

(A) 規則で自動生成 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-003`

**問**

『様々な情報の推移を管理できる汎用性』はどこまで作りますか?選択肢: (A) 指標を登録制にする (推奨。今回は収入・支出・純収支の 3 指標で出し、あとから指標を足せる形にする) / (B) 画像の 3 指標だけ固定 / (C) 件数・口座別残高なども今回出す。

**答**

(A) 指標を登録制にする を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:16:35Z)

#### 裏付け質疑: `qa-trends-decision-006`

**問**

比較対象『前期間』はどの期間を指しますか?(『前年』は前年の同じ月範囲とします) 選択肢: (A) 直前の同じ長さ (推奨。支出分析ハブの previousPeriod と同じ定義) / (B) 期間内の前半と後半。

**答**

(A) 直前の同じ長さ を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:19:14Z)

#### 裏付け質疑: `qa-trends-decision-008`

**問**

推移の数値 (収入・支出・純収支とカテゴリ・取引先の行) は、どの取引集合から数えますか?選択肢: (A) 総収支と同じ (freee 取引と MF 明細を消し込んだ後の集合。totalCashflowReport と同じ数え方で、総合・事業の値が概況と総収支画面に一致する。freee 由来の行の明細は総収支画面で開く) (推奨) / (B) MF 明細だけ (現行 /api/trends と同じ。事業の値が概況・総収支と一致しない)。

**答**

(A) 総収支と同じ を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-trends-decision-009`

**問**

カテゴリ表のスパークラインは何か月分を描きますか?選択肢: (A) 選択期間の末月から遡る直近 12 か月 (推奨。行の高さと列幅を期間によらず一定にする) / (B) 選択期間の全月。

**答**

(A) 直近 12 か月 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-trends-decision-010`

**問**

期間に『全期間』を選んだとき、比較期間 (前期間・前年) はどう扱いますか?選択肢: (A) 比較を出さない (推奨。比較対象の切替を無効にして理由を表示し、KPI の増減は最も変化が大きい月の前月差で出す) / (B) 前年だけ出す。

**答**

(A) 比較を出さない を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-trends-decision-011`

**問**

推移 API と明細画面のクエリの誤りと取引先の絞込はどう扱いますか?選択肢: (A) 形式違反の month などは既定値へ倒し、400 は未登録の metric (invalid_metric) だけにする。取引先は専用の payee クエリで完全一致で絞る (推奨) / (B) 形式違反はすべて 400 にし、取引先は既存の検索 q に入れて部分一致で絞る。

**答**

(A) 既定値へ倒す+専用 payee を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の decision_guidance 指摘を受けた追加質問)。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T09:50:42Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:50:42Z)

#### 裏付け質疑: `qa-trends-decision-012`

**問**

総収支では『要確認』の MF 明細を事業にも家計にも数えない。推移も同じ取引集合から数えるため、月次クローズの途中で開くとその分だけ少なく出る。推移画面ではどう扱うか。選択肢: (A) 含めず件数を表示 — 数字は総収支と一致したまま、比較条件の帯に『要確認 N 件 (計 X 円) は含みません』と総収支画面への導線を出す。欠点: 要確認が片付くまで推移の値は確定前の値になる (推奨) / (B) 公私仕分けで仮に数える — 要確認の明細を resolveTx の結果で事業か家計に入れる。欠点: 推移の合計が総収支と一致しなくなり決定 008 が崩れる。

**答**

(A) 含めず件数を表示 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度再評価 FAIL の decision_guidance / matrix_coverage 指摘を受けた追加質問)。各選択肢には利点と欠点を併記して提示した。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T10:09:59Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T10:09:59Z)

#### 裏付け質疑: `qa-trends-decision-013`

**問**

開閉で残す『傾向の判定』(MK 検定・手を打つ順番) は MF 明細だけを受け取る trendsReport が計算する。上半分の数字は総収支と同じ取引集合から出すので、事業の支出が両者で食い違うことがある。どちらに合わせるか。選択肢: (A) MF 明細のまま+明記 — C4 を守り既存の契約テストをそのまま使う。開閉部分の見出しに『MF の明細だけで判定』と書き基準の違いを示す。欠点: 同じ画面に基準の違う数字が 2 種類並ぶ (推奨) / (B) 新しい取引集合へ移す — 傾向の判定も消し込み後の行から計算し画面全体の基準を 1 つにする。欠点: C4 を改め trend-contract.test.ts の期待値を更新する必要があり、既存の判定結果も変わる。

**答**

(A) MF 明細のまま+明記 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度再評価 FAIL の decision_guidance / matrix_coverage 指摘を受けた追加質問)。各選択肢には利点と欠点を併記して提示した。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T10:09:59Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T10:09:59Z)

#### 裏付け質疑: `qa-trends-decision-014`

**問**

freee 由来の行で口座の列 (settleAccount) が空のとき (列の無いエクスポートの取引や未決済の取引) の表示をどうするか。選択肢: (A) 『—』表示で絞らない — 口座が空の行は『—』と表示し、口座による絞込やグループ分けの対象から外す。欠点: 口座ごとの内訳が少し欠ける (推奨) / (B) 『口座なし』でまとめる — 空の行を『口座なし』という 1 つの口座として表や絞込に出す。欠点: 実在しない口座名が一覧に並ぶ。

**答**

(A) 『—』表示で絞らない を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で推奨案を選択した (完成度再評価 FAIL の decision_guidance / matrix_coverage 指摘を受けた追加質問)。各選択肢には利点と欠点を併記して提示した。answered_at は回答後に最初に date -u で実測した時刻 (2026-09-16T10:09:59Z) で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T10:09:59Z)

#### 裏付け質疑: `qa-target-platforms-trends-001`

**問**

推移画面サイクルの対象プラットフォームはどれですか? foundation の対象外に『web 以外の platform (専用アプリ)』を含めた案を提示し、承認を求めた。

**答**

foundation を『この内容で承認』と回答した。対象は web のみ (狭幅は既存 web のレスポンシブ表示で扱う)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-16 に AskUserQuestion で foundation 全体 (scope.out に web 以外を含む) を承認した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-16T09:27:37Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 推移の指標を登録制にする。指標定義 (id・表示名・月次系列の取り出し方・符号と良し悪しの向き・内訳の軸) を packages/core に置き、今回は収入・支出・純収支の 3 指標を登録する。画面・API・表は指標定義から描き、指標を足すときに画面と API の分岐を増やさない。
- **G3**: 推移に必要な集計を packages/core の純関数と API に置く。数値は総収支と同じ取引集合 (freee 取引と MF 明細を消し込んだ後、totalCashflowReport と同じ数え方) から数え、総合・事業・家計の値を概況と総収支画面に一致させる。範囲 (総合/事業/家計)・指標・比較対象 (前期間=直前の同じ長さ / 前年=前年の同じ月範囲) を受け取り、今回と比較期間の月次系列、月次差、KPI (現在値・増減額と率・最も変化が大きい月)、選択月の詳細 (各指標の値・増減要因 上位 3・出典の口座)、カテゴリ別の行 (直近 12 か月の系列・今回・比較・増減額・増減率・構成比・寄与度。カテゴリは MF 由来が大項目、freee 由来が勘定科目)、カテゴリ内の取引先別の行、パレート (増減額の降順と累計構成比) を返す。期間は既存の Dataset を切る設計 (sliceDataset) に従い、比較期間のデータは同じ方法で切り出す。全期間を選んだときは比較期間を作らず、KPI の増減は最も変化が大きい月の前月差で出す。要確認の MF 明細は総収支と同じく事業にも家計にも数えず、期間と選択月の要確認の件数と金額 (totalCashflowReport の月次 reviewCount・reviewAmount) を返す。開閉で残す傾向の判定は現行どおり MF 明細だけから trendsReport で計算し、どの基準で数えたかを返却に含める。
- **G5**: 増減の計算と要因の説明を単純で説明可能な規則として docs に明記しテストで固定する。増減額・増減率 (比較期間が 0 のときの表示)・構成比・寄与度・最も変化が大きい月の選び方・比較期間の定義・増減要因の説明文 (増減額が大きい取引先と件数から決まった形の文を作る。外部送信や AI 生成はしない) の規則を定め、境界値付きの core テストと DOM テストで固定する。数値の出所 (総収支と同じ取引集合)、全期間では比較を出さない規則、スパークラインを直近 12 か月とする規則も同じ docs に書く。要確認の明細を含めない規則と、傾向の判定だけは MF 明細を基準にする規則も同じ docs に書く。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 範囲・指標・比較対象の切替で KPI・チャート・表・パレートが同じ条件の値に切り替わる。 | core テストで 3 指標×3 範囲×2 比較対象の組合せについて、総合=事業+家計、純収支=収入-支出、カテゴリ行の今回合計の和=指標の期間合計、寄与度の和=100% (増減 0 を除く) が成り立つ。 |
| O3 | 指標の追加が定義 1 件の追加で済む。 | テスト用の指標定義を 1 件登録するだけで API の返却とチャートの系列に現れることを core と DOM のテストで確認する。 |
| O5 | 計算規則と説明文の規則が docs とテストで固定される。 | docs に規則表 (数値の出所・要確認の明細を含めない規則・傾向の判定の基準・比較期間・全期間の扱い・直近 12 か月・口座が空の行の扱い) があり、比較期間 0・比較データ無し・全期間・増減 0・負の値・要確認 0 件と 1 件以上・口座が空の freee 行の境界値テストが通る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: KPI 3 枚: 現在の値 (期間合計)、前期間 (または前年) からの増減の額と率、最も変化が大きい月とその増減と主な要因の一文。KPI の値は要確認の明細を含まない値である (帯の注記と対応する)。
- **I4**: 推移チャート: 収入・支出・純収支の今回の折れ線と、選んだ指標の比較期間の点線、月次差の棒、選択月の縦帯。月をクリックで選択月を変える。
- **I5**: 詳細パネル: 選択月の収入・支出・純収支と比較期間の値、主な増減要因 上位 3 (カテゴリ・増減額・説明文)、データの出典 (口座名と件数)、該当明細を開くボタン。選択月に要確認の明細があればその件数と金額も出す。freee 由来の行で口座が空のものは口座名を『—』と表示し、口座別の件数には数えない。
- **I6**: カテゴリ別の推移と増減の表: 12 か月のスパークライン・今回合計・比較期間・増減額・増減率・構成比・寄与度。行を開くと取引先別の同じ列の内訳を出す。
- **I7**: 増減の要因のパレート図 (増減額の棒と累計構成比の折れ線) と、増減が大きい項目の上位 3 のカード。
- **I9**: 指標定義の登録制: 収入・支出・純収支を定義として登録し、API はクエリの指標 id で定義を引く。
- **I12**: 計算規則と説明文の規則を docs に表で書き、境界値テストで固定する。

### 本章に効く確定意思決定

- **dec-trends-datasource-001**: 推移の数値をどの取引集合から数えるか (総収支と同じ freee+MF の消し込み後か、MF 明細だけか)
  - 採択: 総収支と同じ取引集合 (totalCashflowReport) (`opt-total-cashflow`)
  - 目的適合: G3 の『概況・総収支と一致する値』を満たし、事業費・事業収入を freee 側から数えるため事業の推移が会計と合う。
- **dec-trends-review-rows-001**: 推移の数値に要確認の MF 明細をどう扱うか (含めず件数を表示するか、公私仕分けで仮に数えるか)
  - 採択: 含めず件数と金額を注記する (`opt-exclude-with-note`)
  - 目的適合: G3 の『総収支と一致する値』を保ったまま、G1 の画面上で欠けている量を見せられる。
- **dec-trends-judgement-source-001**: 開閉で残す傾向の判定を MF 明細のまま計算するか、総収支と同じ取引集合へ移すか
  - 採択: MF 明細のまま計算し、基準を見出しに明記する (`opt-keep-mf-with-label`)
  - 目的適合: C4 (既存の傾向判定の値とテストを壊さない) を満たし、G5 の規則の固定も既存テストで続けられる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture の依存方向を、数え方を core の totalCashflowReport 1 か所に置くことで適用した。API (analytics.ts) は D1 から読んで core へ渡すだけで、消し込み・除外・要確認の規則を持たない。API Design Patterns の『列挙型パラメータと既定値』は scope・compare に、『互換の別名』は all/biz/personal に適用した。Domain-Driven Design の用語は総収支と揃え、事業=freee の勘定科目、家計=MF の大項目と軸を分けた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-16T09:55:39Z)

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

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| hono-zod-validator | 0.9.1 | Hono (honojs) (github.com) | https://github.com/honojs/middleware/releases?q=%40hono%2Fzod-validator&expanded=true | 2026-09-16T09:31:19Z | 2026-09-16T09:31:19Z |
