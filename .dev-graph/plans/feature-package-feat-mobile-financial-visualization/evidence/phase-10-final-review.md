# Phase 10 — Independent final code, UX, and scope review

- Task: `SYS-MOBFIN-P10`
- Reviewer: `/root/mobile_implementation/mobile_design_review` (Nash)
- Independence: P05 producerとは別context。reviewerはsource/test/evidenceを編集していない。
- Reviewed digest: `208a78e8603d62822244411c0acbd49a59849250699ee13f1095d99fe2c1012a`
- Initial verdict: **FAIL**
- Findings: critical 0 / high 2 / medium 1 / low 0

## Read-only commands

| Command | Result |
|---|---|
| `git status --short` | PASS: feature implementation、先行workflow artifact、既存user/agent差分を区分 |
| `git diff --stat` | PASS: reviewed |
| `git diff --check` | PASS |
| privacy and scope scan | PASS: credential value 0、API/auth/accounting/data/infra/package/lock feature diff 0 |

## Changed-file mapping

| Files | Task responsibility |
|---|---|
| `FinancialFigure.tsx`, `financial-figure-model.ts` | P05 shared semantic/responsive contract; P08 common boundary |
| `FinancialCharts.tsx`, `ReportChart.tsx` | P05 Matrix/Statements/AI adapters; P08 compatibility |
| Overview, Household, Subscriptions, Trends pages | P05 route adapters |
| `styles.css` | P05/P07 reflow, focus, touch, safe-area, reduced-motion |
| four related existing DOM tests | P06 compatibility expectations for new semantic table/canvas names |
| `mobile-financial-visualization.dom.test.tsx`, `mobile-financial-layout.test.ts`, `check-mobile-financial-layout.mjs` | P04 test-first contract and P06/P07 gates |
| P01–P09 evidence | exact corresponding phase |

System-specification, dev-graph, architecture, feature, and task artifacts visible in
the worktree belong to the preceding canonical workflow. They were preserved and are
not implementation scope violations. Existing user/other-agent changes were not
reverted.

### Addendum (2026-08-31) — mapping gaps closed

The mapping table above left three changed files/hunks without a `scope_in` entry in
any of `sys-mobfin-p01`–`p13`. They are recorded here as **incidental changes outside
the declared scope_in**, not as newly claimed task scope. None of them touch the
`scope_out` boundaries (accounting calculation, API, auth, D1, R2, Cloudflare, native
mobile).

| Change | Nearest task | Classification | Why it is not in any `scope_in` |
|---|---|---|---|
| `packages/web/src/components/Layout.tsx` (+8/−4): `header-defense` / `header-defense-placeholder` CLS reservation | P07 (reflow / layout stability) | scope-out incidental — accepted | P07's `scope_in` lists page- and figure-level files; the header badge lives in the shell component, which no phase enumerated. The change reserves width for the defense-line badge so its late arrival does not shift the header. Presentation-only; no data or route behavior. |
| `packages/web/src/styles.css` `--warn: #a8781c → #805a12` | P07 (contrast) | scope-out incidental — **follow-up required** | `styles.css` *is* in P05/P07 `scope_in`, but the token change is a contrast fix, not part of the figure contract. It is not mirrored in `packages/web/src/charts.ts` (`COLORS.warn` and `VENDOR_PALETTE[2]` remain `#a8781c`), so CSS badges and Chart.js series now render two different warning colors on the same screen. Tracked as review finding F-01/A. |
| `packages/web/scripts/check-mobile-layout.mjs` (+39/−32, net +31 diagnostic output) | P06 (test gates) | scope-out incidental — accepted | The script predates this feature and belongs to an earlier layout feature. Only its failure-diagnostic output was widened; no assertion was added, removed, or weakened. P08's `scope_out` explicitly defers cleanup of other features' assets, so no phase could claim it. |

### Addendum (2026-08-31) — indirect coverage of `sys-mobfin-p05` scope_in

`sys-mobfin-p05.md` lists `packages/web/src/pages/analysis/Matrix.tsx` and
`packages/web/src/pages/Statements.tsx` in `scope_in`, but neither file appears in the
diff. This is **indirect coverage, not an unimplemented requirement**: both routes
consume the migrated shared chart components rather than constructing figures
themselves, so the migration reached them without editing them.

| File | Imports from `FinancialCharts.tsx` | Migrated via |
|---|---|---|
| `pages/analysis/Matrix.tsx` (`:7`) | `MatrixMoversChart` | the component was converted to `FinancialFigure` inside `FinancialCharts.tsx` |
| `pages/Statements.tsx` (`:16`) | `BalanceSheetChart`, `CashFlowCharts`, `ProfitAndLossCharts` | same |

Verified by the migration completeness checks already recorded in P08: all 13 `<Chart>`
call sites migrated, and 0 remaining `Figure` / `.chart-shell` occurrences.

Consequence for the scope model: P05's `scope_in` enumerates *routes whose output must
change* while the diff records *files that had to be edited*. When a shared component
absorbs the change, the two lists legitimately diverge. Future task specs should
distinguish "must be edited" from "must be verified" in `scope_in` rather than treating
an unchanged listed file as a gap.

With these two addenda, every changed file in the worktree maps to a task or to a named
classification, and the P10 acceptance item "changed file 全件の task mapping" holds.

## Findings

### HIGH H1 — real React/Chart.js route rendering is not gated — RESOLVED (2026-08-31)

`check-mobile-financial-layout.mjs` measures a deterministic static HTML figure with a
plain canvas. It proves CSS host geometry and semantic behavior, but not that React,
Chart.js, and route data produce a non-zero canvas. At the time this review was written
the real-route `check-financial-visuals.mjs` still waited for deleted `.chart-shell
canvas` nodes and read the old `figcaption strong` structure, and was not part of the
final P09 gate.

Impact: acceptance 1, 2, and 5 lack fail-closed real-chart evidence. Severity HIGH.

Required remediation: update the real-route inspector to the current DOM; connect it
to a serial Vitest render project; inspect real Chart.js canvases, seven elements,
overflow, and all required viewports/routes.

Status update (2026-08-31, verified against the worktree):

- The stale-selector half is resolved. `.chart-shell` has **0 occurrences** across
  `packages/web/` (scripts, `src/`, `styles.css`). `check-financial-visuals.mjs` now
  selects `[data-financial-figure] .financial-figure__chart canvas` (`:606`, `:637`,
  `:690`, `:702`) and reads headings via
  `.financial-figure__caption h2, h3, h4` (`:640`, `:699`) — the current
  `FinancialFigure` DOM. The `figcaption strong` structure is no longer referenced.
- The gating half is resolved. `packages/web/src/mobile-financial-visualization-render.test.ts`
  invokes the fixture script (`:10`) and the real-route script (`:12`) against a live
  Vite origin under `KANJO_VISUAL_SCOPE=core` (`:89`) and `additional` (`:95`), so the
  real-route inspector now runs inside the test gate.
- Remaining open (tracked separately, not part of H1): the fixture script's DOM is
  still hand-written string literals rather than being generated from
  `FinancialFigure.tsx`, so the fixture-side assertions still verify attributes the
  fixture itself authors.

### HIGH H2 — subscription canvas legend remains unbounded

The external FinancialFigure series list limits visible items to six plus the
remaining count, but `Subscriptions.tsx` still creates one Chart.js dataset for every
vendor and leaves the internal Chart.js legend enabled. High-cardinality anonymous
input can therefore render twenty or more legend items inside the canvas.

Impact: P01's high-series cognitive-load risk and P05's claimed six-plus-count
behavior are not actually satisfied in the chart. Severity HIGH.

Required remediation: limit the narrow/high-cardinality Chart.js legend to the same
top six plus an `他N件` aggregation while keeping every exact vendor value in the semantic
table, and add a 20+ vendor real-render case.

### MEDIUM M1 — browser inspection runs in the parallel unit project

`mobile-financial-layout.test.ts` does not match the repository's `*-render.test.ts`
serial render-project convention. Nested Chrome can contend with unit workers; the
recorded runner timeout/hang history is consistent with this structural issue.

Required remediation: keep static contract tests in the unit file and move real
browser execution to a `*-render.test.ts` gate.

## Acceptance verdict at initial review

| Feature acceptance | Verdict |
|---|---|
| relationships and changes remain visible on mobile | FAIL until H1 is closed |
| low-load hierarchy and high-series reduction | FAIL until H2 is closed |
| exact semantic values from the same model | PASS |
| 320–390, focus, touch, safe-area, zoom | PASS for shell; real chart pending H1 |
| 768/1280/1600 compatibility | FAIL until H1 is closed |

P11 entry gate: **CLOSED**. Remediation returns to P05/P06; no later phase may treat
this initial verdict as PASS. A second independent review must append its final
verdict without deleting this history.

## Second independent review — FAIL retained

- Reviewed digest: `791830ee445f92b546a864e03c581284e3fa8bb2686afaac0f71164b82298983`
- Reviewer: `/root/mobile_implementation/mobile_design_review` (Nash)
- Verdict: **FAIL**
- Findings: critical 0 / high 1 / medium 1 / low 0

The initial stale-selector, unbounded-dataset, parallel-runner, and Trends-overflow
findings were closed. Two new fail-closed findings remained:

1. HIGH R1: the subscription canvas used amount-ranked top six plus `他N件`, while
   the non-canvas series list used exact-model insertion order. A user unable to
   inspect the canvas therefore received a different legend.
2. MEDIUM R2: the five additional routes had actual React/Chart.js evidence only at
   375/1280, while feature acceptance required route-specific 360/375/390 mobile
   evidence.

P11 remained CLOSED. RED 3 and the subsequent remediation are retained in the
separate remediation evidence and source history.

## Final independent review — PASS

- Reviewed digest: `ab1e886cd0f38fb86adb879cfc25bbf26cddfc9db9d0258677a0141ffcf14db3`
- Reviewer: `/root/mobile_implementation/mobile_design_review` (Nash)
- Independence: P05 producerとは別context; read-only review; source/test/evidence/trackerを未変更
- Final verdict: **PASS**
- Findings: critical 0 / high 0 / medium 0 / low 0
- Acceptance: 5/5 PASS
- P11 entry gate: **OPEN**

### Closure evidence

- `chartSeries` is the single input for both the subscription model's
  `summarySeries` and the Chart.js datasets/labels/count. The real-route gate requires
  exact label equality and at most seven datasets.
- The exact model/table remains separate within the same immutable figure model and
  retains all 20 named vendors plus `その他` (21 exact series).
- Overview, Trends, Subscriptions, Household, and AI report routes render actual
  React/Chart.js figures at 360/375/390/1280 with all seven meaning elements,
  positive CSS and bitmap canvas dimensions, and document overflow <= 1 px.
- Matrix/Statements retain 320/360/375/390/768/1280/1600 and 200% zoom evidence.
- Unit 300, new render 1, existing render 2, lint, typecheck, build, and the 104.51
  KiB / 110 KiB initial-JS budget passed at the reviewed digest.
- `git diff --check` and privacy/scope scan passed; API, auth, accounting,
  persistence, data, infrastructure, dependency, and lockfile feature diffs are 0.

The initial and second FAIL verdicts have not been overwritten. This final PASS is
the only verdict that opens P11, after all recorded high/medium findings were closed.

## Post-close-out independent re-review — PASS

- Reviewed digest: `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`
  - **過去の値 (消さずに残す)**: 第1世代 `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a`（算出方法・対象ファイル集合が記録されておらず、以降の値とは**比較できない**）／第2世代 `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e`（`source-digest.mjs` 導入後の実計算値。M03 実装で対象3ファイルが変わったため第3世代へ）。digest は working tree のスナップショットであり、対象15ファイルが変われば動くのが正常。値そのものを追うのではなく、`mobile-viewport-results.json` の `digestInputs` でその値が何を測ったかを見ること。詳細は `phase-11-reproducible-evidence.md` の Addendum。
- Reviewer: `/root/mobile_implementation/mobile_design_review` (Nash)
- Independence: read-only; source, test, evidence, and tracker were not modified
- Verdict: **PASS**
- Findings: critical 0 / high 0 / medium 0 / low 0
- Acceptance: 5/5 PASS

The reviewer independently reran the loading-header structure contract (3/3 PASS)
and the existing mobile layout inspector at 375, 360, and 375 px with 200% zoom.
The zoomed document measured 375/375 px and its minimum target measured 88 px. The
new `#805a12` warning color measured 6.20:1 against white and 5.61:1 against the
warning background.

The review confirmed that the `aria-hidden` placeholder reserves the 161/205 px
loading geometry without announcing a fake value, `minmax(0, 1fr)` preserves 200%
reflow, and the seven meaning elements, non-zero chart geometry, eight viewport
matrix, exact tables, CLS 0.00, LCP 1.217 s, and Lighthouse mobile Accessibility /
Best Practices 100 remain consistent. API, auth, accounting, data, infrastructure,
package, and lockfile feature changes remain zero; privacy and rollback evidence is
consistent.

Remaining constraints are not defects: Safari/iOS real-device acceptance is a
documented manual handoff, the performance numbers are throttled localhost rather
than production Core Web Vitals, and commit/PR merge, Beads reconciliation, and
deploy remain outside this explicitly non-mutating task.
