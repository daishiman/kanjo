---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G2, G4, G5]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-review-queue-scope-ov-decision-001。裏付け質疑 (`qa_refs`): `qa-frontend-web-ov-observed-001`, `qa-frontend-web-ov-decision-001`, `qa-design-rules-ov-decision-001`, `qa-defense-forecast-placement-ov-clarify-001`, `qa-defense-forecast-placement-ov-decision-001`, `qa-o2-measure-ov-decision-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではネイティブ UI 部品の選定と、サイドバーの未処理バッジを OS のアイコンバッジや通知へ写すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリではネイティブ UI 部品の選定と、サイドバーの未処理バッジを OS のアイコンバッジや通知へ写すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリではネイティブ UI 部品の選定と、サイドバーの未処理バッジを OS のアイコンバッジや通知へ写すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリではネイティブ UI 部品の選定と、サイドバーの未処理バッジを OS のアイコンバッジや通知へ写すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリではネイティブ UI 部品の選定と、サイドバーの未処理バッジを OS のアイコンバッジや通知へ写すかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines | 2026-07-12 | Apple HIG の一貫性を、バッジ・右パネル・固定アクションバーを概況専用にせず packages/web/src/components/ の共通部品として置く規則 (qa-design-rules-ov-decision-001 の (3)) に反映した。部品が無いこと、NavItem にバッジの props が無いことは qa-frontend-web-ov-observed-001 の観測である。 |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の境界データを、web が応答型 OverviewResponse・ReviewQueueResponse だけを知り優先順位や信頼度を画面で再計算しない規則 (qa-design-rules-ov-decision-001 の (2)) に反映した。未処理件数は全期間で数える (qa-review-queue-scope-ov-decision-001) ため、3か所が読む件数は期間に依存しない1つの値になる。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4, G5

#### 主たる接地根拠: `qa-review-queue-scope-ov-decision-001`

**問**

未処理キュー(サイドバーのバッジ・未処理カード・固定アクションバー)の件数は、どの範囲で数えますか? 選択肢: 全期間で数える (推奨) / 選択中の期間で数える / 両方を表示する

**答**

『全期間で数える』。ヘッダーの期間 (1年/2年/3年/任意) に関係なく、残っている未処理 (仕分けの確認 = clsSrc=既定 の明細、照合の確認 = totalCashflowReport の review、取込の確認 = status=failed の取込) をすべて数える。サイドバーのバッジ・未処理カード・固定アクションバーの3か所は同じ全期間の件数を表示し (O2)、古い月の未処理が0件表示に隠れない。期間で絞り込めるのは優先明細表の表示だけで、件数には効かない。これにより qa-backend-web-ov-decision-001 の『期間内』の件数定義を置き換える。集計範囲 (総合/事業/家計) の切替が未処理キューに効かない点 (qa-ui-ux-web-ov-decision-001) は変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-frontend-web-ov-observed-001`

**問**

02 の部品 (サイドバーのバッジ・月次クローズ進捗・右パネル・固定アクションバー・推移と内訳の図) を、現行の共通シェルと部品のどこに載せられるか。何が欠けているか。

**答**

共通シェルは packages/web/src/components/Layout.tsx で、サイドバーは APP_ROUTES を回して NavItem (packages/web/src/components/NavItem.tsx) を描くが、NavItem は to/icon/label/variant/end だけでバッジの props を持たない (Layout.tsx:264-305)。月次進捗は MONTHLY_STEPS=['取込','整える','確認','計画'] (Layout.tsx:57) を並べるだけで、表示する件数は『未記録 Nヶ月』(:201,256) だけである。Layout は ['summary', key] と ['imports'] を useQuery している (:182-192)。概況のルートは routeMetadata.ts:10-20 で path '/'・label『概況』・contentWidth 'reading'。部品は Page.tsx の PageShell/PageActions/PageHeader/PageState/KpiCard/AnnualComparisonTable (:10-141)、DataTable (components/DataTable.tsx:74)、FinancialFigure (components/FinancialFigure.tsx:39) がある。右パネルやドロワーの専用部品は無く、モーダルはネイティブ <dialog> (ConfirmDialog 等)、ドロワーはモバイルナビの drawer state (Layout.tsx:149) だけで、CSS 変数 --aside-panel-w: 320px (packages/web/src/styles.css:95) は定義だけで未使用である。Overview は react-chartjs-2 を直接使う (Overview.tsx:3-4,13)。データ取得は TanStack React Query (main.tsx:11-13 で retry 1・staleTime 30s) と api<T>() (api-client.ts:42)、期間は usePeriod().withPeriod (period.tsx) で付ける。欠けているのは NavItem のバッジ、データ判定の月次クローズ進捗、右パネル/ドロワー部品、固定アクションバー、金額/構成比切替つき内訳である。WAI-ARIA APG のモーダルダイアログは、開いたら内部へフォーカスを移し、Tab/Shift+Tab を内部で循環させ、Escape で閉じ、閉じたら起点へフォーカスを戻し、role=dialog・aria-modal=true・aria-labelledby を持つ。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: Explore サブエージェントが 2026-09-14 に packages/api・packages/core・packages/web・migrations・.github を読み、file:line を付けて報告した観測事実。報告受領後に date -u で実測した時刻を answered_at (上限値) とした。 ダイアログの要件は fetched-references の wai-aria-apg-dialog-modal (取得 2026-09-14T11:49:44Z) による。 / 回答時刻: 2026-09-14T11:54:38Z)

#### 裏付け質疑: `qa-frontend-web-ov-decision-001`

**問**

02 に無い既存の概況要素を画面上でどう残すか。

**答**

『畳んで残す』(代替: 画像どおりに削る / すべて表示したまま)。移動平均は推移グラフの表示切替 (初期は非表示)、パレートは支出内訳の『構成比』表示の中に置き、防衛予測・未決済・科目別年比較は本文末の『詳しく見る』(ネイティブ <details>、初期は閉じる) に入れる。既存の DefenseForecastPanel・UnsettledPanel は中身を変えずに移し、defense-forecast.dom.test.tsx の描画検査は開いた状態で通るようにする。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-14T12:54:50Z` — 【置換済み】防衛予測を本文末の『詳しく見る』に入れる部分と『defense-forecast.dom.test.tsx の描画検査は開いた状態で通るようにする』部分は、qa-defense-forecast-placement-ov-decision-001 (2026-09-14T12:42:56Z、利用者決定) で置き換えた。防衛予測は注意・警告の見込みがあるときだけ KPI の上に出し、既存の描画検査は <details> を開かずに通る。移動平均・パレート・未決済・科目別年比較の置き場所は変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 各要素の置き場所は承認済み G4・I2・I7 の文言 (移動平均は切替で残す、パレートは構成比表示で残す) の具体化。 / 回答時刻: 2026-09-14T11:33:34Z)

#### 裏付け質疑: `qa-design-rules-ov-decision-001`

**問**

仕様書の上流指針に『推定』として書いた設計規則のうち、仕様として確定させるものを選んでください (複数選択、選ばなかったものは『実装時の提案』と明記して残す)。選択肢: 入力検証とDB制約の二重化 / 計算は core の純関数に置く / 新部品を共通化・PUTは冪等 / 件数ずれの切り分け手順を文書化

**答**

4件すべてを確定する。(1) 入力検証とDB制約の二重化: 保留と月次レビューの書込 API は kind (classification|reconciliation|import の3値)・itemKey (長さ上限つき文字列)・month (YYYY-MM) を境界で検証して 400 を返し、DB 側でも CHECK 制約と主キーで守る。migration 0040 は CREATE TABLE と CREATE INDEX だけで既存テーブルを変えず、件数などの集計列は保存しない。(2) 計算は core の純関数に置く: 未処理キュー・信頼度・月次クローズ判定・直近12か月比較は packages/core の純関数にし、packages/api のルートは D1 から読んだ行を渡して JSON にするだけにする。web は応答型 OverviewResponse・ReviewQueueResponse だけを知り、優先順位や信頼度を画面側で再計算しない。(3) 新部品を共通化・PUT は冪等: サイドバーのバッジ・右パネル・固定アクションバーは packages/web/src/components/ の共通部品にし、他の画面でも使える形にする。保留と月次レビューの PUT は同じ値を再送しても結果が変わらない。(4) 件数ずれの切り分け手順を文書化: 件数が3か所でずれたときは API 応答 → React Query のキー共有 → 保留の内容指紋 の順に確認する手順と、描画検査が失敗したときに screenshot から幅を特定する方法を docs に残す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (会話記録上の回答返却時刻 2026-09-14T12:14:38Z)。完成度 evaluator の差し戻し (medium) を受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 4件の文言は完成度 evaluator が『確定質疑に無い』と指摘した doctrine 記述をそのまま選択肢にしたもの。 / 回答時刻: 2026-09-14T12:14:38Z)

#### 裏付け質疑: `qa-defense-forecast-placement-ov-clarify-001`

**問**

qa-ui-ux-web-ov-decision-001 の第4層『防衛予測・移動平均 (推移の切替で表示)』と qa-frontend-web-ov-decision-001 の『防衛予測は詳しく見る』は、防衛予測の置き場所について食い違っているか。

**答**

食い違っていない。qa-ui-ux-web-ov-decision-001 の括弧『(推移の切替で表示)』は直前の『移動平均』だけに係り、防衛予測には係らない。両記録を合わせた置き場所は、移動平均 = 推移グラフの表示切替 (初期は非表示)、パレート = 支出内訳の構成比表示、防衛予測・未決済・科目別年比較 = 本文末の『詳しく見る』(ネイティブ <details>、初期は閉じる) である。利用者が選んだ『畳んで残す』の選択肢説明 (2026-09-14T11:18:42Z 提示) にあった『防衛予測は警告時だけ上部に出す』は、qa-frontend-web-ov-decision-001 の具体化で採らず、初期表示に出す要素は増やしていない。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-14T12:54:50Z` — 【置換済み】結論のうち『防衛予測 = 詳しく見る』と『警告時だけ上部に出す案は採らない』は、利用者の確認を経ていなかったため qa-defense-forecast-placement-ov-decision-001 (2026-09-14T12:42:56Z) で置き換えた。qa-ui-ux-web-ov-decision-001 の括弧が移動平均だけに係るという読みは変わらない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 完成度 evaluator の medium 指摘を受け、アシスタントが spec-state.json の2つの qa_log 本文と会話記録の選択肢文を読み比べて確認した記録上の事実。書込直前に date -u で実測した時刻を answered_at とする。 / 回答時刻: 2026-09-14T12:20:03Z)

#### 裏付け質疑: `qa-defense-forecast-placement-ov-decision-001`

**問**

防衛予測(防衛ライン割れの事前警告)を新しい概況のどこに出しますか? 選択肢: 警告時だけ上部 (推奨) = 注意・警告の見込みがあるときだけ KPI の上に出す(現行と同じ条件)、平常時は何も出さない / 詳しく見るに畳む = 常に初期状態で閉じた『詳しく見る』の中に入れる

**答**

『警告時だけ上部』。防衛予測は defenseForecast の level が注意 (caution) か警告 (warn) のときだけ KPI 3枚の上に出し、none / nodata のときは何も描かない。現行の DefenseForecastPanel の表示条件・内訳・『やりくり試算で捻出元を探す』導線・警告時の role=alert をそのまま保つ。『詳しく見る』(ネイティブ <details>、初期は閉じる) に入れるのは未決済と科目別年比較だけで、移動平均は推移グラフの切替、パレートは支出内訳の構成比表示に置く (qa-frontend-web-ov-decision-001 のうち防衛予測以外は変わらない)。これは 2026-09-14T11:18:42Z に提示した『畳んで残す』の選択肢説明と一致し、防衛予測を『詳しく見る』に入れるとした qa-frontend-web-ov-decision-001 の該当部分と qa-defense-forecast-placement-ov-clarify-001 の結論を置き換える。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (回答返却の直後に実測した時刻 2026-09-14T12:42:56Z)。完成度 evaluator の再評価 (completeness-findings-r2.json) の差し戻しを受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:42:56Z)

#### 裏付け質疑: `qa-o2-measure-ov-decision-001`

**問**

成功目標 O2(未処理件数の3か所一致)の検査方法に、今回決まった2つの振る舞いを加えますか? 選択肢: 加える (推奨) = (1) 期間を切り替えても未処理件数が変わらない (2) 保留にした明細の内容指紋が変わると再び未処理に数えられる、を足す / 加えない = 2つの振る舞いは各章のテスト方針にだけ書く

**答**

『加える』。O2 の measure に、(1) DOM テストで期間を 1年 から 3年 に切り替えても3か所の件数が変わらないこと (qa-review-queue-scope-ov-decision-001 の全期間で数える)、(2) core の単体テストで、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられ3か所の件数へ戻ること (qa-snooze-fingerprint-ov-decision-001) を足す。上位概念の変更として appr-foundation-overview-002 で承認を記録する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (回答返却の直後に実測した時刻 2026-09-14T12:42:56Z)。完成度 evaluator の再評価 (completeness-findings-r2.json) の差し戻しを受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:42:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 仕分け確認・照合確認・取込確認を1つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への1操作遷移を持つ。
- **G4**: 02 のレイアウトを共通シェル・トークン・部品で実装する。既存の防衛予測・移動平均・パレート・未決済・科目別年比較は段階的開示で残す。
- **G5**: 読込・空・エラー状態、WCAG 2.2 AA、レスポンシブ (右パネルのドロワー化)、外部送信なし・認証必須を維持する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 未処理件数がサイドバーのバッジ・未処理カード・固定アクションバーの3か所で一致する。 | DOM テストが3か所の件数表示を取得して一致を assert し、1件を後で確認にしたとき3か所が同時に減ること、ヘッダーの期間を 1年 から 3年 に切り替えても3か所の件数が変わらないことも検査する。core の単体テストが、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられることを assert する。 |
| O4 | 画像正本の表示順と広幅レイアウトを保ち、概況の描画検査が8幅で通る。 | `system-spec/ui-ux.md#表示順の正本` の順序、広幅の Review 3列・比較/内訳2列、横はみ出しなしを scripts/check-financial-visuals.mjs が観測し、Overview エントリを8幅で描画して exit 0 になる。 |
| O5 | 推奨科目の信頼度が決定論で、根拠が無ければ推奨なしを返す。 | core の単体テストが同じ入力で同じ信頼度を返すこと、vendor_memory・ルール・MF中項目のいずれも該当しない明細で推奨なしを返すことを assert する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: KPI 3枚 (総収入・総支出・純収支、前12か月比つき) と説明カード
- **I2**: 推移グラフの1年・2年・3年切替 (移動平均は切替で残す)
- **I3**: 未処理カード3種 (仕分け確認・照合確認・取込確認)
- **I4**: 優先度順の未処理明細表
- **I5**: 右パネル (理由・取引元・類似取引・推奨仕訳と信頼度・仕分けを開く・後で確認)
- **I7**: 支出内訳の金額・構成比切替 (上位5+その他、パレートは構成比表示で残す)
- **I8**: 固定アクションバー (未処理件数と次の操作)
- **I9**: 本文のデータ最終更新と出典リンク

### 本章に効く確定意思決定

- **dec-review-state-storage**: 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか
  - 採択: D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする (`d1`)
  - 目的適合: G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない
- **dec-overview-legacy-elements**: 02 の画像に無い既存要素 (防衛予測・移動平均・パレート・未決済・科目別年比較) を概況でどう扱うか
  - 採択: 畳んで残す (防衛予測は注意・警告の見込みがあるときだけ KPI の上に出し、移動平均は推移の切替、パレートは構成比表示、未決済・科目別年比較は <details>『詳しく見る』) (`fold-and-keep`)
  - 目的適合: G4 の『02 のレイアウトで実装し、既存要素は段階的開示で残す』をそのまま満たす
- **dec-recommendation-confidence-source**: 右パネルの推奨科目と信頼度を何を根拠に出すか
  - 採択: 既存の判定根拠を統合 (vendor_memory の一致率 → ルール → MF中項目、どれも無ければ推奨なし) (`integrate-existing`)
  - 目的適合: G2 の『根拠種別付きの推奨科目と信頼度』を満たし、O5 の決定論を検査できる

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Information Design card の『形式の比較選定』を右パネルに適用した。確定しているのは、右パネルとドロワー部品が現状無いこと・--aside-panel-w: 320px が未使用であること・モーダルはネイティブ <dialog> を使っていること (qa-frontend-web-ov-observed-001)、狭幅で右パネルをドロワーにすること (U5 G5)、新部品を共通部品にし応答型だけを知ること (qa-design-rules-ov-decision-001)、件数を全期間で数えること (qa-review-queue-scope-ov-decision-001)、未決済と科目別年比較を <details> に入れること (qa-frontend-web-ov-decision-001)、防衛予測を注意・警告時だけ KPI の上に出すこと (qa-defense-forecast-placement-ov-decision-001) である。【実装方針の提案 (推定・未確定。plan の task で確定する)】 1280px 以上は --aside-panel-w の常設パネル、それ未満は <dialog> のドロワーにし、APG のモーダルダイアログ要件 (フォーカス移動・循環・Escape・起点へ戻す) を満たす。件数は useReviewQueue フック1つ (React Query キー ['review-queue']、期間を含めない) に集約し、後で確認の mutation 成功時にキーを invalidate して3か所を同時に減らし (O2)、変化は role=status で伝える。推移と内訳の図は FinancialFigure に載せ、トークン由来の系列色 (charts.ts) を使う。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T12:45:53Z)

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
| wai-aria-apg-dialog-modal | WAI-ARIA APG | W3C WAI (www.w3.org) | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | 2026-09-14T11:49:44Z | 2026-09-14T11:49:44Z |
| wai-aria-apg-disclosure | WAI-ARIA APG | W3C WAI (www.w3.org) | https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ | 2026-09-14T12:16:39Z | 2026-09-14T12:16:39Z |
