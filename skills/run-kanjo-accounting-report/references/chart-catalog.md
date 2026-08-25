# 図表カタログ — 図・必要データ・切り口・検査の対応表(第3版)

図はアプリが描く。AI は **どの図に何を読み取ったか(`catalogId` + `caption`)** だけを送る。数値・ラベル・系列を送ると検査で落ちる。
機械可読の正本は `chart-catalog.json`(`pnpm catalog:export` が `packages/api/src/ai/catalog.ts` と `contract.ts` から生成。手で編集しない。`packages/api/src/ai/catalog.test.ts` が同期を検査する)。

## 1. 毎回同じ8枚(番号固定)

レポートの図は常にこの8枚で、番号も固定。出せない図も枠を残し「この図はあと◯ヶ月分のデータで表示できます」と理由を表示する(画面側 `ReportChart.tsx`)。

| 図 | `catalogId` | 形 | 目的 | 出せる条件(`minMonths`) | 型 |
|---|---|---|---|---|---|
| 図1 | `trend_ma` | 折れ線(売上・経費・3ヶ月移動平均) | 経費の水準が上がっているか下がっているかを、月ごとのブレをならして見る | 記帳済み6ヶ月以上 | 月次/年次/長期 |
| 図2 | `composition` | 横棒(構成比 %) | どの科目が経費の大半を占めるかを一目で見る | 対象期間に経費1円以上 | 月次/年次/長期 |
| 図3 | `contribution` | ウォーターフォール(寄与度) | 前期からの増減を科目ごとの押し上げ/押し下げに分ける | 対象期間と直前の同じ長さの期間の両方に記帳月がある | 月次/年次/長期 |
| 図4 | `distribution` | 帯(平均±2σ) | 経費が「いつもの範囲」に収まっているか、飛び抜けた月がないかを見る | 記帳済み6ヶ月以上 | 月次/年次/長期 |
| 図5 | `yoy` | 柱2本(対象期間 vs 前年同月) | 季節性か今年だけの増加かを切り分ける | 前年同月が記帳済み(13ヶ月) | 月次/年次のみ(長期は図1) |
| 図6 | `fixed_variable_bep` | 積み上げ柱+売上線+損益分岐点線 | 売上がどこまで落ちても赤字にならないか(安全余裕)を見る | 記帳済み6ヶ月以上かつ売上のある月3ヶ月以上 | 月次/年次/長期 |
| 図7 | `pareto` | パレート(柱+累積線) | 少数の科目が大半を占めるかを確かめ、見直す順番を決める | 金額のある科目が3つ以上 | 月次/年次/長期 |
| 図8 | `subs_vendor` | 積み上げ柱(支払先別) | サブスクの合計と、どの支払先が増えているかを見る | サブスク支払先が1件以上登録され期間内に支払いがある | 月次/年次/長期 |

読み方(`readingGuide`)は各図の下に画面が出す。AI の `caption` は「この図から何が言えるか」だけを書く(読み方の再掲は不要)。

## 2. 図 ↔ 必要データ ↔ 切り口 の 1:1 対応(要望25a・25補足)

`GET /api/ai/data` の応答は下表の `requiredData` をすべて含む。図が出せないときは `charts[].status` で「元データが無い」と「アプリの不備」を区別する(§4)。

| 図 | `requiredData`(GET 応答のキー) | 切り口(`axes`) | 集計はどこで |
|---|---|---|---|
| 図1 | `biz.revenue` `biz.expenseTotal` `stats.expenseMovingAvg3` `unrecordedExpenseMonths` | 期間(対象期間の前12ヶ月〜終了月)/ 区分(事業) | アプリ(移動平均は `stats`) |
| 図2 | `summary.current.expenseByAccount` `summary.current.expense` | 項目(freee勘定科目)/ 期間(対象期間) | アプリ(上位8科目+その他、構成比) |
| 図3 | `summary.previous.expenseByAccount` `summary.current.expenseByAccount` | 項目(freee勘定科目)/ 期間(前期→対象期間) | アプリ(科目別差分、合計は前期・当期の経費に一致) |
| 図4 | `biz.expenseTotal` `unrecordedExpenseMonths` `stats.recordedMonths` | 期間(前12ヶ月〜終了月)/ 区分(事業) | アプリ(平均・標準偏差は記帳月だけで計算) |
| 図5 | `biz.expenseTotal` `summary.yearAgo.months` `unrecordedExpenseMonths` | 期間(対象期間 vs 前年同期)/ 区分(事業) | アプリ |
| 図6 | `biz.expenseByAccount` `stats.accountProfiles.*.type` `biz.revenue` `pl.breakEven.monthly` `pl.breakEven.available` | 区分(固定費/変動費)/ 期間(前12ヶ月〜終了月) | アプリ(固定費=CV<0.6 の科目) |
| 図7 | `summary.current.expenseByAccount` | 項目(freee勘定科目)/ 期間(対象期間) | アプリ(降順・累積構成比) |
| 図8 | `subscriptions.vendors` `subscriptions.other` | 項目(サブスク登録ベンダー)/ 期間(前12ヶ月〜終了月) | アプリ(上位8ベンダー+その他) |

### 切り口の一覧(`axes` キー。ここに無い軸は作らない)

| 軸 | キー | 使える値 | 使えないときの扱い |
|---|---|---|---|
| 項目・分類 | `axes.category.bizAccounts[]`(名前・型・期間合計・データ範囲)/ `axes.category.personalBig`(effective=手修正込み / imported=取込値) | freee 勘定科目、MF 大項目 | 科目の型は記帳6ヶ月未満で `判定不能` |
| 区分 | `axes.segment.bizPersonal` / `owner`(self/spouse/unset)/ `fixedVariable` / `settlement` | 事業/個人、本人/妻/未設定、固定費/変動費 | `fixedVariable.available=false`(6ヶ月未満)、`settlement.available=false`(決済状況は取込データに無い。**常に使えない**) |
| 期間 | `axes.period.requested` / `presets[]`(`month` 直近月 / `quarter` 直近四半期 / `year13` 直近13ヶ月 / `year5` 直近5年)/ `previous` / `yearAgo` / `dataRange` | 各プリセットの `availableMonths` `recordedMonths` | 0 ヶ月のプリセットは本文で使わない |
| 指標 | `axes.indicator[]`(`expenseRatio` 経費率 / `subsShare` サブスク対売上比 / `safetyMargin` 安全余裕率 / `saveRate` 貯蓄率 / `foodShare` 食費比率 / `telecomShare` 通信費比率 / `breakEven` 損益分岐点 / `fixedShare` 固定費比率) | `value` `basis`(計算式)`guide`(目安)`judge` | `judge='データ不足'` の指標は数字を書かない |

## 3. 粒度(要望25c)

- 図1・4・6・8 の期間は「対象期間の終了月から遡って最大 **36ヶ月**(`monthlyLimit`)」まで月次。それを超える期間は**四半期**(`YYYY-Qn`)にまとめる(`granularity: 'quarter'`。画面に「四半期ごと」と表示)。
- 図5(前年同月)は長期(14ヶ月以上)では出さない(図1 で見る)。
- 系列は最大 8 本(`maxSeries`)。上位8科目/ベンダー以外は「その他」。

## 4. 出せない図の理由(要望25d)

| `status` | 意味 | レポートでの扱い |
|---|---|---|
| `ok` | 出せた | `caption` を付け、本文で「図N」と参照する(必須) |
| `source_missing` | 元データが足りない(`reason` に理由、`monthsNeeded` にあと何ヶ月) | 本文で参照しない。必要なら `dataGaps` に「図N はあと◯ヶ月分で出せる」と1行 |
| `app_missing` | データはあるのにアプリ側で計算できなかった(不具合) | 本文で参照しない。`dataGaps` に「図N がアプリ側の不備で出せなかった」と書く(利用者が開発者へ伝えられるように) |

`coverage[]`(GET 応答)に図ごとの `status` と `detail` が並ぶ。

## 5. 送信する形と検査(`validate-report.py` / アプリの `normalizeReport`)

```json
"charts": [
  { "catalogId": "composition", "caption": "外注費が全体の41%を占め、家賃と合わせて7割に達している" },
  { "catalogId": "contribution", "caption": "前期比 +38,000円 のうち外注費の増加が +52,000円 で、他科目の減少を打ち消している" }
]
```

| 規則 | 落ちる例 |
|---|---|
| `catalogId` はカタログの id だけ | `pie_chart` など |
| `caption` 15〜400字、`available=true` の図には必須 | 空・「上昇」だけ |
| `available=true` の図は `summary` か各節 `body` で「図N」と参照する | 図2 が出せるのに本文のどこにも「図2」が無い |
| `available=false` / 存在しない番号を参照しない | 「図9」「図5(長期で出せない)」 |
| 数値・`labels`・`series`・`kind` を送らない(手元の検査で拒否、アプリは無視) | 第2版形式のまま送る |
| 同じ `catalogId` を2回送らない | — |

`--data <GET応答の保存JSON>` を渡すと available との照合まで手元で行える。渡さない場合は id・字数だけ検査し、available 照合はアプリの保存時検査に委ねる。
