# 概況画面 全テスト・型検査・lint の実行記録 (SYS-OVERVIEW-P06)

P05 の実装と P10 の是正を反映した作業ツリーで、リポジトリ全体の検査を実行した記録です。
実行は 2026-09-15、ローカル (macOS / Node 22 / pnpm) で行いました。

## 1. パッケージ別の結果

| コマンド | 対象 | 結果 |
|---|---|---|
| `pnpm --filter @kanjo/core test` | core 単体テスト (`test/overview-close-status.test.ts` を含む) | 588 pass / 6 skipped / 0 fail |
| `pnpm --filter @kanjo/api test` | API テスト (`src/overview.test.ts` を含む) | 40 files / 549 pass / 0 fail |
| `pnpm --filter @kanjo/web test` | DOM テスト (`src/overview-review-queue.dom.test.tsx`・`src/defense-forecast.dom.test.tsx` を含む) | 74 files / 550 pass / 0 fail |
| `pnpm typecheck` | core / api / web | exit 0 |
| `pnpm run github-scripts:test` | `.github/scripts/*.test.mjs` (`plan-auto-migration.test.mjs` を含む) | 42 / 42 pass |
| `pnpm --filter @kanjo/api exec vitest run src/index.test.ts` | CSP 差分検査 | pass |
| `pnpm exec biome check` (変更ファイル) | 概況で触れた TS/TSX/CSS | 指摘 0 |

## 2. リポジトリ全体コマンドの結果と既知の失敗

`pnpm test` と `pnpm lint` は、概況の変更とは無関係な既知の理由で exit 1 になります。
失敗箇所は下表のとおりで、どれも概況の差分を戻しても同じ結果です。

| コマンド | 失敗箇所 | 原因 | 概況との関係 |
|---|---|---|---|
| `pnpm test` (`test:aux`) | `scripts/check-design-tokens.test.mjs` の 1 件 | `system-spec/spec-state.json` の外部参照 digest 不一致 (design-system 基盤の仕様アーカイブ移動に伴う既存差分) | なし |
| `pnpm lint` | `check-design-tokens` (`&&` 連結のため後続は止まる。後続を個別に実行すると document-contract / delivery / run-references は pass、`security:content` だけが下の行で失敗) | 同上 | なし |
| `pnpm run security:content` | 公開ドキュメントの絶対パス検出 | 既存の `docs/design-system/evidence/*.stdout.txt` と、計画成果物 `.dev-graph/plans/...` の JSON | なし。概況で追加した文書 (`docs/overview-screen/`・`docs/overview-screen.md`・`docs/runbooks/overview-review-queue-mismatch.md`) は検出 0 |

## 3. 実行中に見つけて直したもの

| 事象 | 原因 | 対応 |
|---|---|---|
| `pnpm typecheck` の TS2339 (`c.get('actor')`) | `routes/analytics.ts` の Context 型が `{ userId }` だけを持っていた | Hono の Context は Variables について不変のため、データ読み出し helper を `DataCtx<V extends { userId: string }>` で総称化し、ルートは `AuthVariables` を持つ `Ctx` で受ける |
| `analytics-period.test.ts`「Dataset の読み込みは loadScoped の中の1箇所だけ」が失敗 (api 548/549) | 上の総称化で `loadScoped<V …>(` になり、テストの正規表現 `async function loadScoped\(` に合わなくなった | テストは変えず、`loadScoped` を総称でなく構造型 `ScopedContext` (`env`・`req`・`get('userId')` だけ) で受ける形に戻した。analytics と total-cashflow の Context がどちらもそのまま渡せる |
| 狭幅ドロワーで「後で確認」後にフォーカスが body へ落ちる | 開いた元の行が再取得で消える | `focusAfterSnooze` で「未処理の内訳」見出しへ移す (DOM テストで固定) |

## 4. 結論

概況に関わる core / api / web のテスト、型検査、変更ファイルの lint はすべて緑です。
リポジトリ全体コマンドの失敗は既存の 3 件に限られ、概況の変更によるリグレッションはありません。ただし原因の帰属にかかわらず、リポジトリ全体の緑を条件とする AC-007 は未達です。
この未達は、次の §5 で main を取り込んだ後の再実行により解消しました。

## 5. main 取り込み後の再実行 (2026-09-15)

支出分析ハブ (PR #50) を含む main を取り込み、衝突を解いた後に同じ検査をやり直した結果です。
衝突の解き方と仕様への影響の判断は [`spec-reflection-receipt.md`](spec-reflection-receipt.md) にあります。

| コマンド | 結果 |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm --filter @kanjo/core test` | 605 pass / 6 skipped / 0 fail |
| `pnpm --filter @kanjo/api test` | 41 files / 553 pass / 0 fail (単独実行。core・web と同時に走らせた回は `transit-lifecycle.test.ts` が 30 秒の hook timeout と接続切断で落ちたが、負荷による時間切れで、単独では 4 / 4 pass) |
| `pnpm --filter @kanjo/web test` | 78 files / 589 pass / 0 fail |
| `pnpm lint` | exit 0 (`check-design-tokens`・`check-graph-lineage` 61 ノード・`security:content` を含む) |
| `pnpm run test:aux` | exit 0 (`check-design-tokens.test.mjs` 5 / 5 pass) |
| `pnpm --filter @kanjo/web run build:bundle && pnpm --filter @kanjo/web run check:js-budget` | 109.29 KiB / 110 KiB |

§2 の既知の失敗 3 件は、main 側で design-system 基盤の仕様退避と digest が揃ったことで再現しなくなりました。
画面の実描画検査 `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 node scripts/check-financial-visuals.mjs` も取り込み後に再実行し、「財務画面の実描画検査: すべて合格」(exit 0) でした。検査幅は main 側の幅を足した和集合です。
