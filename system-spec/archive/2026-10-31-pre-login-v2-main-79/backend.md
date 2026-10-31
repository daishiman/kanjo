---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G3]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-bulk-decision-068。裏付け質疑 (`qa_refs`): `qa-classify-bulk-decision-015`, `qa-classify-bulk-backend-web-006`, `qa-classify-bulk-backend-web-evidence-001`, `qa-classify-bulk-backend-web-001`, `qa-classify-bulk-backend-web-003`, `qa-classify-bulk-decision-006`, `qa-classify-bulk-decision-005`, `qa-classify-bulk-backend-web-005`, `qa-classify-bulk-decision-007`, `qa-classify-bulk-decision-009`, `qa-classify-bulk-backend-web-007`, `qa-classify-bulk-decision-010`, `qa-classify-bulk-decision-011`, `qa-classify-bulk-decision-012`, `qa-classify-bulk-backend-web-008`, `qa-classify-bulk-prior-cycle-001`, `qa-classify-bulk-decision-013`, `qa-classify-bulk-decision-014`, `qa-classify-bulk-backend-web-009`, `qa-classify-bulk-decision-016`, `qa-classify-bulk-decision-017`, `qa-classify-bulk-decision-018`, `qa-classify-bulk-decision-028`, `qa-classify-bulk-backend-web-010`, `qa-classify-bulk-decision-029`, `qa-classify-bulk-decision-030`, `qa-classify-bulk-decision-031`, `qa-classify-bulk-decision-033`, `qa-classify-bulk-delegated-001`, `qa-classify-bulk-decision-034`, `qa-classify-bulk-delegated-002`, `qa-classify-bulk-decision-035`, `qa-classify-bulk-delegated-003`, `qa-classify-bulk-decision-036`, `qa-classify-bulk-delegated-004`, `qa-classify-bulk-decision-037`, `qa-classify-bulk-decision-038`, `qa-classify-bulk-decision-039`, `qa-classify-bulk-decision-040`, `qa-classify-bulk-decision-045`, `qa-classify-bulk-decision-046`, `qa-classify-bulk-decision-047`, `qa-classify-bulk-decision-048`, `qa-classify-bulk-decision-049`, `qa-classify-bulk-decision-050`, `qa-classify-bulk-decision-051`, `qa-classify-bulk-decision-052`, `qa-classify-bulk-decision-041`, `qa-classify-bulk-decision-042`, `qa-classify-bulk-decision-043`, `qa-classify-bulk-decision-054`, `qa-classify-bulk-decision-055`, `qa-classify-bulk-decision-056`, `qa-classify-bulk-decision-057`, `qa-classify-bulk-decision-058`, `qa-classify-bulk-decision-069`, `qa-classify-bulk-decision-070`, `qa-classify-bulk-decision-072`, `qa-classify-bulk-decision-074` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend では専用アプリの版ごとに一括保存と選択の読み出し API の要求形・応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend では専用アプリの版ごとに一括保存と選択の読み出し API の要求形・応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend では専用アプリの版ごとに一括保存と選択の読み出し API の要求形・応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend では専用アプリの版ごとに一括保存と選択の読み出し API の要求形・応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend では専用アプリの版ごとに一括保存と選択の読み出し API の要求形・応答形を維持する後方互換の設計を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | classify-bulk.ts を『zod で検証 → userId で明細と勘定科目の対応表を引く → core で値を解決 → 書き込みの予算 (1 回の batch の文 50 本・束ねた JSON 2MB) を測る → json_each で束ねた 1 回の batch で書く』の 5 段に揃える形へ反映した。予算を超える要求は、書く前に 413 too_many_classify_changes で返す。値の解決と由来の順位を route の中に書かず、選択の読み出しも同じ引き直しの関数を使う。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | GET /api/transactions の応答から絞り込み後の全件 (matched) を外し、表示中のページの行と総件数だけを返す形へ反映した。表示外の選択の中身は選択の読み出しだけが返す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3

#### 主たる接地根拠: `qa-classify-bulk-decision-068`

**問**

要件の土台のうち、一括保存の値の決め方を書いた 4 項目 (G1・O1・I2・範囲に含む 2) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、この回と次の回で 3 つずつ伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。4 項目とも、以前の承認 (decision-015) の後の決定で文面が変わりました。主な変化: 区分に合うカテゴリの組が、埋める値のどこにも無い明細は、外さずに『カテゴリなし』で保存し、保存前の内訳にその件数を出す (decision-037・048)。『カテゴリなし』は予約の値で持ち、集計では未分類と同じに数え、分類の状態は手動とし、一括指定の欄と編集パネルでは選べない (decision-045〜048)。書き込みは json_each で束ねた 1 回の batch で行い、batch が失敗したら要求を 2xx で返して保存対象の全件を write_failed にする (delegated-001・decision-057)。以前の問 (decision-015) は、『承認しない』にだけ結果を書いていて選択肢の書き方が片寄っていたので、各選択肢に利点と不利な点を書いて問い直します。承認すると、この問の記録を、仕様の backend の章 (一括保存の API) の主な根拠にします。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 3000 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・値の決め方」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-024)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:12:13.849Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-015 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T09:12:14Z)

#### 裏付け質疑: `qa-classify-bulk-decision-015` — 旧版（置き換え先: `qa-classify-bulk-decision-068`）

> **旧版** — この問答は `qa-classify-bulk-decision-068` で置き換えられた (`2026-10-01T09:14:01Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は、『承認しない』にだけ結果を書き、利点と不利な点の対が無く、選択肢の書き方が片寄っていた (N2 の違反)。また、承認の後の決定で土台の文面が変わり、今の全文を逐語で示した承認が無かった (軸 5)。今の全文を preview に置き、各選択肢に利点と不利な点を書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-024。利用者は『承認する』を選んだ。

**問**

```text
テーマ A（値の決め方）: G1・O1.measure・I2・範囲 in[2] を、preview の「新」の文面に改めることを承認しますか？
```

**答**

```text
承認する。4 項目を preview の「新」の文面に改めます。改めた後の文面は requirements_foundation の該当項目にある。承認した文面の要点: 指定しない項目は、未整理の明細では下書き→提案、確定済みの明細では下書き→今の値の順で埋め、区分とカテゴリは 1 組で決め、外す行には理由 (埋める値が無い・区分に合うカテゴリの組が無い・確定済みで変わる値が無い) を付ける。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-007)。利用者はこの問で「承認する」を選択。answered_at は回答受領時刻 (2026-09-30T15:07:35.741Z) を秒へ切り上げた値で、選択時刻の上界である。backend と security の web セルの reopen (2026-09-30T15:04:11Z) より後の回答である。 / 回答時刻: 2026-09-30T15:07:36Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-006`

**問**

承認 appr-foundation-classify-bulk-003 を受けて、一括保存の API は何を受け取り、どう書き、要求全体の 400 と明細単位の失敗をどう分けて返すか。

**答**

POST /api/transactions/bulk は一括指定と各明細の下書きを受け取り、サーバが選択した明細を引き直して core で値を解決し (一括指定→下書き→提案の順)、編集と履歴を json_each で束ねた 1 回の batch で書く。応答は明細ごとに ok:true か、失敗の code (not_found / invalid_item / split_line_not_supported / no_value / write_failed) のどれかを返す。要求全体を 400 にするのは件数の範囲外・txId の重複・一括指定の値の範囲外の 3 つだけで、各明細の下書きの値の範囲外と、解決後の科目が区分の系統と合わない明細は、その明細だけを invalid_item で返す (security と同じ境界)。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T12:33:49Z` — provenance の『U1〜U9 の全文』は、保存値の逐語ではなく全項目を言い換えた提示を指す (提示と回答の逐語は qa-classify-bulk-presented-options-003)。『提示 (2026-09-30T11:52:04.835Z)』は表示の前に測った下限で、本文の表示は 2026-09-30T11:52:47.000Z、問の提示は 2026-09-30T11:52:50.231Z。『受領 2026-09-30T12:01:11.715Z』は受領の後に測った値で、回答の受領は 2026-09-30T12:01:05.458Z (いずれもセッション記録)。answered_at 12:01:12Z は承認時刻の上界として引き続き成り立つ。
> - `2026-09-30T21:16:05Z` — answer の解決順『一括指定→下書き→提案の順』は、未整理の明細は一括指定→下書き→提案、確定済みの明細は一括指定→下書き→今の値の順になり (qa-classify-bulk-decision-013・qa-classify-bulk-decision-015)、区分とカテゴリは 1 組で決める (qa-classify-bulk-decision-010)。要求全体を 400 にする『txId の重複』は、qa-classify-bulk-decision-017 で『選択の key と一括の txId の重複』になった。question が受ける土台の承認 appr-foundation-classify-bulk-003 (提示の逐語は qa-classify-bulk-presented-options-003) は、appr-foundation-classify-bulk-004 (提示の逐語は qa-classify-bulk-presented-options-007) で改められた。backend×web の主の qa_ref は、2026-09-30T15:04:11Z の reopen の後、qa-classify-bulk-decision-015 に移った。書き込み方式 (json_each で束ねた 1 回の batch) と明細単位の失敗の code は変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で U1〜U9 の全文と『3 章の確定内容』を 1 回で提示し (2026-09-30T11:52:04.835Z)、その backend 行 (一括指定と下書きを受け取りサーバが引き直して core で解決し束ねた 1 回の batch で書く・応答は明細ごとに ok:true か失敗の code・400 と invalid_item の境界は security と同じ) と G3 (一括指定→下書き→提案の順で値を解決する) を、利用者が『この内容で承認』で承認した (受領 2026-09-30T12:01:11.715Z)。answered_at は受領時刻を秒へ切り上げた値で、承認時刻の上界である。qa-classify-bulk-backend-web-001 の約束 (選択の読み出し・一覧の応答の縮小・MF の分類) と qa-classify-bulk-backend-web-005 の失敗の code を引き継ぐ。 / 回答時刻: 2026-09-30T12:01:12Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行実装について何を観測したか。

**答**

GET /api/transactions (packages/api/src/routes/classify.ts:253) は、ページの rows に加え、互換のため絞り込み後の全件を transactions に入れて返す (classify.ts:381-389)。limit は PAGE_LIMIT 以外を 400 にする (classify.ts:196-199)。POST /api/transactions/bulk の item は txId と値だけで、一括指定や下書きの欄は無く (packages/api/src/routes/classify-bulk.ts:48-57)、値は applyManualEditWithBase で現在値に重ねる (classify-bulk.ts:139)。core の candidatesFor (packages/core/src/classify-status.ts:194-258) の由来は 記憶・ルール・MF 中項目の対応表 (mf_mid、classify-status.ts:247-256) の 3 つで、取込 CSV の大項目・中項目をそのまま使う由来は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-30T07:53:11Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-001`

**問**

一括保存・選択の読み出し・提案の算出で、API と core は何を約束するか。

**答**

POST /api/transactions/bulk を拡張し、一括指定と各明細の下書きを受け取る。サーバは選択した明細を引き直し、core の解決関数で 一括指定→下書き→提案 の順に値を決める。値を決められない明細は明細単位の失敗として返す。選択中の明細を一覧の行の形で返す読み出し API (最大 50 件、利用者ごとに分離) を追加し、一覧の応答から絞り込み後の全件を外す。一覧の表示件数は 25 / 50 / 100 件を受ける。core の候補の算出に最後の由来『MF の分類』を足す (取込 CSV の大項目・中項目、区分と所有者は現在の解決値、信頼度 60、根拠文『MFの分類をそのまま提案』)。既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度、要確認の閾値 80 は変えない。KPI・ナビのバッジ・月次クローズは既存の 1 か所の関数から数え続ける。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T21:16:05Z` — answer の解決順『一括指定→下書き→提案』は、未整理の明細は一括指定→下書き→提案、確定済みの明細は一括指定→下書き→今の値の順になり (qa-classify-bulk-decision-013・qa-classify-bulk-decision-015)、区分とカテゴリは 1 組で決める (qa-classify-bulk-decision-010)。最後の由来『MF の分類』は、qa-classify-bulk-decision-006・qa-classify-bulk-decision-009・qa-classify-bulk-decision-016 で個人の明細にだけ付く形になり、集計ルールが当たる明細では、ルールを当てた後の値と、集計ルールの名前の根拠文になった (qa-classify-bulk-decision-011)。『選択中の明細を一覧の行の形で返す読み出し API』は、qa-classify-bulk-decision-007 で行の key を受ける形になった。信頼度 60、既存の由来の順位と信頼度、要確認の閾値 80 は変わらない。
> - `2026-10-01T09:47:30Z` — 2026-09-30T21:16:05Z の訂正の『最後の由来「MF の分類」は個人の明細にだけ付く』は、qa-classify-bulk-decision-040・qa-classify-bulk-decision-049・qa-classify-bulk-decision-050・qa-classify-bulk-decision-051・qa-classify-bulk-decision-052 で改まった。事業の明細にも、利用者ごとに DB の表に持つ勘定科目の対応表で MF の大項目から引いた勘定科目を、中項目は空のまま、由来『MF の分類 (対応表)』・信頼度 60 で付け、根拠文に大項目と勘定科目の対応を書く。勘定科目の対応表に行の無い大項目の事業の明細 (qa-classify-bulk-decision-050) と、MF の大項目が空か『未分類』の明細 (qa-classify-bulk-decision-039) には、個人・事業とも付けない。API の約束に、勘定科目の対応表の読み出し・追加・削除が加わる (qa-classify-bulk-decision-049)。answer の『値を決められない明細は明細単位の失敗として返す』のうち、区分だけを指定して、区分に合うカテゴリの組が埋める値のどこにも無い明細は、失敗にせず『カテゴリなし』(予約の値) で保存する (qa-classify-bulk-decision-037・qa-classify-bulk-decision-045・qa-classify-bulk-decision-048)。解決の順、選択の読み出し API、一覧の表示件数、信頼度 60 と既存の由来の順位と信頼度、要確認の閾値 80、KPI・ナビのバッジ・月次クローズを既存の 1 か所の関数から数えることは変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-classify-bulk-001) と決定 qa-classify-bulk-decision-001〜004 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-30T07:53:11Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-003`

**問**

一括保存の拡張と選択の読み出しで、利用者が決めていない要求形・応答形を何にするか。

**答**

一括保存の要求は { bulk?: { cls?, big?, mid?, owner?, paymentMethod? }, items: [{ txId, draft?: { 既存 itemSchema と同じ値 } }] } とし、値の欄を持つ旧形式の item も受け付ける (旧クライアント互換)。値を決められない明細は error.code='no_value' の明細単位の失敗にする。選択の読み出しは GET /api/transactions/selected?keys=<sel の値をカンマ区切り> で 1〜50 件を受け、一覧の行と同じ形の rows と、見つからなかった key の missing を返す (存在しないものと他の利用者のものを区別しない)。大項目が空か『未分類』の明細には『MF の分類』の提案を付けない。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-10-01T10:08:23Z` — 本記録の各部の今の根拠は次のとおり。(1) 一括指定の欄 (区分・カテゴリ (大/中)・所有者・支払い方法) は qa-classify-bulk-decision-041 で利用者が選び、要件の土台の G1 にある (qa-classify-bulk-decision-068 で文面を承認)。(2) 値を決められない明細を no_value の明細単位の失敗にすることと、MF の大項目が空か『未分類』の明細に『MF の分類』の提案を付けないことは、利用者が承認した qa-classify-bulk-backend-web-005 にあり、後者は qa-classify-bulk-decision-039 でも利用者が選んだ。区分だけを一括指定し、区分に合うカテゴリの組が下書き・提案・今の値のどこにも無い明細は、no_value にせず『カテゴリなし』で保存する (qa-classify-bulk-decision-048)。(3) 選択を読み出す API を足すことは qa-classify-bulk-decision-043 で利用者が選んだ。最大 50 件の行の key を専用の API で読むことは要件の土台の G3 に、他の利用者の行の key を存在を明かさず『見つからない』として扱うことは G5 にある (qa-classify-bulk-decision-072 で文面を承認)。形の違う key と 200 字を超える key は missing に入れる (qa-classify-bulk-backend-web-009 (2))。(4) 要求の JSON の形 ({ bulk?, items: [{ txId, draft? }] })、値の欄を持つ旧形式の item の受け付け、選択の読み出しの URL (GET /api/transactions/selected?keys=) と keys のカンマ区切り、応答の形 (一覧の行と同じ形の rows と missing) は、要件の土台に書かれていないサーバの細部で、利用者は 1 件ずつは確かめていない。qa-classify-bulk-decision-058 で利用者が承認した読みは『要件の土台に書かれていないサーバの細部を agent の案で決める』で、その preview (qa-classify-bulk-presented-options-020) は細部の列挙であり、(4) の細部はそこに無い。agent は、(4) をその同じ種類の細部として agent の案で決めたと読む。これは agent の読みで、利用者は未確認である。(4) の細部はどれも画面とサーバの間の内部の形で、画面の振る舞いを変えない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-30T07:53:11Z)

#### 裏付け質疑: `qa-classify-bulk-decision-006` — 旧版（置き換え先: `qa-classify-bulk-decision-039`）

> **旧版** — この問答は `qa-classify-bulk-decision-039` で置き換えられた (`2026-10-01T03:15:08Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-015。利用者は『出さない』を選んだ。

**問**

```text
MF の大項目が空か『未分類』の明細にも、『MF の分類』を提案として出しますか？（今は agent の推定で『出さない』にしています）
```

**答**

```text
出さない (推奨)。MF の大項目が空か『未分類』の明細には『MF の分類』の提案を付けない。意味の無い値 (未分類) で保存されるのを防ぐ。その行は、一括指定か下書きが無ければ、保存前の内訳に『提案なし』として外す理由を出す。取込直後の未分類の行は、一括指定しないと保存できない。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 2 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-002)。利用者はこの問で「出さない (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T11:03:43.026Z) を秒へ切り上げた値で、選択時刻の上界である。qa-classify-bulk-backend-web-003 で agent が推定していた規則を、利用者が確かめて確定した。 / 回答時刻: 2026-09-30T11:03:44Z)

#### 裏付け質疑: `qa-classify-bulk-decision-005` — 旧版（置き換え先: `qa-classify-bulk-decision-033`）

> **旧版** — この問答は `qa-classify-bulk-decision-033` で置き換えられた (`2026-10-01T01:43:48Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-014。利用者は選択肢を選ばず、無料枠の範囲で最善の慣行を選ぶよう agent に委ねた。agent の選定は qa-classify-bulk-delegated-001 に記録した。

**問**

```text
一括保存の 1 要求が、Cloudflare 無料プランの「1 起動あたり合計 50 クエリ」を超えます（50 件で 200 本超）。どう解きますか？
```

**答**

```text
書き込みを束ねる (推奨)。明細ごとの編集・履歴の書き込みを json_each で 1 文ずつに束ねる (前例: 集計の置き換え aggregateReplacementQueries)。1 要求は明細数によらず約 25 本で、50 件も 100 件も 1 回で保存でき、上限と無料プランはそのまま。書き込みは 1 つの batch になるため、失敗すると保存対象の全件が write_failed になり、明細ごとの部分成功は無くなる。store と履歴の書き込み関数を変える。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 2 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-002)。利用者はこの問で「書き込みを束ねる (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T11:03:43.026Z) を秒へ切り上げた値で、選択時刻の上界である。完成度評価 1 周目の指摘 (1 起動あたりの D1 クエリ上限を batch 単位と取り違えていた) を受けて問い直した。 / 回答時刻: 2026-09-30T11:03:44Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-005`

**問**

決定 qa-classify-bulk-decision-005・006 を受けて、一括保存の書き込みの失敗と応答、MF の分類の提案の範囲を、API と core は何と約束するか。

**答**

一括保存は、値を解決できた明細の編集と履歴を json_each で束ねた 1 回の batch で書き、書き込みが失敗したら保存対象の全件を write_failed として返す (qa-classify-bulk-decision-005)。応答は明細ごとに ok:true か、失敗の code (not_found / invalid_item / split_line_not_supported / no_value / write_failed) のどれかを返す。MF の大項目が空か『未分類』の明細には『MF の分類』の提案を付けず、一括指定も下書きも無いその明細は no_value の失敗として返す (qa-classify-bulk-decision-006)。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-10-01T10:08:23Z` — answer の qa-classify-bulk-decision-005 は、qa-classify-bulk-decision-033 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-033 で選定を agent に委ね、agent は qa-classify-bulk-delegated-001 で旧と同じ案 (json_each で束ねた 1 回の batch) を選んだ。batch が失敗したときに要求を 2xx で返し、保存対象の全件を write_failed にすることは qa-classify-bulk-decision-057 で利用者が決めた。answer の qa-classify-bulk-decision-006 は、qa-classify-bulk-decision-039 で問い直して置き換わり、利用者は旧と同じ案 (MF の大項目が空か『未分類』の明細には提案を付けない) を選んだ。画面は、その明細を、一括指定か下書きが無ければ保存前の内訳で『提案なし』として外す (qa-classify-bulk-decision-039)。区分だけを一括指定し、区分に合うカテゴリの組が下書き・提案・今の値のどこにも無い明細は、no_value にせず『カテゴリなし』で保存する (qa-classify-bulk-decision-048)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で要件定義の訂正差分を提示し (2026-09-30T11:15:06.659Z)、その『G2 / O3 / S2 (追記)』と『3 章の確定内容』の backend 行 (失敗の code は not_found / invalid_item / split_line_not_supported / no_value / write_failed) を、利用者が『この内容で承認 (推奨)』で承認した (受領 2026-09-30T11:22:17.468Z)。answered_at は受領時刻を秒へ切り上げた値で、承認時刻の上界である。qa-classify-bulk-backend-web-003 の推定のうち、no_value の失敗と未分類の除外がこれで確定した。 / 回答時刻: 2026-09-30T11:22:18Z)

#### 裏付け質疑: `qa-classify-bulk-decision-007` — 旧版（置き換え先: `qa-classify-bulk-decision-034`）

> **旧版** — この問答は `qa-classify-bulk-decision-034` で置き換えられた (`2026-10-01T01:43:48Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-014。利用者は選択肢を選ばず、無料枠の範囲で最善の慣行を選ぶよう agent に委ねた。agent の選定は qa-classify-bulk-delegated-002 に記録した。

**問**

```text
一覧で選んだ明細を、選択の読み出しと一括保存では、どの単位で扱いますか？
```

**答**

```text
行の key で読み、内訳行は選べない。API は sel の値（mf:/cash: で始まる行の key）をそのまま受け、一覧と同じ形の行を返す。保存するときは、行から txId を引く。分割の内訳行にはチェックを出さず、理由を表示する。
```

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T21:16:05Z` — provenance の後半『requirements_foundation の scope.in[3] の…と読む。』以降は、提示した選択肢 (qa-classify-bulk-presented-options-004) に無い agent の読みで、利用者が選んだのは answer の範囲だけである。この読みは、appr-foundation-classify-bulk-004 で改めた土台 (テーマ C、qa-classify-bulk-decision-017) に置き換わった。scope.in[3] は 0 から数えた添字で、提示で使った 1 から数える番号では範囲 in[4] に当たる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-004)。利用者はこの問で「行の key で読み、内訳行は選べない (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T13:33:09.494Z) を秒へ切り上げた値で、選択時刻の上界である。requirements_foundation の scope.in[3] の『選択中の txId から』と、I3・I5 の選択の単位は、この決定により『URL の sel にある行の key から』と読む。保存の単位は、その行が指す明細の txId のまま変わらない。 / 回答時刻: 2026-09-30T13:33:10Z)

#### 裏付け質疑: `qa-classify-bulk-decision-009` — 旧版（置き換え先: `qa-classify-bulk-decision-040`）

> **旧版** — この問答は `qa-classify-bulk-decision-040` で置き換えられた (`2026-10-01T03:15:08Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-015。利用者は『対応表を作って事業にも付ける』を選んだ。

**問**

```text
『MF の分類』の提案（信頼度 60）を、事業の明細にも付けますか？（事業の明細の科目は、freee の勘定科目で、中項目は空と決まっています）
```

**答**

```text
個人の明細にだけ付ける。事業の明細は、一括指定か下書きで決める。保存前の内訳に『提案なし』とその理由を出す。
```

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T21:16:05Z` — provenance の後半『requirements_foundation の G2・O3・scope.in[5]・I4 の…』以降は、提示した選択肢 (qa-classify-bulk-presented-options-004) に無い agent の読みで、利用者が選んだのは answer の範囲だけである。この読みは、appr-foundation-classify-bulk-004 で改めた土台 (テーマ B、qa-classify-bulk-decision-016) に置き換わった。scope.in[5] は 0 から数えた添字で、範囲 in[6] に当たる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-004)。利用者はこの問で「個人の明細にだけ付ける (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T13:33:09.494Z) を秒へ切り上げた値で、選択時刻の上界である。requirements_foundation の G2・O3・scope.in[5]・I4 の『MF の分類』の提案は、この決定により、区分の解決値が個人の明細に限ると読む。事業の明細は freee の勘定科目でしか保存できず、中項目は空でなければならない (packages/core/src/categories.ts の categoryAllowed)。そのため、MF の大項目・中項目をそのまま提案すると、保存で invalid_item になる。 / 回答時刻: 2026-09-30T13:33:10Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-007`

**問**

qa-classify-bulk-decision-007〜009 を受けて、選択の読み出し・一覧・一括保存の API と core が、利用者の決めていない細部で何を約束するか。

**答**

(1) 選択の読み出し GET /api/transactions/selected?keys= は、keys を zod で検査する。1〜50 件、1 件 200 字まで、重複と形の違う key は 400 (qa-classify-bulk-security-web-003)。受ける key は一覧の行の key で、sel の値 (mf:・cash: で始まる) はそのまま受ける (qa-classify-bulk-decision-007)。分割の内訳行は一覧でクリックして開けるので、開いた明細 (URL の tx) を表示するために、split: で始まる key も受ける。split: の key は選択には使わない。応答は一覧と同じ形の rows と、見つからなかった key の missing。(2) 一覧 GET /api/transactions は、limit を zod で 25・50・100 のどれかに限り、それ以外は 400 にする。画面は URL の limit を 25・50・100 に直してから送る。応答から、ページを掛けない全件の transactions を外し、rows・total・page・limit を返す。これは、前サイクルの仕様 (specs/spec-classify-screen.md) の C5 (50 件固定、:229・:344・:607) と、:1545 の『GET /api/transactions は既存の項目の意味を変えない』を置き換える。transactions を読む API テスト 8 本 (split-lifecycle・import-diff・cash-lifecycle・vendor-memory・row-transfer-lifecycle・classify-transactions-shape・classify-list-paging・total-cashflow-verdict) は、rows か選択の読み出しを読む形へ移す。(3) 一括保存は二段で扱う。検証の段は明細ごとで、not_found・invalid_item・split_line_not_supported・no_value はその明細だけの失敗になる。書き込みの段は、検証を通った明細の全件を書くか、1 件も書かないかで、失敗したら通った明細の全件を write_failed にする (qa-classify-bulk-decision-005)。これは、前サイクルの S3 (:79)・UC-3 (:158)・FR-09 (:212) の『部分失敗でも成功分を確定する』を、書き込みの段について置き換える。(4) 値が決まらない明細は、画面が要求から外し、保存前の内訳に外す理由を出す (O1)。サーバの no_value (qa-classify-bulk-backend-web-005) は、画面を通らずに届いた要求への二重の防御である。(5) 『MF の分類』の提案は、記憶・ルール・MF 中項目の対応表のどれも候補を出さないときだけ候補に入れる。ほかの候補と並べると、先頭と違う候補があるときに信頼度を下げる衝突の判定 (classifySuggestion) が働き、O3 の『既存の由来の順位と信頼度が変わらない』に反する。区分の解決値が事業の明細には付けない (qa-classify-bulk-decision-009)。O3 の core の単体テストに『事業の明細には付かない』を足す。/review-queue の根拠文 (legacyBasisLabel) に、この由来の分岐 (『MFの分類をそのまま提案』) を足す。今は最後の分岐が『MF の中項目が「事業」』を返すので、足さないと誤った根拠文が出る。(6) 選択の上限 50 件・一覧の表示件数・D1 の 1 起動あたりのクエリの上限は、core の 1 か所に定数として置き、api と web はそこから読む。画面にある値の解決 (一括指定→下書き→提案) も core の純関数へ移し、画面とサーバで同じ関数を使う。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:11:48Z` — (5) の『legacyBasisLabel にこの由来の分岐を足す』と、(6) の『D1 の 1 起動あたりのクエリの上限を core の 1 か所に置く』は、qa-classify-bulk-backend-web-008 (6)(7) で訂正した。根拠文は候補が持つ値を使って legacyBasisLabel を消し、D1 の上限は api の 1 か所に置く。
> - `2026-10-01T00:36:07Z` — (1) の『形の違う key は 400』は、qa-classify-bulk-backend-web-009 (2) で訂正した。形の違う key は missing に入れ、要求全体を 400 にするのは件数の範囲外と key の重複だけである。
> - `2026-10-01T09:47:30Z` — (5) の『区分の解決値が事業の明細には付けない (qa-classify-bulk-decision-009)』と『O3 の core の単体テストに「事業の明細には付かない」を足す』は、qa-classify-bulk-decision-040・qa-classify-bulk-decision-050・qa-classify-bulk-decision-051・qa-classify-bulk-decision-052 で改まった。事業の明細には、勘定科目の対応表で引いた勘定科目を由来『MF の分類 (対応表)』・信頼度 60 で付ける。テストは、事業の明細には対応表で引いた勘定科目が中項目を空のまま付き、対応表に行の無い大項目の事業の明細と、MF の大項目が空か『未分類』の明細には付かないことを固定する (requirements_foundation の O3.measure)。記憶・ルール・MF 中項目の対応表のどれも候補を出さないときだけ候補に入れ、衝突の判定 (classifySuggestion) を働かせないことは、個人と事業の 2 つの由来のどちらにも当てはめ、変わらない。根拠文は、候補を作る 1 か所 (qa-classify-bulk-backend-web-009 (5)) で由来ごとに作る。(3) の『書き込みの段が失敗したら、通った明細の全件を write_failed にする』は、qa-classify-bulk-decision-057 で利用者が決めた。要求は 2xx で返し、画面は『失敗した N 件のみ再試行』を出して、押すと失敗した明細だけを送り直す。(1)(2)(4)(6) は、これまでの訂正のとおりで、037 以降の決定で変わる箇所は無い。
> - `2026-10-01T10:08:23Z` — (3) の qa-classify-bulk-decision-005 は、qa-classify-bulk-decision-033 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-033 で選定を agent に委ね、agent は qa-classify-bulk-delegated-001 で旧と同じ案を選んだ。書き込みの段の失敗の扱いは 2026-10-01T09:47:30Z の訂正のとおり (qa-classify-bulk-decision-057)。(1) の qa-classify-bulk-decision-007 は、qa-classify-bulk-decision-034 で問い直して置き換わった。利用者は qa-classify-bulk-decision-034 で選定を agent に委ね、agent は qa-classify-bulk-delegated-002 で旧と同じ案 (sel の値を行の key としてそのまま受け、分割の内訳行は選べない) を選んだ。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。範囲外の limit を 400 にすることと、再試行の出し方は、4 問を提示する前の本文 (2026-09-30T13:29:51.114Z) で、判断が分かれないので既定で進めると利用者に示した。利用者は異議を述べなかったが、選んだ値ではない。 / 回答時刻: 2026-09-30T13:43:42Z)

#### 裏付け質疑: `qa-classify-bulk-decision-010` — 旧版（置き換え先: `qa-classify-bulk-decision-035`）

> **旧版** — この問答は `qa-classify-bulk-decision-035` で置き換えられた (`2026-10-01T01:43:48Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-014。利用者は選択肢を選ばず、無料枠の範囲で最善の慣行を選ぶよう agent に委ねた。agent の選定は qa-classify-bulk-delegated-003 に記録した。

**問**

```text
一括指定で区分かカテゴリ (大) を指定し、残りの項目を指定しなかったとき、残りの項目をどう決めますか？（事業の明細は、大項目が freee の勘定科目で、中項目は空と決まっています）
```

**答**

```text
区分とカテゴリを1組で決める。カテゴリ (大) を指定したら、カテゴリ (中) も一括指定の値にする (指定が無ければ空)。区分だけを指定したときは、下書きか提案のうち区分が同じものからカテゴリを取り、無ければカテゴリを空にする。不利な点: 区分が違う下書きのカテゴリは使われない。
```

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:31:12Z` — provenance の後半『requirements_foundation の G1・G3・scope.in[1] の … は、この決定により次のように読む。』以降は、提示した選択肢 (qa-classify-bulk-presented-options-005) に無い agent の読みで、利用者が選んだのは answer の範囲だけである。この読みは qa-classify-bulk-decision-013・qa-classify-bulk-decision-014 の決定と、qa-classify-bulk-backend-web-009 (1) の agent の推定で置き換えた。answer の『無ければカテゴリを空にする』は、データに空の状態が無いため、qa-classify-bulk-decision-014 (理由を付けて外す) に置き換わる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 3 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-005)。利用者はこの問で「区分とカテゴリを1組で決める (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T14:03:48.119Z) を秒へ切り上げた値で、選択時刻の上界である。requirements_foundation の G1・G3・scope.in[1] の『指定しない項目は各行の下書き→提案の順で埋める』は、この決定により次のように読む。区分・所有者・支払い方法は項目ごとに、一括指定→下書き→提案の順で埋める (支払い方法は提案を持たないので、一括指定→下書き→現在の値)。カテゴリ (大) と (中) は常に 1 組で決め、別々の出所から取らない。何も指定しないときは、区分とカテゴリを下書き→提案の順に 1 組で取る (今の画面の resolveBulkItem と同じ)。区分だけを指定したときは、下書き→提案の順に、区分が一括指定と同じものからカテゴリの組を取る。カテゴリ (大) を指定し区分を指定しないときは、区分を各行の下書き→提案の順で埋め、区分とカテゴリが合わない明細は、サーバがその明細だけを invalid_item で返す (qa-classify-bulk-security-web-004)。 / 回答時刻: 2026-09-30T14:03:49Z)

#### 裏付け質疑: `qa-classify-bulk-decision-011` — 旧版（置き換え先: `qa-classify-bulk-decision-028`）

> **旧版** — この問答は `qa-classify-bulk-decision-028` で置き換えられた (`2026-09-30T23:55:47Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があり、確定した明細のカテゴリが後から集計ルールを変えても追従しないことを示していなかった。同じ論点を、印を外し、追従しないことをどの選択肢にも示して問い直した。提示の逐語は qa-classify-bulk-presented-options-012。

**問**

```text
集計ルール (取引先) が当たる個人の明細に『MF の分類』の提案を付けるとき、提案するカテゴリはどれにしますか？（集計ルールは取込値のカテゴリにだけ効き、一括保存で確定した値は手動の値として扱われます）
```

**答**

```text
集計ルールを当てた後の値。今の集計と同じカテゴリを提案する。確定しても集計は変わらない。根拠文は集計ルールの名前にする。集計ルールの値が個人のカテゴリの候補に無いときは提案を付けない。不利な点: 由来の表示が『MF の分類』ではなく集計ルールになる。
```

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T21:16:05Z` — provenance の後半『requirements_foundation の G2・S2・scope.in[5] の…』以降は、提示した選択肢 (qa-classify-bulk-presented-options-005) に無い agent の読みで、利用者が選んだのは answer の範囲だけである。この読みは、appr-foundation-classify-bulk-004 で改めた土台 (テーマ B、qa-classify-bulk-decision-016) に置き換わった。scope.in[5] は 0 から数えた添字で、範囲 in[6] に当たる。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 3 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-005)。利用者はこの問で「集計ルールを当てた後の値 (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T14:03:48.119Z) を秒へ切り上げた値で、選択時刻の上界である。requirements_foundation の G2・S2・scope.in[5] の『取込 CSV の大項目・中項目をそのまま使う』と根拠文『MFの分類をそのまま提案』は、集計ルール (取引先) が当たる個人の明細については、この決定により、ルールを当てた後の値 (大項目はルールの値、中項目は空。packages/core/src/classify.ts の applyClassification と同じ) と、集計ルールの名前の根拠文と読む。信頼度 60 と、由来の順位 (最後) は変えない。集計ルールの値が個人のカテゴリの候補に無いときに提案を付けないことは、qa-classify-bulk-decision-006 (MF の大項目が空か『未分類』) と並ぶ、S2 の『どの由来も無い明細に付く』の例外である。 / 回答時刻: 2026-09-30T14:03:49Z)

#### 裏付け質疑: `qa-classify-bulk-decision-012` — 旧版（置き換え先: `qa-classify-bulk-decision-038`）

> **旧版** — この問答は `qa-classify-bulk-decision-038` で置き換えられた (`2026-10-01T03:15:08Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-015。利用者は『選べなくする』を選んだ。

**問**

```text
分割の設定が不正な明細 (内訳の合計が元の金額と合わない、または明細の識別子が不安定) は、一覧に元の明細の行として出ます。この行を一括保存の選択の対象にしますか？（一括保存のサーバは、分割のある明細を split_line_not_supported で返します）
```

**答**

```text
選べなくする。内訳行と同じく、チェックを出さず、理由『分割の設定を直してから保存してください』を表示する。不利な点: 分割を直すまで、その明細は一括保存できない。
```

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T21:16:05Z` — provenance の後半『qa-classify-bulk-decision-007 の『内訳行は選べない』に…』以降 (分割の投影と key の接頭辞の説明を含む)は、提示した選択肢 (qa-classify-bulk-presented-options-005) に無い agent の読みで、利用者が選んだのは answer の範囲だけである。選べない行に分割の設定が不正な行を加えることは、appr-foundation-classify-bulk-004 で改めた土台 (テーマ C、qa-classify-bulk-decision-017) に取り込まれた。行から選べるかを決める実装の説明は、agent の推定として扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 3 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-005)。利用者はこの問で「選べなくする (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T14:03:48.119Z) を秒へ切り上げた値で、選択時刻の上界である。qa-classify-bulk-decision-007 の『内訳行は選べない』に、分割の設定が不正な明細の行を加える。この行は、packages/core/src/splits.ts が分割の投影 (splitProjection) をstate=amount_conflict か identity_unstable で付けた、元の明細の行で、key は mf: で始まる。そのため、選べるかどうかは key の接頭辞では決まらず、行から決める。選べる行は、行の種別が mf か cash で、分割の投影を持たない行である。 / 回答時刻: 2026-09-30T14:03:49Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-008`

**問**

qa-classify-bulk-decision-010〜012 と反復 2 回目の検証を受けて、選択の読み出し・一括保存・core が、利用者の決めていない細部で何を約束するか (qa-classify-bulk-backend-web-007 の補足と訂正)。

**答**

(1) 選択の読み出しの母集団は、利用者自身の全明細である。期間・絞り込み・ページ・並べ替えを掛けない。一括保存がサーバで明細を引き直す母集団 (packages/api/src/routes/classify-bulk.ts) と同じにし、選択 (G3) が表示に左右されないようにする。(2) 他の利用者の明細の key と、削除・分割・取込の取り消しで消えた明細の key は、応答の missing に入れ、rows に出さない。missing は、選択の読み出しにおける『見つからない』(not_found) の形であり、qa-classify-bulk-auth-web-001 と qa-classify-bulk-security-web-004 の『他の利用者の明細は存在を明かさず not_found で返す』を満たす。存在しない key と他の利用者の key は、同じ形で返す。(3) qa-classify-bulk-security-web-004 の『要求全体を 400 にするのは 3 つだけ』は、選択の読み出しについては、件数の範囲外 (1〜50 件)・key の重複・key の形の範囲外 (mf:・cash:・split: のどれかで始まり、1 件 200 字まで。qa-classify-bulk-backend-web-007 (1)) と読む。key の形の範囲外は、一括保存の『一括指定の値の範囲外』と同じく、要求全体に当たる入力の範囲外である。(4) 一括保存の値の解決は、qa-classify-bulk-decision-010 のとおり区分とカテゴリを 1 組で決める。一括指定のカテゴリ (中) は、カテゴリ (大) を伴うときだけ受け、(中) だけの一括指定は一括指定の値の範囲外として 400 にする (packages/core/src/categories.ts の categoryAllowed は、大項目が空なら中項目も空であることを求める)。(5) 書き込みの前に決まる失敗 (1 回の batch のクエリが D1 の上限を超える、束ねた JSON が 2MB を超える) は、送り直しても結果が変わらない。今は、この例外も write_failed に丸められ、画面が再試行を出す (packages/api/src/routes/classify-bulk.ts の classify_bulk_query_budget と、aggregateReplacementQueries の事前検査)。これを明細ごとの write_failed ではなく、明細ごとの結果を持たない要求全体の失敗として返す。write_failed は、D1 への書き込みそのものが失敗したときだけに使う。(6) qa-classify-bulk-backend-web-007 (6) の『D1 の 1 起動あたりのクエリの上限を core の 1 か所に置く』を訂正する。D1 の上限は Workers と D1 の実行環境の制約で、環境に依存しない純関数を置く core の関心ではない。api の 1 か所に置き、今 api に別の名前で 4 か所ある同じ値 50 の定数 (import-lifecycle.ts の D1_FREE_QUERY_LIMIT、scheduled-maintenance-budget.ts の SCHEDULED_D1_QUERY_LIMIT、routes/classify.ts の CLASSIFY_BATCH_STATEMENTS、routes/classify-bulk.ts の MAX_BATCH_STATEMENTS) をそこへまとめる。core の 1 か所に置くのは、選択の上限 50 件、表示件数 25・50・100 と既定値 50、行の key の作成と解析、選べる行の判定 (qa-classify-bulk-decision-012)、値の解決関数 (qa-classify-bulk-decision-010) である。key の解析は、最初の ':' の後ろを txId とする (現金の明細の id は cash: で始まるので、key は cash:cash: の形になり、':' で分けると壊れる)。値の解決関数は、画面の resolveBulkItem と inputFromRow の提案の分岐 (packages/web/src/pages/classify/view-model.ts) を 1 つにまとめたもので、画面とサーバで同じ関数を使う。(7) qa-classify-bulk-backend-web-007 (5) の『legacyBasisLabel にこの由来の分岐を足す』を訂正する。分岐を足すと、提案の根拠文を決める場所が、core の候補の算出と /review-queue の 2 か所に残る。/review-queue は候補が持つ根拠文をそのまま使い、legacyBasisLabel は消す。由来の型は、同じ値の集合で core に 2 つある (classify-status.ts の SuggestionBasis と overview.ts の RecommendationBasis) ので、RecommendationBasis を SuggestionBasis の別名にして 1 つにする。(8) 『MF の分類』の提案は、分割の内訳行には付けない。内訳行のカテゴリは分割で決めた値で、取込 CSV の値は元の明細のものだからである。集計ルールが当たる個人の明細には、ルールを当てた後の値を提案する (qa-classify-bulk-decision-011)。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:31:12Z` — (3) の key の形の範囲外を 400 にする読み、(5) の要求全体の失敗の形、(6) の key の解析と D1 の上限の名前、(7) の『legacyBasisLabel を消し、候補が持つ根拠文をそのまま使う』は、qa-classify-bulk-backend-web-009 (2)〜(5) で訂正・補足した。/review-queue の短い根拠文 basisLabel は残す。
> - `2026-10-01T00:36:07Z` — (5) の要求全体の失敗は、qa-classify-bulk-backend-web-010 (3) で 2 種類の 413 にした。本文の大きさは payload_too_large、書き込みの予算は too_many_classify_changes で、どちらも明細ごとの結果を持たない。
> - `2026-10-01T10:08:23Z` — (4)(6) の qa-classify-bulk-decision-010 は、qa-classify-bulk-decision-035 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-035 で選定を agent に委ね、agent は qa-classify-bulk-delegated-003 で区分とカテゴリを 1 組で決める案を選んだ。区分だけを指定し、区分に合う組が下書き・提案・今の値のどこにも無い明細は『カテゴリなし』で保存する (qa-classify-bulk-decision-048)。(6) の qa-classify-bulk-decision-012 は、qa-classify-bulk-decision-038 で問い直して置き換わり、利用者は旧と同じ案 (分割の設定が不正な明細の行は選べない) を選んだ。(8) の qa-classify-bulk-decision-011 は、qa-classify-bulk-decision-028 で問い直して置き換わり、利用者は旧と同じ案 (ルールを当てた後の値を提案する) を選んだ。qa-classify-bulk-decision-028 は、不利な点『確定した明細は、後から集計ルールを変えても追従しない』を示したうえで選ばれた。(6) の表示件数 25・50・100 は要件の土台の G4 にある (qa-classify-bulk-decision-074 で文面を承認)。既定値 50 は土台にも決定にも無い agent の案で、利用者は未確認である (qa-classify-bulk-ui-ux-web-003 の訂正と同じ)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。(1) と、(6) の D1 の上限の置き場所は、3 問を提示する前の本文 (2026-09-30T14:02:16.917Z) で『自分で決められる不足 (既定で記録します)』として示した。(2) は、同じ本文で画面の側 (保存前の内訳に出し、sel から外す) を示し、サーバの側をここで補った。(5) は、4 問を提示する前の本文 (2026-09-30T13:29:51.114Z) で示した『再試行は write_failed と通信の失敗にだけ出す』を、サーバの側から成り立たせるものである。(3)(4)、(6) の core に置くもの、(7)(8) は、どちらの本文にも示していない agent の推定である。利用者は異議を述べなかったが、選んだ値ではない。 / 回答時刻: 2026-09-30T14:11:48Z)

#### 裏付け質疑: `qa-classify-bulk-prior-cycle-001`

**問**

前サイクルの仕様 (specs/spec-classify-screen.md) のうち、今回のサイクルの決定と食い違い、まだ置き換えを宣言していない規定はどれで、何に置き換わるか。

**答**

qa-classify-bulk-backend-web-007 (2)(3) が置き換えを宣言した C5 (:229・:344・:607)・:1545・S3 (:79)・UC-3 (:158)・FR-09 (:212) のほかに、次の規定を置き換える。(1) 一括保存で送る値の『提案が無く、下書きも無い明細は、送らずに「提案が無いため保存できません」として失敗に数える』(:410) と、失敗の code の no_suggestion (:820) は、G1・S1 の『外した行は失敗に数えない』と O1 に置き換わる。値の決まらない明細は保存前の内訳に外す件数と理由を出し、サーバの code は no_value とする (qa-classify-bulk-backend-web-005)。(2) 『成功分は、後続の明細が失敗しても取り消さない』(:830) と、回復の原則の『成功分は取り消さない。失敗分だけをやり直せるようにする』(:1508) は、書き込みの段について qa-classify-bulk-decision-005 に置き換わる。検証の段の失敗は明細ごとのまま、書き込みの段は全件か無しである。:1508 の『利用者の入力は、保存に成功するまで端末から消さない』は変えない。(3) FR-10 の『失敗分だけを再試行できる』(:213)、部分失敗の通知の『失敗した{K}件のみ再試行』(:388)、AT-08 の『3 件中 1 件が失敗すると … 再試行の要求は失敗の 1 件だけを含む』(:1592) は、再試行を write_failed と通信の失敗に絞ること (qa-classify-bulk-frontend-web-002 (5)・qa-classify-bulk-frontend-web-003 (6)) に置き換わる。書き込みの段は全件か無しなので、3 件中 1 件だけが write_failed で 2 件が保存済み、という結果は起きない。AT-08 は『検証で 1 件が invalid_item になると 2 件を保存し、その 1 件には理由と直し方を出し、再試行は出さない』と、『書き込みが失敗すると 3 件とも write_failed になり、再試行は 3 件を送る』の 2 つに分ける。:388 の通知の文面は、再試行のボタンを出すときだけ使う。(4) FR-05 (:208) と AT-04 (:1588) の列と表示件数は、G4 に置き換わる。FR-05 の 6 列は選択のチェックを数えず、取引先と内容を別の列にする (今の実装の TransactionTable.tsx はこのとおり)。G4 の 6 列は選択を数え、取引先と内容を 2 段の 1 列にまとめる。FR-05 と AT-04 の『表示件数 50 件』と FR-05 の『サーバから 50 件ずつ受け取る』は、G4 の表示件数の選択 (25・50・100 件) に置き換わる。AT-04 の『51 件目は 2 ページ目に出る』は、表示件数 50 のときの確認として残す。(5) 本 qa は、前サイクルの規定を今回の決定へ対応づける agent の読みで、新しい振る舞いを決めるものではない。置き換えの根拠は、括弧内に挙げた今回の qa と requirements_foundation である。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:31:12Z` — (3) の『再試行を write_failed と通信の失敗に絞ること』は、qa-classify-bulk-frontend-web-004 (1)(6) により『write_failed に絞ること』に訂正した。
> - `2026-10-01T00:36:07Z` — (3) の置き換え先は、qa-classify-bulk-frontend-web-005 により、write_failed の明細への再試行と、通信の失敗・5xx・409 の後の『同じ内容で再試行』(直前の本文をそのまま送る) である。
> - `2026-10-01T10:08:23Z` — (2) の qa-classify-bulk-decision-005 は、qa-classify-bulk-decision-033 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-033 で選定を agent に委ね、agent は qa-classify-bulk-delegated-001 で旧と同じ案 (書き込みを 1 回の batch に束ねる) を選んだ。書き込みの段が全件か無しであることは変わらない。batch が失敗したときに要求を 2xx で返し、保存対象の全件を write_failed にすることは qa-classify-bulk-decision-057 で利用者が決めた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が specs/spec-classify-screen.md の各行を読み、今回の決定と食い違う規定を挙げた。行番号は 2026-09-30T14:11:48Z 時点の実物で確かめた。3 問を提示する前の本文 (2026-09-30T14:02:16.917Z) で『置き換えを宣言していない前サイクルの規定が約 10 か所あります』と既定として示した。利用者は異議を述べなかったが、選んだ値ではない。 / 回答時刻: 2026-09-30T14:11:48Z)

#### 裏付け質疑: `qa-classify-bulk-decision-013` — 旧版（置き換え先: `qa-classify-bulk-decision-036`）

> **旧版** — この問答は `qa-classify-bulk-decision-036` で置き換えられた (`2026-10-01T01:43:48Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-014。利用者は選択肢を選ばず、無料枠の範囲で最善の慣行を選ぶよう agent に委ねた。agent の選定は qa-classify-bulk-delegated-004 に記録した。

**問**

```text
一括保存で確定済みの明細を選んだとき、一括指定で指定しなかった項目（区分・カテゴリ・所有者）は、どの値で保存しますか？
```

**答**

```text
今の値を保つ。下書きがあれば下書き、無ければ今の値のまま保存する。提案は未整理の明細にだけ使う。手で決めた値は提案に置き換わらない。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 2 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-006)。利用者はこの問で「今の値を保つ (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T14:28:31.486Z) を秒へ切り上げた値で、選択時刻の上界である。この決定から導く値の解決の順は、agent の推定として qa-classify-bulk-backend-web-009 (1) に分けて記録した。 / 回答時刻: 2026-09-30T14:28:32Z)

#### 裏付け質疑: `qa-classify-bulk-decision-014` — 旧版（置き換え先: `qa-classify-bulk-decision-037`）

> **旧版** — この問答は `qa-classify-bulk-decision-037` で置き換えられた (`2026-10-01T03:15:08Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-015。利用者は『カテゴリなしを新設する』を選んだ。

**問**

```text
一括指定で区分を指定し、その区分に合うカテゴリの組が、保存に使える値（下書き・提案・今の値）のどこにも無い明細は、どう扱いますか？
```

**答**

```text
理由を付けて外す。保存前の内訳に『区分に合うカテゴリがありません』と出して保存しない。失敗には数えない。一括指定の欄でカテゴリを指定すれば保存できる。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 2 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-006)。利用者はこの問で「理由を付けて外す (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T14:28:31.486Z) を秒へ切り上げた値で、選択時刻の上界である。この決定から導く値の解決の順は、agent の推定として qa-classify-bulk-backend-web-009 (1) に分けて記録した。 / 回答時刻: 2026-09-30T14:28:32Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-009`

**問**

qa-classify-bulk-decision-013・qa-classify-bulk-decision-014 と反復 3 回目の検証を受けて、一括保存の値の解決・選択の読み出し・core が、利用者の決めていない細部で何を約束するか (qa-classify-bulk-backend-web-008 の補足と訂正)。

**答**

(1) 値の解決の順。未整理 (status が unsorted) の明細は、区分・カテゴリの組・所有者を項目ごとに、一括指定→下書き→提案の順で埋める。確定済みの明細は、一括指定→下書き→今の値の順で埋め、提案を使わない。支払い方法は状態によらず、一括指定→下書き→今の値の順で埋める。支払い方法の今の値は保存済みの手動の値 (row.edit.paymentMethod) で、無ければ送らない (導出した値を送ると、変わっていないのに履歴が増える)。カテゴリの組は、区分が決まったら、上の順のうち区分の系統に合う最初の組を取る。合う組がどこにも無い明細は、保存前に理由『区分に合うカテゴリがありません』を付けて外し、失敗に数えない (qa-classify-bulk-decision-014)。サーバは qa-classify-bulk-security-web-004 のとおり、その明細を invalid_item で返して二重に防ぐ。カテゴリ (大) を指定し区分を指定しないときも、各明細の区分と合わない明細は同じ理由で外す。区分とカテゴリ (大) を両方指定して系統が合わないときは、選択した全件に当たる値なので、一括指定の値の範囲外として要求全体を 400 にする。確定済みの明細で一括指定も下書きも無いものは、変わる値が無いので、理由『変わる値がありません』を付けて外す。未整理の明細で指定も下書きも提案も無いものは、今までどおり O1 で外す。値の解決関数は、画面の inputFromRow の分岐 (未整理で提案があるときだけ提案を使う) に揃え、resolveBulkItem の『状態を見ずに提案を使う』はやめる (packages/web/src/pages/classify/view-model.ts)。qa-classify-bulk-decision-010 の answer の『無ければカテゴリを空にする』は、データに空の状態が無い (packages/api/src/tx-edit-codec.ts の patch.big || null と、packages/core/src/classify.ts の editedCat) ので、qa-classify-bulk-decision-014 に置き換わる。(2) qa-classify-bulk-backend-web-008 (3) を訂正する。選択の読み出しで要求全体を 400 にするのは、qa-classify-bulk-security-web-004 のうち当てはまる件数の範囲外 (1〜50 件) と key の重複だけとする。key の形の範囲外 (mf:・cash:・split: のどれでも始まらない、または 200 字を超える) は、存在しない key と同じく missing に入れる。(3) qa-classify-bulk-backend-web-008 (5) の要求全体の失敗は、HTTP 413 と code bulk_too_large で返し、明細ごとの結果を持たない。サーバの 5xx と、応答が得られない通信の失敗は、書き込まれたかどうかが分からない失敗として画面が扱う (qa-classify-bulk-frontend-web-004 (1))。(4) qa-classify-bulk-backend-web-008 (6) を補う。D1 の上限は api の 1 か所に置くが、1 回の起動のクエリの合計 (50 未満) と、1 回の batch の文の数 (50 以下) は意味と境界が違うので、2 つの名前で持つ。key の解析は、最初の ':' の前を行の種類、後ろを id とする。id は、mf と cash では txId、split では内訳の lineId である。(5) qa-classify-bulk-backend-web-008 (7) を訂正する。/review-queue の短い根拠文 basisLabel (『過去 10 件中 9 件』の形) は残す。specs/spec-overview-screen.md の FR-005、specs/spec-classify-screen.md の『既存の basisLabel は /review-queue との互換のために残す』、packages/core/test/overview-recommendation-contract.test.ts がこれを求める。候補に短い根拠文も持たせ、長い根拠文 basisText と同じく候補を作る 1 か所で作る。legacyBasisLabel は、その 1 か所へ移して消す。RecommendationBasis を SuggestionBasis の別名にすることは変えない。(6) qa-classify-bulk-decision-011 を成り立たせるため、提案 (classifySuggestion) と行の解決 (resolveTx) に集計ルール (normRules) を渡す。今は渡しておらず、提案の呼び出しは 6 か所 (api の classify-row.ts に 2 か所、routes/classify.ts、routes/classify-bulk.ts、core の overview.ts に 2 か所) ある。1 か所でも漏れると、一覧・一括保存・/review-queue で提案が食い違うので、提案の入力 (ルール・取引先の記憶・集計ルール) を 1 つの値にまとめて渡す。(7) qa-classify-bulk-decision-011 の不利な点を記録する。集計ルールの値の提案で保存した明細は、カテゴリの出所が手動になり、後から集計ルールを変えても追従しない。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-10-01T00:36:07Z` — (3) の『HTTP 413 と code bulk_too_large』は、qa-classify-bulk-backend-web-010 (3) で訂正した。bulk_too_large は導入せず、既存の payload_too_large と too_many_classify_changes を使う。通信の失敗と 5xx の画面の扱いは qa-classify-bulk-frontend-web-005 (1) で訂正した。
> - `2026-10-01T09:47:30Z` — (1) の『合う組がどこにも無い明細は、保存前に理由「区分に合うカテゴリがありません」を付けて外し、失敗に数えない』と『サーバはその明細を invalid_item で返して二重に防ぐ』は、qa-classify-bulk-decision-037・qa-classify-bulk-decision-045・qa-classify-bulk-decision-048 で改まった。区分だけを指定し、区分に合うカテゴリの組が埋める値 (下書き・提案・今の値) のどこにも無い明細は、カテゴリの組を『カテゴリなし』の予約の値にして保存の対象に入れ、保存前の内訳に『カテゴリなし』で保存する件数を出す。サーバも同じ core の解決関数で同じ値にするので、invalid_item で外さない。『カテゴリなし』の予約の値を一括指定の値として送る要求は、一括指定の値の範囲外として要求全体を 400 にする (requirements_foundation の G5)。『qa-classify-bulk-decision-010 の「無ければカテゴリを空にする」は、データに空の状態が無いので qa-classify-bulk-decision-014 に置き換わる』は、予約の値で空の状態をデータに持てるようになったので、qa-classify-bulk-decision-037・qa-classify-bulk-decision-048 に置き換わる。カテゴリ (大) だけを指定し区分を指定しないときに、明細の区分と系統が合わない明細を外す扱いは、qa-classify-bulk-decision-048 の場面 (区分だけを指定) に当たらないので変えない。外す理由の文言は『指定したカテゴリ (大) が明細の区分に合いません』とする。区分とカテゴリ (大) を両方指定して系統が合わないときの 400 も変えない。(6) の『提案の入力 (ルール・取引先の記憶・集計ルール) を 1 つの値にまとめて渡す』には、qa-classify-bulk-decision-049 の勘定科目の対応表も入れる。入れないと、事業の明細の提案が一覧・一括保存・/review-queue で食い違う。カテゴリ (大) だけを指定したときの扱いとその文言、提案の入力に勘定科目の対応表を入れることは agent の読みで、利用者は未確認である。(3) は 2026-10-01T00:36:07Z の訂正のとおりで、要求全体の失敗の扱いは qa-classify-bulk-decision-054・qa-classify-bulk-decision-055・qa-classify-bulk-decision-056・qa-classify-bulk-decision-057 で利用者が決めた。(2)(4)(5)(7) は変わらない。
> - `2026-10-01T10:08:23Z` — (1) の qa-classify-bulk-decision-010 は、qa-classify-bulk-decision-035 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-035 で選定を agent に委ね、agent は qa-classify-bulk-delegated-003 で区分とカテゴリを 1 組で決める案を選んだ。組が無いときの扱いは 2026-10-01T09:47:30Z の訂正のとおり (qa-classify-bulk-decision-048)。(6)(7) の qa-classify-bulk-decision-011 は、qa-classify-bulk-decision-028 で問い直して置き換わり、利用者は旧と同じ案 (ルールを当てた後の値を提案する) を選んだ。(7) の不利な点 (確定した明細は、後から集計ルールを変えても追従しない) は、qa-classify-bulk-decision-028 の選択肢に示したうえで選ばれた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。(1) は qa-classify-bulk-decision-013・qa-classify-bulk-decision-014 から導いた読みで、qa-classify-bulk-decision-010 の provenance に混ざっていた読み (提示した選択肢に無いもの) を置き換える。(2)(3)(5)(6)(7) は、問を提示する前の本文 (2026-09-30T14:27:03.589Z) で『私の判断で直せるもの』として示した。利用者は異議を述べなかったが、選んだ値ではない。(4) は、どの本文にも示していない agent の推定である。 / 回答時刻: 2026-09-30T14:31:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-016` — 旧版（置き換え先: `qa-classify-bulk-decision-070`）

> **旧版** — この問答は `qa-classify-bulk-decision-070` で置き換えられた (`2026-10-01T09:14:01Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は、『承認しない』にだけ結果を書き、利点と不利な点の対が無く、選択肢の書き方が片寄っていた (N2 の違反)。また、承認の後の決定で土台の文面が変わり、今の全文を逐語で示した承認が無かった (軸 5)。今の全文を preview に置き、各選択肢に利点と不利な点を書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-024。利用者は『承認する』を選んだ。

**問**

```text
テーマ B（『MF の分類』の提案）: G2・O3.text・O3.measure・S2・I4・範囲 in[6] を、preview の「新」の文面に改めることを承認しますか？
```

**答**

```text
承認する。6 項目を preview の「新」の文面に改めます。改めた後の文面は requirements_foundation の該当項目にある。承認した文面の要点: 『MF の分類』の提案は個人の明細にだけ付け、集計ルールが当たる明細では、ルールを当てた後の値と集計ルールの名前の根拠文にする。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-007)。利用者はこの問で「承認する」を選択。answered_at は回答受領時刻 (2026-09-30T15:07:35.741Z) を秒へ切り上げた値で、選択時刻の上界である。backend と security の web セルの reopen (2026-09-30T15:04:11Z) より後の回答である。 / 回答時刻: 2026-09-30T15:07:36Z)

#### 裏付け質疑: `qa-classify-bulk-decision-017` — 旧版（置き換え先: `qa-classify-bulk-decision-072`）

> **旧版** — この問答は `qa-classify-bulk-decision-072` で置き換えられた (`2026-10-01T09:29:15Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は、『承認しない』にだけ結果を書き、利点と不利な点の対が無く、選択肢の書き方が片寄っていた (N2 の違反)。また、承認の後の決定で土台の文面が変わり、今の全文を逐語で示した承認が無かった (軸 5)。今の全文を preview に置き、各選択肢に利点と不利な点を書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-025。利用者は『承認する』を選んだ。

**問**

```text
テーマ C（選択の単位と選べる行）: G3・G5・O4.measure・O6.measure・S3・I3・I5・範囲 in[4]・in[5]・out[5] を、preview の「新」の文面に改めることを承認しますか？
```

**答**

```text
承認する。10 項目を preview の「新」の文面に改めます。改めた後の文面は requirements_foundation の該当項目にある。承認した文面の要点: 選択は sel に行の key で持ち、内訳行と分割の設定が不正な行は選べず、見出しの全選択は 50 件で止める。他の利用者の行の key と txId は存在を明かさず『見つからない』とし、選択の key と一括の txId の重複は 400 にする。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-007)。利用者はこの問で「承認する」を選択。answered_at は回答受領時刻 (2026-09-30T15:07:35.741Z) を秒へ切り上げた値で、選択時刻の上界である。backend と security の web セルの reopen (2026-09-30T15:04:11Z) より後の回答である。 / 回答時刻: 2026-09-30T15:07:36Z)

#### 裏付け質疑: `qa-classify-bulk-decision-018`

**問**

再試行のボタンは、どの失敗を返した明細に出しますか？

**答**

書き込みの失敗だけ。write_failed を返した明細にだけ出し、見つからない・値が不正・分割がある明細には理由を出します。利点: 押しても結果が変わらない失敗に、押す意味の無いボタンを出さずに済みます。不利な点: 失敗の種類ごとに扱いが分かれるので、画面とテストの分岐が増えます。G1 の末尾・O2・S1・I7・範囲 in[7] を preview の「新」に改めます。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問を 1 回で提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-007)。利用者はこの問で「書き込みの失敗だけ」を選択。answered_at は回答受領時刻 (2026-09-30T15:07:35.741Z) を秒へ切り上げた値で、選択時刻の上界である。backend と security の web セルの reopen (2026-09-30T15:04:11Z) より後の回答である。 / 回答時刻: 2026-09-30T15:07:36Z)

#### 裏付け質疑: `qa-classify-bulk-decision-028`

**問**

集計ルール (取引先) が当たる個人の明細に『MF の分類』の提案を付けるとき、提案するカテゴリをどれにしますか。以前の問では選択肢に推奨の印が付いており、次の点を示していなかったので、印を外して問い直します。集計ルールは取込値のカテゴリにだけ効きます。一括保存で確定した値は手動の値になるので、どの案でも、確定した明細のカテゴリは、後から集計ルールを変えても変わりません (追従しません)。

**答**

ルールを当てた後の値。今の集計と同じカテゴリを提案する。根拠文は集計ルールの名前にする。ルールの値が個人のカテゴリの候補に無いときは提案を付けない。利点: 確定しても、その時点の集計は変わらない。不利な点: 由来の表示が『MF の分類』ではなく集計ルールになる。確定した明細は、後から集計ルールを変えても追従しない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「集計ルール」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-012)。利用者はこの問で「ルールを当てた後の値」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-09-30T23:55:46.446Z) を秒へ切り上げた値で、選択時刻の上界である。qa-classify-bulk-decision-011 と同じ論点を問い直したもの。 / 回答時刻: 2026-09-30T23:55:47Z)

#### 裏付け質疑: `qa-classify-bulk-backend-web-010`

**問**

qa-classify-bulk-decision-026・qa-classify-bulk-decision-027 で委ねられた、一括保存 (POST /api/transactions/bulk) の要求全体の失敗を、サーバはどの状態コードと code で返し、同じ要求の送り直しをどう安全にするか。

**答**

(1) 冪等性。一括保存は、同じ本文をもう一度送っても、最終の状態が 1 回目と同じになるようにする。明細ごとの値は画面が解決して本文で送り、サーバはその値を今の編集に重ねる (applyManualEditWithBase)。同じ値を重ね直しても結果は変わらないので、1 回目が書けていれば、2 回目は更新時刻 (updatedAt) を除いて同じ値になる。提案との一致 (done か manual か) も、提案の入力である取引先の記憶を一括保存では更新しないので変わらない。履歴 (classify-history.ts) は表示値の差分だけを書くので、2 回目は 0 行になる。POST はメソッドとしては冪等でないので (RFC 9110 §9.2.2)、画面は自動で送り直さず、利用者の操作でだけ送り直す。受入テスト: 同じ要求を 2 回送り、2 回とも全件が ok で saved と各明細の status が同じ、明細の値 (更新時刻を除く) と月次集計が同じ、履歴の行数が増えないことを確かめる。(2) 400 invalid_body は、qa-classify-bulk-security-web-004 のとおり、件数の範囲外 (1〜100 件)・txId の重複・一括指定の値の範囲外の 3 つだけにする。形の違う key は、qa-classify-bulk-backend-web-009 (2) のとおり、要求全体ではなく missing にする。(3) 413 は 2 種類にする。(a) 本文の大きさ: POST /api/transactions/bulk に Hono の bodyLimit 256KB を付け、超えたら payload_too_large『リクエストが大きすぎます』を返す (tradeoff.ts・balances.ts と同じ code と文言)。256KB は、100 件 × (カテゴリ大・中の 60 字ずつとメモ 200 字を UTF-8 の 3 バイトで数えた約 1KB ＋ txId ＋ JSON の記号) に余裕を持たせた値である。(b) 書き込みの予算: 書き込む前に、1 回の batch の文の数 (50 まで) と、月次集計を束ねた JSON (2MB まで) を検査し、超えたら too_many_classify_changes『変更量が多すぎるため、対象を絞ってください』を返す。単体編集 (routes/classify.ts の planClassifyMutation) と同じ検査で、同じ関数を使う。どちらも明細ごとの結果を持たない。txId には個別の長さの上限を付けない (bodyLimit と件数の上限で抑える)。選択の読み出し (GET) は本文が無いので bodyLimit を付けない。JSON の 2MB は月次集計の全行で決まるので、選択を減らしても下がらない場合がある。これは単体編集にもある既存の制約で、本サイクルでは変えない。(4) write_failed は、D1 の batch そのものが失敗したときだけに使う。qa-classify-bulk-decision-005 により batch は全件か無しなので、そのときは全件を write_failed にする。書き込みの前に決まる失敗を write_failed に丸めることはやめる (今の classify_bulk_query_budget)。(5) そのほかの応答はすべて既存の柵と同じにする。401 は authGuard、403 password_change_required は一時パスワードの柵、409 canonical_write_busy は取込みや別の更新が進行中のとき、503 schema_unavailable は復旧作業中のときで、いずれも書き込みの前に返る。想定外の例外は onError の 500 internal で、batch の後に起きると書き込まれたかどうかが分からない。 これは agent の推定で、利用者は未確認である。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-10-01T00:45:40Z` — (1) の『明細ごとの値は画面が解決して本文で送り、サーバはその値を今の編集に重ねる』は今の実装の説明で、要件の土台の I2 と食い違う。I2 では、本文は一括指定と各明細の下書きで、サーバが明細を引き直し、core の解決関数で値を決めてから今の編集に重ねる (applyManualEditWithBase)。冪等性はこの形でも成り立つ。1 回目で書けた明細は 2 回目には確定済みになり、一括指定→下書き→今の値の順で解決される。一括指定と下書きは同じ本文なので同じ値になり、1 回目に提案から埋めた項目は今の値として同じ値になる。確定済みで変わる値が無い明細も、サーバは今の値で解決して ok を返し、履歴を書かない。一括保存は取引先の記憶を書かない (packages/api/src/routes/classify-bulk.ts は saveEditQueries に disagreeOriginKey を渡さない) ので、2 回目の提案と提案との一致 (done か manual か) も 1 回目と同じである。
> - `2026-10-01T00:55:20Z` — 利用者は qa-classify-bulk-decision-031 で、この記録 (2026-10-01T00:45:40Z の訂正を含む) のとおりに一括保存の失敗の扱いの細部を決めることを承認した (選択肢『承認する』、自由記述なし)。本記録の内容は利用者が承認した決定として扱う。answer の末尾の『これは agent の推定で、利用者は未確認である。』と basis の agent-inference は、承認の前の時点の記述である。
> - `2026-10-01T09:47:30Z` — 承認の qa-classify-bulk-decision-031 は、論点ごとに問い直して qa-classify-bulk-decision-054 に置き換わった (superseded_by)。各項の今の根拠は次のとおりで、内容はどの項も変わらない。(1) 同じ要求の送り直しで最終の状態が変わらないことは、2026-10-01T00:45:40Z の訂正の形 (I2) で要件の土台の文面にあり (qa-classify-bulk-decision-070 で全文を承認)、画面の『同じ内容で送り直しても二重には保存されません』(qa-classify-bulk-decision-054) の前提になる。(2) の 400 invalid_body を 3 つに限ることと形の違う key を missing にすること、(3) の 413 の 2 種類の code と文言、書き込みの予算の検査に単体編集と同じ関数を使うこと、txId に個別の長さの上限を付けないこと、選択の読み出し (GET) に本文の上限を付けないこと、月次集計を束ねた JSON の 2MB の既存の制約、(5) の既存の柵は、qa-classify-bulk-decision-058 で agent の案で決めることを利用者が承認した (提示の逐語は qa-classify-bulk-presented-options-020)。(3) の本文の上限 256KB は qa-classify-bulk-decision-030 で利用者が承認した。(4) の D1 の batch が失敗したときの扱い (要求は 2xx で、保存対象の全件を write_failed) は qa-classify-bulk-decision-057 で利用者が決めた。(2) の『一括指定の値の範囲外』には、『カテゴリなし』の予約の値を一括指定の値として送る要求が入る (qa-classify-bulk-decision-048、requirements_foundation の G5)。
> - `2026-10-01T10:08:23Z` — (4) の qa-classify-bulk-decision-005 は、qa-classify-bulk-decision-033 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-033 で選定を agent に委ね、agent は qa-classify-bulk-delegated-001 で旧と同じ案 (書き込みを 1 回の batch に束ねる) を選んだ。batch が全件か無しであることは変わらず、そのときの扱いは qa-classify-bulk-decision-057 で利用者が決めた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: qa-classify-bulk-decision-026・qa-classify-bulk-decision-027 で利用者が『ベストプラクティスな方法を選んだ上で選択して進めてください』と委ねたのを受け、agent が packages/api/src (routes/classify-bulk.ts・routes/classify.ts・index.ts・canonical-mutation-fence.ts・schema-guard.ts・routes/tradeoff.ts・routes/balances.ts) と、RFC 9110・Hono bodyLimit・Cloudflare D1 の上限の公式文書を読んで選んだ推定。要件の土台 U1〜U9 を改めて提示する問で利用者に確かめる。 / 回答時刻: 2026-10-01T00:36:07Z)

#### 裏付け質疑: `qa-classify-bulk-decision-029`

**問**

一括保存の要求全体が失敗したときの扱いを、要件の土台 U1〜U9 に入れる改訂案 (テーマ E) を承認しますか。改める項目は U2 背景・G1・O2.text・O2.measure・O8.measure・O9 (新設)・S1・I2・I7・範囲 in[3]・範囲 in[7] の 11 か所で、旧と新の逐語は『承認する』の preview にあります。中身: 要求全体が失敗しても選択を残す。通信の失敗と 5xx は書き込まれたかどうかが分からないので一覧を読み直す。通信の失敗・5xx・409 の後に『同じ内容で再試行』を出し、押すと直前の本文をそのまま送る (自動では送らない)。400・403・413 は送り直しても結果が変わらないので、再試行を出さずにサーバの理由を出す。サーバは同じ要求を送り直しても値・月次集計・履歴が変わらないようにし、書き込む前に予算 (batch の文 50 本・束ねた JSON 2MB) を超えると分かった要求は write_failed にせず 413 で返す。今の画面はどの失敗も『通信できませんでした。同じ内容で再試行できます。』にまとめて再試行を出し、今のサーバは予算の超過を write_failed に丸めています。この中身は、5xx と 400・413 の扱いを問うた以前の 2 問で、利用者が選択肢を選ばずに agent へ委ねた回答を受けて、agent が選んだものです。

**答**

承認する。preview の 11 か所を新の文面に改め、要件の土台の承認を更新する。利点: 通信の失敗や 5xx の後も同じ内容で送り直せ、送り直しても結果が変わらない失敗には再試行が出なくなる。不利な点: サーバに冪等の受入テストと 413 の分岐が、画面に失敗の種類ごとの分岐が増え、実装とテストの量が増える。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「要求の失敗」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-013)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T00:52:37.098Z) を秒へ切り上げた値で、選択時刻の上界である。qa-classify-bulk-decision-026 と qa-classify-bulk-decision-027 で利用者が agent に委ねた中身を確かめる問である。改めた後の文面は requirements_foundation の該当項目にある。 / 回答時刻: 2026-10-01T00:52:38Z)

#### 裏付け質疑: `qa-classify-bulk-decision-030`

**問**

一括保存 (POST /api/transactions/bulk) の本文の大きさに上限 256KB を設け、超えたら 413 payload_too_large『リクエストが大きすぎます』を返す改訂案 (テーマ F) を承認しますか。改める項目は G5・O6.measure・S5 の 3 か所で、旧と新の逐語は『承認する』の preview にあります。256KB は、100 件 × 約 1KB (カテゴリ大・中の 60 字ずつとメモ 200 字を UTF-8 の 3 バイトで数え、txId と JSON の記号を足した値) に余裕を持たせた値です。同じ code と文言の 413 は、既に認証・残高・トレードオフの API にあります。今の一括保存には本文の大きさの上限が無く、件数 (100 件) の上限だけがあります。

**答**

承認する。preview の 3 か所を新の文面に改める。利点: 大きすぎる本文を、全体の読み込みと zod の検証の前に断れる。不利な点: 正当な要求が 256KB を超える場合が出たら、上限の値を見直す必要がある。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「本文の上限」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-013)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T00:52:37.098Z) を秒へ切り上げた値で、選択時刻の上界である。qa-classify-bulk-decision-026 と qa-classify-bulk-decision-027 で利用者が agent に委ねた中身を確かめる問である。改めた後の文面は requirements_foundation の該当項目にある。 / 回答時刻: 2026-10-01T00:52:38Z)

#### 裏付け質疑: `qa-classify-bulk-decision-031` — 旧版（置き換え先: `qa-classify-bulk-decision-054`）

> **旧版** — この問答は `qa-classify-bulk-decision-054` で置き換えられた (`2026-10-01T07:22:35Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は、サーバと画面の失敗の扱いの細部をまとめて 1 問で承認を求めていた (N4 の違反)。論点ごとに分け、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-019。分けた問の対応: 「通信の失敗」は qa-classify-bulk-decision-054 (『読み直して再試行を出す』を選択)。「400・403・413」は qa-classify-bulk-decision-055 (『文言を出し再試行は出さない』を選択)。「409の扱い」は qa-classify-bulk-decision-056 (『文言を出し再試行を出す』を選択)。置き換え先はこのうち qa-classify-bulk-decision-054 の 1 本とし、ほかの問は qa-classify-bulk-decision-031 の参照先セルへ参照を足した。この回で問わない残りの論点 (D1 の batch そのものが失敗したときの扱いと、サーバの細部 (状態コードの分け方・256KB・書き込みの予算の検査) と画面の実装の形 (失敗の分け方を 1 つの関数にまとめる・DOM テスト 3 種) を agent に委ねてよいか) は、続く回で同じ論点として問う。

**問**

```text
一括保存の失敗の扱いの細部を、agent の推定として記録した 2 件 (サーバ側と画面側) のとおりに決めることを承認しますか。2 件の逐語は『承認する』の preview にあります。細部の例: 400 は件数の範囲外・txId の重複・一括指定の値の範囲外の 3 つだけ。413 は本文の大きさ (payload_too_large) と書き込みの予算 (too_many_classify_changes、単体編集と同じ検査の関数を使う) の 2 種類。write_failed は D1 の batch そのものの失敗だけ。401・403・409・503 は既存の柵のまま。通信の失敗と 5xx の文言は『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』。失敗の分け方は画面の 1 つの関数にまとめる。DOM テストを 3 種類足す。サーバ側の記録には、本文の形を今の実装のまま書いた誤りがあり、訂正 (本文は一括指定と下書きで、サーバが値を解決する。この形でも同じ要求の送り直しで結果は変わらない) を付けてあります。
```

**答**

```text
承認する。2 件の記録 (サーバ側は訂正を含む) の内容で細部を決め、利用者の決定として扱う。利点: 細部が決まり、次の工程へ進める。不利な点: 文言・関数のまとめ方・テストの数などを、1 件ずつ確かめずに決めることになる。 回答に自由記述は付いていない。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「細部の委任」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-013)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T00:52:37.098Z) を秒へ切り上げた値で、選択時刻の上界である。問の対象は qa-classify-bulk-backend-web-010 (訂正を含む) と qa-classify-bulk-frontend-web-005 である。qa-classify-bulk-decision-026 と qa-classify-bulk-decision-027 で利用者が agent に委ねた中身を確かめる問である。 / 回答時刻: 2026-10-01T00:52:38Z)

#### 裏付け質疑: `qa-classify-bulk-decision-033`

**問**

一括保存の 1 要求が、Cloudflare 無料プランの「1 回の起動で D1 へ出すクエリは合計 50 本まで」を超えます (今の書き方では 50 件で 200 本を超えます)。どう解きますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。4 案のどれも選ばずに保留するときは、『その他』にその旨を書いてください。

**答**

自由記述で回答 (4 つの選択肢のどれも選んでいない):『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「クエリの上限」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-014)。利用者はこの問で選択肢を選ばず、自由記述を回答した。answered_at は回答受領時刻 (2026-10-01T01:36:46.980Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-005 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T01:36:47Z)

#### 裏付け質疑: `qa-classify-bulk-delegated-001`

**問**

qa-classify-bulk-decision-033 で利用者が選定を委ねた問「クエリの上限」について、agent はどの案を選んだか。

**答**

選んだ案: (1) 書き込みを束ねる — 明細ごとの編集・履歴の書き込みを json_each で 1 文ずつに束ねる (前例: 集計の置き換え aggregateReplacementQueries)。1 要求は明細数によらず約 25 本になる。利点: 50 件も 100 件も 1 回で保存でき、上限と無料プランはそのまま。不利な点: 書き込みが 1 つの batch になるため、失敗すると保存対象の全件が write_failed になり、明細ごとの部分成功は無くなる。store と履歴の書き込み関数を変える。 無料枠の条件から外れた案: (4)『Workers Paid にする』は月額の固定費がかかり、無料枠で動かすという条件から外れる。 選んだ理由: (2)『画面から小分けに順送り』は無料枠で動くが、途中で止まると一部だけ保存され、50 件で 10〜17 往復かかる。(3)『サーバの上限を下げる』は範囲外にした一括保存の上限の変更に当たり、50 件を一度に保存できない。(1) は、D1 の batch が 1 つのトランザクションとして実行されるため、全件が保存されるか全件が保存されないかのどちらかになり、途中まで書かれた状態が残らない。集計の置き換え (aggregateReplacementQueries) と同じ書き方で、1 要求のクエリは明細数によらず約 25 本となり、無料プランの上限 50 本に収まる。 これは利用者の委任 (qa-classify-bulk-decision-033) を受けた agent の選定で、利用者が選択肢から選んだ案ではない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者は qa-classify-bulk-decision-033 で、選択肢を選ばずに『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』と回答した。agent はこの委任を受けて、qa-classify-bulk-presented-options-014 の問1 の選択肢から選んだ。前回の選択と同じ案である (qa-classify-bulk-decision-005)。 / 回答時刻: 2026-10-01T01:43:48Z)

#### 裏付け質疑: `qa-classify-bulk-decision-034`

**問**

一覧で選んだ明細を、選択の読み出しと一括保存では、どの単位で扱いますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。URL の sel には一覧の行の key が入ります (明細の行は mf: か cash:、分割の内訳行は split: で始まります)。今の一括保存のサーバは、分割の内訳行を split_line_not_supported で拒否します。

**答**

自由記述で回答 (4 つの選択肢のどれも選んでいない):『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「選択の単位」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-014)。利用者はこの問で選択肢を選ばず、自由記述を回答した。answered_at は回答受領時刻 (2026-10-01T01:36:46.980Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-007 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T01:36:47Z)

#### 裏付け質疑: `qa-classify-bulk-delegated-002`

**問**

qa-classify-bulk-decision-034 で利用者が選定を委ねた問「選択の単位」について、agent はどの案を選んだか。

**答**

選んだ案: (1) key で読み内訳行は選べない — API は sel の値 (行の key) をそのまま受け、一覧と同じ形の行を返す。保存するときは、行から txId を引く。分割の内訳行にはチェックを出さず、理由を表示する。利点: URL の sel と一覧の行が 1 対 1 で対応し、一括保存の経路 (txId 単位) は今のまま使える。不利な点: 分割の内訳行は一括では保存できず、1 件ずつ直す。 無料枠の条件から外れた案: 無い (どの案も無料枠で動く)。 選んだ理由: URL の sel と一覧の行が 1 対 1 で対応し、今の txId 単位の一括保存の経路をそのまま使える。(2) は内訳行を保存する経路とその検査を新しく作ることになり、範囲外にした分割の仕様の変更に当たる。(3) は選んだ行と保存される範囲が一致せず、選んでいない内訳まで変わりうる。 これは利用者の委任 (qa-classify-bulk-decision-034) を受けた agent の選定で、利用者が選択肢から選んだ案ではない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者は qa-classify-bulk-decision-034 で、選択肢を選ばずに『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』と回答した。agent はこの委任を受けて、qa-classify-bulk-presented-options-014 の問2 の選択肢から選んだ。前回の選択と同じ案である (qa-classify-bulk-decision-007)。 / 回答時刻: 2026-10-01T01:43:48Z)

#### 裏付け質疑: `qa-classify-bulk-decision-035`

**問**

一括指定で区分かカテゴリ (大) を指定し、残りの項目を指定しなかったとき、残りの項目をどう決めますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。事業の明細は、大項目が freee の勘定科目で、中項目は空と決まっています。データに『カテゴリが空』の状態は無く、空で保存すると取込値か集計ルールの値が残ります。区分に合うカテゴリの組がどこにも無い明細の扱いと、確定済みの明細で提案を使うかどうかは、別の問で伺います。

**答**

自由記述で回答 (4 つの選択肢のどれも選んでいない):『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「残りの項目」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-014)。利用者はこの問で選択肢を選ばず、自由記述を回答した。answered_at は回答受領時刻 (2026-10-01T01:36:46.980Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-010 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T01:36:47Z)

#### 裏付け質疑: `qa-classify-bulk-delegated-003`

**問**

qa-classify-bulk-decision-035 で利用者が選定を委ねた問「残りの項目」について、agent はどの案を選んだか。

**答**

選んだ案: (1) 区分とカテゴリを1組で決める — カテゴリ (大) を指定したら、カテゴリ (中) も一括指定の値にする (指定が無ければ空)。区分だけを指定したときは、下書きか提案のうち区分が同じものからカテゴリの組を取る。利点: 区分とカテゴリが別々の出所から来ないので、系統の合わない組ができない。不利な点: 区分が違う下書きのカテゴリは使われない。 無料枠の条件から外れた案: 無い (どの案も無料枠で動く)。 選んだ理由: カテゴリの妥当性は区分で決まる (事業は freee の勘定科目で中項目が空、個人は MF の分類)。区分とカテゴリを同じ出所から 1 組で取れば、合わない組が構造上できず、合わない組を見つけて外す判定も表示も要らない。(2) は保存を押すまで失敗が分からない。(3) は保存の前に分かるが、合わない組を作ってから外す分だけ判定と表示が増える。 これは利用者の委任 (qa-classify-bulk-decision-035) を受けた agent の選定で、利用者が選択肢から選んだ案ではない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者は qa-classify-bulk-decision-035 で、選択肢を選ばずに『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』と回答した。agent はこの委任を受けて、qa-classify-bulk-presented-options-014 の問3 の選択肢から選んだ。前回の選択と同じ案である (qa-classify-bulk-decision-010)。 / 回答時刻: 2026-10-01T01:43:48Z)

#### 裏付け質疑: `qa-classify-bulk-decision-036`

**問**

一括保存で確定済みの明細を選んだとき、一括指定で指定しなかった項目 (区分・カテゴリ・所有者) は、どの値で保存しますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。一覧では、確定済みの明細にも提案が付きます。

**答**

自由記述で回答 (3 つの選択肢のどれも選んでいない):『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「確定済みの値」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-014)。利用者はこの問で選択肢を選ばず、自由記述を回答した。answered_at は回答受領時刻 (2026-10-01T01:36:46.980Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-013 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T01:36:47Z)

#### 裏付け質疑: `qa-classify-bulk-delegated-004`

**問**

qa-classify-bulk-decision-036 で利用者が選定を委ねた問「確定済みの値」について、agent はどの案を選んだか。

**答**

選んだ案: (1) 今の値を保つ — 下書きがあれば下書き、無ければ今の値のまま保存する。提案は未整理の明細にだけ使う。利点: 手で決めた値が提案に置き換わらない。不利な点: 確定済みの明細を提案に揃えたいときは、一括指定か下書きで値を入れる。 無料枠の条件から外れた案: 無い (どの案も無料枠で動く)。 選んだ理由: 利用者が手で決めた値を、自動の提案で黙って上書きしない。確定済みの明細を提案に揃えたいときは、一括指定で明示できる。(2) は手で決めた値が提案で置き換わり、気づかないまま確定済みの分類が変わりうる。 これは利用者の委任 (qa-classify-bulk-decision-036) を受けた agent の選定で、利用者が選択肢から選んだ案ではない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者は qa-classify-bulk-decision-036 で、選択肢を選ばずに『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』と回答した。agent はこの委任を受けて、qa-classify-bulk-presented-options-014 の問4 の選択肢から選んだ。前回の選択と同じ案である (qa-classify-bulk-decision-013)。 / 回答時刻: 2026-10-01T01:43:48Z)

#### 裏付け質疑: `qa-classify-bulk-decision-037`

**問**

一括指定で区分を指定し、その区分に合うカテゴリの組が、保存に使える値 (下書き・提案・今の値) のどこにも無い明細は、どう扱いますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。データに『カテゴリが空』の状態は無く、空で保存すると取込値か集計ルールの値が残ります。

**答**

カテゴリなしを新設する。『カテゴリなし』を値として保存できるようにデータを変える。利点: 区分だけを決めて先に保存し、カテゴリは後で決められる。不利な点: 集計・分類の状態・履歴に影響する大きな構造変更になる。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「合う組が無い」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-015)。利用者はこの問で「カテゴリなしを新設する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:13:11.498Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-014 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:13:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-038`

**問**

分割の設定が不正な明細 (内訳の合計が元の金額と合わない、または明細の識別子が不安定) は、一覧に元の明細の行として出ます。この行を一括保存の選択の対象にしますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。一括保存のサーバは、分割のある明細を split_line_not_supported で返すので、どの案でも、分割を直すまでその明細は一括では保存されません。

**答**

選べなくする。内訳行と同じく、チェックを出さず、理由『分割の設定を直してから保存してください』を表示する。利点: 保存できない行が選択に入らず、理由が一覧の上で分かる。不利な点: その行は選択一覧に出ないので、直す必要のある明細を選択で控えておけない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「不正な分割」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-015)。利用者はこの問で「選べなくする」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:13:11.498Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-012 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:13:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-039`

**問**

MF の大項目が空か『未分類』の明細にも、『MF の分類』を提案として出しますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。『MF の分類』は、記憶・ルール・MF 中項目の対応表のどれも無い個人の明細に付ける最後の提案で、信頼度は 60 (要確認の閾値 80 未満) です。

**答**

出さない。その行は、一括指定か下書きが無ければ、保存前の内訳に『提案なし』として外す理由を出す。利点: 意味の無い値 (未分類) で保存されるのを防ぐ。不利な点: 取込直後の未分類の行は、一括指定しないと保存できない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「未分類の提案」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-015)。利用者はこの問で「出さない」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:13:11.498Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-006 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:13:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-040`

**問**

『MF の分類』の提案 (信頼度 60) を、事業の明細にも付けますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。事業の明細の科目は freee の勘定科目で、中項目は空と決まっています。MF の大項目を freee の勘定科目へ対応づける表は、今はありません。

**答**

対応表を作って事業にも付ける。MF の大項目を freee の勘定科目へ対応づける表を新しく設け、事業の明細にも提案する。利点: 事業の明細も、一括指定なしで提案から保存できる。不利な点: 対応表の中身を決める作業と、表をどこに持つかを決める作業が別に要る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「事業の提案」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-015)。利用者はこの問で「対応表を作って事業にも付ける」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:13:11.498Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-009 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:13:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-045`

**問**

問い直しの第 2 回で『カテゴリなしを新設する』を選んだので、その細部を決めます。今、カテゴリが空の編集は『指定なし』として扱われ、保存すると取込値か集計ルールの値に戻るので、『カテゴリなし』を値として残す手段がありません。土台の C2 は『DB の表と列は足さない (migration なし)』と定めています。『カテゴリなし』をどう持ちますか。

**答**

予約の値で持つ。明細の編集の大項目の欄に、『カテゴリなし』を表す予約の値を保存する。表と列は足さない。利点: migration が要らず、C2 をそのまま保てる。バックアップの形式も変わらない。不利な点: カテゴリを名前として扱う箇所 (候補の検査・集計・履歴・バックアップ・総収支) のすべてで、予約の値を別に扱う処理が要る。予約の値と同じ名前のカテゴリは作れない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「なしの持ち方」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-017)。利用者はこの問で「予約の値で持つ」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:58:11.560Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-037 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T03:58:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-046`

**問**

問い直しの第 2 回で『カテゴリなしを新設する』を選んだので、その細部を決めます。『カテゴリなし』で保存した明細を、集計でどう数えますか。今、家計の支出の集計は大項目が空の明細を『未分類』に入れ、総収支の内訳は空なら取込の大項目 (それも空なら『その他』) に入れます。説明可能率 (合計から未分類と現金・カードを引いた割合) は、未分類を説明できない側に数えます。

**答**

未分類と同じに数える。家計の集計と総収支の内訳では『未分類』に入れ、説明可能率では説明できない側に数える。利点: 集計とグラフの項目が増えず、今の空の扱いの経路に乗る。不利な点: 取込のときから未分類の明細と、利用者が意図してカテゴリなしにした明細が、集計の上では区別できない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「なしの集計」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-017)。利用者はこの問で「未分類と同じに数える」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:58:11.560Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-037 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T03:58:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-047`

**問**

問い直しの第 2 回で『カテゴリなしを新設する』を選んだので、その細部を決めます。『カテゴリなし』で保存した明細の分類の状態を、どうしますか。分類の状態は 3 つで、未整理 (区分が既定のまま。月次クローズの『仕分け』の残り件数と同じ集合)・確定 (ルール・記憶・提案の採用で決まった)・手動 (それ以外の保存) です。今の規則のままなら、区分を保存した明細は『手動』になります。

**答**

今の規則のまま手動。状態の規則は変えず、『手動』とする。利点: 状態の規則と月次クローズの意味が変わらない。不利な点: カテゴリが決まっていない明細が、手で決めた明細と同じ状態に入り、状態の絞り込みだけでは見分けられない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「なしの状態」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-017)。利用者はこの問で「今の規則のまま手動」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:58:11.560Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-037 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T03:58:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-048`

**問**

問い直しの第 2 回で『カテゴリなしを新設する』を選んだので、その細部を決めます。『カテゴリなし』を、どこで選べるようにしますか。問い直しの第 2 回の問は、一括指定で区分を指定し、その区分に合うカテゴリの組が保存に使える値 (下書き・提案・今の値) のどこにも無い明細の扱いでした。

**答**

一括保存の補いだけ。一括保存で、指定した区分に合う組がどこにも無い明細だけを『カテゴリなし』で保存し、保存前の内訳にその件数を出す。利点: 選ぶ欄が増えず、使われる場面が問の場面に限られる。不利な点: 一括指定の欄と編集パネルでは選べず、一度カテゴリを付けた明細を『カテゴリなし』に戻せない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「なしの選び方」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-017)。利用者はこの問で「一括保存の補いだけ」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:58:11.560Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-037 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T03:58:12Z)

#### 裏付け質疑: `qa-classify-bulk-decision-049`

**問**

問い直しの第 2 回で『対応表を作って事業にも付ける』を選んだので、MF の大項目から freee の勘定科目への対応表の細部を決めます。対応表をどこに持ちますか。土台の C2 は『DB の表と列は足さない (migration なし)』と定めています。既存の設定の表 (集計ルール) は、種類を 2 つ (勘定科目・取引先) に限る制約があり、種類を足すには表の作り直し (破壊的な migration) が要ります。

**答**

DB の表にして画面で編集。新しい表を足し、設定画面で行を足し引きできるようにする。利点: 利用者が自分の分類に合わせて、画面から直せる。不利な点: migration と C2 の改訂が要る。設定の変更履歴の種類の制約も作り直し (破壊的な migration で、PR での承認が要る)、バックアップと復元の形式も変わる。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「対応表の置場」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-018)。利用者はこの問で「DB の表にして画面で編集」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T06:52:48.811Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-040・qa-classify-bulk-decision-042 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T06:52:49Z)

#### 裏付け質疑: `qa-classify-bulk-decision-050`

**問**

問い直しの第 2 回で『対応表を作って事業にも付ける』を選んだので、MF の大項目から freee の勘定科目への対応表の細部を決めます。対応表の中身を、preview の案にしますか。案は、取り込まれる実際の MF の大項目 19 件 (住宅・自動車など、家計の標準一覧と名前が違うものを含む) から、税務の勘定科目一覧 (32 件) への対応です。土台の C4 は、税務上の正本を freee とし、本画面は税務判断をしないと定めています。案は、事業の明細になったときに中身のほとんどが 1 つの科目に当たる大項目だけを対応させ、それ以外は対応させません (その明細には提案が付きません)。

**答**

承認する。preview の案のとおりに対応表を作る。利点: 案のとおりに実装へ進める。科目を 1 つに決められない大項目には提案を出さないので、税務の判断に当たる提案が出ない。不利な点: 対応させない 14 件の大項目の事業の明細には提案が付かず、一括指定か 1 件ずつの編集が要る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「対応表の中身」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-018)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T06:52:48.811Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-040 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T06:52:49Z)

#### 裏付け質疑: `qa-classify-bulk-decision-051`

**問**

問い直しの第 2 回で『対応表を作って事業にも付ける』を選んだので、MF の大項目から freee の勘定科目への対応表の細部を決めます。対応表から事業の明細へ出す提案の信頼度を、どうしますか。個人の明細への『MF の分類』の提案は、信頼度 60 と決まっています。信頼度が 80 未満の提案が付いた未整理の明細は、要確認に入ります。

**答**

個人と同じ 60。信頼度を 60 とする。利点: 信頼度の段階が増えず、表示と試験は今の決定のまま。不利な点: 対応表を経た提案と、取込の分類をそのまま出す提案の違いが、信頼度には出ない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「対応の信頼度」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-018)。利用者はこの問で「個人と同じ 60」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T06:52:48.811Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-040・qa-classify-bulk-decision-042 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T06:52:49Z)

#### 裏付け質疑: `qa-classify-bulk-decision-052`

**問**

問い直しの第 2 回で『対応表を作って事業にも付ける』を選んだので、MF の大項目から freee の勘定科目への対応表の細部を決めます。対応表から事業の明細へ出す提案の、由来名をどうしますか。個人の明細への提案の由来名は『MF の分類』で、根拠文は『MFの分類をそのまま提案』と決まっています。今の表示は、記憶とルール以外の根拠をすべて『MF の中項目が「事業」』と表示するので、どちらの案でも表示の直しは要ります。

**答**

由来名を分ける。由来名を『MF の分類 (対応表)』とし、根拠文に大項目と勘定科目の対応を書く。利点: 個人の『MF の分類』と区別でき、対応表を経た提案だと由来名で分かる。不利な点: 由来の種類が 1 つ増え、根拠の型と表示に種類を足す必要がある。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「対応の由来名」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-018)。利用者はこの問で「由来名を分ける」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T06:52:48.811Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-040・qa-classify-bulk-decision-042 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T06:52:49Z)

#### 裏付け質疑: `qa-classify-bulk-decision-041`

**問**

提案の無い明細 (以前の確認では、未整理の 741 件すべてが提案なし) を、まとめて確定する手段をどうしますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。(1) 以外を選ぶと、先に決めた一括指定の細部 (区分とカテゴリの組の取り方、合う組が無い行の扱い) の一部か全部が使われなくなります。

**答**

一括指定を足す。一括バーに区分・カテゴリ (大/中)・所有者・支払い方法の指定欄を足す。指定した項目は選択した全件に当て、指定しない項目は各行の下書き→提案の順で埋める。利点: 提案の無い明細も、選んでまとめて保存できる。不利な点: 一括バーの欄が 5 つ増え、デザイン画像 (一括バーはボタンのみ) から外れる。指定を誤ると、選択した全件に及ぶ。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「一括の手段」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-016)。利用者はこの問で「一括指定を足す」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:24:14.920Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-001 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:24:15Z)

#### 裏付け質疑: `qa-classify-bulk-decision-042`

**問**

記憶・ルール・MF 中項目の対応表のどれも当たらず、提案が 1 件も出ない明細をどうしますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。(1) 以外を選ぶと、先に決めた『未分類の提案』と『事業の提案』の 2 つの決定は使われなくなります。

**答**

MFの分類を提案に足す。取込 CSV の大項目・中項目を、記憶→ルール→MF 中項目の対応表の後ろの最後の提案として出す。信頼度は 60 (要確認の閾値 80 未満) で、根拠文に『MFの分類をそのまま提案』と書く。利点: 取込直後の明細の多くに提案が付き、一括保存がそのまま効く。不利な点: MF の分類が実態と違う明細にも提案が付き、確かめずに保存すると、その分類のまま確定する。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「提案の追加」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-016)。利用者はこの問で「MFの分類を提案に足す」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:24:14.920Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-002 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:24:15Z)

#### 裏付け質疑: `qa-classify-bulk-decision-043`

**問**

ページや絞り込みをまたいだ選択 (URL の sel に最大 50 件) をどう扱いますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。

**答**

またいで保つ。選択は絞り込み・ページを変えても保つ。一括バーの選択一覧は表示外の選択も含めて全件出し、保存はサーバが明細を引き直して解決する (表示中の一覧に依存しない)。利点: 複数のページや絞り込みから集めた明細を、1 回で保存できる。不利な点: 表示中に見えない明細も保存の対象になり、選択一覧で確かめる手間が要る。サーバに選択を読み出す API を足す。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「選択の範囲」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-016)。利用者はこの問で「またいで保つ」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T03:24:14.920Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-003 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T03:24:15Z)

#### 裏付け質疑: `qa-classify-bulk-decision-054`

**問**

一括保存の要求に応答が返らない (通信の失敗) か、サーバが 5xx を返したとき、画面は何を出し、選択と再試行をどう扱いますか。以前の問では、サーバと画面の細部をまとめて 1 問で承認を求めていたので、論点ごとに分けて問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。この 2 つでは明細ごとの結果が無く、書き込まれたかどうかが分かりません。一括保存は、同じ本文をもう一度送っても、最終の状態が 1 回目と同じになる作りです。

**答**

読み直して再試行を出す。一覧と選択の読み出しを読み直し、選択を残し、role=alert で『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』と出す。直前の要求の本文をそのまま送る『同じ内容で再試行』のボタンを出し、自動では送り直さない。利点: 書けたかどうかを一覧で確かめてから、1 回の操作で同じ本文を送り直せる。不利な点: 直前の本文を画面に保持する処理と、そのボタンの試験が要る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「通信の失敗」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-019)。利用者はこの問で「読み直して再試行を出す」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T07:21:54.695Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-031 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T07:21:55Z)

#### 裏付け質疑: `qa-classify-bulk-decision-055`

**問**

一括保存の要求全体が 400・403・413 で返ったとき、画面は何を出し、選択と再試行をどう扱いますか。以前の問では、サーバと画面の細部をまとめて 1 問で承認を求めていたので、論点ごとに分けて問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。これらは書き込みの前に返り、同じ本文を送り直しても結果は変わりません。400 は件数の範囲外 (1〜100 件)・txId の重複・一括指定の値の範囲外、413 は本文の大きさ (256KB を超える) と書き込みの予算 (1 回の batch の文が 50 本を超える、または月次集計を束ねた JSON が 2MB を超える)、403 は一時パスワードのままの利用者 (password_change_required) です。400 と 413 の分け方は agent の案で、その細部を agent に委ねてよいかは別の問で伺います。

**答**

文言を出し再試行は出さない。サーバの文言を role=alert で出し、選択を残す。再試行のボタンは出さない。利点: 結果の変わらない送り直しを誘わない。選択が残るので、件数を減らすなどして保存し直せる。不利な点: 直し方は文言から読み取る必要がある。413 の書き込みの予算は、選択を減らしても下がらない場合がある。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「400・403・413」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-019)。利用者はこの問で「文言を出し再試行は出さない」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T07:21:54.695Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-031 の論点の一部を分けて問い直したもの。 / 回答時刻: 2026-10-01T07:21:55Z)

#### 裏付け質疑: `qa-classify-bulk-decision-056`

**問**

一括保存の要求が 409 canonical_write_busy (取込みや別の更新が進行中) で返ったとき、画面は何を出し、選択と再試行をどう扱いますか。以前の問では、サーバと画面の細部をまとめて 1 問で承認を求めていたので、論点ごとに分けて問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。409 は書き込みの前に返り、進行中の処理が終わった後なら、同じ本文で保存できることがあります。

**答**

文言を出し再試行を出す。サーバの文言を role=alert で出し、選択を残し、直前の本文をそのまま送る『同じ内容で再試行』のボタンを出す。利点: 進行中の処理が終わった後に、1 回の操作で同じ本文を送り直せる。不利な点: 処理が終わる前に押すと、同じ 409 が返る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「409の扱い」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-019)。利用者はこの問で「文言を出し再試行を出す」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T07:21:54.695Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-031 の論点の一部を分けて問い直したもの。 / 回答時刻: 2026-10-01T07:21:55Z)

#### 裏付け質疑: `qa-classify-bulk-decision-057`

**問**

一括保存で、D1 への書き込み (1 回の batch) そのものが失敗したとき、サーバは何を返しますか。以前の問では、サーバと画面の細部をまとめて 1 問で承認を求めていたので、論点ごとに分けて問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。一括保存の書き込みは 1 回の batch に束ねてあり、D1 の batch は 1 つのトランザクションとして実行され、どれかの文が失敗すると全体が取り消されます (D1 の公式文書)。この失敗は、書き込みの前に返る 400・403・409・413 と違い、書き込みを試みた後に分かります。画面は、2xx の応答では write_failed を返した明細について『失敗した N 件のみ再試行』を出し、5xx の応答では一覧を読み直して『同じ内容で再試行』を出すと決まっています。要件の土台は今、この失敗で保存対象の全件を write_failed として返すと書いていて、別の案を選ぶと土台のその箇所を改めます。

**答**

全件を write_failed で返す。要求は 2xx で返し、保存対象の全件を明細ごとの結果 write_failed にする。画面は『失敗した N 件のみ再試行』を出し、押すと失敗した明細だけを送り直す。利点: 書き込まれていないことを明細ごとの結果で伝えられ、画面は一覧を読み直さずに済む。不利な点: 要求全体の失敗が 2xx で返るので、状態コードだけを見る監視やログでは失敗として数えられない。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「batchの失敗」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-020)。利用者はこの問で「全件を write_failed で返す」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T07:37:18.085Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-031 の論点の一部を分けて問い直したもの。qa-classify-bulk-decision-031 の置き換え先は qa-classify-bulk-decision-054 である。 / 回答時刻: 2026-10-01T07:37:19Z)

#### 裏付け質疑: `qa-classify-bulk-decision-058`

**問**

以前の 2 問 (通信の失敗と 5xx の扱い・400 と 413 の扱い) で、選択肢を選ばずに『失敗したまま進めないように、問題を本質的に解決して進めるようにしてください。ベストプラクティスな方法を選んだ上で選択して進めてください。』と回答されたのを、agent は、要件の土台に書かれていないサーバの細部を agent が選んでよいという意味に読みました。この読みを承認しますか。以前の問では、この読みを含む 6 つの読みをまとめて 1 問で承認を求めていたので、論点ごとに分けて問い直します。以前と違う案を選ぶと、記録の該当箇所を改めます。画面の振る舞いは前回の問で決まり、D1 の batch の失敗はこの回の別の問で伺います。本文の上限 256KB・書き込みの予算の 413・同じ要求の送り直しで結果が変わらないこと・失敗の分け方を 1 つの関数にまとめること・DOM テストの観点は、要件の土台の文面にあるので、この問の対象に含めません。対象の細部の逐語は『承認する』の preview にあります。

**答**

承認する。この読みのとおり、preview の細部を agent の案で決める。利点: 細部を 1 件ずつ問わずに、次の工程へ進める。不利な点: 文言・既存の柵の扱い・変えない制約を、1 件ずつ確かめずに決めることになる。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「細部の委任」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-020)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T07:37:18.085Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-032 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T07:37:19Z)

#### 裏付け質疑: `qa-classify-bulk-decision-069`

**問**

要件の土台のうち、一括保存の失敗の扱い・保存前の内訳・『カテゴリなし』の通し方を書いた 11 項目 (O2・O8・O9・S1・I1・I7・I9・範囲に含む 1・3・7・10) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、この回と次の回で 3 つずつ伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。11 項目のうち 9 項目は、以前の承認 (decision-018・029 など) の後の決定で文面が変わり、そのうち I9 と範囲に含む 10 は新しく足す項目です。O9 と I7 は変えません。主な変化: 保存前の内訳に、『カテゴリなし』で保存する件数を足す。書き込みの batch が失敗したら、要求を 2xx で返して保存対象の全件を write_failed にする (decision-057)。通信の失敗と 5xx の後は一覧と選択を読み直し、409 の後はサーバの文言を出し、どちらも『同じ内容で再試行』を出す (decision-054・056)。400・403・413 は文言を出して再試行を出さない (decision-055)。文言はどれも role=alert で出す。『カテゴリなし』の予約の値を core の 1 か所で定め、集計・分類の状態・候補の検査・履歴・バックアップで未分類と同じ扱いに通す (decision-045〜048)。承認すると、この問の記録を、仕様の frontend の章 (画面の振る舞い) の主な根拠にします。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 2800 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・失敗と内訳」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-024)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:12:13.849Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-060 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T09:12:14Z)

#### 裏付け質疑: `qa-classify-bulk-decision-070`

**問**

要件の土台のうち、取込直後の提案と勘定科目の対応表を書いた 9 項目 (G2・O3・S2・I4・I8・範囲に含む 6・11・C2・C4) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、この回と次の回で 3 つずつ伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。9 項目とも、以前の承認 (decision-016) の後の決定で文面が変わり、そのうち I8 と範囲に含む 11 は新しく足す項目です。主な変化: 事業の明細にも、勘定科目の対応表で大項目から引いた勘定科目を、由来『MF の分類 (対応表)』で提案する (decision-040・049〜052)。勘定科目の対応表に行の無い大項目と、MF の大項目が空か『未分類』の明細には付けない (decision-050・039)。集計ルールが当たる個人の明細は、ルールを当てた後の値を提案する (decision-028)。勘定科目の対応表の表を migration で 1 つ足し、API・設定画面・設定の変更履歴・設定の JSON (版 2)・バックアップに加える。変更履歴の種類の制約の作り直しは破壊的な migration なので、PR で承認する (I8・範囲に含む 11・C2)。C2 は『表と列は足さない』から『表の追加は勘定科目の対応表の 1 つに限り、既存の表に列は足さない』に変わります。以前の問 (decision-016) は、『承認しない』にだけ結果を書いていて選択肢の書き方が片寄っていたので、各選択肢に利点と不利な点を書いて問い直します。承認すると、この問の記録を、仕様の database と infrastructure の章の主な根拠にします。今の 2 つの章の主な根拠は、migration を足さないとした以前の回答で、この点が今の文面と食い違っています。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 4200 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・提案と対応表」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-024)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:12:13.849Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-016 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T09:12:14Z)

#### 裏付け質疑: `qa-classify-bulk-decision-072`

**問**

要件の土台のうち、選択の単位と選べる行・保存の経路の認可と入力検証を書いた 12 項目 (G3・G5・O4・O6・S3・S5・I3・I5・範囲に含む 4・5・9・範囲に含まない 5) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、前の回で 3 つを承認いただいたので、この回で残りの 3 つを伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。12 項目のうち 6 項目 (G3・G5・O6・S5・範囲に含む 4・5) は、以前の承認 (decision-017・030) の後の決定で文面が変わりました。ほかの 6 項目は変えません。主な変化: 分割の設定が不正な明細の行も選べず、理由『分割の設定を直してから保存してください』を示す (decision-038)。勘定科目の対応表の読み書きも利用者自身の行だけを扱い、他の利用者の行は存在を明かさず『見つからない』とし、同じ大項目の 2 行目と一覧に無い対応先を 400 にし、変更を設定の変更履歴に残す (decision-049)。『カテゴリなし』の予約の値は一括指定と編集の値としては 400 にし、同じ名前のカテゴリの候補は作れない (decision-045・048)。一括保存の本文は 256KB までで、超えたら 413 を返す (decision-030)。以前の問 (decision-017) は、『承認しない』にだけ結果を書いていて利点と不利な点の対が無かったので、各選択肢に利点と不利な点を書いて問い直します。承認すると、この問の記録を、仕様の security と auth の章の主な根拠にします。今の auth の章の主な根拠は、勘定科目の対応表を足す前の回答で、対応表の行の扱いを含んでいません。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 3100 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・選択と認可」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-025)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:28:56.562Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-017 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T09:28:57Z)

#### 裏付け質疑: `qa-classify-bulk-decision-074`

**問**

要件の土台のうち、取引一覧の見え方・品質ゲート・技術と表示の制約・関係者・範囲に含まないものを書いた 16 項目 (G4・O5・O7・S4・I6・範囲に含む 8・C1・C3・SH1・SH2・範囲に含まない 1〜4・6・7) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、前の回で 3 つを承認いただいたので、この回で残りの 3 つを伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。16 項目のうち文面が変わったのは G4 と範囲に含む 8 の 2 項目で、どちらも根拠の id だけです (G4 の末尾に decision-044 を足し、範囲に含む 8 の decision-004 を、それを置き換えた decision-044 に直した)。ほかの 14 項目は変えません。範囲に含まない 7 (モバイル・タブレット・デスクトップ専用アプリ) は、前の回の対象の環境の問 (decision-067) で『web だけを対象にする』が選ばれたことと合っています。承認すると、この問の記録を、仕様の ui-ux の章の主な根拠にします。今の ui-ux の章の主な根拠 (ui-ux-web-001) は、再試行をサーバが失敗を返した明細に限っていて、確かめられない失敗と処理中の 409 で『同じ内容で再試行』を出す決定 (decision-054・056) と食い違っています。maintenance-ops の章は、今の主な根拠 (O5・O7 と同じ内容の回答) を残し、この問の記録を根拠に足します。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 1900 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・一覧と制約」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-025)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:28:56.562Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-060 の回答を受けて続けて問うた新しい論点。 / 回答時刻: 2026-10-01T09:28:57Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 一括保存を、提案が無くても使えるようにする。一括バーに区分・カテゴリ (大/中)・所有者・支払い方法の一括指定欄を置く (qa-classify-bulk-decision-041)。指定した項目は選択した全件に当てる。指定しない項目は、未整理の明細では各行の下書き→提案の順、確定済みの明細では下書き→今の値の順で埋め、手で決めた値を提案で置き換えない (qa-classify-bulk-decision-036・qa-classify-bulk-delegated-004)。区分とカテゴリは 1 組で決める。カテゴリ (大) を指定したらカテゴリ (中) も一括指定の値 (指定が無ければ空) にし、区分だけを指定したときは、埋める値のうち区分が同じものからカテゴリの組を取る (qa-classify-bulk-decision-035・qa-classify-bulk-delegated-003)。区分に合うカテゴリの組が、埋める値 (下書き・提案・今の値) のどこにも無い明細は、カテゴリを『カテゴリなし』にして保存する (qa-classify-bulk-decision-037・qa-classify-bulk-decision-048)。『カテゴリなし』は予約の値で持ち (qa-classify-bulk-decision-045)、集計では未分類と同じに数え (qa-classify-bulk-decision-046)、分類の状態は手動とする (qa-classify-bulk-decision-047)。一括指定の欄と編集パネルでは選べない (qa-classify-bulk-decision-048)。保存の前に、何件をどの値の出所で保存し、そのうち何件を『カテゴリなし』で保存するか、何件をどの理由で外すか (埋める値が無い行、確定済みで変わる値が無い行) を示し、外した行は失敗に数えない。再試行は書き込みの失敗 (write_failed) を返した明細にだけ出し、押せば必ずその明細だけを送り直す (qa-classify-bulk-decision-018)。書き込みの batch が失敗したときは、保存対象の全件が write_failed になる (qa-classify-bulk-decision-057)。見つからない・値が不正・分割がある明細には、再試行の代わりに理由を出す。要求全体が失敗したときは、選択を残し、文言を role=alert で出す。通信の失敗と 5xx は、書き込まれたかどうかが分からないので一覧と選択の読み出しを読み直し、『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』と出す (qa-classify-bulk-decision-054)。409 (取込みか別の更新が進行中) はサーバの文言を出す (qa-classify-bulk-decision-056)。通信の失敗・5xx・409 の後には『同じ内容で再試行』を出し、押すと直前の要求の本文をそのまま送る (qa-classify-bulk-decision-054・qa-classify-bulk-decision-056)。一括保存は同じ要求を送り直しても最終の状態が変わらないので、二重には保存されない。自動では送り直さない。400・403・413 は送り直しても結果が変わらないので、再試行を出さずにサーバの文言を出す (qa-classify-bulk-decision-055)。
- **G2**: 取込直後でも明細に提案が付くようにする。記憶→ルール→MF 中項目の対応表の後ろに、取込 CSV の分類を使う提案を最後の由来として足す (qa-classify-bulk-decision-042・qa-classify-bulk-decision-040)。区分と所有者は現在の解決値をそのまま使い、信頼度は 60 (MF 中項目の対応表の 70 より下で、要確認の閾値 80 未満) とする (qa-classify-bulk-decision-042・qa-classify-bulk-decision-051)。個人の明細には大項目・中項目をそのまま由来『MF の分類』で付け、根拠文に『MFの分類をそのまま提案』と書く (qa-classify-bulk-decision-042)。集計ルール (取引先) が当たる個人の明細では、ルールを当てた後のカテゴリを提案し、根拠文を集計ルールの名前にする。由来の表示は集計ルールになる。ルールの値が個人のカテゴリの候補に無ければ提案を付けない (qa-classify-bulk-decision-028)。事業の明細には、勘定科目の対応表で大項目から引いた勘定科目を、中項目は空のまま由来『MF の分類 (対応表)』で付け、根拠文に大項目と勘定科目の対応を書く (qa-classify-bulk-decision-040・qa-classify-bulk-decision-052)。勘定科目の対応表に行の無い大項目の事業の明細には付けない (qa-classify-bulk-decision-050)。MF の大項目が空か『未分類』の明細には、個人・事業とも付けない (qa-classify-bulk-decision-039)。提案の付かない明細は、保存前の内訳に『提案なし』とその理由を出す。勘定科目の対応表は利用者ごとに DB の表に持ち、設定画面で行を足し引きする。行は MF の大項目の名前と、勘定科目の一覧から選んだ対応先の 1 組で、同じ大項目は 1 行だけ持つ。初期の行は 通信費→通信費、水道・光熱費→水道光熱費、交通費→旅費交通費、交際費→接待交際費、日用品→消耗品費 の 5 行で、既存の利用者には migration で、新しい利用者には作成時に入れる。中項目で科目が割れるもの (住宅・自動車・食費・教養・教育・特別な支出・税・社会保障・保険)、合う科目が一覧に無いもの (健康・医療・衣服・美容・趣味・娯楽)、振替か意味の無い値 (現金・カード・未分類)、中身を 1 つに決められないもの (収入・その他) の 14 の大項目は、初期の行に入れない (qa-classify-bulk-decision-049・qa-classify-bulk-decision-050)。KPI・ナビのバッジ・月次クローズは既存の 1 か所の関数から数え続ける。
- **G3**: 選択を表示に左右されないものにする。選択 (URL の sel に行の key で持つ、最大 50 件) は絞り込み・ページ・並べ替え・期間を変えても保ち、一括バーの選択一覧は表示外の選択も含めて全件を出す (qa-classify-bulk-decision-043)。分割の内訳行は選べず、チェックの代わりに理由を示す (qa-classify-bulk-decision-034・qa-classify-bulk-delegated-002)。分割の設定が不正な明細の行も選べず、理由『分割の設定を直してから保存してください』を示す (qa-classify-bulk-decision-038)。見出しの全選択は表示中の先頭から 50 件までで止め、止めたことを選択の件数の横に示す (qa-classify-bulk-decision-053)。保存はサーバが選択した明細を引き直し、G1 の順で値を解決する。一覧の応答から絞り込み後の全件を外し、選択の中身は行の key を受ける専用の API で読む (qa-classify-bulk-decision-043・qa-classify-bulk-decision-034・qa-classify-bulk-delegated-002)。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 提案の無い明細を一括指定で保存できる。 | DOM テストで、提案なしの 3 件を選び区分とカテゴリを指定して保存すると、要求に 3 件が入り、通知『選択した3件を保存しました。』が出る。core の単体テストで、指定しない項目が、未整理の明細では下書き→提案、確定済みの明細では下書き→今の値の順で埋まること、区分だけを指定したときは区分が同じ値からカテゴリの組を取り、組が無い明細は『カテゴリなし』で保存の対象に入って保存前の内訳にその件数が出ることを固定する。埋める値が無い行と、確定済みで変わる値が無い行は要求に入らず、保存前の内訳に外す件数と理由が出て、失敗に数えない。core の単体テストで、『カテゴリなし』の明細が、家計の集計と総収支の内訳では未分類に入り、説明可能率では説明できない側に数えられ、分類の状態が手動になることを固定し、いずれも通る。 |
| O2 | 失敗の種類ごとに、再試行の有無と理由が正しく出る。 | DOM テストで、保存前に外した行と、見つからない・値が不正・分割がある明細に再試行が出ないこと、書き込みの失敗 (write_failed) を返した 1 件の再試行でその 1 件だけが送られることを確かめる。要求全体の失敗について、通信の失敗と 5xx の後に一覧と選択の読み出しが読み直されて選択が残り、role=alert の文言が出て、『同じ内容で再試行』が直前の要求の本文をそのまま送ること、409 の後にもサーバの文言と同じボタンが出ること、400・403・413 の後にはサーバの文言が出て選択が残り、再試行が出ないことを確かめ、いずれも通る。 |
| O3 | 取込直後でも明細に提案が付く。 | core の単体テストで、記憶・ルール・MF 中項目の対応表のいずれも無い個人の明細に MF の大項目・中項目の提案が付き、信頼度が 60・根拠文が『MFの分類をそのまま提案』を含むこと、事業の明細には勘定科目の対応表で引いた勘定科目が中項目を空のまま由来『MF の分類 (対応表)』・信頼度 60 で付き、根拠文に大項目と勘定科目の対応が書かれること、勘定科目の対応表に行の無い大項目の事業の明細と、MF の大項目が空か『未分類』の明細には提案が付かないこと、集計ルールが当たる個人の明細ではルールを当てた後のカテゴリが提案されて根拠文が集計ルールの名前になり、ルールの値が個人の候補に無ければ提案が付かないこと、既存の由来の順位と信頼度が変わらないことを固定する。API テストで、勘定科目の対応表の読み出し・追加・削除が利用者ごとに分かれ、設定の変更履歴に残り、新しい利用者に初期の 5 行が入ることを確かめる。DOM テストで、設定画面から勘定科目の対応表の行を足し引きできることを確かめる。設定の JSON とバックアップ・復元で勘定科目の対応表が往復し、勘定科目の対応表を持たない版 1 の設定の JSON と旧いバックアップを読み込むと初期の 5 行になることを確かめ、いずれも通る。 |
| O4 | 選択がページと絞り込みをまたいで保たれ、サーバが値を解決する。 | DOM テストで、1 ページ目で 2 件・2 ページ目で 1 件を選び、絞り込みを変えても選択一覧に 3 件が出て、保存要求に 3 件が入る。内訳行と分割の設定が不正な行にはチェックが無く理由が出ること、表示 100 件で見出しの全選択を押すと 50 件で止まり、止めたことが件数の横に出ることを確かめる。API テストで、表示中の絞り込みに無い明細も、選択の読み出し (行の key) と一括保存 (txId) でサーバが引き直せ、一覧の応答に絞り込み後の全件が含まれないことを確かめ、いずれも通る。 |
| O7 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |
| O8 | 一括保存が無料枠の 1 起動の上限に収まる。 | API テストで D1 へのクエリを数え、50 件・100 件の保存がどちらも 49 本以内であること、書き込みの batch が失敗すると要求が 2xx で返って保存対象の全件が write_failed になることを確かめる。書き込む前に、1 回の batch の文が 50 本を超えるか、束ねた JSON が 2MB を超えると分かった要求は、413 too_many_classify_changes を返して明細ごとの結果を持たず、write_failed にならないことを確かめ、いずれも通る。 |
| O9 | 同じ要求を送り直しても二重に保存されない。 | API テストで、同じ一括保存の要求を 2 回送ると、2 回とも全件が ok で saved と各明細の status が同じであり、明細の値 (更新時刻を除く) と月次集計が 1 回目の後と同じで、履歴の行数が増えないことを確かめ、通る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 一括操作バーに一括指定欄 (区分・カテゴリ大/中・所有者・支払い方法) を足し、保存の前に内訳 (保存する件数と値の出所、そのうち『カテゴリなし』で保存する件数、外す件数と理由) を出す。
- **I2**: POST /api/transactions/bulk を拡張し、一括指定と各明細の下書きを受け取る。サーバは明細を引き直し、core の解決関数で、未整理の明細は 一括指定→下書き→提案、確定済みの明細は 一括指定→下書き→今の値 の順に値を決める。区分に合うカテゴリの組がどこにも無い明細は、明細の編集の大項目の欄に『カテゴリなし』の予約の値を入れて保存する (『カテゴリなし』のための表と列は足さない。qa-classify-bulk-decision-045)。予約の値は core の 1 か所で定め、一括指定と編集の値としては受け付けない (qa-classify-bulk-decision-048)。値を決められない明細と、区分とカテゴリの組が候補に合わない明細は、明細単位の失敗として返す (画面は保存前に外すので、通常は届かない)。書き込みは json_each で束ねた 1 回の batch で行い (qa-classify-bulk-delegated-001)、batch が失敗したら要求を 2xx で返して保存対象の全件を write_failed にする (qa-classify-bulk-decision-057)。同じ要求を送り直しても、明細の値 (更新時刻を除く)・提案との一致 (done か manual か)・月次集計・履歴は 1 回目の後と変わらない。書き込む前に予算 (1 回の batch の文 50 本・束ねた JSON 2MB) を超えると分かった要求は、明細ごとの結果を持たない 413 で返す。
- **I3**: 選択中の行の key (最大 50 件、利用者ごとに分離) を受けて、表示外の明細も含めて一覧の行の形で返す読み出し API を追加し、一覧の応答から絞り込み後の全件を外す。
- **I4**: core の候補の算出に最後の由来を足す。個人の明細には由来『MF の分類』(根拠文『MFの分類をそのまま提案』) を、事業の明細には勘定科目の対応表で引いた勘定科目を由来『MF の分類 (対応表)』(根拠文に大項目と勘定科目の対応) で付け、信頼度はどちらも 60 とする。集計ルールが当たる個人の明細では、ルールを当てた後の値と集計ルールの名前の根拠文にする。
- **I5**: 選択を URL の sel に行の key で持ち、絞り込み・ページ・並べ替え・期間の変更で消さない。一括バーの選択一覧は I3 の API から全件を出す。内訳行と分割の設定が不正な行は選べず理由を出し、見出しの全選択は表示中の先頭から 50 件で止めて知らせる。
- **I7**: 再試行を、書き込みの失敗 (results の ok=false かつ code=write_failed) を返した明細にだけ出し、押すとその txId だけを送る。ほかの失敗には理由を出す。要求全体の失敗は、ApiError の status を 1 つの関数で分け、文言と再試行の有無をそこから引く。通信の失敗と 5xx は一覧を読み直し、通信の失敗・5xx・409 には直前の要求の本文をそのまま送る『同じ内容で再試行』を出し、400・403・413 にはサーバの文言を出す。401 は既存のログイン切れの扱いに従う。
- **I8**: 勘定科目の対応表の表を migration で足し、既存の利用者に初期の 5 行を入れ、新しい利用者の作成時にも入れる。読み出し・追加・削除の API と設定画面の編集を足し、変更を設定の変更履歴に残す (変更履歴の種類の制約は表の作り直しで改め、PR で承認する)。設定の JSON (kanjo-settings) とバックアップ・復元に勘定科目の対応表を加える。
- **I9**: 『カテゴリなし』の予約の値を core の 1 か所で定め、家計の集計・総収支の内訳・説明可能率・分類の状態・候補の検査・履歴・バックアップで、予約の値を未分類と同じ扱いに通す。予約の値と同じ名前のカテゴリの候補は作れなくする。

### 本章に効く確定意思決定

- **decision-005-d1-query-budget**: 一括保存の 1 要求が、Cloudflare 無料プランの「1 起動あたり合計 50 クエリ」を超えます（50 件で 200 本超）。どう解きますか？
  - 採択: 書き込みを束ねる (`bundle-writes`)
  - 目的適合: 明細ごとの編集と履歴を json_each で 1 文ずつに束ね、1 要求は明細数によらず約 25 本になる。選択 50 件も一括 100 件も 1 回で保存でき (G1・G5)、上限と無料プランはそのまま (C4)。
  - 採択の接地根拠: `qa-classify-bulk-decision-033`

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、一括保存の値の解決の置き場所に適用した。『指定した項目は一括指定の値で、指定しない項目は未整理の明細では下書き→提案、確定済みの明細では下書き→今の値の順で埋め、区分とカテゴリは 1 組で決め、区分に合う組がどこにも無い明細は『カテゴリなし』の予約の値で保存し、埋める値が無い行と確定済みで変わる値が無い行は理由を付けて外す』と、提案の最後の由来 (信頼度 60。個人の明細には『MF の分類』、事業の明細には勘定科目の対応表で引いた勘定科目を『MF の分類 (対応表)』で付け、MF の大項目が空か『未分類』の明細と、対応表に行の無い大項目の事業の明細には付けない) は入出力を持たない規則なので core に置く。classify-bulk.ts は明細と勘定科目の対応表を引き、core の結果を既存の applyManualEditWithBase で編集の値に組んで、束ねた書き込みへ渡すだけにする。API Design card の『資源ごとに 1 つの形を返す』は、選択の読み出しが一覧と同じ行の形を返し、一括保存の応答が明細ごとに ok:true か、失敗の code (not_found / invalid_item / split_line_not_supported / no_value / write_failed) の 1 形で返ることに当てた。明細ごとの結果を持たない要求全体の失敗 (400 の 3 種・413 の 2 種・既存の柵の応答) と明細ごとの失敗を分け、明細の値の不正は invalid_item としてその明細の形の中で返すので、1 件の不正で他の明細の結果が失われない。DDD card のユビキタス言語は、由来の名前『MF の分類』『MF の分類 (対応表)』を core の根拠文・API の応答・画面の表示で同じ語に保ち、集計ルールが当たる個人の明細でルールを当てた後の値を提案し根拠文を集計ルールの名前に替えることも、core の候補を作る 1 か所だけで決めることに当てた (qa-classify-bulk-decision-042・qa-classify-bulk-decision-028・qa-classify-bulk-decision-040)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-10-01T10:34:37Z)

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
| hono-validation | 2026-07-21 | Hono (honojs) (hono.dev) | https://hono.dev/docs/guides/validation | 2026-09-30T12:07:03Z | 2026-09-30T12:07:03Z |
| zod-arrays | 3 (v3 ブランチの README。kanjo の lockfile が解決する版は zod@3.25.76) | Colin McDonnell (colinhacks/zod 公式リポジトリ) (github.com) | https://github.com/colinhacks/zod/blob/v3/README.md | 2026-10-01T00:38:24Z | 2026-10-01T00:38:24Z |
| cloudflare-d1-json | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/sql-api/query-json/ | 2026-09-30T12:07:03Z | 2026-09-30T12:07:03Z |
| rfc9110-http-semantics | RFC 9110 (June 2022, Standards Track) | IETF (RFC Editor) (www.rfc-editor.org) | https://www.rfc-editor.org/rfc/rfc9110.html | 2026-10-01T00:19:06Z | 2026-10-01T00:19:06Z |
| hono-body-limit | 2024-07-22 | Hono (honojs) (hono.dev) | https://hono.dev/docs/middleware/builtin/body-limit | 2026-10-01T00:19:06Z | 2026-10-01T00:19:06Z |
