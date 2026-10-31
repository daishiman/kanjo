# 一括保存と取引一覧の改善 — 検証の記録

`specs/spec-classify-bulk-save.md` の受け入れ条件を、どのテストがどう確かめたかの記録。
phase ごとに節を足す。旧実装は置換前の main (9b5bbf3) を別の worktree に置き、
新しいテストだけを写して走らせた。

## P04 テストの移し替えと新しい契約のテスト (SYS-CLASSIFY-BULK-P04)

記録: 2026-10-02T04:56:32Z

### 新しい契約のテストが旧実装で落ちること

新旧どちらの実装でも答えが同じ検査は既存のテストに残し、答えが変わる検査だけを新しい検査として置いた。
下の件数は、旧実装に新しいテストを写して走らせたときの失敗の数である。

| テスト | 今の実装 | 旧実装 | 旧実装で落ちる理由 |
|---|---|---|---|
| `packages/core/test/classify-bulk-resolve.test.ts` | 全件通過 | 29 件失敗 | 解決関数が core に無い。旧い web の値決めは状態を見ずに提案を使い、確定済みの手の値を巻き戻す |
| `packages/core/test/no-category-contract.test.ts` | 全件通過 | 8 件失敗 (1 件通過) | 予約の値『カテゴリなし』を持たない |
| `packages/core/src/classify-status.test.ts` | 全件通過 | ファイルごと失敗 | `no-category.js` が無い |
| `packages/core/test/settings-json.test.ts` | 全件通過 | 8 件失敗 (11 件通過) | 設定ファイルの版 2 と対応表を持たない |
| `packages/api/test/classify-bulk-save.integration.test.ts` | 19 件通過 | 14 件失敗 | 一括指定・行 key・外す行と理由・クエリ予算の台帳が無い |
| `packages/api/test/classify-selected.integration.test.ts` | 2 件通過・8 件失敗 (P05 で通す) | 8 件失敗 (2 件通過) | 選択の読み出しが無く、一覧の limit が 25/50/100 に限られない。route は P05 が作る |
| `packages/api/test/tax-account-map.integration.test.ts` | 全件通過 | ファイルごと失敗 | 対応表の表と route が無い |
| `packages/api/test/tax-account-map-migration.integration.test.ts` | 全件通過 | ファイルごと失敗 | migration 0059・0060 が無い |
| `packages/api/test/settings-screen.integration.test.ts` | 22 件通過 | 5 件失敗 (17 件通過) | 書き出しが版 1 で、版 2 を拒み、対応表を持たず、予約の値の候補を作れてしまう |
| `packages/api/test/settings-backups.integration.test.ts` | 9 件通過 | 3 件失敗 (6 件通過) | 夜間バックアップの本文が対応表を運ばず、比較と復元も対応表を読まない |
| `.github/scripts/plan-auto-migration.test.mjs` | 56 件通過 | 2 件失敗 | 0060 の本文と承認ファイルの sha256 の組が無い |
| `packages/api/src/schema-guard.test.ts` | 全件通過 | 1 件失敗 | 期待する head が 0060 ではない |
| `packages/api/src/deletion-schema.test.ts` | 全件通過 | 1 件失敗 | 期待する head が 0060 ではない |

旧実装で落ちた検査の名前:

- `settings-screen`: 「AT-15 書き出した JSON を復元すると設定が一致し…」(版が 1)、AC-17 の 3 件 (版 2 で書き出して復元すると対応表が戻る・版 1 のファイルは初期の 5 行になる・対応表を持つ版 1 と版 3 は 400)、「BR-04 候補の作成と名前の変更に予約の値を使うと 400 reserved_category」(201 が返った)
- `settings-backups`: 「AT-16 夜間バックアップは JST の日付のキーに…置く」(要約に対応表の行数が無い)、AC-17 の 2 件 (夜間バックアップは対応表を運ぶ・対応表を持たない古い本文は初期の 5 行として比べる)
- `plan-auto-migration`: 「0060 の作り直しは破壊的な変更として検出される」「追加だけの 0059 と承認済みの 0060 は、まとめて自動適用へ回る」

### 旧い名前をテストから消したこと

`resolveBulkItem`・`inputFromRow`・`legacyBasisLabel` と D1 上限の旧い定数
(`D1_FREE_QUERY_LIMIT`・`SCHEDULED_D1_QUERY_LIMIT`・`CLASSIFY_BATCH_STATEMENTS`・`MAX_BATCH_STATEMENTS`) を、
`packages/` のテスト (コメントを含む) で grep し、0 件であることを確かめた。

- `packages/api/src/scheduled-maintenance-budget.test.ts` と `packages/api/src/import-lifecycle-pure.test.ts` は
  `d1-limits.ts` の `D1_INVOCATION_QUERY_LIMIT`・`D1_BATCH_STATEMENT_LIMIT` へ移した。
  今の実装で 27 件通過・0 件失敗。旧実装では `d1-limits.ts` が無いので落ちるが、これは名前の移し替えで、契約の変化ではない。
- `packages/web/src/pages/classify/view-model.test.ts` は、初期値を作る関数を通さず、入力の字面で判定を確かめる形にした
  (26 件通過・0 件失敗)。開いた直後の初期値 (未整理は提案、確定済みは今の値、提案が無い未整理は外す) は
  core の解決関数の「土台の組 (AC-02)」の検査が表す。web の旧い一括保存の値決めの検査は、core の同じ検査と重なるので外した。
- 実装の呼び出し元 (`ClassifyPage.tsx`・`EditPanel.tsx`・`view-model.ts`) は P05、定義の削除は P08 が担う。

### 画面のテストを P05 の画面と同じ周回で書くこと

AC-01・03・04・08〜10・18〜20 と対応表の追加と削除の画面テスト
(`packages/web/src/pages/classify/classify.dom.test.tsx`・`packages/web/src/pages/settings/settings.dom.test.tsx` ほか) は、
一括バー・内訳・選択一覧という、まだ無い画面の文言と role に依存する。
画面を作る前に selector を推測で決めると、P05 で契約ごと書き換えることになるので、
画面テストは P05 で画面より先に書き、旧実装で落ちる件数を P05 の節に記録する。

### AC-22 を P06・P07 で確かめる理由

AC-22 (/classify を 1264px と 1280px で開くと、6 列が最小幅以上、本体の横はみ出しが 0、編集パネルを閉じると一覧が広がる) は、
ブラウザが実際に描いた幅を測る検査である。jsdom は layout を計算しないので、vitest のテストでは確かめられない。
測る道具の `check:classify-screen` (`KANJO_VISUAL_SCOPE=classify`) は P05 で新しく作るので、この phase の先行テストの対象から外し、
P06 (verify:full の中の `check:classify-screen`) と P07 (受入) で確かめる。

D1 のクエリの本数 (AC-27: 50 件と 100 件の保存で、どちらも 49 本以内) は、この phase の `classify-bulk-save.integration.test.ts` が段ごとの台帳で固定する。

### タスク仕様の表記の誤り

タスク仕様は候補の route を `/api/settings/category-options` と書いているが、実際の path は `/api/category-options` である。
テストは実際の path で書いた。対応表の追加 (`POST /api/settings/tax-account-map`) は 201 ではなく 200 を返す。

## P06 品質ゲートの通し (SYS-CLASSIFY-BULK-P06)

記録: 2026-10-02T12:38:16Z (`date -u` の実測)

### verify:full の通し

`pnpm run verify:full` は test → typecheck → lint → build → 画面検査 10 段 → preview:smoke を `&&` でつなぐので、
通しの exit code 0 は全部の段の exit code 0 を含む。

| 回 | 開始 | 終了 | exit code | 止まった段 |
|---|---|---|---|---|
| 1 回目 | 2026-10-02T11:37:04Z | 2026-10-02T11:59:30Z | 1 | `check:financial-routes` (下の「504 の切り分け」) |
| 2 回目 | 2026-10-02T12:11:27Z | 2026-10-02T12:35:35Z | 0 | なし (preview:smoke まで全段) |

1 回目の後、止まった段から後ろだけを 12:03:08Z〜12:06:07Z に走らせて exit code 0 を得た。
ただし段を分けた結果は通しの代わりにせず、2 回目を最初から通した。

2 回目の各段の結果:

| 段 | 結果 |
|---|---|
| test (core) | 70 ファイル通過・1 ファイル skip、1374 件通過・6 件 skip |
| test (api) | 80 ファイル・1177 件通過 (1029.60 秒) |
| test (web) | 101 ファイル・1282 件通過 (176.11 秒) |
| test:aux | runbooks・guard-real-data・github-scripts (56 件)・seed-admin (4 件)・skills:test・delivery (43 件) が通過 |
| typecheck | exit code 0 |
| lint | exit code 0。biome、migration の承認、skills の同期、用語集 (55 語・表記ゆれの別名 147 件)、design tokens、design-system の 3 検査、security:content を含む |
| build | 初期 JS 108.45KiB / 110KiB、Total Upload 2538.00 KiB / gzip 589.30 KiB、`wrangler deploy --dry-run` 通過 |
| 画面検査 | `check:thead`〜`check:classify-screen` の 10 段がすべて合格 |
| preview:smoke | 1 件通過 (一時の local D1 で、migration から認証・現金記帳の作成・一覧・削除・空の一覧・廃止 API の 404 まで) |

core の skip 1 ファイル・6 件は、`packages/core/test/real-data-regression.test.ts` の `describe.skipIf(!path)` である。
実データが無い環境では走らない既存の検査で、最後に変わったのは #19 である。
この feature の差分 (`git diff HEAD`) と未追跡の新しいテストファイルを grep し、
`.skip`・`.only`・`skipIf`・`runIf`・`todo` を足した行が 0 件であることを確かめた。

### 504 の切り分け

1 回目の `check:financial-routes` は、`/analysis/matrix` の描画待ちでタイムアウトした。
失敗した資源は `node_modules/.vite/deps/chart__js.js?v=...` の 504 である。

原因は、2 つの vite が同じ deps の置き場所を使っていたことにある。

- 画面検査は、verify:full の前に起動しておく 4175 の vite (開発サーバ) を開く。
- `check:financial-figure` の段 (`check-mobile-financial-layout.mjs` の `renderFigureMarkup`) は、`createServer` で別の vite を立てる。
- どちらも cacheDir を指定せず、既定の `node_modules/.vite` を使う。
- 後者が deps を作り直すと、4175 の画面が前の版の hash で chunk を要求し、504 が返る。

2 回目は、4175 の vite だけ cacheDir を作業用の場所へ分けて起動し、画面検査 10 段がすべて合格した。
spec の契約、テストの判定、検査の閾値は変えていない。
恒久対策 (`renderFigureMarkup` の `createServer` に専用の cacheDir を渡す) は本 feature の範囲の外なので、別 feature の候補として返す。

### 1264px と 1280px (AC-22)

2 回目の `check:classify-screen` の実測 (単位は px、行は 50 行、列は左から 6 列)。
1264px と 1280px の列の最小幅は `[44, 92, 120, 96, 120, 84]` で、検査はどれか 1 列でも下回れば失敗にする。

| 幅 | 本体 (描画幅/画面幅) | 一覧 (パネル閉/開) | 列 (パネル閉) | 列 (パネル開) | 一括バー (高さ/画面高) |
|---|---|---|---|---|---|
| 1264 | 1249/1249 | 553 / 373 | 44/92/120.8/96/123.2/84 | 44/92/120.8/96/123.2/84 | 218/900 |
| 1280 | 1265/1265 | 569 / 389 | 44/92/127.8/96/125.2/84 | 44/92/120.8/96/123.2/84 | 218/900 |

- 6 列は、パネルを開いても閉じても最小幅以上である。
- 本体の描画幅は画面幅と同じで、横のはみ出しは 0 である。
- パネルを閉じると一覧が 180px 広がる (1264px は 373→553、1280px は 389→569)。
- キーボードで先頭から順にフォーカスを移すと、移った先は一括バーにも編集パネルにも覆われない (パネル閉で 114 か所中 114 か所、開で 131 か所中 131 か所が見える)。

390px・768px・1024px も同じ段で合格した。

### P04 の節の訂正

P04 の節「AC-22 を P06・P07 で確かめる理由」は、初めは AC-22 を「本番相当の件数でクエリの本数と所要時間が上限に収まる」と書いていた。
spec の AC-22 は 1264px・1280px の画面の検査で、クエリの本数は AC-27 である。
P06 で、節の本文を spec の字面に合わせて直した。

### 通しの後に足したテスト

2 回目の通しの後、BR-04 の解釈 (decisions §5「実装で spec の字面を解釈した点」) を固定するテストを
`packages/api/test/classify-bulk-save.integration.test.ts` に 1 件足した。
今の値が『カテゴリなし』の明細へ、編集パネルと同じ全欄の要求でその値を送り返し、メモだけを直せることを見る。

- そのファイルだけを走らせて 21 件通過。
- 送り返しを通す条件 (`!isNoCategory(cur.big)`) を外した実装では、この 1 件だけが 400 で落ちた (20 件通過・1 件失敗)。実装をバックアップから戻し、sha256 が壊す前と同じであることを確かめた。
  この条件は後の指摘 H で、上書きの層 (`cur.big`) から今の値 (取込値を含む解決済みの値) に直した (decisions「レビューの差し戻しで直したこと」)。
- 足した後の typecheck と lint は exit code 0 (12:38)。
- api の件数は 1178 件になる。P08 の定義の削除の後に、verify:full をもう一度最初から通す (§3)。

### 別 feature の候補として返すもの

- OI-7: `.github/workflows/ci.yml` は画面検査を走らせない。本 feature の画面検査はローカルの verify:full で通したが、CI では確かめていない。
- 504: `renderFigureMarkup` の `createServer` が cacheDir を指定せず、4175 の vite と deps の置き場所を共有する。

## P08 旧い定義の削除と migration の突き合わせ (SYS-CLASSIFY-BULK-P08)

記録: 2026-10-02T13:57:14Z (`date -u` の実測)

### 消した定義

P08 で消したのは、D1 の上限を表す旧い定数 3 つである。
呼び出し元は P04・P05 が `packages/api/src/d1-limits.ts` の 2 つの定数へ移していたので、P08 の時点では定義だけが残っていた。

| ファイル | 消した定義 | HEAD (9b5bbf3) で参照していた所 | 今の参照先 |
|---|---|---|---|
| `packages/api/src/import-lifecycle.ts` | `D1_FREE_QUERY_LIMIT = 50` とその説明の行 | `deletion-lifecycle.ts`・`import-diff.ts`・`routes/vendor-memory.ts`・`routes/cash.ts` | `D1_INVOCATION_QUERY_LIMIT` (1 回の呼び出しのクエリの上限) |
| `packages/api/src/scheduled-maintenance-budget.ts` | `SCHEDULED_D1_QUERY_LIMIT = 50` | `scheduled-maintenance-budget.test.ts` | `D1_INVOCATION_QUERY_LIMIT`。受け付ける上限は `SCHEDULED_D1_QUERY_ACCEPTED_MAX = D1_INVOCATION_QUERY_LIMIT - 1` の式で残した |
| `packages/api/src/routes/classify.ts` | `CLASSIFY_BATCH_STATEMENTS = 50` とその説明の行 | 同じファイルの集約置換の判定 | `D1_BATCH_STATEMENT_LIMIT` (1 回の batch の文の上限) |

残りの 4 つは、P05 が呼び出し元を移したときに定義ごと消えていた。P07 の時点で grep は 0 件だった。

| 名前 | HEAD (9b5bbf3) での所在 |
|---|---|
| `legacyBasisLabel` | `packages/core/src/overview.ts` |
| `inputFromRow`・`resolveBulkItem` | `packages/web/src/pages/classify/view-model.ts` (呼び出し元は `ClassifyPage.tsx`・`EditPanel.tsx`・`view-model.test.ts`) |
| `MAX_BATCH_STATEMENTS` | `packages/api/src/routes/classify-bulk.ts` |

task 仕様は 7 つの削除をすべて P08 に置いているが、実際には 4 つを P05 が消した。
呼び出し元を移すと定義を残す理由が無くなるためである。P08 は残りの 3 つを消し、7 つ全部が 0 件であることを確かめた。

`packages/` の下を、node_modules・dist・.wrangler を除いて拡張子を絞らずに grep した (コメントを含む)。

| 名前 | 件数 |
|---|---|
| `resolveBulkItem` | 0 |
| `inputFromRow` | 0 |
| `legacyBasisLabel` | 0 |
| `D1_FREE_QUERY_LIMIT` | 0 |
| `SCHEDULED_D1_QUERY_LIMIT` | 0 |
| `CLASSIFY_BATCH_STATEMENTS` | 0 |
| `MAX_BATCH_STATEMENTS` | 0 |

名前が残っているのは文書 (specs・architecture・docs・tasks・.dev-graph と仕様の章の archive) だけで、コードからの参照は無い。

### migration の突き合わせ (OI-6)

番号・承認の sha256・`EXPECTED_D1_MIGRATION` のどれも**変更なし**。

| 項目 | 値 |
|---|---|
| 突き合わせた origin/main | `9b5bbf3502a526246d2e283ffd42d0cdaa0f55dd` (fetch し直した後も HEAD と同じで、`HEAD..origin/main` は 0 件) |
| origin/main の migrations の最後 | `0058_subscription_merge_operations.sql` |
| 本 feature が足す migration | `0059_tax_account_map.sql`・`0060_settings_change_log_target.sql`。番号の重複は無い |
| 0059 の sha256 | `7265ccffb6874b1ce326d2067d43a12c721fe691d3d6d4c2bcf0925cc7019e78`。既存の行を書き換えないので承認は要らない (ファイルの 7 行目のコメントに書いてある) |
| 0060 の sha256 | `05886f213b91aa700eadcb2afe93f6c44386e365702af22bf010bfc90599d0fc`。表の作り直し (新表 → 写し → DROP → RENAME) なので承認が要り、`.github/migration-approvals.json` の値と一致する |
| 承認ファイル | baseline は `0056_settings_change_log.sql`。approvals は 0057 と 0060 の 2 件。HEAD との差分は 0060 の 1 件 (6 行) の追加だけで、過去の承認は書き換えていない |
| `EXPECTED_D1_MIGRATION` | `packages/api/src/schema-guard.ts` の 4 行目が `'0060_settings_change_log_target.sql'`。`packages/api/src/deletion-schema.test.ts` が同じ値と migrations の最後との一致を固定している |
| 開いている PR | 0 件 |
| リモートのブランチ | 17 本。どのブランチの migrations も最後は 0058 以下で、0059・0060 を持つブランチは無い |

merge の直前に origin/main を取り直して、P13 がもう一度確かめる。

### テストと品質ゲート

| コマンド | exit code | 結果 |
|---|---|---|
| migration の 5 ファイル (下の表) | 0 | 65 件通過 |
| `pnpm run github-scripts:test` | 0 | 8 suite・56 件通過 (`plan-auto-migration.test.mjs` を含む) |
| `pnpm run verify:full` | 0 | 2026-10-02T13:30:01Z に開始し 13:55:44Z に終了 (約 25 分 43 秒)。全段通過 |

| テストファイル | 件数 |
|---|---|
| `packages/api/test/tax-account-map-migration.integration.test.ts` | 7 |
| `packages/api/src/deletion-schema.test.ts` | 23 |
| `packages/api/src/import-lifecycle-pure.test.ts` | 23 |
| `packages/api/src/scheduled-maintenance-budget.test.ts` | 4 |
| `packages/api/src/schema-guard.test.ts` | 8 |

`verify:full` の段ごとの結果は次のとおり (ログの集計行から写した)。

| 段 | 結果 |
|---|---|
| test (core) | 71 ファイル中 70 通過・1 スキップ。1385 件中 1379 通過・6 スキップ (2.89s)。スキップは `packages/core/test/real-data-regression.test.ts` の 6 件で、実データ (git 管理外) が無いときは `describe.skipIf` で飛ばす設計。本 feature はこのファイルを変えていない |
| test (api) | 80 ファイル・1178 件通過 (1139.71s) |
| test (web) | 101 ファイル・1282 件通過 (165.22s) |
| test:aux | runbooks・guard-real-data が通過。github-scripts 56 件、seed-admin 4 件、skills 36 件、delivery 43 件がすべて通過 |
| typecheck | core・api・web (本体と test 用の tsconfig) とも型エラー 0 |
| lint | biome は 784 ファイルで指摘 0。migration の承認、skills の配布先、用語集 55 語、レポート CSS、graph-lineage 206 ノード、デザイントークン (色の直書き 0 件・293 ファイル)、design-system の文書契約、run-reference が一致。続く security:content も OK |
| build | 初期 JS 108.45KiB / 110KiB。Total Upload 2538.12 KiB / gzip 589.31 KiB |
| 画面検査 10 段 | check:thead・mobile-layout・financial-figure・financial-routes・ai-screen・analysis-hub・cash-screen・guide-screen・improvement-screen・classify-screen がすべて合格 |
| preview:smoke | 1 件通過 (一時の local D1 に migration を当て、SPA・認証・現金の作成/一覧/削除・空の一覧・廃止 API の 404 を確かめる) |

classify-screen の段は 390px・768px・1024px・1264px・1280px で、どの幅も行 50 件、本体の幅が画面の幅と一致した (1264px は 1249/1249px、1280px は 1265/1265px)。
check:financial-routes は 4175 番の vite に接続する。今回は `vite.config.ts` を読み込んで cacheDir だけを `<scratchpad>/` へ分けた設定で起動した。
check:financial-figure が `node_modules/.vite` を作り直すと、同じ cacheDir を使う 4175 の vite が依存を見失うためである。

この通しは、P06 の通し (2026-10-02T12:35:35Z に終了) より後のものである。
P06 の後に足した BR-04 のテスト 1 件、acceptance §2 の再現で見つけた解決関数の修正 (P05・P04 へ差し戻した分)、P08 の削除をすべて含む。

## P09 品質ゲート (SYS-CLASSIFY-BULK-P09)

記録: 2026-10-02T14:08:16Z (`date -u` の実測)

### 受け入れ条件と結果

| 受け入れ条件 | 結果 | 根拠 |
|---|---|---|
| `pnpm lint`・`pnpm typecheck`・`pnpm test`・`pnpm run skills:test` が exit 0 | 満たす | P08 の節の `verify:full` (2026-10-02T13:30:01Z〜13:55:44Z、exit 0)。`pnpm test` の中の test:aux が skills:test (36 件) を含む。通しの後に記録文書の用語を直したので、lint は単独で回し直して exit 0 |
| `build:bundle` の直後の `check:js-budget` が 110KiB 以内で、値を記録する | 満たす | 108.45KiB / 110KiB (下の表) |
| `pnpm run security:content` が exit 0、色の hex の直書き 0 件、記録と差分に実データと secrets 0 件 | 満たす | 下の「内容の安全検査」 |

落ちた段は無く、P04・P05 への差し戻しも無い。

### 初期 JS 予算

`pnpm --filter @kanjo/web run build:bundle` の直後に `pnpm --filter @kanjo/web run check:js-budget` を回した (どちらも exit 0、2026-10-02T13:58:48Z〜13:59:15Z)。
HEAD の値は、HEAD (9b5bbf3) を置いた別の作業ツリーで同じ 2 つのコマンドを回して測った。

| 対象 | HEAD (9b5bbf3) | 本 feature | 差 |
|---|---|---|---|
| 初期 JS (`index-*.js`) | 108.44KiB | 108.45KiB | +0.01KiB |
| 仕分け画面の chunk (`ClassifyPage-*.js`) | 35.95 kB (gzip 11.42 kB) | 46.58 kB (gzip 14.77 kB) | +10.63 kB |
| 仕分け画面の CSS (`ClassifyPage-*.css`) | 5.68 kB | 8.92 kB | +3.24 kB |

一括操作バーと保存前の確認は、仕分け画面を開いたときに読み込む chunk に入る。初期 JS はほとんど増えておらず、予算の値も変えていない。
予算の残りは 1.55KiB である。次に初期 JS へ載る部品を足す feature は、遅延読み込みを前提に設計する必要がある。

### 内容の安全検査

| 検査 | 結果 |
|---|---|
| `pnpm run security:content` | exit 0 (「公開文書の実データ参照チェック: OK」) |
| 色の直書き (`pnpm lint` の check-design-tokens) | hex・rgb・hsl・color-mix の直書き 0 件 (293 ファイル) |
| 差分のパス (作業ツリーの 201 件。未追跡の 89 件を含む) | `data/` の下 0 件、`packages/api/.dev.vars` 0 件、`.env` 系 0 件、samples の外の csv・xlsx 0 件、`private/` の下 0 件、鍵ファイル (pem・key・p12) 0 件 |
| 差分の追加行と、未追跡ファイルの本文 | AWS・GitHub・Slack のトークン、API key、秘密鍵、JWT、seed のパスワードはどれも 0 件 |
| 同じ走査で当たったもの | パスワードの代入 2 件と `@example.test` のアドレス 3 件。どれも結合テストが一時ユーザーを作るための架空の値で、HEAD のテストと同じ形である (架空のパスワードは HEAD の 4 ファイル、`@example.test` は 19 ファイルが使う) |

差分の走査は、`git diff HEAD` の追加行 (`+` の行) と `git ls-files --others --exclude-standard` の各ファイルの本文を、上の種類の正規表現で調べた。
既存の行を再掲した行は数えていない。走査のスクリプトは `<scratchpad>/` に置き、リポジトリには入れていない。

## P13 リリース前の最終確認 (SYS-CLASSIFY-BULK-P13)

記録: 2026-10-02T17:39:07Z (`date -u` の実測)

merge の前に確かめた事項 (手元の品質ゲートの exit code と、migration の突き合わせ) だけを書く。
merge・deploy・本番の /classify の確認は、PR の最後のコメントに書く (このリポジトリには書かない)。

### verify:full の通し

`pnpm run verify:full` は test → typecheck → lint → build → 画面検査 10 段 → preview:smoke を `&&` でつなぐ。
`pnpm test` と `pnpm typecheck` はこの通しの中の段なので、通しの exit code 0 が両方の exit code 0 を含む。

| 開始 | 終了 | exit code | 止まった段 |
|---|---|---|---|
| 2026-10-02T17:15:47Z | 2026-10-02T17:37:57Z | 0 | なし (preview:smoke まで全段) |

各段の結果 (ログの集計行から写した):

| 段 | 結果 |
|---|---|
| test (core) | 71 ファイル中 70 通過・1 スキップ。1401 件中 1395 通過・6 スキップ (2.22s)。スキップは `packages/core/test/real-data-regression.test.ts` の 6 件で、実データ (git 管理外) が無いときは `describe.skipIf` で飛ばす既存の検査 |
| test (api) | 80 ファイル・1192 件通過 (954.89s) |
| test (web) | 101 ファイル・1284 件通過 (153.47s) |
| test:aux | runbooks・guard-real-data が通過。github-scripts 56 件 (8 suite)、seed-admin 4 件、skills 36 件、delivery 43 件がすべて通過 |
| typecheck | core・api・web (本体と test 用の tsconfig) とも型エラー 0 |
| lint | biome は 784 ファイルで指摘 0。破壊的な migration の承認、skills の配布先、用語集 55 語 (表記ゆれの別名 147 件)、レポート CSS、graph-lineage 206 ノード、デザイントークン (色の直書き 0 件・293 ファイル)、design-system の文書契約と配布、run-reference が一致。続く security:content も OK |
| build | 初期 JS 108.44KiB / 110KiB。仕分け画面の chunk は 46.72 kB (gzip 14.85 kB)、CSS は 8.92 kB。Total Upload 2539.52 KiB / gzip 589.78 KiB。`wrangler deploy --dry-run` 通過 |
| 画面検査 10 段 | check:thead・mobile-layout・financial-figure・financial-routes・ai-screen・analysis-hub・cash-screen・guide-screen・improvement-screen・classify-screen がすべて合格 |
| preview:smoke | 1 件通過 (一時の local D1 に migration を当て、SPA・認証・現金の作成/一覧/削除・空の一覧・廃止 API の 404 を確かめる) |

classify-screen の段は 390px・768px・1024px・1264px・1280px で、どの幅も行 50 件、本体の幅が画面の幅と一致した (1264px は 1249/1249px、1280px は 1265/1265px)。
初期 JS は P09 の節の測定 (108.45KiB) との差が 0.01KiB で、予算の残りは 1.56KiB。予算の値は変えていない。

この通しは、P10 の差し戻し (指摘 A・D・G・H) を直した後のコードと、P12 で文書を同期した後の作業ツリーで回した。
4175 の vite は、P08 の通しと同じく cacheDir だけを `<scratchpad>/` へ分けた設定で起動した (P06 の節の「504 の切り分け」)。

### migration の突き合わせ (OI-6)

2026-10-02T17:16:05Z (通しの開始の直後) と 17:39:18Z (通しの終了の後) の 2 回、origin/main を取り直して突き合わせた。2 回とも同じ値だった。番号・承認の sha256・`EXPECTED_D1_MIGRATION` のどれも、P08 の節の「migration の突き合わせ (OI-6)」から**変更なし**。

| 項目 | 値 |
|---|---|
| 突き合わせた origin/main | `9b5bbf3502a526246d2e283ffd42d0cdaa0f55dd`。HEAD と同じで、`HEAD..origin/main` も `origin/main..HEAD` も 0 件 |
| origin/main の migrations の最後 | `0058_subscription_merge_operations.sql` |
| 本 feature が足す migration | `0059_tax_account_map.sql`・`0060_settings_change_log_target.sql`。番号の重複は無い |
| 0059 の sha256 | `7265ccffb6874b1ce326d2067d43a12c721fe691d3d6d4c2bcf0925cc7019e78`。既存の行を書き換えないので承認は要らない |
| 0060 の sha256 | `05886f213b91aa700eadcb2afe93f6c44386e365702af22bf010bfc90599d0fc`。`.github/migration-approvals.json` の値と一致し、`approved_by` は `daishiman` |
| 承認ファイル | baseline は `0056_settings_change_log.sql`。origin/main の approvals は 0057 の 1 件で、本 feature が 0060 の 1 件を足す。0059 は載せない |
| `EXPECTED_D1_MIGRATION` | `packages/api/src/schema-guard.ts` の 4 行目が `'0060_settings_change_log_target.sql'` |
| 開いている PR | 0 件 |
| リモートのブランチ | 17 本 (`origin/HEAD` を除く)。どのブランチも migrations の最後は 0058 以下で、0059 以降を持つブランチは無い |

### 画面検査を CI で走らせないこと (OI-7)

画面検査 10 段 (`check:classify-screen` を含む) は、上の通しの中でローカルで合格した。
`.github/workflows/ci.yml` は画面検査を走らせないので、CI の緑はこの 10 段を含まない。
CI に画面検査の job を足すことは、P06 の節の「別 feature の候補として返すもの」のとおり本 feature の範囲の外である。

### merge の前に残ること

- merge の直前に origin/main が `9b5bbf3` から動いていたら、取り込み直して上の突き合わせと verify:full をやり直す。
- PR を ready にすること、merge、merge の後の deploy と本番の確認は、利用者の指示を待つ。
- PR の本文で OI-1 (表示件数の既定 50・key の上限 200 字・旧形式の受け付け) と OI-4 (新しい持ち主へ初期の 5 行を入れる時機) の判断を依頼する (decisions「§5 未決事項の閉じ方の記録 (P12)」)。
