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

概況を「数字を眺める分析画面」から月次クローズの作業起点に変える。開いた瞬間に直近12か月の収支の結論と「次に直すこと」が分かり、未処理0まで概況から迷わず進める。

## U2 背景 (background)

FINAL-UI 02 (design/FINAL-UI/images/02-overview.png) が概況の正本として採用され、デザインシステム基盤 (#49) でトークンと共通シェルが揃った。一方、現行の概況 (packages/web/src/pages/Overview.tsx、GET /api/summary → core overview()) は事業 (freee) の KPI と暦年の年換算だけで、事業+家計の総収入が無い。未処理は仕分け・照合・取込の各画面に散っていて横断の件数が無く、サイドバーのバッジ、保留 (snooze)、月次クローズの状態も無い。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 総合 (事業+家計、重複除外) / 事業 / 家計 の総収入・総支出・純収支と前12か月比を最上位に出す。KPI・推移・年次比較・内訳は単一の定義で互いに検算が一致する。 |
| G2 | 仕分け確認・照合確認・取込確認を1つの未処理キューに集約する。件数 (バッジ・カード・アクションバー) の一致、優先順位、根拠種別付きの推奨科目と信頼度、右パネル、該当画面への1操作遷移を持つ。 |
| G3 | 月次クローズ4ステップをデータから判定する。「月次レビュー完了」と「後で確認」は D1 に保存し、バックアップと復元でも保つ。 |
| G4 | 02 のレイアウトを共通シェル・トークン・部品で実装する。既存の防衛予測・移動平均・パレート・未決済・科目別年比較は段階的開示で残す。 |
| G5 | 読込・空・エラー状態、WCAG 2.2 AA、レスポンシブ (右パネルのドロワー化)、外部送信なし・認証必須を維持する。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 同一 fixture で KPI・推移・年次比較・内訳の4要素の総額差が0である。 | core の単体テストが同一 fixture から4要素を計算し、総収入・総支出・純収支の差が 0 円であることを assert する。 |
| O2 | 未処理件数がサイドバーのバッジ・未処理カード・固定アクションバーの3か所で一致する。 | DOM テストが3か所の件数表示を取得して一致を assert し、1件を後で確認にしたとき3か所が同時に減ること、ヘッダーの期間を 1年 から 3年 に切り替えても3か所の件数が変わらないことも検査する。core の単体テストが、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられることを assert する。 |
| O3 | snooze と月次レビュー完了がバックアップ→復元の往復で保たれる。 | API テストが snooze と月次レビューを書き、バックアップを取り、全消去後に復元して行が一致することを assert する。 |
| O4 | 画像正本の表示順と広幅レイアウトを保ち、概況の描画検査が8幅で通る。 | `system-spec/ui-ux.md#表示順の正本` の順序、広幅の Review 3列・比較/内訳2列、横はみ出しなしを scripts/check-financial-visuals.mjs が観測し、Overview エントリを8幅で描画して exit 0 になる。 |
| O5 | 推奨科目の信頼度が決定論で、根拠が無ければ推奨なしを返す。 | core の単体テストが同じ入力で同じ信頼度を返すこと、vendor_memory・ルール・MF中項目のいずれも該当しない明細で推奨なしを返すことを assert する。 |

## U5 成功基準 (success_criteria)

- S1 (G1-G5): O1-O5 のテストと検査がすべて CI で緑である。
- S2 (G4): 02-overview.png の全要素 (KPI3+説明カード、推移、未処理カード3種、優先明細表、右パネル、年次比較表、内訳、固定アクションバー、データ最終更新と出典) が実データで描画される。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (単独の個人事業主1名、利用者兼保守者): 月初に取り込んだ後、概況で「いくら残ったか・何が未処理か」を掴み、未処理を0にしたい。
- SH2 実装を担うコーディングエージェント: 仕様とタスクから、共通シェル・トークン・部品と既存集計を再利用して実装する。

## U7 スコープ (scope)

- **対象 (in)**: 概況ページ (packages/web/src/pages/Overview.tsx) の 02 レイアウトへの作り替え, 概況用 API, core の集計: 直近12か月 vs 前12か月、上位5+その他、未処理キュー、信頼度、月次クローズ判定, D1 migration: snooze と月次レビュー完了, 共通シェルのサイドバー未処理バッジ, バックアップ対象への snooze・月次レビューの追加
- **対象外 (out)**: スマートフォン・タブレット・デスクトップの専用アプリ (web のレスポンシブで対応する), AI/LLM による科目推定 (外部送信なしの約束と衝突する), 分類アルゴリズム自体の変更 (既存の判定根拠を統合するだけ), 概況以外の19画面の作り直し

## U8 制約 (constraints)

- C1: Cloudflare Workers + D1 + React SPA の既存構成で実装する。
- C2: 取引データを外部へ送信しない。
- C3: 期間は分析関数へ引数を配らず Dataset を切る方式で絞る (core/src/period.ts)。
- C4: 色は packages/core/src/design-tokens.ts から取り、直書きは lint (check-design-tokens) で検出する。
- C5: D1 migration は前進のみで、デプロイゲート (migrate.yml) を通す。
- C6: CI の headless Chrome は pointer:none として扱い、@media (pointer: fine) に依存しない。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | KPI 3枚 (総収入・総支出・純収支、前12か月比つき) と説明カード | G1, G4 |
| I2 | 推移グラフの1年・2年・3年切替 (移動平均は切替で残す) | G1, G4 |
| I3 | 未処理カード3種 (仕分け確認・照合確認・取込確認) | G2 |
| I4 | 優先度順の未処理明細表 | G2 |
| I5 | 右パネル (理由・取引元・類似取引・推奨仕訳と信頼度・仕分けを開く・後で確認) | G2 |
| I6 | 年次比較表 (増減額・増減率) | G1 |
| I7 | 支出内訳の金額・構成比切替 (上位5+その他、パレートは構成比表示で残す) | G1, G4 |
| I8 | 固定アクションバー (未処理件数と次の操作) | G2, G4 |
| I9 | 本文のデータ最終更新と出典リンク | G4, G5 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-overview-002`

利用者が 2026-09-14 に AskUserQuestion『成功目標 O2 の検査方法に、今回決まった2つの振る舞いを加えますか?』で『加える (推奨)』を選択した (回答返却の直後に実測した時刻 2026-09-14T12:42:56Z)。O2 の measure だけを変更し、U1-U9 の他の項目は appr-foundation-overview-001 の承認内容のまま。basis=user-decision。

#### この承認を名指ししている質疑: `qa-o2-measure-ov-decision-001`

**問**

成功目標 O2(未処理件数の3か所一致)の検査方法に、今回決まった2つの振る舞いを加えますか? 選択肢: 加える (推奨) = (1) 期間を切り替えても未処理件数が変わらない (2) 保留にした明細の内容指紋が変わると再び未処理に数えられる、を足す / 加えない = 2つの振る舞いは各章のテスト方針にだけ書く

**答**

『加える』。O2 の measure に、(1) DOM テストで期間を 1年 から 3年 に切り替えても3か所の件数が変わらないこと (qa-review-queue-scope-ov-decision-001 の全期間で数える)、(2) core の単体テストで、保留した明細の内容指紋 (金額・日付・内容) を変えるとその明細が再び未処理に数えられ3か所の件数へ戻ること (qa-snooze-fingerprint-ov-decision-001) を足す。上位概念の変更として appr-foundation-overview-002 で承認を記録する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で回答した (回答返却の直後に実測した時刻 2026-09-14T12:42:56Z)。完成度 evaluator の再評価 (completeness-findings-r2.json) の差し戻しを受けてアシスタントが質問を起こし、推奨案に (推奨) を付けて提示した。 / 回答時刻: 2026-09-14T12:42:56Z)

### 承認: `appr-foundation-overview-001`

利用者が 2026-09-14 に AskUserQuestion『提示した上位概念 U1-U9 の案を、この内容で承認しますか?』で『承認する』を選択した (会話記録上の回答返却時刻 2026-09-14T11:38:48Z)。提示内容は直前のアシスタント発話 (2026-09-14T11:35:34Z) の U1-U9 表で、同日 11:33:34Z に利用者が選んだ4件 (集計範囲=総合+事業/家計の切替、既存要素=畳んで残す、状態の保存=D1に保存、信頼度=既存の判定根拠を統合) を反映していた。U4 の measure と C 番号・SH 番号は、承認された文言を検査方法の粒度へ具体化したもの。basis=user-decision。

#### この承認を名指ししている質疑: `qa-target-platforms-ov-001`

**問**

本サイクル (FINAL-UI 02 の概況を月次クローズの作業起点へ作り替える) の対象プラットフォームはどれか。対象外は理由を述べる。

**答**

web のみを対象とする。JTBD は『月初に取り込んだ後、概況を開いた瞬間に直近12か月でいくら残ったかと、何が未処理かを掴み、未処理を0まで迷わず進めたい』で、利用者は単独の個人事業主1名 (利用者兼保守者) と、実装を担うコーディングエージェントである。配信は Cloudflare Workers 上の React SPA 1系統のままとし、狭幅は既存のレスポンシブを維持して、右パネルはドロワーにする。スマートフォン・タブレット・デスクトップの専用アプリは上位概念 U7 の scope.out で対象外とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 対象ユーザーと JTBD は利用者の依頼文 (2026-09-14『design/FINAL-UI/images/02-overview.png を作るためのタスク仕様書。UI/UX とそれに伴うバックエンド等の改善をすべて反映』) に由来する。platform を web に限り専用アプリを scope.out とする点は、利用者が U1-U9 を『承認する』と回答した appr-foundation-overview-001 (会話記録上の回答返却時刻 2026-09-14T11:38:48Z) で確定した。 / 回答時刻: 2026-09-14T11:38:48Z)

#### この承認を名指ししている質疑: `qa-ui-ux-web-ov-decision-001`

**問**

概況の KPI の集計範囲はどうするか。02 の画像に無い既存要素 (防衛予測・移動平均・パレート・未決済・科目別年比較) はどう扱うか。

**答**

集計範囲は『総合 (事業+家計、重複除外) を既定にし、事業/家計へ切り替えられる』(代替: 総合のみ / 事業のみ)。既存要素は『畳んで残す』(代替: 画像どおりに削る / すべて表示したまま)。情報優先度の方針は次の順位で確定する: 第1層 = KPI 3枚・説明カード・月次クローズ n/4 (毎回読む・誤読の損失が大きい)、第2層 = 未処理カード3種・優先明細表・右パネル・固定アクションバー (未処理0が月次の完了条件)、第3層 = 推移・年次比較・支出内訳 (結論の検算と原因探し)、第4層 = 防衛予測・移動平均 (推移の切替で表示)・パレート (内訳の構成比表示で表示)・未決済・科目別年比較 (『詳しく見る』の開閉で表示、初期は閉じる)。集計範囲の切替は KPI・推移・年次比較・内訳の4要素へ同時に効き、未処理キューには効かない (未処理は範囲によらず全件が月次クローズの対象のため)。

> **解釈明確化 (`2026-09-14T23:43:59Z`)** — 上の第1〜4層は情報の重要度分類であり、DOM の物理順ではない。表示順は `system-spec/ui-ux.md#表示順の正本` と画像正本に従う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 第1〜4層の順位付けと、切替が未処理キューに効かない点は、選択を実装粒度へ具体化したもの (U1-U9 の G1/G2/G4 と同一内容で承認済み)。 / 回答時刻: 2026-09-14T11:33:34Z)

#### この承認を名指ししている質疑: `qa-backend-web-ov-decision-001`

**問**

推奨の仕訳の信頼度をどう出すか。未処理キューの優先順位と、月次クローズ4ステップの判定をどう定義するか。

**答**

信頼度は『既存の判定根拠を統合』(代替: 取引先の決め事だけ / AIで推定) — vendor_memory の一致率 → ルール → MF中項目 の順に根拠を探す。具体化: (1) vendor_memory が1件に一致すれば一致回数/(一致+不一致) を百分率 (四捨五入の整数) で出し『過去 N 件中 M 件で同じ手当て』を併記する、(2) それが無く大/中項目ルールが一致すれば根拠種別『ルール』を出し百分率は作らない、(3) それも無く MF中項目が『事業』で始まれば根拠種別『MF中項目』で事業区分だけを推奨する、(4) どれにも該当しなければ『推奨なし』を返す。同じ入力には同じ結果を返し、乱数・時刻・外部送信を使わない (O5)。未処理キューは 照合の確認 (事業と家計の二重計上の恐れ = 総額を歪める) → 仕分けの確認 → 取込の確認 の順に並べ、同じ種別の中は金額の絶対値の降順、同額は日付の新しい順とする。仕分けの確認は期間内の clsSrc=既定 の明細、照合の確認は totalCashflowReport の review、取込の確認は期間内の status=failed の取込である。月次クローズは対象月ごとに データ取込 (その月の取込が committed かつ未記録月でない)・仕分け (その月の仕分けの確認が0)・照合 (その月の照合の確認が0)・月次レビュー (monthly_close_reviews に行がある) の4つを判定し、保留中の明細は件数表示からは除くが仕分け・照合のステップ判定では未完了として数える (『後で確認』で締めたことにしない)。総合の総額は totalCashflowReport の月別値、事業は freee 側、家計は MF の家計側を使い、KPI・推移・年次比較・内訳は同じ月別系列から作る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 信頼度の4段の出し方、優先順位、ステップ判定、保留の数え方は、利用者の選択 (既存根拠の統合・総合+切替) と承認済み O2/O5・G3 を実装粒度へ具体化したもの。 / 回答時刻: 2026-09-14T11:33:34Z)

#### この承認を名指ししている質疑: `qa-database-web-ov-decision-001`

**問**

『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか。

**答**

『D1に保存』(代替: ブラウザ保存 / 保存しない)。保留と月次レビュー完了は D1 の新しい2テーブル (review_snoozes・monthly_close_reviews) に保存し、夜間バックアップ (R2 の backups/YYYY-MM-DD.json) と JSON export の対象へ加え、POST /api/restore で書き戻す。バックアップ→全消去→復元の往復で行が一致することを API テストで保証する (O3)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 テーブル名とバックアップ経路は承認済み U8 scope.in (D1 migration・バックアップ対象への追加) の具体化。 / 回答時刻: 2026-09-14T11:33:34Z)

#### この承認を名指ししている質疑: `qa-frontend-web-ov-decision-001`

**問**

02 に無い既存の概況要素を画面上でどう残すか。

**答**

『畳んで残す』(代替: 画像どおりに削る / すべて表示したまま)。移動平均は推移グラフの表示切替 (初期は非表示)、パレートは支出内訳の『構成比』表示の中に置き、防衛予測・未決済・科目別年比較は本文末の『詳しく見る』(ネイティブ <details>、初期は閉じる) に入れる。既存の DefenseForecastPanel・UnsettledPanel は中身を変えずに移し、defense-forecast.dom.test.tsx の描画検査は開いた状態で通るようにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion の4問 (集計範囲・既存要素・状態の保存・信頼度) に回答した (会話記録上の回答返却時刻 2026-09-14T11:33:34Z)。回答は上位概念の承認 appr-foundation-overview-001 (11:38:48Z) にも反映済み。 各要素の置き場所は承認済み G4・I2・I7 の文言 (移動平均は切替で残す、パレートは構成比表示で残す) の具体化。 / 回答時刻: 2026-09-14T11:33:34Z)

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| dec-review-state-storage | 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか | confirmed | d1:D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '既存の D1 データベース kanjo-db に行を足すだけで、新しい有償サービスを契約しない', 'tco': '追加費用 0。保守は migration 1本、BACKUP_SNAPSHOT_SQL と restore の追従、O3 の往復テスト'} / free=既存の D1 利用枠内。行数は明細数と月数に比例し、利用者1名では小さい / fit=G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない / pros=端末・ブラウザを替えても状態が同じ, 夜間バックアップと復元で判断が失われない, サイドバー・カード・アクションバーの件数をサーバの同じ計算で揃えられる / cons=migration・schema-guard 定数・schema.ts・バックアップ・restore の5か所を同じ変更で揃える必要がある / risks=D1 migration に rollback が無く、誤った定義は前進の修正 migration で直すしかない / lock-in=低い。Cloudflare D1 は SQLite 互換で、2テーブルは平易な主キー付きの表 / ops=deploy.yml の自動 migration 判定に乗る CREATE TABLE のみで、手順は増えない / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>browser:ブラウザの localStorage に保存する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': 'サーバ側の変更が無い', 'tco': '追加費用 0。保守はクライアントのキー設計だけ'} / free=ブラウザごとの保存容量の範囲 / fit=G2 の件数一致は1つのブラウザ内なら満たせるが、G3 の『バックアップと復元でも保つ』を満たせない / pros=migration もバックアップの変更も要らない / cons=別の端末・ブラウザでは保留と月次レビュー完了が見えない, 夜間バックアップと復元の対象外になる / risks=サイト データの消去で月次クローズの記録が失われる / lock-in=なし / ops=なし / evidence=https://html.spec.whatwg.org/multipage/webstorage.html<br>none:保存しない (その場の表示だけ) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '何も追加しない', 'tco': '追加費用 0'} / free=該当なし / fit=G3 の月次レビュー完了を記録できず、月次クローズ4/4 に到達できない / pros=実装が最小 / cons=再読込で『後で確認』が戻り、件数が3か所で一致しても次に開くと増える, 月次レビューの完了を判定できない / risks=未処理0 を締めの条件にできず、U1 の本質的目的を満たさない / lock-in=なし / ops=なし / evidence=https://developers.cloudflare.com/d1/reference/migrations/ | d1 — G3 がバックアップと復元での保持を要求し、ブラウザ保存と保存しない案はそれを満たせない。D1 案は既存の migration 自動適用・夜間バックアップ・認証の内側に収まり、追加費用も運用手順も増えない。 (注意: D1 migration には rollback が無い (公式 migrations ページに create/list/apply の記述だけ)。定義の誤りは前進の修正 migration で直す, BACKUP_SNAPSHOT_SQL は明示列挙で、テーブルを足しても自動ではバックアップに入らない。O3 の往復テストで漏れを止める, 本記録は利用者の選択後に正規 writer で残したもの。比較の根拠 (D1 公式ページ) の確認時刻は選択より後の 2026-09-14T11:49:44Z である, 2026-09-14T11:18:42Z の AskUserQuestion で本推奨に (Recommended) を付けて先に提示しており、推奨が選択に影響した可能性を否定しない。; confidence=high; checked=2026-09-14T11:49:44Z) | d1 @ 2026-09-14T11:33:34Z | G2, G3 |
| dec-overview-aggregation-scope | 概況の総収入・総支出・純収支、推移、年次比較、支出の内訳を、どの範囲で集計するか | confirmed | total-with-toggle:総合 (事業+家計、重複除外) を既定にし、事業/家計へ切り替えられる / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '既存の totalCashflowReport と freee・MF 家計側の集計を使い、有償サービスを足さない', 'tco': '追加費用 0。保守は切替の状態と4要素への同時反映'} / free=該当なし (外部サービスを使わない) / fit=G1 の『総合/事業/家計の総収入・総支出・純収支と前12か月比』をそのまま満たす / pros=02 の注記『銀行・カード・その他サービスの取込データに基づく集計』と一致する, 事業だけ・家計だけの確認も同じ画面で行える / cons=切替の状態を KPI・推移・年次比較・内訳の4要素へ同時に効かせる実装が要る / risks=範囲の切替が未処理キューにも効くと誤解される (qa-ui-ux-web-ov-decision-001 で効かないと確定) / lock-in=なし / ops=切替 UI 1つ。APG の radio group (矢印キーで選択) で作れる / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/radio/<br>total-only:総合だけを表示し、切替を付けない / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '同上', 'tco': '追加費用 0。切替の実装が無いぶん最小'} / free=該当なし / fit=G1 の事業/家計別の表示を満たせない / pros=UI が最も単純 / cons=内訳が事業科目と家計大項目の混在になり、原因探しがしにくい / risks=事業だけの利益を見たいときに別画面へ移る必要がある / lock-in=なし / ops=なし / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/radio/<br>business-only:今の概況と同じく freee の事業だけを集計する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '現行のまま', 'tco': '追加費用 0'} / free=該当なし / fit=G1 の総合 (事業+家計) を満たせず、U2 の背景『事業+家計の総収入が無い』が残る / pros=現行の GET /api/summary をほぼ流用できる / cons=家計の支出が概況に現れない / risks=家計側の未処理と総額が月次クローズの判断から漏れる / lock-in=なし / ops=なし / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/radio/ | total-with-toggle — G1 が総合・事業・家計の3範囲を最上位に出すことを求め、切替なしの2案はどちらかを欠く。追加費用はどの案も 0 で、差は切替 UI 1つの実装だけである。 (注意: 2026-09-14T11:18:42Z の AskUserQuestion で本推奨に (Recommended) を付けて先に提示しており、推奨が選択に影響した可能性を否定しない。, 比較根拠の公式ページの確認時刻 (2026-09-14T12:16:39Z) は利用者の選択 (2026-09-14T11:33:34Z) より後で、選択時点の比較は同じ内容を出典なしで述べたものだった。, 切替は KPI・推移・年次比較・内訳の4要素に同時に効き、未処理キューには効かない (qa-ui-ux-web-ov-decision-001)。; confidence=high; checked=2026-09-14T12:16:39Z) | total-with-toggle @ 2026-09-14T11:33:34Z | G1 |
| dec-overview-legacy-elements | 02 の画像に無い既存要素 (防衛予測・移動平均・パレート・未決済・科目別年比較) を概況でどう扱うか | confirmed | fold-and-keep:畳んで残す (防衛予測は注意・警告の見込みがあるときだけ KPI の上に出し、移動平均は推移の切替、パレートは構成比表示、未決済・科目別年比較は <details>『詳しく見る』) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '既存の DefenseForecastPanel は表示条件ごと KPI の上へ、UnsettledPanel は『詳しく見る』へ、中身を変えずに移す', 'tco': '追加費用 0。保守は開閉つきの描画検査'} / free=該当なし / fit=G4 の『02 のレイアウトで実装し、既存要素は段階的開示で残す』をそのまま満たす / pros=FUNCTION-MATRIX が 02 の必須機能に挙げる防衛予測・移動平均・Pareto を落とさない, 平常時の初期表示は画像どおりの構成になり、防衛ライン割れの事前警告は開かずに見える / cons=注意・警告時は画像に無い通知が KPI の上に1つ増える / risks=閉じた中身は見落とされやすい (APG disclosure の aria-expanded で状態を伝える) / lock-in=なし / ops=開閉1つ。ネイティブ <details> は disclosure パターンの状態を自前で持たずに済む / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/<br>remove:画像どおりに削り、他画面への導線だけ残す / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '削除のみ', 'tco': '追加費用 0'} / free=該当なし / fit=G4 の段階的開示に反し、FUNCTION-MATRIX の必須機能を概況から失う / pros=画面が最も短い / cons=防衛ラインの事前警告を概況で見られなくなる / risks=既存の DOM テストと利用者の確認経路が失われる / lock-in=なし / ops=なし / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/<br>show-all:画像の要素を足し、既存要素も常時表示する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '追加のみ', 'tco': '追加費用 0'} / free=該当なし / fit=G4 の機能は保つが、U1 の『開いた瞬間に結論と次に直すこと』が縦に長い画面に埋もれる / pros=操作なしですべて見える / cons=狭幅で縦に非常に長くなる / risks=320px 幅で表と図が並び、WCAG 1.4.10 の2方向スクロールを避けにくい / lock-in=なし / ops=なし / evidence=https://www.w3.org/WAI/WCAG22/Understanding/reflow.html | fold-and-keep — U1 の結論先行と G4 の既存機能の維持を両立するのは段階的開示だけで、削る案は必須機能を、常時表示は結論の見つけやすさと狭幅の読みやすさを失う。 (注意: 2026-09-14T11:18:42Z の AskUserQuestion で本推奨に (Recommended) を付けて先に提示しており、推奨が選択に影響した可能性を否定しない。, 比較根拠の公式ページの確認 (2026-09-14T12:16:39Z) は、利用者が最初に『畳んで残す』を選んだ時刻 (2026-09-14T11:33:34Z, qa-frontend-web-ov-decision-001) より後で、防衛予測の置き場所を確定した時刻 (2026-09-14T12:42:56Z) より前である。, 2026-09-14T12:42:56Z の聞き直しでも『警告時だけ上部』に (推奨) を付けて先に提示した。, 一度は具体化の段階で防衛予測を『詳しく見る』に入れる記録にしたが (qa-defense-forecast-placement-ov-clarify-001)、利用者の確認を経ていなかったため聞き直し、選択肢説明どおり警告時だけ上部に出すと確定した (qa-defense-forecast-placement-ov-decision-001)。; confidence=high; checked=2026-09-14T12:16:39Z) | fold-and-keep @ 2026-09-14T12:42:56Z | G4 |
| dec-recommendation-confidence-source | 右パネルの推奨科目と信頼度を何を根拠に出すか | confirmed | integrate-existing:既存の判定根拠を統合 (vendor_memory の一致率 → ルール → MF中項目、どれも無ければ推奨なし) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '既存データと packages/core の純関数だけで計算する', 'tco': '追加費用 0。保守は根拠種別ごとの単体テスト (O5)'} / free=該当なし (外部サービスを使わない) / fit=G2 の『根拠種別付きの推奨科目と信頼度』を満たし、O5 の決定論を検査できる / pros=同じ入力に同じ結果を返す, 根拠の種類を画面に示せる, 外部送信なしの約束と矛盾しない / cons=ルールと MF中項目では百分率を作れず、根拠種別だけの表示になる / risks=vendor_memory の件数が少ない取引先では一致率が不安定 (件数を併記して読み違いを防ぐ) / lock-in=なし / ops=なし / evidence=https://www.w3.org/TR/CSP3/<br>vendor-memory-only:取引先の決め事 (vendor_memory) がある明細だけ推奨と信頼度を出す / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'notes': '同上', 'tco': '追加費用 0。最小の実装'} / free=該当なし / fit=G2 の推奨は出せるが、vendor_memory の無い明細は常に推奨なしになり、既存のルールと MF中項目の根拠を捨てる / pros=実装が最も単純 / cons=推奨が出る明細が少ない / risks=利用者が根拠のあるルール一致の明細まで手で判断することになる / lock-in=なし / ops=なし / evidence=https://www.w3.org/TR/CSP3/<br>ai-estimate:Cloudflare Workers AI の LLM に明細を渡して科目と確度を推定する / cost={'category': 'low-cost', 'amount': 0.011, 'currency': 'USD', 'billing_period': 'per-1000-neurons (無料枠超過分)', 'notes': 'Workers AI は 1日 10,000 Neurons まで無料、超過分は 1,000 Neurons あたり $0.011 (Workers 有料プランが前提)', 'tco': '少量なら無料枠内だが、Workers 有料プランの月額と、モデル更新に伴う結果の変化を検証する保守が加わる'} / free=1日 10,000 Neurons / fit=G2 の推奨は出せるが、同じ入力で同じ結果を保証できず O5 の決定論を満たせない / pros=ルールや履歴の無い明細にも候補を出せる / cons=決定論でなく、根拠を説明しにくい / risks=取引データの外部送信の約束と衝突する / lock-in=中 (Workers AI のモデルと API に依存) / ops=モデル更新時の回帰確認が要る / evidence=https://developers.cloudflare.com/workers-ai/platform/pricing/, https://www.w3.org/TR/CSP3/ | integrate-existing — O5 の決定論と C2 の外部送信なしを満たすのは既存根拠を使う2案だけで、そのうち integrate-existing は既存のルールと MF中項目も根拠に使うので推奨が出る明細が多い。 (注意: 2026-09-14T11:18:42Z の AskUserQuestion で本推奨に (Recommended) を付けて先に提示しており、推奨が選択に影響した可能性を否定しない。, 比較根拠の公式ページの確認時刻 (2026-09-14T12:16:39Z) は利用者の選択 (2026-09-14T11:33:34Z) より後で、選択時点の比較は同じ内容を出典なしで述べたものだった。, ai-estimate は U8 scope.out で本サイクルの対象外であり、費用の比較は参考として示した。利用者に提示した選択肢は『AIで推定 (LLM に明細を渡す)』で基盤を指定しておらず、既存構成 (C1) に最も近い Workers AI を代表として費用を記した。; confidence=high; checked=2026-09-14T12:16:39Z) | integrate-existing @ 2026-09-14T11:33:34Z | G2 |
