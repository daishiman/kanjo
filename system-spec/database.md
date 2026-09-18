---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G4, G5]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subs-review-decision-002。裏付け質疑 (`qa_refs`): `qa-subs-database-web-evidence-001`, `qa-subs-database-web-004`, `qa-subs-database-web-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、明細とベンダー定義を端末へ複製してオフラインで推定月額を出すか、その同期と競合をどう解くかを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、一覧と詳細パネルを同時に開く前提で一度に読むベンダー数と取引件数のキャッシュ方針を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、ベンダー定義と見直し判断をローカルファイルに持つか D1 と同期するかを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、ローカル保存先のパス規約とバックアップの扱いを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、サンドボックス下の保存先とアクセス権を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 永続化の境界を『利用者の意思だけを保存する』形へ反映した。migration 0043 は sub_vendors への category 列の追加と sub_vendor_review_decisions の新設だけで、既存行を書き換えない。判断の記録は (user_id, vendor_key) の一意索引で upsert し、同じベンダーへの判断を重ねない。読み取りと更新はいずれもプレースホルダ束縛で行い、照合キーを SQL 文字列へ連結しない。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の『変更を小さく可逆に保つ』を migration 0043 の形に反映した。列の追加は NULL 許容で既存行の意味を変えず、新表は既存表を参照しないため、アプリを戻しても古いコードは新しい列と表を無視して動く。行の書き換えを伴わないので、過去に起きた『行書き換え migration で Deploy が止まる』類の復旧手順は不要である。判断の表が空でも見直し候補は規則だけで出るため、表の欠落は機能の縮退で済む。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-subs-review-decision-002`

**問**

(AskUserQuestion で 3 問を選択肢つきで提示) (1) 登録済みのサブスクが見直し候補になったとき、検出理由カードの『候補を採用』は何を意味させるか。選択肢: 『候補として確認』と同じ (推奨) / 見直しを済ませた記録 (resolved) / 未登録の候補だけに出す。(2) 『見直し候補として確認』(confirmed) にした候補を画面でどう扱うか。選択肢: 一覧に残し件数から外す (推奨) / すべて残す / すべてから外す。(3) 複数の規則に同時に当たったとき、同じ理由では再び出さないための指紋をどう作るか。選択肢: 当たった全規則+基準金額 (推奨) / 最優先の規則+基準金額。

**答**

(1) 『候補として確認』と同じ — 登録済みベンダーの見直し候補では、検出理由カードの『候補を採用』と詳細パネルの『候補として確認』はどちらも confirmed (見直す対象として残す) を記録する。保存する値は confirmed / dismissed の 2 つだけ。(2) 一覧に残し件数から外す — confirmed の候補は一覧の候補バッジを『確認済み』に変えて残し、KPI の『見直し候補 N 件』とサイドバーのバッジはまだ判断していない候補だけを数える。(3) 当たった全規則+基準金額 — 指紋は当たった規則の種類すべてと判定時の基準金額から作り、月は含めない。新しい規則が加わるか金額が変わったときだけ再び候補に出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion への利用者の明示選択 (2026-09-18T06:51:17Z)。各問に 2〜3 の選択肢と説明を示し、利用者が 3 問とも推奨案を選んだ。qa-subs-review-decision-001 (『つづけて』からの推定の採用) を置き換える。 / 回答時刻: 2026-09-18T06:51:17Z)

#### 裏付け質疑: `qa-subs-database-web-evidence-001`

**問**

database 章の裏付けとして、サブスクの保存は現状どうなっているか。

**答**

sub_vendors (migrations 0005 で作成、0020 で accounts、0023 で reviewed_at を追加) が 利用者ごとの登録ベンダー (name・aliases の JSON 配列文字列・accounts・sort_order・reviewed_at) を持つ。sub_vendor_exclusions (0021) が『サブスクではない』と記録した支払先を (user_id, vendor_key) の一意索引つきで持つ。カテゴリと見直し判断を保存する列・表は無い。口座名は mf_transactions.institution (MF の保有金融機関) にあり、口座の種別を保存する列は無い。最新の migration は 0042_total_cashflow_operations_and_exclusion_reason.sql。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/src/db/schema.ts:222-247 と migrations/ の一覧の読解 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-database-web-004`

**問**

web のサブスク画面の database 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定は次の 1 点である。保存は既存表を再利用して拡張する — 名称の統合は既存ベンダーの aliases へ追加、候補の採用は sub_vendors への登録、候補から除外は sub_vendor_exclusions、カテゴリと見直し判断は migration 0043 で足す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で選択された dec-subs-persistence。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-database-web-006`

**問**

web のサブスク画面の database 要件のうち、agent が補完した設計判断は何か。

**答**

(1) migration 0043 は追加だけにする — sub_vendors に category TEXT NULL (NULL は既定辞書に従う) を ADD COLUMN し、sub_vendor_review_decisions (id, user_id, vendor_key, decision は confirmed / dismissed のいずれか (登録済みベンダーの見直し候補への判断だけを持つ。未登録候補の採用 / 除外は既存の sub_vendors / sub_vendor_exclusions に保存する), rule_fingerprint, decided_at、(user_id, vendor_key) 一意) を CREATE TABLE する。既存行は書き換えない。(2) 判断には判定時の規則の指紋を保存する。指紋は当たった規則の種類すべてを表示順に並べたものと判定時の基準金額から作り、月は含めない。指紋が同じなら月が変わっても判断を保ち、金額が変わるか新しい規則が加わったときだけ判断を無効にして未判断の候補へ戻す。(3) 統合は既存の aliases 配列への追加で表し、統合の取り消しは配列からの削除で表す。(4) 口座の種別は保存しない (口座名から毎回導出する)。(5) Drizzle の schema.ts を migration と同じ内容に更新し、ローカル D1 への適用で確かめる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存 schema と過去の migration の書き方 (追加のみ・行の書き換えをしない) の読解にもとづく agent の設計判断。 qa-subs-database-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。
- **G5**: 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
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

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を保存範囲の線引きに適用した。利用者の意思 (カテゴリの上書き・名称の統合・未登録候補の採用 / 除外と、登録済みベンダーの見直し候補への確認 / 除外という判断) はドメインの状態なので保存し、推定月額・年換算・カバー率・候補の判定結果は明細から毎回導出できるので保存しない。見直し判断は、当たった規則の種類すべてと判定時の基準金額から作る指紋と組で持ち、同じ理由では候補を再表示しない一方、金額が変わるか新しい規則が加われば未判断の候補へ戻す。保存は既存の sub_vendors と sub_vendor_exclusions を延長し、足すのは category 列と判断の表の 2 点だけに留める。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T06:54:11Z)

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
| cloudflare-d1-query | 2026-06-22 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/worker-api/d1-database/ | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
| cloudflare-d1-migrations | 2026-06-08 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
