# Phase 10 remediation — test-first RED evidence

- Task: `SYS-MOBFIN-P10` remediation returning to P04/P05
- Source state: production implementation from reviewed digest
  `208a78e8603d62822244411c0acbd49a59849250699ee13f1095d99fe2c1012a`
- Verdict: **RED confirmed** before production remediation

## RED 1 — high-cardinality Chart.js datasets

Command:

```sh
pnpm --filter @kanjo/web exec vitest run src/mobile-financial-visualization.dom.test.tsx
```

Result: **expected FAIL** (1 file, 4 tests: 3 pass / 1 fail; exit 1).

The new 20-vendor contract expected the actual Chart.js datasets to be
`support20|support19|support18|support17|support16|support15|他14件` (fixture labels are
the corresponding Japanese `支払先NN` values). The production chart instead returned all
20 named vendors plus `その他`. This reproduces review finding H2 while the same test also
asserts that the exact semantic table retains `支払先01（円）` through `支払先20（円）`.

## RED 2 — stale real-route visual inspector

Command used for the deliberate first failure:

```sh
pnpm --filter @kanjo/web exec vitest run src/mobile-financial-visualization-render.test.ts
```

Result: **expected FAIL** (render test 1 fail; exit 1). The static mobile shell passed
and printed a 375px Matrix geometry sample, but the existing real-route inspector
timed out waiting for the removed `.chart-shell canvas` structure on Statements.
The application body and financial values were present, demonstrating that the
failure is the stale selector/gate, not an unavailable Vite route.

The deliberate RED invocation also proved the reason for moving the browser test:
an exact path alone overrode the unit-project exclude and started unit workers. All
GREEN reruns must therefore use the explicit serial project form:

```sh
pnpm --filter @kanjo/web exec vitest run --project render \
  src/mobile-financial-visualization-render.test.ts
```

The failed run exited normally after reporting the assertion; its owned Vite/Chrome
children were gone. No unrelated/shared process was terminated.

## Production gate

No production file was changed before both failures above were observed. P05 may now
implement H1/H2, after which P06/P09 must rerun the focused contracts, serial browser
gate, full test suite, lint, typecheck, build, and both browser inspectors at one
recorded source digest.

## RED 3 — canvas and non-canvas series disagree

The second independent review found that the remediated Chart.js canvas showed
`支払先20` through `支払先15` plus `他14件`, while the visible and assistive-technology
series list still showed exact-model insertion order `支払先01` through `支払先06` plus
`他15系列`.

Before changing production, the existing 20-vendor test was extended to require the
non-canvas `図の系列` list to equal the actual canvas dataset labels. Command:

```sh
pnpm --filter @kanjo/web exec vitest run --project unit \
  src/mobile-financial-visualization.dom.test.tsx
```

Result: **expected FAIL** (4 tests: 3 pass / 1 fail; exit 1). Expected
`支払先20…19,…18,…17,…16,…15,他14件`; received `支払先01…02,…03,…04,…05,…06,他15系列`
(abbreviated here only for readability). The exact-table assertions continued to
require vendor 01 and vendor 20. This RED closes the possibility of fixing the
canvas legend while leaving the non-canvas interpretation contradictory.
