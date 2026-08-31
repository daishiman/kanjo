# Phase 04 — Test-first RED evidence

- Task: `SYS-MOBFIN-P04`
- Captured: 2026-08-30 JST
- Gate result: **PASS (RED proven before production implementation)**
- Production files changed before this capture: **none**

## Tests and executable inspection added first

- `packages/web/src/mobile-financial-visualization.dom.test.tsx`
  - requires the shared financial-figure contract;
  - requires the seven semantic elements independent of the canvas;
  - requires the exact-value semantic table to be derived from the same mover model;
  - requires progressive disclosure without removing summary/series meaning.
- `packages/web/src/mobile-financial-layout.test.ts`
  - requires every in-scope surface to connect to `FinancialFigure`;
  - statically pins 320 CSS px reflow, positive chart height, 44 px controls,
    `focus-visible`, `:active`, safe area, and reduced motion;
  - invokes a real headless-Chrome layout inspection.
- `packages/web/scripts/check-mobile-financial-layout.mjs`
  - covers 320 / 360 / 375 / 390 / 768 / 1280 / 1600 CSS px and a 320 px
    200%-reflow equivalent;
  - measures document overflow, non-zero chart geometry, local table overflow,
    tap targets, tab-bar obstruction, focus indication, and semantic meaning.

## Deterministic focused RED command

```text
pnpm --filter @kanjo/web exec vitest run --project unit \
  src/mobile-financial-visualization.dom.test.tsx \
  src/mobile-financial-layout.test.ts
```

Result: exit 1, 2 failed files, 6 failed tests.

Expected contract failures observed:

1. Matrix output did not expose `[data-financial-figure]` (three DOM assertions).
2. `FinancialFigure.tsx` and `financial-figure-model.ts` did not exist.
3. In-scope routes were not connected to the common figure primitive.
4. The CSS contract for container queries, fixed chart host height, disclosure
   target, safe area, focus, pressed response, and reduced motion was absent.
5. At 320 CSS px Chrome measured 456 px of document-level overflow.
6. The disclosure target measured 25.6 px high, the final action 38 px high,
   and the focused action had `outline-style: none`.

Representative Chrome failure:

```text
Error: 320-reflow: document overflow:
{"viewport":320,"overflow":456,"chart":{"width":640,"height":240},
 "summary":{"height":25.59375},"action":{"height":38},
 "focusOutline":"none"}
```

This is a feature-contract RED, not a fixture/data error. The fixture is fully
anonymous and contains only synthetic 2026 monthly values.

## Requested aggregate command and runner cleanup

The task-specified command was also started verbatim:

```text
pnpm --filter @kanjo/web test -- \
  mobile-financial-visualization.dom.test.tsx \
  mobile-financial-layout.test.ts
```

The package `test` script composes the whole unit project and render scripts, so
the extra arguments did not isolate the two new files. It reproduced the new DOM
contract failure, and the new Chrome child completed, but Vitest worker processes
remained alive for more than two minutes after the contract failure. This runner
hang is recorded separately from the valid RED result. Only the process tree
started by this command was terminated (`pnpm` PID 16846 and its remaining orphan
Vitest worker PID 18388); pre-existing preview/dev processes were not touched.

The focused command above is the reproducible RED gate. Subsequent GREEN runs use
focused Vitest first, then the complete package test command with an explicit
outer timeout and process-cleanup verification.

## Gate decision

The tests fail for the intended missing product behavior, before any P05 source
implementation. P04 therefore satisfies the test-first gate and P05 may begin.
