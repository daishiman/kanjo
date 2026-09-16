# 照合画面 全テスト・型検査・lint の実行記録 (SYS-RECON-P06)

P05 の実装と P10 の是正を反映した作業ツリーで、リポジトリ全体の検査を実行した記録です。
実行は 2026-09-15、ローカル (macOS / Node 22 / pnpm) で行いました。時刻は `date -u` の実測です。

## 1. リポジトリ全体コマンド

| コマンド | 実行時刻 (UTC) | 結果 |
|---|---|---|
| `pnpm test` | 14:39:11Z 〜 14:48:49Z | exit 0 |
| `pnpm typecheck` | `pnpm test` の前 | exit 0 (core / api / web) |
| `pnpm lint` | `pnpm test` の前 (文書追加後に再実行、§5) | exit 0 (`biome check`・`check-glossary`・`check-graph-lineage`・`check-design-tokens`・`security:content` を含む) |

## 2. パッケージ別の内訳 (`pnpm test` の出力)

| 対象 | 照合で追加・変更したテスト | 結果 |
|---|---|---|
| core | `test/reconciliation.test.ts` (30 件)、`src/analysis-hub.test.ts`、`test/overview-close-status.test.ts` | 43 files passed / 1 skipped、636 pass / 6 skipped / 0 fail |
| api | `test/reconciliation.integration.test.ts` (20 件)、`src/deletion-schema.test.ts` (0041 の期待値) | 43 files、576 pass / 0 fail |
| web | `src/reconciliation.dom.test.tsx` (21 件)、`src/analysis-mutation-invalidation.dom.test.tsx`、`src/route-icon-distinct.test.tsx`、`src/common-shell.dom.test.tsx` ほか | 78 files、611 pass / 0 fail |
| test:aux | runbooks / guard-real-data / github-scripts / seed-admin / skills / delivery | runbooks PASS、guard-real-data passed、github-scripts 42 / 42、seed-admin 4 / 4、skills OK、delivery 43 / 43 |

## 3. web の check 系 (14:49:20Z 〜 14:50:54Z)

| コマンド | 結果 |
|---|---|
| `pnpm --filter @kanjo/web run build:bundle` | exit 0 |
| `pnpm --filter @kanjo/web run check:js-budget` (build:bundle の直後) | exit 0、109.33 KiB / 110 KiB |
| `pnpm --filter @kanjo/web run check:mobile-layout` | exit 0、すべて合格 |
| `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 pnpm --filter @kanjo/web run check:financial-routes` | exit 0、Reconciliation (`/analysis/reconciliation`) を含めすべて合格 |
| `pnpm --filter @kanjo/web run build:artifact` | exit 0 |
| `pnpm run github-scripts:test` | 42 / 42 pass |

`check:js-budget` は `build:bundle` の直後に実行しました。`build:artifact` は manifest を取り除くため、その後では予算を測れません。
描画検査で起動した 4175 の vite は、検査後に停止しました。

## 4. 実行中に見つけて直したもの

| 事象 | 原因 | 対応 |
|---|---|---|
| api の tsc エラー (`routes/reconciliation.ts` の取り消し) | zod の `default([])` で出力型が optional になり、`ActionOutcome` に代入できなかった | `parseStored<S extends z.ZodTypeAny>(schema: S, json): z.output<S> \| null` にし、スキーマの出力型をそのまま返す |
| api 統合テスト「最新でない操作は 409…」が失敗 | 是正で候補の無い `same` が `no_candidate` になり、最初の操作が保存されなくなった | 最初の操作を `exclude-mf` に替えた (テストの意図「最新でない操作は取り消せない」は変えない) |
| api 統合テスト「他人の操作 id と存在しない id は 404」が失敗 | 是正で UUID 以外の id を照会前に 400 にした | 他人の id と存在しない id を UUID にして 404、`nope` は 400 `invalid_action_id` を期待する |
| `pnpm lint` が 5 ファイルで失敗 | biome の format と organizeImports | その 5 ファイルだけに `pnpm exec biome check --write` を掛け、再実行で exit 0 |

## 5. 文書追加後の lint 再実行

`docs/reconciliation/` に P06・P07・P09・P10・P11・P13 の文書を追加した後、`pnpm lint` を再実行しました。結果は [`evidence.md`](evidence.md) §3 に記録します。

最終状態での通し再実行 (文書追加と P10 の検算で戻したファイルの一致確認の後):

| コマンド | 実行時刻 (UTC) | 結果 |
|---|---|---|
| `pnpm typecheck` → `pnpm test` | 15:05:19Z 〜 15:15:45Z | どちらも exit 0。core 636 pass / 6 skipped、api 576 pass、web 611 pass、test:aux すべて pass |
| `build:bundle` → `check:js-budget` → `build:artifact` → `github-scripts:test` | 15:16:01Z 〜 15:16:29Z | すべて exit 0。109.33 KiB / 110 KiB、42 / 42 |

## 6. 利用者の指摘による訂正後の再実行 (2026-09-16)

指摘「複数選択した取引を照合できない」「MF にあって freee に無い支出は何もしなくてよいはずなのに対応を求められる」を受け、状態に MFのみを足し、組めない「同じ」を API で保存前に止めた後の実行です。

| コマンド | 実行時刻 (UTC) | 結果 |
|---|---|---|
| `pnpm typecheck` / `pnpm lint` | `pnpm test` の前 | どちらも exit 0 (lint は整形 3 ファイルを `biome check --write` で直した後) |
| `pnpm test` | 22:08:47Z 〜 22:18:04Z | exit 0。core 640 pass / 6 skipped、api 577 pass、web 614 pass、test:aux すべて pass |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` (MFのみの一括除外を足した後) | 上記の後 | いずれも exit 0。core 641 pass / 6 skipped、api 577 pass、web 615 pass |
| `pnpm typecheck` → `pnpm lint` → `pnpm test` (仕様反映の受領書を書く前の最終通し) | 2026-09-16 13:13:22Z 〜 13:24:05Z | すべて exit 0。core 645 pass / 6 skipped、api 582 pass、web 626 pass、test:aux すべて pass |
| `build:bundle` → `check:js-budget` → `build:artifact` → `github-scripts:test` | `pnpm test` の後 | すべて exit 0。109.33 KiB / 110 KiB、42 / 42 |
| `check:mobile-layout`、4175 の vite で `check:financial-routes` | 同上 | どちらも exit 0 |

匿名化済みの `samples/` / ローカル seed で確認: MFのみの複数行を `exclude-mf` へ送ると対象だけが除外になり、KPI の事業支出額は不変、取り消しで fixture の操作前状態へ戻りました。公開文書には fixture の金額・総件数を複製しません。

変異による検算: API の試算を無効化すると「判定器で組めない「同じ」は保存せず理由を返す」だけが、画面の重複除外を外すと「一括照合は同じ freee の候補を指す 2 件目を送らない」だけが失敗し、元に戻して通ることを確かめました。

## 7. 結論

`pnpm test`・`pnpm typecheck`・`pnpm lint` と packages/web の check 系はすべて exit 0 です。既知の失敗はありません。
