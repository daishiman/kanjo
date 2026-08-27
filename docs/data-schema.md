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

### マネーフォワード 収入・支出詳細

使用する列（`includes` による部分一致で解決）：

| 列名 | 用途 |
|------|------|
| `計算対象` | `1` 以外の行はスキップ |
| `振替` | `1` の行はスキップ（口座間移動は収支ではない） |
| `日付` | 月キーへ正規化 |
| `金額` | 正＝収入、負＝支出 |
| `大項目` / `中項目` | カテゴリ。仕分けルールのマッチ対象にもなる |
| `内容` | 明細名。仕分けルールのマッチ対象 |
| `ID` | 明細の一意キー(手動編集の同一性キー、後述)。無い場合は `月_行番号_金額` で合成 |
| `保有金融機関` | 明細が属する口座名。設定画面で口座ごとに名義(事業/妻/家族)を対応づけ、名義別集計の根拠にする。列が無い古いエクスポートでは空 |

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
    { "id": "...", "m": "2026-07", "d": "07/31", "c": "内容", "a": -6524, "big": "通信費", "mid": "インターネット" }
  ],
  "rules":     [{ "k": "ANTHROPIC", "cls": "biz", "big": null, "mid": null, "owner": null }],  // 先勝ち(属性ごと)。配列の順序が優先順位
  "edits":     { "<明細ID>": { "cls": "biz", "big": "食費", "mid": "食料品", "owner": "business", "baseBig": "未分類", "baseMid": "" } }, // 手動編集(取込値とは別枠)
  "institutionOwners": { "<保有金融機関>": "business" }, // 口座→名義(business=事業 / spouse=妻 / family=家族)
  "overrides": { "<明細ID>": "biz" },                  // 旧形式(edits.cls から導出。復元時の後方互換用)
  "personalByOwner": { "2026-07": { "business": { "income": 0, "expense": 0 }, "spouse": {...}, "family": {...}, "unset": {...} } }, // 名義別の個人分(導出値)
  "cashEntries": [{ "id": 1, "date": "2026-07-15", "month": "2026-07", "side": "per", "io": "expense", "amount": 500, "description": "架空現金", "categoryMajor": "食費", "categoryMid": "食料品", "memo": null }], // API export/夜間backupだけの別枠。restoreは明細を復元しない
  "cashProjection": {                     // sourceで実際に加算済みの確定delta
    "version": 1,
    "basis": "post-resolution",
    "rows": [{ "month": "2026-07", "scope": "per_exp:食費", "amount": 500 }]
  },
  "budgets":   { "サブスク・通信": 80000 },
  "unrecordedExpMonths": ["2026-07"],
  "exportedAt": "2026-08-24T..."
}
```

### 不変条件

1. `months` と、`biz.revenue` / `biz.expense[*]` / `subs.matrix[*]` / `subs.other` の**長さは常に一致する**。新しい月を追加するときは、全系列の同じ位置に 0 を挿入する（`ensureMonth`）。
2. `personal` / `bizPersonal` / `personalByOwner` は `mfTx` + `rules` + `edits` + `institutionOwners` から**導出される**。手で編集せず、常に再計算する（`applyClassification`）。
3. `rules` はDBの `(sort_order ASC, id ASC)` をcanonical total orderとし、**属性(公私 / 科目 / 名義)ごとに**その属性を持つ最初のマッチを採用する。JSONではこの順序を配列順として保存する。

## 手動編集(オーバーライド)の設計

### 同一性キー

明細の同一性キーは **MF エクスポートの `ID` 列**(`tx_id`)。根拠: MF の `ID` は明細ごとに MF 側で採番される固定値で、再エクスポートしても同じ明細は同じ `ID` で出る(実データで確認済み)。日付+金額+内容の組は同日同額の外食などで重複するため使えない。`ID` 列が無い古いエクスポートだけ `月_行番号_金額` の合成IDになり、その場合は行の並びが変わると編集が外れる(設定画面の「手動で編集した明細」で「取込値が変わった/明細なし」として検出できる)。

### 保持の仕方(D1)

| テーブル | 役割 |
|---|---|
| `mf_transactions` | 取込値そのもの。再取込で**全置換**される(手で書き換えない) |
| `tx_edits` | 明細ごとの手動編集。`cls`(公私)/`category_major`/`category_mid`/`owner`(名義)を個別に持ち、未指定は NULL。`base_major`/`base_mid` は編集時点の取込値(食い違い検出用)。再取込では**触らない** |
| `rules` | キーワードルール。`cls`/`category_major`/`category_mid`/`owner` を任意の組み合わせで持てる(いずれか1つ以上) |
| `institution_owners` | `保有金融機関` → canonical名義(`business`/`spouse`/`family`)。未設定は行を持たず、`unset`は集計時だけ導出 |
| `category_options` | 候補科目の追加分。`scope`(`biz`=事業/`per`=家計)で系統を持つ(0002 マイグレーション)。取込値由来の候補と合わせて候補一覧になる |
| `ai_tasks` | AI分析の依頼(0003)。`period_kind`(`month`/`year`)+`period_key`、使い捨てトークンの SHA-256(`token_hash`、原文は保存しない)、`expires_at`(24時間)、`used_at`(結果受信で確定=1回きり)、`report_id` |
| `ai_reports` | AIから届いた分析レポート(0003)。`body_json` は固定5節(`spend`/`change`/`reduction`/`split`/`subscriptions`)+`dataGaps` を無害化済みのプレーンテキストで保持。明細は含まない(集計値と本文だけ) |
| `overrides` | 旧テーブル。`tx_edits` へ移行済み(読み取りは `tx_edits` のみ) |
| `cash_entries` | 現金の記帳(0006、ID非再利用は0007、交通費は0010/0011)。口座・カード明細に出ない現金の受け渡しを明細として持つ。`id` は `AUTOINCREMENT` で削除後も再利用しない。`transit_from/to`は支出で対にし、`receipt_waived`は区間がある場合のみ許可する。取込値とは別テーブルなので再取込で消えない |
| `attachments` | 証憑メタデータ(0010、identity/lifecycleは0011、原本・親の単調factは0012)。添付先を`target_kind`(`cash`/`mf`)+`target_key`で型付き保存する。原本バイトはR2のみ |
| `attachment_cleanup_jobs` | R2/D1非transaction境界の耐久cleanup ledger(0012)。R2操作前のintent、対象key、理由、再試行時刻・回数・定型errorを持ち、既存nightly scheduledと手動DELETEが同じprocessorを使う |
| `password_login_rate_limits` | Access未設定時のpassword login throttle(0014)。`scope_hash`には`CF-Connecting-IP`のnamespace付きSHA-256だけを持ち、raw IP/password/headerは保存しない。`window_started_at` / `failure_count` / `locked_until` / `updated_at`をatomic UPSERTし、成功時は対象scopeだけDELETEする |
| `restored_monthly_agg` | JSON復元由来で原本明細から再導出できない月次集計のbaseline(0007)。`monthly_agg`(現在値の派生キャッシュ)と分離し、同月の現金明細の増減で失わない |
| `import_runs` / `imports` | 0008以降、前者はmultipart request/session、後者はそのlogical unit/attempt。状態は`processing`→`applying`→`committed`、または`failed`/`duplicate`で、理由は`failure_reason`へ分離する。全unitを最初に作成し、unitのterminal更新と同じbatchでrunをunit状態から再計算する。旧履歴の`ok`/`error: ...`は表示互換のため残すが、新規処理は生成しない |
| `import_writer_claims` | 利用者ごとの取込writer claim。受理前にCAS獲得してから正規化map/canonical snapshot/query計画を読み、計画と実行の世代を同じwriter区間へ固定する。拒否時はrunを作らずreleaseする。crashで解放されなくても15分後に新runが回復し、同じ回復batchで旧run配下の`processing`/`applying` unitだけを`failed`へCAS更新して旧runを再計算する。受理前は`run_id`に対応する`import_runs`がまだ無いことが正しいためFKは付けない。claimはTTL/明示releaseで消える一時調整データで、監査正本ではない |
| `import_active_targets` | 現在適用中の取込指紋。CSVは`freee:YYYY-MM`/`mf:YYYY-MM`、JSONは`json:global`をキーにし、過去履歴とは分離する |
| `imports.content_hash` / `duplicate_of` | 取込単位のversion付き内容指紋。現在の全targetが同じ指紋の場合だけ`duplicate`でスキップし、そのactive取込IDを`duplicate_of`に持つ |

### 証憑原本・親・cleanupの永続fact

`attachments.state`は操作の互換状態であり、原本の所在そのものではない。D1の永続factは削除進捗と
再試行を表す。wireの表示・件数・原本linkは応答生成時のexact-key R2 HEAD結果と組み合わせて導出し、
診断errorや過去のD1観測だけで現在の物理存在を断定しない。

| 永続値 | 意味・不変条件 |
|---|---|
| `attachments.object_deleted_at` | NULLはWorkerによるR2 DELETE成功をまだ記録していないこと、非NULLはR2 DELETE成功済みであることを示す単調なD1 fact。NULLは帯域外欠損を否定せず、物理存在の保証ではない。いったん記録した時刻はNULLへ戻さない |
| `attachments.parent_missing_at` | MFのstable `tx_id`が月洗替え後の親集合から消えた時刻。同IDが再出現した場合だけNULLへ戻す。親なしでもmetadataと原本は保持し、孤児管理画面から閲覧・削除できる |
| `attachments.cleanup_dead_letter_at` | 共通cleanup processorが最大試行回数以上かつgrace経過後に停止した時刻。原本の所在とは独立し、運用者が件数だけを観測する |
| `attachment_cleanup_jobs.action` | `delete_object` / `delete_metadata`。R2 DELETE成功後はmetadata整理へ単調に進む |
| `attachment_cleanup_jobs.reason` | `upload_intent` / `attachment_delete` / `import_retention`。POST補償、明示削除、期限切れ取込原本を同じprocessorへ集約する |
| `attachment_cleanup_jobs.state` | `pending` / `retry` / `dead`。`not_before`、`attempts`、`last_error`を持ち、全bucket scanなしの有界batchで処理する |
| `attachment_object_tombstones` | 明示的な`attachment_delete`完了後だけ残す単調fact。古いarchiveによる削除済みmetadataの復活を防ぐ。upload補償・import retentionには作らず、不要な永久行を増やさない |

POSTはR2 PUT前に`upload_intent`を永続化し、添付metadata確定時にintentを閉じる。D1 insertと
補償R2 DELETEが両方失敗してもkeyはledgerに残る。DELETEは先に同じledgerへintentを置き、
R2成功を`object_deleted_at`へ記録してからmetadataを整理するため、R2 DELETEの冪等再試行で収束する。

password login throttleの既定は15分window / 5回目から15分lock / 7日後stale cleanupで、
1 requestは成功・失敗とも最大2 D1 queries。nightly scheduledは`updated_at`のindexから
最大100件を1 queryで消去し、添付cleanup・backupを含む最悪予算を44 queriesに固定する。
validation、安全なfallback、非secret override名は`packages/api/src/login-rate-limit.ts`を正本とする。

保持の正本値は`packages/core/src/attachments.ts`、安全なruntime overrideの読取りは
`packages/api/src/attachment-recovery.ts`に一元化する。`ready`と親なし`ready`の証憑は明示削除まで
保持し、cleanup intentは7日graceとする。失敗・重複・完全にsupersededの取込R2 uploadだけを30日後に回収し、
partialなrunのcommitted unitやactive/shared keyは保持する。
既定quotaは利用者ごとに100MiB、reconcileは1回10件、最大5回でdead-letterとする。quota判定は
利用者別writer lease内かつR2 PUT前に行い、未完の`delete_object` jobのbytesも使用中として数える。

API wireの`originalAvailable`は永続列ではない。通常一覧・親なし一覧・現金/MFの`attachmentCount`を
返す直前に対象metadataのexact-key R2 HEADを最大4並列・900 unique候補まで実行し、実在するkeyだけをtrue/
件数へ含める。HEAD障害・候補超過は503、欠損は`cleanupStage=original_missing`とし、古い可用性を
返さない。これは応答生成時の観測であり、HEAD後に外部主体が削除する不可避race後の永続保証ではない。
900はWorkers FreeのCloudflare内部service subrequest上限1,000から認証/D1等の100を予約した上限である。
`object_deleted_at!=NULL`はこの枠にもHEADにも含めず、同keyが外部再出現しても削除進捗を優先してfalseとする。
POSTの201 wireもmetadata確定後に同じexact-key HEAD結果から生成する。HEAD障害時はD1/R2 commit済みを
structured errorで区別し、`originalAvailable=true`を推測で返さない。

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
- restore/JSON取込は現金明細を復元せず、有効な`cashProjection`の確定deltaだけを集計から厳密に差し引く。destination側の設定では再投影しない。未知version/basis/scope、重複行、欠落、非正整数、集計を超えるdeltaは書込み前に400とし、0へのclampで隠さない。有効な空rowsは正常。`cashProjection`なしで`cashEntries`が非空ならsource semantics不明として拒否し、両方なし（または空cashEntries）のpre-cash legacyだけ互換受理する。
- restoreではJSON source内の `cash:*` edit/overridesを破棄する。同一DBに既存cashがある場合は、その現存IDに対応するdestination側の既存editだけをcandidateへ戻し、永続化行・集計・指紋をすべてそのcandidateから生成する。これにより、新DBで後から同じIDが採番されてもbackup由来editが誤付着しない。

## 仕分けルールの順序契約

- 全consumer（明細解決、hit count、候補科目usage/rename/delete guard）は共通loaderの `sort_order ASC, id ASC` を使う。DBにルールが無い場合の既定fallbackも同loader境界で一元化する。
- `PATCH /rules` は当該利用者の全rule IDを一度ずつ含む完全順列だけを受理する。partial・duplicate・unknown・他利用者IDは書込み前に400とし、成功時は0始まりの連番へ正規化する。

## 取込の重複検知(content_hash)

- v3指紋はtype+length prefixの衝突しないcanonical encodingを使う。freeeは保存行の`月/日付/収支/取引先/原本科目/正規化科目/金額`、MFは`ID/月/正規化したYYYY-MM-DD/内容/金額/大項目/中項目/口座/ID安定性`を、parser・指紋・commit builderが同じ保存行射影として使う。JSONはraw payloadではなく、partial/default/merge後の実効的な保存行をhashする。`exportedAt`等のmetadata、非永続subs aliases、監査用`cashEntries`は除外するが、実際に永続化・集計に使うdestination `cash:*` editは含める。旧指紋とは互換比較せず、移行後の最初の1回だけ通常取込になる。
- MFのID列が無い旧exportは復元用IDが行index依存である。`mf_transactions.identity_stable=0`として添付を拒否し、行順を変えたファイルは別内容として扱う。MFのID列から読み込んだ行だけを1とする。
- 過去ever-seenではなく現在有効なtargetだけを比較する。同月A→B→AはforceなしでAを再適用し、A→Aだけを`duplicate`にする。`force=1`は現在有効なcommitted世代を意図的にもう一度適用するときだけ使う。
- 別途、月ごとの取込前後の件数(`replaced`)を返し、減っていれば画面で「月の途中までのファイルではないか」を知らせる(既存どおり月単位で洗い替えるため)。

## 取込のcommit/部分成功契約

- 同一利用者のrequestはwriter claimで直列化する。同一multipart内の同domain×month重複、およびJSONと他unitの併用は、R2/D1への副作用前に400で拒否する。
- R2はD1 transaction外なので、先にrun/unitと`r2_key`を作ってから保存する。R2または実行時の失敗はunit/runを`failed`に残す。同じ入力の通常再試行を`duplicate`扱いせず、回復できる。stale takeoverは旧runの未完了unitも同じ回復境界で閉じる。
- unit内部はD1 `batch()`でcanonical原本、復元baseline、`monthly_agg`、active target、unit terminal marker、run reconcileを一括確定する。応答喪失やcommit直後crashでもunitからrunを再計算でき、`committed` unit + 未完runを正規状態にしない。unit間はpartial successを許し、完了済unitは残し、失敗unitだけ再試行可能にする。
- CSVの大量行はJSON1 `json_each` のUTF-8 80KiB payloadへ分割し、1行1 DELETE/INSERTを行わない。`import_id`・`user_id`・確定時刻等の実行時値は行JSONへ埋め込まずscalar bindへ分離するため、受理前sentinelと実attempt IDの桁数でchunk数は変わらない。routeは実commit builderが作るpayload/cache/active/finalizationのstatement数と、read/claim/attempt/heartbeat/reconcile/release・duplicate/失敗/commit応答喪失回復のworst-caseを合算し、49 queriesまでだけ受理する。受理後は実attempt IDでR2保存前にbuilderを再構成し、各commit直前にも`actual statements <= planned statements`を検査する。通常幅の5,000行freee/MFは50未満だが、同じ5,000行でも長大な列や大量のcache scope、複数unitで予算を超える場合は、R2/run/canonical書込み前に413で拒否する。各queryは100KB未満で、行payloadは1つのJSON bindへ集約する。

- `import_runs`/`imports`は取込監査の正本として自動削除しない。`import_active_targets.import_id`または`imports.duplicate_of`から参照中のattempt metadataは保持する。`failed`/`superseded`のR2原本は既定30日後に共通cleanup ledgerがexact keyだけを削除し、成功後は`imports.r2_key=NULL`へして原本なしの事実を表す。run/unitの件数・対象月・指紋・状態・失敗理由は保持する。期限付きclaimへ永続履歴と同じFK/保持規則を適用しない。
- JSONのactive pointerは、`cash_entries`/`rules`/`tx_edits`/`institution_owners`/`budgets`/`account_norm_map`/`unrecorded_months`/`cash_overrides`/`sub_vendors`/freee・MF原本/復元baselineの変更と同じD1 batchで無効化する。JSON restore自身は新pointerをcommit batchで設定するため、設定変更後の同じJSONは再適用、無変更の連続取込だけが`duplicate`になる。
- multipart JSONと`POST /restore`は同じrestore commit builderと状態遷移を使う。JSONはMF原本の含有月を洗い替え、rules/edits/institution owners/budgets/cash override/復元baseline/未記帳月を置換し、sub vendor名は追加する。freee原本、現金明細、現存現金用editは保持する。`POST /restore`は直接JSON bodyを受けるためR2原本を作らない。
