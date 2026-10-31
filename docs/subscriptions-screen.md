# サブスク画面の規則

`/subscriptions` (整える > サブスク) の利用案内と検証索引。
画面の基礎仕様は [spec-subscriptions-screen](../specs/spec-subscriptions-screen.md)、統合・並行制御・取り消しの現行契約の正本は [spec-subscriptions-merge](../specs/spec-subscriptions-merge.md)。食い違う箇所は統合仕様を優先する。
architecture は構造・採用理由、tasks は作業・依存・AC 参照、本書は使い方と検証結果への入口を持つ。規則を変えるときは spec と実装・テストを同じ変更で整合させ、検証索引を更新する。

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
| 定義 (推定月額・継続中・候補規則・カバー率・カテゴリ) | `specs/spec-subscriptions-screen.md`。統合による変更は `specs/spec-subscriptions-merge.md` |
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
| 9 | 生の取引名 2 件で下部バー、統合先を選んで `POST /api/sub-vendors/merge` (取引名は `rawNames`)、解除で戻る 〔統合と並行制御のサイクルで変更: 旧は `POST /api/sub-vendors/:id/aliases`〕 | web `取引名 2 件は統合先を選ぶまで統合できず、選ぶと統合 API に取引名だけを送る` / `選択を解除すると下部バーが消え、チェックも外れる` |
| 10 | 推移の棒が期間の月数、凡例、棒の和 = 114,856 | core `推移の棒の和 = 直近12か月の支払額` / web `推移の棒と凡例` |
| 11 | 年換算比較が fixture どおり、合計 = 一覧合計 = KPI 1 枚目 | core `年換算比較は月額の降順で fixture と一致する` |
| 12 | 検出理由カードは選択中または最優先の候補を1件表示し、残りは「他N件」から未判断の一覧へ到達できる | core `見直し候補の並び` / web `最優先の1件を代表表示し、残りは既存の候補絞り込みへ渡す` |
| 13 | confirmed の保存、バッジ「確認済み」、KPI 5 枚目とサイドバーが 1 減る、取消で戻る | api `確認するとサイドバーのバッジと KPI が 1 減り、取消で戻る` |
| 14 | dismissed が指紋つきで保存され候補が消える、指紋が変わると再び出る | core 指紋の境界値 / api `除外は指紋つきで保存される` |
| 15 | 未登録の候補の採用 `POST /api/sub-vendors`、除外 `POST /api/sub-vendors/exclusions`。採用すると取引名は登録へまとまり、以後は登録済みの判断に切り替わる | web `未登録の候補は詳細内の一か所から取引名ごと除外できる` / `未登録の候補を詳細内で採用すると登録済みの判断に切り替わり、後の送信は前の応答の revision を base にする` |
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
| U-10 | 行チェックは置くだけで一括操作は置かない 〔統合と並行制御のサイクルで変更: 行チェックは選択バーの統合 (FR-001〜003) に使う。統合以外の一括操作は今も置かない〕 | web 一覧 |
| U-11 | 上の定型文 | core 定型文テスト |
| U-12 | ベンダー名・別名・候補除外名は単一定数で各120文字、別名は50件まで | api 検証 |
| U-13 | 登録後も規則に当たれば未判断で出す (利用者決定) | core 規則 |
| U-14 | 詳細パネルが閉じている間も右列の幅を保ち、検出理由カードを上へ詰める | web レイアウト |
| U-15 | 未判断 → 確認済み → その他、各群は推定月額の降順 | core `一覧の並び順` |

## 設計決定 (P02)

### core の返り値型

型の宣言は [subs-screen.ts](../packages/core/src/subs-screen.ts) の `SubscriptionsScreenInput`・`SubscriptionsScreen`・`SubscriptionVendorDetail` を参照する。数値の意味は画面仕様、統合時の変更は統合仕様を正とする。型コードの写しは本書に持たない。

### API

読取・見直し判断の契約は [画面仕様](../specs/spec-subscriptions-screen.md)、統合・取り消し・履歴・revision の契約は [統合仕様のAPI契約](../specs/spec-subscriptions-merge.md#api契約) を参照する。実装入口は [subsRoute](../packages/api/src/routes/subs.ts)。判断は表示中の期間を付けて送り、指紋はサーバーで求める。

### 保存 (migration 0043)

DDL は [migration 0043](../migrations/0043_sub_vendor_category_and_review_decisions.sql)、統合の追加分は [migration 0058](../migrations/0058_subscription_merge_operations.sql) を参照する。列・制約の正本は各 spec のデータモデルで、本書に DDL を複製しない。

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
| `pages/subscriptions/SelectionBar.tsx` | 一覧の行と詳細の取引名を 1 つの選択として数える下端のバー。統合先の選択欄と統合の送信はここだけに置く |
| `pages/subscriptions/format.ts` | 前期間比の表記・金額の書式 |
| `pages/subscriptions/OperationList.tsx` | 「操作」のカード。直近 5 件の待機中・処理中・完了・失敗、「再試行」と「元に戻す」 |
| `pages/subscriptions/useSubscriptionWrites.ts` | 書込みを scope `subscriptions-write` の 1 本の列に並べ、busy と revision の送り直しを行うフック |
| `pages/subscriptions/writeRequests.ts` | 積んだ操作 (intent) と最新の一覧から、送る直前に本文と前提の検査を作る純関数 |
| `pages/subscriptions/operationText.ts` | 操作の行と読み上げの文言。失敗をエラーコードで類に分ける |
| `pages/subscriptions/operationRows.ts` | 画面の mutation と API の操作の記録を合成し、重複を除いた行にする純関数 |
| `pages/subscriptions/operationProgress.ts` | 自動の送り直しが何回目かを操作ごとに持つ外部 store |
| `pages/subscriptions/selection.ts` | 選択から統合先の選択肢・既定の統合先・統合の intent を導く純関数 |

## 旧 UI から移した操作

| 旧 UI の操作 | 移した先 |
|---|---|
| 登録ベンダーの一覧 (SubVendorsPanel) | 一覧の「登録済み」行 |
| 名前の変更 | 詳細の概要タブ「正規化された名称」 |
| 別名の追加・削除 | 関連データタブ (`POST .../aliases`) |
| 名称を統合 | 行のチェックか詳細の取引名チェックで選び、選択バーの統合先へ送る (`POST /api/sub-vendors/merge`)。統合元の行は一覧から消え、「操作」から元に戻せる |
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

## 統合と並行制御

`/subscriptions?vendor=aquavoice` で登録済みの行を別の行へ統合しても統合元が一覧に残る不具合と、
統合など複数の書込みを続けて押すと「サーバー側で処理に失敗しました」で止まる不具合を直すサイクルの基準線。
要件の正本は `specs/spec-subscriptions-merge.md` (FR-001〜023・BR-001〜013・AC-001〜023)。本節は
その対応表と、着手時に現物で確かめた結論を持つ。

### 要件と検証手段

検証の置き場所は 4 つに分ける。

| 略号 | テスト |
|---|---|
| core | `packages/core/test/subs-contract.test.ts`・`subs-screen-contract.test.ts` |
| api | `packages/api/src/subs-merge-operations.integration.test.ts` (新設)・`subs-screen.integration.test.ts` |
| web | `packages/web/src/subscriptions-screen.dom.test.tsx` |
| web unit | `packages/web/src/pages/subscriptions/*.test.ts(x)` (`selection`・`writeRequests`・`operationRows`・`operationText`・`useSubscriptionWrites.dom`。P05 で新設) |

実装の場所は、断りが無ければ api は `packages/api/src/subscription-writes.ts`、web は
`packages/web/src/pages/subscriptions/` の中のファイルを指す 〔P12 で追加〕。

| 要件 (内容は spec を参照) | 実装の場所 | 検証手段 |
|---|---|---|
| FR-001 | web `SubscriptionTable.tsx` (全選択の `indeterminate`) | web AC-007 |
| FR-002 | web `pages/Subscriptions.tsx` (`selectedKeys`)・`selection.ts` | web AC-008 |
| FR-003 | core `subs-screen.ts` `defaultMergeTarget` / web `SelectionBar.tsx`・`selection.ts` `resolveMergeTarget` | core `defaultMergeTarget` / web AC-008 |
| FR-004 | web `DetailOverview.tsx` (「名称を統合」)・`SelectionBar.tsx` (統合先の選択欄) | web AC-008・AC-016 |
| FR-005 | api `handleMerge`・`rewriteVendorsStatement` | api AC-001 |
| FR-006 | api `handleMerge`・`handleUndo` | api AC-013 |
| FR-007 | api `handleMerge` (`cleanAccounts`) | api AC-001 |
| FR-008 | core `subs.ts` `resolveVendorMerges` / api `store.ts` `loadDatasetResolved` (他画面と現金明細の `projectCashContribution` が同じ一覧を使う)・core `subs-screen.ts` `buildContext` | core AC-002・AC-003 / api AC-002 |
| FR-009 | core `expense-projection.ts` `registeredVendorOf`・`subs.ts` `matchSubVendor` | core AC-002 |
| FR-010 | api `commitOperation` | api AC-018 |
| FR-011 | api `baseMatches`・`revisionConflict` | api AC-014・AC-018 |
| FR-012 | api `requiredKey`・`optionalKey`・`replayOutcome` | api AC-006 |
| FR-013 | api `commitOperation` | api AC-004・AC-005・問い合わせ数 |
| FR-014 | web `useSubscriptionWrites.ts` | web AC-009 |
| FR-015 | web `useSubscriptionWrites.ts` (`execute`・`BUSY_DELAYS_MS`)・`operationText.ts` `retryKindOf` | web AC-015 |
| FR-016 | web `useSubscriptionWrites.ts` (`execute`)・`writeRequests.ts` `checkPrecondition`・`buildRequest` | web AC-021 |
| FR-017 | web `operationText.ts` `classifyWriteError` | web AC-015 / api AC-017・AC-019 |
| FR-018 | web `OperationList.tsx`・`operationRows.ts` | web AC-009・AC-022 |
| FR-019 | web `OperationList.tsx` / api `handleUndo` | api AC-013 / web AC-010 |
| FR-020 | api `listSubscriptionOperations` | api AC-020 |
| FR-021 | web `pages/Subscriptions.tsx` `afterMerge` | web AC-016 |
| FR-022 | web `SubscriptionTable.tsx`・`DetailOverview.tsx` (`selectionLocked`) | web AC-011 |
| FR-023 | api `commitOperation` の (g)(h) | api AC-019 |
| BR-001 | api `handleMerge` / web `selection.ts` `mergeTargetOptions` | api / web (選択欄に出さない) |
| BR-002 | api `routes/subs.ts` `mergeSchema`・`handleMerge` | api |
| BR-003 | api `routes/subs.ts` `mergeSchema` | api |
| BR-004 | api `handleMerge` (`ALIASES_MAX`) | api |
| BR-005 | core `subs.ts` `SubVendorMergeCycleError` / api `handleMerge` | core AC-003 / api (下の注) |
| BR-006 | api `handleMerge` | api AC-012 |
| BR-007 | api `requiredKey`・`replayOutcome` | api AC-006 |
| BR-008 | api `revisionConflict`・`commitOperation` | api AC-014 |
| BR-009 | api `handleUndo`・`undoBlockReason` | api AC-017・AC-019 |
| BR-010 | api `handleUndo` | api AC-013 |
| BR-011 | core (各画面の算出を変えない) | core AC-002 |
| BR-012 | core `dataset.ts` `projectSubsAggregate` / api `store.ts` `loadDatasetResolved` | core |
| BR-013 | api `commitOperation` | api AC-019 |

注 (BR-005): API の入力で 422 `merge_cycle` になるのは自己統合だけである。統合先が統合元の子孫なら、統合先は必ず統合済みの行なので、
先に BR-001 が 409 `subscription_revision_conflict` で止める (api merge-ops「統合元の子を統合先に選ぶ循環 (BR-005) も…」)。
子孫をたどる循環の検査は API には置かず、JSON の復元など API を通らない経路から来た多段の連鎖を、
core の `resolveVendorMerges` が `SubVendorMergeCycleError` で拒む。

| 受入 | 検証の置き場所 |
|---|---|
| AC-001・AC-004〜006・AC-012〜014・AC-017〜020 | api |
| AC-002 | core (照合の一致) と api (`monthly_agg`) |
| AC-003 | core |
| AC-007〜011・AC-015・AC-016・AC-021・AC-022 | web |
| AC-023 | `pnpm verify:full` (CI は PR の作成時) |

### 着手時に確かめた事項

| 事項 | 結論 | 根拠 |
|---|---|---|
| migration 0058 の空き | 空いている | origin/main (a63d35c)・全ブランチ・他の worktree とも `migrations/` の最終は 0057 |
| TanStack Query の `scope` と `useMutationState` | 使える | 解決版は 5.102.8。`useMutation` の `scope: { id }` は同じ id の mutation を 1 件ずつ実行する (mutationCache が先頭の pending だけを走らせ、終われば次を再開する)。待機中は `status === 'pending'` かつ `isPaused === true`、処理中は `isPaused === false` で見分ける。`retry` は `variables` を保ったまま再実行するので、key を `variables` に入れれば同じ key で再送される。revision の送り直し (新しい key と base) は `mutationFn` の中で行う |
| 統合 1 回の D1 の問い合わせ数 | 見込みは最悪 18 文 (取り消し) で 20 未満 | fence の lease の取得と解放・テナントの検査・revision・subs 範囲の入力の読み取り・`db.batch` 1 回 (9〜11 文)。Workers Free の 1 invocation の上限は 50 (`D1_FREE_QUERY_LIMIT`)。実測は api の統合テストで数える |
| D1 の overloaded の判定 | 例外の message が `D1 DB is overloaded` を含めば 503 `d1_overloaded` (retryable)。spec の確定した実装契約 #6 | Cloudflare の D1 の公式文書 (debug-d1) の message は `D1 DB is overloaded. Too many requests queued.` と `D1 DB is overloaded. Requests queued for too long.` の 2 種。D1 が自動で再試行するのは読み取りだけで、書込みは画面が同じ key で送り直す |
| FR-009 で数値が変わる範囲 | サブスク画面と `sourceNeutralSubscriptions` の経路 (`registeredVendorOf`) だけ。検算済み fixture の数値は変わらない | 他画面の集計 (`applyFreeeDeals`) と現金明細 (`projectCashContribution`) は既に科目で先に絞っている。結果が変わるのは、1 つの取引名が複数のベンダーに一致し、先に一致したベンダーの対象科目が合わない場合だけ (旧: null、新: 後のベンダー)。fixture で対象科目を持つのは Spotify (通信費) の 1 件で、他のベンダーと取引名が重ならない |

### 設計決定

現行契約は [spec の確定した実装契約](../specs/spec-subscriptions-merge.md#確定した実装契約)。型コード・API 表・SQL・待ち行列の状態遷移は複製せず、次の入口から参照する。

#### core の型

[subs.ts](../packages/core/src/subs.ts) の `resolveVendorMerges`・`ResolvedSubVendors`、[subs-screen.ts](../packages/core/src/subs-screen.ts) の `defaultMergeTarget`、[dataset.ts](../packages/core/src/dataset.ts) の `projectSubsAggregate`・`SubsAggRow`。依存の向きと配置理由は [backend の判断記録](../architecture/subscriptions-merge-backend.md#実装時に確定した判断)。

#### API

[spec のAPI契約](../specs/spec-subscriptions-merge.md#api契約)。経路は [routes/subs.ts](../packages/api/src/routes/subs.ts)、統合・取り消し・履歴の本体は [subscription-writes.ts](../packages/api/src/subscription-writes.ts)。

#### D1 の batch

各 API の「実行セマンティクス」を正とする。共通処理は `subscription-writes.ts` の `commitOperation`・`OP_EXISTS`・`rewriteVendorsStatement`。構造と原子性の理由は [backend](../architecture/subscriptions-merge-backend.md#data-and-transaction-behavior)。

#### 問い合わせの予算

上限は [spec の非機能要件](../specs/spec-subscriptions-merge.md#非機能要件)。実測の対象範囲と結果は本書の「P09 アクセシビリティ・ログ・予算・変異テスト」を参照する。

#### fence と lease

[canonical-mutation-fence.ts](../packages/api/src/canonical-mutation-fence.ts) の登録表と [spec のエラー・例外・回復](../specs/spec-subscriptions-merge.md#error-recovery)。overloaded の判定は `index.ts` の `isD1Overloaded`。

#### migration 0058

DDL は [0058](../migrations/0058_subscription_merge_operations.sql)、列・制約・保持は [spec のデータモデル](../specs/spec-subscriptions-merge.md#データモデル)、構造上の理由は [database](../architecture/subscriptions-merge-database.md)。

#### backup と復元

現行契約は spec のデータモデルと確定した実装契約の #11。実装は [import-lifecycle.ts](../packages/api/src/import-lifecycle.ts) の `restoreTouchesSubscriptions`・`planRestoreImportQueries`。名前を参照に使う理由と保持の制約は database の判断記録。

#### 画面の待ち行列

再送・送り直し・表示文言は [spec のUI・状態遷移](../specs/spec-subscriptions-merge.md#ui-state)。実装は [useSubscriptionWrites.ts](../packages/web/src/pages/subscriptions/useSubscriptionWrites.ts)、要求の作成と前提検査は `writeRequests.ts`。配置と理由は [frontend](../architecture/subscriptions-merge-frontend.md)。

### 設計レビュー (P03)

上の設計決定を spec と現物のコードに照らして独立に読み直した結果。コードと表は変えていない。
重大度は「高 = このまま実装すると受入を満たせない」「中 = 実装で誤りやすい」「低 = 書き方の不足」。
以下は当時の指摘と解消の履歴であり、現行契約を上書きしない。現行の判断は spec の確定した実装契約を参照する。

名寄せを通らない照合の経路は、spec の 3 経路 (`applyFreeeDeals`・`buildContext`・`projectCashContribution`) に加えて
backup の組み立て (`datasetFromBackupSnapshot`) の 4 つ目があった。4 経路とも照合一覧を `resolveVendorMerges` の結果から作る。
テナントは `c.get('userId')`、操作者は `c.get('actor').id` から取り、本文の `user_id`・`actor` は zod の strip で落とす。

| # | 重大度 | 指摘 | 解消 |
|---|---|---|---|
| 1 | 高 | Datasetの根だけでは統合元の保存定義をbackupへ運べない | 保存行のmetadataにoptionalなaliases/accounts/sortOrderとmergedIntoNameを持たせ、表示・集計の実効aliasesと分けて往復する。現行契約はspecデータモデル。API統合の「実効別名50件超でも export/restore が根と統合元の保存定義を保つ」を参照する |
| 2 | 高 | `ResolvedSubVendors.vendors: SubVendor[]` では画面が使う id・category・reviewedAt が落ちる | `vendors` は `SubVendor` のままにする (core の契約テストが形を固定している)。id などが要る画面は、テナント内で一意な名前で生の行と突き合わせ、aliases だけを解決済みの値に差し替える |
| 3 | 中 | 統合先の削除を直接の統合元だけに限定すると連鎖の孫が残る | 現行は読み取り済みの全ベンダーから `mergeFamily` の不動点ループでまとまりを集める。DELETEの契約はspec、採用理由はbackendの判断記録 #7を参照する |
| 4 | 中 | (b2) の付け替えは統合元が複数あると `sub_vendor_review_decisions` の一意制約に当たる。UNIQUE 違反の写し方が広い | 統合先に判断が無いときは、統合元の判断のうち `decided_at` が最新 (同時刻は vendor_key の小さい順) の 1 件だけを付け替え、残りは (b3) で消す。UNIQUE 違反は制約の列で分ける: `base_revision` は 409 `subscription_revision_conflict`、`idempotency_key` は再送として既存の操作を読み直し `replayed: true` を返す。それ以外は投げ直す |
| 5 | 中 | 状態の読み取りに見直し判断と、BR-009 の 4 (後続の操作) の材料が無い | 同じ 1 行にスカラーのサブクエリで足す: 対象のベンダーの判断 (`json_group_array`)、取り消し対象より base_revision が大きく未取り消しの `merge`・`vendor_update`・`vendor_delete`・`review_decision` の target_vendor_id と payload_json。「触れている」は target_vendor_id か payload の sourceVendorIds が統合先・統合元のどれかに当たること。30 日以内の操作より後の行なので payload は NULL になっていない |
| 6 | 中 | 旧照合では統合元の正規名が別名の部分一致へ落ち、第三ベンダーに取られうる | 解消実装あり。`resolveVendorMerges` が統合元の正規名を照合専用の `exactNames` に保持し、`matchSubVendor` が部分一致より先に完全一致を判定する。回帰は core `subs-contract.test.ts` の「統合元正規名の完全一致優先」。科目互換は `eligibleForAccount` に共通化され、`registeredVendorOf` の独自filterも除去された。今回の文書編集ではテストを再実行していない |
| 7 | 中 | `projectSubsAggregate` の月の集合が `planRecomputeFromDeals` とずれうる。同じ月に統合元と根の行を出すと主キー違反になる | 入力の `deals` は収入を含む全ての freee 仕訳にし (月の集合に使う)、照合は支出だけで行う。baseline の月は事業の 4 種の scope を持つ月 (`businessBaselineMonths` と同じ規則)。根へ寄せるときは同じ (月, scope) を合算する。`loadDataset` の vendorSet への寄せ (`store.ts:586-608`) も代入でなく加算にし、登録済みへの絞り込み (`store.ts:1888`) は解決済みの一覧で行う |
| 8 | 中 | `isPaused` はオフラインや画面が非フォーカスのときも true になり、「待機中」が誤表示される | mutation に `networkMode: 'always'` を付け、`isPaused` を scope の待ちだけにする。送り直しで key と base が変わるので、最後に送った `{ key, baseRevision }` を `variables` の中の可変な入れ物に持たせ、`retry` の再送はそれを使う |
| 9 | 中 | `routes/subs.ts` の `Ctx` には actor が無い | `Hono<{ Bindings: Env; Variables: AuthVariables }>` にし、`actor_user_id = c.get('actor').id`。ログは操作 id・kind・結果・所要 ms・actor の id だけ (spec の可観測性) |
| 10 | 中 | 復元の write set: `subVendorMetadataBackupSchema` と `RestoreSubVendorMetadata` が `.strict()` で新しいキーを拒む。移行先にだけあるベンダーの統合関係が外れる。upsert が merged_into_id に触れない。復元の revision +1 の置き場所が無い | 両方に任意の `mergedIntoName` を足す。移行先にだけある統合元の行は、統合先が復元後も在れば統合元のまま残す (照合一覧には足さない)。upsert の `ON CONFLICT DO UPDATE` で merged_into_id を NULL に戻し、次の文で名前から統合先の id を入れ直す。revision の +1 は sub_vendors を書く batch に入れる |
| 11 | 低 | EXISTS に user_id が無い。(c) で updated_at を更新していない。`INSERT … SELECT … ON CONFLICT` は構文上 `WHERE 1` が要る | EXISTS は `WHERE id=? AND user_id=?`。(c) は `updated_at=excluded.updated_at` も書く。`WHERE 1` は前例 (`import-lifecycle.ts:1457`) どおり付ける |
| 12 | 低 | D1 が `UPDATE … FROM` に対応するかを確かめていない | 使わない。前例 (`import-lifecycle.ts:190-200`) と同じ相関サブクエリと `CASE` で 1 文にする〔P05 で変更: 「設計から変えたこと」の 8〕 |
| 13 | 低 | `json_group_array` は並びを保証しない | JS で `sort_order`・id の順に並べ直す。normMap は `loadNormMap` と同じ順で渡す |
| 14 | 低 | 画面の文言に、自動再送と送り直しを使い切ったときと「元に戻しました」が無い。400・422 の行き先が無い。取り直す対象に操作の一覧が無い | 使い切りは spec の文言 (`operationText.ts` の `BUSY_EXHAUSTED`「別の操作が続いているため送れませんでした。少し待ってから再試行してください」と `REVISION_EXHAUSTED`「他の利用者の操作が続いたため送れませんでした。一覧を確認してから再試行してください」) を使う〔P04 で解消を改めた。当初の案「自動の再試行を 3 回行いましたが…」は同じ場面を指す別の文で、spec と食い違うため採らない〕。取り消しの完了は「(email) が元に戻しました」。400・422 は失敗 (理由のみ)。`AFFECTED_QUERY_ROOTS` の全ての種類に `subscription-operations` を足す |
| 15 | 低 | 既存の書込み 9 本の予算表が無い。候補 (`subs.ts:264`)・AI (`ai.ts:252`)・取込 (`imports.ts:1640`) の扱いが無い | 9 本は fence 4・解放 1・状態 1・(名寄せに効くときだけ) subs の入力 1・batch (既存の文 + 共通 6 文) で、最悪は名寄せに効く削除の 16。候補の 3 経路は登録済みの判定にしか使わず、統合元の行を含む生の行でも解決済みでも結果が同じなので変えない。`index.test.ts` は定数を import するので変えない〔P10 で訂正: 「結果が同じ」は誤り。生の行では統合元の名前は完全一致 (1 段目) でしか当たらないが、集計では根の別名 (2 段目の部分一致) で当たる。統合元の名前を含む支払先 (「Aqua Voice」を統合した後の「Aqua Voice Pro」など) は集計では根に数えられるのに、候補には未登録として出続けた。`subsCandidates` が `matchableVendors` で根へ畳んでから判定するように直し、3 経路は変えずに済ませた (下の「検証の記録」の P10)〕 |

変えなくてよいと確かめた事項:

- DDL は spec と一致する。`EXPECTED_D1_MIGRATION` のリテラルは `schema-guard.ts:4` と `deletion-schema.test.ts:63` の 2 か所だけ。
- 問い合わせの本数はどの経路も 20 未満。fence の最悪 4 は `IMPORT_CLAIM_WORST_CASE_QUERY_COUNT` と一致する。
- 既存の sub-vendors 系の `CANONICAL_MUTATION_ROUTES` は統合と取り消しの経路に当たらないので、明示的に足す必要がある (上の決定どおり)。

### 旧実装での失敗の確認 (P04)

P05 の実装に入る前の現物 (統合は取引名を統合先の別名へ足すだけで統合元の行が残る・操作の一覧が無い・
revision も Idempotency-Key も無い) に、このサイクルで書いたテストを当てた結果。
落ちた件数は「この契約をまだ誰も満たしていない」ことの証拠で、通った件数は仕様が変わらない既存の契約である。
テストが「0 件の違反」ではなく「何も調べていない」だけで緑になっていないことを、ここで確かめた。

| テスト | 旧実装での結果 | 代表の失敗 |
|---|---|---|
| core `subs-contract.test.ts` | 18 失敗 / 14 成功 (32) | 「自己統合は `SubVendorMergeCycleError`」「循環 (A→B→A)」「`applyFreeeDeals` は統合元の取引を根の列へ足し、統合元の列を作らない」 |
| core `subs-screen-contract.test.ts` | 3 失敗 / 53 成功 (56) | 「統合元の行は一覧から消え、統合先の推定月額は統合前の和になる」 |
| api `subs-merge-operations.integration.test.ts` (新設) | 34 失敗 / 1 成功 (35) | 「Netflix を Spotify Premium へ統合すると Netflix の行が消え、月額は和になり、取り消すと戻る」「統合済みの行への PUT・別名・見直し日・削除は 409 `subscription_revision_conflict` で未適用」 |
| api `subs-screen.integration.test.ts` | 2 失敗 / 26 成功 (28) | GET の応答に `revision` が無い。sub-vendors の行に `mergedIntoId` が無い |
| api `subs-vendor-scope.test.ts` | 2 失敗 / 7 成功 (9) | 「科目違いのベンダーが先に名前で当たっても、対象科目に合う別のベンダーへ照合する」 |
| api `expense-projection.integration.test.ts` | 1 失敗 / 4 成功 (5) | 「両方に対象科目があれば和集合になり、科目外の支払は統合後も数えない」 |
| web `subscriptions-screen.dom.test.tsx` | 30 失敗 / 28 成功 (58) | 「`Netflix を選択` という名前の checkbox が無い」(9 件)、region「操作」と combobox「統合先」が無い、列見出しの先頭が「表示中の行をすべて選択」でない、書込みの本文に `baseRevision` が無い |

- core の 18 件は、循環の検査を型 (`SubVendorMergeCycleError`) で見るように直す前は 15 件だった。文言の一致では旧実装の汎用エラーでも通ってしまうため、型で見るようにした。
- web の成功 28 件は、KPI・カバー率・詳細パネル・タブ・検出理由・読込中と空の表示など、本サイクルで仕様が変わらない表示の契約である。
- 失敗の画面の文言は spec と `architecture/subscriptions-merge-ui-ux.md` の表を正とした。設計レビューの 14 で挙げた使い切りの文言は、spec に既にある「別の操作が続いているため送れませんでした…」「他の利用者の操作が続いたため送れませんでした…」と同じ場面を指すので、spec の文言を使う。

### 設計から変えたこと

既存の11点は [spec の確定した実装契約](../specs/spec-subscriptions-merge.md#確定した実装契約) に反映済み。採用理由は UI-UX (#1・2)、frontend (#3・4)、backend (#5〜10)、database (#11) の「実装時に確定した判断」を参照する。本書に旧契約と現行契約のコピーを併置しない。

推定月額は統合後の明細から再計算する。各月の実支払額を保存する。過去の検証記録は当時の記録として保持する。CI は未確認であり、ローカルの成功を CI 成功として扱わない。

<a id="verification-records"></a>

### 検証の記録 (P06〜P11)

P06〜P11 で流した検査の索引。テストの出力や画面シナリオの記録といった生のログはリポジトリに入れず、
ローカルの作業領域にだけ残す。ここには実行したもの・結果・件数だけを写す。テストの行番号は記録した時点のもの。
データは匿名のテスト用データだけを使い、本番のデータは使っていない。
P04 (旧実装に当てたときの件数と代表の失敗) は上の「旧実装での失敗の確認 (P04)」にあり、下の P06 の表が同じ 7 ファイルの今の結果で対になる。

#### P06 テストの実行

`pnpm test` (core・api・web・test:aux) は exit 0、1148 秒。`pnpm typecheck` (core・api・web の 3 パッケージ) は
exit 0、29 秒。`pnpm lint` (biome と 10 本の検査スクリプト) は exit 0、7 秒。

| 対象 | ファイル | テスト |
|---|---|---|
| core | 68 成功・1 skip | 1294 成功・6 skip |
| api | 76 成功 | 1109 成功 (956 秒) |
| web | 101 成功 | 1229 成功 (182 秒) |
| test:aux | — | 43 成功 |

P04 で落ちた 7 ファイルは、今はすべて成功する。件数が P04 より多いものは P05〜P10 でテストを足した。

| テスト | P04 (旧実装) | 今 |
|---|---|---|
| core `subs-contract.test.ts` | 18 失敗 / 32 | 34 成功 |
| core `subs-screen-contract.test.ts` | 3 失敗 / 56 | 56 成功 |
| api `subs-merge-operations.integration.test.ts` | 34 失敗 / 35 | 35 成功 |
| api `subs-screen.integration.test.ts` | 2 失敗 / 28 | 28 成功 |
| api `subs-vendor-scope.test.ts` | 2 失敗 / 9 | 10 成功 |
| api `expense-projection.integration.test.ts` | 1 失敗 / 5 | 5 成功 |
| web `subscriptions-screen.dom.test.tsx` | 30 失敗 / 58 | 61 成功 |

P05 で新設した web の unit テストは 5 ファイル 65 件 (selection 9・writeRequests 18・operationRows 11・
operationText 21・useSubscriptionWrites.dom 6) で、すべて成功する。

#### P07 受入の確認 (O1〜O4・U5)

| 目標 | 確かめ方 | 結果 |
|---|---|---|
| O1 統合元が一覧に残らず、他画面も同じ名寄せで数える | ローカルの API と画面にテスト用データを入れ、ブラウザで統合 → 取り消し → 統合し直しを通す画面シナリオ | 統合の後: URL は `?vendor=` が統合先、統合元の行は 0 件、統合先は取引名 2 件・推定月額 2,400 (統合前の 1,200 + 1,200)、KPI は統合の前後とも ¥2,800 / ¥33,600、診断画面の取引先は 2 件。取り消すと 2 行に戻り、統合し直すと同じ結果になる。console のエラー 0 件、HTTP のエラー 0 件、書込みの応答 6 件はすべて 200。金額の母集団は各画面の定義のまま (BR-011) |
| O2 連続・同時の書込みで「サーバー側で処理に失敗しました」を出さない | api 465・497・530・1008・1034 / web DOM 1473・1503・1602、`useSubscriptionWrites.dom` 120・135・158・196・221 | サーバー: 5 件を連続で送ると全件 200。5 件を同時に送ると 200 は 1 件で、残りは未適用の 409、500 は 0 件。2 人が同時に送っても同じ。lease の競合は 409 `canonical_write_busy`、overloaded は 503 `d1_overloaded`。画面: busy は同じ key で 1・2・4 秒後に送り直し、「サーバー側で処理に失敗しました」を出さずに完了する。revision の衝突は取り直してから新しい key と最新の base で送り直す。続けて 5 回押した統合は 1 件ずつ順に送り、base を進める。どれも利用者が押し直さずに収束する |
| O3 選択・統合・取り消しの画面の契約 | web DOM | 61 件すべて成功 (AC-007〜011・015・016・021・022) |
| O4 権限・期限・秘密 | api 726・770・801・860・877・922・975・995・1075、画面シナリオ | テナントに無い id は 404。revision が 8 のとき base 7 の統合と PUT は 409 `subscription_revision_conflict` で、sub_vendors・操作・revision は変わらない (770)。別の利用者が統合を取り消すと、統合前と同じ行・月額・subs 範囲に戻り、両方の actor が残る (801)。画面シナリオでも取り消すと統合元の行と月額 1,200 が戻った。二重の取り消しは 409 `already_undone`、31 日前の統合は 410 `undo_expired`、30 日を過ぎた本文と 400 日を過ぎた行は 1 回の書込みで 50 件まで掃除、操作の一覧は本文・変更前・key を返さない |
| U5 全体の検査 | `verify:full` の定義と同じ段を同じ順で、前段と後段に分けて流した。前段は `pnpm test` (P06)、後段は `pnpm typecheck` から `preview:smoke` までの 13 段 | どちらも exit 0 (前段 1148 秒、後段 334 秒)。1 回目の後段は financial-routes が 504 で exit 1 になり、再実行で成功した (後続課題の vite の件)。分けたのは、途中の段で落ちたときに `pnpm test` を流し直さずに済ませるため。CI は PR を作った後に確かめる |

#### P08 監査

| 観点 | 確かめ方 | 結果 |
|---|---|---|
| 名寄せの経路 | `matchSubVendor(` の呼び出しを grep | 4 か所 (core の `subs.ts`・`dataset.ts`・`expense-projection.ts`、api の `store.ts`)。照合一覧はどれも `resolveVendorMerges` の結果から作る (`store.ts` の読込と backup の復元・`subs-screen.ts`・`subscription-writes.ts`、候補の判定は `subs.ts` の `matchableVendors` 経由) |
| 失敗の文言 | サブスク画面の `describeError` を grep | 0 件。失敗の文言は `operationText.ts` の `classifyWriteError` だけが決める |
| 統合先の選択欄 | 詳細パネルの「統合先」を grep | JSDoc の 2 件だけで、選択欄は選択バーだけに置く (FR-004) |
| 色 | `packages/web/src` の hex の直書きを grep、`pnpm lint` | 0 件、lint は成功 |
| 選択の型 | `Subscriptions.tsx` | `selectedKeys` は重複を持たない `string[]` (「設計から変えたこと」の 4) |
| 変更の範囲 | `git status` の変更ファイルを各 phase の `resource_scope` と照合 | 当時は `check-financial-visuals.mjs` の 1 件と記録したが、数え直すと 4 ファイル (下の P10) |

#### P09 アクセシビリティ・ログ・予算・変異テスト

| 観点 | 確かめ方 | 結果 |
|---|---|---|
| 全選択の mixed | web DOM 1249、画面シナリオ | 一部を選ぶと全選択は native の `indeterminate` (支援技術には mixed)、表示中の行をすべて選ぶと checked。P09 の受入の旧記述「aria-checked の mixed」は、正本の spec (Accessibility/Usability) に合わせて訂正した。native の `indeterminate` で示し、`aria-checked` を重ねない。テストは `aria-checked` が付いていないことも確かめる |
| フォーカス | web DOM 1344、画面シナリオ | 詳細の「名称を統合」を押すと、選択バーの統合先の選択欄へ移る。統合が完了すると見出し「操作」(`h2#subs-operations-title`) へ移る |
| 状態の文字 | 画面シナリオの操作欄 | 「完了」「元に戻しました」を文字で出し、色だけに頼らない |
| ログ | api 1122 | 1 行のキーは level・event・requestId・operationId・kind・result・durationMs・actorId の 8 つで、集合として固定する。取引名・別名・email・金額は出ない |
| 一覧の秘密 | api 1075 | 本文・変更前・key を返さない |
| 問い合わせの数 | api 428 | 統合と取り消しは、認証とスキーマ確認のぶんを除いて 20 未満 |
| JS の量 | `pnpm build:bundle` の直後に js-budget | 108.44 KiB / 110 KiB |

書込みの待ち行列は、実装をわざと壊して (変異) テストが落ちることを確かめた。壊した後はファイルのハッシュで元に戻ったことを確かめた。

| 変異 | 落ちたテスト |
|---|---|
| 1. revision の衝突の後に key を作り直さない | `useSubscriptionWrites.dom` 6 件中 2 件 (衝突 1 回の後に新しい key と最新の base で送り直す・4 回続いたら上限) |
| 2. mutation の `scope` を外す | 同 6 件中 1 件 (続けて積んだ操作は前の応答と取り直しを待ち、その revision を base にする) |
| 3. busy を `SERVER_FAILED` に戻す | 流した 68 件中 3 件 (busy は上限の後も再試行つきの失敗・1・2・4 秒で 3 回まで) |
| 4. 送る直前ではなく押した時点の本文を使う | 流した 68 件中 2 件 (対象科目の足し外し・別名の除去は送る直前の一覧に当てる) |

#### P10 最終レビューの指摘

| 重さ | 指摘 | 扱い |
|---|---|---|
| 高 | `subsCandidates` が統合元の名前を根へ畳まずに登録済みかを判定し、統合後も統合元に似た支払先が未登録の候補に出続けた | `matchableVendors` で根へ畳んでから判定するよう直した。設計レビューの 15 を訂正した |
| 中 | 統合先の登録で選択がすべてその登録にまとまると、統合できない選択バーが理由を示さないまま残る行き止まりになった | 選択を消し (web DOM 1755)、統合のボタンを押せないときは理由をボタンの説明 (`aria-describedby`) に出す (1775)。修正を外すと 2 件が落ち、常に選択を消す過剰な変更では 1730 が落ちる。FR-021 は統合の完了で選択を消すことだけを定めており、登録で選択がまとまったときに消すのはそれを超える挙動である |
| 中 | ログのテストが禁止語の不在しか見ておらず、余計なキーが増えても通った | キーの集合を `Object.keys(entry).sort()` で固定した。キーを 1 つ足す変異で 1 件が落ちる |
| 中 | overloaded の判定と置き場所が設計と違う | 「設計から変えたこと」の 6 |
| 中 | 統合先の削除で集めるまとまりが、docs の batch 表 (再帰 CTE) と実装 (読み取り後の不動点ループ) で違った | 「設計から変えたこと」の 7 として docs を実装に合わせた |
| 低 | (b1) の `UPDATE … FROM` は本番の D1 で確かめていない | 「設計から変えたこと」の 8。本番での確認は P13 |
| 低 | 未登録の候補の採用と除外を 1 本のテストで見ていた | 除外 (web DOM 1683) と採用 (1696) に分けた |
| 低 | 描画の検査 (`check-financial-visuals.mjs`) が `/api/subscription-operations` の疑似応答を持たず 401 になった | 疑似応答 `{ operations: [], revision: 0 }` を足した。`resource_scope` の外の変更は表の下に一覧する |
| 情報 | 画面シナリオで、統合先の key が `notion` のまま名前が「テスト業務」になった | 欠陥ではない。ベンダー名は最頻の生の取引名 (U-6) |

FR・BR と実装の対応は、上の「要件と検証手段」の表の「実装の場所」と「検証手段」の列にまとめた (P12)。
AC は spec の AC 一覧を正とし、テストに付けた札 (`AC-0xx`) から次のように対応を取った。AC の番号は他の画面のテストにもあるので、
サブスク統合のテストだけを数えた。api は `subs-merge-operations.integration.test.ts` (merge-ops) を指す。
行番号はテストを足すたびにずれるので、describe か it の名前で指す (`grep -n` で引ける)。上の P07〜P10 の行番号は記録した時点のもの。

| AC | テスト (describe か it の名前) |
|---|---|
| AC-001 | api merge-ops「統合 (AC-001・AC-002)」・`subs-screen.integration`「統合と revision (AC-001・AC-018)」・core `subs-screen-contract`「統合した行の表示 (AC-001・AC-002 の core 側)」 |
| AC-002 | api merge-ops「統合 (AC-001・AC-002)」・`subs-vendor-scope`「統合後の候補一覧 (AC-002)」・core `subs-contract`「統合後の照合の一致 (AC-002 の core 側)」・`subs-screen-contract`「統合した行の表示」 |
| AC-003 | core `subs-contract`「統合の解決 (resolveVendorMerges・AC-003)」 |
| AC-004・AC-005 | api merge-ops「連続と同時 (AC-004・AC-005)」の 3 件 (連続・同時・2 人) |
| AC-006 | api merge-ops「Idempotency-Key (AC-006・BR-007)」 |
| AC-007・AC-008 | web DOM「行チェックと全選択: …(AC-007)」・「選択バーは件数・チップ・…(AC-008)」 |
| AC-009〜AC-011 | web DOM「処理中に積んだ統合は待機中として並び…(AC-009)」・「統合を元に戻すと取り消しの記録が付き…(AC-010)」・「処理中は行チェック・全選択・…(AC-011)」 |
| AC-012 | api merge-ops「テナントに無い id は 404 で、他テナントの行は変わらない (AC-012)」・「他テナントへ付け替えた操作は取り消せず 404 (AC-012)」 |
| AC-013 | api merge-ops「取り消し (AC-013・…)」の「別の利用者の統合を取り消すと、統合前と同じ行・月額・subs 範囲に戻り…」 |
| AC-014 | api merge-ops「revision の衝突 (AC-014・BR-008)」 |
| AC-015・AC-016 | web DOM「busy は 1・2 秒待って同じ key で自動再試行し…(AC-015)」・「詳細の「名称を統合」から統合先を選んで統合すると…(AC-016)」 |
| AC-017 | api merge-ops「同じ統合先への後続の統合があると先の取り消しは 409 blocked で…(AC-017)」 |
| AC-018 | api merge-ops「既存の書込み 9 本 (AC-018・互換)」・`subs-screen.integration`「統合と revision (AC-001・AC-018)」 |
| AC-019 | api merge-ops「29 日前の統合は取り消せ…(AC-019)」・「掃除 (BR-013・AC-019)」 |
| AC-020 | api merge-ops「操作の一覧」の「新しい順に返し、本文・変更前・key を含めず…」・「ログ (AC-020)」 |
| AC-021 | web DOM「revision の衝突は取り直してから新しい key と最新の base で送り直す (AC-021 A)」・「送り直す前に統合元が他の操作で変わっていたら…(AC-021 B)」 |
| AC-022 | web DOM「記録は操作者と取り消した人を出し…(AC-022)」 |
| AC-023 | テストの札は無い。`verify:full` の各段 (P07 の U5)。CI は PR を作った後 |

P10 の受入は `resource_scope` の外の変更を 0 件とするが、実際は次の 4 ファイルが外れる (P08 の照合の後に、作業ツリーの差分で数え直した)。

| ファイル | 中身 | サブスク統合との関係 |
|---|---|---|
| `packages/web/scripts/check-financial-visuals.mjs` | `/api/subscription-operations` の疑似応答と、Matrix 画面の待ち条件 (`MATRIX_READY`) | 疑似応答は必要。待ち条件は検証の安定化 (下記) |
| `packages/web/src/mobile-financial-visualization.dom.test.tsx` | `/api/subscription-operations` の疑似応答 | 必要 |
| `packages/web/src/diagnosis-next-action-receivers.dom.test.tsx` | `/api/subscription-operations` の疑似応答 | 必要 |
| `packages/web/src/mobile-financial-visualization-render.test.ts` | Chrome の shard を 3 から 7 に分け、待ち時間を計算式にした | 検証の安定化 (下記) |

サブスク画面が新しく `/api/subscription-operations` を読むようになったので、画面を描く検査とテストにその疑似応答が無いと 401 で落ち、
AC-023 (`verify:full` が緑) を満たせない。2 つの受入は両立しないため、AC-023 を優先して疑似応答の 3 件を残した。
残る 2 件 (待ち条件と shard の分割) は、この機能の `verify:full` の財務実描画を安定させるために elegant review で足した。641px で一時的な幅 0 を測って落ちたため、遷移先・DOM への接続・正の寸法を待つ条件を加えた。また、最初の shard が 420 秒の上限に届いたため、検査対象と個別の上限は保ったまま幅を 2 つずつに分けた。合否の基準 (12rem と横スクロール) は変えていない (根拠は `evidence/subscriptions-merge/elegant-review.md`)。

#### P11 この記録の扱い

この節は P06〜P11 の索引で、生のログを指す代わりに件数と結果を持つ。ログの置き場所 (ローカルの絶対パス) と
接続先のホスト名はここに書かない。

### 並列レビュー後の追加検証索引

以下は担当からの完了報告とコード・テストの照合で更新する索引。従来のP06〜P11の成功件数へ加算せず、全体検証とCIは親担当の結果を待つ。

| 対象 | 現行契約への入口 | 検証先・状態 |
|---|---|---|
| Dataset経由の統合元完全一致 | spec FR-008。optional派生exactNamesをloader・clone・period・backup再構成で保持し、永続形式へ追加しない | core担当最終1,304 PASS。API loader2経路とbackup経路の付与もAPI担当完了報告あり。本書編集では再実行なし |
| web履歴障害とcache整理 | spec FR-018。履歴内の再取得、operation idの確認と失敗entry不存在を条件に成功mutationだけ整理 | `useSubscriptionWrites.dom.test.tsx`・`subscriptions-screen.dom.test.tsx`。web担当完了報告あり、本書編集では再実行なし |
| web入力・タブ・共通の再取得範囲 | spec「入力・再取得・タブの追加契約」。未編集値の同期、名称120文字、AccessibleTabs | 同上。型コード・無効化一覧は本書へ複製しない |
| API復元・replay・読取保護とbackup往復 | spec BR-007・009、API共通読取契約、データモデル・互換性 | API担当完了報告: 5ファイル155 PASS、API typecheck成功、Biome10ファイル成功。API全体suiteは親担当が実行中、CIは未確認 |

#### 重複の整理と抜けの補い (elegant review)

並列レビューの後に、重複を共通の入口へ寄せ、見つかった抜けを補った。応答の形が変わったのは表の 3 行 (★) だけで、他は応答のバイト列を変えない。

| 対象 | 変えたこと | 検証 |
|---|---|---|
| 他画面の集計の反映 | 統合・取り消し・ベンダーの定義を変える書込みの後に、既存の `invalidateAnalysisDerived` で他画面の派生分析も古い扱いにする (`useSubscriptionWrites.ts` の `AFFECTS_TOTALS`)。見直し判断・科目・見直し日・除外は集計を変えないので呼ばない。取り直しを待たずに書込みを終える | `useSubscriptionWrites.dom` の「集計を変える 6 操作」「変えない 4 操作」「取得が終わらなくても書込みは完了する」。呼び出しを外すと落ちる |
| busy の待ちの共有 | 取り直しの GET と送信前の準備が busy・503 を返したときも、送信と同じ 1・2・4 秒の待ちと上限 3 回に乗せる | `useSubscriptionWrites.dom`。旧実装では落ちる |
| 本文の組み立ての失敗 | 送信直前の本文の組み立てで例外が出たら「サーバー側で処理に失敗しました」ではなく画面側の失敗 (`CLIENT_BROKEN`) として出す | `operationText.test.ts`・`useSubscriptionWrites.dom` |
| ★ 統合先が統合元の子孫のとき | 422 `merge_cycle` から 409 `subscription_revision_conflict` へ (BR-001 が先。上の BR-005 の注) | api merge-ops「統合元の子を統合先に選ぶ循環 (BR-005) も…」。旧実装では 422 で落ちる |
| ★ 読取りの no-store | `Cache-Control: private, no-store` を読取りの snapshot が一律に付ける。候補の 200 と詳細の 404 にも付く | `subs-screen.integration`「サブスクの読取りは成否を問わず保存させない (Cache-Control: no-store)」 |
| ★ 登録の再送 | 同じ key の登録の再送でも、作った行の `id` を返す (`vendor_create` だけ。他の種類は適用時に計算した値を復元できないので返さない) | api merge-ops「登録の再送も同じ id を返し (replayed: true)、登録は 1 件だけ」 |
| GET の問い合わせ数 | revision を snapshot が読んだ値から渡し、各 GET で 1 本減らした (`/subscriptions` 21→20、`/sub-vendors` と `/subscription-operations` 7→6) | api merge-ops「各 GET の snapshot 検査を含む実D1問い合わせは50未満に収まる」 |
| 操作の時刻 | 操作欄の時刻を、東京時間の固定ではなく閲覧者のローカル時刻で「10/1 12:23」の形にする (`format.ts` の `shortDateTime`) | web DOM「操作の時刻は最終更新と同じく閲覧者のローカル時刻で…」。旧実装は TZ=UTC で落ちる |
| 重複の除去 (api・web) | `errorBody`・`PRIVATE_NO_STORE` は `public-validation.ts`、409 busy は `canonicalWriteBusy`、取り消しできない理由の文言は core の `SUBSCRIPTION_UNDO_BLOCKED_MESSAGE`、口座と分類の上限は core の定数 (登録と JSON 復元が同じ値で検査する)、`vendor_update` の要求は `writeRequests.ts` の `vendorUpdateIntent`、URL の vendor の書換えは `Subscriptions.tsx` の `setVendor` に 1 か所ずつ寄せた。取込の取り消しの 409 も `canonicalWriteBusy` を使うので、本文は同じまま no-store が付く | typecheck・biome と関連テスト |
| 読込み時の名寄せ (core) | 統合を解いた結果から `data.subs` の 3 つの表 (aliases・exactNames・accounts) を作る処理を core の `subsDefinitionsOf` に、`subs:<名前>` の scope から名前を取る処理を `subsVendorOfScope` に寄せた (読込み・backup の組み立て・JSON 復元・`projectSubsAggregate` の 4 経路)。JSON 復元の `mergeRestoreCanonicalSources` は統合の解決を必須の引数にし、届かない予備の計算を消した | core `subs-contract`「解決済み一覧から Dataset.subs の表を作る (subsDefinitionsOf)」「monthly_agg の scope からベンダー名を取り出す (subsVendorOfScope)」。`biz_exp:subs:…` を名前と取り違える実装は落ちる |
| revision の読み方 | 状態の読取り・読取りの stamp・登録の CAS が、行の無い利用者を 0 と読む同じ式 (`subscription-writes.ts` の `revisionOf`) で比べる。版を進める文は、操作の記録を条件にする書込み側と、無条件に 1 足す復元側で意味が違うので分けたまま | api merge-ops・`subs-screen.integration` |

統合先の名前を引く処理は backup の組み立てと JSON 復元の 2 か所に残した。見つからないときの値が「項目を省く」と `null` で違い、寄せると backup の JSON の形が変わるため。

### 範囲外

本サイクルは次を扱わない。

1. 他画面 (概要・総収支・推移など) のデザインの作り直し。名寄せの共通化による集計の一致だけを扱う
2. freee / マネーフォワードの取込方式の変更
3. 他画面の合計へのカード・銀行の未照合明細の算入
4. AI による自動統合。候補と検出理由は出すが、統合の確定は利用者の操作だけで行う
5. Web 以外の専用アプリ
6. Durable Objects・Queues・新しい有料サービス・新しい夜間 job
7. 楽観更新。書込みが成功してから取り直す
8. 取り消しの権限を role や操作者で分けること

## 後続課題

- AI 指示文の候補 (`subsCandidates` 上位 10 件・全期間・判断を見ない) と画面の見直し候補の定義をそろえるか、
  別物として AI 側の説明に明記するかを決める (OI-03)。
- 判断をどの期間の指紋で保存するか。いまは表示中の期間。直近 1 年以外で判断するとバッジが減らないことがある。
- 推定月額は統合後の明細から再計算する。異なる最終支払月と年額・月額混在の両方で統合前の合計300→統合後200となる既存回帰を採用する。実支払額は各月で保存し、推定値の加法性は保証しない。
- `verify:full` の financial-routes が、手で起こした画面 (3000 番) と検査用の vite (4175 番) を同時に動かすと
  504 で落ちることがある。どちらも `packages/web/node_modules/.vite/deps` の依存の事前ビルドを共有するため、
  片方の再ビルドの間にもう片方の要求が待たされると推定している (再実行で成功する)。検査用の vite に別の
  `cacheDir` を渡すかを決める。
- 選択バーの「選択を解除」と × を押すとバーが消え、フォーカスが本文 (body) に落ちる。本サイクルより前からの挙動で、
  統合の完了時 (見出し「操作」へ移す) と同じ戻し先を持たせるかを決める。
- 統合元の古いリンクやブックマーク (`?vendor=<統合元>`) は、いまは一覧へ戻すだけで統合先の詳細へは付け替えない。
  付け替えるには応答の型に「統合元のキー → 根のキー」を足す必要がある。
- データがあるときの背景の取り直しが他の利用者の書込みと重なって 409 busy になると、一覧が全画面のエラーに差し替わる。
  一覧を残したまま、その場で再取得を促す表示に変えるかを決める (前サイクルの挙動を変えるため保留)。
- 操作欄の見出しを、種類にかかわらず対象の名前入り (「Notion を除外」など) にするか。文言表は architecture の UI-UX が契約なので、そちらを先に改める。
- 再送を使い切ったときの文言で、取込みが進行中かもしれないことを伝えるか。lease は取込と共有で、突合の画面は同じ場面を「取込中のため保存できませんでした」と言う。
  文言は spec に合わせた経緯がある (設計レビューの 14)。
- `applyFreeeDeals` が subs を埋めた直後に `replaceSubsProjection` が照合をもう一度走らせて上書きする。増えるのは CPU だけで、
  D1 の問い合わせは増えない。`applyFreeeDeals` に subs を計算しない指定を足すかを決める。
- 選択の状態 (選んだ行・取引名・統合先・新規登録した統合先) を `Subscriptions.tsx` から 1 つのフックへ移し、
  `SelectionBar` の 15 個の props を 5 個程度へ減らす。選択・統合・登録の流れ全体を作り直す変更になるため、本サイクルでは分けた。
- `['auth']` の取得の書き方が web の 8 か所に並ぶ (この機能では `useSubscriptionWrites.ts` の 1 か所)。`App.tsx` と `UserAdmin.tsx` だけが
  `retry: false` を付けるので、共通の `queryOptions` に寄せるときは 8 か所をまとめて置き換える。この機能だけ先に寄せると書き方が 3 通りになる。
- 書込みを確定する直前の `merge_cycle` (422) は、保存済みの統合がすでに循環しているときだけ起きる最後の守りで、API の検査と
  JSON 復元の `restoreMergeReferencesClosed` を通る限り届かない。画面の文言は自己統合の場合の文 (「統合先が統合元に含まれる」) なので、
  統合以外の操作で届いたときの言い方を分けるかを決める。
- 操作の種類が core の型・`db/schema.ts` の enum・migration 0058 の CHECK の 3 か所にある。0058 は変えられないので、
  core と schema の一致を型かテストで固定する。
