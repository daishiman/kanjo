---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G3, G4, G5]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-settings-backend-web-003。裏付け質疑 (`qa_refs`): `qa-settings-backend-web-evidence-001`, `qa-settings-backend-web-002`, `qa-settings-backend-web-004`, `qa-settings-decision-001`, `qa-settings-decision-003`, `qa-settings-decision-005`, `qa-settings-decision-006`, `qa-settings-decision-007`, `qa-settings-decision-008`, `qa-settings-decision-010` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend ではスマートフォン向け専用アプリからの設定の同期とオフライン中の変更の競合解決 (baseSavedAt の扱い) を API に足す必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend ではタブレット向け専用アプリからの設定の同期とオフライン中の変更の競合解決 (baseSavedAt の扱い) を API に足す必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend ではWindows 向けデスクトップアプリからの設定の同期とオフライン中の変更の競合解決 (baseSavedAt の扱い) を API に足す必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend ではLinux 向けデスクトップアプリからの設定の同期とオフライン中の変更の競合解決 (baseSavedAt の扱い) を API に足す必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend ではmacOS 向けデスクトップアプリからの設定の同期とオフライン中の変更の競合解決 (baseSavedAt の扱い) を API に足す必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 設定画面のバックエンドでは、取引先ルールの適用を保存済み明細の書換えではなく集計時の純関数へ置く形へ反映した。ルールを消せば次の集計から元に戻るので、recomputeFromDeals は勘定科目ルールが変わった保存に限る。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | 設定画面のバックエンドでは、全節の変更・変更履歴の追記・JSON snapshot の無効化を 1 つの D1 batch にまとめ、baseSavedAt が古ければ 409 で何も書かない形へ反映した。復元は差分プレビューと本適用を分け、本適用の直前に現在の設定を R2 へ退避する。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G3, G4, G5

#### 主たる接地根拠: `qa-settings-backend-web-003`

**問**

web の設定画面の backend 要件のうち、利用者の決定・承認に遡れるものは何か。

**答**

web の設定画面のバックエンド要件 (G2〜G5・I2・I3・I5・I6・決定 001・003・005〜008・010 に基づく): core に設定画面の算出、集計ルールの照合と適用、現金上書きの解決、設定 JSON の検証と差分を純関数で置く (I2)。集計ルールは勘定科目を従来どおり取込時に、取引先を集計時に 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類 の順で適用し、照合は NFKC・大小文字を揃えた完全一致、同じ元表記は並び順で優先、無効の行は効かない (決定 005・G2)。現金上書きは 空欄 = 上書きしない / 0 = 0 円 と 全期間 / 月指定 を区別し、core の現金集計に効かせる (決定 003)。API は 画面の取得、全節の変更を baseSavedAt つきで 1 回に受けて古ければ 409 にし変更履歴を追記する保存 (G3・決定 008)、元に戻す用の直前値、設定のみ JSON の書き出し、差分プレビューと確認を経て復元直前に現在の設定を退避する設定の復元 (決定 006)、状態・メモ・要約つきのバックアップ一覧と現在の設定との比較 (決定 007)、バックアップからの設定だけの復元 (設定の復元と同じ経路、取引は消さない、決定 010) を持つ。夜間バックアップは JST 2:00 に実行し、成否を残す (決定 007)。既存の API と機能は消さない (G5)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が決めた・承認したものだけから書き起こした要件。出所は 画像 design/FINAL-UI/images/18-settings.png (利用者が正本と指示)、U1-U9 (appr-foundation-settings-001)、決定 qa-settings-decision-001〜010 と qa-settings-target-platforms-001。仕組みの選択 (パス・保存先の形・部品名・具体値) は同じ章の -002 と -004 (agent-inference) に分けた。 / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-backend-web-evidence-001`

**問**

web の設定画面の backend について、既存コードで何が観測できるか。

**答**

routes/settings.ts: GET /settings (:89-111) は statMinMonths・normMap・unrecordedExpMonths・cashOverrides を返し、PUT /settings (:113-264、素の zValidator) は normMap を全件置換して recomputeFromDeals を伴い、cashOverrides は月単位の upsert/削除。GET/PUT /settings/owner-labels (:735-800) は 4 名義必須で core の validateOwnerLabels を使う。GET /backups・/backups/:date (:703-725)。出力は routes/analytics.ts:826-886、復元は routes/imports.ts:1924 POST /restore (形だけ検査、import writer lease)。予算の PUT /api/budget-plans は revisionOf (MAX(updated_at)) と baseSavedAt で 409、publicJsonValidator を使う。core の cashOverride はどの集計にも効いていない。normalizeAccount は core/normalize.ts:23。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存コードの読解 (HEAD 0ed2d8c、Explore 調査) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-backend-web-002`

**問**

web の設定画面の backend で、利用者が決めていない具体値は何か。

**答**

具体値の推定: 設定 JSON は {format:'kanjo-settings', version:1, exportedAt, normRules[], ownerLabels, statMinMonths, cashOverrides[]}。取引先ルールの照合キーは NFKC → 大文字小文字の畳み込み → 前後空白除去。recomputeFromDeals は勘定科目ルールが変わった保存のときだけ走らせる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者確認も検証可能な出典も経ていない具体値。実装時に確かめる) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-backend-web-004`

**問**

web の設定画面の backend で、利用者が選んでいない仕組みの選択は何か。

**答**

仕組みの選択の推定 (backend): パスは GET /api/settings/screen、PUT /api/settings/screen、GET /api/settings/history?ruleId=、GET /api/settings/export、POST /api/settings/restore/preview、POST /api/settings/restore、GET /api/backups (状態・メモ・要約を追加)、GET /api/backups/:date/compare、POST /api/backups/:date/restore/preview、POST /api/backups/:date/restore。バックアップ本文から設定部分を取り出して設定 JSON と同じ検証と置換に渡す。算出の名前は settingsScreen。recomputeFromDeals は勘定科目ルールが変わった保存に限る。成否は R2 の customMetadata に残す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者が選んでいない仕組みの選択。実装時に確かめる) / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-decision-001`

**問**

『集計ルール (カテゴリの正規化マップ)』は何を正規化するか。既存の正規化マップは freee 勘定科目の表記 → 集計用の科目名 (取込時に適用) だが、画像の例はスターバックス / スタバ / Starbucks → カフェ・外食 という取引先名 → カテゴリで、既存の仕分けルールやベンダー記憶と役割が近い。

**答**

両方を 1 つの一覧で扱う。種別列 (勘定科目 / 取引先) を足し、両方の正規化を同じ表で管理する (利用者は推奨の『既存の意味を保つ』ではなくこちらを選択)。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_01R6CJR4FUhg2JPXKFni2JGY の questions[0]、提示 2026-09-22T07:52:41Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】「集計ルール（カテゴリの正規化マップ）」は何を正規化しますか？ 既存の正規化マップは『freee 勘定科目の表記 → 集計用の科目名』(取込時に適用)ですが、画像の例は『スターバックス / スタバ / Starbucks → カフェ・外食』という取引先名 → カテゴリです（既存の仕分けルールやベンダー記憶と役割が近い）。 【選択肢】(1)『既存の意味を保つ (推奨)』— account_norm_map を『元の表記 → 正規化後のカテゴリ』として画像の見た目にする。正規化後は select（既存の科目・カテゴリ候補から選ぶ）、並び順・有効/無効・更新日時・更新者の列を追加のみの migration で足す。取引先名の表記ゆれは既存の仕分けルールが担当のまま。 (2)『取引先名→カテゴリに変える』— 画像の例どおり、取引先名の表記ゆれをカテゴリへまとめる新しいルール表を作る。既存の仕分けルール・ベンダー記憶と役割が重なるため、優先順位の整理と移行が必要になり範囲が大きい。 (3)『両方を1つの一覧で扱う』— 種類列（勘定科目 / 取引先）を足して、両方の正規化を同じ表で管理する。UI は画像に近いが、適用箇所が2系統になり検証が重い。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり (推奨外を選択) / 回答時刻: 2026-09-22T08:24:29Z)

#### 裏付け質疑: `qa-settings-decision-003`

**問**

『現金上書き』をどう作るか。既存は月ごとの入金・支出の値で、どの集計にも効いていない。画像は現金の支払い / 受け取りそれぞれに上書き値・適用範囲 (全期間)・メモ (100 字)、空欄 = 上書きしない / 0 = 0 円で上書き。

**答**

画像どおり＋集計へ反映 (推奨)。支払い・受け取りの 2 行に上書き値 (空欄と 0 を区別)・適用範囲 (全期間 / 月指定)・メモを持たせ、core の現金集計に実際に効かせる。既存の月ごとの値は『月指定』の行として追加のみの migration で引き継ぐ。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_01R6CJR4FUhg2JPXKFni2JGY の questions[2]、提示 2026-09-22T07:52:41Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】「現金上書き」をどう作りますか？ 既存は月ごとの入金・支出の値で、しかも現状どの集計にも効いていません（保存・出力のみ）。画像は『現金の支払い / 受け取り』それぞれに上書き値・適用範囲（全期間）・メモ(100字)、空欄=上書きしない / 0=0円で上書き。 【選択肢】(1)『画像どおり＋集計へ反映 (推奨)』— 支払い・受け取りの2行に上書き値（空欄と0を区別）・適用範囲（全期間 / 月指定）・メモを持たせ、core の現金集計に実際に効かせる。既存の月ごとの値は『月指定』の行として引き継ぐ（追加のみの migration）。 (2)『画像どおり、集計反映は別件』— 見た目・保存・空欄と0の区別までは作るが、集計への反映は今回は行わず後続の課題にする。 (3)『月ごとのまま見た目だけ』— 既存の月ごとの入金・支出の仕組みを保ち、画像の表の見た目に寄せるだけにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:24:29Z)

#### 裏付け質疑: `qa-settings-decision-005`

**問**

集計ルールの『取引先』種別の行 (例: スタバ → カフェ・外食) は、いつ・どの優先順位で効かせるか。

**答**

集計時に適用・手動と仕分けルールの次 (推奨)。保存済みの明細は書き換えず集計時に適用する。優先順位は 手動編集 > 仕分けルール > 集計ルール (取引先) > 自動分類。照合は NFKC・大小文字を揃えた完全一致。行の並び順は同じ元表記が重なった時の優先度。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[0]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】集計ルールの『取引先』種別の行（例: スタバ → カフェ・外食）は、いつ・どの優先順位で効かせますか？ 【選択肢】(1)『集計時に適用・手動と仕分けルールの次 (推奨)』— 保存済みの明細は書き換えず、集計時に適用するので『元に戻す』が安全。優先順位は 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類。照合は NFKC・大小文字を揃えた完全一致。行の並び順は同じ元表記が重なった時の優先度。 (2)『取込時にカテゴリを書き込む』— 勘定科目の正規化と同じく取込時に適用し、明細のカテゴリを確定させる。変更したら過去分の再計算が要る。 (3)『仕分けルールより優先』— 集計時に適用し、手動編集以外では最優先にする。既存の仕分けルールの結果が変わる可能性がある。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

#### 裏付け質疑: `qa-settings-decision-006`

**問**

『復元』と『設定のエクスポート (JSON)』の範囲は。現在の JSON 出力は取引を含む全データで、復元は HTML 版からの初期移行 (全データ置換) だけ。

**答**

設定だけを出力・復元 (推奨)。集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出し、同じ形だけを復元で受ける (厳密な形の検証・サイズ上限・復元前に現在の設定を自動バックアップ・差分プレビューと確認)。取引は消えない。全データの初期移行は『その他の管理』に残す。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[1]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】「復元」と「設定のエクスポート(JSON)」の範囲は？ 現在の JSON 出力は設定だけでなく取引を含む全データで、復元は HTML 版からの初期移行（全データを置き換え）だけです。 【選択肢】(1)『設定だけを出力・復元 (推奨)』— 集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出力し、同じ形だけを復元で受ける（厳密な形の検証・サイズ上限・復元前に現在の設定を自動でバックアップ・差分プレビューと確認）。取引は消えない。全データの初期移行は『その他の管理』に残す。 (2)『全データを出力・復元』— 取引を含む全データを出力・復元する。復元で取引も置き換わるため影響が大きい。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

#### 裏付け質疑: `qa-settings-decision-007`

**問**

自動バックアップをどうするか。画像は『毎日 午前2:00』・ステータス (最新 / 成功)・メモ・比較・復元。現状は毎日 3:00 (JST) に全データを R2 へ保存、30 日保持、失敗はログのみ。

**答**

2:00 に変更＋状態・メモ・比較を足す (推奨)。cron を JST 2:00 に変え、各バックアップに状態 (成功 / 失敗)・メモ・設定部分の要約を持たせ、失敗も一覧に出す。『比較』はその日の設定と現在の設定の差分を表示する。中身は従来どおり全データ。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[2]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】自動バックアップをどうしますか？ 画像は『毎日 午前2:00』・ステータス（最新/成功）・メモ・比較・復元。現状は毎日 3:00(JST) に全データを R2 へ保存、30日保持、失敗はログのみです。 【選択肢】(1)『2:00に変更＋状態・メモ・比較を足す (推奨)』— cron を JST 2:00 に変え、各バックアップに状態（成功/失敗）・メモ・設定部分の要約を持たせる。失敗も一覧に出す。『比較』はその日の設定と現在の設定の差分を表示。中身は従来どおり全データ。 (2)『3:00のまま、表示を実際に合わせる』— 実行時刻は変えず、説明文を『午前3:00』にする。状態・メモ・比較は足す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

#### 裏付け質疑: `qa-settings-decision-008`

**問**

右パネルの『最終更新 (更新者)』と『このルールを元に戻す』は何を基準にするか。

**答**

変更履歴表で直前の保存値へ (推奨)。設定の変更を追記のみの履歴表 (変更前・後・更新者・日時) に残し、『元に戻す』はそのルールの直前の保存値を下書きへ戻す (保存で確定)。更新者は利用者名、復元や移行で入った値は『システム』。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[3]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】右パネルの『最終更新（更新者）』と『このルールを元に戻す』は何を基準にしますか？ 【選択肢】(1)『変更履歴表で直前の保存値へ (推奨)』— 設定の変更を追記のみの履歴表に（変更前・後・更新者・日時）残し、『元に戻す』はそのルールの直前の保存値を下書きへ戻す（保存で確定）。更新者は利用者名、復元や移行で入った値は『システム』。 (2)『未保存の編集だけを戻す』— 履歴は持たず、行に更新日時・更新者の列だけ足す。『元に戻す』は最後に保存した値への取消しになる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

#### 裏付け質疑: `qa-settings-decision-010`

**問**

設定画面の『バックアップ』節で、ある日のバックアップを『復元』したとき、何を戻しますか？ 【提示した選択肢 (逐語)】(1)『設定だけ戻す (Recommended)』— 集計ルール・名義・統計・現金上書きだけをその日の値へ戻し、取引は消さない。『比較』の差分と同じ範囲で、設定 JSON の復元と同じ経路 (差分プレビュー→確認→直前に現在の設定を退避) を通す。U3 G4『取引は消えない』と一致する。 (2)『全データを戻す』— 取引も含めてその日の状態へ置き換える (既存 /api/restore と同じ意味)。取引が消えうるので、G4『取引は消えない』の書き換えと強い確認が必要になる。

**答**

設定だけ戻す (推奨)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 2 件の文面を question に逐語で保存 (推奨案を選択) / 回答時刻: 2026-09-22T09:40:36Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 設定の意味を core の 1 か所で決める。集計ルールは種別 (勘定科目 / 取引先) を持つ 1 つの一覧で、勘定科目は従来どおり取込時に、取引先は集計時に 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類 の順で適用し、照合は NFKC・大小文字を揃えた完全一致、同じ元表記は並び順で優先する。無効の行は効かない。現金上書きは支払い・受け取りそれぞれ空欄=上書きしない / 0=0 円で上書き を区別し、適用範囲 (全期間 / 月指定) で core の現金集計に実際に効かせる。名義 4 つの表示名と統計の最小月数 (既定 6、範囲 3〜24) を同じ core の規則で検証する。
- **G3**: 設定を安全に保存する。全節の編集を 1 つの下書きに集め、未保存の件数を数え、localStorage へ自動保存・復元し、リセットと離脱の前に確認する。保存は baseSavedAt つきの 1 回の PUT で、他所の更新と競合したら 409 で上書きを防ぐ。設定の変更は追記のみの変更履歴表に 変更前・変更後・更新者・日時 を残し、右パネルの最終更新・更新者と『このルールを元に戻す』(直前の保存値を下書きへ戻す) はそこから導く。復元や移行で入った値の更新者は『システム』とする。
- **G4**: 設定を持ち出し・戻せるようにする。設定のエクスポートは集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出し、復元は同じ形だけを受ける (厳密な形の検証・サイズ上限・差分プレビューと確認・復元直前に現在の設定を自動退避)。取引は消えない。マトリクス CSV・取引 CSV・レポート HTML は選択中の期間で出す。自動バックアップは毎日 JST 2:00 に実行し、各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせて失敗も一覧に出し、『比較』でその日の設定と現在の設定の差分を見てから『復元』できる。
- **G5**: 既存のデータと安全性を壊さない。migration は追加のみで既存行の書き換えは 0 件、既存の設定値は初回に同じ意味で引き継ぐ。設定系の変更 API は認証・パスワード変更強制・スキーマ確認・canonicalMutationFence の内側に置き、公開向けの入力検証 (詳細を外に出さない) と本文サイズ上限を掛ける。外部送信は 0 件で、画像に無い既存の設定機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) は 1 つも消さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 集計ルールと現金上書きの意味が core の純関数 1 か所で決まり、画面・API・集計が同じ結果を出す。 | core の単体テストで、取引先ルールの優先順位 (手動 > 仕分けルール > 集計ルール > 自動)・NFKC 照合・並び順優先・無効行の不適用、現金上書きの 空欄 / 0 / 全期間 / 月指定 の 4 通りが期待値どおりで、既存の勘定科目正規化の結果が変わらない (回帰 0 件)。 |
| O3 | 保存が 1 回にまとまり、競合と取り消しが安全に扱える。 | API 結合テストで、古い baseSavedAt の PUT が 409 を返して行が変わらず、保存ごとに変更履歴が追記され (更新・削除は 0 件)、『元に戻す』が直前の保存値を返す。DOM テストで未保存件数・下書きの復元・リセットと離脱の確認が動く。 |
| O4 | 設定の書き出し・復元・バックアップが安全に往復する。 | 書き出した JSON を復元すると設定が一致し取引件数は不変、形の違う JSON・上限超過・版違いは 4xx で拒否され何も変わらない。復元前の自動退避が 1 件増える。scheduled のテストで 2:00 の実行が状態つきで保存され、失敗も一覧に出る。比較が差分を返す。 |
| O5 | 既存データと安全性の回帰が 0 件である。 | migration が追加のみで既存行の書き換え 0 件、既存の設定値が初回に引き継がれる。設定系の新 API が CANONICAL_MUTATION_ROUTES に登録され、未認証 401・本文上限超過 413・不正入力で詳細を返さない。外部送信 0 件。既存の設定機能の DOM テストが引き続き緑。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Settings.tsx を pages/settings/ 配下へ分割し、見出し・期間タブ・節ナビ・各節・説明パネル・保存バーの構成に作り直す。画像外の既存機能はアカウント / その他の管理の節へ移す。
- **I2**: core に設定画面の算出 (仮称 settingsScreen) と、集計ルールの照合・適用 (勘定科目 / 取引先)・現金上書きの解決・設定 JSON の検証と差分を新設する。
- **I3**: 集計ルールと現金上書きの列追加・変更履歴表の追加のみの migration と、GET / PUT の設定 API (baseSavedAt つき・409・変更履歴の追記) を作り、canonicalMutationFence に登録する。
- **I4**: 下書きの localStorage 自動保存・復元・未保存件数・リセットと離脱の確認を予算画面の先例 (draft.ts・BudgetSaveBar) にならって作る。
- **I5**: 設定のみの JSON 書き出し・復元 API (版番号・厳密検証・サイズ上限・差分プレビュー・復元前退避) と、出力 3 種の期間連動を作る。
- **I6**: 夜間バックアップを JST 2:00 にし、R2 の customMetadata に状態・メモ・設定要約を持たせ、失敗も記録する。一覧 API に状態・メモ、比較 API に差分を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

API Design Patterns・Clean Architecture・DDD の 3 card を適用した。Concurrency and consistency: 全節の保存は baseSavedAt を版として受け、古ければ 409 で何も書かない。Resource and operation semantics: 差分プレビューは読むだけ、復元は書込みと分ける。Dependency Rule: 取引先ルールの照合と現金上書きの解決は入出力を持たないので core に置き、route は D1/R2 から組んだ入力を渡して結果を書くだけにする。DDD の Ubiquitous Language: 『集計ルール』『現金上書き』『元に戻す』を画面・API・テストで同じ語と意味に揃える。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-22T09:45:25Z)

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
| hono-body-limit | 4.13.8 | Hono (honojs) (github.com) | https://github.com/honojs/hono/blob/main/src/middleware/body-limit/index.ts | 2026-09-22T08:43:18Z | 2026-09-22T08:43:18Z |
| mdn-string-normalize | 2025-07-10 | MDN Web Docs (Mozilla) (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize | 2026-09-22T08:43:18Z | 2026-09-22T08:43:18Z |
