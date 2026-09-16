# 照合画面 設計決定記録 (SYS-RECON-P02)

- 入力: `docs/reconciliation/requirements-baseline.md`、`architecture/reconciliation-{backend,database,security,frontend,ui-ux,auth,infrastructure,maintenance-ops}.md`
- 役割: API の形・表の列・判定規則の骨格を決める。数値の細部 (丸めなど) は P04 の契約テストで固定し、P05 で実装した。確定した値は §5 に記録した。
- 設計レビューの結果は `design-review.md` を参照。

## 1. 判定器を 1 本にする

| 決定 | 理由 |
|---|---|
| 照合の判定は core の `reconcileBizDuplicates` (total-cashflow.ts) を唯一の判定器とし、`reconciliationReport` はその結果に一致度・キュー・KPI を重ねるだけにする | 経路ごとに判定器を持つと対応必要件数がずれる。件数は判定器 1 本からしか作らない |
| 判断 (`duplicate_verdicts`) と除外 (`freee_deal_exclusions` / `mf_tx_exclusions`) は、判定器の入力として 4 画面すべてに同じ値を渡す | `bindDuplicateVerdicts` / `bindMfExclusions` を各ルートで共通に使い、読み込み経路の違いで件数が変わらないようにする |
| `buildExpenseProjection` と `monthlyCloseStatus` も同じ判断・除外を受け取る | ハブの事業支出と月次クローズの照合ステップが、照合画面の結果とずれないようにする |

## 2. API の形

| Method / Path | 入力 | 成功応答 | 失敗応答 |
|---|---|---|---|
| `GET /api/reconciliation` | 期間 (既存の期間クエリ) | 200 `{ period, kpi, statusCounts, sourceCounts, queues, rows, mfOnly, unmatchedFreee, lastAction }` | 401 |
| `POST /api/reconciliation/actions` | `{ action: 'same' \| 'different' \| 'exclude-mf' \| 'exclude-freee', targets: { txId?, freeeKey? }[1..200] }` | 200 `{ results[], saved, action }` (`saved=0` なら `action: null`) | 400 (件数・形式違反)、401、409 (fence) |
| `POST /api/reconciliation/actions/:id/undo` | なし | 200 `{ ok: true, action: { id, action, targetCount, undoneAt } }` | 400 `invalid_action_id` (UUID でない)、404 `action_not_found`、409 `action_already_undone` / `action_not_latest` / `action_snapshot_invalid` / `action_stale`、401 |
| `PUT /api/monthly-close/:month/review` | なし | 200 `{ month, reviewedAt }` (冪等。初回時刻を保つ) | 400 `invalid_month`、401 |
| `DELETE /api/monthly-close/:month/review` | なし | 204 | 400 `invalid_month`、401 |

`kpi.actionRequiredCount` が対応必要総数で、`kpi.reviewCount` は要確認だけの互換内訳とする。`unmatchedFreee` は API 契約として残るが、web の下段右には使わない。

- 一括操作は件ごとに `{ txId, freeeKey, ok, reason? }` を返し、1 件でも保存できれば全体は 200 (部分成功)。現行 reason と対処は [`runbooks/reconciliation-mismatch.md`](../runbooks/reconciliation-mismatch.md#3-操作の応答) を正とする。
- 他人の操作 id は 404 にし、存在の有無を漏らさない。
- 既存の総収支 API (`/total-cashflow/verdicts`、`/total-cashflow/freee-exclusions`) は残す (qa-backend-web-rc-decision-007)。

## 3. D1 の表

判断・MF側除外・操作履歴は、既存表の共用と 0041 の新表 2 件で次の 3 系統に分ける。

| 表 | 区分 | 列 (要約) | 主キー / index |
|---|---|---|---|
| `duplicate_verdicts` | 既存を共用 | user_id, tx_id, verdict (same / different), stable_key, fingerprint_version, freee_key, decided_at, updated_at | (user_id, tx_id) |
| `mf_tx_exclusions` | 新設 (0041) | user_id, tx_id (1〜120 文字), stable_key, fingerprint_version, reason (1〜200 文字), created_at | PK (user_id, tx_id)、index (user_id, stable_key) |
| `reconciliation_actions` | 新設 (0041) | id, user_id, action (CHECK 4 値), target_count (1〜200), before_json, after_json, created_at, undone_at | PK id、index (user_id, created_at) |

- freee 側の除外は既存の `freee_deal_exclusions` を使う。月次レビューは既存 0040 の `monthly_close_reviews` を使う。
- migration は `migrations/0041_reconciliation_tables.sql`。`CREATE TABLE IF NOT EXISTS` と `CREATE INDEX IF NOT EXISTS` だけで、既存表の変更・削除はしない。仕様では番号を 0040 と書いていたが、0040 は概況画面が使用済みのため 0041 にした。
- `schema-guard.ts` の `EXPECTED_D1_MIGRATION` を `0041_reconciliation_tables.sql` にする。

## 4. 書き込みの安全性

| 決定 | 内容 |
|---|---|
| fence | `CANONICAL_MUTATION_ROUTES` に照合の actions / undo と、総収支の verdicts / freee-exclusions (POST / DELETE) を追加する。取込・復元の実行中は 409 で拒否する (qa-security-web-rc-decision-009) |
| 原子性 | 判断・除外・操作記録・古い記録の削除を 1 回の `db.batch` にまとめる。途中で失敗しても半端な状態を残さない |
| 取り消し | `before_json` に操作前の行 (無ければ `row: null`) を残し、取り消しは同じ batch 形式で書き戻す。最新かつ未取消の操作だけを受け付ける |
| 保持 | 90 日より古い `reconciliation_actions` は POST actions の batch 内で削除する。夜間 cron の D1 予算 (47/47) を増やさないため |
| 入力検証 | zod で action の enum、targets 1〜200、txId ≤120、freeeKey ≤2000 を検証する。D1 のバインド上限 (`D1_MAX_BOUND_PARAMS`) に合わせて文を分割する |
| 同一性 | MF 明細は tx_id を優先し、無ければ現行版の stable_key で結び直す。同じ鍵に複数の明細が当たる場合は結び付けない (`unstable_identity`) |

## 5. 判定規則と確定値

| 項目 | 規則 | 確定値 (未決事項) | 固定テスト |
|---|---|---|---|
| 内容の正規化 | NFKC → 空白除去 → 小文字化 | - | core `全角半角・空白・大文字小文字の違いは同じとみなす` |
| 類似度 | 文字 bigram の Dice 係数 `2c / (na + nb)` | U2: 多重集合で数える (「ああああ」と「ああ」は 0.5) | core `重複 bigram は多重集合で数える` |
| 短い文字列 | 正規化後 2 文字未満は完全一致で 1、それ以外 0 | - | core `2 文字未満は正規化後の完全一致だけで判定する` |
| しきい値 | `CONTENT_SIMILARITY_THRESHOLD = 0.5` 以上で類似 | U3: 整数比較 `4c >= na + nb` で、0.5 ちょうどを含める | core `0.5 ちょうどは類似に含める` |
| 一致度 | 金額一致 50 + 日付 (0 日 30 / 1 日 20 / 2 日 10 / 3 日 5 / 4 日以上 0) + 類似度 × 20 | U1: `Math.round` (93.33→93、65.5→66) | core `一致度は Math.round で整数にする` |
| 状態・キュー・KPI | 現行の意味は仕様正本 [`specs/spec-reconciliation.md`](../../specs/spec-reconciliation.md#状態件数投影の正本) を参照。本 ADR は再定義しない | `reconciliationReport` と境界値テスト | core `照合の行と状態` / `件数の一本化` |
| 月次レビュー API | 既存 0040 の表に PUT / DELETE | U5: PUT 200 `{ month, reviewedAt }`、DELETE 204 | API `PUT は 200 と reviewedAt、DELETE は 204` |
| 取り消し | 直前 1 件のみ | U6: 再取消は 409 `action_already_undone`。actions の成功は 200 `{ results, saved, action }` | API `最新でない操作は 409、最新は 200 で書き戻し、再取消は 409` |
| 本文への反映 | - | U4: `docs/data-schema.md` と `docs/reconciliation.md` に記載 | `pnpm lint` |

表記の限界: 「アマゾン」と「Amazon」のようにカナと英字で書かれた同じ店は、類似度が 0 になる (qa-backend-web-rc-decision-012)。この場合は金額と日付の点数だけで候補に上がり、利用者が判断する。

## 6. 画面の構成

| 決定 | 内容 |
|---|---|
| データの流れ | 一致度・件数・キューはサーバが core で計算した値をそのまま描く。web 側で再計算しない |
| キャッシュ | query root は `['reconciliation']`。`ANALYSIS_DERIVED_QUERY_ROOTS` の `['business-spend']` をこれに置き換え、判断・取込の後に照合・ハブ・総収支を一緒に無効化する |
| アイコン | 操作・状態のアイコンは `UiIcon` に登録する。`RouteIcon` はナビ専用の契約を持つため (`docs/reconciliation-icons.md`) |
| 狭幅 | 1099px 以下で 1 カラムに縦積み (キュー → 一覧 → 詳細)、639px 以下で KPI を 1 列 |
| 画像との差 | 一覧の並べ替えは付けない (日付降順固定)。直前の操作は件数で表示。freee の補助科目は決済口座 (settleAccount) で代用 |

## 7. レビューで是正した判断

最終レビューの指摘 (15 件) を受けて、次のとおり決めた。検算 (是正を戻すとテストが落ちること) は `final-review.md` に記録する。

| # | 決定 | 理由 | 固定テスト |
|---|---|---|---|
| 1 | 相手の freee を名指しした「同じ」は、金額が違っても `reconcileBizDuplicates` の第二段で組にする。名指しの無い「同じ」は従来どおり同額だけ | 金額の差異キューで「同じ」を選んでも照合済みにならず、同じ行が問いに残り続けていた。総額には正本の freee 側の金額を残す | core `金額の差異の行で相手を名指しして…` |
| 2 | 一括照合は、未解消 (要確認・未処理) で freee の候補がある行だけを送る。確認ダイアログに対象と送らない件数を出し、対象 0 件なら押せない | 照合済み・除外済みの行まで「同じ」で上書きしていた | DOM `一括照合は候補のある未解消行だけを…` |
| 3 | 失敗の表示は `ApiError.code` で分ける。再試行を出すのは待てば通る `canonical_write_busy` と通信失敗だけ | 取り消しの 409 まで「取込中」と表示していた | DOM `取り消しの 409 (%s) は取込中と言わず…` |
| 4 | 総収支の画面での判断・除外の後も、照合 (`['reconciliation']`) と月次クローズのキュー (`['review-queue']`) を無効化する | 同じ判断の表を読むのに、照合画面に古い件数が残っていた | DOM `重複判断の保存後に分析ハブ・照合・月次クローズのキューを無効化する` |
| 5 | 月次クローズとサイドバーは全期間、照合ページとハブは選択期間の `actionRequiredCount` を使う | 期間分析と締め漏れを防ぐ全期間ゲートを分離する | 同じ投影scopeの件数一致テスト |
| 6, 13 | `GET /api/reconciliation` は全期間のデータで消し込みを行い、表示する行・下段・事業支出だけを期間 (`months`) で絞る | 期間で先に切ると、月末の MF と翌月初の freee の組が割れ、要確認が相手の無い明細 (現在の MFのみ) に化けていた | core `期間で絞っても、月末の MF と翌月初の freee の組は割れず…` |
| 8, 9 | 「同じ」は freee の候補を必須にし (`no_candidate`)、候補は向きが同じで ±3 日以内の相手に限る (`freee_not_pairable`、core の `isPairableFreee`)。1 回に同じ明細を二度送ったら後の件を `duplicate_target` で失敗にする | 組めない相手の判断が保存され、件数と `saved` が食い違っていた | API `候補の無い「同じ」は no_candidate…`、`…duplicate_target で失敗として返す` |
| 10 | 新しく除外した freee 取引の取り消しは、除外の行を消す (元の行が無かったことを `row: null` で残す) | 取り消しても除外が残っていた | API `新しく外した freee 取引の取り消しは…` |
| 12 | 「別の取引」と判断した行を照合済みに数えるのは、判断が無くても照合の問いに載る明細 (事業支出か、±3 日に同額・内容の似た freee がある) だけ。収入の金額違いが金額の差異キューに入るのは仕様どおりとする | 家計の明細に残った古い判断で解消率の分母を水増ししていた。`BR-003` は向きを限定していない | core `家計の明細に残った「別の取引」は…` |
| 14 | 取り消しの前に、操作後の状態 (`after_json`) と現在の 3 表を比べ、違えば 409 `action_stale` で止める。判断の表 (`duplicate_verdicts`・`freee_deal_exclusions`・`mf_tx_exclusions`) はバックアップに含めない | 復元や別画面での変更の後に古い操作を戻すと、後の判断を消してしまう。判断の表をバックアップしない方針は既存の `duplicate_verdicts` と同じ | API `操作の後に同じ行が書き換わっていれば…`、`壊れた操作の記録は 500 にせず 409` |
| 15 | 総収支の画面で行った判断は、総収支の画面で解除する。照合の「元に戻す」は照合画面の操作だけを対象にし、その後に総収支で同じ明細を変えていれば `action_stale` で止める | 取り消しの対象を操作の記録がある範囲に限り、別画面の判断を黙って上書きしない | 同上 |

- 1 回の書き込みで D1 のバインド上限を超えないよう、判断は 1 文 12 行、MF 除外は 1 文 16 行に分ける。25 件の一括と取り消しを API テストで確かめる。
- id が UUID の形でない取り消しは、照会せずに 400 `invalid_action_id` を返す。
