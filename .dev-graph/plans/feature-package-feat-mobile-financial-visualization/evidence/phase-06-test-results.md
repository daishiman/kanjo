# Phase 06 — Full regression results

- Task: `SYS-MOBFIN-P06`
- Result: **PASS**
- Final source/test digest: `a81b0e0f564e7c82e4bf6ac6f7506d35de32582647f42178e63ba56a837745df`
  - **過去の値 (消さずに残す)**: 第1世代 `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a`（算出方法・対象ファイル集合が記録されておらず、以降の値とは**比較できない**）／第2世代 `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e`（`source-digest.mjs` 導入後の実計算値。M03 実装で対象3ファイルが変わったため第3世代へ）／第3世代 `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`（M03 で3ファイルが変わった値。CI 赤 (#66) を受けた M04 で `mobile-financial-visualization.dom.test.tsx` の1ファイルが変わり第4世代へ）。digest は working tree のスナップショットであり、対象15ファイルが変われば動くのが正常。値そのものを追うのではなく、`mobile-viewport-results.json` の `digestInputs` でその値が何を測ったかを見ること。詳細は `phase-11-reproducible-evidence.md` の Addendum。
- Environment: macOS, Node `v22.21.1`, pnpm `10.9.0`
- Chrome: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  (`151.0.7922.174`)

## Final same-digest gates

| Command | Exit | Result |
|---|---:|---|
| `pnpm --filter @kanjo/web test` | 0 | 55 files / 304 tests PASS, including unit and all serial real-Chrome render projects; 272.30 s |
| `pnpm --filter @kanjo/web typecheck` | 0 | TypeScript errors 0 |
| `pnpm --filter @kanjo/web build` | 0 | 180 modules, Vite build PASS, initial JS 104.55 KiB / 110 KiB |
| focused P04 contract | 0 | 2 files / 6 tests PASS |
| Matrix/Statements related DOM | 0 | 3 files / 9 tests PASS |
| existing mobile-layout render | 0 | 1 file / 1 test PASS in 18.60 s, including 375 px at 200% zoom |
| actual-route financial render | 0 | 1 file / 1 test PASS in 225.10 s |
| sticky table-header render | 0 | 1 file / 1 test PASS in 10.91 s |

The full exact package command exited normally after every test and Chrome process
completed. The final result contains zero failures and zero skipped acceptance
checks.

## Earlier run separation (not the final gate)

An earlier aggregate run was not recorded as PASS:

1. The existing defense-forecast fixture returned its summary payload to the
   secondary `/unsettled` request. Once the richer Overview figure made the test
   await later rendering, the malformed secondary payload surfaced. The fixture
   now branches by endpoint and returns an anonymous empty unsettled response.
2. Existing text lookup matched both the new visible heading and semantic table
   caption. It now queries the heading role and exact accessible name.
3. Under simultaneous Chrome contention, the existing mobile-layout script printed
   all PASS measurements but its outer 110 s guard terminated cleanup. Running it
   alone passed in 19.78 s. The final full run also passed this render check.
4. Vitest workers remained after the invalid first run. Only the PIDs belonging to
   that invocation were terminated; unrelated preview/dev/test processes were not
   touched.

These conditions are separated from the final regression result. No failing test
was deleted, skipped, or loosened.

## P10 remediation regression addendum

- Audited source/test digest:
  `ab1e886cd0f38fb86adb879cfc25bbf26cddfc9db9d0258677a0141ffcf14db3`
- Unit project: 52 files / 300 tests PASS in 29.03 s.
- New serial financial real-route project: 1 file / 1 test PASS in 312.42 s.
- Existing serial render checks: 2 files / 2 tests PASS in 84.59 s.
- Combined current web inventory: 55 files / 303 tests, all PASS when run in their
  configured unit-then-render groups.
- Exact full package command: 55 files / 303 tests PASS in 351.95 s.
- Focused 20-vendor contract: 4/4 PASS; Chart.js and the non-canvas series list both
  receive the same amount-ranked top six plus `他14件`, while the named exact table
  retains vendor 01 through vendor 20 and `その他`.

Two earlier real-route retries are deliberately not presented as product failures:
their finite 110 s / 220 s child guards expired under simultaneous external-workspace
CPU load. The first completed run then detected a real Trends overflow, which was
fixed before the final PASS. The final child guard remains finite at 420 s and the
Vitest test at 900 s because core and additional actual-route scopes run serially;
no assertion, route, or viewport was skipped.

## Post-close-out RED/GREEN addendum

After the parent added a loading-state header reservation, the required exact full
package command failed only the existing mobile render gate: 54/55 files and
303/304 tests passed, while 375 px at 200% zoom measured a 386 px document. This is
recorded as a product RED rather than runner noise. A failure-only geometry trace
identified the one-column grid auto minimum; no assertion was weakened.

After applying the shrink-safe grid/header fix, the same exact command passed
55/55 files and 304/304 tests in 272.30 s. Known jsdom stderr remains separated
from failures: Chart.js cannot acquire a canvas context in the defense fixture, and
the pre-existing sortable table can render an inline `Term` button inside its
header button. Both suites passed; neither warning was introduced or suppressed by
the overflow fix.
