# サブスク画面の規則

`/subscriptions` (整える > サブスク) が使う計算規則・定型文・部品の実行契約。利用者意図の正本は
`system-spec/00-requirements-definition.md`、画面の再現仕様は `specs/spec-subscriptions-screen.md`、
実行される数値規則の正本は `packages/core/src/subs-screen.ts` の `subscriptionsScreen`。
`architecture/`・`tasks/`・`.dev-graph/` は投影であり、独立した第二の正本として扱わない。
**規則を変えるときは core・テスト・本書を同時に直す。**

規則を変えると落ちるテストは次の 3 本にある。

| テスト | 何を固定するか |
|---|---|
| `packages/core/test/subs-screen-contract.test.ts` | §13.3 の検算済み fixture (KPI・一覧・推移・比較・カバー率・詳細) と、見直し候補 5 規則・年額払い・継続中・指紋・カテゴリの境界値 |
| `packages/api/src/subs-screen.integration.test.ts` | `GET /api/subscriptions` と `GET /api/subscriptions/vendors/:key`、更新 4 経路の 200・400・401・404・409、所有者での絞込、サイドバーのバッジとの件数一致 |
| `packages/web/src/subscriptions-screen.dom.test.tsx` | 画面の構成要素・8 列・ロゴ 0 件・URL の `vendor`・3 タブ・選択中バー・読込/空/失敗 |

## この画面が答えること

「毎月の固定費に、重複や見直し候補はありますか？」。銀行・カード・電子マネーの明細から継続的な支払いを
ベンダー単位にまとめ、推定月額・年換算・カテゴリ別の推移と比較を出し、見直す理由のある契約を
規則の定型文つきで 1 件ずつ判断 (確認・除外) できるようにする。

## 正本の分担

| 何の正本か | 正本 |
|---|---|
| 構成・文言・配置 | 画像 `design/FINAL-UI/images/09-subscriptions.png` |
| 数値 (金額・件数・割合) | core `subscriptionsScreen` が算出する検算済み fixture (spec §13.3)。画像の数値は期待値に写さない |
| 定義 (推定月額・継続中・候補規則・カバー率・カテゴリ) | `system-spec/` 各章と本書 |
| 画像と system-spec が食い違う箇所 | system-spec (下の D1〜D13) |

## 要件表 (受入 19 項目と検証手段)

| # | 受入条件 (spec §15.1) | 検証手段 |
|---|---|---|
| 1 | 見出し「サブスク」・問い・説明文 (「見直しで」) | web `見出し・問い・説明文が出る` |
| 2 | KPI 5 枚のラベル、1・2 枚目に前期間比 (差額・率・矢印)、4 枚目の補足が「売上に占める割合」 | web `KPI 5 枚と前期間比` |
| 3 | fixture で KPI = 9,778 / 117,336 / 114,856 / 5.4% / 2 件、前期間比 +¥248 (+2.6%) / +¥2,976 (+2.6%) | core `KPI は fixture の検算値と一致する` |
| 4 | カバー率 97% (3/3) / 100% (2/2) / 92% (1/2)、「最終更新」と「再取得」 | core `カバー率は口座×月の割合と最新月までの口座数` / web `カバー率と再取得` |
| 5 | 一覧 8 列、合計行 = 行の和 (¥9,778 / ¥117,336)、検索と 4 択の絞込 | core `一覧の推定月額の和 = 合計行 = KPI` / web `8 列・合計行・検索・絞込` |
| 6 | ロゴ画像要素 (`img`・背景画像・頭文字の図形) が 0 件 | web `ロゴ画像要素が 0 件` / `check-financial-visuals.mjs` |
| 7 | 行選択で `?vendor=`、3 タブの詳細、再読込で復元、× で閉じて URL から消える | web `行を選ぶと URL に vendor が付き詳細が開く` |
| 8 | 詳細パネルの各要素 | core `Spotify の詳細` / web `詳細パネルの概要タブ` |
| 9 | 生の取引名 2 件で下部バー、統合で `POST /api/sub-vendors/:id/aliases`、解除で戻る | web `2 件チェックで選択中バーが出て統合 API を呼ぶ` |
| 10 | 推移の棒が期間の月数、凡例、棒の和 = 114,856 | core `推移の棒の和 = 直近12か月の支払額` / web `推移の棒と凡例` |
| 11 | 年換算比較が fixture どおり、合計 = 一覧合計 = KPI 1 枚目 | core `年換算比較は月額の降順で fixture と一致する` |
| 12 | 検出理由カードは選択中または最優先の候補を1件表示し、残りは「他N件」から未判断の一覧へ到達できる | core `見直し候補の並び` / web `最優先の1件を代表表示し、残りは既存の候補絞り込みへ渡す` |
| 13 | confirmed の保存、バッジ「確認済み」、KPI 5 枚目とサイドバーが 1 減る、取消で戻る | api `確認するとサイドバーのバッジと KPI が 1 減り、取消で戻る` |
| 14 | dismissed が指紋つきで保存され候補が消える、指紋が変わると再び出る | core 指紋の境界値 / api `除外は指紋つきで保存される` |
| 15 | 未登録の候補の採用 `POST /api/sub-vendors`、除外 `POST /api/sub-vendors/exclusions` | web `未登録の候補を採用・除外する` |
| 16 | 別名・対象科目・四半期見直しが関連データタブで行え、dup / spike が検出理由カードに出る | web `関連データタブ` / core `二重請求・急増` / 下の「旧 UI から移した操作」 |
| 17 | 読込・空・失敗の状態 | web `読込中・空・失敗` |
| 18 | migration 0043 が追加だけで適用でき、schema.ts と一致 | api `schema-guard` / `deletion-schema.test.ts` |
| 19 | 他人の `:id` / `:key` は 404、未ログインは 401、パスワード変更前は fence | api `他人のベンダー・判断は 404` / `未ログインは 401` |

## 数値の定義

| 規則 | 定義 | 境界 | 固定するテスト |
|---|---|---|---|
| 明細の出所 | `buildExpenseProjection(all, deals).effectiveExpenses` (freee と、freee と照合されていない MF の支出)。照合は 1 回だけ計算する | MF の現金・計算対象外・振替・入金は入らない | `照合済みの MF は二重に数えない` |
| 期間 | 画面の期間 (`from`〜`to`) に入る明細だけを使う。前期間は `previousPeriod` (直前の同じ長さ)。全期間では前期間を作らない | 前期間の値が無ければ前期間比は null | `全期間では前期間比を作らない` |
| 登録済みのベンダー | `sub_vendors` の名前・別名・対象科目で照合 (`registeredVendorOf`。`matchSubVendor` と同じ規則) | 対象科目を指定したベンダーは、その科目の明細だけ | `対象科目の外の明細は数えない` |
| 推定月額 | 期間の最終月以前の最新の支払月の支払額。年額払いは ÷12 して円に丸める | — | `推定月額は最新の支払月の額` |
| 年額払い | 最新と 1 つ前の支払月の間隔が 11〜13 か月 | 10・14 か月は月払い扱い | `年額払い: 間隔 11/12/13 は年額、10/14 は月払い` |
| 継続中 | 月払い: 最新の支払月が期間の最終月か前月。年額払い: 最新の支払月が期間の最終月から 11 か月以内 | 月払いで 2 か月前が最後なら継続中でない | `継続中の境界` |
| 月額のサブスク合計 (KPI 1) | 登録済みかつ継続中の行の推定月額の和 (U-2)。前期間も同じ関数で求める | 未登録の候補は含めない | `KPI は fixture の検算値と一致する` |
| 年換算 (KPI 2) | 月額 × 12 | — | 同上 |
| 直近12か月の支払額 (KPI 3) | 期間で切った Dataset に既存 `subscriptions()` を通した `now.last12Total` | 既存関数と一致する | `last12Total と revenueShare は既存 subscriptions() と一致する` |
| 売上比 (KPI 4) | 同じく `now.revenueShare` (直近 3 か月の月合計の平均 ÷ 売上のある月の平均売上) | 売上が無ければ null (「—」) | 同上 |
| 見直し候補 (KPI 5) | 未判断 (`pending`) の見直し候補の件数。未登録の候補で規則に当たるものも含む | confirmed と指紋一致の dismissed は数えない | `見直し候補は 2 件` |
| 前期間比の表記 | 「+¥N (+P%)」↑ /「-¥N (-P%)」↓ /「±¥0 (±0.0%)」矢印なし。率は小数 1 桁。前期間が 0 なら率は「—」 | 色だけで増減を区別しない | web `前期間比の表記` |
| 並び順 (一覧) | 未判断 → 確認済み → その他、各群の中は推定月額の降順 (U-15) | 同額は正規化名の昇順 | `一覧の並び順` |
| ソース数 | マッチした生の取引名 (明細の取引先の原文) の種類数 (U-6) | — | `Spotify の詳細` |
| ベンダー名 | 最も多く現れた生の取引名。同数なら先に現れたもの (U-6) | — | 同上 |

## カバー率

| 規則 | 定義 | 境界 |
|---|---|---|
| 口座 | 期間内の MF 明細の口座名 (`inst`) と freee 取引の決済口座 (`settleAccount`)。現金は数えない。入金・振替・計算対象外の明細も「取込まれている」証拠として数える | 口座名が空の明細は数えない |
| 区分 | `accountKindOf(口座名)` で カード → 銀行 → 電子マネー → 分類できない の順に判定。保存せず毎回導く | 下の語彙 |
| % | 区分の (口座 × 期間の月) のうち、明細が 1 件以上ある割合。表示は整数に丸める | 口座 0 件は「— (0/0)」 |
| (分子/分母) | 期間の最終月に明細がある口座数 / その区分の口座数 | — |
| 分類できない口座 | 3 区分に入れず件数だけを出す | 0 件のときは出さない |

口座名の手がかり語彙 (U-7。`packages/core/src/cash.ts`。NFKC と大文字化の後の部分一致):

| 区分 | 手がかり |
|---|---|
| カード (`CARD_HINTS`) | カード / ｶｰﾄﾞ / CARD / クレジット |
| 銀行 (`BANK_HINTS`) | 銀行 / 信金 / 信用金庫 / 信用組合 / 労働金庫 / 労金 / 農協 / JAバンク / ゆうちょ / BANK |
| 電子マネー (`EMONEY_HINTS`) | 電子マネー / SUICA / PASMO / ICOCA / NANACO / WAON / EDY / PAYPAY / LINE PAY / メルペイ / AU PAY / D払い / 楽天ペイ / ファミペイ / KYASH / モバイルSUICA |

カードを先に判定するのは「〇〇銀行カード」を銀行ではなくカードに数えるため (カードの利用明細として取込まれるため)。

## カテゴリ

| 規則 | 定義 |
|---|---|
| 解決の順 | `sub_vendors.category` (利用者の上書き) → 既定辞書 → 「その他」 |
| 既定辞書 | 正規化名 (`vendorKey`) の部分一致を上から順に引く。先に書いたものを優先する |
| 上書きの入力 | 既定辞書のカテゴリ名、または 1〜20 文字の自由入力 |
| 一覧と比較表 | 同じ解決結果を使う (D11) |

既定辞書 (`SUBS_CATEGORY_DICTIONARY`、上から順):

| キー (vendorKey の部分一致) | カテゴリ |
|---|---|
| primevideo | エンタメ |
| aws / amazonwebservices | クラウド |
| netflix / spotify / youtube / disney / hulu / unext / dazn / abema / applemusic / niconico | エンタメ |
| amazon | ショッピング |
| googleone / icloud / dropbox / onedrive / box | クラウド |
| notion / slack / zoom / microsoft365 / chatgpt / openai / github / chatwork / evernote | 仕事効率化 |
| adobe / canva / figma | クリエイティブ |
| 1password / norton / mcafee / bitwarden / nordvpn | セキュリティ |
| newspicks / nikkei / 日経 | ニュース |
| docomo / softbank / ahamo / povo / 楽天モバイル / au | 通信 |

`au` は 2 文字で誤一致しやすいため、正規化名の**完全一致**だけで当てる (部分一致にしない)。
「楽天」はモバイル・ペイ・カード・市場など業種が散るため辞書に入れない (楽天モバイルだけを通信に当てる)。

## 見直し候補の規則 (表示順)

| 規則 (rule) | 判定 | 基準金額 (指紋に入る) | 定型文 (U-11) |
|---|---|---|---|
| 二重請求 (`dup`) | 期間の月別支払額のうち、非ゼロ月の中央値 med に対し v ≥ med×1.8 かつ v > 20,000 かつ med > 5,000 の月がある (最新の該当月を採る) | 推定月額 | 「{YYYY年M月}の支払い ¥{金額} が通常 (¥{中央値}) の {倍率} 倍です。二重請求の可能性があります。」 |
| 急増 (`spike`) | dup に当たらず v ≥ med×3 かつ v > 15,000 の月がある | 推定月額 | 「{YYYY年M月}の支払い ¥{金額} が通常の {倍率} 倍に増えています。」 |
| 値上げ (`priceUp`) | 支払月の並びで、直前の支払額より 5% 以上高い支払いが 2 回続く (a[i]×100 ≥ a[i−1]×105、かつ a[i+1] が同じ閾値以上)。最新の該当を採り、値上げ月が期間内であること | 推定月額 | 「{YYYY年M月}から ¥{旧金額} → ¥{新金額} (+{率}%) に値上がりし、{月数}か月続いています。」 |
| 重複 (`overlap`) | 登録済みかつ継続中で、同じカテゴリ (「その他」を除く) の行が 2 件以上 | 推定月額 | 「同じカテゴリ「{カテゴリ}」に継続中のサブスクが {件数} 件あります (月額合計 ¥{合計})。」 |
| 期限切れ (`reviewDue`) | 登録済みかつ継続中で、`subsReviewStatus` の `due` (最後の見直しから 3 か月以上、または未見直し)。判定日は**期間の最終月** (今日ではない) | 推定月額 | 「最後の見直しから {月数} か月たっています。」/ 未見直し「まだ一度も見直していません。」 |

- 倍率は小数 1 桁、率は小数 1 桁、金額は桁区切りの整数。値上げの月数は値上げ後の額が続いた回数。
- 未登録の候補は `dup`・`spike`・`priceUp` だけを判定する (重複・期限切れは登録済みの概念)。
  当たれば未判断の候補 (`pending`)、当たらなければ一覧のバッジ「未登録」(U-1) の行として出す。
- 指紋 (`fingerprint`) = `{当たった規則を表示順に + で連結}:{推定月額}`。月は含めない。
- 判断: `confirmed` は規則に当たっている限り「確認済み」。`dismissed` は指紋が一致する間だけ候補から外す。
  指紋が変わる (規則が増える・推定月額が変わる) と再び未判断に出る。規則に当たらなくなった行の判断は無視する。
- 登録と見直しの判断は別。未登録の候補を登録しても、規則に当たり続ければ未判断で出る (U-13)。
- 旧 UI の重複・急増アラート (`subscriptions().alerts`) は `dup`・`spike` としてこのカードへ吸収した。

## 推移と比較

| 規則 | 定義 |
|---|---|
| 推移の棒 | 期間の各月の実支払額 (推定月額ではない) を系列別に積む。登録済みのベンダーはカテゴリで、登録外の「サブスク・通信」科目の支出 (`subs.other`) は「その他」に入れる (U-3) |
| 系列 | 期間合計の上位 3 カテゴリ (「その他」を除く) + 「その他」 (残りのカテゴリと `other`)。並びは上位 3 の降順、最後に「その他」 (U-4) |
| 色 | 応答の系列順に `chartSeriesColor(i)` (U-5)。月ごとに変えない |
| 恒等式 | 期間 12 か月のとき棒の和 = KPI 3 枚目 |
| 年換算比較 | 登録済みかつ継続中の行をカテゴリ別に集計。月額の降順。構成比 = 月額 ÷ 合計。前期間比は前期間の同じ定義の月額との差 |
| 合計行 | 月額の和 = KPI 1 枚目 = 一覧の合計行。構成比は固定で 100.0% |

## 画像と system-spec の食い違い (D1〜D13)

| # | 画像 | 採ったもの |
|---|---|---|
| D1 | 一覧・詳細・検出理由カードにサービスのロゴ | 何も置かない。頭文字も描かない |
| D2 | KPI 4 枚目の補足「総支出に占める割合」 | 「売上に占める割合」 |
| D3 | 合計欄・構成比・前期間比などの数値 | 検算済み fixture |
| D4 | 理由文「利用頻度が低く…」 | 5 規則の定型文 |
| D5 | 検出理由カード 1 件 (KPI は 2 件) | 選択中または最優先の1件を代表表示。残りは「他N件」から一覧の「見直し候補」絞り込みへ渡す |
| D6 | ベンダー名列の説明語 | 代表の生の取引名 |
| D7 | 推移の凡例 4 系列 / 比較表 6 カテゴリ | 同じカテゴリ解決。系列は上位 3 + その他 |
| D8 | データソースのカードに銀行のアイコン | 種別ごとのアイコン |
| D9 | バッジが一覧「候補」/ パネル・カード「見直し候補」 | 場所で使い分け。確認済みは「確認済み」 |
| D10 | サイドバー「サブスク 2」(旧実装は未登録候補数) | 未判断の見直し候補数 |
| D11 | 比較表で Adobe が仕事効率化 | 一覧と同じカテゴリ (クリエイティブ) |
| D12 | 直近の取引に期間外 (2026/09/01) | 期間内の明細だけ |
| D13 | 説明文「不要な支出の見直して」 | 「不要な支出の見直しで」 |

## 未決事項 (U-1〜U-15) の確定値

| # | 確定値 | 確定した場所 |
|---|---|---|
| U-1 | 未登録の候補で規則に当たらない行のバッジは「未登録」 | P04 web テスト |
| U-2 | 合計行と KPI は登録済みかつ継続中の行だけ (利用者決定 2026-09-18) | core fixture |
| U-3 | 辞書の「その他」と `subs.other` は同じ「その他」系列 | core `推移の棒の和` |
| U-4 | 系列は上位 3 + その他 | core `推移の系列` |
| U-5 | `chartSeriesColor` の応答順 | web 部品 |
| U-6 | ベンダー名 = 最頻の生の取引名、正規化名 = `sub_vendors.name` か候補の取引先、ソース数 = 生の取引名の種類数 | core `Spotify の詳細` |
| U-7 | 上の口座名の語彙 | core `accountKindOf` |
| U-8 | 最終更新 = 応答の生成時刻 (`generatedAt`)、再取得 = `GET /api/subscriptions` の取り直し (外部への再取込はしない) | web `再取得` |
| U-9 | 「不要な支出の見直しで」(利用者決定) | web 見出し |
| U-10 | 行チェックは置くだけで一括操作は置かない | web 一覧 |
| U-11 | 上の定型文 | core 定型文テスト |
| U-12 | ベンダー名・別名・候補除外名は単一定数で各120文字、別名は50件まで | api 検証 |
| U-13 | 登録後も規則に当たれば未判断で出す (利用者決定) | core 規則 |
| U-14 | 詳細パネルが閉じている間も右列の幅を保ち、検出理由カードを上へ詰める | web レイアウト |
| U-15 | 未判断 → 確認済み → その他、各群は推定月額の降順 | core `一覧の並び順` |

## 設計決定 (P02)

### core の返り値型

`subscriptionsScreen(input)` は `packages/core/src/subs-screen.ts` に置く。タスク仕様の書込先は `subs.ts` だが、
`expense-projection.ts` が `subs.ts` を import しており、画面の算出は `expense-projection.ts` を使うため、
同じファイルに置くと循環 import になる。`subs.ts` は照合キーと候補採点の小さな純関数に留め、
画面の算出を新しいモジュールへ分けた (index.ts から再公開する)。

```ts
interface SubscriptionsScreenInput {
  all: Dataset;                       // 期間で切る前の Dataset (前期間・年額払いの判定に要る)
  deals: FreeeDeal[];
  range: PeriodRange | null;          // null は全期間
  vendors: { id; name; aliases; accounts; category; reviewedAt }[];
  decisions: { vendorKey; decision: 'confirmed' | 'dismissed'; ruleFingerprint }[];
  exclusions: string[];               // 除外した取引先
  generatedAt: string;
}
interface SubscriptionsScreen {
  period: PeriodRange | null; previousPeriod: PeriodRange | null; generatedAt: string;
  kpis: { monthlyTotal; monthlyTotalPrev | null; annualized; annualizedPrev | null;
          last12Total; revenueShare | null; reviewCandidates };
  coverage: { bank; card; emoney: { percent | null; imported; accounts }; unclassified };
  rows: SubscriptionRow[];            // spec §13.1 の行 (vendorKey は vendorKey(正規化名))
  trend: { months: string[]; series: { category; values: number[] }[] };
  comparison: { category; monthly; annualized; share; prevMonthly | null }[];
  comparisonTotal: { monthly; annualized; prevMonthly | null };
}
subscriptionVendorDetail(input, vendorKey): SubscriptionVendorDetail | null
```

- 期間は既存の他画面と同じ query (`from`・`to`・`year`・`span`) を `resolvePeriodQuery` で解く。spec §13.1 の
  `?period=1y` は説明上の表記で、実装は `span=1` を使う (他画面と同じ `usePeriod` の query をそのまま渡す)。
- `last12Total`・`revenueShare` は、期間で切った Dataset の `subs.matrix` を照合後の明細で作り直してから
  既存 `subscriptions()` に通して得る (別経路で数えない)。

### API

| メソッド・パス | 入力 | 出力 | invalidate |
|---|---|---|---|
| `GET /api/subscriptions` | 期間 query | `SubscriptionsScreen` (`Cache-Control: no-store`) | — |
| `GET /api/subscriptions/vendors/:key` | 期間 query | `SubscriptionVendorDetail`。期間内に無ければ 404 | — |
| `POST /api/subscriptions/review-decisions` | `{vendorKey, decision}` + 期間 query | `{ok, fingerprint}`。規則に当たっていなければ 409 | `['subscriptions']`・`['review-queue']` |
| `DELETE /api/subscriptions/review-decisions` | `{vendorKey}` | `{ok}`。判断が無ければ 404 | 同上 |
| `POST /api/sub-vendors/:id/aliases` | `{aliases}` (1〜50 件、各 1〜120 文字) | `{ok, aliases}`。結合後 50 件超は 400 | 同上 |
| `PUT /api/sub-vendors/:id` | `{name?, aliases?, accounts?, category?}` | `{ok}` | 同上 |
| `POST /api/sub-vendors` | `{name, aliases, accounts}` (名前は 1〜120 文字) | `{ok, id}`。同じ名前があれば 409。`id` は詳細の「新しい統合先を登録」が統合先を自動で選ぶのに使う | 同上 |

- 指紋はクライアントから受け取らない。サーバが同じ期間で `subscriptionsScreen` を組み、その行の指紋を保存する。
  web は判断の POST に必ず `usePeriod().withPeriod` を通す (`pages/subscriptions/api.ts` の `postReviewDecision` が
  引数で受け取る)。付け忘れると全期間の指紋で保存され、直近 1 年の表示で候補が消えない (P10 で修正)。
- 判断は正規化名 (`vendorKey`) で引く。`PUT /api/sub-vendors/:id` で名前を変えたら判断を新しいキーへ付け替え、
  `DELETE /api/sub-vendors/:id` では判断も消す。消さないと同じ名前で登録し直したときに古い判断が生き返る (P10 で修正)。
- `:id` は `Number.isInteger` で検査し、整数でなければ 400 (PUT・DELETE・aliases・review・除外の取消でそろえる)。
  `userId` と組で引き、無ければ 404。
- 集計と詳細の GET は `Cache-Control: private, no-store` を返す (家計の明細を共有キャッシュにも履歴にも残さない)。
- サイドバーのバッジ (`GET /api/review-queue` の `subscriptionCandidates`) は既定の期間 (直近 1 年 = `span=1`) の
  `kpis.reviewCandidates` にした。KPI 5 枚目と同じ関数の同じ値である。

### 保存 (migration 0043)

`migrations/0043_sub_vendor_category_and_review_decisions.sql`。`sub_vendors.category TEXT` (NULL = 辞書に従う) と
`sub_vendor_review_decisions (id, user_id, vendor_key, decision, rule_fingerprint, decided_at, UNIQUE(user_id, vendor_key))`。
`user_id` の型は spec の例 (`INTEGER`) ではなく、既存 `sub_vendors.user_id` (0005) と同じ `TEXT` にそろえた
(spec §14 の「既存の sub_vendors にそろえる」に従う)。追加だけで既存行を書き換えない。

### 画面の部品

| 部品 | 役割 |
|---|---|
| `pages/Subscriptions.tsx` | 取得・URL 状態・レイアウト |
| `pages/subscriptions/Kpis.tsx` | KPI 5 枚と前期間比 |
| `pages/subscriptions/CoverageCard.tsx` | カバー率 3 区分・分類できない口座 |
| `pages/subscriptions/SubscriptionTable.tsx` | 検索・絞込・8 列・合計行・詳細選択 |
| `pages/subscriptions/DetailPanel.tsx` | 3 タブの詳細・名称の編集・カテゴリ・関連データ |
| `pages/subscriptions/CategoryTrendChart.tsx` | 積み上げ棒と表の代替 |
| `pages/subscriptions/AnnualComparison.tsx` | 年換算の比較表 |
| `pages/subscriptions/ReasonCard.tsx` | 検出理由カード |
| `pages/subscriptions/SelectionBar.tsx` | 生の取引名の選択中バー |
| `pages/subscriptions/format.ts` | 前期間比の表記・金額の書式 |

## 旧 UI から移した操作

| 旧 UI の操作 | 移した先 |
|---|---|
| 登録ベンダーの一覧 (SubVendorsPanel) | 一覧の「登録済み」行 |
| 名前の変更 | 詳細の概要タブ「正規化された名称」 |
| 別名の追加・削除 | 関連データタブ / 名称を統合 (`POST .../aliases`) |
| 対象科目の編集 | 関連データタブ |
| 見直した (四半期見直し) | 関連データタブ |
| 登録の解除 | 関連データタブ |
| 未登録候補の登録 (SubsCandidatesPanel) | 検出理由カード「候補を採用」/ 詳細「登録」 |
| 未登録候補の除外 | 検出理由カード「候補から除外」/ 詳細「候補から除外」 |
| 除外の取消 | 関連データの下「除外した取引先」 |
| まとめて登録 (ほぼ確実な候補) | 撤去。一括操作は置かない (U-10)。1 件ずつ採用する |
| 重複・急増アラート | 検出理由カードの `dup`・`spike` |
| ベンダー別の前年比較表 | 年換算の比較 (カテゴリ別) と推移 |

## レビュー記録 (P03)

| 観点 | 確かめたこと | 結果 |
|---|---|---|
| データ契約 (§13) | 1 本の GET と依存クエリの詳細、指紋をサーバで求める | 設計どおり。`?period=` は既存の期間 query に読み替え (上記) |
| 保存 (§14) | 追加だけ、`(user_id, vendor_key)` の upsert、取消は削除 | `user_id` を TEXT にそろえた (上記) |
| tabs (§6.2) | `role=tablist/tab/tabpanel`、`aria-selected`、`aria-controls`、左右キー (端で折り返す)・Home / End、roving `tabIndex` | DetailPanel で実装し DOM テストで固定 |
| 集計の定義 | 月額 = 登録済みかつ継続中の推定月額の和 | KPI・合計行・比較表の合計を同じ内部関数で求める |
| 所有者の絞込 | 全更新経路で `userId` と組で引く。`:id` は整数検査 | 他人の `:id`・`vendorKey` は 404 (api テスト) |
| 入力検証 | Zod。aliases 50×120 (`SUB_VENDOR_NAME_MAX`)、vendorKey 1〜120、category は辞書名か 1〜20 文字 | 既存の PUT / POST も 50×120 に広げた |
| 循環 import | `subs.ts` へ置くと `expense-projection.ts` と循環する | `subs-screen.ts` へ分けた |

## 旧実装での失敗の確認 (P04)

新しい DOM テスト (`subscriptions-screen.dom.test.tsx`) を作り直す前の `Subscriptions.tsx` に当てると 22/22 が落ち、
新しい実装では 22/22 が通った。テストが「0 件の違反」ではなく「何も調べていない」だけで緑になっていないことの確認である。
P10 で足したテストも、それぞれの修正を外すと 1 件ずつ落ちることを確かめた
(Home / End、`no-store`、判断の期間 query、名前変更での付け替え、登録解除での削除)。

## 最終レビュー (P10)

独立したレビューを 1 回かけ、指摘を次のとおり扱った。

| 重さ | 指摘 | 扱い |
|---|---|---|
| 高 | 判断の POST が期間 query を付けず、全期間の指紋で保存される。直近 1 年の表示で「除外」「確認済み」が効かない | 修正。`postReviewDecision` に `withPeriod` を必須で渡す。DOM テストは `PeriodProvider` の下で描き、`?span=1` と `?span=3` を固定 |
| 中 | 名前を変えると判断が外れて候補に戻る。登録を解除して登録し直すと古い判断が生き返る | 修正。PUT で付け替え、DELETE で削除 (api テスト 2 件) |
| 中 | 1 年以外の期間で判断すると、その期間の指紋で保存され、サイドバーのバッジ (直近 1 年) が減らないことがある | 仕様どおり。判断は「表示中の期間で見た規則の組」に対するもので、規則の組が変われば再び候補に出す。バッジは直近 1 年で数える。後続課題に記録 |
| 中 | `check-financial-visuals.mjs` にロゴ 0 件の検査が無い (§15.2) | 修正。実ブラウザの計算値で `img`・`picture`・logo/avatar class・`background-image: url()` を数え、0 件でなければ失敗 |
| 中 | 集計と詳細の GET に `no-store` が付いていない (API 表と食い違い) | 修正。`private, no-store` を返し、api テストで固定 |
| 低 | タブが Home / End に反応しない | 修正。端で折り返し、Home / End で両端へ (DOM テスト) |
| 低 | 見直し時期を今日ではなくデータの最終月で判定する | 仕様どおり (取込が止まれば催促も止まる。画面は「データの範囲」で答える) |
| 低 | 60 字を超える未登録の支払先名は登録で 400 | 修正。名前の単一上限を120文字にし、121文字は全経路で400 |
| 低 | 復元でカテゴリの上書きと判断が引き継がれない | 修正。canonical backup/write-setとlease/invalidationに接続し、空DB往復と旧JSON互換を固定 |

### AI の候補と画面の見直し候補の定義差 (OI-03)

| 観点 | AI 指示文 (`agentPayload`) | 画面の見直し候補 |
|---|---|---|
| 候補の選び方 | `subsCandidates` で未登録の支払先だけを採点 (継続性・金額のブレ・科目) | 登録済みと未登録の行を 5 規則で判定 |
| 件数 | 上位 10 件 | 未登録は `subsCandidates` の上位 20 件 |
| 期間 | 全期間 (`loadDataset`) | 選んだ期間 |
| 除外 | `sub_vendor_exclusions` を反映 | 同左 |
| 判断の反映 | `confirmed` / `dismissed` を見ない | 反映する |

AI の候補は「登録すべき未登録の支払先」、画面の候補は「見直しの判断が必要な行」で、意味が違う。
画面で判断した支払先が AI 指示文に出続けることがある。本サイクルでは AI 側を変えない (後続課題)。

## 後続課題

- AI 指示文の候補 (`subsCandidates` 上位 10 件・全期間・判断を見ない) と画面の見直し候補の定義をそろえるか、
  別物として AI 側の説明に明記するかを決める (OI-03)。
- 判断をどの期間の指紋で保存するか。いまは表示中の期間。直近 1 年以外で判断するとバッジが減らないことがある。
