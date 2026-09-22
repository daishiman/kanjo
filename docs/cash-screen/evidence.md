# 現金入力画面の受入証跡

現金入力画面(`/cash`、feature `feat-cash-screen`)の受入 S1〜S5 を判定した証跡の索引。受入の分け方は [`design-decisions.md`](design-decisions.md) §1、規則は [`rules.md`](rules.md) にある。

受入は、ここに載せた実行済みの最新の記録だけで判定する(S5-e)。コードを変えたら、該当する行のコマンドを流し直し、日時と結果を書き換える。

## 実行した状態

- コミット: `f0e5a3b`(`origin/main` と同じ)に、この feature の未コミットの作業ツリーを重ねた状態。
- 日付: 2026-09-22(JST)。各行の時刻は品質ゲートの記録(開始と終了)から写した。
- 画面の実描画検査(`check:*`)は、この worktree の vite を `pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4195` で起動し、`KANJO_VISUAL_BASE_URL=http://127.0.0.1:4195` を付けて流した。既定の 4175 番は別の worktree が使っていたため。`/api/*` の多くは検査スクリプトが CDP で固定の fixture に差し替えるが、fixture に無い経路は vite の proxy を通って `http://localhost:8787` へ届く。このため、この worktree の API(`wrangler dev --port 8787`)を起動した状態で流した。
- vite は `--force` を付けて起動した。起動の後で新しい依存(`chart.js`)が見つかると、vite は依存の事前バンドルを作り直す。そのあいだ古い版を指す読み込みが 504 になり、遅延読み込みの画面(`check:financial-routes`・`check:ai-screen`・`check:analysis-hub`)が描画待ちのタイムアウトで落ちた。`--force` で作り直した後は 3 本とも合格した。

- `pnpm test` の web で 2 件が打ち切られた(`mobile-financial-visualization-render.test.ts` と `thead-render.test.ts`。どちらも現金入力画面を描画しない)。このため、後ろにつながる `test:aux` が流れなかった。2 件は単独で流し直し、`test:aux` も単独で流した。どちらも合格した(下の「品質ゲート」)。

## 受入の判定

すべての行のコミットは `f0e5a3b` に作業ツリーを重ねた状態、日付は 2026-09-22 である。テストの行は、そのテストを含む `pnpm test` の実行を指す。api と core は全ファイル合格。web で落ちたのは上の 2 ファイルだけで、この表のテストは含まない。

| # | 判定 | コマンド | 時刻 | 結果 |
|---|---|---|---|---|
| S1-a | PASS | `pnpm test`(web `pages/cash` の DOM テスト) | 18:13:27–18:48:18 | 見出し・期間・タブ、「追加」4 件、「空の月」、「削除と元に戻す」5 件が合格 |
| S1-a | PASS | `pnpm --filter @kanjo/web run check:cash-screen` | 18:11:51–18:12:11 | 5 幅と 200% 拡大の実描画で合格。続けて 2 回流し、どちらも合格 |
| S1-b | PASS | `pnpm test`(web DOM) | 18:13:27–18:48:18 | 「領収書欄の代わりに freee への案内を出す」が合格 |
| S1-c | PASS | `pnpm lint`(`check-design-tokens`・design-system 検査) | 18:12:29–18:12:44 | 合格。色の直書き 0 件 |
| S1-d | PASS | `pnpm test`(web DOM) | 18:13:27–18:48:18 | 「読込・空・失敗の状態」が合格 |
| S2-a | PASS | `pnpm test`(api `cash-screen.integration.test.ts`、web DOM) | 18:13:27–18:48:18 | 「DELETE は論理削除になり、restore で同じ id が戻る」「確認してから削除し、「元に戻す」で戻せる」が合格 |
| S2-b | PASS | `pnpm test`(同上) | 18:13:27–18:48:18 | 「bulk-delete した 3 件が bulk-restore で戻る」「一括削除して、まとめて元に戻せる」が合格 |
| S2-c | PASS | `pnpm test`(api 統合) | 18:13:27–18:48:18 | 「削除中の行を読まない条件」の経路別 6 件が合格。P04 の変異 M1〜M6 がそれぞれ落とされることも確かめた |
| S2-d | PASS | `pnpm test`(api `import-lifecycle.test.ts`) | 18:13:27–18:48:18 | 「削除中の現金明細だけが残る移行先へは…」が合格 |
| S2-e | PASS | `pnpm test`(api 統合) | 18:13:27–18:48:18 | 「夜間の完全消去」が合格。P04 の変異 M7(`<` を `<=` にする)が落とされることも確かめた |
| S2-f | PASS | `pnpm test`(web DOM) | 18:13:27–18:48:18 | 「入力の 500ms 後に利用者ごとに保存し、開き直すと戻る。クリアで消える」「編集中は下書きを保存しない」が合格 |
| S3-a | PASS | `pnpm test`(core `cash-screen.test.ts`) | 18:13:27–18:48:18 | core 63 ファイル・859 件が合格 |
| S3-b | PASS | `rg`(NFKC の正規化・往復の 2 倍・`reduce`・`slice` を `packages/web/src` と `packages/api/src` から探す) | 18:59:38–18:59:39 | `cash-screen.ts` の外に同じ計算は 0 件。見つかったのは次の 3 種で、どれも同じ計算ではない。別の画面の選択肢の照合(`target-query.ts`)、削除する金額の総和(`DeleteConfirm.tsx`、design-decisions §7 P08)、月の切り出し(`slice(0, 7)`)と金額欄の桁数(`AMOUNT_DIGITS`) |
| S3-c | PASS | `pnpm test`(api 統合)と `pnpm typecheck` | 18:12:44–18:48:18 | zod が `CASH_LIMITS` を読み、「不正な入力は 400」が合格 |
| S4-a | PASS | `pnpm test`(api 統合) | 18:13:27–18:48:18 | 「他の利用者の明細」の 6 経路が合格 |
| S4-b | PASS | `pnpm test`(api 統合) | 18:13:27–18:48:18 | bulk-delete と bulk-restore に他人の id を 1 件混ぜる 2 件が合格 |
| S4-c | PASS | `pnpm test`(api 統合、core) | 18:13:27–18:48:18 | 「不正な入力は 400」と、core「allowUnset(API の互換)は…」が合格。後者は、担当者と業務の目的を API で任意にしても値の検査は画面と同じであることを確かめる |
| S4-d | PASS | `pnpm test`(api 統合) | 18:13:27–18:48:18 | 「PUT: 削除中の行は編集できず 404 で、編集で復活もしない」が合格 |
| S5-a | PASS | `pnpm test`(api `cash-migration-0051.test.ts`) | 18:13:27–18:48:18 | 既存行の更新 0 件で合格 |
| S5-b | PASS | `pnpm test`(api `scheduled-maintenance-budget.test.ts`) | 18:13:27–18:48:18 | `total === PLAN_MAX (49)` で合格 |
| S5-c | PASS | `verify:full` の各段、`pnpm skills:test`、`build:bundle` の直後の `check:js-budget` | 17:50:38–18:58:40 | 全段が合格(下の「品質ゲート」)。打ち切られた 2 件は単独で合格 |
| S5-d | PASS | `pnpm test`(web `cash-duplicate.dom.test.tsx`・`cash-transit-regression.test.ts`・DOM) | 18:13:27–18:48:18 | 重複の確認、交通費の入替と往復、編集の保存が合格 |
| S5-e | PASS | この表 | — | すべての行に実行したコマンドと時刻がある。製品コードの最後の変更は 17:47:57(担当者の互換の修正。`cash-screen.ts`・`routes/cash.ts` とそのテスト)で、この表の実行はすべてその後。その後の変更は 18:11:23 の検査スクリプト `check-financial-visuals.mjs`(fixture の追加)だけで、それが影響する `check:cash-screen` は変更の後に流し直した |

S1〜S5 のすべての項目が PASS で、一部だけ満たした項目は無い。

## 品質ゲート

各段の終了コードとログの本文を両方見て判定した。時刻の詳細と打ち切りの扱いは [`design-decisions.md`](design-decisions.md) §7 P06 にある。

| コマンド | 時刻 | 結果 |
|---|---|---|
| `pnpm lint` | 18:12:29–18:12:44 | 合格 |
| `pnpm typecheck` | 18:12:44–18:13:26 | 合格 |
| `pnpm skills:test` | 18:13:26–18:13:27 | 合格 |
| `pnpm test` | 18:13:27–18:48:18 | api 1,012 件合格・6 件 skip(61 ファイル中 60 合格・1 skip)、core 859 件合格(63 ファイル)、web 912 件合格・2 件打ち切り(85 ファイル) |
| `vitest run src/mobile-financial-visualization-render.test.ts src/thead-render.test.ts`(web) | 18:53:16–18:56:50 | 2 件合格 |
| `pnpm run test:aux` | 18:58:32–18:58:40 | 合格 |
| `pnpm build` | 18:48:18–18:49:26 | 合格 |
| `pnpm --filter @kanjo/web build:bundle` → `check:js-budget` | 18:49:26–18:50:23 | 合格 |
| `check:thead` / `check:financial-figure` | 18:50:23–18:51:54 | 合格 |
| `check:mobile-layout` / `check:financial-routes` / `check:ai-screen` / `check:analysis-hub` | 17:50:38–18:07:16 | 合格 |
| `check:cash-screen` | 18:11:51–18:12:11 | 合格(1 回目の不合格と原因は design-decisions §8) |
| `pnpm run preview:smoke` | 18:07:57–18:09:33 | 合格 |

## main との merge 後の再検証(P13)

`main`(0ed2d8c、予算画面 #67 を含む)を merge した後に、衝突を解いた箇所へ当たる検査だけを流し直した(MVP のため最小限)。

| 見つけたこと | 直し方 | 流し直した検査 |
|---|---|---|
| migration 0050 を予算(`0050_budget_plans.sql`)が先に使っていた | 現金を `0051_cash_entry_owner_soft_delete.sql` へ繰り上げた(design-decisions OI-01) | `cash-migration-0051.test.ts`・`budget-migration-0050.test.ts`・`deletion-schema.test.ts`・`schema-guard.test.ts` |
| 復元 snapshot の束縛数を予算と現金が別々に 20 にし、merge で衝突せず ? 21 個に 20 個を渡していた(取込と復元が 500) | 束縛数を SQL の `?` から数える形にした(design-decisions §5) | `import-lifecycle.test.ts`・`cash-screen.integration.test.ts` 106 件 |
| main の checkbox 契約(`type="checkbox"` は `SelectionCheckbox.tsx` だけ) | 往復・ページ全選択・行選択を `SelectionCheckbox` へ寄せた | `selection-checkbox-source-contract.test.ts` と `pages/cash`・`components` の 109 件 |

このほか `pnpm typecheck`・`pnpm lint`(graph-lineage 150 ノードを含む)・core 1,046 件・web の予算と Layout の 50 件・api 全件(65 ファイル・907 件)が合格した。

## phase ごとの記録の置き場所

| phase | 内容 | 置き場所 |
|---|---|---|
| P04 | テストが旧実装を落とすかの検算(変異 M1〜M7、キーボード操作) | design-decisions §7 P04 |
| P05 | 実装と、見落としていた `check:cash-screen` の追加 | design-decisions §8「P05 の見落とし」 |
| P06 | 品質ゲートの実行記録 | design-decisions §7 P06、この文書の「品質ゲート」 |
| P07 | 受入 S1〜S5 の判定 | この文書の「受入の判定」 |
| P08 | 計算の重複・削除中の行の読取漏れ・旧 `Cash.tsx` の直参照の監査 | design-decisions §7 P08 |
| P09 | キーボード操作・下書きの例外・幅ごとの崩れの保証 | design-decisions §7 P09 |
| P10 | 配信してよいかの判断、巻き戻しの前提、見つけた食い違いの修正 | design-decisions §8 |

## 取り直し方

1. `pnpm --filter @kanjo/api dev`(8787)と `pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4195 --force` を起動する。
2. `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4195` を付けて、上の表のコマンドを 1 本ずつ流す。
3. 各行の時刻と結果を書き換える。`pnpm test` が途中で落ちたら、落ちたファイルと `test:aux` を単独で流して記録する。
