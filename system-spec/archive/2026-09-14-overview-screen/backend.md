---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G3]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-review-queue-scope-ov-decision-001。裏付け質疑 (`qa_refs`): `qa-backend-web-ov-observed-001`, `qa-backend-web-ov-decision-001`, `qa-snooze-fingerprint-ov-decision-001`, `qa-design-rules-ov-decision-001`, `qa-o2-measure-ov-decision-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末からのオフライン操作 (後で確認・月次レビュー完了) をサーバでどう取り込み、未処理件数の再計算と整合させるかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリでは端末からのオフライン操作 (後で確認・月次レビュー完了) をサーバでどう取り込み、未処理件数の再計算と整合させるかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリでは端末からのオフライン操作 (後で確認・月次レビュー完了) をサーバでどう取り込み、未処理件数の再計算と整合させるかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリでは端末からのオフライン操作 (後で確認・月次レビュー完了) をサーバでどう取り込み、未処理件数の再計算と整合させるかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリでは端末からのオフライン操作 (後で確認・月次レビュー完了) をサーバでどう取り込み、未処理件数の再計算と整合させるかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の依存規則を、未処理キュー・信頼度・月次クローズ判定・直近12か月比較を packages/core の純関数に置き、packages/api のルートは D1 の行を渡して JSON にするだけにする規則 (qa-design-rules-ov-decision-001 の (2)) に反映した。O1・O5 を core の単体テストで検証できるのはこの配置による。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスの一方向性を、ルートが review_snoozes と monthly_close_reviews を読んで core に値として渡し、core が保留中の除外と内容指紋の不一致による保留の無効化 (qa-snooze-fingerprint-ov-decision-001) を判定する形に反映した。件数は全期間で数え (qa-review-queue-scope-ov-decision-001)、保留中でも月次クローズのステップ判定では未完了に数える (qa-backend-web-ov-decision-001)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3

#### 主たる接地根拠: `qa-review-queue-scope-ov-decision-001`

**問**

未処理キュー(サイドバーのバッジ・未処理カード・固定アクションバー)の件数は、どの範囲で数えますか? 選択肢: 全期間で数える (推奨) / 選択中の期間で数える / 両方を表示する

**答**

『全期間で数える』。ヘッダーの期間 (1年/2年/3年/任意) に関係なく、残っている未処理 (仕分けの確認 = clsSrc=既定 の明細、照合の確認 = totalCashflowReport の review、取込の確認 = status=failed の取込) をすべて数える。サイドバーのバッジ・未処理カード・固定アクションバーの3か所は同じ全期間の件数を表示し (O2)、古い月の未処理が0件表示に隠れない。期間で絞り込めるのは優先明細表の表示だけで、件数には効かない。これにより qa-backend-web-ov-decision-001 の『期間内』の件数定義を置き換える。集計範囲 (総合/事業/家計) の切替が未処理キューに効かない点 (qa-ui-ux-web-ov-decision-001) は変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-backend-web-ov-observed-001`

**問**

概況が必要とする集計 (事業+家計の総額・前12か月比・未処理件数・月次クローズ) は、現行の API とドメイン関数のどこにあり、どこが欠けているか。

**答**

GET /api/summary (packages/api/src/routes/analytics.ts:98-106) は overview(data) (packages/core/src/analysis.ts:96) と防衛ライン・benchmarks・period を返し、中身は事業の月別売上・経費・利益・3か月移動平均・unrecordedExpMonths・kpi・yearTable・pareto で、未処理件数を含まない。期間は loadScoped (analytics.ts:63-84) が ?from&to → ?year → ?span=1|2|3 の順に解釈し (packages/core/src/period.ts:151-165)、applyPeriod/sliceDataset (period.ts:76,122) が Dataset を切る。事業+家計の重複除外は /api/total-cashflow (packages/api/src/routes/total-cashflow.ts:61-97) の totalCashflowReport (packages/core/src/total-cashflow.ts:530) が担い、reconcileBizDuplicates (:355) と保存済み判断の bindVerdicts (routes/total-cashflow.ts:37-53) で MF 明細と freee 取引を突き合わせ、coverage.mfReview と月別 reviewCount が照合の要確認件数である。仕分けの未処理は classificationProgress().reviewPending (clsSrc=既定、packages/core/src/classify.ts:312-347) で、GET /api/transactions の summary.progress (packages/api/src/routes/classify.ts:230) にだけ出て、対象は ?month か最新1か月に限られる (:108-109)。取込は GET /api/imports (packages/api/src/routes/imports.ts:1546) が import_runs の status (processing/applying/committed/failed/duplicate、packages/api/src/db/schema.ts:255-271) を返す。/api/unsettled (analytics.ts:209-217) は loadScoped を通らない。分類の解決順は rules → vendor_memory (auto-apply のみ) → MF中項目 → 既定 (resolveIncomingTx、classify.ts:91)、vendor_memory の確信度は一致回数/(一致+不一致) で自動適用は3件以上かつ0.8以上 (packages/core/src/vendor-memory.ts:16-17,30,70)、科目候補は suggestTaxAccounts (packages/core/src/tax-accounts.ts:432) のキーワード照合で、MF中項目から勘定科目を推定する専用関数は無い。欠けているのは (1) 仕分け・照合・取込を横断する未処理キュー、(2) 総合/事業/家計を同じ定義で出す直近12か月 vs 前12か月、(3) 上位5+その他の内訳、(4) 月次クローズ4ステップの判定、(5) 保留と月次レビュー完了の書込 API である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: Explore サブエージェントが 2026-09-14 に packages/api・packages/core・packages/web・migrations・.github を読み、file:line を付けて報告した観測事実。報告受領後に date -u で実測した時刻を answered_at (上限値) とした。 / 回答時刻: 2026-09-14T11:54:38Z)

#### 裏付け質疑: `qa-backend-web-ov-decision-001`

**問**

推奨の仕訳の信頼度をどう出すか。未処理キューの優先順位と、月次クローズ4ステップの判定をどう定義するか。

**答**

信頼度は『既存の判定根拠を統合』(代替: 取引先の決め事だけ / AIで推定) — vendor_memory の一致率 → ルール → MF中項目 の順に根拠を探す。具体化: (1) vendor_memory が1件に一致すれば一致回数/(一致+不一致) を百分率 (四捨五入の整数) で出し『過去 N 件中 M 件で同じ手当て』を併記する、(2) それが無く大/中項目ルールが一致すれば根拠種別『ルール』を出し百分率は作らない、(3) それも無く MF中項目が『事業』で始まれば根拠種別『MF中項目』で事業区分だけを推奨する、(4) どれにも該当しなければ『推奨なし』を返す。同じ入力には同じ結果を返し、乱数・時刻・外部送信を使わない (O5)。未処理キューは 照合の確認 (事業と家計の二重計上の恐れ = 総額を歪める) → 仕分けの確認 → 取込の確認 の順に並べ、同じ種別の中は金額の絶対値の降順、同額は日付の新しい順とする。仕分けの確認は期間内の clsSrc=既定 の明細、照合の確認は totalCashflowReport の review、取込の確認は期間内の status=failed の取込である。月次クローズは対象月ごとに データ取込 (その月の取込が committed かつ未記録月でない)・仕分け (その月の仕分けの確認が0)・照合 (その月の照合の確認が0)・月次レビュー (monthly_close_reviews に行がある) の4つを判定し、保留中の明細は件数表示からは除くが仕分け・照合のステップ判定では未完了として数える (『後で確認』で締めたことにしない)。総合の総額は totalCashflowReport の月別値、事業は freee 側、家計は MF の家計側を使い、KPI・推移・年次比較・内訳は同じ月別系列から作る。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-14T12:54:50Z` — 【一部置換】仕分けの確認と取込の確認を『期間内』で数える件数定義は、qa-review-queue-scope-ov-decision-001 (2026-09-14T12:14:38Z) で全期間に置き換えた (reopen_log の backend/web、2026-09-14T12:20:03Z)。並び順・信頼度・月次クローズの判定は変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 信頼度の4段の出し方、優先順位、ステップ判定、保留の数え方は、利用者の選択 (既存根拠の統合・総合+切替) と承認済み O2/O5・G3 を実装粒度へ具体化したもの。 / 回答時刻: 2026-09-14T11:33:34Z)

#### 裏付け質疑: `qa-snooze-fingerprint-ov-decision-001`

**問**

『後で確認』にした明細を、あとで金額・日付・内容が変わった(取込の洗替えなど)ときにどう扱いますか? 選択肢: 内容が変われば再表示 (推奨) / 利用者が解除するまで保留 / 月が変わったら自動で解除

**答**

『内容が変われば再表示』。保留 (review_snoozes) を書くときに明細の内容指紋 (金額・日付・内容から作る) を保存し、キューを組み立てるときに現在の明細の指紋と比べて、異なる明細は保留を無効として未処理に戻す。同じ item_key のまま中身が変わった明細を、別の取引を保留したつもりで見落とさないためである。保留は利用者が解除したときにも消える。月の境目では自動で解除しない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-design-rules-ov-decision-001`

**問**

仕様書の上流指針に『推定』として書いた設計規則のうち、仕様として確定させるものを選んでください (複数選択、選ばなかったものは『実装時の提案』と明記して残す)。選択肢: 入力検証とDB制約の二重化 / 計算は core の純関数に置く / 新部品を共通化・PUTは冪等 / 件数ずれの切り分け手順を文書化

**答**

4件すべてを確定する。(1) 入力検証とDB制約の二重化: 保留と月次レビューの書込 API は kind (classification|reconciliation|import の3値)・itemKey (長さ上限つき文字列)・month (YYYY-MM) を境界で検証して 400 を返し、DB 側でも CHECK 制約と主キーで守る。migration 0040 は CREATE TABLE と CREATE INDEX だけで既存テーブルを変えず、件数などの集計列は保存しない。(2) 計算は core の純関数に置く: 未処理キュー・信頼度・月次クローズ判定・直近12か月比較は packages/core の純関数にし、packages/api のルートは D1 から読んだ行を渡して JSON にするだけにする。web は応答型 OverviewResponse・ReviewQueueResponse だけを知り、優先順位や信頼度を画面側で再計算しない。(3) 新部品を共通化・PUT は冪等: サイドバーのバッジ・右パネル・固定アクションバーは packages/web/src/components/ の共通部品にし、他の画面でも使える形にする。保留と月次レビューの PUT は同じ値を再送しても結果が変わらない。(4) 件数ずれの切り分け手順を文書化: 件数が3か所でずれたときは API 応答 → React Query のキー共有 → 保留の内容指紋 の順に確認する手順と、描画検査が失敗したときに screenshot から幅を特定する方法を docs に残す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 4件の文言は完成度 evaluator が『確定質疑に無い』と指摘した doctrine 記述をそのまま選択肢にしたもの。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-o2-measure-ov-decision-001`

**問**

成功目標 O2(未処理件数の3か所一致)の検査方法に、今回決まった2つの振る舞いを加えますか? 選択肢: 加える (推奨) = (1) 期間を切り替えても未処理件数が変わらない (2) 保留にした明細の内容指紋が変わると再び未処理に数えられる、を足す / 加えない = 2つの振る舞いは各章のテスト方針にだけ書く

**答**

『加える』。O2 の measure に、(1) DOM テストで期間を 1年 から 3年 に切り替えても3か所の件数が変わらないこと (qa-review-queue-scope-ov-decision-001 の全期間で数える)、(2) core の単体テストで、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられ3か所の件数へ戻ること (qa-snooze-fingerprint-ov-decision-001) を足す。上位概念の変更として appr-foundation-overview-002 で承認を記録する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (回答返却の直後に実測した時刻 2026-09-14T12:42:56Z)。完成度 evaluator の再評価 (completeness-findings-r2.json) の差し戻しを受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:42:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 総合 (事業+家計、重複除外) / 事業 / 家計 の総収入・総支出・純収支と前12か月比を最上位に出す。KPI・推移・年次比較・内訳は単一の定義で互いに検算が一致する。
- **G2**: 仕分け確認・照合確認・取込確認を1つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への1操作遷移を持つ。
- **G3**: 月次クローズ4ステップをデータから判定する。「月次レビュー完了」と「後で確認」は D1 に保存し、バックアップと復元でも保つ。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 同一 fixture で KPI・推移・年次比較・内訳の4要素の総額差が0である。 | core の単体テストが同一 fixture から4要素を計算し、総収入・総支出・純収支の差が 0 円であることを assert する。 |
| O2 | 未処理件数がサイドバーのバッジ・未処理カード・固定アクションバーの3か所で一致する。 | DOM テストが3か所の件数表示を取得して一致を assert し、1件を後で確認にしたとき3か所が同時に減ること、ヘッダーの期間を 1年 から 3年 に切り替えても3か所の件数が変わらないことも検査する。core の単体テストが、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられることを assert する。 |
| O3 | snooze と月次レビュー完了がバックアップ→復元の往復で保たれる。 | API テストが snooze と月次レビューを書き、バックアップを取り、全消去後に復元して行が一致することを assert する。 |
| O5 | 推奨科目の信頼度が決定論で、根拠が無ければ推奨なしを返す。 | core の単体テストが同じ入力で同じ信頼度を返すこと、vendor_memory・ルール・MF中項目のいずれも該当しない明細で推奨なしを返すことを assert する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: KPI 3枚 (総収入・総支出・純収支、前12か月比つき) と説明カード
- **I2**: 推移グラフの1年・2年・3年切替 (移動平均は切替で残す)
- **I3**: 未処理カード3種 (仕分け確認・照合確認・取込確認)
- **I4**: 優先度順の未処理明細表
- **I5**: 右パネル (理由・取引元・類似取引・推奨仕訳と信頼度・仕分けを開く・後で確認)
- **I6**: 年次比較表 (増減額・増減率)
- **I7**: 支出内訳の金額・構成比切替 (上位5+その他、パレートは構成比表示で残す)
- **I8**: 固定アクションバー (未処理件数と次の操作)

### 本章に効く確定意思決定

- **dec-review-state-storage**: 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか
  - 採択: D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする (`d1`)
  - 目的適合: G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない
- **dec-overview-aggregation-scope**: 概況の総収入・総支出・純収支、推移、年次比較、支出の内訳を、どの範囲で集計するか
  - 採択: 総合 (事業+家計、重複除外) を既定にし、事業/家計へ切り替えられる (`total-with-toggle`)
  - 目的適合: G1 の『総合/事業/家計の総収入・総支出・純収支と前12か月比』をそのまま満たす
- **dec-recommendation-confidence-source**: 右パネルの推奨科目と信頼度を何を根拠に出すか
  - 採択: 既存の判定根拠を統合 (vendor_memory の一致率 → ルール → MF中項目、どれも無ければ推奨なし) (`integrate-existing`)
  - 目的適合: G2 の『根拠種別付きの推奨科目と信頼度』を満たし、O5 の決定論を検査できる

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

API design patterns card の Contract first を、概況の4要素 (KPI・推移・年次比較・内訳) を同じ月別系列から作る確定 (qa-backend-web-ov-decision-001) に適用した。4要素を別々の定義で組み立てると O1 の検算が崩れるためである。新しい API が GET /api/overview・GET /api/review-queue と保留・月次レビューの PUT/DELETE であることは qa-auth-web-ov-observed-001 に、計算を core に置き PUT を冪等にすることは qa-design-rules-ov-decision-001 に、件数を全期間で数えることは qa-review-queue-scope-ov-decision-001 にある。【実装方針の提案 (推定・未確定。plan の task で確定する)】 GET /api/overview は ?scope=total|business|household と既存の期間指定を受け、kpi・trend・yearComparison・breakdown・closeStatus・dataUpdatedAt を1応答で返す。書込の経路は PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey と PUT/DELETE /api/monthly-close/:month/review、エラーは既存の {error:{code,message}} 形。コード上の語は DDD card の Ubiquitous Language に沿って review item・snooze・monthly close に揃える。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T12:20:03Z)

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
| cloudflare-workers-ai-pricing | 2026-08-28 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers-ai/platform/pricing/ | 2026-09-14T12:16:39Z | 2026-09-14T12:16:39Z |
