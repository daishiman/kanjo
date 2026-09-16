---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-backend-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-reconciliation-decision-002`, `qa-reconciliation-decision-003`, `qa-reconciliation-decision-005`, `qa-backend-web-rc-decision-007`, `qa-backend-web-rc-inference-002`, `qa-backend-web-rc-decision-010`, `qa-backend-web-rc-decision-011`, `qa-backend-web-rc-decision-012`, `qa-backend-web-rc-decision-013` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは照合 API (GET /api/reconciliation と actions/undo) の応答形をアプリ版ごとに別版で保つかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは照合 API (GET /api/reconciliation と actions/undo) の応答形をアプリ版ごとに別版で保つかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは照合 API (GET /api/reconciliation と actions/undo) の応答形をアプリ版ごとに別版で保つかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは照合 API (GET /api/reconciliation と actions/undo) の応答形をアプリ版ごとに別版で保つかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは照合 API (GET /api/reconciliation と actions/undo) の応答形をアプリ版ごとに別版で保つかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | Clean Architecture の依存方向を core (reconciliationReport・monthlyCloseStatus) ← api (reconciliation route) ← web (照合画面・サイドバー) の一方向に反映した。照合 API・ハブ API・business-spend が同じ core 関数を通るため、要確認の定義が API ごとに分かれる経路を無くす。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じ、core の照合関数は D1 を知らない Dataset・判断・除外の配列だけを受け取る形に反映した。判断の結び直しは既存 bindDuplicateVerdicts を再利用し、照合 API 用に別の結び付け SQL を増やさない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4

#### 主たる接地根拠: `qa-backend-web-rc-observed-001`

**問**

照合に関わる core とバックエンドの現行の関数・API と、欠けている機能は何か。

**答**

core expense-projection.ts:156-241 の buildExpenseProjection(data, deals) は候補を『金額一致かつ (同日、または同じ支払先で ±3 日)』で作り、保存済みの判断と除外を入力に取らない。GET /api/business-spend (routes/analytics.ts:153) と core analysis-hub.ts:171 のハブのバッジ (reviewCount) がこの関数から出る。総収支側 core total-cashflow.ts:355-510 の reconcileBizDuplicates(data, deals, verdicts, exclusions) は自動一致・利用者判断での一致 (±3 日)・候補最大 3 件 (dayGap, accountConflict)・matched(by auto|user)/review/freeeOnly/excluded を返し、routes/duplicate-verdict-bindings.ts の bindDuplicateVerdicts が tx_id→stable_key の順で判断を明細へ結び直す。API は GET /api/total-cashflow、POST /api/total-cashflow/verdicts (zValidator、最大 200 件)、POST/DELETE /api/total-cashflow/freee-exclusions。判断を取り消す API・MF 側の除外・操作履歴・一致度・キュー分類・月次クローズ判定・月次レビュー完了 API は無い。改善要望は POST /api/improvements がある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/core/src/{expense-projection,total-cashflow,analysis-hub}.ts, packages/api/src/routes/{analytics,total-cashflow,duplicate-verdict-bindings,analysis-hub,improvement}.ts。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-reconciliation-decision-002`

**問**

照合の操作結果 (同じ取引として照合 / 別の取引として処理 / 除外) の保存と『元に戻す』をどう実装するか。既存は総収支用の duplicate_verdicts (same/different) と freee 側除外のテーブル (migrations 0036/0037) があるが、verdict を消す API・MF 側の除外・操作履歴は無い。選択肢: (A) 既存表を再利用し拡張する。判断は duplicate_verdicts を共用して総収支と結果を一致させ、verdict 取消 API・MF 側の除外・照合操作の履歴表 (直前の操作と元に戻すに使う) を migration で足す (推奨) / (B) 照合専用の新テーブルを作り総収支の判断と独立に持つ / (C) DB 変更なしで画面内の直前 1 操作を逆操作 API で打ち消すだけにし MF 側の除外は出さない。

**答**

(A) 既存表を再利用+拡張 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T07:41:58Z)

#### 裏付け質疑: `qa-reconciliation-decision-003`

**問**

画像の『一致度 %』『金額の差異』『日付の近い取引』は現行実装に定義が無い。どう定めるか。選択肢: (A) 単純な加点規則を core の純関数に置く: 金額一致 50 点 + 日付差 (同日 30 / 1 日 20 / 2 日 10 / 3 日 5) + 内容類似 (正規化した文字列の類似度 × 20) = 100 点満点。金額の差異 = 日付 ±3 日かつ内容類似だが金額不一致。日付の近い取引 = 金額一致で日付差 1〜3 日。規則は docs とテストで固定する (推奨) / (B) 一致度は出さず一致の理由のチェック表示だけにする。

**答**

(A) 単純な加点規則 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T07:41:58Z)

#### 裏付け質疑: `qa-reconciliation-decision-005`

**問**

サイドバー下部の月次クローズ進捗 (データ取込/仕分け/照合/月次レビュー) の完了をどう判定するか。選択肢: (A) 3 つ自動+レビュー手動。直近の締め月について データ取込=未記録月 0、仕分け=未整理明細 0、照合=要確認+MF未計上 0 を自動判定し、月次レビューは利用者が『レビュー完了』を押して月単位で D1 に保存する (取消可) (推奨) / (B) 4 つとも自動 (レビューは前 3 つの完了で自動完了。DB 変更なし) / (C) 完了判定を持たず見た目だけ画像に寄せる。

**答**

(A) 3つ自動+レビュー手動 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:11:23Z)

#### 裏付け質疑: `qa-backend-web-rc-decision-007`

**問**

照合画面の API をどう切るか。選択肢: (A) 照合専用 API を新設: GET /api/reconciliation (KPI・キュー・候補一覧・下段 2 表・直前の操作を 1 回で返す) と POST /api/reconciliation/actions (照合/別取引/除外・最大 200 件・部分成功)、POST /api/reconciliation/actions/:id/undo。保存先は既存 duplicate_verdicts / freee 除外表を共用し bindDuplicateVerdicts で総収支と件数を揃える。既存 /business-spend と /total-cashflow は残す (推奨) / (B) 既存 total-cashflow API を拡張。

**答**

(A) 照合専用 API を新設 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-backend-web-rc-inference-002`

**問**

一致度・キュー分類・月次クローズ判定を core のどの関数に置き、既存集計とどう揃えるか。

**答**

core に reconciliation.ts を新設し、reconcileBizDuplicates の matched/review/freeeOnly/excluded と bindDuplicateVerdicts 済みの判断・MF 除外を入力に、各候補の matchScore (金額一致 50 + 日付差 同日30/1日20/2日10/3日5 + 内容類似×20)・matchReasons (金額/日付/内容)・status (未処理=MF未計上で判断なし / 要確認=候補ありで判断なし / 照合済み=自動一致または same / 除外=MF除外または freee 除外)・queue (review / mfOnly / amountMismatch / nearDate)・KPI (事業支出・MF未計上件数と金額・要確認件数・解消率=照合済み÷(照合済み+要確認+未処理)) を返す純関数 reconciliationReport を置く。buildExpenseProjection は判断と除外を受け取る引数を足して reviewCount を reconciliationReport と一致させ、analysis-hub.ts:171 のバッジも同じ値にする。月次クローズは monthlyCloseStatus(dataset, month) が unrecordedMonths・未整理明細数・照合の未処理+要確認件数と月次レビュー完了行から 4 ステップの完了を返す。内容類似は NFKC・空白・大小文字を正規化した文字 bigram の Dice 係数 (0〜1) とする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に観測事実と利用者決定から導いた推定。単独では確定の根拠にせず、観測事実 (主根拠) の補足として qa_refs に載せる。answered_at は記録直前に date -u で実測した時刻。 前提: qa-reconciliation-decision-003 (一致度規則)、qa-reconciliation-decision-005 (月次クローズ判定)、core/src/total-cashflow.ts:355-510 と expense-projection.ts:156-241 の観測。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-backend-web-rc-decision-010`

**問**

KPI の『解消済みの割合』(ドーナツ) の分母をどう定義し、対象月に候補が 1 件も無いときどう表示するか。選択肢: (A) 除外を分母から外す。照合済み ÷ (照合済み + 要確認 + 未処理)。除外は対応不要なので進み具合に数えない。分母 0 のときは『対象なし』と表示し、月次クローズの照合ステップは完了扱い (推奨) / (B) 除外も解消に数える。(照合済み + 除外) ÷ 全件。分母 0 は『対象なし』で完了扱い / (C) 式は (A) と同じで、分母 0 は 0% 表示・照合ステップは完了扱い。

**答**

(A) 除外を分母から外す を選択した。解消率 = 照合済み ÷ (照合済み + 要確認 + 未処理)。分母 0 のときは『対象なし』と表示し、月次クローズの照合ステップは完了とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で選択した。推定 qa-backend-web-rc-inference-002 の解消率の式を利用者決定で裏付け、分母 0 の扱いを新たに決めた。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T09:21:19Z)

#### 裏付け質疑: `qa-backend-web-rc-decision-011`

**問**

一致度の『内容類似×20』で使う類似度 (0〜1) の計算方式をどれにするか。MF の取引内容と freee の摘要には全角半角・空白・社名の略し方の表記ゆれがある。選択肢: (A) NFKC・空白・大小文字を正規化した文字 bigram の Dice 係数。短い日本語摘要でも部分一致を拾え、依存を足さず core の純関数で書ける (推奨) / (B) 正規化後の完全一致 1・包含 0.5・それ以外 0。説明しやすいが『アマゾン』と『Amazon.co.jp』は 0 / (C) 編集距離 (1 − Levenshtein 距離 ÷ 長い方の文字数)。語順の違いに弱く長い摘要で計算量が増える。

**答**

(A) 文字 bigram の Dice 係数 を選択した。NFKC・空白除去・小文字化で正規化した文字 bigram の Dice 係数を内容類似 (0〜1) とする。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-15T09:35:30Z` — 本質疑の選択肢は (B) の短所として『アマゾン』と『Amazon.co.jp』が 0 になる点を挙げたが、推奨の (A) 文字 bigram の Dice 係数でも共通する 2 文字の並びが無いため同じ組は 0 になる。この短所を (A) に書き漏らしていた。訂正を示したうえでの再確認は qa-backend-web-rc-decision-012 に記録した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で選択した。推定 qa-backend-web-rc-inference-002 の内容類似の方式を利用者決定で裏付けた。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T09:21:19Z)

#### 裏付け質疑: `qa-backend-web-rc-decision-012`

**問**

内容類似の方式について訂正です。前回の選択肢では (B) の短所として「アマゾン」と「Amazon.co.jp」が 0 になると書きましたが、選ばれた (A) 文字 bigram の Dice 係数でも同じく 0 になります（共通する 2 文字の並びが無いため）。この短所を踏まえても (A) のままでよいですか？ 選択肢: ((A) Dice のまま (推奨)) カナと英字の表記違いは Dice でも 0 になりますが、配点は 20 点だけで、金額 50 点と日付 30 点で候補には残ります。この限界は docs に明記します。 / (Dice+読み替え辞書) Dice を使ったうえで、よく出る社名（アマゾン=Amazon など）の小さな読み替え表を core に置き、正規化の段階で揃えます。表の保守が必要になります。 / (完全/部分一致に変更) 正規化後に完全一致なら 1、包含なら 0.5、それ以外は 0 にします。説明はしやすいですが、表記ゆれにはさらに弱くなります。

**答**

((A) Dice のまま (推奨)) を選択した。NFKC・空白除去・小文字化で正規化した文字 bigram の Dice 係数を維持し、カナと英字の表記違いは類似度 0 になる限界を docs に明記する。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-15T10:23:56Z` — 本質疑の推奨 (A) の説明『配点は 20 点だけで、金額 50 点と日付 30 点で候補には残ります』は、金額が一致する組にしか当てはまらない。金額も表記も違う組 (例: アマゾン / Amazon.co.jp で金額が違う) は内容類似 0 のため金額の差異キューに入らず、MF未計上と freee 側の一覧に別々に出る。この影響を選択肢に書いていなかった。訂正は qa-backend-web-rc-decision-013 の question で利用者に示した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で、qa-backend-web-rc-decision-011 の選択肢に (A) の短所を書き漏らしていた訂正を読んだうえで選択した。question は会話ログから逐語で転記。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T09:35:30Z)

#### 裏付け質疑: `qa-backend-web-rc-decision-013`

**問**

内容類似（Dice 係数 0〜1）を「似ている」と判定するしきい値をどれにしますか？使うのは「金額の差異」キュー（±3日・内容が似ている・金額が違う）と、一致の理由の内容行のチェックの 2 か所です。一致度の 20 点は連続値のままです。あわせて前回の訂正です。「金額 50 点と日付 30 点で候補には残る」は金額が一致する組だけの話でした。金額も表記も違う組（例: アマゾン / Amazon.co.jp で金額が違う）は、どのしきい値でも金額の差異キューに入らず、MF未計上と freee 側の一覧に別々に出ます。 選択肢: (0.5 以上 (推奨)) 長所: 全角半角の違いや略称を拾う（ｽﾀｰﾊﾞｯｸｽ/スターバックスコーヒー 0.75、ヤマト運輸/…株式会社 0.67、ﾄﾞｺﾓ/NTTドコモ 0.57）。別会社は落とす（東京電力/東京ガス 0.33、楽天市場/楽天モバイル 0.25、AMAZON.CO.JP/Amazon Web Services 0.37）。短所: JR東日本/東日本旅客鉄道（0.40）のような言い換えは拾えず、金額の差異キューに出ない。 / (0.3 以上) 長所: 0.5 の例に加えて JR東日本/東日本旅客鉄道（0.40）も拾い、金額の差異キューの見落としが減る。短所: 東京電力/東京ガス（0.33）や AMAZON.CO.JP/Amazon Web Services（0.37）のような別会社も「似ている」と判定し、キューと一致の理由のチェックに誤りが混ざる。確認の手間が増える。 / (0 より大きい) 長所: 2 文字の並びが 1 つでも共通すれば拾うので、見落としは最も少ない。短所: 楽天市場/楽天モバイル（0.25）など先頭語が同じ別会社がほぼ全部入り、金額の差異キューが「同じ日付あたりで金額が違う取引」とあまり変わらなくなる。内容行のチェックは判断の根拠として役に立たなくなる。

**答**

(0.5 以上 (推奨)) を選択した。NFKC・空白除去・小文字化で正規化した文字 bigram の Dice 係数が 0.5 以上のとき『内容が似ている』と判定する。適用箇所は 2 つ。(1) 対応キュー『金額の差異』= MF の取引と freee の候補の日付差が ±3 日以内、かつ内容類似 0.5 以上、かつ金額不一致。(2) 一致の理由の内容行のチェック = 内容類似 0.5 以上で付く。一致度の内容点は二値化せず 内容類似×20 の連続値のままとする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で選択した。completeness evaluator 第 3 周の指摘 (内容類似を二択で使う 2 か所のしきい値が未定義) を受けた決定。選択肢の類似度の例は Python で NFKC・空白除去・小文字化・bigram Dice を実装して試算した値。question は会話ログから逐語で転記。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T10:23:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 照合に必要な判定を packages/core の純関数に置く。一致度 (金額一致 50 + 日付差 同日30/1日20/2日10/3日5 + 内容類似×20 の 100 点満点)・一致の理由・ステータス (未処理/要確認/照合済み/除外)・対応キュー 4 分類 (要確認の候補 / MF未計上 / 金額の差異=±3日かつ内容類似で金額不一致 / 日付の近い取引=金額一致で日付差1〜3日)・KPI を 1 か所で算出し、保存済みの判断と除外を反映する。buildExpenseProjection・ハブのバッジ・総収支と件数を一致させ、規則を docs に書きテストで固定する。
- **G3**: 照合操作を保存し元に戻せるようにする。既存の duplicate_verdicts と freee 除外表を再利用し、照合画面用の API (一覧・KPI・キューを返す GET と、照合 / 別取引 / 除外 / 一括照合の POST)、verdict 取消 API、MF 側除外、照合操作の履歴表 (直前の操作と元に戻すに使う) を migration 付きで追加する。一括は最大 200 件で部分成功を返す。
- **G4**: 共通シェルを画像に揃える。サイドバーの文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト) とグループ・件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ページ見出し・パンくず・コマンドパレットのラベル追随、月次クローズ進捗 3/4 (データ取込/仕分け/照合は直近の締め月について自動判定、月次レビューは利用者の完了操作を月単位で D1 に保存し取消可)、ヘッダー (防衛ライン：正常 の表記・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター)、フッター (外部送信しない / 税務上の正本は freee / 毎晩バックアップ と 利用規約・プライバシー・データ出典・v1.0) と改善を送るボタン。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | core の一致度・キュー分類・KPI 関数を実装し、既存集計と件数を揃える。 | core 単体テストが一致度の境界 (日付差 0/1/2/3/4 日・金額不一致・内容類似 0/1) とキュー 4 分類と判断反映を検証し、同じデータで照合 API・ハブのバッジ・総収支の要確認件数が一致する統合テストが緑である。 |
| O3 | 照合操作 API・取消・MF 除外・操作履歴を migration 付きで追加する。 | API 統合テストが認証付きで照合 / 別取引 / 除外 / 一括 (201 件で 400、部分成功の内訳) / 取消 / 直前の操作の取得を検証し、migration が既存 D1 に冪等に適用され、元に戻すと KPI とキューが操作前の値に戻る。 |
| O4 | 共通シェルの差分を実装する。 | shell 系 DOM テストをサイドバー新文言・件数バッジ・月次クローズ 3/4 (自動 3 + レビュー手動の保存と取消)・ヘッダーのアイコンボタン・フッターリンクで更新して緑、月次レビュー API の統合テストが緑である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に照合判定関数 (一致度・一致の理由・ステータス・キュー 4 分類・KPI) を置き、buildExpenseProjection とハブのバッジが判断と除外を反映するよう揃える。
- **I4**: 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。
- **I5**: routeMetadata のラベルとグループを画像に揃え、件数バッジ・月次クローズ 3/4 (月次レビュー完了の保存と取消)・ヘッダーのアイコンボタン・フッター・改善を送るボタンを共通シェルに入れる。
- **I7**: 一致度・キュー・ステータス・月次クローズ判定の規則を docs に書き、docs/data-schema.md の古い候補条件を直し、境界値テストで固定する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を照合の判定の置き場所に適用した。一致度・一致の理由・ステータス・対応キュー 4 分類・KPI・月次クローズ判定は入出力を持たない業務規則なので core の reconciliationReport / monthlyCloseStatus に置き、GET /api/reconciliation と actions/undo の route は loadDataset・freee 系テーブル・MF 除外・操作履歴の読み書きをして core へ渡す adapter に留める。DDD card の集約の考え方は、照合判断を duplicate_verdicts に一本化して総収支と共用する判断 (qa-reconciliation-decision-002) に効いた。buildExpenseProjection に判断と除外を渡すのは、同じ『要確認』を 2 つの関数が別の定義で数えて照合・ハブ・総収支の件数がずれる現状を、集約の不変条件 1 つにまとめるためである。API Design Patterns card は照合専用の GET 1 本と actions/undo の書込 (qa-backend-web-rc-decision-007) に効き、一括は最大 200 件で結果を件ごとの成否として返す部分成功の形にした。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T08:59:56Z)

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
| hono-validation | 4.13.8 | Hono (hono.dev) | https://hono.dev/docs/guides/validation | 2026-09-15T09:06:39Z | 2026-09-15T09:06:39Z |
