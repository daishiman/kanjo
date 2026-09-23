# 現金入力画面の設計判断

現金入力画面(`/cash`)を作り直したときの判断の記録。対象は feature `feat-cash-screen`(Beads epic `kanjo-tf6`、子タスク SYS-CASH-P01〜P13)。画面仕様の正本は `specs/spec-cash-screen.md`、アーキテクチャは `architecture/cash-*.md` の 8 章。規則と実装・テストの対応は [`rules.md`](rules.md)、受入の証跡は [`evidence.md`](evidence.md) にまとめた。

この文書は spec を置き換えない。spec が決めていない実装上の判断と、spec どうしの食い違いをどう決着させたかを残す。

## 1. 受入 S1〜S5 を検証できる文に分ける(P01)

feature の受入条件は 1 文に複数の主張を含む。「一部だけ満たした」を PASS と数えないよう、確かめられる単位に分けた。各行の証跡は [`evidence.md`](evidence.md) の同じ番号の行にある。

| 受入 | 分けた主張 | 確かめ方 |
|---|---|---|
| S1 | S1-a `/cash` に 問いの見出し・対象期間カード・2 つのタブ・通常入力・交通費入力・一覧・インライン削除確認・元に戻すトースト・空状態・下部固定バーが描画される | DOM テスト「問いと説明、対象期間カード、2 つのタブを出す」(見出し・期間・タブ)、「追加」の 4 件(通常入力・交通費入力・下部固定バー)、「空の月」(空状態)、「削除と元に戻す」の 5 件(一覧・インライン削除確認・元に戻すトースト) |
| | S1-b 領収書のファイル入力が無く、freee への案内がある | DOM テスト「領収書欄の代わりに freee への案内を出す」 |
| | S1-c `packages/web/src` に色の直書きが 0 件で、ボタンは共通 `Button` を通す | `pnpm lint` の `check-design-tokens` と design-system 検査 |
| | S1-d 読込・空・絞り込み 0 件・失敗の各状態が DOM テストで固定されている | DOM テスト「読込・空・失敗の状態」 |
| S2 | S2-a 削除した明細が『元に戻す』(単体)で同じ id のまま戻る | 統合テスト「DELETE は論理削除になり、restore で同じ id が戻る」、DOM テスト「確認してから削除し、「元に戻す」で戻せる」 |
| | S2-b 一括削除した明細が『元に戻す』(一括)で同じ id のまま戻る | 統合テスト「bulk-delete した 3 件が bulk-restore で戻る」、DOM テスト「一括削除して、まとめて元に戻せる」 |
| | S2-c 削除中の行が 一覧・合計・取引・集計・バックアップ・取込時の設定スナップショット・科目使用状況 に現れない | 統合テスト「削除中の行を読まない条件」の経路別 6 件(一覧・合計と集計・取引・バックアップ・取込時の設定スナップショット・科目使用状況) |
| | S2-d JSON 復元の件数判定だけが削除中の行を数え、中身は出さない | `import-lifecycle.test.ts`「削除中の現金明細だけが残る移行先へは…」 |
| | S2-e 30 日の期限が 29 日(残る)と 31 日(消える)で固定されている | 統合テスト「夜間の完全消去」 |
| | S2-f 入力途中の内容が再読込後に復元される | DOM テスト「入力の 500ms 後に利用者ごとに保存し、開き直すと戻る。クリアで消える」 |
| S3 | S3-a 合計・絞り込み・ページング・入力経路・交通費合計・入力検証が `packages/core/src/cash-screen.ts` にある | core テスト(`packages/core/test/cash-screen.test.ts`) |
| | S3-b web と api に同じ計算が 0 件 | §7 P08 の `rg` |
| | S3-c API の入力検証が core の上限と同じ値を使う | `routes/cash.ts` の zod が `CASH_LIMITS` を参照。統合テスト「不正な入力は 400」 |
| S4 | S4-a 他の利用者の id が GET / PUT / DELETE / restore / bulk-delete / bulk-restore の 6 経路で 404 | 統合テスト「他の利用者の明細」 |
| | S4-b 一括は 1 件でも他人の id を含めば何も変えない | 統合テスト「bulk-delete に他の利用者の id を 1 件混ぜると 404 で、自分の行も変わらない」「bulk-restore に他の利用者の id を 1 件混ぜると 404 で、自分の削除中の行も戻らない」 |
| | S4-c 不正な入力(実在しない日付・範囲外の金額・候補外の名義 / カテゴリ / 業務の目的・長すぎる文字列)が 400 | 統合テスト「不正な入力は 400」 |
| | S4-d 削除中の行の PUT が 404 | 統合テスト「PUT: 削除中の行は編集できず 404 で、編集で復活もしない」 |
| S5 | S5-a migration 0052 の適用で既存行の更新が 0 件 | `cash-migration-0052.test.ts` |
| | S5-b 夜間予算が `total === PLAN_MAX (49)` | `scheduled-maintenance-budget.test.ts` |
| | S5-c `verify:full`・`skills:test`・初期 JS 予算が緑 | §7 P06・P09 の実行記録 |
| | S5-d 旧 `Cash.tsx` の操作(通常入力・交通費の入替と往復・重複の確認・編集・削除)が新しい構成から実行できる | `cash-duplicate.dom.test.tsx`、`cash-transit-regression.test.ts`、DOM テスト「保存に成功したら編集をやめ、変更した値が一覧に出る」「入替で出発駅と到着駅を入れ替え、合計は往復 (既定) なら片道の 2 倍、外すと片道を出す」 |
| | S5-e 受入は実行済みの最新の証跡だけで判定する | [`evidence.md`](evidence.md) の実行日時とコミット |

## 2. 持ち越し事項の担当と結論

| ID | 内容 | 担当 | 結論 |
|---|---|---|---|
| OI-01 | migration の番号 0052 | P05 | 計画時は予定番号 0050 で作った(`origin/main` f0e5a3b の最新は `0049_ai_report_invariants.sql`)。merge の前に fetch し直すたびに先着が増え、2 段で繰り上げた。1 段目は予算画面(#67)の `0050_budget_plans.sql` を避けて 0051 へ、2 段目はトレードオフ画面(#68)の `0051_tradeoff_notes.sql` を避けて 0052 へ。番号は main に先に入ったほうが勝つ早い者勝ちなので、PR を出す直前にもう一度 fetch して空きを確かめる。`.dev-graph/plans/` の promotion 記録と確定済みの仕様章は、計画時点の証跡として 0050 のまま残す |
| OI-02 | core テストの置き場(spec は `src/`、feature は `test/`) | P03 | §6 のとおり `packages/core/test/cash-screen.test.ts` に置く |
| OI-03 | agent 推定・利用者未確認の値 | P01 | §3 の表に一覧化した。どれも実装を止める値ではないので、既定値で作り、利用者の確認を待つ |
| OI-04 | 夜間予算の計画上限 49 | P05 | P04 で `total === PLAN_MAX` のテストを先に書き、P05 で `SCHEDULED_D1_QUERY_PLAN_MAX` を 47 → 49 に上げた |
| OI-05 | `CANONICAL_MUTATION_ROUTES` の件数固定 | P04 | `import-lifecycle-pure.test.ts` の件数を 3 件増やし、新しい 3 経路の判定を足した |
| OI-06 | 初期 JS budget 超過 (CI `check:js-budget`) | P13 | ログアウト時の下書き削除が `Layout.tsx`(初期バンドル) → `pages/cash/draft.ts` → `pages/cash/view-model.ts` → core の `cash-screen.ts` と辿り、接頭辞 1 個のために検証関数一式まで初期バンドルへ入って 112.75KiB > 110KiB で落ちた。tree-shaking はモジュール単位で切るので、`CASH_DRAFT_KEY_PREFIX` を `packages/core/src/cash-draft-key.ts` へ独立させ、`cash-screen.ts` はそこから import する形にした。結果 107.41KiB(main の 108.00KiB より軽い)。外から小さく引かれる定数は、大きな規則ファイルに同居させない |

## 3. agent 推定の値と確認の担当

spec が **agent 推定・利用者未確認** と注記した値。実装は既定値で進め、利用者の確認で変わったら [`rules.md`](rules.md) の行・core の実装・テストの期待値を同じ変更で直す。確認の担当は利用者で、確認の場は PR のレビューとする。

| 値 | 既定 | 規則表 |
|---|---|---|
| 1 ページの件数 | 20 件 | R6 |
| 範囲外のページ | 最後のページに寄せる。総数 0 は `page=1` | R6 |
| キーワードの一致規則 | NFKC + 英字の大小を区別しない部分一致。内容・メモ・カテゴリ大 / 中・駅名・業務の目的 | R4 |
| 業務の目的の選択肢と保存形 | 固定 4 つ + その他(40 字)。1 列に表示語、その他は `その他:` 接頭辞 | R8 |
| 名義が NULL の既存行の表示 | 「未設定」(`ownerLabel(null)` とは別) | R10 |
| 字数の数え方 | コードポイント数 | R9 |
| 担当者の既定 | 事業なら `business`、個人なら未選択 | R11 |
| 選択中の月の既定 | 今日の月が期間内ならその月、外なら期間の最後の月 | R7 |
| 月送りの範囲 | 対象期間の端で止める | R7 |
| 完全消去の 1 晩の上限と warn | 500 行、上限到達で `level: "warn"` と `limitReached: true` | R14 |
| 30 日ちょうどの扱い | `deleted_at < now − 30日` だけ消す(ちょうどは残す) | R14 |
| restore / bulk-restore の冪等 | 削除中でない行は何も書かず 200 | R12 |
| 一括の重複 id と削除中 id | 重複は 400、bulk-delete の削除中 id は 404 | R13 |
| DELETE / 一括の応答の形 | `{ ok, id, deletedAt }` / `{ ok, ids, deletedAt }` / `{ entries }` | R12・R13 |
| GET の期間の省略時 | 全期間 | — |
| 論理削除で `tx_edits` を残し完全消去で消す | spec のとおり | R14 |
| バックアップの `tx_edits` から削除中の明細を指す行を外す | spec のとおり | R15 |
| 下書きのキー・保存の間隔・例外・上限・ログアウト時の消去・編集中 | `kanjo:cash-draft:v1:{userId}`、500 ms、例外は握る、上限で切る、ログアウトで消す、編集中は保存しない | R16 |
| URL のキー名 | `tab` / `month` / `q` / `io` / `category` / `owner` / `route` / `min` / `max` / `from` / `to` / `page` | R17 |
| 交通費タブでのバーの文言 | 「この内容で交通費を追加」 | — |
| migration と索引の名前 | `0052_cash_entry_owner_soft_delete.sql` / `idx_cash_user_deleted` | — |
| `check:cash-screen` の渡し方 | `KANJO_VISUAL_SCOPE=cash node scripts/check-financial-visuals.mjs` | — |

## 4. 関数の入出力(P02)

規則は `packages/core/src/cash-screen.ts` の 1 か所に置く。API と web はこの関数を呼ぶだけで、同じ計算を持たない。

| 関数 | 入力 | 出力 |
|---|---|---|
| `cashEntryRoute(e)` | `{ transitFrom }` | `'normal' \| 'transit'`(`transitFrom !== null` なら交通費) |
| `cashTotals(entries)` | 絞り込み後の明細 | `{ income, expense, net }`(`net = income − expense`) |
| `filterCashEntries(entries, filter)` | 明細と `CashFilter`(キーワード・収支・カテゴリ・担当者・経路・金額と日付の範囲) | 全条件の AND に当たる明細(順序は保つ) |
| `paginateCash(rows, page, size = 20)` | 行・求めるページ | `{ rows, page, pageCount, start, end, total }` |
| `transitTotal(input)` | `TransitInput` | `{ amount } \| { error }`(`buildTransitEntry` / `transitInputError` を使う) |
| `formatTransitPurpose(p, note)` / `parseTransitPurpose(v)` | 選択肢と記述 / 保存値 | 1 列の保存値 / `{ purpose, note }` |
| `validateCashInput(input)` | 画面の入力 | 最初の 1 件の文か `null`(API の zod と同じ上限 `CASH_LIMITS`) |
| `cashMonthNav(months, month)` | 期間内の月と選択中の月 | `{ prev, next }`(端では `null`) |
| `defaultCashMonth(months, today)` | 期間内の月と今日 | 既定の月 |
| `readCashUrl(params)` / `writeCashUrl(state)` | URL の query / 画面の状態 | 不正値を落とした状態 / 既定値を省いた query |

## 5. 経路の設計(P02)

- **新しい経路は 3 本**: `POST /api/cash-entries/:id/restore`、`POST /api/cash-entries/bulk-delete`、`POST /api/cash-entries/bulk-restore`。いずれも `canonical-mutation-fence` に `consumers: ['cash_entries']` で登録し、取込と同じ writer lease で直列化する。
- **DELETE は論理削除**: `deleted_at` に現在時刻を入れ、同じ batch で JSON pointer を無効化し、取引と集計を作り直す。`tx_edits` は消さない(戻したときに同じ仕分けで戻るため)。
- **確定の単位**: 4 経路とも、`planRecomputeFromDeals` で作り直しを先に計画してから、`[UPDATE cash_entries, invalidateJsonSnapshotQuery('cash_entries'), ...recomputePlanQueries]` を 1 つの D1 batch で確定する。query 数は `CASH_PARENT_DELETE_QUERY_LEDGER` と同じ形で数え、Free 上限 50 未満を確かめてから書く。
- **一括の束縛**: id 配列は `json_each(?)` に 1 つの JSON 文字列として束縛する。D1 の 1 文あたりの束縛数の上限 100 に、`user_id` と 100 件の id は収まらない。
- **読取経路 5 本に `deleted_at IS NULL`**:
  1. `loadCashEntries`(一覧と `loadDataset`、取引・集計の作り直し)
  2. `BACKUP_SNAPSHOT_SQL` の cash 行(エクスポートと夜間バックアップ)。`owner` を `v14`、`transit_purpose` を `v15` に載せる。同じ SQL の `tx_edits` 行は、削除中の明細を指す `cash:<id>` を相関 `NOT EXISTS` で外す(束縛数は増やさない)
  3. `loadImportRestoreSettingsSnapshot` の cash 節。`json_object` に `owner` と `transitPurpose` を足す
  4. `loadCategoryUsageContext`(科目使用状況と科目の名称変更)
  5. PUT の既存行取得(と UPDATE の条件)
- **JSON 復元の件数の例外**: `destination_counts` に削除中を含む現金明細の件数を 1 つ足す(束縛数 19 → 20。予算画面の `budgetPlans` と合わせて main との merge 後は 21。両方が「20」と書いて行が一致し、merge で衝突しなかったため、束縛数は SQL の `?` から数える形へ改めた)。`restorableCashEntries` はこの件数で「移行先の現金明細が 0 件か」を判定し、削除中の行が残る間は現金明細を復元せず、その理由を計画に載せる。削除中の行の中身はどの出力にも出さない。
- **migration 0052 は追加だけ**: `owner`(CHECK で 3 値か NULL)・`transit_purpose`・`deleted_at` の 3 列と索引 `idx_cash_user_deleted (user_id, deleted_at)`。既存行は 1 件も書き換えない。`runtimeSchemaGuard` の `EXPECTED_D1_MIGRATION` を 0052 へ進める。
- **夜間の完全消去**: 独立 job `cash_soft_delete_purge` を `scheduledMaintenance` の `Promise.allSettled` に足す。1 つの D1 batch で「対象の `cash:<id>` を指す `tx_edits` の削除」と「`deleted_at < now − 30日` を `deleted_at, id` の古い順に最大 500 行の削除」を行う。2 文は同じ副問い合わせで対象を選ぶ。予算は 2 本で、計画上限を 47 → 49 に上げる。
- **画面の分割**: `pages/Cash.tsx` は `pages/cash/CashPage.tsx` を再 export するだけの入口にする(遅延読み込みと既存テストの mock を保つため)。本体は `pages/cash/` に、URL と一覧の状態・下書き・通常入力・交通費入力・一覧・削除確認とトースト・空状態・下部固定バーに分ける。

## 6. 独立レビュー(P03)

- **OI-02 の結論**: core テストは `packages/core/test/cash-screen.test.ts` に置く。feature の resource_scope と P04 の成果物がこの場所を指し、core の契約テスト(`*-contract.test.ts`)も `test/` にある。spec の `src/cash-screen.test.ts` は置き場の書き分けが無かった時期の表記として扱い、spec の本文は変えない。
- **読取経路の一覧と現物の照合**: `rg "cash_entries|s\.cashEntries" packages/api/src` の結果(2026-09-22)は次のとおりで、読み取りは §5 の 5 本と一致した。
  - `store.ts` の `loadCashEntries`・`BACKUP_SNAPSHOT_SQL`・`loadImportRestoreSettingsSnapshot`
  - `routes/settings.ts` の `loadCategoryUsageContext`(`:605-613` の UPDATE はこの結果の id だけを書く)
  - `routes/cash.ts` の PUT の既存行取得
  - それ以外(`import-active.ts:11`・`import-lifecycle.ts:1561` の表名の宣言、`canonical-mutation-fence.ts` の consumers、`routes/cash.ts` の INSERT / UPDATE)は読み取りの条件ではない。`deletion-lifecycle.ts` の `loadManualRecords` は現金明細を対象にしない。
- **一括の全か無か**: bulk-delete は「`user_id` 一致・id が配列内・削除中でない」の件数が配列の件数と違えば 404 にして batch を発行しない。bulk-restore は「`user_id` 一致・id が配列内」の件数で同じ判定をする。事前の読みと batch のあいだは fence の lease が他の書き込みを止め、UPDATE の条件が最後の守りになる。期待値は統合テストで「他人の id を 1 件混ぜると 404、自分の行も変わらない」として固定する。
- **削除中の行の PUT**: 既存行の取得と UPDATE の両方に `deleted_at IS NULL` を掛ける。取得で 404 を返すので、編集で削除中の行が復活しない。
- **URL の復元**: 不正な値(知らない `tab`・`YYYY-MM` でない `month`・数でない金額・知らない `owner` など)は落として既定値に戻す。絞り込みを変えたら `page` を 1 に戻す。既定値のキーは URL に付けない。

## 7. 検証の記録(P04・P06・P08・P09)

実行はすべて 2026-09-22、`f0e5a3b` に未コミットの作業ツリーを重ねた状態で行った。取り直し方は [`evidence.md`](evidence.md) にある。

### P04 テストが旧実装を落とすかの検算

読取経路の `deleted_at IS NULL` を 1 つずつ外し(M1〜M6)、完全消去の境界を `<` から `<=` に変え(M7)、統合テスト `cash-screen.integration.test.ts`(43 件)を流した。どの変異も 1 件以上のテストに落とされた。

| 変異 | 落ちたテスト |
|---|---|
| M1 `loadCashEntries`(一覧・合計・取引) | 6 件(削除と restore、bulk の往復、他人の id を混ぜた bulk-restore、経路別の 一覧・合計と集計・取引) |
| M2 バックアップの `tx_edits`(`NOT EXISTS`) | 「バックアップ: … 手動の仕分けに出ない」 |
| M3 バックアップの現金明細 | 同上 |
| M4 取込時の設定スナップショット | 「取込時の設定スナップショット: 中身は外し、件数だけ削除中を含めて数える」 |
| M5 科目使用状況 | 「科目使用状況: 削除中の明細はカテゴリの使用数に入らず…」 |
| M6 PUT の既存行 | 「PUT: 削除中の行は編集できず 404 で…」 |
| M7 完全消去の境界 | 「夜間の完全消去 29 日前は残し、31 日前は消し、ちょうど 30 日前は残す…」 |

M1 は最初、合計と集計の経路を落とせなかった。削除の batch が `monthly_agg` を作り直すので、読取の条件が無くても削除の直後の集計は正しくなるからだ。「削除のあとの別の書き込みで `monthly_agg` を作り直しても数えない」をテストに足し、M1 で 6 件落ちることを確かめた。検算の後、4 ファイル(`store.ts`・`routes/settings.ts`・`routes/cash.ts`・`cash-purge.ts`)のハッシュが検算前と一致することを確かめた。

P09 で足したキーボード操作のテストも同じ方法で確かめた。フォーカスの移動と Escape を外すと、「削除の確認を開くと「キャンセル」へフォーカスが移り、Escape で閉じる」「削除すると「元に戻す」へフォーカスが移る」の 2 件が落ちる。

### P06 実行記録

`verify:full` の各段を 1 本ずつ流し、開始と終了の時刻と終了コードを残した(時刻は JST)。1 本にまとめず分けたのは、途中で落ちた段の後ろが流れないまま「緑」に見えるのを避けるためだ。

| コマンド | 開始 | 終了 | 結果 |
|---|---|---|---|
| `pnpm lint` | 18:12:29 | 18:12:44 | 合格 |
| `pnpm typecheck` | 18:12:44 | 18:13:26 | 合格 |
| `pnpm skills:test` | 18:13:26 | 18:13:27 | 合格 |
| `pnpm test`(`pnpm -r test`) | 18:13:27 | 18:48:18 | api 1,012 件合格・6 件 skip、core 859 件合格、web 912 件合格・2 件不合格(下の注) |
| 不合格の 2 ファイルを単独で(`vitest run src/mobile-financial-visualization-render.test.ts src/thead-render.test.ts`) | 18:53:16 | 18:56:50 | 2 件とも合格(212 秒) |
| `pnpm run test:aux` | 18:58:32 | 18:58:40 | 合格(`pnpm test` が web で止まり流れなかったので単独で流した) |
| `pnpm build` | 18:48:18 | 18:49:26 | 合格 |
| `pnpm --filter @kanjo/web build:bundle` の直後に `check:js-budget` | 18:49:26 | 18:50:23 | 合格 |
| `check:thead` | 18:50:23 | 18:51:30 | 合格 |
| `check:financial-figure` | 18:51:30 | 18:51:54 | 合格 |
| `check:mobile-layout` | 17:50:38 | 17:51:17 | 合格 |
| `check:financial-routes` | 17:51:17 | 18:04:22 | 合格 |
| `check:ai-screen` | 18:04:22 | 18:05:37 | 合格 |
| `check:analysis-hub` | 18:05:37 | 18:07:16 | 合格 |
| `check:cash-screen`(1 回目) | 18:07:16 | 18:07:57 | 不合格(§8「`check:cash-screen` の fixture の漏れ」) |
| `check:cash-screen`(fixture を直した後) | 18:11:51 | 18:12:11 | 合格。続けて 2 回流し、どちらも合格 |
| `pnpm run preview:smoke` | 18:07:57 | 18:09:33 | 合格(§8「担当者の必須化がアーキテクチャから外れていた」を直した後の実行) |

- **web の 2 件の不合格**: `mobile-financial-visualization-render.test.ts` と `thead-render.test.ts` は実ブラウザを起こして描画する重いテストで、全体の並列実行の負荷で上限(420 秒)に達し SIGTERM で打ち切られた。アサーションの不一致ではない。単独では 212 秒で 2 件とも合格した。この 2 ファイルは現金入力画面を描画しない。
- **実行とコード変更の前後**: 担当者の互換の修正(`packages/core/src/cash-screen.ts`・`packages/api/src/routes/cash.ts` とそのテスト)は 17:47:57 に入れ、表の実行はすべてその後に流した。その後の変更は 18:11:23 の `check-financial-visuals.mjs`(fixture の追加)だけで、影響する `check:cash-screen` はその後に流し直した。

### P08 読取専用の監査

- **計算の重複**: `rg` で NFKC の正規化、往復の 2 倍、`income` / `expense` の `reduce`、ページングの `slice` を `packages/web/src` と `packages/api/src` から探した。`cash-screen.ts` の外に同じ計算は無かった。見つかったのは次の 2 種で、どちらも扱いを決めた。
  - 金額欄の桁数の直書き `.slice(0, 10)`(`NormalEntryCard.tsx`・`TransitEntryCard.tsx`)。上限 `CASH_LIMITS.amountMax` から導く `AMOUNT_DIGITS`(`pages/cash/view-model.ts`)に置き換えた。上限を変えると欄も追従する。
  - `DeleteConfirm.tsx` の削除対象の金額の総和。収支を問わない「消える金額の合計」で、`cashTotals` の収入・支出・差額とは別の量なので、そのまま残す。
- **削除中の行の読取漏れ**: `rg "FROM cash_entries|JOIN cash_entries|s\.cashEntries" packages/api/src` の結果は §6 の 5 本と一致した。ほかに次の 2 つがあるが、どちらも漏れではない。
  - `routes/cash.ts` の `loadAllCashRows`。削除と戻しの経路が、戻す対象の行を探すために削除中の行も読む。有効な集合は同じ関数の中で `deletedAt === null` で絞り、応答と作り直しにはその集合だけを使う。
  - `store.ts` の `destination_counts` の件数。§5 の JSON 復元の例外で、中身は出さない。
- **旧 `Cash.tsx` の直参照**: `rg "pages/Cash"` で残るのは、入口の遅延読み込み(`AuthenticatedApp.tsx`)、共通シェルのテストの mock、`cash-duplicate.dom.test.tsx` の `CashDuplicateNotice` の import だけ。`pages/Cash.tsx` は `pages/cash/` を再 export する入口なので、どれも新しい構成を通る。

### P09 保証の確認

| 観点 | 確かめ方 |
|---|---|
| タブのキーボード操作 | タブはネイティブの `<button role="tab">` で、Tab で到達し Enter / Space で押せる。DOM テスト「タブはネイティブのボタンで、フォーカスして押せる」 |
| 行内の削除確認 | 一覧の下に開くので、開いたら「キャンセル」へフォーカスを移し、Escape で閉じる(削除中は閉じない)。DOM テスト「削除の確認を開くと「キャンセル」へフォーカスが移り、Escape で閉じる」 |
| 元に戻すトースト | 時間で消えない。削除の後は押した確認欄が消えるので、「元に戻す」へフォーカスを移す。DOM テスト「削除すると「元に戻す」へフォーカスが移る」 |
| 入力検証の 400 | 統合テスト「不正な入力は 400」。API の zod は `CASH_LIMITS` を読み、中身の規則は core の `validateCashInput` に任せる |
| 他人の行の 404 | 統合テスト「他の利用者の明細」(6 経路と一括の全か無か) |
| 下書きの例外 | `localStorage` の `getItem` / `setItem` / `removeItem` がすべて例外を投げても画面を描き、入力とクリアを続けられる。DOM テスト「localStorage が例外を投げても画面を描き、入力とクリアを続けられる」 |
| 初期 JS 予算 | `build:bundle` の直後に `check:js-budget`(下の P06 の表) |
| 幅ごとの崩れ | `check:cash-screen` が 360・390・768・1024・1280px と 200% 拡大で、横スクロール・画面外への要素のはみ出し・タブの高さ・20 行とページ送り・下部固定バーと削除確認の収まり・確認を開いたときのフォーカスを実描画で確かめる。検算として `.cash-form` に `min-width: 700px` を足すと 6 件、`DeleteConfirm` のフォーカス移動を外すと 12 件(フォーカスと Escape が各幅で 1 件ずつ)の不合格で落ち、元に戻すと合格する |

## 8. 配信前の独立レビュー(P10)

P06〜P09 の記録と差分を読み直し、配信してよいかを判断した。

### 結論

**配信してよい。** ただし下の「配信の前に残すこと」の 2 点を満たすことを条件にする。PR の作成・merge・Deploy は P13 で行う。

根拠は次の 3 つ。

- 受入 S1〜S5 の 22 項目(§1)がすべて PASS。一部だけ満たした項目は無い。各項目の証跡は [`evidence.md`](evidence.md) にある。
- `verify:full` の各段と `skills:test`・初期 JS 予算が緑(§7 P06)。打ち切られた 2 件は単独で合格しており、現金入力画面とは関係しない。
- 下の「確かめたこと」で、Migrate と Deploy の順序、移し替えのあいだの古いコード、巻き戻しの前提に問題が無い。見つけた 2 つの食い違い(担当者の必須化と fixture の漏れ)は直し、テストで固定した。

巻き戻すときは、先に削除中の行(`deleted_at IS NOT NULL`)が残っていないかを確かめる。残っていれば、コードを戻す前に restore で戻すか、指している `tx_edits` と一緒に消す(下の「巻き戻しの前提」)。

### 確かめたこと

- **Migrate と Deploy の順序**: `.github/workflows/deploy.yml` では、D1 migration の適用(`db:migrate:remote`)と未適用の検査が `wrangler deploy` より前に走る。0052 を `plan-auto-migration.mjs` の `destructiveFindings` に掛けると指摘は 0 件(`DELETE FROM`・`UPDATE … SET`・`ALTER TABLE … RENAME` を含まない)なので、Deploy の中で自動適用され、手動の Migrate(manifest の承認)は要らない。新しいコードは 0052 の列を読むが、列は Worker より先に入る。
- **0052 の後で古いコードが動く間**: 移し替えのあいだ古い Worker が残っても、足したのは NULL を許す列と索引だけなので、古いコードの INSERT / SELECT は変わらず通る。
- **巻き戻しの前提(対称でない点)**: 列は残したままコードだけを戻す。戻したコードには `deleted_at IS NULL` が無いので、削除中の行が有効な行として一覧・合計・集計に戻ってしまう。巻き戻す前に、削除中の行を restore で戻すか、指している `tx_edits` の `cash:<id>` と一緒に同じ batch で消すかを決める(`docs/data-schema.md`「0052 の適用と巻き戻し」)。`runtimeSchemaGuard` の `EXPECTED_D1_MIGRATION` も同じ変更で戻す。
- **夜間の予算**: 完全消去の 2 本で計画上限が 47 → 49。Free の 50 未満に収まり、`scheduled-maintenance-budget.test.ts` が `total === PLAN_MAX` を固定する。
- **範囲の外の変更**: `packages/web/src/components/Layout.tsx` にログアウト時の `clearAllCashDrafts` を足した。R16(ログアウトで全利用者の下書きを消す)を満たすための 1 行で、共用端末で他人の下書きが残らないようにする。ほかの画面の振る舞いは変えない。
- **P05 の見落とし**: `check:cash-screen` が task の成果物にあるのに未実装だった。task と差分の照合で見つけ、`check-financial-visuals.mjs` に `cash` の範囲を足し、`verify:full` に組み込んだ。
- **担当者の必須化がアーキテクチャから外れていた**: `architecture/cash-backend.md` は「API では担当者と業務の目的を任意にし、画面では必須にする」と決めていた。0052 より前の SPA が送る本文を、移し替えのあいだも通すためだ。ところが実装では API も `z.enum(OWNER_VALUES)` で必須にしていた。`preview:smoke` が担当者を持たない本文で POST して 400 になったことで見つけた。core の `validateCashInput` に `allowUnset`(API だけが渡す)を足し、担当者と業務の目的の「無い」だけを許すようにした。値があるときの検査は画面と同じ。POST で無ければ NULL(R10 の「未設定」)を入れ、PUT で無ければ今の値を保つ(`keepUnsent`)。古い SPA で編集しても、0052 の後に付けた値が消えないようにするためだ。統合テスト「0052 より前の SPA の本文…を通す互換」の 4 件と core の 1 件で固定した。画面の検査は既定(厳格)のまま変えていない。
- **`check:cash-screen` の fixture の漏れ**: 現金入力は担当者の表示名(`/api/settings/owner-labels`)を読む。これが fixture に無かったので、vite の proxy を通って API へ Cookie 無しで届き、401 が返って画面がログインへ切り替わっていた。切り替わるのが描画の途中なので、「描画待ちのタイムアウト」と「削除ボタンが見つからない」の 2 通りの落ち方をした。fixture に `{ labels: {} }`(既定の表示名)を足し、3 回続けて合格することを確かめた。

### 配信の前に残すこと

- merge の直前に `origin/main` を fetch し、migration の番号 0052 がまだ空いていることを確かめる(OI-01)。
- §3 の agent 推定の値は、PR のレビューで利用者が確かめる。変わったら [`rules.md`](rules.md) の行・core・テストを同じ変更で直す。

## 9. 参照画像との構造適合と意図的な差分

`design/FINAL-UI/images/17-cash.png` は情報の順序と主要な操作群を決める参照画像として扱う。タイトル「現金入力」→問い→説明→対象期間→入力方式→2種類の入力→一覧→下部操作、という構造と主要文言は実装に揃える。一方、固定ピクセルの複製や pixel-perfect の達成は受入として主張しない。

現在の実装には、狭幅で選択中の入力カードだけを表示すること、交通費カード内にも共有必須項目を出すこと、共通 `PageHeader`・`Button`・デザイントークンを使うこと、データ状態に応じて一覧行数や文言が変わること、という意図的な差分がある。参照画像の「入力をクリア」は実際には通常入力と交通費入力を同時に消すため、対象を誤解させない「両方の入力をクリア」へ明示的に変更した。これらはモバイルで交通費入力を完結できること、共通シェルとの整合、アクセシビリティ、実データへの適応を優先した差分である。

したがって画像適合の証跡は、DOM 契約と `check:cash-screen` による 360・390・768・1024・1280px / 200% 拡大時の構造・可視性・操作可能性の確認とする。スクリーンショットの画素差が 0 である、または pixel-perfect であるとは表現しない。
