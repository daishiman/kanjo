---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G3, G4, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subs-review-decision-002。裏付け質疑 (`qa_refs`): `qa-subs-backend-web-evidence-001`, `qa-subs-backend-web-004`, `qa-subs-backend-web-007` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、一覧・詳細・操作を 1 往復で返すモバイル向けの API の形と、通信量を抑えるための差分取得を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、一覧と詳細を同時に表示する前提でまとめて返す API の形を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、オフライン時に行った統合や除外をあとから API へ送る再送と競合解決を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、同じくオフライン操作の再送と、その順序保証を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、同じくオフライン操作の再送と、スリープ復帰時の再同期を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存の向きを core (subscriptionsScreen・見直し規則・カテゴリ辞書・口座分類) ← api (subscriptions と sub-vendors の route) ← web (サブスク画面) の一方向へ反映した。現行の subscriptions() は最新月の実支払を KPI にしているため、推定月額の和を月額とする定義へ置き換えた関数を別名で足し、旧関数を参照する箇所 (分析ハブの要約など) を洗い出してから置き換える。バッジを数える analytics の reviewQueue も同じ関数を呼ぶ形にし、候補数の定義を 1 か所に寄せる。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | サブスクの集計は sourceNeutralSubscriptions と同じく照合後の実質支出 (freee と MF の二重計上を除いた明細) を入力にし、MF 明細と freee 仕訳を別経路で数え直さない形へ反映した。前期間比のために直前の同じ長さの期間まで読む範囲の拡大は route の Dataset 組み立てで行い、純関数には表示期間と比較期間を区別して渡す。詳細パネルの取引は選んだベンダーの照合キーで Dataset を絞って返し、詳細専用の SQL を足さない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4, G5

#### 主たる接地根拠: `qa-subs-review-decision-002`

**問**

(AskUserQuestion で 3 問を選択肢つきで提示) (1) 登録済みのサブスクが見直し候補になったとき、検出理由カードの『候補を採用』は何を意味させるか。選択肢: 『候補として確認』と同じ (推奨) / 見直しを済ませた記録 (resolved) / 未登録の候補だけに出す。(2) 『見直し候補として確認』(confirmed) にした候補を画面でどう扱うか。選択肢: 一覧に残し件数から外す (推奨) / すべて残す / すべてから外す。(3) 複数の規則に同時に当たったとき、同じ理由では再び出さないための指紋をどう作るか。選択肢: 当たった全規則+基準金額 (推奨) / 最優先の規則+基準金額。

**答**

(1) 『候補として確認』と同じ — 登録済みベンダーの見直し候補では、検出理由カードの『候補を採用』と詳細パネルの『候補として確認』はどちらも confirmed (見直す対象として残す) を記録する。保存する値は confirmed / dismissed の 2 つだけ。(2) 一覧に残し件数から外す — confirmed の候補は一覧の候補バッジを『確認済み』に変えて残し、KPI の『見直し候補 N 件』とサイドバーのバッジはまだ判断していない候補だけを数える。(3) 当たった全規則+基準金額 — 指紋は当たった規則の種類すべてと判定時の基準金額から作り、月は含めない。新しい規則が加わるか金額が変わったときだけ再び候補に出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion への利用者の明示選択 (2026-09-18T06:51:17Z)。各問に 2〜3 の選択肢と説明を示し、利用者が 3 問とも推奨案を選んだ。qa-subs-review-decision-001 (『つづけて』からの推定の採用) を置き換える。 / 回答時刻: 2026-09-18T06:51:17Z)

#### 裏付け質疑: `qa-subs-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行のサブスクの検出と集計はどこにあるか。

**答**

検出は core/src/subs.ts にある — vendorKey (:31-37、表記ゆれを吸収した照合キー)、matchSubVendor (:58-74、登録ベンダーと別名で照合)、subsCandidates (:105-170、未登録の継続的な支払いの採点)、subsConfidence (:196-216)、autoRegisterable (:219)。集計は core/src/analysis.ts の subscriptions() (:414-472) で、KPI の monthlyTotal は最新月の実支払 (登録ベンダーの和 + サブスク・通信科目の未登録分)、annualized はその ×12、last12Total は直近 12 か月の実支払、revenueShare は直近 3 か月の平均 ÷ 売上のある月の平均売上。アラートは dup (中央値の 1.8 倍超かつ 2 万円超かつ中央値 5 千円超) と spike (3 倍超かつ 1.5 万円超)。四半期見直しは subsReviewStatus (:1485、SUBS_REVIEW_INTERVAL_MONTHS=3)。API は api/src/routes/analytics.ts:459-474 の GET /subscriptions が expense-projection.ts:264-307 の sourceNeutralSubscriptions (freee と MF を照合した後の実質支出) を返す。サイドバーのバッジ (analytics.ts:197-202) は subsCandidates の件数 (上限 20) で、画像の『見直し候補 2 件』とは別の数である。カテゴリ、見直し候補の判定、口座の 3 分類、サブスク用の前期間比はコードに無い。汎用の previousPeriod (core/src/analysis-hub.ts:38-44) はある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/core/src/subs.ts・analysis.ts・expense-projection.ts・analysis-hub.ts と packages/api/src/routes/analytics.ts の読解 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-backend-web-004`

**問**

web のサブスク画面の backend 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定は次の 4 点である。(1) 見直し候補は AI を呼ばず決定論ルール + 定型文で判定し、規則は docs とテストで固定する。(2) カテゴリは core の既定辞書 + 利用者の変更。(3) カバー率は口座名の手がかりで 3 分類し、(分子/分母) は最新月まで取込済みの口座数 / 口座数、% は期間の (口座×月) のうち取引がある割合。(4) KPI の月額は最新月時点で継続中の各ベンダーの推定月額の和 (年額払いは 12 等分)、年換算は ×12、前期間比は直前の同じ長さの期間との差。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で選択された dec-subs-review-candidate / dec-subs-category / dec-subs-coverage / dec-subs-kpi-definition。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-backend-web-007`

**問**

web のサブスク画面の backend 要件のうち、agent が補完した設計判断は何か。

**答**

(1) core に subscriptionsScreen(data, deals, vendors, decisions, period) を置き、推定月額・継続中の判定・年換算・前期間比・カテゴリ (既定辞書 → 利用者の上書き)・口座の 3 分類とカバー率・カテゴリ別の月次推移と年換算比較・見直し候補と理由文を 1 か所で算出する。既存の sourceNeutralSubscriptions の照合後の明細を入力にし、別経路で明細を数え直さない。(2) 推定月額は、直近 12 か月の支払い間隔が 11〜13 か月なら年額払いとして最新の支払額 ÷ 12、それ以外は最新の支払額とする。継続中は、月払いなら最新月か前月に支払いがあること、年額払いなら直近 12 か月に支払いがあること。(3) 見直し候補の規則は 5 つ — 同じカテゴリ (その他を除く) に継続中が 2 件以上 / 既存 dup の条件 (二重請求の疑い) / 既存 spike の条件 (急増) / 直前の支払額からの値上げ (5% 以上が 2 か月続く) / 四半期見直しの期限切れ (subsReviewStatus.due)。理由文は規則ごとの定型文に金額・件数・月数を差し込む。複数の規則に当たるときは 二重請求 → 急増 → 値上げ → 重複 → 期限切れ の順に並べる。(4) 前期間比は previousPeriod で直前の同じ長さの期間を取り、同じ関数を同じ定義で当てた差とする。(5) GET /api/subscriptions は期間つきで上記をまとめて返し、GET /api/subscriptions/vendors/:key は詳細パネル用に生の取引名 (ソース種別つき)・直近の取引・データソース別件数を返す。(6) 保存 API は既存の /api/sub-vendors 系を延長し、PUT /api/sub-vendors/:id に category を足し、POST /api/sub-vendors/:id/aliases (統合) と POST / DELETE /api/subscriptions/review-decisions (登録済みベンダーの見直し候補への確認 = confirmed・除外 = dismissed の判断とその取消) を新設する。未登録候補の採用は既存の POST /api/sub-vendors、除外は既存の POST /api/sub-vendors/exclusions をそのまま使う。(7) 見直し候補は 未判断 / 確認済み の 2 状態で返し、指紋が一致する dismissed の候補は返さない。KPI の『見直し候補 N 件』とサイドバーのバッジは未判断の候補だけを同じ関数で数え、確認済みは一覧の候補バッジ (『確認済み』) にだけ出す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-subs-backend-web-006 の (6) の文末の重複 (『をそのまま使う を新設する。』) を『をそのまま使う。』に直した版。内容は 006 と同じで、根拠は 006 の出所をそのまま引き継ぐ。 / 回答時刻: 2026-09-18T06:55:33Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 『見直し候補』を core の純関数で決定論的に判定し、KPI の件数・一覧の候補バッジ・『サブスク候補の検出理由』カードに同じ結果を出す。理由は AI を呼ばず、同じカテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ などの規則を判定し、金額・件数・月数を差し込む定型文で生成する。カードから『候補を採用』『候補から除外』『この候補を詳しく見る』を操作できる。規則と文テンプレートを docs に明記しテストで固定する。
- **G4**: サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。
- **G5**: 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 見直し候補の判定と理由文が規則どおりに出る。 | core の単体テストで各規則の境界値と理由文テンプレートが固定され、KPI 件数・一覧バッジ・検出理由カードの件数が同一入力で一致する。 |
| O4 | 画面の数値が core の 1 か所から出て既存と一致する。 | core 単体テストで推定月額・年換算・前期間比・カバー率・カテゴリ別集計の境界値が緑、API 統合テストで GET /subscriptions の新しい形が返り、合計行 = 行の和、カテゴリ別合計 = 一覧合計、直近 12 か月の支払額が既存 last12Total と一致する。 |
| O5 | 保存と旧機能の移設が壊れずに完了する。 | migration 0043 がローカル D1 に適用でき、統合・採用・除外・確認・カテゴリ変更の API 統合テストが緑、旧パネルのテストが新しい置き場所のテストへ移されて機能の欠落が 0 件、サイドバーのバッジ件数が画面の候補件数と一致する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: 詳細パネルで正規化名とカテゴリを編集し、生の取引名を選んで『選択した N 件を統合』で既存ベンダーの aliases に加えられるようにする。
- **I3**: core に見直し候補の判定関数と理由文テンプレートを置き、KPI・一覧・検出理由カード・サイドバーのバッジが同じ関数を使う。
- **I4**: core に推定月額・前期間比・カテゴリ辞書・口座 3 分類とカバー率・カテゴリ別集計の純関数を置き、GET /subscriptions がそれを返す。
- **I5**: migration 0043 で sub_vendors に category を足し、登録済みベンダーの見直し候補への判断 (確認 / 除外) を保存する表を足して、既存の除外・見直し日時と一緒に扱う。
- **I6**: 旧 SubVendorsPanel / SubsCandidatesPanel / アラート / ベンダー別前年比較表を撤去し、その操作を詳細パネル・検出理由カード・ステータス絞込へ移したうえで、既存テストを新しい置き場所へ移す。
- **I7**: 検算済み fixture と見た目検査 (check-financial-visuals) を新しい構成へ更新し、ロゴ画像が無いことも検査する。

### 本章に効く確定意思決定

- **dec-subs-category**: サブスクのカテゴリ (エンタメ / クラウド / 仕事効率化 など) をどう決めるか。
  - 採択: core の既定辞書 (正規化名→カテゴリ、当たらなければ『その他』) + 利用者の変更を sub_vendors.category に保存 (`opt-dict-plus-override`)
  - 目的適合: G1 のカテゴリ列・カテゴリ別推移・年換算比較と G4 の集計を、取込直後から辞書で埋められる。辞書が外れても利用者が詳細パネルで直せば以後は上書きが勝つ。
- **dec-subs-review-candidate**: 『見直し候補』を何で判定し、検出理由の文をどう作るか。
  - 採択: 決定論ルール (同カテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ など) + 定型文に金額・件数・月数を差し込む (`opt-rules-template`)
  - 目的適合: KPI の件数・一覧の候補バッジ・検出理由カード・サイドバーのバッジを同じ関数で出せ、G3 の『同じ結果を出す』を構造で満たす。
- **dec-subs-coverage**: 『データソースのカバー率』の 銀行口座 / クレジットカード / 電子マネー をどう分類し、% と (分子/分母) を何で定義するか。
  - 採択: 口座名の手がかりで 3 分類 (paymentMethodOf を拡張)。(分子/分母) = 最新月まで取込済みの口座数 / 口座数、% = 期間の (口座×月) のうち取引がある割合 (`opt-account-name-3way`)
  - 目的適合: 取込済みのデータだけで画像の 3 区分と 2 種の数値を出せ、利用者の追加入力なしに G1 のカードが成立する。
- **dec-subs-persistence**: 名称の統合・候補の採用 / 除外・カテゴリ・見直し判断をどこに保存するか。
  - 採択: 既存表を再利用して拡張 — 統合=既存ベンダーの aliases 追加、採用=sub_vendors 登録、除外=sub_vendor_exclusions、category と見直し判断は migration 0043 で追加 (`opt-reuse-extend`)
  - 目的適合: 既存の照合 (matchSubVendor) と候補除外がそのまま新しい操作の保存先になり、G5 の『旧機能を失わない』と両立する。
- **dec-subs-legacy-ui**: 画像に無い既存の機能 (登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、ベンダー別前年比較表、未登録候補パネル) をどう扱うか。
  - 採択: 画像の部品 (詳細パネル・候補バッジ・検出理由カード・ステータス絞込) へ吸収し、旧 UI は撤去する (`opt-absorb-and-remove`)
  - 目的適合: 画面が画像どおりになり (G1)、旧機能の操作は詳細パネルと検出理由へ移って失われない (G5)。
- **dec-subs-fixture-authority**: 画像の数値 (一覧 8 行の月額の和 ¥9,778 に対し合計欄 ¥64,800 など、閉じていない) をテストの期待値にどう使うか。
  - 採択: 画像は構成・文言・配置の正本、数値は core が算出する検算済み fixture を正本とする (`opt-layout-from-image-numbers-from-fixture`)
  - 目的適合: 合計行 = 行の和、カテゴリ別合計 = 一覧合計 という G4 の一致条件を満たしたまま、画面は画像どおりに作れる。
- **dec-subs-kpi-definition**: KPI『月額のサブスク合計』『年換算の合計』と前期間比を何で定義するか。
  - 採択: 月額 = 最新月時点で継続中の各ベンダーの推定月額の和 (年額払いは 12 等分)。年換算 = 月額 ×12。前期間比 = 直前の同じ長さの期間の同じ定義の値との差 (`opt-sum-of-estimated-monthly`)
  - 目的適合: 一覧の『月額の推定』列の合計と KPI が同じ定義になり、合計行・カテゴリ別比較・KPI が一致する (G4)。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule をサブスクの算出の置き場所に適用した。推定月額・継続中の判定・年額払いの 12 等分・前期間比・カテゴリの既定辞書と上書きの解決・口座名による 3 分類とカバー率・見直し候補の 5 規則と理由文は、いずれも入出力を持たない計算なので core の subscriptionsScreen に集める。api の route は期間を受け取って照合後の Dataset とベンダー定義・見直し判断を組み、純関数へ渡して JSON へ写すだけにする。サイドバーのバッジも同じ関数の見直し候補件数から数えることで、画面の KPI 5 枚目とバッジが別定義になっている現状の不一致を構造で解消する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T03:48:08Z)

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
| hono-zod-validator | 4.13.8 | Hono (hono.dev) | https://hono.dev/docs/guides/validation | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
| unicode-tr15-normalization | 18.0.0 | Unicode Consortium (unicode.org) | https://unicode.org/reports/tr15/ | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
