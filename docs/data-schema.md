# データスキーマ

## 入力フォーマット

取り込むファイルの種別は、**ヘッダー行の特定列の有無**で判別する。

| 判別キー | 種別 |
|----------|------|
| ヘッダーに `収支区分` を含む | freee 取引エクスポート |
| ヘッダーに `計算対象` を含む | マネーフォワード 収入・支出詳細 |
| JSON（`{` で始まる） | 本システムの統合JSON |

エンコーディングは UTF-8 を厳格モードで試し、失敗したら Shift-JIS にフォールバックする。`.xlsx` は先頭シートのみ読む。

### freee 取引エクスポート

使用する列：

| 列名 | 用途 |
|------|------|
| `収支区分` | `収入` なら売上、それ以外は経費 |
| `発生日` | 月キー（`YYYY-MM`）へ正規化 |
| `勘定科目` | 経費カテゴリ。`支払手数料`・`通信費` → `サブスク・通信` へ正規化 |
| `金額` | カンマ・¥ を除去して整数化 |
| `取引先` | サブスク・通信のときのみベンダー別集計に使用 |

freeeが複合行を出力すると、2行目以降の`発生日`が空欄になることがある。空欄行は、直前に有効な発生日と同じ収支区分である場合だけ、その日付・取引先・期日・決済口座を継承して別明細として保存する。先頭空欄、収支区分の逆転、不正日付の直後は継承せず棄却し、決済金額は二重計上を避けるため継承しない。

### マネーフォワード 収入・支出詳細

使用する列（`includes` による部分一致で解決）：

| 列名 | 用途 |
|------|------|
| `計算対象` | 原文の判定を保存。`1` 以外も明細として保存するが、収支集計には含めない |
| `振替` | 原文の判定を保存。`1` も明細として保存するが、口座間移動のため収支集計には含めない |
| `日付` | 月キーへ正規化 |
| `金額` | 正＝収入、負＝支出 |
| `大項目` / `中項目` | カテゴリ。仕分けルールのマッチ対象にもなる |
| `内容` | 明細名。仕分けルールのマッチ対象 |
| `ID` | 明細の一意キー(手動編集の同一性キー、後述)。無い場合は `月_行番号_金額` で合成。同じIDが複数行にある場合は最後の行を保存 |
| `保有金融機関` | 明細が属する口座名。設定画面で口座ごとに名義(事業/妻/家族)を対応づけ、名義別集計の根拠にする。列が無い古いエクスポートでは空 |
| `メモ` | 空白を含む原文を明細属性として保存。列欠落は未設定（D1では `NULL`）、空セルは空文字として区別する |

取込結果の件数は次の意味で統一する。入力行と保存行は、同一IDの重複により一致しないことがある。

| 件数 | 意味 |
|------|------|
| `parsed` | 日付を解釈でき、明細へ変換できた入力行。同一IDの重複を含む |
| `stored` | 今回の取込で同一IDを後勝ちに整理して正規保存した行 |
| `countable` | `stored` のうち収支集計に含める行 |
| `nonCountable` | `stored` のうち保存はするが、`計算対象=0` または `振替=1` のため収支集計に含めない行 |
| `rejected` | 日付を解釈できず、明細として保存できない入力行 |

取込成功時は `stored = countable + nonCountable`。既存consumer向けの `rows` / `skipped` は新件数のaliasではなく、旧parserの意味を維持する。MFの `rows` は旧集計有効行（`計算対象=1` かつ非振替）、`skipped` は対象外・振替・保存不能行の合計である。

## 統合JSON（保存形式）

```jsonc
{
  "ownerSchemaVersion": 2,              // canonical名義schema。新規exportは必ず2
  "months": ["2025-01", "..."],          // 全系列の共通インデックス（昇順）
  "biz": {
    "revenue":    [118379, ...],          // months と同じ長さ
    "categories": ["サブスク・通信", ...],
    "expense":    { "サブスク・通信": [39566, ...] }
  },
  "cashOverride": {                       // freee未記帳月の銀行実測
    "2026-07": { "revenue": 748070, "expense": 94973 }
  },
  "subs": {
    "vendors": ["Anthropic", ...],
    "accounts": { "Amazon": ["通信費（原本）"] }, // 支払先ごとのaccount_raw。空/未指定なら全科目
    "matrix":  { "Anthropic": [3124, ...] },
    "other":   [24826, ...]               // vendors に含まれない分
  },
  "personal": {                           // 仕分け後の個人分（mfTx から再生成される）
    "2026-07": { "income": { "給与": 511684 }, "expense": { "食費": 17654 } }
  },
  "bizPersonal": {                        // 個人口座から出た事業分（＝freeeに登録すべき額）
    "2026-07": { "income": 748070, "expense": 94973 }
  },
  "mfTx": [                               // 仕分け対象の生明細
    {
      "id": "...", "idStable": true, "m": "2026-07", "d": "07/31", "c": "内容", "a": -6524,
      "big": "通信費", "mid": "インターネット", "inst": "架空銀行", "memo": "原文メモ",
      "isTarget": true, "isTransfer": false
    }
  ],
  "rules":     [{ "k": "ANTHROPIC", "cls": "biz", "big": null, "mid": null, "owner": null }],  // 先勝ち(属性ごと)。配列の順序が優先順位
  "edits":     { "<明細ID>": { "cls": "biz", "big": "食費", "mid": "食料品", "owner": "business", "baseBig": "未分類", "baseMid": "" } }, // 手動編集(取込値とは別枠)
  "institutionOwners": { "<保有金融機関>": "business" }, // 口座→名義(business=事業 / spouse=妻 / family=家族)
  "overrides": { "<明細ID>": "biz" },                  // 旧形式(edits.cls から導出。復元時の後方互換用)
  "personalByOwner": { "2026-07": { "business": { "income": 0, "expense": 0 }, "spouse": {...}, "family": {...}, "unset": {...} } }, // 名義別の個人分(導出値)
  "cashEntries": [{ "id": 1, "date": "2026-07-15", "month": "2026-07", "side": "per", "io": "expense", "amount": 500, "description": "架空現金", "categoryMajor": "食費", "categoryMid": "食料品", "memo": null }], // API export/夜間backupだけの別枠。restoreは移行先が空かつ予算内のときだけ明細をidごと復元する
  "cashProjection": {                     // sourceで実際に加算済みの確定delta
    "version": 1,
    "basis": "post-resolution",
    "rows": [{ "month": "2026-07", "scope": "per_exp:食費", "amount": 500 }]
  },
  "analysisSettings": { "statMinMonths": 6 }, // durableな分析意図
  "subVendorExclusions": [{ "partner": "架空家賃" }], // 復元可能な候補除外
  "budgets":   { "サブスク・通信": 80000 },
  "unrecordedExpMonths": ["2026-07"],
  "exportedAt": "2026-08-24T..."
}
```

旧JSONで `memo` / `isTarget` / `isTransfer` が欠落している場合は、それぞれ未設定 / `true` / `false` として復元する。新しいexportは3属性を明示し、空セルの `memo: ""` と属性欠落を区別する。

### 不変条件

1. `months` と、`biz.revenue` / `biz.expense[*]` / `subs.matrix[*]` / `subs.other` の**長さは常に一致する**。新しい月を追加するときは、全系列の同じ位置に 0 を挿入する（`ensureMonth`）。
2. `personal` / `bizPersonal` / `personalByOwner` は `mfTx` + `rules` + `edits` + `institutionOwners` から**導出される**。手で編集せず、常に再計算する（`applyClassification`）。
3. `rules` はDBの `(sort_order ASC, id ASC)` をcanonical total orderとし、**属性(公私 / 科目 / 名義)ごとに**その属性を持つ最初のマッチを採用する。JSONではこの順序を配列順として保存する。

## 入力元中立の支出投影

`freee_deals`と`mf_transactions`は入力元のcanonicalとして分けたまま保持し、画面向けの支出照合とサブスクは現在有効な行から都度導出する。`data.mfTx`へ投影された手入力現金(`cash:*`)はMF未記帳と呼ばず、この投影から除外して既存の現金台帳へ任せる。永続行や取込指紋を書き換えないため、取込取消・期間/種別削除・全件入れ替え・30日undoの結果へ自動追従する。

- `帳簿確定`: freeeの支出から`事業主貸`を除いた事業経費。税務の正本。
- `未記帳`: MFで実効公私判定が`biz`かつ、freeeと自動照合されていない支出。
- `実質支出`: 帳簿確定 + 未記帳。入力元を無条件には足さない。
- 自動照合: MF安定IDがあり、非分割で、用途・日付・絶対金額・支払先の厳格キーが一致する1対1だけ。厳格キーはNFKC・大小文字・空白だけを吸収し、法人格や記号は落とさない。
- 要確認: 複数候補、日付/支払先/用途の不一致、分割、不安定IDは統合しない。過少計上を避け、確認中のMF支出も実質支出へ含める。
- サブスク: 登録支払先の集計と未登録候補の採点を、照合後の実質支出から行う。対象科目はfreeeの`account_raw`、MFの大項目・中項目・`大項目/中項目`のいずれも指定できる。

## サブスク支払先の対象科目と候補除外

- `sub_vendors.accounts`(TEXT, JSON配列, 既定 `'[]'`)は、その支払先を**その原本科目名(`account_raw`)で記帳されたときだけ**サブスクに数える安定参照。空配列なら従来どおり全科目を数える。旧normalized labelは読取互換し、正規化map更新時にrawへ展開する。同名rawと衝突して解釈が曖昧な場合は、そのraw自体を保ちながら旧labelに属する全rawも残す。
- `matchSubVendor(partner, vendors, account?)` は**先に科目で候補を絞ってから**名前・エイリアスを照合する。科目を渡さない呼び出し(候補一覧の「登録済みか」判定など)は絞り込みを行わない。
- `sub_vendor_exclusions (user_id, partner, vendor_key)` は「これはサブスクではない」と記録した支払先。候補表示に効くdurable intentで、backup/restore/fingerprint対象。行を消せば除外は取り消せる。

## 状態分類（正本）

| 状態 | 例 | backup / restore | fingerprint | cache・lease・保持 |
|---|---|---|---|---|
| canonical原本 | freee/MF、cash、rules、edits、budgets、owners、norm map、sub vendors | 対象（freee原本はCSV再取込） | 実効write-set | `monthly_agg`を無効化しwriter lease下で永続保持 |
| durable intent | `analysis_settings`、`sub_vendor_exclusions` | 対象・移行先と非破壊merge | 対象 | JSON pointerを同batchで無効化し永続保持 |
| derived cache | `monthly_agg`、JSON active pointer | 原本から再生成 | 対象外 | mutationで無効化、再計算可能 |
| 外部原本 | 取込原本、夜間バックアップ、改善要望の画像 | 取込・復旧・改善要望それぞれの経路で管理 | 取込原本以外は対象外 | R2で用途別prefixと保持期間を管理 |
| disposable UI | filter、開閉、未保存draft | 対象外 | 対象外 | 画面/セッション内のみ |

## 手動編集(オーバーライド)の設計

### 同一性キー

明細の同一性キーは **MF エクスポートの `ID` 列**(`tx_id`)。根拠: MF の `ID` は明細ごとに MF 側で採番される固定値で、再エクスポートしても同じ明細は同じ `ID` で出る(実データで確認済み)。日付+金額+内容の組は同日同額の外食などで重複するため使えない。`ID` 列が無い古いエクスポートだけ `月_行番号_金額` の合成IDになり、その場合は行の並びが変わると編集が外れる(設定画面の「手動で編集した明細」で「取込値が変わった/明細なし」として検出できる)。

MF側で `ID` が振り直された場合の第二の引き当てキー(`stable_key`)と、`base_major`/`base_mid` を4属性へ広げた3点比較の契約は `specs/import-deletion-and-override-reapply.md` が持つ。同一性キーの第一は常に `tx_id` のまま。

### 保持の仕方(D1)

| テーブル | 役割 |
|---|---|
| `mf_transactions` | 取込値そのもの。再取込で**全置換**される(手で書き換えない) |
| `tx_edits` | 明細ごとの手動編集。`cls`(公私)/`category_major`/`category_mid`/`owner`(名義)を個別に持ち、未指定は NULL。`base_major`/`base_mid`/`base_cls`/`base_owner` は編集時点の取込値(4属性それぞれの食い違い検出用、`base_cls`/`base_owner` は0030)。既存行の base は NULL のまま入り、「基準が分からない」を表す。次の再取込で3点比較より**前**に取込値を埋める(D6 の遅延 backfill)。`stable_key`/`fingerprint_version` は `tx_id` が取れないときの第二の引き当て鍵(0030、UNIQUE にしない)。手当ての中身(`cls`/`category_*`/`owner`)は再取込で**触らない**が、鍵のほうは同じ backfill で毎回いまの版へ入れ直す。backup からの復元では**版が今と一致する鍵だけ**を戻す(版違いは照合に使われないので運ばない)。`origin`/`origin_key`(0031)は `vendor_memory` が自動適用した行だけに明示し、NULL/既存行は安全側の手動編集として値一致から由来を推測しない |
| `rules` | キーワードルール。`cls`/`category_major`/`category_mid`/`owner` を任意の組み合わせで持てる(いずれか1つ以上) |
| `institution_owners` | `保有金融機関` → canonical名義(`business`/`spouse`/`family`)。未設定は行を持たず、`unset`は集計時だけ導出 |
| `category_options` | 候補科目の追加分。`scope`(`biz`=事業/`per`=家計)で系統を持つ(0002 マイグレーション)。取込値由来の候補と合わせて候補一覧になる |
| `ai_tasks` | AI分析の依頼(0003)。`period_kind`(`month`/`year`)+`period_key`、使い捨てトークンの SHA-256(`token_hash`、原文は保存しない)、`expires_at`(24時間)、`used_at`(結果受信で確定=1回きり)、`report_id` |
| `ai_reports` | AIから届いた分析レポート(0003)。`body_json` は固定5節(`spend`/`change`/`reduction`/`split`/`subscriptions`)+`dataGaps` を無害化済みのプレーンテキストで保持。明細は含まない(集計値と本文だけ)。`archived_at` は片付け用(0018)で、入れると既定の一覧から外れるだけで本文は消えない |
| `analysis_settings` | AI分析の統計指標の基準月数(0019)。利用者ごとに1行だけ持ち、`stat_min_months`(3〜24、既定6)を保存する。記帳の正本には触れないため、変更しても集計スナップショットの作り直しは要らない |
| `overrides` | 旧テーブル。`tx_edits` へ移行済み(読み取りは `tx_edits` のみ) |
| `cash_entries` | 現金の記帳(0006、ID非再利用は0007、交通費は0010/0011)。口座・カード明細に出ない現金の受け渡しを明細として持つ。`id` は `AUTOINCREMENT` で削除後も再利用しない。`transit_from/to`は支出で対にし、`receipt_waived`は区間がある場合のみ許可する。取込値とは別テーブルなので再取込で消えない |
| `password_login_rate_limits` | Access未設定時のpassword login throttle(0014)。`scope_hash`には`CF-Connecting-IP`のnamespace付きSHA-256だけを持ち、raw IP/password/headerは保存しない。`window_started_at` / `failure_count` / `locked_until` / `updated_at`をatomic UPSERTし、成功時は対象scopeだけDELETEする |
| `restored_monthly_agg` | JSON復元由来で原本明細から再導出できない月次集計のbaseline(0007)。`monthly_agg`(現在値の派生キャッシュ)と分離し、同月の現金明細の増減で失わない |
| `import_runs` / `imports` | 0008以降、前者はmultipart request/session、後者はそのlogical unit/attempt。状態は`processing`→`applying`→`committed`、または`failed`/`duplicate`で、理由は`failure_reason`へ分離する。全unitを最初に作成し、unitのterminal更新と同じbatchでrunをunit状態から再計算する。旧履歴の`ok`/`error: ...`は表示互換のため残すが、新規処理は生成しない |
| `import_writer_claims` | 利用者ごとの取込writer claim。受理前にCAS獲得してから正規化map/canonical snapshot/query計画を読み、計画と実行の世代を同じwriter区間へ固定する。拒否時はrunを作らずreleaseする。crashで解放されなくても15分後に新runが回復し、同じ回復batchで旧run配下の`processing`/`applying` unitだけを`failed`へCAS更新して旧runを再計算する。受理前は`run_id`に対応する`import_runs`がまだ無いことが正しいためFKは付けない。claimはTTL/明示releaseで消える一時調整データで、監査正本ではない |
| `import_active_targets` | 現在適用中の取込指紋。CSVは`freee:YYYY-MM`/`mf:YYYY-MM`、JSONは`json:global`をキーにし、過去履歴とは分離する |
| `imports.content_hash` / `duplicate_of` | 取込単位のversion付き内容指紋。現在の全targetが同じ指紋の場合だけ`duplicate`でスキップし、そのactive取込IDを`duplicate_of`に持つ |
| `import_deletion_operations` | 削除のundo lifecycle metadata(0030)。`granularity`、期限内の範囲再現用`request_json`、preflightの`fingerprint`、件数、`undone_by`、`expires_at`を持つ。`import_deleted_rows` / `import_deleted_targets`と同じ30日後に有界掃除する一時メタデータであり、監査の正本ではない |
| `import_deleted_rows` | 消した行そのものの退避(0030)。消す**前**に必ず書く(DR-2)。`payload_json` に全列を持ち、undoはこれをINSERTし直すだけで済む。`month` は集計を作り直す対象月(DR-5)。undo専用で、画面・ログ・エラー応答のどれからも中身を出さない。`(operation_id, table_name, row_id)` がUNIQUEで、undoの二重INSERTをDB側で止める |
| `import_deleted_targets` | 削除で巻き戻す取込指紋の退避(0030、DR-4)。`import_active_targets` は現行の指紋しか持たず履歴が無いため、削除前の`content_hash`/`import_id`/`updated_at` をここへ写す。粒度が明細ではなく対象キーなので `import_deleted_rows` と分ける(同居させると5,000行の削除で同じ指紋を5,000回複製する) |
| `vendor_memory` | 取引先ごとの「いつもの手当て」(0030)。`vendor_key` は core の `normalizeVendorKey` で表記ゆれを寄せた照合キー、`vendor_label` は表示専用。確信度は1つの数で持たず `hit_count` / `disagree_count` を別々に持つ(「1件中1件」と「40件中40件」を区別するため)。`pinned` は件数によらず当てる、`revoked` は以後当てない・候補にも出さない。`(user_id, vendor_key)` がUNIQUE |
| `r2_cleanup_jobs` | R2のexact keyを有界に削除する共通outbox(0038)。`purpose`は`import_original`または`retired_attachment`という起点・観測ラベルであり、安全境界には使わない。夜間`r2_cleanup`は最大3件ずつ処理し、Release A中は旧2表のlate writeも先に冪等回収する。同じkeyのneutral jobが`dead`になった後のlate writeだけは`retry`へ戻し、既存`pending/retry`の試行回数とbackoffは保持する。共有keyの全`imports`参照が30日超かつfailed/duplicate/完全supersededで、same-key active pointerが無い場合だけ1jobを自動enqueueする。全jobがR2 DELETE直前に同じ共有key契約を再評価し、active・30日以内・不正時刻・processing/partial/applying/旧statusが1rowでもあればR2と全`imports.r2_key`を保持し、退役metadataとcleanup intentだけを同じD1 batchで閉じる。削除可能ならR2成功後の同じD1 batchで全`imports.r2_key`をNULLにし、退役metadata・全intentも閉じる。bucket scanは行わない |

現在はRelease Aであり、migration head、schema guard、local previewの適用上限はいずれも
`0038_prepare_r2_cleanup.sql`である。0038は共通outboxを追加し、旧`attachments.r2_key`と
`attachment_cleanup_jobs`の削除intentを`r2_cleanup_jobs`へ退避するexpand migrationである。
旧台帳の`dead`も`retry`へ戻して共通processorの再処理対象にする。旧機能専用の6テーブル
（`attachments`、`attachment_cleanup_jobs`、`attachment_object_tombstones`、
`receipt_source_profiles`、`receipt_source_overrides`、`tax_account_settings`）は物理D1に互換データとして
残り得るが、runtime/API/Drizzleの現行定義からは退役済みであり、このactive schema一覧には載せない。

物理削除は将来の別変更であるRelease Bが担う。Release Bはcleanupの`pending` / `retry` / `dead`と
旧`attachments` / `attachment_cleanup_jobs`の残件がすべて0であることを機械ゲートで確認した後にだけ0039を新規追加する。現行repositoryに0039は含めない。
`0010`〜`0028`は適用履歴なので書き換えない。`cash_entries.receipt_waived`は交通費入力の
互換フィールドとして残り、領収書・証憑の保管機能が存在することを意味しない。
Release A/Bの適用順序・復旧契約は
[`CI/CD・本番運用ガイド`](ci-cd-operations.md#63-列を削除する場合contract)を唯一の正本とする。

password login throttleの既定は15分window / 5回目から15分lock / 7日後stale cleanupで、
1 requestは成功・失敗とも最大2 D1 queries。nightly scheduledは`updated_at`のindexから
最大100件を1 queryで消去する。夜間7 jobの同一invocation予算は中央SSOTで46 queries
（backup 1 + R2 cleanup 20 + password throttle 1 + improvement 3 + undo 12 + audit header 3 + audit detail 6）
に固定し、backupを先に確定して残る6 jobを並列実行する。全jobを記録後、1件でもjob-level rejectなら
内容を含まないgeneric errorをCronへ返す。
validation、安全なfallback、非secret override名は`packages/api/src/login-rate-limit.ts`を正本とする。

### 名義schema v2

- 保存・新規exportで認める名義は `business`(事業) / `spouse`(妻) / `family`(家族)の3値だけ。`unset`は口座やルールから名義を解決できない明細の導出bucketであり、D1に名義値として書かない。
- 旧JSON入力の `self` だけは `business` へ正規化する。口座名義のnull/空値は「対応なし」として行を作らない。それ以外の未知ownerはD1書込み前に400で拒否する。
- migration 0009は `rules` / `tx_edits` / `institution_owners` を新CHECKで再構築し、旧 `self` を `business` へ移す。JSONの意味表現が変わるため `json:global` active pointerだけを無効化し、次回のrestoreで現行canonical指紋を再確立する。

### 有効値の決め方(属性ごとに独立)

| 属性 | 優先順位(左が強い) |
|---|---|
| 公私 | 手動編集 > ルール > 既定(`個人`) |
| 大項目/中項目 | 手動編集 > ルール > 取込値。**大項目+中項目は1組**で置き換える(大項目だけ指定しても取込値や別ルールの中項目は引き継がない) |
| 名義 | 手動編集 > ルール > 口座の名義(`institution_owners`) > 未設定 |

- 食い違い: `tx_edits.base_major/base_mid` と現在の取込値が異なるとき「取込値が変更」として表示する(編集値はそのまま有効)。
- 名義は **推測で割り振らない**。口座の名義が未設定・保有金融機関が空の明細は「未設定」として集計し、画面で件数と解決先(設定画面)を出す。
### 科目候補の二系統(会計上あり得ない組み合わせを作らないため)

| 公私 | 候補の出どころ | 中項目 | 意味 |
|---|---|---|---|
| 事業(`biz`) | freee 取引の `勘定科目`(`freee_deals.account_raw` の distinct)+ `category_options(scope='biz')` | なし | 決算書(青色申告決算書)に載る科目 |
| 個人(`per`) | MF 明細の `大項目`/`中項目` の実在する組 + `category_options(scope='per')` | あり | 家計の内訳 |

- 候補は取り込んだデータから作り、**推測で科目を創作しない**。データに無い科目は仕分け画面の編集欄または設定画面から系統を指定して追加する(`category_options`)。
- 明細の科目編集・科目付きルールは、編集後の公私に対する候補に無い科目を **サーバーで拒否**する(`invalid_category` 400)。科目付きルールは公私の指定が必須(`rule_needs_cls`)。
- 公私を後から変えて候補から外れた明細は `scopeMismatch` として画面に「科目が公私と不一致」を出す(値は消さない)。
- freee の `品目` 列は任意入力で取込対象外のため、事業側に中項目は設けない(必要になれば `品目` を中項目として取り込む: 残課題)。
- 候補科目の削除は、手動編集・ルール・現金明細がそのoptionに依存中なら 409 で件数を返し、明示(`force`)でのみ削除する。raw MF/freeeまたは他optionが同じ科目を供給する場合は依存と数えない。個人の中項目なしは大項目を供給する最後のoptionだけに依存する。名前変更はこの依存consumerのみへ連動する。
- `tx_edits.cls` が NULL の手動編集は、対応するMF/現金明細を `手動cls > ルール > 既定(per)` で解決した実効scopeにだけ依存させる。対応明細がなくscopeを解決できない編集と `cls` なし科目ルールは、別scopeのoptionを誤更新しないため、どのscopeのrename/delete依存にも数えない。

- 事業/個人の区分の根拠: 事業側は freee の取引(売上・経費)、個人側は MF 明細のうち仕分け(手動 > ルール > 既定=個人)で `個人` になったもの。

## 現金の記帳(cash_entries)の合流先

| 区分 | 合流先 | 仕組み |
|---|---|---|
| 事業(`biz`) | 科目別集計(`monthly_agg` の `biz_rev` / `biz_exp:{科目}`)・サブスク行列 | freee 仕訳と同じ形(`FreeeDeal`)に変換し、`applyFreeeDeals` に freee 原本と一緒に流す(`recomputeFromDeals` と取込の freee 経路)。科目の正規化も同じ対応表を使う |
| 家計(`per`) | MF 明細(`mfTx`)に `id='cash:{id}'`, `inst='現金'` として合流 | 仕分け(手動 > ルール > 既定)・名義・家計集計は通常の明細と同じ扱い。`applyMfTxs` の月単位洗い替え、統合JSONの写し(`exportJSON`)、`persistRestore` は `cash:` を除外する |

- 現金の記帳しか無い月は「未記帳月」を解除しない(freee の記帳が済んでいない月として扱う)。
- 原本freee/MFが無い復元月は `restored_monthly_agg` をbaselineとし、`baseline + 現在のcash_entries` を `monthly_agg` へ再生成する。同月に原本がある場合は原本を正とし、baselineは加算しない。
- 適用済みmigrationは不変とする。0006は現金明細/指紋だけを追加し、0007が`restored_monthly_agg`とAUTOINCREMENT再構築を追加する。旧`monthly_agg`の自動baseline移行は、事業scopeでは同月`side='biz'`現金とfreee原本、個人/bizPersonal scopeでは同月`side='per'`現金とMF原本が無い場合だけ行う。反対domainの現金だけなら安全なbaselineを移行し、同domainのprovenance不明値は二重固定しない。
- API exportと夜間バックアップは、`monthly_agg`を使わず、baseline・freee/MF原本・rules・edits・owners・sub vendors・norm map・cash・budgets/override等を単一D1 read statementで取得する。同じcanonical snapshotから集計と、監査用raw `cashEntries`、source側で解決済みの `cashProjection` v1 (`basis='post-resolution'`) を一度だけ生成する。行はcanonical `month/scope`ごとに集約・決定順とし、export集計を超えるdeltaなら出力を失敗させる。
- restore/JSON取込は、有効な`cashProjection`の確定deltaを集計から厳密に差し引く。そのうえで移行先に`cash_entries`が1件も無い初期移行のときだけ、backupの`cashEntries`をidごと復元して同じdeltaを戻す(`cash:<id>` editの宛先を維持するため採番し直さない)。49 query予算に載らない場合は記帳だけ見送り、応答の`cashSkipped`で件数を返す。移行先に記帳があるときは復元せず`cashKept`で件数を返す。destination側の設定では再投影しない。未知version/basis/scope、重複行、欠落、非正整数、集計を超えるdeltaは書込み前に400とし、0へのclampで隠さない。有効な空rowsは正常。`cashProjection`なしで`cashEntries`が非空ならsource semantics不明として拒否し、両方なし（または空cashEntries）のpre-cash legacyだけ互換受理する。
- restoreではJSON source内の `cash:*` edit/overridesを破棄する。同一DBに既存cashがある場合は、その現存IDに対応するdestination側の既存editだけをcandidateへ戻し、永続化行・集計・指紋をすべてそのcandidateから生成する。これにより、新DBで後から同じIDが採番されてもbackup由来editが誤付着しない。

## 明細の分割記帳(tx_splits)の投影先

`tx_splits`(migration 0025) は1件のMF明細を用途ごとの内訳へ分ける保存形式。列は
`id / user_id / tx_id / line_id / seq / parent_amount / amount / cls / category_major / category_mid / memo / created_at / updated_at`、
一意制約は `(user_id, tx_id, seq)` と `(user_id, line_id)`。

- **合計＝親金額はDB制約ではなくアプリで検証する。** SQLiteに行間合計の制約を置くと、1行ずつのUPDATEが必ず途中で不整合になる。保存はPUTで全行入れ替えの1トランザクションとし、検証は `validateSplits` 1箇所に集約する。
- `line_id` はUUIDv4。子行の同一性は採番順(`seq`)から独立して維持する。並べ替えても編集の宛先が動かない。
- `parent_amount` は保存時点の親金額の写し。再取込で親金額が変わったことを、内訳を見るだけで検知するために持つ。

| 区分 | 合流先 | 仕組み |
|---|---|---|
| 集計(家計・名義別・事業立替) | `personal[月].expense[科目]` / `personalByOwner` / `bizPersonal` | `projectAccountingDataset` が `applySplits` で親1行を内訳N行へ置き換え、`recomputeClassification` を投影後に走らせる。子行は `projectedEdit` に `cls`/`big`/`mid` を持ち、`resolveTx` が `t.projectedEdit ?? edits[t.id]` の順で先に読む(仕分けの経路を増やさない) |
| freeeの科目別金額 | **合流しない** | 科目別の正本はfreee帳簿(`data.biz.categories`)。MF側の分割は「事業立替の合計」までを持つ。ここを合流させると同じ支出をfreeeと二重計上する |
| 取込計画(下見) | 合流しない | `withSplits:false` のraw canonical Datasetを使う(`classify.ts` の候補算出、`imports.ts` の取込計画)。親と派生子を混ぜたまま洗い替え判定をしない |

- 合計不一致・`parent_amount` 不一致・`line_id` 重複・`identity_stable=0` のいずれかで、内訳は集計へ出さず親の金額のまま数える(fail-closed)。無かったことにはせず `splitProjection.state` を `amount_conflict` / `identity_unstable` として画面へ返す。
- 統合JSONは canonical な親行(`raw.mfTx`)を保存し、投影後の子行は保存しない。子行は表示・集計専用の派生である。

## 仕分けルールの順序契約

- 全consumer（明細解決、hit count、候補科目usage/rename/delete guard）は共通loaderの `sort_order ASC, id ASC` を使う。DBにルールが無い場合の既定fallbackも同loader境界で一元化する。
- `PATCH /rules` は当該利用者の全rule IDを一度ずつ含む完全順列だけを受理する。partial・duplicate・unknown・他利用者IDは書込み前に400とし、成功時は0始まりの連番へ正規化する。

## 取込の重複検知(content_hash)

- v4指紋はtype+length prefixの衝突しないcanonical encodingを使う。freeeは保存行の`月/日付/収支/取引先/原本科目/正規化科目/金額`、MFは共通の完全射影`ID/月/正規化したYYYY-MM-DD/内容/金額/大項目/中項目/口座/メモ原文/計算対象/振替/ID安定性`を、parser・指紋・commit builder・JSON復元が共有する。JSONはraw payloadではなく、partial/default/merge後の実効的な保存行をhashする。`exportedAt`等のmetadata、非永続subs aliases、監査用`cashEntries`は除外するが、実際に永続化・集計に使うdestination `cash:*` editは含める。旧指紋とは互換比較せず、移行後の最初の1回だけ通常取込になる。
- MFのID列が無い旧exportは復元用IDが行index依存である。`mf_transactions.identity_stable=0`とし、行順を変えたファイルは別内容として扱う。MFのID列から読み込んだ行だけを1とする。
- 過去ever-seenではなく現在有効なtargetだけを比較する。同月A→B→AはforceなしでAを再適用し、A→Aだけを`duplicate`にする。`force=1`は現在有効なcommitted世代を意図的にもう一度適用するときだけ使う。
- 別途、月ごとの取込前後の件数(`replaced`)を返し、減っていれば画面で「月の途中までのファイルではないか」を知らせる(既存どおり月単位で洗い替えるため)。
- 明細を消すときは `import_active_targets` の現行指紋の巻き戻しと必ず対で行う。指紋が残ったまま明細だけ消えると同じファイルが `duplicate` で弾かれ、消したものを戻せなくなる。削除の粒度・退避・監査は `specs/import-deletion-and-override-reapply.md`。

## 取込のcommit/部分成功契約

- 同一利用者のrequestはwriter claimで直列化する。同一multipart内の同domain×month重複、およびJSONと他unitの併用は、R2/D1への副作用前に400で拒否する。
- R2はD1 transaction外なので、先にrun/unitと`r2_key`を作ってから保存する。R2または実行時の失敗はunit/runを`failed`に残す。同じ入力の通常再試行を`duplicate`扱いせず、回復できる。stale takeoverは旧runの未完了unitも同じ回復境界で閉じる。
- unit内部はD1 `batch()`でcanonical原本、復元baseline、`monthly_agg`、active target、unit terminal marker、run reconcileを一括確定する。応答喪失やcommit直後crashでもunitからrunを再計算でき、`committed` unit + 未完runを正規状態にしない。unit間はpartial successを許し、完了済unitは残し、失敗unitだけ再試行可能にする。
- CSVの大量行はJSON1 `json_each` のUTF-8 80KiB payloadへ分割し、1行1 DELETE/INSERTを行わない。`import_id`・`user_id`・確定時刻等の実行時値は行JSONへ埋め込まずscalar bindへ分離するため、受理前sentinelと実attempt IDの桁数でchunk数は変わらない。routeは実commit builderが作るpayload/cache/active/finalizationのstatement数と、read/claim/attempt/heartbeat/reconcile/release・duplicate/失敗/commit応答喪失回復のworst-caseを合算し、49 queriesまでだけ受理する。受理後は実attempt IDでR2保存前にbuilderを再構成し、各commit直前にも`actual statements <= planned statements`を検査する。通常幅の5,000行freee/MFは50未満だが、同じ5,000行でも長大な列や大量のcache scope、複数unitで予算を超える場合は、R2/run/canonical書込み前に413で拒否する。各queryは100KB未満で、行payloadは1つのJSON bindへ集約する。

- `import_runs`/`imports`は取込監査の正本として**自動では**削除しない。利用者が明示した「履歴を削除」だけは、`failed`/`duplicate` であり、active target・canonical行・undo退避の参照がすべて0件のattemptに限って履歴を削除する。最後の参照ならR2原本を共通cleanup ledgerへ登録し、共有中なら原本を保持する。操作事実は明細・ファイル名・R2 keyを含まない`import_discard`監査ヘッダとして400日保持する。自動保持では、共有R2 keyを参照する全rowが30日超の`failed`/`duplicate`/完全supersededになった後だけexact keyを削除し、同keyの全`imports.r2_key`をNULLにする。期限付きclaimへ永続履歴と同じFK/保持規則を適用しない。
- JSONのactive pointerは、`cash_entries`/`rules`/`tx_edits`/`institution_owners`/`budgets`/`account_norm_map`/`unrecorded_months`/`cash_overrides`/`sub_vendors`/freee・MF原本/復元baselineの変更と同じD1 batchで無効化する。JSON restore自身は新pointerをcommit batchで設定するため、設定変更後の同じJSONは再適用、無変更の連続取込だけが`duplicate`になる。
- multipart JSONと`POST /restore`は同じrestore commit builderと状態遷移を使う。JSONはMF原本の含有月を洗い替え、rules/edits/institution owners/budgets/cash override/復元baseline/未記帳月を置換し、sub vendor名は追加する。freee原本と現存現金用editは保持する。現金明細は移行先が空かつ予算内のときだけ復元する。`POST /restore`は直接JSON bodyを受けるためR2原本を作らない。

## 取込データの削除と退避の保持(0030)

契約の正本は `specs/import-deletion-and-override-reapply.md`。ここには保存側の帰結だけを書く。

### 消す対象は「取り込んだ複製」だけ

- 削除は `mf_transactions` / freee原本 / `import_active_targets` と、それに紐づく手当て(`tx_edits` / `tx_splits`)にだけ及ぶ。freee・マネーフォワード側のデータは書き換えない。
- **`balance_entries` / `cash_entries` は `import_id` を持たない。持たせない。** どちらも取込ではなく利用者が手で入れた記帳だからで、外部キーを1本足した瞬間に「取込を消したら手入力の残高・現金も消える」経路ができる。この2つは削除の巻き添えにならないことを、preflightの確認画面へ `手で記帳した現金 0件(取込の削除では消えません)` と0件で明示する(DR-6)。0件を出さずに黙って除外すると、消えないことを利用者が確認できない。
- 退避の書込は削除より**前**に置く(DR-2)。逆順にすると、退避の途中で落ちたときに「消えたが戻せない」行が残る。

### 退避の保持は30日と300MBの二段構え(D7)

| 値 | 実装の定数 | 根拠 |
|---|---|---|
| 30日 | `DELETION_UNDO_RETENTION_DAYS` | D1のTime Travelが遡れる7日より長い。その差の23日ぶんは退避テーブルが唯一の回復手段になる |
| 300MB | `DELETION_TOMBSTONE_BUDGET_BYTES` | D1 単一データベース上限 500MB の 60% |
| 50件/回 | `DELETION_RETENTION_BATCH` | 1回のWorker呼び出しあたりのD1クエリ本数を50本未満に収めるための分割単位 |

- 掃除は既存の夜間 Cron (`scheduledMaintenance`) へ相乗りさせ、新しい Cron を増やさない。実装は `packages/api/src/deletion-retention.ts`。
- 先に到達した側で古い世代から掃除する。期限切れを片づけてなお300MBを超える場合だけ、期限内の退避を `expires_at` の古い順に前倒しで捨てる。期限内のものへ手を付けるのは最後の手段である。
- **掃除済みの旗は持たない。** 期限切れの `import_deletion_operations` を世代の根とし、退避行・target・metadataを同じ有界掃除で消す。容量による前倒しではundo payloadだけを捨て、期限表示用metadataは30日まで保つ。
- 「いつ何を消したか」の正本は400日保持の `audit_log`。`GET /api/data/operations` もこれを読み、期限内のdeleteだけundo metadata/退避物をjoinして `undoable` を作る。
- 期限切れでmetadataが消えた操作、または容量前倒しで退避だけが消えた操作は `undoable:false` になる。`POST /api/data/undo/:id` は長期監査ヘッダが残る場合410、他利用者または未知のIDは404にする。
- 削除1行につき退避1行の書込が加わり rows written を二重に消費する。1日あたりの削除対象は5万行以内を前提に運用を始める。

### 操作ヘッダと判定明細は別層で保持する(0033 / D8)

| 層 | 保存内容 | 保持 | 容量時の扱い |
|---|---|---:|---|
| `audit_log` | 1操作1行の user / operation / action / scope / counts / occurred_at / result | 400日 | 期限掃除のみ |
| `audit_log_detail` | 不透明tx key、1判定属性、before/after、理由コード、不透明source key | 90日 | 300MB以上で期限前の古い行も有界掃除 |

- 両表とも明細本体・金額の列を持たない。detailの属性は `cls` / `category_major` /
  `category_mid` / `owner` の4種だけで、before/afterは120文字、理由コードは64文字に制限する。
- `buildAuditStatements` はヘッダ1文と属性明細のまとめ書き文を返す。呼び出し側はdelete / undo /
  import-resolutionの正本変更と同じD1 batchへ追加し、返された`queryCount`を既存plannerの予算に足す。
- `runAuditHeaderRetention` / `runAuditDetailRetention` / `runDeletionRetention` はそれぞれ別のjobとして
  `scheduledMaintenance`から呼び、層別の前後行数・概算byte・掃除件数・query数を別々に記録する。
- 容量は明細値をWorkerへ読み出さず、D1内で列のUTF-8 byte数と固定overheadを合算する。
  1回の掃除は最大80行・6 queriesで打ち切り、残りは次回が拾う。

### `vendor_memory` の確信度(D4)

- `confidence = hit_count / (hit_count + disagree_count)`。列としては持たず、引くたびに2つの件数から作る。
- 自動適用は `hit_count >= 3` かつ `confidence >= 0.80` の両方を満たす場合だけ(実装の定数は `VENDOR_MEMORY_MIN_HITS` / `VENDOR_MEMORY_MIN_CONFIDENCE`)。満たさないものは候補提示に留める。`pinned` は件数によらず当て、`revoked` は候補にも出さない。
- 閾値の段階的な上下(可動域 0.70〜0.95)の基準は仕様書のD4に置く。判定はD1内の算術で閉じ、明細を外部へ送らない(DR-14)。
- 画面へは割合ではなく件数で出す。「40件中40件」と「1件中1件」を同じ 1.00 として見せないため。
