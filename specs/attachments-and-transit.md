---
graph_node_id: "spec-attachments-transit"
artifact_kind: "specification"
title: "レシート添付と交通費の記帳"
project_id: "kanjo"
domain: "accounting-records"
status: "confirmed"
file_path: "specs/attachments-and-transit.md"
template_id: "specification"
template_version: "1.0.1"
depends_on: []
tags: ["attachments", "r2", "transit", "mobile"]
---

# 文書所有権

- `docs/spec-v1.1.md`: 製品全体の不変条件と、本詳細仕様への規範的な導線を持つ。
- 本書: 証憑添付・交通費のlifecycle、画面、API、受入を持つ。
- `docs/data-schema.md`: migrationごとの永続形状とデータ不変条件を持つ。

同じ契約は複製せず、上記の所有者へ参照する。実装と受入証拠の対応は
`tasks/attachments-and-transit-tasks.md` の受入証拠台帳を正とする。

# 目的

現金の記帳と取込明細に、レシート・領収書の画像や PDF を紐づけて残せるようにする。
確定申告・税務調査で「この支出の証憑はどれか」を後から即座に示せる状態を作る。
あわせて、領収書が出ない交通費(電車代など)を素早く記帳できる導線を用意し、
「証憑がある支出」と「証憑が構造上出ない支出」を画面上で区別できるようにする。

背景: `docs/product/backlog.md` の
「現金の記帳にレシート・領収書の画像を添付できるようにする(R2 保管)」を実装対象に引き上げたもの。

# 到達状態

- 現金の記帳・取込明細のどちらからでも、スマートフォンのカメラ撮影と PC のファイル選択・
  ドラッグ&ドロップ・クリップボード貼り付けの4経路で証憑を添付できる。
- 一覧表に「添付あり(N)」が出ており、どの明細に証憑が揃っているか一目で分かる。
- 交通費は区間(出発→到着)と往復を指定するだけで記帳でき、証憑不要の明細として区別される。
- MFの安定ID列がある取込と記帳の編集では添付は失われない。ID列の無い
  旧exportは行順依存の合成IDのため新規添付を拒否し、画面と取込結果で理由を明示する。
- 記帳を削除したときは添付も削除する。R2削除が失敗しても対象キーをD1に残し、
  再試行可能な「削除失敗」状態として扱う。
- MFの月次洗替えで親明細が一時的に消えても、証憑を孤児として可視のまま保持し、
  同じ安定IDが再出現すれば自動で通常状態へ戻す。
- 利用者単位の総容量上限、実バイトの形式確認、夜間の有界再試行で、
  R2/D1非transaction境界を自動収束させる。

# スコープ

- スコープ内:
  - 添付の登録・一覧・閲覧・削除(R2 に原本、D1 にメタデータ)
  - 現金の記帳(`cash:<id>`)と MF 取込明細(`tx_id`)の両方を添付先にする
  - 一覧表への添付有無バッジ、モバイル/PC 両対応の入力 UI
  - 交通費の区間入力と往復計算、証憑不要フラグ
  - 夜間バックアップへの添付メタデータの同梱
  - `attachmentArchive`と同一bucketの原本を照合し、一致するmetadataだけを再結合する安全な回復
  - 添付cleanup intentの夜間reconciler、利用者quota、状態別保持規則
- スコープ外:
  - freee 仕訳(`freee_deals`)への添付。安定した明細 ID を持たないため対象外
  - 画像から金額・日付を読み取る OCR
  - 添付のサムネイル生成・画像圧縮(原本をそのまま保管する)
  - bucket全件scan、新規Workflow/Queue/Durable Object、添付原本の別bucket複製
  - 原本が無いarchive recordを「復元済み」とすること

# 受入

- [x] **AC-ATT-01** 現金の記帳に画像を添付すると、一覧の「証憑」列に「添付あり 1」が出る。0件は「未添付」と出る。
- [x] **AC-ATT-02** 安定IDのMF明細に添付でき、再取込で一時的に明細が消えても孤児一覧から閲覧・削除できる。同IDの再出現で自動復帰する。
- [x] **AC-ATT-03** ID列の無いMF明細は「IDなし・添付不可」となり、APIでもR2書込み前に409で拒否する。
- [x] **AC-ATT-04** 原本が実在する行だけ閲覧linkを出し、認証セッション無しは401。R2削除済みでmetadata整理だけ失敗した行はlinkと添付件数から外れる。
- [x] **AC-ATT-05** 8MB超、非対応形式、申告MIMEとmagic signatureの不一致は日本語理由で拒否され、R2に原本が残らない。
- [x] **AC-ATT-06** 同一明細の同一内容は重複拒否され、利用者総容量の上限はwriter lease内でR2 put前に拒否される。使用量と上限は画面で確認できる。
- [x] **AC-ATT-07** R2削除失敗とR2削除済み/D1 metadata整理失敗を区別し、手動retryと夜間reconcilerのどちらでも冪等に収束する。POSTのD1確定+補償R2削除の二重失敗でもR2 keyを失わない。
- [x] **AC-ATT-08** 交通費フォームで「東京→品川 / 片道 180円 / 往復」を入力すると、金額360円・内容「電車代 東京→品川(往復)」の記帳が作られる。
- [x] **AC-ATT-09** 交通費の記帳は「証憑不要」と表示され、添付が無くても未対応にしない。
- [x] **AC-ATT-10** `attachmentArchive`はowner/key/hash/sizeと同一bucketの原本を照合し、一致するrecordだけmetadataを再結合する。missing/mismatch/skippedを件数で返し、原本欠損を復元成功と表示しない。
- [x] **AC-ATT-11** file input・カメラ`capture`・drop・paste・部分成功・badge再同期・原本open・deleteを実DOMで操作確認する。物理カメラ起動だけは実機手動項目とする。
- [x] **AC-ATT-12** local migration適用後のWorkers previewが一時D1/R2と架空認証値で有限smokeし、自動停止する。

# データ契約

永続列・index・migrationごとの形状は [`docs/data-schema.md`](../docs/data-schema.md) を正とし、
本書では画面/APIを跨ぐlifecycleだけを定める。

- APIのwire形式は後方互換のため現金=`cash:<id>`、MF=`tx_id`とし、coreの判別unionで一度だけ
  `target_kind`+`target_key`へ変換する。MFの予約接頭辞`cash:`は取込前に拒否する。
- MF出力の明示IDだけをstableとする。合成IDは添付不可で、明示IDを含む再取込時にだけstableへ更新する。
- `attachments.state`は操作段階の互換値、`object_deleted_at`はWorkerが実行したR2 DELETE成功の
  単調なD1 factであり、どちらも現在の物理存在を単独では保証しない。wireの
  `originalAvailable`と添付件数は応答生成時に各metadataのexact-key R2 HEADで確認した結果から
  導出する。親の存在は`parent_missing_at`、自動回収は`attachment_cleanup_jobs`のintentから導出する。
- 交通費の区間は両端が揃った支出だけを許し、往復と証憑不要は区間付きの場合だけ1にできる。
  通常記帳へ戻したときは交通費metadataと証憑不要をまとめてclearする。

## R2 のキー設計

`attachments/<user_id>/<YYYY-MM>/<uuid>.<ext>`

- 月で切ることで、保持期間の運用や棚卸しを既存の `backups/` と同じ粒度で扱える。
- ファイル名は利用者入力のためキーに含めない(パス区切り・制御文字の混入を構造的に排除する)。

# lifecycle matrix

同じ原本に対するR2操作は冪等とする。`object_deleted_at`はR2 DELETE成功を示す単調factで、
診断用の`last_error`や操作段階から推測しない。

| event | pre-state | D1 | R2 | 利用者に見える状態 | retry owner |
|---|---|---|---|---|---|
| POST準備 | 親あり・quota内・署名一致 | PUT前に`upload_intent`を作る | 未操作 | 登録処理中 | request |
| POST原本失敗 | `upload_intent` | intentを残す | PUT失敗/不明 | 登録失敗、添付件数は増えない | scheduled |
| POST確定 | PUT成功 | metadata insertとintent closeを同じD1 batchで確定 | 原本あり | 原本link付きの「添付あり」 | なし |
| POST D1失敗+補償失敗 | PUT成功・metadataなし | key/owner/sizeをintentへ保持 | 原本だけ存在 | 登録失敗、件数には含めない | scheduled |
| 帯域外の原本欠損 | ready metadata・`object_deleted_at=NULL` | 変更なし | exact keyなし | `original_missing`、linkなし・件数0・管理情報削除可 | external recovery / user |
| 原本の帯域外再出現 | `original_missing`相当のmetadata | 変更なし | exact keyあり | 次の応答でlink・件数が自然に復帰 | なし |
| R2 HEAD障害 | metadataの状態を問わない | 変更なし | 存在判定不能 | staleな可用性を返さず503 | client retry |
| DELETE要求 | 原本あり | `attachment_delete` intentを先に作る | 未操作 | 「原本を削除中」・再試行可 | request + scheduled |
| DELETE原本失敗 | intentあり・`object_deleted_at=NULL` | error/backoffを更新 | 原本あり | linkありの「原本削除に失敗」 | manual + scheduled |
| DELETE原本成功 | intentあり | `object_deleted_at`を一度だけ記録しmetadata整理段階へ進める | 原本なし | link/添付件数から外し「metadata整理中」 | request + scheduled |
| metadata整理失敗 | `object_deleted_at!=NULL` | job/errorを保持 | 原本なし | linkなしの「原本削除済み・整理を再試行」 | manual + scheduled |
| MF親消失 | stable IDの原本あり | `parent_missing_at`を設定 | 変更なし | 孤児管理に表示し閲覧・削除可 | import commit |
| 同MF ID再出現 | `parent_missing_at!=NULL` | NULLへ戻す | 変更なし | 通常明細の添付へ自動復帰 | import commit |
| archive照合 | 同一ownerのrecord | bounded recordだけ照合し、一致分だけmetadataを再結合 | exact keyをGETしsize/hashを検証 | recovered/alreadyPresent/missing/mismatch/skipped件数 | user request |
| 取込原本の保持期限 | failed/重複/完全supersededかつ期限超過 | `import_retention` intentを有界に作る | active/shared keyは保持しexact keyだけ削除 | 利用者データの復元成功とは表示しない | scheduled |

# quota・retention・形式安全

既定値とruntime overrideの解析はcore/APIの共通設定境界に一元化し、画面へ`usedBytes`と
`limitBytes`を返す。利用者別writer lease内で、原本ありmetadataと未完`delete_object` intentの
合計に新規fileを加え、quota超過をR2 PUT前に413で拒否する。

| 対象 | 既定の保持 | 終了条件 |
|---|---|---|
| ready証憑 | 期限なし | 利用者の明示DELETE |
| MF親なしready証憑 | 期限なし | 同ID再出現または利用者の明示DELETE |
| attachment cleanup intent | 最低7日graceを設定可能 | 成功、または5回以上試行かつgrace経過後にdead-letter |
| failed/重複/完全superseded取込のR2 upload | 30日を設定可能 | scheduledがexact keyを回収。partial/shared-active原本とrun/unitの監査metadataは保持 |
| archive record | backupの保持規則 | 原本のcopyではなくinventoryとして扱う |

1ファイル8MiB、1明細10件、既定100MiB/利用者とする。許可形式はJPEG/PNG/WebP/PDF/
HEIC/HEIFで、申告MIME・拡張子だけでなく最小magic signatureを検証する。不一致や判別不能は
原本保存前に拒否する。原本responseは保存済み`content_type`、`nosniff`、認証済みinline downloadを使う。

非secret runtime overrideは`ATTACHMENT_QUOTA_BYTES`、`ATTACHMENT_CLEANUP_GRACE_DAYS`、
`ATTACHMENT_IMPORT_UPLOAD_DAYS`、`ATTACHMENT_RECONCILE_BATCH_SIZE`、
`ATTACHMENT_CLEANUP_MAX_ATTEMPTS`とする。未設定・非整数・安全範囲外はcoreの既定値へ戻し、
route、scheduled、画面が別々の既定値を持たない。

# API

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/attachments?target=<txId>` | 添付一覧(メタデータのみ) |
| GET | `/api/attachments/orphans` | 親が消えたMF証憑の管理一覧 |
| GET | `/api/attachments/quota` | 利用者別の使用量・上限・残量 |
| POST | `/api/attachments` | multipart(`target`, `file`)で登録。201 |
| GET | `/api/attachments/:id/content` | 原本を `Content-Disposition: inline` で返す |
| DELETE | `/api/attachments/:id` | 共通cleanup ledgerへ登録し、原本→metadataの順で削除/再試行 |
| POST | `/api/attachments/archive/reconcile` | archiveと同一bucket原本のowner/key/hash/sizeを照合し、書込みなしreport |
| POST | `/api/attachments/archive/recover` | 明示confirm時だけ、一致する原本のmetadataを再結合 |

- 許可 MIME: `image/jpeg` `image/png` `image/webp` `image/heic` `image/heif` `application/pdf`
- 上限: 1ファイル 8MB、1明細あたり 10件
- 添付は集計値を変えないが、親削除・MF洗替えとの参照整合のため既存の
  `canonicalMutationFence` で POST/DELETE を直列化する。
- 一覧・原本・削除responseに共通 `Cache-Control: private, no-store` を付ける。
- 一覧responseは利用者全体の`usage.usedBytes/limitBytes/remainingBytes`を返す。各添付は
  `originalAvailable/cleanupStage/orphaned`を返し、UIは内部stateを直接解釈しない。
- 一覧・孤児・現金/MF件数はmetadata候補のexact-key R2 HEADだけを最大4並列・1応答900 unique候補で行う。
  bucket全件scanはしない。HEAD失敗・候補超過はmissingへ読み替えず503、物理欠損は
  `originalAvailable=false / cleanupStage=original_missing`とし、原本取得も
  `attachment_original_missing`へ統一する。HEAD直後に外部削除されるraceはR2/D1を跨ぐ不可避境界で、
  本契約は「応答生成時に確認済み」を保証し、応答後の永続的可用性までは保証しない。
  900はWorkers FreeのCloudflare内部service subrequest上限1,000から認証/D1等へ100を予約した値で、
  `object_deleted_at!=NULL`の削除済みfactは候補枠にもHEADにも含めず常にfalseとする。同keyが外部から
  再作成されても削除intentを優先し、scheduledが再削除するまでlink/count/contentを復活させない。
- POSTの201 responseもD1確定後に同じexact-key HEAD helperを通し、内部stateからtrueを補わない。
  HEAD障害時はcommit済みであることと再送禁止をstructured 503で明示し、UIは成功件数へ含めつつ
  状態確認待ちの警告を出す。同じfileの再送を通常のretry手段にはせず、一覧再取得へ誘導する。

既存レスポンスの拡張:

- `GET /api/cash-entries` の各 entry に `attachmentCount: number` を足す。
- `GET /api/transactions` の各行に `attachmentCount: number` と `idStable: boolean` を足す。

# 画面

## 現金の記帳(`/cash`)

- 入力フォームを「通常の記帳」と「交通費」の2タブにする。
- 交通費タブ: 出発・到着・片道金額・往復チェック。金額と内容は入力から組み立てて表示する。
- 「証憑不要」は領収書が出ない交通費でのみ自動設定し、通常記帳に任意のboolean入力は出さない。
- 一覧に「証憑」列を足す。`添付あり N` / `証憑不要` / `未添付` の3状態。
- 行の「証憑」ボタンで添付パネルを開き、追加・閲覧・削除を行う。

## 公私仕分け(`/classify`)

- 一覧に「証憑」列を足し、同じ添付パネルを開けるようにする。

## 添付パネル(共通コンポーネント)

- `<input type="file" accept="…" multiple>`(PC のファイル選択)
- `<input type="file" accept="image/*" capture="environment">`(スマホのカメラ起動)
- ドロップ領域(PC のドラッグ&ドロップ)
- `paste` イベント(スクリーンショットの貼り付け)
- `window paste`は開いている単一パネルのみが所有し、一覧行ごとにlistenerを増やさない。
- 複数fileの一部が失敗しても成功分を表示し、全request完了後に一覧とbadgeを再同期する。
- 0件は「未添付」と明記し、actionは0件で「証憑を追加」、1件以上で「証憑を管理」とする。
- 容量は利用量/上限を表示し、残量0では既存証憑を隠さず新規選択だけを止める。
- `originalAvailable===true`の行だけ原本link/copyを出し、wire欠落時も内部`state`から補完しない。削除失敗は「原本削除」と
  「原本削除済み・metadata整理」を分け、retry actionは同じDELETEへ集約する。

## 設定(`/settings`)

- 親なしMF証憑を件数とともに表示し、同じ共通添付行から原本閲覧・削除できる。
- `attachmentArchive`は最初に書込みなし照合を行い、recoverable/missing/mismatch/skippedを表示する。
  recoverableがあり利用者が明示confirmしたときだけmetadataを再結合する。
- HTML版JSONは「集計・設定の初期移行」と表示し、「全データ」「全量」「添付原本の復元完了」と表現しない。

# archive・復旧契約

`attachmentArchive`は`version=1 / basis=inventory-only / restoreCapable=false`の棚卸しenvelopeで、
canonical dataと同じSQLite statement snapshotから作る。汎用`POST /restore`は集計・設定の初期移行であり、
現金明細・添付metadata・R2原本を復元しない。

添付の明示的なsafe recoveryだけがarchive consumerになる。requestのownerは認証userへ固定し、
`attachments/<user_id>/`配下のexact key以外はskipする。各recordは同一bindingのR2から原本を取得して
実byteのsizeとSHA-256を検証し、親/形式/重複を含むD1制約を満たすものだけmetadataを再結合する。
1 requestは10 recordまでとし、画面が10件ずつ直列送信してreportを集約する。bucket全件scanや
原本copyは行わず、`recovered / alreadyPresent / missing / mismatch / skipped`を別件数で返す。
原本欠損・hash不一致を成功件数へ含めず、画面にも同じ境界を表示する。

recoveryは同じkeyの未完cleanup jobまたは明示削除tombstoneがあるrecordをskipする。scheduled cleanupは
jobを保持したままR2 DELETEをawaitし、`attachment_delete`だけmetadata/job整理と同じD1 transactionで
tombstoneへ移す。upload補償・import retentionはarchiveの明示削除復活防止に不要なためtombstoneを作らない。
したがってrecoveryがjob/tombstoneを見れば再結合せず、どちらも無ければR2の強整合なexact GETで照合する。
bucket scanや別workflowで調整せず、この順序をroute testで固定する。照合GET後に外部主体が原本を削除する
cross-service raceは残るが、次の一覧HEADで`original_missing`となり、原本なしを利用可能とは表示し続けない。

# local preview 契約

`pnpm run preview:smoke`は`.dev.vars`を読まず、一時ディレクトリのlocal D1/R2と架空認証だけを使う。
全migration適用、SPA/未認証/loginに続き、架空の現金明細作成、有効な小型PNGの登録、一覧の
`originalAvailable=true`と件数、原本取得、削除、空一覧までを同じWorkers previewへ往復し、有限時間で
自動停止する。cookie・R2 key・user ID・filenameは成功/失敗ログへ出さない。

# 非機能

- 認証: 既存の `authGuard` 配下。原本取得も含め未認証では 401。
- ログ: ファイル名・明細内容・R2 keyをログに出さない。nightly summaryは
  `selected/completed/retried/dead/importJobsEnqueued`の件数だけを構造化して出す。
- 登録: R2 PUTより先にcleanup intentを永続化する。件数・quota・重複はmutation lease +
  DB制約で同時requestにも適用し、競合結果を日本語409へ正規化する。
- 削除: routeとscheduledが共通processorを使い、R2成功を`object_deleted_at`へ記録してから
  metadataを整理する。R2失敗、R2成功後のD1失敗、route応答喪失のいずれも同じintentから冪等に再開する。
- 自動処理: 既存nightly scheduledへ1回最大10件のreconcilerを接続する。指数backoffし、
  5回以上の試行と7日graceの両方を満たしたjobだけdead-letterへ移す。全bucket scanはしない。
