# 総収支画面 テスト実行記録 (SYS-TCSCREEN-P06)

`pnpm test` → `pnpm typecheck` → `pnpm lint` を通した実測。
**緑になった値だけでなく、最初に赤で出たものも残す。**
後から「最初から通っていた」と読めてしまうと、何を直したのかが分からなくなるため。

## 1 回目

| ゲート | 結果 |
|---|---|
| `pnpm test` | **緑** |
| `pnpm typecheck` | **緑** (exit 0) |
| `pnpm lint` | **赤** (exit 1、biome 6 件) |

### `pnpm test` の内訳

| package | Test Files | Tests | 所要 |
|---|---|---|---|
| `@kanjo/core` | 43 passed / 1 skipped | 630 passed / 6 skipped | 1.45s |
| `@kanjo/api` | 44 passed | 570 passed | 489.14s |
| `@kanjo/web` | 78 passed | 597 passed | 113.48s |

`test:aux` / `runbooks:test` / `guard-real-data:test` / `github-scripts:test` /
`seed-admin:test` / `skills:test` / `delivery:test` も同じ run で緑。

### `pnpm lint` の赤 6 件

いずれも本 branch が足した差分。

| 種別 | 件数 | 対象 |
|---|---|---|
| format | 3 | `scripts/seed-local.mjs`、`packages/api/src/import-lifecycle.ts`、`packages/web/scripts/check-mobile-layout.mjs` |
| `lint/performance/noDelete` | 3 | `packages/api/test/total-cashflow-backup.integration.test.ts:233-235` |

#### `noDelete` の直し方

biome の unsafe fix は `legacyBackup.duplicateVerdicts = undefined;` を提案するが、
**これは採らなかった**。このテストが確かめているのは
「3 key を*持たない*旧バックアップを復元しても判断が消えない」ことで、
`undefined` を代入すると key 自体は残る。契約が変わってしまう。

分割代入の rest で key ごと落とす形へ書き換えた。

```ts
const {
  duplicateVerdicts: _dv,
  freeeDealExclusions: _fe,
  totalCashflowOperations: _op,
  ...legacyBackup
} = payload;
```

format の 3 件は `biome check --write` で機械的に整形した。

## 2 回目 (修正後)

| ゲート | 結果 |
|---|---|
| `pnpm lint` | 緑 |
| `total-cashflow-verdict` / `-operations` / `-backup` の 3 本 | 緑 |

`pnpm lint` は `biome check` に加えて
`sync-project-skills --check` / `check-glossary` / `check-report-css` /
`check-graph-lineage` / `check-design-tokens` /
`check-design-system-document-contract` / `check-design-system-delivery --worktree-content` /
`check-design-system-run-references` / `security:content` を直列に通す。

`security:content` (= `scripts/hooks/guard-real-data.sh --scan-public-docs`) が緑なので、
再生成した `samples/*.csv` に実データが混じっていないことも同じ run で確認できている。

## 単体で取り直すとき

```bash
pnpm test
pnpm typecheck
pnpm lint

npx vitest run --root packages/api test/total-cashflow-verdict.integration.test.ts
npx vitest run --root packages/api test/total-cashflow-operations.integration.test.ts
npx vitest run --root packages/api test/total-cashflow-backup.integration.test.ts
npx vitest run --root packages/core test/total-cashflow-screen-rules.test.ts
```

## 注意

`pnpm typecheck` は api で `wrangler types` を先に走らせてから `tsc --noEmit` する。
`worker-configuration.d.ts` が無い状態で `tsc` だけを叩くと、
本 branch と無関係な型エラーが大量に出る。

`@kanjo/api` のテストは Miniflare を都度起動するため 8 分ほどかかる。
待てないときは上の単体コマンドで対象だけ取る。
