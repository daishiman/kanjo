# 照合画面 検証証跡 (SYS-RECON-P11)

受入基準 AC-001..AC-006 を第三者が同じ手順で再実行できるよう、コマンド・起動手順・匿名化済み fixture の検証結果をまとめた記録です。実口座・実仕訳・利用者固有の件数や金額は記録しません。
判定は [`acceptance.md`](acceptance.md)、全体の実行記録は [`test-run.md`](test-run.md)、品質観点は [`assurance.md`](assurance.md)、レビューは [`final-review.md`](final-review.md) にあります。

## 1. AC 別の再実行コマンド

すべてリポジトリ直下で実行します。

| AC | コマンド | 期待値 (実測) |
|---|---|---|
| AC-001 | `pnpm --filter @kanjo/web exec vitest run src/reconciliation.dom.test.tsx` | 25 pass |
| AC-001 | `node scripts/check-design-tokens.mjs` (`pnpm lint` に含む) | exit 0 |
| AC-002 | `pnpm --filter @kanjo/core exec vitest run test/reconciliation.test.ts test/overview-close-status.test.ts` | 62 pass |
| AC-002 / AC-003 | `pnpm --filter @kanjo/api exec vitest run test/reconciliation.integration.test.ts` | 21 pass |
| AC-004 | `pnpm --filter @kanjo/web test` | 78 files / 614 pass |
| AC-005 | `pnpm --filter @kanjo/web exec vitest run src/route-icon-distinct.test.tsx` | pass |
| AC-006 | `pnpm test` / `pnpm typecheck` / `pnpm lint` | いずれも exit 0 |
| AC-006 | `pnpm --filter @kanjo/web run build:bundle` → 直後に `pnpm --filter @kanjo/web run check:js-budget` | exit 0、109.33 KiB / 110 KiB |
| AC-006 | `pnpm --filter @kanjo/web run check:mobile-layout` | exit 0 |
| AC-006 | vite を 4175 で起動し `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 pnpm --filter @kanjo/web run check:financial-routes` | exit 0 (Reconciliation を 360〜1280px と rail-zoom200 で描画) |
| 配信前 | `pnpm --filter @kanjo/web run build:artifact` / `pnpm run github-scripts:test` / `pnpm test:aux` | exit 0 / 42 of 42 / すべて pass |

`check:js-budget` は必ず `build:bundle` の直後に実行します。`build:artifact` は manifest を取り除くため、その後では予算を測れません。

## 2. ローカルでの画面確認

### 起動

1. `pnpm run preview` を実行し、`http://localhost:8787` で待ち受けるまで待つ。中では `db:migrate:local` (0041 を含む) → web の build → `wrangler dev --local` が走る。
2. 別の端末で `node scripts/seed-admin.mjs` を実行し、ローカル管理者 `admin@kanjo.local` を作る。
3. 続けて `node scripts/seed-local.mjs` を実行し、架空の MF 明細と freee 仕訳 (2025-01〜2026-08) を取り込む。

### 匿名化済み seed の確認

`samples/` と `seed-local.mjs` が作る架空データだけを使います。期待値は固定の金額・総件数ではなく、次の不変条件で確認します。

- 5 状態が排他的で、`MFのみ` は `actionRequiredCount` に入らない。
- `actionRequiredCount = review + unprocessed` を一度だけ導出し、同じ投影scopeの利用箇所で一致する。
- 複数選択の一部が同じ freee 候補を指す場合、保存できる組だけが成功し、残りは `freee_already_matched` 等の理由を返す。
- MFのみを除外しても事業支出額は変わらず、取り消すと fixture の操作前状態へ戻る。

件数・金額の具体値は fixture の変更で変わり得るため公開証跡に複製せず、テストの期待値を正とします。

### 確認の流れ

| 手順 | 操作 | 期待する表示 | 対応 AC |
|---|---|---|---|
| 1 | ローカル preview にテスト用アカウントでログイン | 概況が開く | — |
| 2 | サイドバーの「分析」の子行「照合」を見る | バッジと月次クローズが期間非依存の同じ全期間 `actionRequiredCount` を使う | AC-002・AC-004 |
| 3 | 「照合」を開く (`/analysis/reconciliation`) | KPI・絞り込み・対応キュー・候補一覧・詳細パネル・下段プレビューが表示される | AC-001 |
| 4 | 「確認のみ」の「MFのみの支出」を押し、一覧の行を選ぶ | fixture の MFのみ行に絞られ、対応不要の説明と仕分け導線が出る | AC-001・AC-002 |
| 5 | 状態「照合済み」で絞り、照合済みの行を選んで「別の取引として処理」を押す | 行が照合済み (別の取引) のまま残り、下の「直前の操作」に記録が出る。ブラウザを再読込しても残る | AC-003 |
| 6 | 詳細パネル下部「直前の操作」の「元に戻す」を押す | 行が操作前の判断 (照合済み・同じ) に戻る | AC-003 |
| 7 | 一覧で MFのみの行を複数チェックし「選択した取引を照合から除外」を押す | 確認ダイアログに「総収支の金額は変わりません」と送る件数が出る。確定すると状態が「除外」になり、MFのみの件数が減る。KPI の事業支出は変わらない。「元に戻す」で戻せる | AC-002・AC-003 |
| 8 | (要確認・未処理の行があるデータで) 複数行をチェックし、どちらかの一括ボタンを押す | 確認ダイアログに送る件数と、送らずに残す件数 (照合済み・MFのみ・除外済み、freee の候補が無い、別の選択と同じ候補を指す) が出る。確定すると保存件数と件ごとの失敗理由が出る | AC-003 |
| 9 | 下段「MFにしかない明細」の説明とリンクを見る | 「総収支にはMFの金額で計上済みのため、照合の対応は要りません」と「明細仕分けで区分を確かめる」が出る | AC-002 |
| 10 | 分析ハブ・サイドバー・月次クローズを見る | 全期間の対応必要件数が `actionRequiredCount` と一致する | AC-002 |
| 11 | 画面幅を 1099px 以下、さらに 390px に縮める | 3 カラムが縦に並び、横スクロールが出ない | AC-006 |
| 12 | 共通ヘッダー・フッター・月次クローズの進捗を見る | アイコンと文言が画像どおり | AC-004・AC-005 |

`seed-local.mjs` を再実行すると `samples/*.csv` を CRLF で書き出し直すため、Git 上は内容が同じでも変更として表示されます。取込が済んだら `git show HEAD:<path> > <path>` で戻せます。

## 3. 文書追加後の lint 再実行

`docs/reconciliation/` に P06・P07・P09・P10・P11・P13 の文書を追加した後の再実行です。

| コマンド | 実行時刻 (UTC) | 結果 |
|---|---|---|
| `pnpm lint` | 2026-09-15 15:02:47Z 〜 15:02:50Z | exit 0。biome 417 files で修正なし、design-tokens の直書き 0 件、`security:content` の公開文書への機微データ混入チェック OK |
| `pnpm test:aux` | 15:02:50Z 〜 15:02:55Z | exit 0。guard-real-data passed、github-scripts 42 / 42、seed-admin 4 / 4、skills OK、delivery 43 / 43 |

## 4. 実測値のまとめ

| 項目 | 値 |
|---|---|
| core テスト | 645 pass / 6 skipped (照合と月次クローズ 61) |
| api テスト | 582 pass (照合統合 21) |
| web テスト | 626 pass (照合 DOM 25) |
| JS 予算 | 109.33 KiB / 110 KiB |
| 変異による検算 | M1..M10 のすべてで対応テストが失敗し、元へ戻した後に一致を確認 |
| D1 migration | `0041_reconciliation_tables.sql` (CREATE TABLE / INDEX IF NOT EXISTS のみ)、`EXPECTED_D1_MIGRATION` も 0041 |
