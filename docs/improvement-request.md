# 改善要望

画面の不具合や「ここが使いにくい」を、そのときの画面と技術的な記録つきで送るための機能です。

## 1. 利用者向け

### 1.1 送り方

1. どの画面でも、**画面の右下に浮いている** **改善要望** のボタンを押します。どこまでスクロールしても同じ位置にあります（スマートフォンでは下のタブバーの上に出ます）。
2. 押した直後に、その画面が自動で撮影されます。撮影中はボタンが押せなくなり「画面を撮影中…」と出ます。撮影には、そのとき見えていた本文もそのまま写ります（改善要望のボタン自身だけは写りません）。
3. 撮影が終わると入力欄が開きます。**件名**（何が起きたか一言）と**内容**（どう操作して、何を期待して、何が起きたか）を書きます。
4. 撮った画像が縮小表示されます。写したくないものが入っていたら **このスクリーンショットを添付する** のチェックを外してください。外しても送信できます。
5. **送信する** を押すと、要望が保存されます。

撮影に失敗しても入力欄は開きます。その場合は文章だけで送れます。

### 1.1.1 画像に書き込む

添付したままにすると、画像の上を**ドラッグして赤い枠を書き込め**ます。「ここがおかしい」は文章より枠のほうが速く伝わります。

- 引き直したいときは **1つ戻す**、やり直したいときは **全部消す** を押します。
- 短く押しただけでは枠になりません（誤って点が増えないようにしています）。
- 枠は**送信するときに画像へ焼き込まれます**。書き込みが1つも無ければ、撮った画像はそのまま送られます。

### 1.1.2 一緒に送られる情報を送信前に確かめる

入力欄の下に **一緒に送られる情報** が出ます。ここに、送信する前に読める形で次が並びます。

- **画面**：どのページで起きたか
- **表示サイズ**：ウィンドウの大きさと拡大率
- **取得時刻**：撮影した時刻
- **ブラウザ** / **言語**
- **気になっている点**：記録のうち先に見るべき数件（最大3件）を、折りたたみを開かなくても読める位置に出します。重い種類（処理が止まった例外 → 通信の失敗 → エラー → 警告）を上に、同じ重さなら新しいほうを上に並べ、同じ内容が繰り返されている場合は1件に畳んで「N回起きています」と添えます
- **画面の裏で起きていた記録 N 件**：折りたたみを開くと、記録の1件ずつ（種類と要約）がそのまま読めます

この「気になっている点」と同じ数件が、Claude Code / Codex 用の指示文にも **先に見るべき記録** として載ります。送った人と直す人が同じところを見ることになります。

伏せ字の扱いは 1.3 と同じです。読んで「これは送りたくない」と思ったら、添付のチェックを外すか、要望を送らずに閉じてください。

### 1.2 送ったあとに出るもの

送信すると **Claude Code 用にコピー** と **Codex 用にコピー** のボタンが出ます。押すと、その要望を調べるための指示文がクリップボードに入ります。これを Claude Code や Codex に貼り付けると、要望の本文・そのとき起きていた不具合の記録・撮った画面を、AI が自分で取りに行って調査を始めます。

指示文の中には使い捨ての合言葉（トークン）が入っています。**この合言葉が画面に出るのは送信直後の1回だけ**です。閉じてしまった場合は、改善要望の一覧から該当の要望を開いて **指示文を作り直す** を押すと、新しい合言葉つきの指示文が出ます（古い合言葉はその時点で使えなくなります）。

合言葉には次の制限があります。

- 発行から **24時間** で切れます
- 取得できるのは **20回** までです

### 1.3 送られる技術的な記録について

要望には、そのとき画面の裏で起きていた失敗の記録が自動で添えられます。中身は「エラーの1行要約」「失敗した通信の宛先と結果」「起きた時刻」だけで、通信の中身（金額や明細）は最初から記録していません。

パスワード、ログインの合言葉、メールアドレス、長い数字の並び（口座番号など）は、送る前と保存するときの**2回**伏せ字（`***`）に置き換えられます。

記録は直近 60 件・合計 32KB までです。それを超えた分は古いものから捨てられ、捨てた件数が画面に「上限を超えた N 件は省略されています」と出ます。

### 1.4 添付はいつ消えるか

要望を **対応済み** にすると、そこから **30日後** に、その要望のスクリーンショットと技術的な記録が自動で消えます。

消えるのは添付だけです。**要望の件名・本文・対応状態・いつ対応済みにしたかの記録は残ります。** 何をいつ直したかの履歴は失われません。

対応済みにしていない要望の添付は消えません（調査中に証拠が消えると本末転倒なため）。

## 2. 運用向け

### 2.1 削除ジョブの相乗り先

改善要望の添付削除には、**専用の Cron はありません**。既存の夜間メンテナンス（`packages/api/wrangler.jsonc` の `triggers.crons`、JST 03:00 の1本）から呼ばれる `scheduledMaintenance` の `Promise.allSettled` 配下に `runImprovementRetention` として相乗りしています。

Cron の設定・実行の全体像は `docs/ci-cd-operations.md` が正本です。ここではこのジョブに固有の点だけを書きます。

- R2の個別削除失敗は件数`failed`として返し、成功したIDだけを1本の集合UPDATEで失効させます。
  個別失敗行、または集合UPDATE自体が失敗した全行は`purged_at`がNULLのまま残り、翌日に冪等再試行されます。
  これは処理済みの件数結果であって、job-level rejectではありません。
- D1障害や孤児照合payload guardなどでjob自体がrejectした場合、backupを先に確定した後の残る6 jobは
  `Promise.allSettled`で最後まで実行・記録されます。その後`scheduledMaintenance`が内容を含まない
  `scheduled_maintenance_failed`をthrowし、Cron全体を失敗として観測可能にします。
- 改善要望のテーブルは `packages/api/src/store.ts` の `BACKUP_SNAPSHOT_SQL` に**含めません**。会計の正本ではないため、夜間バックアップの対象外です（`packages/api/src/improvement-backup-exclusion.test.ts` が固定しています）。
- 孤児照合はR2から最大300 keyだけを先に取得し、そのexact keyだけをJSON 1 bindでD1に照合します。
  300件は最大1024-byte keyが全て6倍へJSON escapeされても1,844,101 bytesで、D1の2,000,000-byte
  string上限を下回ります。実UTF-8 byte guardもbind前に行い、超過時はR2を削除せずjob-level rejectにします。
- R2の続きがある場合はopaque cursorだけを`improvements/`外のversion付きcheckpointへ保存し、
  次の夜間実行で次pageを1枚進めます。D1照合またはR2削除の失敗時はcheckpointを進めず同じpageを再試行し、
  末尾pageでcheckpointを消して次回は先頭に戻ります。cursorやR2 keyはログに出しません。

### 2.2 実行結果の確認手順

Worker のログに、このjobについて1回の実行につき1行だけ JSON が出ます。

```bash
pnpm --filter @kanjo/api exec wrangler tail --format json
```

```json
{ "level": "info", "job": "improvement_retention", "selected": 3, "purged": 3, "failed": 0, "orphans": 0, "orphanScanned": 300, "orphanDeferredRecent": 0, "orphanHasMore": true, "orphanCycleCompleted": false }
```

| 項目 | 意味 | 異常のサイン |
| --- | --- | --- |
| `selected` | この実行で対象になった要望の件数 | 毎晩ゼロでない状態が続く＝削除が進んでいない |
| `purged` | 添付を消せた件数 | `selected` と一致しない |
| `failed` | R2 か D1 で落ちた件数 | 同じ件数が何日も続く（一時障害なら翌日ゼロに戻る） |
| `orphans` | D1 に対応する行が無い R2 オブジェクトを消した件数 | 継続して増える＝投稿処理が途中で落ちている |
| `orphanScanned` | 今回照合したR2 object数（最大300） | 孤児候補があるのに継続して0 |
| `orphanDeferredRecent` | 投稿途中を避ける5分猶予で今回は保留し、先頭に戻った次の巡回cycleで再訪する件数 | 同じ件数が長期間減らない |
| `orphanHasMore` | 次pageがあるか | `true`のまま長期間変化しない |
| `orphanCycleCompleted` | 末尾pageへ到達し、次回は先頭に戻るか | 長期間`true`にならない |

ジョブ自体が例外で落ちた場合は `{"level":"error","job":"improvement_retention","name":"..."}` が出ます。
backupは先に確定し、他の5つを含む残り6 jobも独立に完走します。全jobの結果を記録してからCronは
`scheduled_maintenance_failed`で失敗し、内部message・利用者情報・金融内容・R2 keyはログへ出しません。

### 2.3 失敗が続くときの切り分け

1. `failed` が続く場合、まず D1 側で対象が残っているかを見ます。

   ```bash
   pnpm --filter @kanjo/api exec wrangler d1 execute kanjo-db --remote \
     --command "SELECT COUNT(*) FROM improvement_requests WHERE status='done' AND purged_at IS NULL AND done_at < datetime('now','-30 days')"
   ```

2. 件数が残っていれば R2 側の削除権限を疑います。`FILES` バインディングは `packages/api/wrangler.jsonc` にあります。
3. `orphans` が増え続ける場合は、投稿経路（R2 へ put → D1 へ insert）の途中で落ちています。`improvement_requests` への insert が失敗するログを探します。孤児は配置から5分が経過した後、夜間巡回がそのpageへ到達した際に自動で消えるため、手動削除は不要です。

本番 D1 への手動 `UPDATE` / `DELETE` は通常運用に含めません（`docs/ci-cd-operations.md` 10章と同じ扱い）。

### 2.4 関連ファイル

- `migrations/0029_improvement_requests.sql`
- `packages/api/src/routes/improvement.ts` — API と `runImprovementRetention`
- `packages/api/src/improvement/contract.ts` — テーブル定義・入出力スキーマ・指示文
- `packages/api/src/improvement/redact.ts` — サーバ側の再マスク
- `packages/core/src/improvement.ts` — マスク規則・上限・トークン方式の正本
- `packages/web/src/diagnostics-buffer.ts` — 常時記録のリングバッファ
- `packages/web/src/capture-screen.ts` — 撮影。SVG は `<img>` 経由で t=0 に静止するため、全アニメーションを無効化してから写す
- `packages/web/src/annotate-image.ts` — 書き込みの座標（比率保持）と送信直前の焼き込み
- `packages/web/src/components/ScreenshotAnnotator.tsx` — 画像の上に重ねる書き込み UI
- `packages/web/src/components/ImprovementRequestButton.tsx` — 撮影とモーダルの順序、右下の固定ボタン
