# 明細仕分けの一括保存と取引一覧 (classify) — 実装要件

- Feature: `feat-classify-bulk-save`
- Package: `feature-package/feat-classify-bulk-save`
- Handoff target: `task-graph`
- Snapshot: `sha256:a5d2c7f929b6151f15a49a0531f9ea9292a2a26204ca8c486fc99bb62318403e`(`.dev-graph/state/graph.json` の bytes、graph revision 3)
- System plan: `sha256:601543e1e9b218f5bfd0154e5e887113b4621fa8bd5dac9543062d77e1bde286`
- Readiness: **PASS**(missing sections 0、3 gate が同一 snapshot)

契約の正本は `specs/spec-classify-bulk-save.md` である。本書が持つのは、要件と system task の対応と、requirements 段階で見つけた指摘だけである。実装コードも task spec も生成しない。13 task の内容は `.dev-graph/plans/feature-package-feat-classify-bulk-save/task-specs/` を正本とし、本書はそれを書き換えない (published digest を保つ)。

## 目的

明細仕分け画面で選んだ明細を、提案の有無や表示中のページ・絞り込みに左右されずに、何がどの値で保存されるかを確かめたうえで一括で確定できるようにする。取込直後で取引先の記憶もルールも無い利用者でも未整理を月次クローズまで減らせるようにし、『選んだのに保存できない』『再試行を押しても何も起きない』『一覧が崩れて読めない』ことで仕分けが止まるのを無くす。

## 到達状態

/classify で、提案の無い明細も一括指定欄で値を決めて保存でき、保存前の内訳で保存する件数と外す件数を確かめられる。選択は URL の sel に行の key で保たれ、サーバが明細を引き直して 1 回の batch (D1 クエリ 49 本以内) で書き、再試行は write_failed の明細と要求全体の失敗 (通信の失敗・5xx・409) にだけ出る。取込直後でも『MF の分類』の提案が付き、勘定科目の対応表を設定画面で編集でき、取引一覧は 1264px でも 6 列で崩れない。lint・typecheck・test・skills:test・初期 JS 予算・verify:full は緑のまま。

## requirements 段階の決定

本 feature では requirements 段階で新たに決めた事項は無い。goal-spec の open_items は 8 件で、spec の未決事項 1〜7 を OI-1〜OI-5 に、plan の段階で見つけた着手前提 (migration の番号・CI の画面検査・D1 のクエリ数) を OI-6〜OI-8 にまとめ、担当 task へ割り当て済みである。利用者の判断が要る細部 (OI-1・OI-4) は、P05 が案と判断の依頼文を docs/classify-screen/bulk-save-decisions.md に書き、feature PR の本文で判断を仰ぐ。requirements 段階で見つけた範囲外のテストとの食い違い (RQ-F1) は、値を決めずに P02 の設計の制約として渡す。

## 実装要件

### REQ-CB-001 一括指定の値を core の 1 つの解決関数で決める

packages/core に一括指定の解決関数を 1 つ置き、画面とサーバの一括保存 API が同じ関数を通す。今は画面の `resolveBulkItem` (`view-model.ts:309-327`) と `inputFromRow` (`:98-100`) が別々に値を埋めている (FR-05)。未整理の明細は 下書き→提案、確定済みの明細は 下書き→今の値 の順で埋める。支払い方法は `row.edit.paymentMethod` を使い、無ければ送らない (FR-02・BR-01)。区分とカテゴリは 1 組で扱う。区分だけを指定したときは同じ区分の組を取り、組が無ければ『カテゴリなし』にする。大だけを指定して系統が合わない明細は外し、理由『指定したカテゴリ (大) が明細の区分に合いません』を返す (FR-03・BR-02・BR-03)。埋める値の無い行と、確定済みで変わる値の無い行は要求に入れない。外す件数と理由を返し、失敗には数えない (AC-04)。

- 根拠: FR-02 / FR-03 / FR-05 / BR-01 / BR-02 / BR-03 / AC-02 / AC-03 / AC-04 / O1
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P03`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P08`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-002 一括指定欄と保存前の内訳

一括操作バーに一括指定欄 (区分・カテゴリ大・中・所有者・支払い方法) を置く。中は大を選ぶまで選べず、『カテゴリなし』は候補に出さない (FR-01)。保存の前に 選択 = 保存 + 外す + 見つからない の内訳を出し、外す行は理由ごとに件数を示す (FR-04)。内訳は REQ-CB-001 の core の関数から導き、画面で別に数えない。保存に成功したら『選択した{n}件を保存しました。』を出す (AC-01)。

- 根拠: FR-01 / FR-04 / AC-01 / AC-04 / O1
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-003 一括保存 API (POST /api/transactions/bulk) の 1 回の batch・予算・冪等

`POST /api/transactions/bulk` は次の順で処理する。zod で本文を検証する。サーバが明細と勘定科目の対応表を引き直す。core の解決関数で値を決める。D1 の予算を測る。json_each で束ねた 1 回の batch で書く (FR-06)。1 要求の D1 クエリは 50 件・100 件とも 49 本以内に収める (D1 の上限は 50 本、書き込みは約 25 本。AC-27)。batch は 50 文・2MB・bound parameter 100 以下にする。上限の定数は今 4 か所 (`import-lifecycle.ts:305`・`scheduled-maintenance-budget.ts:13`・`classify.ts:90`・`classify-bulk.ts:44`) にあり、これを 2 つの名前へまとめる。一括は 1〜100 件で、txId の重複は 400。下書きは 60 字・200 字で検証し、違反は invalid_item (BR-11・BR-12)。書く前に予算の超過が分かる要求は、`planClassifyMutation` (`classify.ts:98-114`) と同じ検査で 413 too_many_classify_changes を返し、results を持たない (AC-28)。今の `classify-bulk.ts:191` の例外と `:195-203` の丸め、`chunkByItem` (`:177`) はやめる。履歴は変わった項目ごとに source=bulk と op_id で 1 行ずつ書き、変わらない明細は 0 行 (BR-13・AC-26)。同じ要求を 2 回送っても、値・月次集計・履歴は変わらず、取引先の記憶も書かない (BR-14・AC-29)。そのため `disagreeOriginKey` は渡さない (`classify-history.ts:178`・`:189`)。応答は `{results, opId, saved, failed}` で、result の code は not_found / invalid_item / split_line_not_supported / no_value / write_failed。本文は bodyLimit 256KB で、超えたら 413 payload_too_large (AC-24)。値の欄を持つ旧形式の item も受け付ける。

- 根拠: FR-06 / BR-11 / BR-12 / BR-13 / BR-14 / AC-06 / AC-24 / AC-26 / AC-27 / AC-28 / AC-29 / O6 / O8 / O9
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P03`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P08`、`SYS-CLASSIFY-BULK-P10`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-004 選択を sel に保ち、GET /api/transactions/selected で読み出す

選択は URL の sel に行の key で持ち、ページ・絞り込み・表示件数を変えても残る (FR-07・AC-18)。選択は 1〜50 件 (BR-11)。内訳行には理由『分割後の内訳は「内訳を編集」からまとめて変更してください』(`classify.ts:406`) を出す。分割の設定が不正な行には『分割の設定を直してから保存してください』を出し、どちらもチェックを置かない。split_line_not_supported の文言 (`classify-bulk.ts:133`) は変えない (FR-08・AC-19)。見出しの全選択は 50 件で止め、『上限の 50 件で止めました』を件数の横に出す。今は `TransactionTable.tsx:84` で黙って切っている (FR-09・AC-20)。`GET /api/transactions/selected?keys=` は keys を 1〜50 件で受ける。重複は 400 invalid_query にする。形の違う key と 200 字を超える key は missing に入れる。応答は `{rows, missing}` で、行は `buildClassifyRow` (`classify-row.ts:43`) と同じ形。bound parameter 100 以内で引く (FR-10・AC-21)。

- 根拠: FR-07 / FR-08 / FR-09 / FR-10 / BR-11 / AC-18 / AC-19 / AC-20 / AC-21 / O4
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P03`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P08`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-005 一覧 API の応答の整理と、取引一覧の 6 列

一覧 API (`classify.ts:253`) の応答から `transactions` (`:389` の matched) を外し、rows・total・page・limit を返す。limit は 25 / 50 / 100 で、既定は 50。今は 50 だけ (`:195-200`、PAGE_LIMIT は `:163`)。画面は queryKey (`ClassifyPage.tsx:89-93`) に limit を含め、`ClassifyPage.tsx:106` の transactions の利用をやめる。transactions を見ている API テスト 8 本 (split-lifecycle・import-diff・cash-lifecycle・vendor-memory・row-transfer-lifecycle・classify-transactions-shape・classify-list-paging・total-cashflow-verdict) は rows へ移す (FR-11)。取引一覧は 6 列 (選択・日付・取引先/内容の 2 段・金額・提案カテゴリ・信頼度) にし、表示件数とページ送りを付ける。今は 7 列 (`TransactionTable.tsx:74-104`) で、表示件数は `:67` で、ページ数は `:51` で 50 に固定されている (FR-12)。編集パネルは可変幅にし、1264px で 1 字ずつ折り返さない (FR-13)。画面検査は KANJO_VISUAL_SCOPE=classify で 1264px と 1280px を撮り、記録を docs/classify-screen/ に置く (FR-19・AC-22)。今の ci.yml はこの画面検査を走らせないので、手元の verify:full で確かめる (OI-7)。

- 根拠: FR-11 / FR-12 / FR-13 / FR-19 / AC-22 / O4 / O5
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P09`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-006 MF の分類の提案と、勘定科目の対応表 (migration 2 本)

記憶もルールも無い明細にも、MF の分類から提案を信頼度 60 で付ける。個人の明細は『MF の分類』で、MF の大項目・中項目と根拠文『MFの分類をそのまま提案』を付ける (BR-06)。事業の明細は『MF の分類 (対応表)』で、勘定科目を付け、中項目は空にする (FR-14・BR-07)。この由来は順位の最後に置き、衝突の判定を働かせない。既存の由来の順位と信頼度 (`classify-status.ts:86-88` の 95・85・70) と、要確認の閾値 80 (同 `:43`) は変えない (BR-05・AC-15)。集計ルールが当たる個人の明細は、ルールを当てた後のカテゴリで付け、ルールの値が候補に無ければ付けない (AC-14)。対応表に行の無い事業の大項目、空か『未分類』の大項目、内訳行には付けない (BR-08・AC-13)。`classifySuggestion` (`classify-status.ts:279`) の呼び出しは 6 か所 (`overview.ts:254`・`:339`、`classify-row.ts:52`・`:151`、`classify-bulk.ts:155`、`classify.ts:514`) にある。その入力の組み立てをまとめ、`legacyBasisLabel` (`overview.ts:265`) を消し、basisLabel は残す。`RecommendationBasis` (`overview.ts:199`) は `SuggestionBasis` (`classify-status.ts:143`) の別名にする (RQ-F1 の制約に従う)。勘定科目の対応表は (user_id, 大項目) で一意な新しい表に置く。行の勘定科目は `TAX_ACCOUNTS` (`core/src/tax-accounts.ts:42`) の 32 件から選ぶ (BR-09)。初期の 5 行 (通信費→通信費、水道・光熱費→水道光熱費、交通費→旅費交通費、交際費→接待交際費、日用品→消耗品費) を入れる (BR-10・AC-16)。API は GET / POST / DELETE にする。書き込みは canonicalMutationFence を通す。対応表の行と settings_change_log (`schema.ts:412`、origin は screen / restore / migration) は 1 batch で書く。対応表は設定画面から足し引きできる。設定の JSON は版 2 (`settings-json.ts:14`・`:19`) にし、バックアップとともに往復させる。版 1 の JSON と旧いバックアップを読むと、対応表は初期の 5 行になる (FR-17・AC-17)。migration は 2 本 (本 package では 0059・0060)。settings_change_log の CHECK を作り直す破壊的な変更は、migration-approvals.json に sha256 で承認を置く。あわせて `EXPECTED_D1_MIGRATION` (`schema-guard.ts:4`) を上げる。API のパスと表・列の名前は未決 (OI-2)、番号の衝突は OI-6 で確かめる。

- 根拠: FR-14 / FR-17 / BR-05 / BR-06 / BR-07 / BR-08 / BR-09 / BR-10 / AC-11 / AC-12 / AC-13 / AC-14 / AC-15 / AC-16 / AC-17 / O3
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P03`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P08`、`SYS-CLASSIFY-BULK-P12`、`SYS-CLASSIFY-BULK-P13`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-007 再試行と、要求全体の失敗の扱い

再試行は、write_failed を返した明細と、要求全体の失敗 (通信の失敗・5xx・409) にだけ出す (FR-15)。write_failed の明細には『失敗した{K}件のみ再試行』を出し、押すとその明細だけを送る (AC-06・AC-07)。通信の失敗と 5xx では、一覧と選択の読み出しを読み直し、選択を残す。role=alert で『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』と『同じ内容で再試行』を出し、押すと直前の本文をそのまま送る (AC-08)。409 はサーバの文言と『同じ内容で再試行』を出す (AC-09)。400・403・413 はサーバの文言だけを出し、再試行は出さない (AC-10)。ApiError (`api-client.ts:2`) の status は 1 つの関数で分ける (FR-16)。今の catch (`ClassifyPage.tsx:167-173`) と、item が null になって押しても何も起きない再試行 (`ClassifyPage.tsx:178`・`:420`・`:142-147`) を置き換える。

- 根拠: FR-15 / FR-16 / AC-06 / AC-07 / AC-08 / AC-09 / AC-10 / O2
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-008 『カテゴリなし』の予約の値を core の 1 か所に置く

『カテゴリなし』の予約の値を core の 1 か所に置き、tx_edits.category_major に入れる。家計の集計・総収支の内訳・説明可能率では、未分類・説明できない側に数え、分類の状態は手動とする (FR-18・AC-05)。一括指定で予約の値を直接送る要求と、予約の値と同名の候補の作成は、400 で拒む (`settings.ts:496`。BR-04・AC-23)。KPI・バッジ・月次クローズの判定は既存の 1 か所の関数を通し、別の数え方を足さない (BR-15)。予約の値の字面は未決 (OI-3)。

- 根拠: FR-18 / BR-04 / BR-15 / AC-05 / AC-23 / O1 / O6
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P02`、`SYS-CLASSIFY-BULK-P04`、`SYS-CLASSIFY-BULK-P05`、`SYS-CLASSIFY-BULK-P06`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P10`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

### REQ-CB-009 認可・非機能・品質ゲート・証跡・文書・配信

一括保存・選択の読み出し・対応表の API は、未認証を 401、フェンスの拒否を 403 にする。他の利用者の key・txId・対応表の行は、見つからない扱いにして存在を明かさない (AC-23・AC-25)。表示は design-tokens を使って hex を直書きせず、色だけで区別しない。通知は role=status / role=alert で読み上げる。初期 JS 予算 110KiB は、build:bundle の直後に check:js-budget で測る (`packages/web/package.json:15`)。lint・typecheck・test・skills:test・初期 JS 予算・verify:full (`package.json:40`) は全て exit 0 にする (AC-30)。税務の正本は freee のままで、費用は無料枠に収める。仕上げは次の task が担う。P10 は独立レビュー、P11 は証跡の索引を作る。P12 は data-schema と architecture へ対応表を記録し、未決事項の閉じ方を残す。P13 は 1 つの PR で配信し (migration を Deploy の前に適用する)、本番の /classify で確かめる。

- 根拠: AC-23 / AC-25 / AC-30 / O6 / O7 / 非機能 (表示・a11y・JS 予算・品質ゲート・税務・費用)
- 担当 task: `SYS-CLASSIFY-BULK-P01`、`SYS-CLASSIFY-BULK-P03`、`SYS-CLASSIFY-BULK-P07`、`SYS-CLASSIFY-BULK-P09`、`SYS-CLASSIFY-BULK-P10`、`SYS-CLASSIFY-BULK-P11`、`SYS-CLASSIFY-BULK-P12`、`SYS-CLASSIFY-BULK-P13`
- Source: `specs/spec-classify-bulk-save.md`、`features/feat-classify-bulk-save.md`

横断の task: `SYS-CLASSIFY-BULK-P10` は独立レビュー (認可・上限・本文の大きさ・予約の値・差分の範囲。全要件の横断)。`SYS-CLASSIFY-BULK-P11` は証跡の索引 (設計・テスト・受入・品質・レビューの記録を 1 か所から辿る。全要件の横断)。

## 着手前提と持ち越し事項

handoff を止める不足 (missing sections) は 0 件である。次の事項は未決のまま持ち越し、各担当 task の着手時に確かめる。推定のまま confirmed にしない。

### plan の open_items(goal-spec.json)

| ID | 内容 | 状態 | 是正担当 |
|---|---|---|---|
| OI-1 | spec の未決事項 2: 利用者がまだ確かめていない細部 (表示件数の既定 50 件・選択の key の上限 200 字・一括保存の旧形式の受け付け)。章の値で実装する。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P05 / SYS-CLASSIFY-BULK-P12 |
| OI-2 | spec の未決事項 5: 勘定科目の対応表の API のパスと表・列の名前。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P02 / SYS-CLASSIFY-BULK-P05 / SYS-CLASSIFY-BULK-P12 |
| OI-3 | spec の未決事項 6: 『カテゴリなし』の予約の値の字面。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P02 / SYS-CLASSIFY-BULK-P05 |
| OI-4 | spec の未決事項 7: 新しい持ち主 (user_id) へ初期の 5 行を入れる時機。今のコードに新しい持ち主を作る経路が無い。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P05 / SYS-CLASSIFY-BULK-P12 |
| OI-5 | spec の未決事項 1・3・4: 章の旧い文言 18 か所、C07 の low・info 3 件、C06 の medium 2 件。本書の契約には影響しない。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P12 / spec 担当 (次の system-spec 改訂) |
| OI-6 | 本 feature の migration の番号 (spec では 0058・0059、本 package では 0059・0060) が並行するサイクルと衝突しうる (git の衝突には出ない)。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P05 / SYS-CLASSIFY-BULK-P08 / SYS-CLASSIFY-BULK-P13 |
| OI-7 | 今の ci.yml は明細仕分けの画面検査を走らせない。CI が緑でも AC-22 は確かめられない。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P06 / SYS-CLASSIFY-BULK-P13 |
| OI-8 | 一括保存の 1 要求は D1 のクエリを 49 本以内に収める (50 件・100 件とも)。 | 未決 (unresolved_precondition) | SYS-CLASSIFY-BULK-P04 / SYS-CLASSIFY-BULK-P05 |

閉じ方は goal-spec.json の各 note を正本とする。

### system-spec の完了評価・plan の評価から持ち越した指摘

| ID | 重大度 | 内容 | 状態 | 是正担当 |
|---|---|---|---|---|
| CF-C06-medium-2 | medium | C06 (軸 2・N3) が qa-classify-bulk-decision-018 と 024 を medium とした。どちらも確定セルの主たる qa_ref ではなく、aspect-criteria 1a により PASS に残す注記である。qa の問文は凍結されていて、追記では消えない。本書の契約に影響しない。OI-5 として次の system-spec 改訂へ持ち越し、P12 が記録する | 追跡中 (OI-5) | SYS-CLASSIFY-BULK-P12 |
| CF-low-7 | low | low 7 件。C06 軸 2 の 5 件 (decision-023・027・060・065・071)、軸 4 の maintenance-ops-web-001 のトレース、C07 n-2 (置き換え済みの qa の残存)・n-3 (関連区分の qa_refs の欠け)、章の旧い文言、利用者が確かめていない agent-inference の細部、C06 の判定の周ごとの揺れ。いずれも結論は変えない。章の旧い文言と C07 は OI-5、agent-inference の細部 (表示件数の既定 50 件・key の上限 200 字・旧形式の受け付け) は OI-1 が追跡する。C06 の判定の揺れはプラグインの改善案として報告する。残りは記録だけ | 追跡中 (OI-5・OI-1) | SYS-CLASSIFY-BULK-P12 / spec 担当 (次の system-spec 改訂) |
| PF-followup-wording | info | P13 の task spec (phase-13:97) の『直しは別の feature として起こす』は、run-system-dev-plan の契約語『follow-up feature candidate として返す』に揃えるとより厳密になる (任意)。task spec は published digest を保つため書き換えない。P13 の運用で follow-up feature candidate として返す読み方をとる | 記録 | SYS-CLASSIFY-BULK-P13 |
| PF-round4-recheck | info | 4 周目の low 2 件 (p04_renumber_parenthetical_mismatch・p13_post_merge_acceptance_vs_done) が解消した。コード参照と在庫の再確認も変化なし。plan の評価 (verdict PASS) で確認済み | 解消 | なし (記録のみ) |
| PF-readiness-repin | info | main の取り込みの後に readiness を取り直し、plan の digest を旧 dae7fc67… から 601543e1… へ結び直した。readiness の pin は 13f5da18…。本書の作成時にも pin が今のファイルと一致することを取り直して確かめた | 解消 | なし (記録のみ) |

完了評価の medium は確定セルの主たる根拠ではなく、評価は PASS である。重複を避けるため、OI と同じ事項は OI 側で追跡する。

### requirements 段階で見つけた指摘

| ID | 重大度 | 内容 | 是正担当 |
|---|---|---|---|
| RQ-F1 | medium | 範囲外の core テスト 2 本 (`packages/core/test/overview-recommendation-contract.test.ts`・`packages/core/test/overview-close-status.test.ts`) が今の形を固定している。固定しているのは 3 点: `classifySuggestion` と `recommendationFor` の 4 引数の呼び出し (recommendation-contract `:55-56`、close-status `:312`〜`:338`。core の tsconfig は include src,test なので typecheck も落ちる)、短い basisLabel『過去 10 件中 9 件』(recommendation-contract `:91`、close-status `:316`)、MF の大項目しか無い個人の明細 mf-same-old の basis 'none' (close-status `:329`・`:338`)。spec の互換 (`:664-665`) は、/review-queue の `recommendationFor` が通る `overview.ts:254`・`:339` を含む 6 か所の入力をまとめ、legacyBasisLabel を消す。spec は FR-14 の適用範囲を明細仕分けの経路に限っていないので、MF の分類を載せた入力を 6 か所すべてに通すと、この 2 本が落ちる (requirements 段階の推論)。P02 は、4 引数の呼び出しがそのまま通る形で入力の組み立てを設計する (例: 追加の入力は省略できる末尾の 1 引数にする)。MF の分類を /review-queue (recommendationFor) にも出すかは P02 で決め、既存の期待と矛盾するなら適用を明細仕分けの経路に限る。basisLabel は legacyBasisLabel を消した後も同じ字面で出す。範囲外のテストは書き換えず、P03 が照合する。web の overview-review-queue.dom.test.tsx はモックなので影響しない | SYS-CLASSIFY-BULK-P02 / SYS-CLASSIFY-BULK-P05 |
| RQ-F2 | info | spec の `path:行` は a63d35c の現物で、#75 の後にずれた。index.ts の fence は :112/:114/:116 (spec は :111/:113/:115)、route の mount は :129 から (spec は :128〜)、D1_FREE_QUERY_LIMIT は import-lifecycle.ts:305 (spec は :304)、aggregateReplacementQueries は store.ts:2041 (spec は :1937)、EXPECTED_D1_MIGRATION は schema-guard.ts:4 で 0058 (spec は 0057)。spec は凍結のまま。task spec は今の行を引き、P05 の Entry step (phase-05:30) が着手時に取り直す。訂正は phase-01:31 のとおり P01 が docs/classify-screen/bulk-save-decisions.md に記録し、次の system-spec 改訂へ回す | SYS-CLASSIFY-BULK-P01 / SYS-CLASSIFY-BULK-P05 |
| RQ-F3 | info | registration receipt の graph_digest_after は canonical JSON の sha256 で、本書の snapshot (bytes の sha256) と方式が違う。値の違いは drift ではない。handoff に graph_canonical_digest を併記し、登録時の値と一致することを検算した | なし (記録のみ) |

## 実行グラフ

13 nodes は P01→P13 の直列で、依存は直前の 1 件だけ、root は P01 である。状態・資源・lineage は各 task の frontmatter (`tasks/feat-classify-bulk-save/sys-classify-bulk-pNN.md`) を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-CLASSIFY-BULK-P01 | 一括保存の要件の棚卸し: FR・BR・AC と未決事項の担当 phase の確定 | — |
| SYS-CLASSIFY-BULK-P02 | core の解決関数・行の key・D1 上限の名前・対応表の API と表の名前・『カテゴリなし』の字面の設計 | SYS-CLASSIFY-BULK-P01 |
| SYS-CLASSIFY-BULK-P03 | 設計の照合: spec・architecture 8 本・既存コードとの食い違いと重複の確認 | SYS-CLASSIFY-BULK-P02 |
| SYS-CLASSIFY-BULK-P04 | 解決関数・一括保存・選択の読み出し・一覧・対応表・migration・画面のテストを先に書き、旧実装で落ちることを確かめる | SYS-CLASSIFY-BULK-P03 |
| SYS-CLASSIFY-BULK-P05 | core の解決関数と『カテゴリなし』・一括保存と選択の読み出しと一覧 API・勘定科目の対応表と migration 2 本・取引一覧と一括操作バーと設定画面・check:classify-screen の実装 | SYS-CLASSIFY-BULK-P04 |
| SYS-CLASSIFY-BULK-P06 | 全テストと verify:full の実行: 緑の確認と、落ちたときの原因の切り分け | SYS-CLASSIFY-BULK-P05 |
| SYS-CLASSIFY-BULK-P07 | 受入の確認: AC-01〜AC-30 の根拠の表と、sel に 50 件を選んだ状態の再現 | SYS-CLASSIFY-BULK-P06 |
| SYS-CLASSIFY-BULK-P08 | 参照の消えた旧い定義の削除と migration の突き合わせ: 番号・承認の sha256・EXPECTED_D1_MIGRATION の一致 | SYS-CLASSIFY-BULK-P07 |
| SYS-CLASSIFY-BULK-P09 | 品質ゲート: lint・typecheck・test・skills:test・初期 JS 予算・security:content | SYS-CLASSIFY-BULK-P08 |
| SYS-CLASSIFY-BULK-P10 | 独立レビュー: 認可・上限・本文の大きさ・予約の値・差分の範囲 | SYS-CLASSIFY-BULK-P09 |
| SYS-CLASSIFY-BULK-P11 | 証跡の索引: 設計・テスト・受入・品質・レビューの記録を 1 か所から辿れるようにする | SYS-CLASSIFY-BULK-P10 |
| SYS-CLASSIFY-BULK-P12 | 文書の同期: data-schema と architecture への対応表の記録と、未決事項の閉じ方の記録 | SYS-CLASSIFY-BULK-P11 |
| SYS-CLASSIFY-BULK-P13 | リリース: merge 前の最終確認、deploy.yml での migration の適用、本番の /classify での確認 | SYS-CLASSIFY-BULK-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0(graph revision 3) |
| C02 saved state | spec・architecture 8・feature と 13 task がいずれも confirmed / pass / complete。spec・architecture・feature の source_lineage は今のファイルの sha256 と一致。13 task の source_digest は validated_digest と一致 |
| validate-system-plan | pass、P01..P13、`sha256:601543e1e9b218f5bfd0154e5e887113b4621fa8bd5dac9543062d77e1bde286`、violations 0 |
| C08 implementation readiness | complete、pin `sha256:13f5da18256ca31f2b00f2b67a79e882332ac7e3b841f46575a884e6257ed4f4` を今のファイルから取り直して一致 |

task artifact (md) 13 件は plan の段階で graph の task node の値と task-spec 本文から投影した。graph.json は書き換えていない (revision 3 のまま。canonical digest `sha256:f656dca626cefe52385a61274fd59b97fc918807c6e78593b3453c5dd7621455` は登録時の値と一致する)。
