# 設定画面の設計判断(feat-settings-screen)

`/settings`(設定)を作り直したときの判断を記録する。画面仕様の正本は `specs/spec-settings-screen.md`、設計の正本は `architecture/settings-*.md`(8 本)、タスクの正本は `tasks/feat-settings-screen/sys-settings-p01〜p13.md`。規則の番号(BR-xx)・受入の番号(AT-xx)・未決事項の番号(Q-x)・食い違いの番号(R-x)は、仕様書のものをそのまま使う。

## 1. 数値と規則は core の 1 か所から出す

- 設定 4 種(集計ルール・名義・統計の最小月数・現金上書き)の検証・差分・変更履歴・未保存件数・画面の値は、`packages/core/src/settings-screen.ts` から出す。使う関数は `validateSettingsInput`・`diffSettings`・`settingsChangeEntries`・`countSettingsChanges`・`settingsScreen`・`summarizeSettings`。設定 JSON の書き出し・検証・バックアップ本文からの取り出しは `settings-json.ts` から、集計ルールの照合と適用は `norm-rules.ts` から出す。api も web も同じ関数を呼ぶので、保存後と入力中とで規則が分かれない。
- 集計時の優先順位は、**手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類**(BR-07〜BR-09)。照合キーは NFKC → 大文字小文字の畳み込み → 前後空白除去で作り、完全一致で当てる(BR-06)。同じ照合キーの行が複数あれば、並び順で上の行が効く。無効な行は効かない。保存済みの明細は書き換えず、集計のときだけ効かせる。
- 勘定科目ルールは、既存の `normalizeAccount` と同じ結果になる(回帰 0。`settings-screen.test.ts` › 勘定科目ルール(BR-05))。
- 現金上書き(BR-12〜BR-14)の値は次の 4 通り。空欄は上書きしない。0 は 0 円にする。月指定は全期間より優先する。月指定の値は、その月の支払いを 1 件に置き換える。
- 変更履歴は追記だけにする。変更の件数は `diffSettings` の total と一致し、作成は before=null、削除は after=null で残す(BR-19・BR-21)。
- core は現在時刻を読まない。保存時刻と更新者は api が渡す。更新者はメールのローカル部で、システムの書込みは `system` とし、画面では『システム』と表示する。

## 2. 仕様との食い違い

実装のうえで仕様書やタスク仕様の記述と揃わなかった点。どれも agent の判断で、利用者は確認していない。値を戻すときは、system-spec → 仕様書 → 本書 → 実装の順に直す。

| 事項 | 仕様の記述 | 実装 | 理由 |
|---|---|---|---|
| 集計ルールの `ruleId` の長さ | BR-02 は 1〜64 字の英数・`_`・`-` | `NORM_RULE_ID_PATTERN`(`packages/core/src/norm-rules.ts`)は `^(?:[A-Za-z0-9_-]{1,64}\|m-(?:[0-9a-f]{2}){1,180})$` で、移行した id(`m-` + UTF-8 の hex)を最大 362 字まで許す | 0051 は既存の `account_norm_map` の行を `'m-'\|\|lower(hex(raw))` で写す。日本語で 11 字以上の raw は 64 字を超える。この形のままだと、移行した行を含む保存が `invalid_id` で止まってしまう。hex の形は `m-` 接頭辞の id に限って広げたので、画面から発行する id は従来どおり 64 字以内に収まる |
| 30 日の保持削除の範囲 | P05 のタスク仕様は「pre-restore を保持削除の対象から除外」、仕様書(保持の節と R-4 の対処)は 30 日を過ぎた退避も消す | 夜間処理(`packages/api/src/index.ts` の `nightlyBackup`)は、`listAllBackups` で cursor を追って全件を集める。`backups/pre-restore/` の接頭辞を外した日付で比べ、30 日より古い回・`.failed.json`・退避をすべて消す | 仕様書の側に揃えた。退避を残し続けると R-4 のとおり R2 に溜まり続ける。一覧(`backupListItems`)は退避を出さないので、画面の見え方は変わらない |
| 全データ復元での設定の扱い | 仕様書 1704 行は、全データ復元(`POST /api/restore`)でも 3 表と名義・集計ルールを同じ意味で書くとする | `import-lifecycle.ts` の全データ復元が書くのは `settings_cash_overrides` だけ。変わったときだけ置き換え、変更履歴を origin `migration` で残す。名義と集計ルールは書かない | 全データ復元の write-set は、既存の監査済みの経路(フェンス・snapshot の無効化)に縛られる。変更は現金の投影に要る最小限に留めた。名義と集計ルールを全データ復元で戻す要否は、利用者に確認していない |
| 集計ルールの科目候補 | 仕様は既存の `CategoryPicker` を使う | 正規化後のカテゴリの欄は `<input list>` と `<datalist id="settings-norm-suggestions">` で候補を出す | 表の 1 セルに収まる入力が要り、`CategoryPicker` のタブ付きの選択は表の行の高さに収まらなかった。候補の中身は既存の科目候補と同じ |
| 説明パネルの置き場所 | 画像では画面右の列 | 集計ルールの節の中に 2 列で置く(`.settings-rules-layout`)。1023px 以下では 1 列にして表の下へ回す | パネルは集計ルールだけの説明なので(Q-11)、節の外に置くと、ほかの節を読んでいるときに無関係なパネルが残ってしまう |
| 保存の本文 | 仕様は全節を 1 回の PUT で送る | `PUT /api/settings/screen` は 1 回だが、本文に入れるのは変更した節だけ。変更の無い節は送らない | 送っていない節は書かないので、別の画面で変わった節を古い値で上書きしない。409 の判定は `baseSavedAt` 1 つで全節を見る |
| HTML 版からの全データ初期移行 | 仕様はアカウント / その他の管理の節に置くとする(AT-20) | 『その他の管理』の節にそのまま残した(`legacy-restore.tsx`) | 設定だけの復元(データ節)と並べると、どちらが取引まで戻すのかが紛らわしい。既存の置き場所を保った |
| テストの置き場所 | CSV の無害化は `packages/core/test/exports.test.ts`、api 統合は `packages/api/src/settings-screen.integration.test.ts`、夜間処理は `src/nightly-backup.test.ts` を新設 | CSV は `packages/core/test/transaction-export-contract.test.ts` に追記した。api 統合は `packages/api/test/settings-screen.integration.test.ts` と `packages/api/test/settings-backups.integration.test.ts`。既存の `src/nightly-backup.test.ts` は変更していない | CSV の既存の契約テスト(区切り・CRLF・カンマ)と同じ場所に置けば、無害化で既存の出力が変わらないことも同じファイルで確かめられる。api 統合は、画面ごとの統合テストを置く `packages/api/test/` に揃えた |

## 3. 実装で選んだ手段

### 3.1 新表は足すだけで、旧表と旧 API は残す

`migrations/0051〜0053` の 3 本は、`settings_norm_rules`・`settings_cash_overrides`・`settings_change_log` を足し、旧表の行を写すだけにした。`account_norm_map`・`cash_overrides` には DROP・ALTER・UPDATE・DELETE を 1 文も書かない。旧 `PUT /api/settings` と `PUT /api/settings/owner-labels` は、旧表に書いたうえで `legacySettingsStatements` によって新表と変更履歴(origin `screen`)にも同じ意味で書き、revision を進める(Q-2・R-2)。旧 `GET /api/settings` は旧表のまま読む。フェンス(`canonical-mutation-fence.ts`)では、`PUT /api/settings` の consumers に `settings_cash_overrides` を加えた。写しの規則は `docs/data-schema.md` の「設定画面の 3 表(0051〜0053)」にある。

### 3.2 保存は 1 回、競合は revision で止める

`PUT /api/settings/screen` は `baseSavedAt` を必須とし(未保存なら null)、フェンスの内側で現在の revision と照合する。revision は変更履歴の最新の `changed_at` から作る。一致しなければ 409 `settings_conflict` を返し、何も書かない。一致したときだけ、変更した節の全件置換と変更履歴の追記を 1 回の batch で送る。web は 409 を受けたら『他の画面で更新されました』を出して取り直す。

### 3.3 バックアップは設定だけを戻す

`GET /api/backups/:date/compare` と `POST /api/backups/:date/restore/preview` は読むだけ。`POST /api/backups/:date/restore` は `{baseSavedAt}` だけを受け(上限 1KB)、R2 の本文をフェンスの内側で 1 回だけ読む。設定 4 種を取り出し、設定ファイルの復元と同じ `restoreSettings` を通す。取引は戻さない(qa-settings-decision-010)。本文が読めなければ 422 `backup_settings_unreadable`、回が無ければ 404 `backup_not_found` を返す。

### 3.4 下書きは端末に置く

`draft.ts` は、入力が止まってから 800ms 後に下書きを端末へ書く(v1、30 日で消す)。保存済みの値に戻したら下書きも消す。保存に成功したとき、リセットを確定したとき、ログアウトしたとき(`Layout.tsx`)にも消す。

## 4. 未決事項の最終状態

仕様書の Q-1〜Q-12 と R-1〜R-7 の 19 件。**どれも利用者は確認していない**。「状態」の欄は、agent が仕様書の「現状」の値で実装したのか(agent 推定)、既存コードとの食い違いに agent が手を打ったのか(agent 対処)を示す。利用者の決定ではない。

| 事項 | 状態 | 実装で採用した値 / 対処 |
|---|---|---|
| Q-1 名義の API | agent 推定・利用者未確認 | 画面は `PUT /api/settings/screen` に名義を含めて 1 回で送る。書く表(`owner_labels`)・検証・読み出しは既存 API と共有する。`GET/PUT /api/settings/owner-labels` は家計収支画面のために残す |
| Q-2 旧書込み経路と新表の同期 | agent 推定・利用者未確認 | 旧 `PUT /api/settings` と owner-labels は、旧表・新表・変更履歴(origin `screen`)の 3 か所へ書き、revision を進める。全データ復元の扱いは §2 の食い違いのとおり |
| Q-3 名義 4 欄の並び・例文 | agent 推定・利用者未確認 | 配偶者・事業・家族・未設定の順で 2 列 × 2 段。例文は『例：パートナー、配偶者』『例：事業、ビジネス』『例：子ども、家族』『例：その他、未設定』 |
| Q-4 現金上書きの意味の細部 | agent 推定・利用者未確認 | 上書き値は月額として扱う。対象は現金入力の明細の月の合計。写した既存の値は現金集計に効き始める。**既存の値を持つ利用者は数字が変わりうるので、リリース前に利用者へ知らせる必要がある** |
| Q-5 取引先ルールの範囲 | agent 推定・利用者未確認 | 決まるのは大項目だけ。中項目は空にし、公私と名義は変えない。照合は内容の照合キーの完全一致(部分一致では当たらない) |
| Q-6 旧全データ上書きを画面から外す | agent 推定・利用者未確認 | バックアップの節から全データの上書きを外した。全データの戻し方として、『その他の管理』の HTML 版からの初期移行と D1 Time Travel が残る |
| Q-7 最新の回の『復元』 | agent 推定・利用者未確認 | 有効にした。無効になるのは失敗の回だけ |
| Q-8 レポート(HTML)の補足 | agent 推定・利用者未確認 | 補足は画像どおり『設定内容のレポートを出力』。中身は既存の会計レポートのまま |
| Q-9 古いバックアップの設定部分 | agent 推定・利用者未確認 | `settingsJsonFromBackup` が migration の写しと同じ意味で読む。`normMap` は勘定科目ルールにし、月の値は月指定の上書きにする。0 と未設定は写さない。移行 id は migration と同じ `m-` + UTF-8 hex |
| Q-10 バックアップの日付を JST にする | agent 推定・利用者未確認 | ファイル名の日付は JST(UTC + 9 時間)。同じ日付のキーがあれば上書きする |
| Q-11 変更履歴の表示場所 | agent 推定・利用者未確認 | 画面に出すのは集計ルールの説明パネルだけ。名義・統計・現金上書きの履歴は `/api/settings/history` と表に残す |
| Q-12 agent 推定・具体化した値の一覧 | agent 推定・利用者未確認 | 仕様書の一覧の値で実装した。主なものは次のとおり: 下書きのキー・v1・30 日・800ms、64KB / 256KB / 500 行、`0 17 * * *`、`backups/pre-restore/`、error code 名、バックアップからの復元の本文上限 1KB、`ruleId` の `m-` 接頭辞(長さは §2 で拡張)、サイズの KB 切り上げ、失敗の回のメモ『バックアップの作成に失敗しました』 |
| R-1 空欄が 0 に潰れた既存値 | agent 対処・利用者未確認 | 0051 / 0052 の写しと `settingsJsonFromBackup` は、0 と NULL を写さない。空欄のつもりだった月を『0 円の上書き』にしないため。本当に 0 円を意図していた月も写らないので、その場合は画面で入れ直す必要がある |
| R-2 科目正規化の正本が 2 つになる | agent 対処・利用者未確認 | 旧 PUT も新表へ書く(Q-2)。取込時の正規化は新表を読む |
| R-3 キーの日付が UTC | agent 対処・利用者未確認 | JST の日付に揃えた(Q-10)。切り替えた日に同じ日付が重なった場合は上書きする |
| R-4 退避が 30 日で消えない | agent 対処・利用者未確認 | 削除処理は `pre-restore/` の接頭辞を外した日付で比べる。一覧(`backupListItems`)は退避を出さない。P05 との食い違いは §2 に書いた |
| R-5 失敗マーカーで同じ日付が 2 行出る | agent 対処・利用者未確認 | 一覧は同じ日付に成功と失敗があれば成功を採る。失敗の回は size null・理由つきで返し、比較・復元を無効にする |
| R-6 `toCsv` の式文字 | agent 対処・利用者未確認 | 文字列セルの先頭が = + - @ なら `'` を前に付ける。数値セル(負数を含む)とセルの途中の = は変えない。文字列として出していた負数の表記は `'` 付きに変わる |
| R-7 既存テストが全データ置換を固定 | agent 対処・利用者未確認 | `packages/web/src/backup-restore.dom.test.tsx` を書き換え、確定すると設定だけの経路へ `baseSavedAt` 付きで送り、`/api/restore` には流さないことを固定した |

## 5. 配信(P13)

配信は単一の PR で行い、web ビルド・Worker・D1 migration 0051〜0053・cron の変更(`wrangler.jsonc` の `crons` を `["0 17 * * *"]`、JST 2:00)を同時に出す。手順は Migrate(0051→0052→0053 を適用)→ Deploy の順にする。Deploy が先に走ると `schema-guard.ts` の `EXPECTED_D1_MIGRATION`(`0053_settings_change_log.sql`)と合わず、api が止まる。

migration は表を足して写すだけなので、戻すときは PR の revert と cron の 1 行を戻すだけで済む。表は消さない。旧表は書き換えていないため、revert 後も旧経路は同じ値を読む。

merge の直前に origin/main を fetch し直し、0051〜0053 がまだ空いているかを確かめる。埋まっていたら次の空き番号へ繰り上げ、`schema-guard.ts`・本書・`docs/data-schema.md` の参照を揃える。

## 6. この決定を古びさせないために

- `packages/core/test/settings-screen.test.ts` は、照合キー・適用順・勘定科目ルールの回帰 0・現金上書きの 4 通り・検証・未保存件数・差分・変更履歴を固定する。fixture は勘定科目 2 行・取引先 7 行で、0 件のまま緑にならないことも確かめる。
- `packages/core/test/settings-json.test.ts` は、設定 JSON の往復・拒否・バックアップ本文からの取り出しを固定する。移行 id が migration と一致することも確かめる。
- `packages/web/src/pages/settings/settings.dom.test.tsx` と `view-model.test.ts` は、画面の構成要素・保存・下書き・409・通信先を固定する。`packages/web/src/backup-restore.dom.test.tsx` は、バックアップから設定だけを戻すことを固定する。
- `packages/api/test/settings-screen.integration.test.ts` と `settings-backups.integration.test.ts` は、revision の競合・変更履歴の追記・復元・夜間処理を固定する。

## 7. 証跡の索引(P11)

受入の各項目から証跡のテストと再現コマンドへ辿るための表。テストは `describe` の見出しで示す。再現コマンドはどれもリポジトリ直下で実行する。**『検証中』は、索引を作った時点で実行結果が揃っていない項目**。

| 記号 | 再現コマンド | 対象 |
|---|---|---|
| C | `pnpm --filter @kanjo/core exec vitest run test/settings-screen.test.ts test/settings-json.test.ts test/transaction-export-contract.test.ts` | core の規則・JSON・CSV |
| A | `pnpm --filter @kanjo/api exec vitest run test/settings-screen.integration.test.ts test/settings-backups.integration.test.ts src/import-lifecycle-pure.test.ts src/index.test.ts` | api の統合テスト・フェンスの分類・schema guard |
| W | `pnpm --filter @kanjo/web exec vitest run src/pages/settings/settings.dom.test.tsx src/pages/settings/view-model.test.ts src/backup-restore.dom.test.tsx` | web の DOM テスト |
| Q | `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @kanjo/web build`、4175 の vite を起動したうえで `pnpm verify:full` | 全体。web の build の中で初期 JS 予算を測る |

| 受入 | 証跡(ファイル › describe) | 再現 | 結果 |
|---|---|---|---|
| AT-01 | settings.dom › 見出しと節 (AT-01・AT-02・AT-20)。パンくず・期間タブ・期間送りは Layout の共通テスト | W | 合格 |
| AT-02 | settings.dom › 見出しと節(節ナビは 8 項目) | W | 合格 |
| AT-03 | settings.dom › 集計ルールと説明パネル (AT-03〜AT-05) | W | 合格 |
| AT-04 | settings.dom › 集計ルールと説明パネル(行を選ぶと説明パネルが出て、× で閉じる)、core › 影響するもの・要約 | W・C | 合格 |
| AT-05 | settings.dom › 集計ルールと説明パネル(元に戻す)、api › settings-screen.integration(`/api/settings/history`) | W・A | 合格 |
| AT-06 | settings.dom › 名義・統計・現金上書き (AT-06) | W | 合格 |
| AT-07 | settings.dom › データ (AT-07・AT-08) | W | 合格 |
| AT-08 | settings.dom › データ(復元はファイルを選ぶまで押せない)、api › settings-screen.integration(復元で取引件数が変わらない) | W・A | 合格 |
| AT-09 | backup-restore.dom › 夜間バックアップから設定を戻す、view-model › 日付・サイズ・バッジ、api › settings-backups.integration(一覧) | W・A | 合格 |
| AT-10 | settings.dom › 保存 (AT-10) | W | 合格 |
| AT-11 | settings.dom › 下書き・リセット・離脱 (AT-11)、保存 (AT-10)(409) | W | 合格 |
| AT-12 | settings.dom › 状態と通信先 (AT-12・AT-22)。375px は headless Chrome の実測(`scrollWidth`=`clientWidth`=375・はみ出し 0・例外 0。2026-09-22) | W | 合格 |
| AT-13 | core › 取引先ルールの適用(BR-07〜BR-09・AT-13)、勘定科目ルール(BR-05)、現金上書き(BR-12〜BR-14・AT-13) | C | 合格 |
| AT-14 | api › settings-screen.integration(古い `baseSavedAt` の 409・変更履歴の追記・history) | A | 合格 |
| AT-15 | api › settings-screen.integration(JSON の往復・4xx・自動退避)、core › settings-json(書き出し → 検証の往復・拒否) | A・C | 合格 |
| AT-16 | api › settings-backups.integration(scheduled・失敗の回・比較・設定だけの復元) | A | 合格 |
| AT-17 | api › settings-screen.integration(0051〜0053 の写し)、`src/index.test.ts`(`EXPECTED_D1_MIGRATION`)、core › settings-json(移行 id が migration と同じ) | A・C | 合格 |
| AT-18 | `src/import-lifecycle-pure.test.ts` › canonical mutation lease predicate、api › settings-screen.integration(401・413・不正入力) | A | 合格 |
| AT-19 | core › transaction-export-contract(BR-30 の 3 件) | C | 合格 |
| AT-20 | settings.dom › 見出しと節(既存の機能はアカウントとその他の管理の節に入っている)、既存の DOM テスト | W | 合格 |
| AT-21 | 直書き色の lint・typecheck・初期 JS 予算・verify:full | Q | 合格 |
| AT-22 | settings.dom › 状態と通信先(通信先は /api だけ) | W | 合格 |

成功状態 S1〜S5 は AT の束で判定する。

| 成功状態 | 束ねる受入 | 結果 |
|---|---|---|
| S1 構成要素・節ナビ 8 項目・直書き色 0・375px | AT-01〜04・06・07・09・12・20・21 | 合格 |
| S2 core の 1 か所・優先順位・現金の 4 通り・正規化の回帰 0 | AT-13・19・22 | 合格 |
| S3 1 回の保存・409・追記のみの履歴・元に戻す | AT-05・10・11・14・18 | 合格 |
| S4 JSON の往復・不正の拒否・JST 2:00・比較と設定の復元 | AT-08・09・15・16 | 合格 |
| S5 追加のみの migration・外部送信 0・既存機能を残す・verify:full | AT-17・20・21・22 | 合格 |

- 「合格」の列は 2026-09-22 の実行結果による。core 1057 件(6 件 skip)・api 871 件・web 944 件(`settings.dom.test.tsx` 19 件・`view-model.test.ts` 9 件を含む)が緑で、api の新しい統合テストは `settings-screen.integration` 18 件・`settings-backups.integration` 7 件。typecheck・lint(`security:content` を含む)・初期 JS 予算(107.65KiB / 110KiB)・`verify:full` は exit 0。仕様書の判定規則のとおり、未実施・一部適合の項目は合格にしない。

## 8. 独立最終レビュー(P10)

scope_out の各項目を差分から確かめた。侵犯は 0 件だった。

| scope_out | 確かめた方法 | 結果 |
|---|---|---|
| 取引データの復元形式の変更 | 全データ JSON の取引部分の型・`POST /api/restore` の取引の write-set に差分が無い。設定の復元は別の経路(`restoreSettings`)で、取引に触れない | 無し |
| 仕分けルール・ベンダー記憶の意味の変更 | 集計ルール(取引先)は仕分けルールより下位に入るだけで、仕分けルール・ベンダー記憶の表と照合の変更が 0 件。保存済みの明細は書き換えない | 無し |
| 共通シェルの作り直し | `Layout.tsx` の差分はログアウトで下書きを消す行だけ。`ConfirmDialog.tsx` は `confirmDisabled` を足しただけ | 無し |
| 外部 LLM・外部送信 | 差分に外部 host への fetch・SDK の追加が 0 件。DOM テストが fetch の宛先を `/api` だけに固定する(AT-22) | 無し |
| 複数テナント化・専用アプリ | 新表の主キーの先頭は既存と同じ `user_id` で、テナント列・アプリの追加が 0 件 | 無し |
| 保持 30 日の変更 | `BACKUP_RETENTION_DAYS` は 30 のまま。削除の範囲を退避と失敗マーカーへ広げたが、日数は変えていない(§2) | 無し |
| バックアップからの全データ復元 | バックアップの節の復元は設定 4 種だけ。`backup-restore.dom.test.tsx` が `/api/restore` へ流さないことを固定する | 無し |
| 既存 API の削除 | `GET/PUT /api/settings`・owner-labels・`GET /api/backups/:date`・`POST /api/restore`・`/api/export/*` の削除行が 0 件 | 無し |
| 既存表 `account_norm_map`・`cash_overrides` の削除・書き換え | 0051〜0053 に旧表への DROP・ALTER・UPDATE・DELETE・INSERT が 0 件。旧表は読んで写すだけ | 無し |

## 9. 状態と証跡

- web のテストは 944 件が緑(`settings.dom.test.tsx` 19 件・`view-model.test.ts` 9 件を含む)。
- core の記号 C のコマンドは 3 ファイル・60 件が緑(2026-09-22 の実測)。
- api のテストは 871 件が緑(`settings-screen.integration` 18 件・`settings-backups.integration` 7 件を含む)。
- typecheck・lint・初期 JS 予算(107.65KiB / 110KiB)・`verify:full` は exit 0(2026-09-22 の実測)。
- 375px は headless Chrome の実測で、`/settings` の横はみ出し 0・実行時例外 0。
