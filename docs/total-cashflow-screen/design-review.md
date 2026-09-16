# 総収支画面 設計レビュー (SYS-TCSCREEN-P03)

`architecture-decision.md` の決定を実装単位へ落とし、危ういところを先に潰す。

## 1. core の追加 API

```
MATCH_SCORE_AMOUNT = 40
MATCH_SCORE_DATE   = [30, 20, 10, 5]   // |dayGap| 0,1,2,3 / 4以上は 0
MATCH_SCORE_ACCOUNT = { same: 15, unknown: 8, conflict: 0 }
MATCH_SCORE_TEXT    = { same: 15, partial: 8, none: 0 }

matchScore(candidate): number                 // 0..100 の整数
previousYearPeriod(range): PeriodRange        // 開始月・終了月をそれぞれ 12 か月前へ
totalCashflowScreen(all, allDeals, verdicts, exclusions, range): TotalCashflowScreen
```

`TotalCashflowScreen` は `period` / `summary` / `series` / `workbench` / `autoMatches` / `report` を持つ。
`report` は既存の `totalCashflowReport` の戻りをそのまま入れ、API の互換フィールドはここから出す。

### 一致度の検算

自動一致は「同じ向き・同額・発生日一致」の組だけなので、金額 40 と日付 30 は常に付く。
口座は最小 8 (片側に情報なし)、摘要は最小 0。よって **最小 78、最大 100**。
仕様が言う「78〜100 をそのまま表示」と配点が一致する。100 に丸めない。

### 摘要の比較

`normalizeInstitution` と同じ正規化を通してから、MF の `content` と freee の `partner` を比べる。
完全一致 15、片方が他方を含む 8、それ以外 0。空文字は「含む」が常に真になってしまうので、
**どちらかが空なら 0** とする (仕様の「それ以外」に入る)。

## 2. BR-005 を満たすための `nearCandidates` の作り替え

現状は除外済みを先に落としてから上位3件を切っているため、「除外を考えない候補が何件だったか」が失われる。

**変更**: `nearCandidates` は除外を考えない候補を近い順に並べて返す (slice しない)。呼び出し側で

```
const raw = nearCandidates(tx, deals, keys);
if (raw.length === 1 && excludedKeys.has(raw[0].freeeKey)) continue;  // review から出す
const candidates = raw.filter(c => !excludedKeys.has(c.freeeKey)).slice(0, REVIEW_MAX_CANDIDATES);
```

`continue` した明細は `leftover` に落ち、`resolveTx` の公私仕分けで数えられる。
除外を戻せば `raw.length === 1` の枝を通らなくなり、自動的に review へ戻る。**戻す専用の処理は書かない**。

候補が2件以上で全部除外済みの場合は `candidates` が空のまま review に残る (U-004)。

### 既存挙動との同値性

第一段・第二段の消し込みは `nearCandidates` を使っていない (`byBucket` を直接引く) ので影響しない。
review ループでは、除外された候補は結局 filter で落ちるため、
`raw.length === 1 && excluded` 以外のすべての場合で今までと同じ配列になる。

## 3. API の応答

GET `/api/total-cashflow` に加算する (既存フィールドは互換のため残す):

| key | 中身 |
|---|---|
| `summary` | `{ segment: { total, biz, household } }` 各々 `income/expense/balance` と `previousYear`(差額・率・null 可) |
| `series` | 月ごとの `{ month, income, expense, balance }` を総合/事業/家計の3系統 |
| `workbench` | `{ duplicates[], needsReview[], excluded[] }` と各件数、判定済み件数 |
| `autoMatches` | `by==='auto'` の matched に `score` と `verdict`(未判定/same/different) を添えたもの |
| `lastOperation` | `{ id, kind, itemCount, createdAt, undoable }`。GET 直後は `undoable: false` |

POST `/total-cashflow/verdicts` は応答に `operationId` を足す。
除外の POST/DELETE は `{items:[{freeeKey, reasonCode, memo?}]}` と `{freeeKeys[], reasonCode, memo?}` を受け、
旧 `{reason}` は `memo` + `reasonCode: 'other'` として受け続ける (既存クライアント互換)。

`reasonCode` は `transfer` / `internal` / `book_only` / `duplicate` / `other`。表示語は 振替 / 内部移動 / 帳簿のみ / 二重登録 / その他。
`memo` は 0〜200 字。1リクエスト最大 200 件。

## 4. 取消の判定順序

1. `id` で行を引く。無い、または `user_id` が違う → **404**。
2. その `user_id` の「`kind != 'undo'` かつ `undone_at IS NULL`」を `created_at DESC, id DESC` で1件取る。
3. それが対象と違う → **409** (最新ではない)。
4. `items_json` から復元を適用し、対象に `undone_at` を入れ、`kind='undo'` の行を `undoes_id` 付きで足す。

すでに `undone_at` が入っている行を再送した場合、手順2の最新は別の行 (または無し) になるので手順3で 409 になる。
これが「同じ取消を2回送っても1回分しか戻らない」の担保で、別途の重複検査は要らない。

サーバは古さの上限を持たない。何日前の操作でも、それが最新の未取消操作なら取り消せる。

## 5. 復元の中身

| kind | 復元 |
|---|---|
| `verdict` | 操作前の verdict 値へ戻す。操作前が未判定なら行を消す |
| `exclude` | 追加した `freeeKey` を除外から消す |
| `restore` | 消した除外を `reasonCode`/`memo`/`createdAt` ごと書き戻す |

`items_json` は「操作後の値」ではなく **操作前の値**を持つ。後から逆算しないため。

## 6. 危ういところ

- **一括200件の書込みと D1 の束縛変数上限**: 既存の `EXCLUSION_ROWS_PER_STATEMENT` と同じ分割を、列が増えた後の数で計算し直す。列は 5 → 7 (`reason_code`, `memo` 追加) になる。
- **`items_json` の肥大**: 200 件 × 1 件あたり数十バイトで収まる。列に上限は置かないが `item_count` を別に持ち、一覧では JSON を読まない。
- **同一 `freeeKey` を1リクエスト内で重複指定**: 先勝ちで de-dup してから件数を数える。そうしないと `item_count` と実際の書込み数がずれる。
- **期間が1か月のときの前年同期**: 12か月前の1か月がデータ範囲にあるかだけを見る。範囲外なら `null`。
- **`trend` の扱い**: 既存どおり全行同じ値。画像のグラフは `series` を使い `trend` に依存しない。
