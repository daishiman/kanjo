# 現金入力画面の規則表

現金入力画面(`/cash`)の規則と、その実装・テストの対応。規則の正本は `specs/spec-cash-screen.md`、判断の経緯は [`design-decisions.md`](design-decisions.md)。規則を変えるときは、この表の行・実装・テストの期待値を同じ変更で直す。

計算は `packages/core/src/cash-screen.ts` の 1 か所に置き、API(`packages/api/src/routes/cash.ts`)と web(`packages/web/src/pages/cash/`)は呼ぶだけにする。

## 画面の計算(core)

| # | 規則 | 実装 | テスト |
|---|---|---|---|
| R1 | 区間(`transitFrom`)があれば交通費入力、`null` なら通常入力 | `cashEntryRoute` | core「入力経路」 |
| R2 | 合計は収入・支出・差額(収入 − 支出)。差額は負にもなる。0 件は 0 | `cashTotals` | core「合計」 |
| R3 | 絞り込みはキーワード・収支・カテゴリ・担当者・入力経路・金額の範囲・日付の範囲の AND。範囲は両端を含み、順序は保つ | `filterCashEntries` / `matchesCashFilter` | core「絞り込み」 |
| R4 | キーワードは NFKC と英字の大小を吸収した部分一致。内容・メモ・カテゴリ大 / 中・駅名・業務の目的に当てる | `normalizeCashKeyword` | core「キーワードは全角英数・大小の違いを吸収し…」 |
| R5 | 交通費の合計は往復なら片道の 2 倍。区間と運賃が揃うまで出さない。上限を超えたらエラー | `transitTotal` / web `transitAmount` | core「交通費の合計」、view-model「交通費の合計は区間と運賃が揃うまで出さない」、DOM「入替で出発駅と到着駅を入れ替え…」 |
| R6 | 1 ページ 20 件。範囲外のページは最後のページに寄せ、0 件は `page=1` | `paginateCash`(`CASH_LIMITS.pageSize`) | core「ページング」 |
| R7 | 選択中の月の既定は今日の月、期間の外なら期間の最後の月。月送りは期間の端で止める | `defaultCashMonth` / `cashMonthNav` | core「月」 |
| R8 | 業務の目的は固定 4 つ(「客先訪問」「打ち合わせ」「仕入れ・買い出し」「研修・セミナー」)と「その他」。その他は `その他:<記述>`(40 字まで)で 1 列に保存。区間があるときだけ必須 | `formatTransitPurpose` / `parseTransitPurpose` / `transitPurposeError` | core「業務の目的」「業務の目的: 区間があるとき必須…」 |
| R9 | 入力の上限: 金額 1〜1,000,000,000 円の整数、内容 60 字、メモ 200 字、駅名 40 字。字数はコードポイントで数える。日付は実在する日だけ | `validateCashInput`(`CASH_LIMITS`)。API の zod も同じ `CASH_LIMITS` を読む | core「入力検証」、統合「不正な入力は 400」 |

## 担当者

| # | 規則 | 実装 | テスト |
|---|---|---|---|
| R10 | 担当者が `NULL` の既存行(0052 より前)は「未設定」と出し、編集では未選択にして保存の前に選ばせる | `CASH_OWNER_UNSET_LABEL` / web `entryToForms` | view-model「担当者が未設定の行 (0052 より前) は未選択で編集に入る」 |
| R11 | 担当者の既定は事業なら `business`、個人なら未選択。事業 / 個人を切り替えたら、既定のままの担当者だけを寄せる。画面では必須。API では担当者と業務の目的を任意にする(0052 より前の SPA の本文を通す互換)。送られれば画面と同じ規則で検査し、POST で無ければ NULL(R10 の「未設定」)、PUT で無ければ今の値を保つ | web `defaultOwnerFor` / `changeSide`。core `validateCashInput(input, { allowUnset })`。API は `z.enum(OWNER_VALUES).optional()` と `keepUnsent` | view-model「事業 / 個人を切り替えると…」、core「allowUnset(API の互換)は…」、統合「0052 より前の SPA の本文…を通す互換」 |

## 削除と戻し(API)

| # | 規則 | 実装 | テスト |
|---|---|---|---|
| R12 | DELETE は `deleted_at` を入れる論理削除で、応答は `{ ok, id, deletedAt }`。restore は同じ id で戻し、削除中でない行には何も書かず 200(冪等)。無い行は 404。`tx_edits` は消さない | `routes/cash.ts` の DELETE / `POST /:id/restore` | 統合「DELETE は論理削除になり、restore で同じ id が戻る」 |
| R13 | 一括は 1〜100 件の正の整数で重複なし(外れたら 400)。1 件でも他人の id・無い id(bulk-delete では削除中の id も)を含めば 404 で何も変えない。全件に同じ `deleted_at` を入れる | `cashBulkIdsError`、`POST /bulk-delete` / `POST /bulk-restore` | core「一括の id」、統合「bulk-delete した 3 件が bulk-restore で戻る」「他の利用者の明細」 |
| R14 | 夜間の完全消去は `deleted_at < now − 30日` の行だけ(ちょうど 30 日は残す)。古い順(`deleted_at, id`)に 1 晩 500 行まで、指している `tx_edits` の `cash:<id>` も同じ batch で消す。上限に達したら `level: "warn"` と `limitReached: true` を出し、残りは翌晩 | `cash-purge.ts` の `runCashSoftDeletePurge` / `cashPurgeLogLine` | 統合「夜間の完全消去」 |
| R15 | 削除中の行は 一覧・合計・取引・集計・バックアップ(明細と、それを指す `tx_edits`)・取込時の設定スナップショット・科目使用状況 に出さず、PUT では 404。JSON 復元の件数判定だけが削除中の行を数え、中身は出さない | 読取 5 経路の `deleted_at IS NULL`([`design-decisions.md`](design-decisions.md) §5) | 統合「削除中の行を読まない条件」、`import-lifecycle.test.ts`「削除中の現金明細だけが残る移行先へは…」 |

## 画面の状態(web)

| # | 規則 | 実装 | テスト |
|---|---|---|---|
| R16 | 入力途中の内容は `kanjo:cash-draft:v1:{userId}` に 500 ms 後に保存し、開き直すと戻す。編集中は保存しない。壊れた値と例外は握る。上限を超える値は上限で切る。ログアウトで全利用者分を消す | core `saveCashDraft` / `loadCashDraft`、web `pages/cash/draft.ts`、`Layout.tsx` の `clearAllCashDrafts` | core「下書き」、DOM「下書き」、view-model「ログアウトでは全利用者の現金の下書きだけを消す」 |
| R17 | URL のキーは `tab` / `month` / `q` / `io` / `category` / `owner` / `route` / `min` / `max` / `from` / `to` / `page`。不正な値は落として既定値に戻し、既定値のキーは付けない。絞り込みを変えたら `page` を 1 に戻す | `readCashUrl` / `writeCashUrl` | core「URL」、DOM「絞り込みの結果だけが 0 件なら…」 |
| R18 | 「両方の入力をクリア」は通常入力・交通費入力の両フォームと保存済み下書きを同時に消す。対象範囲をボタン名に明示し、片方だけが残ると誤認させない | web `CashPage.clearForms` / `NormalEntryCard` | DOM「入力の 500ms 後に利用者ごとに保存し、開き直すと戻る。クリアで消える」 |
