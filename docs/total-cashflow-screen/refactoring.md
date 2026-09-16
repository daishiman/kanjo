# 総収支画面 整理と移行の記録 (SYS-TCSCREEN-P08)

規則を `packages/core/src/total-cashflow.ts` へ集め、判断を保存する 3 表を移行・復元の対象へ入れたときの記録。
「何を動かしたか」ではなく「動かしたことで壊れうるもの」を残す。

## 1. 規則を core へ集めた範囲

画面と API が同じ数値を二重に持つと、片方だけ直したときに画面の数字と規則が食い違う。
以下はすべて core の定数と純関数が正本で、API も画面もそこから読む。

| 規則 | 正本 | 値 |
|---|---|---|
| 一致度の配点 (BR-001) | `MATCH_SCORE_AMOUNT` / `MATCH_SCORE_DATE` / `MATCH_SCORE_ACCOUNT` / `MATCH_SCORE_TEXT` | 40 / [30,20,10,5] / {same:15, unknown:8, conflict:0} / {same:15, partial:8, none:0} |
| 候補に入る日数差 | `REVIEW_NEAR_DAYS` | 3 |
| 候補の表示上限 | `REVIEW_MAX_CANDIDATES` | 3 |
| 除外の理由区分 (BR-004) | `EXCLUSION_REASON_CODES` | transfer / internal / book_only / duplicate / other |
| 除外メモの長さ | `EXCLUSION_MEMO_MAX` | 200 |
| 一括操作の件数 | `MAX_VERDICT_ITEMS` / `MAX_EXCLUSION_ITEMS` (`packages/api/src/routes/total-cashflow.ts`) | 各 200 |

一致度を保存しないのは意図的。保存すると口座名の正規化規則を変えたときに古い点だけが残り、
画面の数字と規則が食い違う。毎回 `matchScore` で計算する。

## 2. 既存の除外理由が読めること (FR-004)

移行 `0041` より前の `freee_deal_exclusions` は自由文の `reason` しか持たない。
`reason_code` と `memo` を足したうえで、既存行には次の扱いを与えた。

- 表示文 (`reason`) はそのまま残す。書き換えない。
- 集計語 (`reason_code`) は一律 `other`。**理由文から区分を推測して振り分けない。**
  「振替」と書いてあっても、それが BR-004 の `transfer` と同じ意味で書かれた保証がないため。
- `memo` は `NULL` のまま。画面は `memo ?? reason` を出すので、既存行は今までどおり理由文が出る。

固定しているテスト: `packages/api/test/total-cashflow-backup.integration.test.ts` の
`移行 0041 より前に保存された除外 (FR-004)`。

このテストは **0040 までを適用した DB に旧形式の行を入れてから 0041 を当てる**形で書いた。
全部適用した後に列を `NULL` へ戻す作りだと、移行の `UPDATE` 自体を一度も通らずに緑になる。

## 3. 3 表がバックアップで保護されること (FR-006)

`duplicate_verdicts` / `freee_deal_exclusions` / `total_cashflow_operations` を
バックアップと復元の対象へ入れた。復元の挙動は 2 通りある。

| バックアップ | 復元後 |
|---|---|
| 3 表の key を持たない (0041 以前に取ったもの) | 既存の判断がそのまま残る |
| 3 表の key を持つ | その時点の判断へ戻る |

key の有無で分けるのは、旧バックアップの復元が「判断を全部消す操作」になるのを避けるため。
両方とも `packages/api/test/total-cashflow-backup.integration.test.ts` の
`復元 バックアップと総収支の判断 (FR-006)` が固定している。
件数だけでなく除外の中身 (`freeeKey` / `reason` / `reasonCode`) まで見ているのは、
別の理由で 1 行入っても緑になる書き方を避けるため。

## 4. 見つけた不具合と対処: 復元 1 回の D1 問い合わせ数

### 何が起きていたか

3 表を復元対象に足したことで、復元 1 リクエストが発行する statement が 3 本増え、
`D1_FREE_QUERY_LIMIT = 50` (`packages/api/src/import-lifecycle.ts`) にちょうど到達していた。
結果として **freee 明細を 1 件でも持つ利用者は、バックアップ復元が必ず 413 で失敗する**状態だった。

この上限は動かせない。根拠は `docs/spec-v1.1.md` の原則 3 (Cloudflare 無料枠内で運用し、
有料化が必要になる変更は要承認) と `architecture/arch-import-deletion-undo-boundary.md` の DEL-005。

### どう相殺したか

0040 と 0041 が既に使っていた「復元先が空なら `DELETE` を撃たない」やり方を、
無条件に `DELETE` していた 5 表へ一貫して適用した。

- 対象: `rules` / `tx_edits` / `institution_owners` / `budgets` / `cash_overrides`
- 件数の取り方: `loadImportRestoreSettingsSnapshot` の既存の 1 本の `UNION ALL SELECT` に
  サブクエリとして相乗りさせた。**追加の問い合わせは 0 本。**
- 併せて `reviewStateCounts` を `destinationRowCounts` へ改名した。
  判断 3 表だけでなく設定 5 表の件数も持つようになり、元の名前が中身と合わなくなったため。

### 退行しないようにした固定

`packages/api/src/import-lifecycle-pure.test.ts` の
`総収支の判断3表を積んだ復元が、白紙の移行先で上限未満に収まる`。

このテストは 2 つを同時に見ている。

1. 白紙の移行先への復元が `plan.total < plan.limit` に収まる (実測 14 本)
2. 件数を渡さない側との差がちょうど **10** (実測 24 本 − 14 本)

2 を入れているのは、5 本の条件化のどれか 1 つを戻すだけで差が 9 になって落ちるようにするため。
1 だけだと、条件化が 1 つ素通りしていても上限内に収まる限り緑になる。

**書いていて一度落ちた**: 最初は差が 8 だった。0040 の `reviewSnoozes` と `monthlyCloseReviews` を
バックアップに渡していなかったため、`...(writeSet.reviewSnoozeRows ? [...] : [])` の外側の条件で
false になり、`DELETE` の判定そのものに到達していなかった。key はあるが 0 件、という形に直した。

## 5. 整理の前後で緑であること

受入基準が求める 2 つ。結果は `docs/total-cashflow-screen/test-run.md` に実測で記録している。

- `pnpm --filter @kanjo/core test`
- `pnpm --filter @kanjo/api test`
