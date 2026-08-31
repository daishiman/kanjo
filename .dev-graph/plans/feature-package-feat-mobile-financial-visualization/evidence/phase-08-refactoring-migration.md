# Phase 08 — Figure boundary and compatibility audit

- Task: `SYS-MOBFIN-P08`
- Result: **PASS**
- Final source/test digest: `a81b0e0f564e7c82e4bf6ac6f7506d35de32582647f42178e63ba56a837745df`
  - **過去の値 (消さずに残す)**: 第1世代 `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a`（算出方法・対象ファイル集合が記録されておらず、以降の値とは**比較できない**）／第2世代 `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e`（`source-digest.mjs` 導入後の実計算値。M03 実装で対象3ファイルが変わったため第3世代へ）／第3世代 `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`（M03 で3ファイルが変わった値。CI 赤 (#66) を受けた M04 で `mobile-financial-visualization.dom.test.tsx` の1ファイルが変わり第4世代へ）。digest は working tree のスナップショットであり、対象15ファイルが変われば動くのが正常。値そのものを追うのではなく、`mobile-viewport-results.json` の `digestInputs` でその値が何を測ったかを見ること。詳細は `phase-11-reproducible-evidence.md` の Addendum。

## Common boundary after refactoring

| Responsibility | Owner | Duplication decision |
|---|---|---|
| unit-aware formatting and semantic row projection | `financial-figure-model.ts` | one pure implementation |
| heading, conclusion, period, unit, series, responsive chart host, action, disclosure, and table | `FinancialFigure.tsx` | one shared component |
| P/L, CF, BS, and matrix accounting context | `FinancialCharts.tsx` | retained as route/domain adapters |
| imported AI chart labels and types | `ReportChart.tsx` | retained as a report adapter |
| Overview, Household, Subscriptions, Trends narrative | individual pages | retained because the conclusion and next action are different user decisions |

The former private `Figure` wrapper in `FinancialCharts.tsx` was removed. Chart and
table data now read the same model rows. No second formatter, table shell, or financial
figure disclosure remains in `FinancialCharts.tsx` or `ReportChart.tsx`.

## Deliberately retained differences

- Chart.js options and visual marks remain specific to bar, line, stacked, mixed,
  waterfall, Pareto, and balance-sheet comparisons.
- Route copy remains specific to its accounting decision; it was not generalized
  into vague generated text.
- Existing empty states and optional balance-sheet/report availability remain
  controlled by their routes.
- API response types are imported as types only. The shared model performs no API
  request and no accounting aggregation.

## Compatibility and migration

- Existing route URLs: unchanged.
- Existing API request/response contracts: unchanged.
- Accounting calculations and signs: unchanged; adapters project existing arrays.
- Desktop/tablet chart availability: unchanged, with an added semantic companion.
- Persistence/database schema: unchanged.
- Backfill or data migration: **N/A**, because this is a presentation-layer component
  boundary and introduces no persisted field.

No additional source refactor was applied in P08: the P05 implementation had already
converged on the intended minimal boundary, and further abstraction would have mixed
unrelated accounting contexts.

## Verification

| Command | Result |
|---|---|
| `pnpm --filter @kanjo/web test` | PASS: 54 files / 302 tests, 52.96 s, normal exit |
| `pnpm --filter @kanjo/web build` | PASS: 180 modules, initial JS 104.50 KiB / 110 KiB |
| `git diff --check` | PASS |

P07 acceptance remained unchanged before and after the audit: 8/8 viewport cases,
seven semantic elements, exact table, local overflow, focus, and 200% equivalent all
PASS.

> **訂正 (2026-08-31)** — ここで引いている P07 の「8/8 viewport cases」は実体 **3/3**
> (`320` / `375` / `reduced-motion`)、「focus」および「200% equivalent」は当時の根拠が無効だった
> (前者は実在しない要素への空振り判定、後者は 200% を再現していないケース)。
> 被覆自体は実ルート検証へ移っており低下していない。詳細は
> `phase-07-acceptance.md` の「Addendum (2026-08-31) — 証跡の訂正」。

P09 entry gate: **OPEN**.

## Post-close-out compatibility audit

The additional header work remains inside the existing `Layout`/CSS boundary. Its
placeholder is structural and hidden from the accessibility tree; it does not
create a second data source or a persisted value. The 200% repair uses grid and
flex sizing only. API, route, authentication, accounting, database, migration,
package, and lockfile contracts remain unchanged. The diagnostic fields added to
`check-mobile-layout.mjs` are emitted only when an invariant fails and do not alter
production behavior.
