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

サブスク画面を、『毎月の固定費に重複や見直し候補はありますか？』という問いに 1 画面で答え、見直すべき契約を見つけてその場で決着 (名称の統合・候補の採用 / 除外・見直し候補として確認) まで進められる場にする。利用者が銀行口座・クレジットカード・電子マネーの取引から検出された継続的な支払いを、月額・年換算・カテゴリ・データの出典つきで一覧し、見直し候補の理由を読み、同じサービスの表記ゆれを 1 つにまとめられる状態にする。

## U2 背景 (background)

現行の /subscriptions (packages/web/src/pages/Subscriptions.tsx、305 行) は、重複・急増アラート、KPI 4 枚 (最新月の実支払・年換算・直近 12 か月の実支払・売上比)、データ元の 1 行注記、ベンダー別の表 (直近月額 / 平均月額 / 支払月数 / 直近 12 か月 / 年換算)、ベンダー別の月次積み上げ棒、ベンダー別の前年比較表、登録ベンダーの編集パネル (別名・対象科目・四半期見直し)、未登録候補パネルを縦に並べた画面である。design/FINAL-UI/images/09-subscriptions.png が示す構成 (問いの見出し、前期間比つき KPI 5 枚、データソースのカバー率、ベンダー名と正規化名とカテゴリを持つ一覧、右の詳細パネル、見直し候補の検出理由、カテゴリ別の推移と年換算比較、下部の選択バー) とは大きく離れ、design/FINAL-UI/spec/AUDIT.md も『09 サブスク | 不足あり』と判定している。カテゴリの仕組み、見直し候補の判定、口座種別 (銀行 / カード / 電子マネー) の区別、名称統合と見直し判断の保存、サブスク用の前期間比はいずれもコードに存在しない。検出 (core/src/subs.ts の vendorKey / matchSubVendor / subsCandidates / subsConfidence) と集計 (core/src/analysis.ts の subscriptions、expense-projection.ts の sourceNeutralSubscriptions) は既にあり、これを土台にする。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | /subscriptions を 09-subscriptions.png どおりの画面にする。問いの見出し『毎月の固定費に、重複や見直し候補はありますか？』と説明文、KPI 5 枚 (月額のサブスク合計・年換算の合計・直近 12 か月の支払額・売上比・見直し候補 N 件。月額と年換算は前期間比つき)、データソースのカバー率カード (銀行口座 / クレジットカード / 電子マネーの % と取込済み口座数) と最終更新・再取得、サブスク一覧 (ベンダー名・カテゴリで検索、ステータス絞込、行チェック、列=ベンダー名 / 正規化名 / ソース数 / 最新の金額 / 月額の推定 / 年換算 / カテゴリ / 候補、合計行)、月次のサブスク支出推移 (カテゴリ別の積み上げ棒と凡例)、年換算の比較 (カテゴリ別の月額 / 年換算 / 構成比 / 前期間比と合計行) を、既存のデザイントークン・共通 Button・PageShell・期間タブ (usePeriod) の上に組む。読込・空・失敗の各状態を持つ。ロゴ (サービスのアイコン) 画像は取得も表示もしない。 |
| G2 | 一覧で選んだサブスクの『サブスクの詳細』パネルを実装する。正規化名・カテゴリ (変更可)・見直し候補バッジ、概要 / 取引履歴 / 関連データのタブ、正規化された名称 (編集可)、マッチした生の取引名 (チェックとソース種別)、月額の推定と年換算、直近の取引 3 件と『すべて見る (N件)』、データソース別件数、『名称を統合』『候補として確認』を出し、閉じるで解除できる。生の取引名を選ぶと画面下部に『N件の取引を選択中』バー (選択チップの解除・選択した N 件を統合・選択を解除) を出す。 |
| G3 | 『見直し候補』を core の純関数で決定論的に判定し、KPI の件数・一覧の候補バッジ・『サブスク候補の検出理由』カードに同じ結果を出す。理由は AI を呼ばず、同じカテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ などの規則を判定し、金額・件数・月数を差し込む定型文で生成する。カードから『候補を採用』『候補から除外』『この候補を詳しく見る』を操作できる。規則と文テンプレートを docs に明記しテストで固定する。 |
| G4 | サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。 |
| G5 | 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | サブスク画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出しと説明文・KPI 5 枚と前期間比・カバー率カード 3 区分と最終更新と再取得・一覧 (検索 / ステータス絞込 / 9 列 / 合計行)・カテゴリ別推移の凡例と棒・年換算比較表 (合計行つき) が描画され、読込・空・失敗の状態テストが緑である。ロゴ画像要素が 0 件である。 |
| O2 | 行を選ぶと詳細パネルが開き、統合と確認の操作ができる。 | DOM テストで、行選択→詳細パネル (3 タブ・正規化名・生の取引名・月額推定・直近の取引・データソース・2 操作) 表示、生の取引名 2 件選択→下部バー『2件の取引を選択中』表示→統合 API 呼出し、閉じる / 選択を解除で状態が戻ることが緑である。 |
| O3 | 見直し候補の判定と理由文が規則どおりに出る。 | core の単体テストで各規則の境界値と理由文テンプレートが固定され、KPI 件数・一覧バッジ・検出理由カードの件数が同一入力で一致する。 |
| O4 | 画面の数値が core の 1 か所から出て既存と一致する。 | core 単体テストで推定月額・年換算・前期間比・カバー率・カテゴリ別集計の境界値が緑、API 統合テストで GET /subscriptions の新しい形が返り、合計行 = 行の和、カテゴリ別合計 = 一覧合計、直近 12 か月の支払額が既存 last12Total と一致する。 |
| O5 | 保存と旧機能の移設が壊れずに完了する。 | migration 0043 がローカル D1 に適用でき、統合・採用・除外・確認・カテゴリ変更の API 統合テストが緑、旧パネルのテストが新しい置き場所のテストへ移されて機能の欠落が 0 件、サイドバーのバッジ件数が画面の候補件数と一致する。 |

## U5 成功基準 (success_criteria)

- S1 (G1): /subscriptions で 09-subscriptions.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件、ロゴ画像の取得・表示が 0 件である。
- S2 (G2): 任意の行を選ぶと詳細パネルが同じ行の月額推定と年換算を示し、生の取引名を選んで統合すると aliases に反映され、再読込後も同じベンダーにまとまって表示される。
- S3 (G3): 見直し候補の規則と文テンプレートが docs に明記され、境界値テストで固定され、KPI 件数・一覧バッジ・検出理由カードが同じ件数を示す。
- S4 (G4): 一覧の合計行・カテゴリ別比較の合計・KPI の月額合計が互いに一致し、直近 12 か月の支払額と売上比が既存関数の値と一致する。数値の正本は core が算出する検算済み fixture であり、画像の数値は写し取らない。
- S5 (G5): migration 0043 適用後に既存の登録ベンダー・除外・見直し日時が失われず、旧 UI にあった操作がすべて新しい画面から実行できる。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (単独の個人事業主): 月次クローズの『整える』段階で、毎月の固定費に重複や不要な契約がないかを 1 画面で確かめ、表記ゆれを 1 つにまとめ、見直し候補を採用 / 除外して決着させたい。家計と事業の両方の支払いを同じ画面で見たい。
- SH2 保守者 (同一人物、および Claude Code などのコーディングエージェント): 推定月額・カテゴリ・カバー率・見直し候補の規則が core の純関数 1 か所と docs・テストで固定され、総収支・推移・サイドバーのバッジと二重実装にならないこと。

## U7 スコープ (scope)

- **対象 (in)**: サブスク画面 (09-subscriptions.png の全構成要素と読込 / 空 / 失敗の各状態) の作り直し, サブスクの詳細パネル (3 タブ・名称編集・生の取引名・直近の取引・データソース・名称を統合・候補として確認) と下部の選択バー, 見直し候補の決定論判定・定型文の理由・検出理由カード (採用 / 除外 / 詳しく見る), core の純関数: 推定月額・年換算・前期間比・カテゴリ既定辞書・口座名 3 分類とカバー率・カテゴリ別推移と年換算比較, GET /subscriptions の拡張と、統合・カテゴリ変更・見直し候補の確認を保存する API, migration 0043 (sub_vendors.category と見直し判断の保存), 旧 UI (登録ベンダー編集・四半期見直し・アラート・前年比較表・候補パネル) の新しい部品への吸収と撤去
- **対象外 (out)**: サービスのロゴ・アイコン画像の取得と表示 (利用者指示によりコスト回避), 外部サービス・AI による分類や理由文の生成, サイドバー / ヘッダー / フッター / 月次クローズ進捗の構造変更, 他の画面 (総収支・推移・マトリックス・診断など) の作り直し, web 以外のプラットフォーム

## U8 制約 (constraints)

- C1 技術: pnpm monorepo (core は依存ゼロの純関数、api は Hono の Cloudflare Worker と D1/Drizzle、web は React 18 + react-router-dom 7 + TanStack Query 5)。集計・判定は core に置き api/web へ重複実装しない。
- C2 デザイン: docs/design-system.md に従い、色は design-tokens.ts 由来のトークンだけ、ボタンは共通 Button (遷移は Link className=btn)、本文は PageShell。カテゴリの色も既存の系列パレットから当てる。
- C3 データ: 取込データは外部送信しない。カテゴリ辞書・口座 3 分類の手がかりはコード内の固定表で持ち、外部 API を呼ばない。
- C4 DB: 破壊的な行書き換え migration をしない。0043 は列と表の追加だけにし、既存の sub_vendors / sub_vendor_exclusions の行を保つ。
- C5 数値: 画像の数値は閉じていない (一覧 8 行の月額合計 ¥9,778 に対し合計欄 ¥64,800) ため、画像は構成・文言・配置の正本、数値は core が算出する検算済み fixture を正本とする。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | Subscriptions.tsx を、問いの見出し・KPI 5 枚・カバー率カード・一覧 (検索 / ステータス絞込 / 候補バッジ / 合計行)・カテゴリ別推移・年換算比較・右の詳細パネル・検出理由カード・下部の選択バーの構成に作り直し、選択中のサブスクを URL に保つ。 | G1, G2 |
| I2 | 詳細パネルで正規化名とカテゴリを編集し、生の取引名を選んで『選択した N 件を統合』で既存ベンダーの aliases に加えられるようにする。 | G2, G5 |
| I3 | core に見直し候補の判定関数と理由文テンプレートを置き、KPI・一覧・検出理由カード・サイドバーのバッジが同じ関数を使う。 | G3, G4 |
| I4 | core に推定月額・前期間比・カテゴリ辞書・口座 3 分類とカバー率・カテゴリ別集計の純関数を置き、GET /subscriptions がそれを返す。 | G4 |
| I5 | migration 0043 で sub_vendors に category を足し、登録済みベンダーの見直し候補への判断 (確認 / 除外) を保存する表を足して、既存の除外・見直し日時と一緒に扱う。 | G5 |
| I6 | 旧 SubVendorsPanel / SubsCandidatesPanel / アラート / ベンダー別前年比較表を撤去し、その操作を詳細パネル・検出理由カード・ステータス絞込へ移したうえで、既存テストを新しい置き場所へ移す。 | G5 |
| I7 | 検算済み fixture と見た目検査 (check-financial-visuals) を新しい構成へ更新し、ロゴ画像が無いことも検査する。 | G1, G4 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-subscriptions-002`

G5 と I5 の改訂を利用者が承認 (2026-09-18T06:51:17Z、AskUserQuestion で改訂前後の文面を preview で提示し『この文面で承認する』を選択)。改訂は『採用』を未登録候補 (sub_vendors 登録 / sub_vendor_exclusions) と登録済みベンダーの見直し候補 (確認 / 除外を migration 0043 の判断表へ) で書き分ける 2 か所だけで、ほかの U1-U9 は appr-foundation-subscriptions-001 の承認のまま変えない。basis=user-decision。

#### この承認を名指ししている質疑: `qa-subs-database-web-006`

**問**

web のサブスク画面の database 要件のうち、agent が補完した設計判断は何か。

**答**

(1) migration 0043 は追加だけにする — sub_vendors に category TEXT NULL (NULL は既定辞書に従う) を ADD COLUMN し、sub_vendor_review_decisions (id, user_id, vendor_key, decision は confirmed / dismissed のいずれか (登録済みベンダーの見直し候補への判断だけを持つ。未登録候補の採用 / 除外は既存の sub_vendors / sub_vendor_exclusions に保存する), rule_fingerprint, decided_at、(user_id, vendor_key) 一意) を CREATE TABLE する。既存行は書き換えない。(2) 判断には判定時の規則の指紋を保存する。指紋は当たった規則の種類すべてを表示順に並べたものと判定時の基準金額から作り、月は含めない。指紋が同じなら月が変わっても判断を保ち、金額が変わるか新しい規則が加わったときだけ判断を無効にして未判断の候補へ戻す。(3) 統合は既存の aliases 配列への追加で表し、統合の取り消しは配列からの削除で表す。(4) 口座の種別は保存しない (口座名から毎回導出する)。(5) Drizzle の schema.ts を migration と同じ内容に更新し、ローカル D1 への適用で確かめる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存 schema と過去の migration の書き方 (追加のみ・行の書き換えをしない) の読解にもとづく agent の設計判断。 qa-subs-database-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

#### この承認を名指ししている質疑: `qa-subs-frontend-web-006`

**問**

web のサブスク画面の frontend 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 画面は数値を再計算しない。KPI・一覧・合計行・カテゴリ別推移・年換算比較・候補の判定と理由文は API が返した値をそのまま描く。(2) 取得は 2 本に分ける。画面全体は GET /api/subscriptions (期間つき) の 1 本、詳細パネルは選んだベンダーについて GET /api/subscriptions/vendors/:key を選択後にだけ取得する (TanStack Query の依存クエリ)。(3) 変更 (統合・カテゴリ変更・未登録候補の採用 / 除外・見直し候補の確認 / 除外とその取消・四半期見直し) の成功後は、サブスク一覧・詳細・サイドバーのバッジ (reviewQueue) のクエリを無効化して揃える。(4) 部品は pages/subscriptions/ 配下に Kpis / CoverageCard / SubscriptionTable / DetailPanel / CategoryTrendChart / AnnualComparison / ReasonCard / SelectionBar として分け、照合画面の DetailPanel と SelectionActions の作りを踏襲する (共通化は 2 画面目の本サイクルでは行わず、同じ形を保つ)。(5) 旧 SubVendorsPanel / SubsCandidatesPanel は撤去し、その操作を DetailPanel の『関連データ』タブと ReasonCard へ移す。旧テストは新しい部品のテストへ移し替える。(6) 色はデザイントークンと既存の系列パレットだけを使い、カテゴリの色は固定順で割り当てる。 (7) 検出理由カードの『候補を採用』と詳細パネルの『候補として確認』は同じ confirmed を送る。未登録候補の行では、採用は登録、除外は除外の既存 API を呼ぶ。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存の web の構成 (照合・推移・マトリックス画面の分割と取得の分け方) の読解にもとづく agent の設計判断。 qa-subs-frontend-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

#### この承認を名指ししている質疑: `qa-subs-uiux-web-006`

**問**

web のサブスク画面の UI-UX 要件のうち、画像から一意に決まらず agent が補完した部分は何か。

**答**

(1) 縦の並びは画像どおり 見出し → KPI 5 枚 → カバー率 → 一覧と右の詳細パネル → 推移と検出理由 → 年換算比較 とし、task 頻度 × 失敗コストで最上位の『見直し候補がいくつあるか』を KPI 5 枚目と一覧の候補バッジの 2 か所で先に読ませる。(2) 詳細パネルは一覧で行を選んだときだけ開き、選択は URL (?vendor=<照合キー>) に保って再読込でも復元する。× で閉じると URL から消す。(3) 詳細パネルのタブは WAI-ARIA の tabs パターン (左右の矢印キーで移動、Tab でパネルへ) で作る。(4) ステータス絞込の選択肢は『すべてのステータス / 見直し候補 / 登録済み / 未登録の候補』とし、旧 UI の未登録候補パネルの役割を『未登録の候補』へ移す。確認済みにした見直し候補は一覧に残し、候補バッジを『確認済み』に変える (KPI の件数とサイドバーのバッジには数えない)。(5) 旧 UI の別名・対象科目の編集と四半期見直しは詳細パネルの『関連データ』タブへ、重複・急増アラートは検出理由カードへ移す。(6) ロゴの位置には何も置かず、ベンダー名の頭文字も描かない (画像取得をしないため、代替の図形で場所を取らない)。(7) KPI 2 枚目の補足は『売上に占める割合』と書く (利用者判断 qa-subs-kpi-caption-001)。(8) 読込中は各カードの骨格を保つ表示、データ 0 件は一覧の位置に空状態、取得失敗は PageState の error とする。色だけで区別させず、候補バッジと前期間比の増減には文字と記号を必ず併記する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 参照画像・既存の PageShell / PageState / KpiCard の使い方・既存画面 (照合 / 推移 / マトリックス) の選択と URL 保持の慣例からの agent の設計判断。(7) の文言は利用者判断 qa-subs-kpi-caption-001 に従う。 qa-subs-uiux-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

#### この承認を名指ししている質疑: `qa-subs-security-web-006`

**問**

web のサブスク画面の security 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 新設 API の入力はすべて Zod で許可リスト検証する — vendorKey は長さ上限つきの文字列、aliases は 1〜50 件・各 1〜100 文字の配列、decision は confirmed / dismissed の列挙、category は既定辞書のカテゴリ名の列挙か 1〜20 文字の自由記述。(2) 取引名・ベンダー名は利用者が取り込んだ外部由来の文字列なので、画面では React のテキストとしてだけ描き、HTML として挿入しない。(3) カテゴリ辞書と口座の手がかりはコード内の固定表で持ち、判定のために外部へ問い合わせない。(4) 更新系は :id / :key を userId と組にして引き、見つからなければ 404 を返して他の利用者の存在を示さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存の検証の書き方と OWASP ASVS の入力検証・出力エンコードの指針からの agent の設計判断。 qa-subs-security-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

- この承認を名指ししているが**現在どの決着済みセルからも参照されていない質疑**: `qa-subs-backend-web-006` — R4-reopen で差し替えられた旧版であり、接地根拠としては効いていない (本文と基準は spec-state.json の qa_log と reopen_log に残る)

### 承認: `appr-foundation-subscriptions-001`

サブスク画面サイクルの上位概念 U1-U9 を利用者が承認 (2026-09-18T03:36:08Z)。提示した草案は scratchpad の foundation-subs.json と同文で、U1 本質的目的・U2 背景・G1-G5・O1-O5・S1-S5・SH1-SH2・scope in 7 / out 5・C1-C5・I1-I7 の全項目を提示した。画像 design/FINAL-UI/images/09-subscriptions.png を構成の正本とし、カテゴリ=既定辞書+利用者変更 / 見直し候補=決定論ルール+定型文 / カバー率=口座名で 3 分類+取込済み月の割合 / 保存=既存表の再利用+migration 0043 / 旧 UI=吸収して撤去 / 数値=検算済み fixture / KPI 月額=推定月額の和 の 7 決定を同時に承認。basis=user-decision。

#### この承認を名指ししている質疑: `qa-subs-target-platforms-001`

**問**

サブスク画面の作り直しで対象とするプラットフォームはどれか。web 以外 (スマートフォン / タブレット / Windows / Linux / macOS の専用アプリ) を範囲に含めるか。

**答**

web のみを対象とする。承認した U1-U9 の scope.out に『web 以外のプラットフォーム』を明記しており、スマートフォン・タブレット・デスクトップの専用アプリは作らない。狭い画面でも web の画面をそのまま使う (本サイクルで狭幅専用の構成は作らない)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-18T03:36:08Z に承認した U1-U9 の scope.out (appr-foundation-subscriptions-001)。kanjo は web アプリとして運用されており、本サイクルでも変更しない。 / 回答時刻: 2026-09-18T03:36:08Z)

#### この承認を名指ししている質疑: `qa-subs-auth-web-005`

**問**

web のサブスク画面で単独利用者前提を継続する決定は、今サイクルのどの承認に遡れるか。

**答**

今サイクルの上位概念承認 appr-foundation-subscriptions-001 (2026-09-18T03:36:08Z) で、利用者は SH1 を『利用者 (単独の個人事業主)』として承認した。役割分担や複数ユーザーの権限分離は scope.in に無く、本サイクルでも導入しない。認証の主体と保存の境界 (userId と組で引く) は account-login サイクル (system-spec/archive/2026-09-14-account-login/) の確定を変えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: appr-foundation-subscriptions-001 の SH1 (利用者が承認した U1-U9 草案と同文)。qa-subs-auth-web-004 の継続決定の根拠をこの承認へ明示的に結び付ける。 / 回答時刻: 2026-09-18T03:36:08Z)

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| dec-subs-category | サブスクのカテゴリ (エンタメ / クラウド / 仕事効率化 など) をどう決めるか。 | confirmed | opt-dict-plus-override:core の既定辞書 (正規化名→カテゴリ、当たらなければ『その他』) + 利用者の変更を sub_vendors.category に保存 / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '辞書は core の固定表、上書きは既存表への列追加だけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=G1 のカテゴリ列・カテゴリ別推移・年換算比較と G4 の集計を、取込直後から辞書で埋められる。辞書が外れても利用者が詳細パネルで直せば以後は上書きが勝つ。 / pros=取込直後からカテゴリが埋まる, 判定が決定論でテストに固定できる, 利用者の判断が最終的に勝つ / cons=辞書に無いサービスは『その他』に落ちる, 辞書の保守が要る / risks=表記ゆれで辞書に当たらない。照合前に NFKC 正規化と vendorKey を通す必要がある / lock-in=なし。辞書と上書き列だけで、外部仕様に依存しない。 / ops=辞書への追記はコード変更 1 か所とテスト 1 件。 / evidence=https://unicode.org/reports/tr15/<br>opt-manual-only:辞書を持たず、利用者が全ベンダーに手でカテゴリを付ける / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '列追加だけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=付けるまでカテゴリ列・カテゴリ別推移が全て『未分類』になり、G1 の画面が初回に成立しない。 / pros=実装が最小, 誤分類が起きない / cons=初回は全件未分類で画面の半分が空く, 利用者の作業量が件数に比例する / risks=面倒で放置され、カテゴリ別の比較が常に使えない状態になる / lock-in=なし。 / ops=運用作業は利用者の手入力のみ。 / evidence=https://unicode.org/reports/tr15/<br>opt-workers-ai:Workers AI でサービス名からカテゴリを推定し、結果を保存 / cost={'category': 'low-cost', 'amount': 0.011, 'currency': 'USD', 'billing_period': 'per-1000-neurons', 'tco': 'Workers AI は 1 日 10,000 Neurons まで無料で、超過分は 1,000 Neurons あたり $0.011。個人利用の件数なら無料枠に収まる見込みだが、呼び出し経路・失敗時の扱い・結果の保存が増える。'} / free=1 日 10,000 Neurons まで無料。超過は 1,000 Neurons あたり $0.011。 / fit=未知のサービスにもカテゴリを付けられるが、判定が非決定論で、テストで固定できない。 / pros=未知のサービスにも対応できる / cons=非決定論でテストに固定できない, 呼び出しの失敗時と費用の管理が増える / risks=取込データの送信が前提と衝突する, 同じ名前でも結果が揺れる / lock-in=Workers AI のモデルと料金体系に依存する。 / ops=モデル更新ごとの確認と、無料枠の監視が要る。 / evidence=https://developers.cloudflare.com/workers-ai/platform/pricing/ | opt-dict-plus-override — 取込直後から画面が埋まり、判定を決定論のままテストに固定でき、取込データを外へ出さずに済む。辞書の外れは利用者の上書きで吸収できる。 (注意: 辞書の照合は vendorKey (NFKC 正規化後) の結果で行い、生の取引名で行わない, 上書き済みの category は辞書より優先し、辞書の更新で上書きを消さない, 『その他』は辞書の欠落を示すので、件数を画面で読めるようにする; confidence=high; checked=2026-09-18T03:40:35Z) | opt-dict-plus-override @ 2026-09-18T03:05:24Z | G1, G4, G5 |
| dec-subs-review-candidate | 『見直し候補』を何で判定し、検出理由の文をどう作るか。 | confirmed | opt-rules-template:決定論ルール (同カテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ など) + 定型文に金額・件数・月数を差し込む / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'core の純関数とテンプレートだけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=KPI の件数・一覧の候補バッジ・検出理由カード・サイドバーのバッジを同じ関数で出せ、G3 の『同じ結果を出す』を構造で満たす。 / pros=同じ入力で必ず同じ結果, 境界値をテストで固定できる, 理由の根拠 (どの規則か) を画面で示せる / cons=規則に無いパターンは検出できない, 文が定型的になる / risks=閾値が実データに合わず候補が多すぎる / 少なすぎる / lock-in=なし。 / ops=閾値の変更はコード 1 か所とテスト。 / evidence=https://vitest.dev/api/expect.html<br>opt-ai-reason:Workers AI に支払い履歴を渡し、見直し候補と理由文を生成 / cost={'category': 'low-cost', 'amount': 0.011, 'currency': 'USD', 'billing_period': 'per-1000-neurons', 'tco': 'Workers AI は 1 日 10,000 Neurons まで無料で、超過分は 1,000 Neurons あたり $0.011。個人利用の件数なら無料枠に収まる見込みだが、呼び出し経路・失敗時の扱い・結果の保存が増える。'} / free=1 日 10,000 Neurons まで無料。超過は 1,000 Neurons あたり $0.011。 / fit=文は自然になるが、KPI・バッジ・カードの件数を同じ結果に揃える保証が無く G3 を満たしにくい。 / pros=規則外のパターンも拾える可能性がある / cons=非決定論でテストに固定できない, 件数の一致を保証できない / risks=根拠の無い理由文を事実のように表示する, 取込データの送信が前提と衝突する / lock-in=Workers AI に依存する。 / ops=生成結果の監視と費用の監視が要る。 / evidence=https://developers.cloudflare.com/workers-ai/platform/pricing/ | opt-rules-template — 件数の一致と再現性が G3 の要件そのものであり、決定論ルールでしか構造的に保証できない。理由文は判定した規則と数値から作るため、根拠の無い文にならない。 (注意: 規則と閾値・文テンプレートを docs に明記し、各規則の境界値テストを置く, 1 ベンダーが複数の規則に当たるときの表示順 (優先順位) を決めておく, 『候補から除外』した判断は以後の判定から外し、判定そのものは変えない; confidence=high; checked=2026-09-18T03:40:35Z) | opt-rules-template @ 2026-09-18T03:05:24Z | G3, G4 |
| dec-subs-coverage | 『データソースのカバー率』の 銀行口座 / クレジットカード / 電子マネー をどう分類し、% と (分子/分母) を何で定義するか。 | confirmed | opt-account-name-3way:口座名の手がかりで 3 分類 (paymentMethodOf を拡張)。(分子/分母) = 最新月まで取込済みの口座数 / 口座数、% = 期間の (口座×月) のうち取引がある割合 / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'core の固定表の拡張だけで追加費用なし。保存も増えない。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=取込済みのデータだけで画像の 3 区分と 2 種の数値を出せ、利用者の追加入力なしに G1 のカードが成立する。 / pros=追加の入力も保存も要らない, 既存の paymentMethodOf の延長で一貫する, % と (分子/分母) が別の問いに答える / cons=口座名に手がかりが無い口座は分類できない, 電子マネーの語彙を新たに持つ必要がある / risks=分類できない口座が多いと 3 区分の合計が口座数に届かない。『分類できない』を数える必要がある / lock-in=なし。 / ops=語彙の追記はコード 1 か所とテスト。 / evidence=https://unicode.org/reports/tr15/<br>opt-user-typed-accounts:口座ごとに種別を利用者が登録する表を新設する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '表 1 つの追加で追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=分類は正確になるが、登録するまでカードが空く。本サイクルの範囲外の口座設定画面も要る。 / pros=分類が正確 / cons=口座設定の画面と API が新たに要る, 初回はカードが空く / risks=登録漏れの口座が黙って分母から落ちる / lock-in=なし。 / ops=口座の追加ごとに登録作業が要る。 / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-two-way-only:既存の paymentMethodOf のまま カード / それ以外 の 2 区分で出す / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '変更なしで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=画像の 3 区分 (電子マネーが独立) を満たさず G1 と食い違う。 / pros=実装が最小 / cons=画像の構成と一致しない, 電子マネーの取込漏れに気づけない / risks=画像と異なる画面を正として固定してしまう / lock-in=なし。 / ops=なし。 / evidence=https://unicode.org/reports/tr15/ | opt-account-name-3way — 取込済みのデータだけで画像の 3 区分と 2 種の数値を出せる唯一の案で、利用者の追加作業も保存の追加も要らない。 (注意: 口座名の照合も NFKC 正規化後に行う, どの区分にも当たらない口座を別に数え、黙って落とさない, 口座×月の % は表示期間の月だけを数え、口座が取込を始める前の月を分母に入れるかを docs に明記する; confidence=high; checked=2026-09-18T03:40:35Z) | opt-account-name-3way @ 2026-09-18T03:05:24Z | G1, G4 |
| dec-subs-persistence | 名称の統合・候補の採用 / 除外・カテゴリ・見直し判断をどこに保存するか。 | confirmed | opt-reuse-extend:既存表を再利用して拡張 — 統合=既存ベンダーの aliases 追加、採用=sub_vendors 登録、除外=sub_vendor_exclusions、category と見直し判断は migration 0043 で追加 / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'D1 の列と表の追加だけで追加費用なし。'} / free=D1 の無料枠と既存の Workers Paid の範囲内 / fit=既存の照合 (matchSubVendor) と候補除外がそのまま新しい操作の保存先になり、G5 の『旧機能を失わない』と両立する。 / pros=既存データがそのまま生きる, 照合ロジックを作り直さない, migration が追加だけで済む / cons=aliases が JSON 文字列のため、統合の取り消しは配列からの削除になる / risks=統合の取り消し手順が無いと誤統合を戻せない / lock-in=なし。 / ops=migration 1 本と API の追加。 / evidence=https://developers.cloudflare.com/d1/reference/migrations/, https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations<br>opt-new-merge-table:統合・判断を記録する専用の表群を新設し、既存表と並べて持つ / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '表の追加だけで追加費用なし。'} / free=D1 の無料枠の範囲内 / fit=履歴は細かく残るが、照合時に既存の aliases と新しい表の 2 か所を読む二重実装になる。 / pros=操作の履歴を細かく残せる / cons=照合が 2 か所に分かれる, 既存データの移行か併用の規則が要る / risks=どちらの記録が正かで食い違う / lock-in=なし。 / ops=表と照合の保守が 2 系統になる。 / evidence=https://developers.cloudflare.com/d1/reference/migrations/ | opt-reuse-extend — 既存の照合と除外が既に正しく動いており、その保存先を延長するのが G5 の『失わない』を最も確実に満たす。追加は列と表だけで、行の書き換えを伴わない。 (注意: 0043 は ADD COLUMN と CREATE TABLE だけにし、既存行を書き換えない, 統合の取り消し (aliases からの削除) を API で用意する, 保存後は一覧・候補・サイドバーのバッジの取得を無効化して揃える; confidence=high; checked=2026-09-18T03:40:35Z) | opt-reuse-extend @ 2026-09-18T03:05:24Z | G2, G5 |
| dec-subs-legacy-ui | 画像に無い既存の機能 (登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、ベンダー別前年比較表、未登録候補パネル) をどう扱うか。 | confirmed | opt-absorb-and-remove:画像の部品 (詳細パネル・候補バッジ・検出理由カード・ステータス絞込) へ吸収し、旧 UI は撤去する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '画面の組み替えだけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=画面が画像どおりになり (G1)、旧機能の操作は詳細パネルと検出理由へ移って失われない (G5)。 / pros=画面が画像と一致する, 同じ操作の入口が 1 つになる / cons=移設先の設計とテストの移し替えが要る / risks=移し忘れた操作が黙って消える。旧テストを新しい置き場所へ移して欠落 0 を確かめる必要がある / lock-in=なし。 / ops=テストの移設 1 回。 / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/tabs/<br>opt-keep-below:旧 UI を画像の構成の下にそのまま残す / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=旧機能は確実に残るが、画面が画像と一致せず、同じ操作の入口が 2 つになる。 / pros=移設の手間が無い / cons=画像と一致しない, 同じ操作が 2 か所にあり食い違う / risks=片方だけ直して挙動が分かれる / lock-in=なし。 / ops=2 系統の UI の保守が続く。 / evidence=https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ | opt-absorb-and-remove — 画像を正本とする今サイクルの目的と、旧機能を失わない制約の両方を満たすのは吸収して撤去する案だけである。 (注意: 撤去前に旧 UI の操作を一覧化し、移設先を 1 対 1 で決める, 旧テスト (SubVendors.dom.test.tsx・subs-review.dom.test.tsx) を新しい置き場所へ移し、機能の欠落を 0 件にする, 詳細パネルのタブは WAI-ARIA の tabs パターン (矢印キー移動) で作る; confidence=high; checked=2026-09-18T03:40:35Z) | opt-absorb-and-remove @ 2026-09-18T03:33:42Z | G1, G2, G5 |
| dec-subs-fixture-authority | 画像の数値 (一覧 8 行の月額の和 ¥9,778 に対し合計欄 ¥64,800 など、閉じていない) をテストの期待値にどう使うか。 | confirmed | opt-layout-from-image-numbers-from-fixture:画像は構成・文言・配置の正本、数値は core が算出する検算済み fixture を正本とする / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'fixture の作成だけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=合計行 = 行の和、カテゴリ別合計 = 一覧合計 という G4 の一致条件を満たしたまま、画面は画像どおりに作れる。 / pros=数値の一致をテストで保証できる, 画像の構成はそのまま再現できる / cons=画像と数値が一致しないスクリーンショットになる / risks=画像の値を写したテストが混ざると合計が閉じない / lock-in=なし。 / ops=fixture の検算を 1 回行い、以後はテストで固定。 / evidence=https://vitest.dev/api/expect.html<br>opt-copy-image-numbers:画像の数値をそのまま期待値にする / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=画像の見た目とは一致するが、合計欄が行の和と一致しないため G4 の一致条件と矛盾する。 / pros=画像との見た目の一致が最大 / cons=合計が閉じない表を正とすることになる / risks=計算の正しい実装がテストで失敗する / lock-in=なし。 / ops=なし。 / evidence=https://vitest.dev/api/expect.html | opt-layout-from-image-numbers-from-fixture — 画像の合計欄が閉じていない以上、画像の数値を正とすると正しい実装がテストで落ちる。構成は画像、数値は検算済み fixture と役割を分けるしかない。 (注意: fixture の検算結果 (行の和・列の和・合計欄) を仕様書に記録する, 金額の比較は整数 (円) で行い、構成比などの割合は小数の許容幅を明示する; confidence=high; checked=2026-09-18T03:40:35Z) | opt-layout-from-image-numbers-from-fixture @ 2026-09-18T03:33:42Z | G1, G4 |
| dec-subs-kpi-definition | KPI『月額のサブスク合計』『年換算の合計』と前期間比を何で定義するか。 | confirmed | opt-sum-of-estimated-monthly:月額 = 最新月時点で継続中の各ベンダーの推定月額の和 (年額払いは 12 等分)。年換算 = 月額 ×12。前期間比 = 直前の同じ長さの期間の同じ定義の値との差 / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': 'core の純関数だけで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=一覧の『月額の推定』列の合計と KPI が同じ定義になり、合計行・カテゴリ別比較・KPI が一致する (G4)。 / pros=一覧・比較表・KPI が同じ定義で閉じる, 年額払いが月額を跳ねさせない / cons=推定 (継続中の判定・年額払いの判定) の規則が要る / risks=継続中の判定を誤ると解約済みが月額に残る / lock-in=なし。 / ops=判定規則のテスト固定だけ。 / evidence=https://vitest.dev/api/expect.html<br>opt-latest-month-actual:月額 = 最新月の実支払額 (現行の KPI) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'none', 'tco': '変更なしで追加費用なし。'} / free=外部サービスを使わないため上限なし (Cloudflare Workers の CPU 時間の範囲内) / fit=年額払いがある月だけ跳ね、一覧の『月額の推定』列の合計と KPI が一致しない。 / pros=実績そのもので説明が要らない / cons=年額払いの月に大きく振れる, 一覧の合計と一致しない / risks=前期間比が年額払いの有無で符号ごと変わる / lock-in=なし。 / ops=なし。 / evidence=https://vitest.dev/api/expect.html | opt-sum-of-estimated-monthly — 一覧の列・比較表・KPI を同じ定義で閉じられるのは推定月額の和だけで、年額払いによる月ごとの振れも除ける。 (注意: 『継続中』の判定規則 (直近何か月に支払いがあるか) を docs とテストで固定する, 直近 12 か月の支払額は実支払の和のまま残し、推定と実績を別の KPI として並べる; confidence=high; checked=2026-09-18T03:40:35Z) | opt-sum-of-estimated-monthly @ 2026-09-18T03:33:42Z | G1, G4 |
