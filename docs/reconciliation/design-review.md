# 照合画面 設計レビュー (SYS-RECON-P03)

- 対象: `docs/reconciliation/architecture-decision.md` (P02)
- 基準: `specs/spec-reconciliation.md` の BR-001..BR-009・API 契約・セキュリティ確認、`architecture/reconciliation-*.md`
- 方法: P02 の各決定を BR と仕様の制約に 1 件ずつ突き合わせる。矛盾・未定義・既存コードとの衝突を指摘として挙げ、P02 を直して閉じる。
- 読んだ既存コード: レビュー時点の次のファイルを読み、実装上の衝突もレビューの対象にした。
  - `migrations/`
  - `store.ts` のバックアップ SQL
  - `canonical-mutation-fence.ts`
  - `duplicate-verdict-bindings.ts`
  - `total-cashflow.ts` (core)
  - `RouteIcon.tsx` と `route-icon-distinct.test.tsx`
  - 夜間 cron の D1 予算検査

## 1. BR との突き合わせ

| BR | P02 で該当する決定 | 判定 |
|---|---|---|
| BR-001 一致度の加点 | §5 一致度の式。丸めは U1 として P04 のテストで決める | 適合 |
| BR-002 bigram の Dice と 0.5 | §5 の正規化・類似度・しきい値。表記の限界を明記 | 適合 |
| BR-003 金額の差異と日付の近い取引 | §5 キュー。±3 日と向きを条件に含める | 適合 |
| BR-004 ステータス | 現行 5 状態は仕様正本の「状態・件数・投影の正本」と core テストで固定 | 適合 |
| BR-005 解消率と分母 0 | §5 KPI。除外は分母に入れず、分母 0 は `null` | 適合 |
| BR-006 月次クローズの自動 3 つと手動 1 つ | 照合は core の全期間 `actionRequiredCount`、月次レビューは保存 API | 適合 |
| BR-007 `duplicate_verdicts` の共用と結び直し | §1・§3 既存表を共用し、`bindDuplicateVerdicts` を 4 画面で共通に使う | 適合 |
| BR-008 取り消しは直前 1 件、再取消不可 | §2 undo の 409 系。§4 は最新かつ未取消だけを受け付ける | 適合 |
| BR-009 一括は 200 件まで、件ごとの成否 | §2 targets 1〜200 と `results[]`。§4 はバインド上限で文を分割 | 適合 |

## 2. 指摘と是正

| # | 重大度 | 指摘 | 是正 (P02 への反映箇所) | 状態 |
|---|---|---|---|---|
| R1 | 高 | 照合画面が独自の判定器を持つ案では、各画面の対応必要件数がずれる | 判定器を `reconcileBizDuplicates` 1 本、対応必要総数を `actionRequiredCount` 1 値にした | 是正済み |
| R2 | 高 | migration の番号 0040 は、概況画面の `0040_review_snoozes_and_monthly_close_reviews.sql` が使用済み。同じ番号では適用順が壊れる | 番号を 0041 にし、`EXPECTED_D1_MIGRATION` を同じ差分で更新する (§3) | 是正済み |
| R3 | 高 | 取り消しで「任意の過去の操作」を戻せると、後の操作が書いた行を古い値で上書きし、後の判断が黙って消える | 取り消せるのは最新かつ未取消の操作だけ。それ以外は 409 `action_not_latest` (§2・§4) | 是正済み |
| R4 | 中 | 90 日の削除を夜間 cron に足すと、cron の D1 呼び出し予算 (47/47) を超え、既存の予算検査が落ちる | POST actions の batch の中で古い記録を消す。記録は操作したときだけ増えるので、件数は有界に留まる (§4) | 是正済み |
| R5 | 中 | 月次レビュー用の新表を作る案は、0040 の `monthly_close_reviews` と重複する | 既存表を再利用し、API だけ追加する (§3)。新設は `mf_tx_exclusions` と `reconciliation_actions` の 2 表 | 是正済み |
| R6 | 中 | 照合用のアイコンを `RouteIcon` に足すと、「登録済みは必ずナビで使う」契約に反し、`route-icon-distinct` が落ちる | 操作・状態のアイコンは `UiIcon` に登録する。対応表は `docs/reconciliation-icons.md` (§6) | 是正済み |
| R7 | 中 | 「別の取引」と判断した行の状態が未定義。未処理に戻すと、判断したのに要確認や MF未計上に残り続ける | 「照合済み (`matchedBy='different'`)」として解消に数える (§5) | 是正済み |
| R8 | 中 | MF 明細の除外を tx_id だけで持つと、再取込で tx_id が変わったときに除外が外れる | 現行版の stable_key も保存し、tx_id が無ければ stable_key で結び直す。鍵が重複した場合は結び付けない (§4) | 是正済み |
| R9 | 低 | 全件が対象外 (分母 0) のとき、解消率を 0% と表示すると「何も終わっていない」と誤解させる | `resolutionRate: null` を返し、画面は「対象なし」と出す (§5) | 是正済み |
| R10 | 低 | 0.5 ちょうどの判定を浮動小数で行うと、端数によって結果が揺れる | 整数の比較 `4c >= na + nb` にする (§5、U3) | 是正済み |
| R11 | 低 | 「同じ取引」の判断で名指しした freee を、後で「別の取引」に変えた後も残すと、再び「同じ」に戻したときに古い相手が復活する | `different` を書くときは `freee_key` を `null` にする (§4 の実装方針) | 是正済み |

## 3. 横断確認

- **外部送信**: 新しい fetch 先や外部 SDK は無い。照合は D1 と core の計算だけで完結する。
- **認証**: 3 本の API は `/api/*` の下にあり、authGuard を必ず通る。未認証の 401 は P04 の API テストで固定する。
- **直列化**: actions / undo と、総収支の判断・除外 API を `CANONICAL_MUTATION_ROUTES` に追加した。取込・復元と同時に書き込まない。
- **バックアップ**: 判断の表は再取込後も stable_key で結び直せる。バックアップ・復元での扱いは P08 で確かめる (`refactoring.md`)。
- **性能**: GET は既存の `loadDataset` に、判断・除外の 3 表の読み取りを足すだけで、N+1 は無い。一括の書き込みはバインド上限ごとに文を分けて、1 回の batch にまとめる。

## 4. 結論

指摘 11 件はすべて P02 に反映済みで、是正未了は 0 件。数値の細部 (U1..U3・U5..U7) は P04 の失敗テストで固定し、P05 の実装で緑にする。
