# Phase 05 — Mobile financial visualization implementation

- Task: `SYS-MOBFIN-P05`
- Result: **PASS**
- Final source/test digest: `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`
  - **過去の値 (消さずに残す)**: 第1世代 `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a`（算出方法・対象ファイル集合が記録されておらず、以降の値とは**比較できない**）／第2世代 `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e`（`source-digest.mjs` 導入後の実計算値。M03 実装で対象3ファイルが変わったため第3世代へ）。digest は working tree のスナップショットであり、対象15ファイルが変われば動くのが正常。値そのものを追うのではなく、`mobile-viewport-results.json` の `digestInputs` でその値が何を測ったかを見ること。詳細は `phase-11-reproducible-evidence.md` の Addendum。
- Scope: `packages/web` only; API, accounting calculation, auth, data, and deployment are unchanged.

## Implemented product behavior

1. Added the pure `financial-figure-model.ts` adapter. It receives the existing
   labels/series and derives formatted semantic rows without a second accounting
   calculation.
2. Added `FinancialFigure.tsx` with a visible heading, conclusion, period, unit,
   major-series list, positive-size responsive chart host, next action, and an
   accessible exact-value table inside progressive disclosure.
3. Connected Overview, Household, Subscriptions, Trends, Matrix, Statements, and
   available AI report figures to the shared primitive. Matrix and Statements use
   the primitive through `FinancialCharts.tsx`; their route logic and API types are
   unchanged.
4. Chart datasets and semantic rows are read from the same model. Canvas names are
   concise descriptions and do not repeat all currency values to screen readers.
5. Added 320 CSS px reflow, 44 px disclosure/actions, named keyboard-scrollable
   local tables, non-zero chart height, container adaptation, focus-visible,
   <=90 ms pressed response, safe-area/tab-bar clearance, and reduced motion.
6. High-cardinality subscription series are reduced to six labels plus a count in
   the first layer; every exact series remains available in the disclosed table.
7. Existing dense Matrix/Statements tables keep their established local scroll,
   sticky row header, and semantic caption behavior. Report grids now shrink below
   320 px instead of imposing a 320 px child minimum.

## Acceptance mapping

| Acceptance | Implementation / result |
|---|---|
| figure is not hidden or zero-size | fixed responsive host; Chrome all eight conditions PASS |
| relation and meaning survive mobile reduction | conclusion/period/unit/series/action remain outside disclosure; exact table remains in DOM |
| same accounting values | chart datasets and table cells are projected from one immutable figure model |
| 44 px, focus, safe area | measured disclosure/action 44 px; actual Tab focus and tab-bar clearance PASS |
| no document overflow | 320/360/375/390/768/1280/1600/200%-equivalent measured 0 px overflow |

## Verification

```text
pnpm --filter @kanjo/web exec vitest run --project unit \
  src/mobile-financial-visualization.dom.test.tsx \
  src/mobile-financial-layout.test.ts
=> 2 files, 6 tests PASS

node packages/web/scripts/check-mobile-financial-layout.mjs
=> 320, 360, 375, 390, 768, 1280, 1600, 200%-equivalent PASS
=> repeated twice consecutively after keyboard-focus hardening: PASS

pnpm --filter @kanjo/web exec vitest run --project unit \
  src/matrix-legend.dom.test.tsx src/matrix-visual.dom.test.tsx \
  src/statements-balance-sheet.dom.test.tsx
=> 3 files, 9 tests PASS

pnpm --filter @kanjo/web typecheck
=> exit 0

pnpm --filter @kanjo/web build
=> exit 0; 180 modules; initial JS 104.51 KiB / 110 KiB
```

The pre-existing Matrix/Statements DOM tests were updated only where their global
queries assumed a single row header or currency values embedded in the canvas
name. They now scope the existing detail table by its accessible name and assert
exact values in the semantic companion. No acceptance was weakened.

## P10 remediation implementation

The initial P10 review found that the visible six-plus-count list did not constrain
the datasets inside the subscription canvas. Production code now ranks named
vendors by absolute period total, passes the top six to Chart.js, and folds every
remaining vendor plus the unclassified `その他` values into one `他N件` dataset. The
FinancialFigure model and its exact table still contain every named vendor and the
unclassified series; accounting inputs and totals are not discarded.

The real-route inspector also found a 741 px priority table on the 375 px Trends
route. Adding the existing `stack-sm` behavior turns each priority row into a mobile
card while retaining every labeled cell. A later fail-first remediation aligned the
non-canvas subscription series list with the amount-ranked Chart.js summary while
retaining the complete exact table. The final production implementation was
independently accepted at source digest
`ab1e886cd0f38fb86adb879cfc25bbf26cddfc9db9d0258677a0141ffcf14db3`.

## Post-close-out mobile stability remediation

The parent localhost audit then found a loading-state layout shift in the global
header. A fail-first structure test was added before reserving the mobile period
(161 px) and defense-line (205 px) slots. The defense placeholder is
`aria-hidden`, so it contributes geometry without announcing fictitious values.
The warning color was strengthened to `#805a12`, and the inline `Term` control in
table headings now keeps a 44 px target.

The first full rerun exposed one further real regression at 375 px and 200% zoom:
the reserved header content made the one-column grid's automatic minimum 386 px.
The failure was retained, diagnostics were added to the existing layout inspector,
and production CSS was corrected with `minmax(0, 1fr)` plus shrink-safe 161/205 px
reservations. The exact rerun now measures `375/375` document width and an 88 px
target at 200%. No visible loaded-state value, API contract, accounting value, or
authentication behavior changed.
