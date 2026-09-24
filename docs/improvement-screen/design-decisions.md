# 改善リクエスト画面の設計判断

改善リクエスト画面(`/improvement`)を作り直したときの判断の記録。対象は feature `feat-improvement-screen`(Beads epic `kanjo-kkp`、子タスク SYS-IMPSCR-P01〜P13)。画面仕様の正本は `specs/spec-improvement-screen.md`、アーキテクチャは `architecture/improvement-screen-*.md` の 8 章。規則と実装・テストの対応は [`rules.md`](rules.md)、受入の証跡は [`evidence.md`](evidence.md) にまとめた。

この文書は spec を置き換えない。spec が決めていない実装上の判断と、spec の未決事項をどう決着させたかを残す。30観点の再検証は [`elegant-review.md`](elegant-review.md) に記録した。移行と巻き戻しの現行手順は [`../improvement-request.md`](../improvement-request.md) §2.4 を正本とし、計画時の番号 0053 を含む tasks・`.dev-graph/plans/` は履歴として扱う。

## 1. 受入 S1〜S5 を検証できる文に分ける(P01)

feature の受入条件(`.dev-graph/plans/feature-package-feat-improvement-screen/requirements.md`)は 1 文に複数の主張を含む。「一部だけ満たした」を PASS と数えないよう、確かめられる単位に分けた。各行の証跡は [`evidence.md`](evidence.md) の同じ番号の行にある。

| 受入 | 分けた主張 | 確かめ方 |
|---|---|---|
| S1 | S1-a `/improvement` に 問いの見出しと説明・使い方の入口・作成フォーム・一覧(検索・5 つの件数タブ・表・ページング)・詳細パネル・空状態・読み込み失敗と再読み込み・撮影パネル・選択中バー・コピー完了トースト が描画される | DOM テスト「画面の要素が揃う (AC-014)」3 件、`improvement-capture.dom.test.tsx`、`check:improvement-screen` の実描画 |
| | S1-b 色・余白・部品はトークンと共通部品を通り、直書き色が 0 件 | DOM テスト「見た目の契約 (AC-019)」3 件、`pnpm lint` の `check-design-tokens` |
| | S1-c 読込・空・失敗の各状態が DOM テストで固定されている | DOM テスト「1 件も無いときは…空の状態」、view-model の読込・失敗の分岐(`ImprovementList.tsx`)を `check:improvement-screen` の失敗 fixture で描画 |
| | S1-d プライバシー確認 2 つのどちらかが未チェックなら送信できない | DOM テスト「送信の条件 (AC-015)」2 件、core「本文の空・1000 字超・確認の未チェックで送信できない」 |
| S2 | S2-a 本文・診断から 7 種(口座・取引先名・金額・個人名・メール・電話・住所)と秘匿値が伏せられる | core「AC-006 マスク (7 種と秘匿値)」、api `improvement-redaction.test.ts` |
| | S2-b 撮影用の複製で `data-capture-mask` の要素と、辞書を使わない規則が伏字になる | DOM テスト「撮影用の複製で金額を伏せる (AC-016)」 |
| | S2-c 画面のマスクを飛ばした直接投稿にも、サーバで同じ規則(辞書を含む)が掛かる | api 統合「サーバ側のマスク (AC-009)」、`improvement-redaction.test.ts`「サーバ側の再マスク」5 件 |
| S3 | S3-a 状態の遷移・概要・番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core にある | core `packages/core/test/improvement-screen.test.ts`(AC-001〜006) |
| | S3-b web と api に同じ計算が 0 件 | §7 P08 の `rg` |
| | S3-c 画面名の表が core と `routeMetadata.ts` で一致する | web `improvement-route-labels.test.ts` 2 件 |
| S4 | S4-a 他の利用者の依頼は 取得・画像・指示文・コピー記録・状態・再発行・削除・復元 の全経路で 404 | api 統合「他の利用者の依頼 (O4)」2 件 |
| | S4-b 空の本文・1000 字超・プライバシー確認の欠け・候補外の状態・形式外の画像が 400 | api 統合「1000 字ちょうどは 201、1001 字は 400」「プライバシー確認の片方が欠けると 400」「旧 wontfix を含む候補外の値は 400」、`improvement-lifecycle.test.ts`「JPEG でも PNG でもない中身は 400」「内容が空なら 400」 |
| | S4-c 削除した依頼が『元に戻す』で同じ id と番号のまま戻る | api 統合「削除から復元で同じ id と seq が一覧に戻り…(AC-008)」、DOM「削除すると一覧から消え、『元に戻す』で同じ番号が戻る」 |
| | S4-d 削除中の行が一覧と件数に 0 件で、詳細・画像・指示文・コピー記録・状態・agent の 2 経路で 404 | api 統合「削除中の行は items にも counts にも入らず…」「削除中の依頼は詳細・画像・…で 404」 |
| | S4-e 30 日を過ぎた論理削除の行が R2 の画像・行・履歴ごと消え、R2 の削除に失敗した行は翌晩に回る | `improvement-retention.test.ts`「論理削除から30日の完全消去 (AC-010)」3 件 |
| S5 | S5-a 0054 の適用で既存行・画像のキー・トークンのハッシュが失われず、wontfix は完了へ移り履歴に理由が残る | `improvement-migration-0054.test.ts` 6 件 |
| | S5-b 夜間予算が `total === PLAN_MAX (49)` | `scheduled-maintenance-budget.test.ts` |
| | S5-c `BACKUP_SNAPSHOT_SQL` に改善リクエストの表が無い | `improvement-backup-exclusion.test.ts` |
| | S5-d `pnpm lint`・`typecheck`・`test`・`skills:test`・初期 JS 予算・`verify:full` が exit 0 | §7 P06・P09 の実行記録 |
| | S5-e 旧 `Improvement.tsx` とモーダルの操作(作成・撮影・一覧・詳細・状態変更・再発行・コピー・画像の拡大)が新しい構成から実行できる | `improvement-capture.dom.test.tsx`、DOM テスト、api `improvement-lifecycle.test.ts` |
| | S5-f 受入は実行済みの最新の証跡だけで判定する | [`evidence.md`](evidence.md) の実行日時とコミット |

## 2. 持ち越し事項の担当と結論

| OI | 事項 | 担当 | 結論 |
|---|---|---|---|
| OI-01 | migration の番号 0053 | P05 | 計画時の予定番号 0053 は、取込画面(#69)の `0053_import_inspections.sql` が先に main へ入った。本機能は `migrations/0054_improvement_request_screen.sql` を使い、`EXPECTED_D1_MIGRATION` も 0054。spec・architecture・system-spec の現行手順は 0054 に合わせた。tasks・`.dev-graph/plans/` に残る 0053 は計画時の履歴で、実行手順には使わない |
| OI-02 | 一覧と共通の期間の関係 | P01 → P03 | 一覧は期間で絞らない(spec FR-2 のとおり)。依頼は会計期間に属するデータではなく、期間で隠すと未対応の依頼が見えなくなる。共通の期間は他の画面と同じく表示だけする。利用者の確認は PR のレビューで取る(§3) |
| OI-03 | ブラウザ側での辞書マスク | P02 | 取引先名・個人名の辞書をブラウザへ渡す経路は作らない。辞書そのものが個人情報の一覧で、渡すとブラウザに平文で残るため。ブラウザの層は `data-capture-mask` の伏字と、辞書を使わない規則(`capture-screen.ts` の `maskSensitiveText` が core の `redactPersonalInfo` を空の辞書で呼ぶ)だけにする。辞書のマスクはサーバがリクエストのたびに `buildMaskDictionary` で作って掛ける(`packages/api/src/improvement/redact.ts`) |
| OI-04 | 撮り直しとコピー時の再発行 | P01 → P03 | 端末の画像ファイルは受け付けない。撮り直しは関連ページへ戻って撮影パネルを開く 1 経路にまとめる。コピーは、原文の指示文が画面のメモリにあればそのまま使い、無ければ(後日開いたとき)コピーの前に再発行する。再発行は前に配った指示文を失効させるので、コピーを押す前に説明する |
| OI-05 | 関連ページの画面名の置き場所 | P02 → P08 | core に同じ表 `IMPROVEMENT_ROUTE_LABELS` を持つ。core は web を参照できず、`routeMetadata.ts` を core へ移すとナビゲーションの定義が core に混ざるため。写しのずれは web の `improvement-route-labels.test.ts` が落とす(全経路の一致と、core にだけある経路が `/improvement` だけであること) |
| OI-06 | 削除中のトークンと agentGuard の応答 | P03 | トークンは残し、削除中なら agent の 2 経路を 404 にする。『元に戻す』で指示文がそのまま生き返るため。行が無い(トークンが当たらない)ときの 401 は据え置く。トークンの存在を推測させないためで、既存の失効理由(`token_expired`・`token_fetch_limit`)との整合も保つ。回数の加算の UPDATE にも `deleted_at IS NULL` を掛ける |
| OI-07 | 夜間予算の枠の回し方 | P04 → P05 | P04 で `improvement_retention: 4`・`audit_header_retention: 2`・`total === PLAN_MAX (49)` のテストを先に書き、P05 で `audit-log.ts` の `runAuditHeaderRetention` から削除前の計測の読み取りを外した。削除は `DELETE … RETURNING` で消した行のバイト数を受け取り、`before = after + 消した分` で復元する。記録の値は変わらない |
| OI-08 | agent 推定・利用者未確認の値 | P01 | §3 の表に一覧化した。どれも実装を止める値ではないので、既定値で作り、利用者の確認を待つ |

## 3. agent 推定の値と確認の担当

spec が **agent 推定・利用者未確認** と注記した値。実装は既定値で進め、利用者の確認で変わったら [`rules.md`](rules.md) の行・core の実装・テストの期待値を同じ変更で直す。確認の担当は利用者で、確認の場は PR のレビューとする。

| 値 | 既定 | 規則表 |
|---|---|---|
| 状態の遷移表 | 受付→対応中・完了 / 対応中→受付・再確認・完了 / 再確認→対応中・完了 / 完了→対応中・再確認 | R1 |
| 許されない遷移の応答 | 409 `invalid_transition`。同じ状態への変更は 200 で履歴を増やさない | R1 |
| 概要の切り方 | 最初の空でない行を trim、40 字を超えたら 40 字で切って「…」 | R3 |
| IMP 番号の桁 | 3 桁のゼロ詰め、4 桁以上はそのまま | R4 |
| 1 ページの件数と範囲外のページ | 10 件。範囲外は最後のページ、壊れた値は既定 | R6 |
| 件数を数える集合 | 検索後・削除中を除いた集合。タブでは絞らない | R6 |
| 検索の当て方 | NFKC と英字の大小を同一視した部分一致。本文・IMP 番号(`IMP-024`・`024`・`24`)・関連ページ名。検索語は 100 字で切る | R5 |
| 一覧を期間で絞らない | 絞らない(OI-02) | — |
| 関連する依頼 | 同じ route・新しい順・最大 3 件・自分と削除中と空の route を除く | R7 |
| アクティビティの種類名 | `created` / `status_changed` / `reissued` / `deleted` / `restored`(と migration が作る `migrated_wontfix`)。コピーは履歴に書かず、`copied_at`・`copied_target` の列だけを更新する | R8 |
| 診断の要約 | OS・ブラウザ(版を伏せる)・画面サイズ(倍率を落とす)・利用環境(origin から)・セッション ID の末尾 4 桁 | R9 |
| マスクの伏字 | `***`。辞書は 2 字未満と伏字を含む語を除き、長い順に当てる | R10 |
| URL のキー | `id` / `tab` / `q` / `page`。既定値は書かない | R11 |
| 『元に戻す』の冪等 | 削除中でない行の restore は 200 で、`updated_at` も履歴も変えない | R12 |
| 完全消去の期限 | `deleted_at` から 30 日。1 日でも過ぎた行を消す | R13 |
| wontfix の行の `done_at` | 元の `done_at` を残し、NULL なら適用時刻 | R14 |
| DB の本文の上限 | CHECK の 4000 は据え置き、新規は API と core で 1000 | R2 |
| プライバシー確認の欄名 | `privacyConfirmed` / `privacyConsented` | R2 |
| 確認ダイアログ | 削除は確認ダイアログを出さず、トーストの『元に戻す』で戻す | R12 |
| 表名・列名・索引 | `improvement_request_activities`・`improvement_request_counters`・`seq`・`deleted_at` | — |
| `check:improvement-screen` の渡し方 | `KANJO_VISUAL_SCOPE=improvement node scripts/check-financial-visuals.mjs` | — |
| テストのファイル名 | spec の `packages/core/src/improvement-screen.test.ts` ではなく `packages/core/test/improvement-screen.test.ts`(§6) | — |

## 4. 関数の入出力(P02)

規則は `packages/core/src/improvement-screen.ts` と、マスクを広げた `packages/core/src/improvement.ts` に置く。API と web はこの関数を呼ぶだけで、同じ計算を持たない。

| 関数 | 入力 | 出力 |
|---|---|---|
| `canTransitionImprovement(from, to)` / `allowedImprovementTransitions(from)` | 状態 | 遷移できるか / 移れる先(件数タブと同じ並び) |
| `nextImprovementDoneAt(from, to, doneAt, now)` | 遷移と今の `done_at` | 完了に入ったら `now`、完了のままなら保つ、出たら `null` |
| `checkImprovementDraft(input)` | 本文と確認 2 つ | `{ ok, fields, message, length }`(最初の 1 件の文を `message` に) |
| `improvementSummary(body)` | 本文 | 概要(最大 40 字 + 「…」) |
| `formatImprovementNumber(seq)` | 連番 | `IMP-024` |
| `improvementRouteLabel(route)` | 関連ページ | 画面名(クエリを落として引く。未知はパス、空は「記録なし」) |
| `normalizeImprovementListQuery(input)` | URL の `tab` / `q` / `page` | 不正値を既定に倒した問い合わせ |
| `buildImprovementList(rows, query)` | 自分の行と問い合わせ | `{ items, counts, total, page, pageSize }`(削除中を除き、検索後に数える) |
| `relatedImprovements(rows, self)` | 自分の行と選んだ行 | 関連する依頼(最大 3 件) |
| `describeImprovementActivity(a)` / `orderImprovementActivities(list)` | 履歴 | 見出しと説明 / 新しい順(同時刻は id の降順) |
| `summarizeDiagnosticEnvironment(env)` | 診断の環境 | OS・ブラウザ・画面サイズ・利用環境・セッション ID の要約 |
| `buildMaskDictionary(words)` / `redactPersonalInfo(text, dict)` | 取引先名と名義 / 文字列 | 辞書 / 伏せた文字列(冪等) |

## 5. 経路(P02・P03)

- **新しい経路は 2 本**: `DELETE /api/improvements/:id`(論理削除)と `POST /api/improvements/:id/restore`。どちらも照合つきの UPDATE と履歴の INSERT を 1 つの batch に置き、UPDATE が 0 行なら履歴も書かない(`changes()` の形)。
- **状態の変更**: `POST /api/improvements/:id/status` は、候補外の値(旧 `wontfix` を含む)を 400、許されない遷移を 409 `invalid_transition` にする。UPDATE の条件に元の状態を含め、並行した変更を 1 本だけ通す。
- **読取経路と削除中の除外**: 画面の読み取りは `loadRow`(`user_id` と `id` と `deleted_at IS NULL`)を通す。一覧は SQL と core の二重で削除中を外す。関連する依頼の SQL も同じ。コピー記録・再発行・状態の UPDATE にも `deleted_at IS NULL` を掛ける。例外は 2 つで、削除と復元のべき等判定(`loadOwnRowIncludingDeleted`)と、R2 の孤児照合(`improvement-orphan-sweep.ts`。削除中の行も画像を持つので、外すと画像を孤児と誤って消す)。
- **agentGuard**: トークンが無い・形式が違う・行が当たらない・期限切れ・回数超過・添付の削除済みは 401、削除中は 404(OI-06)。取得のたびに `token_fetch_count` を 1 増やす。
- **採番**: `improvement_request_counters` が利用者ごとの `last_seq` を持つ。作成は counters の UPSERT と行の INSERT を 1 つの batch に置き、削除しても番号を戻さない。
- **夜間の完全消去**: `improvement_retention` に、`deleted_at` から 30 日を過ぎた行の選択と削除を足した。R2 の画像を先に消し、成功した行だけを D1 から消す。削除の条件に `deleted_at` を残し、選択の後に『元に戻す』が入った行は消さない。履歴は外部キーの `ON DELETE CASCADE` で消える。消した件数は `RETURNING` で数える(`meta.changes` は CASCADE で消えた履歴まで数えるため)。
- **migration 0054**: `improvement_requests` を作り直して状態の CHECK を張り替え(wontfix→done)、`seq`・`deleted_at` を足し、件名を NULL 許容にする。アクティビティの表と counters を作り、全行に作成の履歴、wontfix だった行に `migrated_wontfix` の履歴を 1 行ずつ入れる。
- **画面の分割**: `pages/Improvement.tsx` は `pages/improvement/ImprovementPage.tsx` を再 export するだけの入口にする(遅延読み込みを保つため)。本体は `pages/improvement/` に、作成フォーム・一覧・詳細パネル・選択中バー・トースト・view-model に分けた。撮影は `components/CapturePanel.tsx` と `improvement-handoff.ts`(メモリだけの受け渡し)。

## 6. 独立レビュー(P03)

- **core テストの置き場**: `packages/core/test/improvement-screen.test.ts` に置く。core の他の画面(`cash-screen.test.ts` など)と同じ場所で、feature の resource_scope もここを指す。spec の `src/` 表記は据え置く。
- **読取経路の一覧と現物の照合**: `rg "improvement_requests|improvementRequests\)" packages/api/src`(テストを除く)の結果は §5 のとおりで、`loadRow`・一覧・関連・コピー記録・再発行・状態・削除・復元・agent・夜間の完全消去・孤児照合のすべてで、削除中の扱いが意図どおりだった。`store.ts:796` は `BACKUP_SNAPSHOT_SQL` への追加を禁じる注記。
- **404 / 400 / 409 の期待値**: 他の利用者と存在しない id は同じ 404 で区別できない。候補外の状態は 400、遷移の違反は 409。本文 1001 字・確認の欠け・形式外の画像は 400。期待値は api 統合テストで固定した。
- **OI-06 の応答**: 削除中の 404 は agentGuard の最後(トークンの照合の後)で返す。照合の前に返すと、トークンを知らない者にも「削除中の依頼がある」ことが分かるため。

## 7. 検証の記録

### P04 の変異検算

テストが本当に実装を見張っているかを、実装を 1 か所ずつ壊して確かめた。壊した実装は検算の後にすべて元へ戻し、差分が無いことを確かめた。

| # | 壊した箇所 | 結果 |
|---|---|---|
| M1 | `loadRow` の `isNull(deletedAt)` を外す | api 統合「削除中の依頼は詳細・画像・…で 404」が落ちた |
| M2 | 一覧の SQL の `isNull(deletedAt)` だけを外す | 等価変異。core の `buildImprovementList` が削除中を外すので結果は変わらない |
| M2x | 一覧の SQL と core の両方から除外を外す | api 2 件(「削除中の行は items にも counts にも入らず…」「削除から復元で同じ id と seq が…」)と core AC-004 の 3 件が落ちた |
| M2c | core の除外だけを外す | api は通り、core AC-004 の 3 件が落ちた。除外の正本は core で、SQL は多層防御 |
| M3 | 関連の SQL の `isNull(deletedAt)` だけを外す | 等価変異。core の `relatedImprovements` が外す |
| M3x | 関連の SQL と core の両方から除外を外す | api「関連する依頼は同じ route の他の行を最大 3 件…」と core の関連の 1 件が落ちた |
| M3c | core の除外だけを外す | api は通り、core の関連の 1 件が落ちた |
| M4 | コピー記録の UPDATE の `deleted_at IS NULL` を外す | api 統合「削除中の依頼は…コピー記録…で 404」が落ちた |
| M5 | agentGuard の削除中の 404 を外す | api 統合「削除中の依頼は…agent の 2 経路で 404」が落ちた |

M2・M3 の等価変異は、SQL の条件を外しても core が同じ行を外すためで、テストの見落としではない。両方を外した M2x・M3x で落ちることで、どちらの層が抜けても誰かが気づくことを確かめた。

### P06 の実行記録

`pnpm lint`・`typecheck`・`test`・`skills:test` の結果は [`evidence.md`](evidence.md) の「品質ゲート」に、日時とコミットつきで残した。

### P08 の監査

`rg` で web と api(テストを除く)から、core にあるべき計算を探した。

| 対象 | 件数 | 中身 |
|---|---|---|
| 遷移表 | 0(計算) | 見つかった 3 件は `contract.ts` の drizzle の列の値の集合(DB の CHECK と同じ 4 値)で、遷移の判定ではない |
| IMP 番号の整形 | 0 | 見つかった 2 件はコメント |
| 概要の 40 字 | 0 | — |
| 件数 | 0 | 見つかった件は別の画面の `counts` |
| 関連の 3 件 | 0 | 見つかった `slice(0, 3)` は別の画面 |
| マスクの正規表現 | 0 | web の `maskSensitiveText` は core の `redactPersonalInfo` を呼ぶ |
| 旧参照(`IMPROVEMENT_TITLE_MAX` など) | 0 | 見つかった 3 件は別の機能の 120・4000 |
| 旧 `pages/Improvement` | 1 | `AuthenticatedApp.tsx` の遅延読み込み。入口は再 export だけ |

### P09 の保証

- 初期 JS 予算は `pnpm build`(web の `build:bundle` の直後に `check:js-budget`)で確かめた。画面の本体は遅延読み込みで、初期バンドルに入るのは右下のボタンと撮影パネルだけ。
- キーボード操作: 範囲選択は矢印キーで動かし Enter で確定、Escape で取り消す(`improvement-capture.dom.test.tsx`)。CI の headless Chrome は `pointer: none` なので、ポインタの有無に依らない形で書いた。
- 404・400 は §6 のとおり api 統合テストで固定した。

## 8. 配信前のレビュー(P10)

- **結論**: 配信してよい。ただし巻き戻しは対称でないので、下の前提を配信の手順書(`docs/improvement-request.md` の「配信と巻き戻し」)に載せた。
- **確かめたこと**
  - migration 0054 は既存の行・画像のキー・トークンのハッシュを落とさない(`improvement-migration-0054.test.ts`)。
  - 夜間予算は 49 で、Free の上限 50 に 1 本の余白を残す。
  - 新しい secret・binding・Cron は無い。
  - 改善リクエストの 3 表は `BACKUP_SNAPSHOT_SQL` に入らない。
- **巻き戻しの前提(読んで確かめた挙動)**
  - schema guard は「適用済みの番号が期待より新しい」ときも `ready` とみなす(`schema-guard.ts` の `appliedVersion > expectedVersion`)。そのため、Worker だけを 0053 前提の版へ戻しても guard は止めず、旧コードが 0054 の表をそのまま使う。
  - 旧コードで起きること: (1) 作成は `seq` を渡さないので NOT NULL 違反で失敗する。(2) `deleted_at` を知らないので、削除中の行が一覧に戻って見え、30 日の完全消去も止まる。(3) `reconfirm` は旧画面の知らない状態として出る。(4) `wontfix` への変更は CHECK で失敗する。
  - したがって巻き戻す前に `SELECT status, deleted_at IS NOT NULL AS deleted, count(*) FROM improvement_requests GROUP BY 1, 2` で再確認の行と削除中の行の件数を確かめる(task P13 の Rollback)。0 件でなければ、コードだけの巻き戻しは表示の乱れを伴うと承知のうえで行うか、`docs/runbooks/prod-d1-schema-recovery.md` の手順(Time Travel の復元地点と 0053 前提の版)で表ごと戻す。コードだけの巻き戻しで作成が止まる点は、どちらの場合も変わらない。
- **配信の前に残すこと**: merge の直前に `origin/main` を fetch し、migration の番号 0054 が空いていることを確かめる(番号は main に先に入ったほうが勝つ)。

## 9. 参照画像との差分

`design/FINAL-UI/images/20-improvement.png` と比べて、意図して変えた点。

- 共通シェルの文言(取引ライン・最終更新・月次クローズ・フッター)は画像を期待値にしない(スコープ外)。
- 画像の『画像を差し替え』は、『キャプチャを撮り直す』と役割が重なるため、関連ページへ戻って撮る 1 つの操作にまとめた(OI-04)。
- 一覧の行全体を押せる形ではなく、IMP 番号をボタンにした。表の読み上げを崩さないため。
- 詳細パネルの削除は確認ダイアログを出さず、トーストの『元に戻す』で戻す。

## 10. 書き込みの道具(2026-09-24 利用者依頼で追補)

- **依頼**: 「マスキングやお絵かきができない」「画像が小さくて書き込みにくい」「四角で囲ったり、ペンの色を変えたり、文字を入力できたり」「書き込んだ文字や色や枠を移動できると便利」。
- **結論**: 画像の下に最初から道具を出す。枠・ペン・文字・マスク・移動の 5 道具と、赤・青・緑・橙・黒の 5 色(マスクは常に墨色)。『拡大して書き込む』で画面いっぱいのダイアログを開き、インラインと同じ書き込みを共有する。
- **移動を別の道具にした理由**: 枠の道具のまま既存の枠をドラッグすると、「新しく描く」のか「動かす」のか区別できない。
- **掴む優先**: 後から書いたもの → 枠の中身より枠線・ペン・文字・マスク。大きな枠の中のペンや文字も掴める。動かしても大きさ・形・色・文字は変えず、画像の外へは出さない。
- **『1つ戻す』**: 最後の図形を消すのではなく、最後の操作(描く・動かす・全消去)を取り消す(最大 100 操作)。移動の後に押して図形ごと消えるのを避けるため。
- **fail-closed**: マスクの焼き込みに失敗したら送らない。
- **確かめたこと**: `annotate-image.dom.test.ts`(36 件)・`improvement-annotate.dom.test.tsx`(18 件)。わざと壊した 4 通り(当たり判定の順・画像外への制限・取り消しの中身・指を離した位置)をテストが落とすことを確認した。4185 の実画面で、青い枠を速くドラッグして動かし、『1つ戻す』で元の位置へ戻ることを画素で確かめた。
