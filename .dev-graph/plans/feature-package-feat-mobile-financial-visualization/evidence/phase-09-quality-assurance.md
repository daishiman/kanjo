# Phase 09 — Quality, accessibility, privacy, and operational safety

- Task: `SYS-MOBFIN-P09`
- Result: **PASS**
- Audited source/test digest: `7eb4f647552b06eb6b88d6d44b6ac963416992dd00530a26fd0fabe0e120c717`
  - **過去の値 (消さずに残す)**: 第1世代 `6bb30856604f1dd065d78f707fd45771942a40ce00a15f5dd501f8aca144080a`（算出方法・対象ファイル集合が記録されておらず、以降の値とは**比較できない**）／第2世代 `866cee535cba13facc6494a449021036dd240f96ed5e12b2b1fa84933b4d999e`（`source-digest.mjs` 導入後の実計算値。M03 実装で対象3ファイルが変わったため第3世代へ）。digest は working tree のスナップショットであり、対象15ファイルが変われば動くのが正常。値そのものを追うのではなく、`mobile-viewport-results.json` の `digestInputs` でその値が何を測ったかを見ること。詳細は `phase-11-reproducible-evidence.md` の Addendum。
- Severity: critical 0, high 0, medium 0

## Final same-digest gates

> **注記 (2026-08-31)** — この見出しが主張する「全ゲートが同一 digest で走った」という
> 連続性そのものが、旧 digest の算出範囲が記録されていないため機械的に確認できない。
> 表中の各ゲート結果は当時の実行記録として有効だが、
> 「同一 digest である」という束ね方は裏が取れない。
>
> **一方、第2世代 `866cee53…` 以降（現行は第3世代 `7eb4f64…`）はこの束ね方が機械検証できる。**
> 対象15ファイルの個別ハッシュと算出手段が `mobile-viewport-results.json` の
> `digestInputs` に同梱されるため、「どのソースに対する同一性か」を読み手が照合できる。
> 詳細は `phase-11-reproducible-evidence.md` の Addendum。

| Command | Result |
|---|---|
| `pnpm lint` | PASS: Biome 277 files; project skills, glossary, and report CSS checks PASS |
| `pnpm --filter @kanjo/web test` | PASS: 54 files / 302 tests; final run 186.18 s; normal exit |
| `pnpm --filter @kanjo/web build` | PASS: 180 modules; initial JS 104.50 KiB / 110 KiB |
| `pnpm --filter @kanjo/web typecheck` | PASS: TypeScript errors 0 |
| `node packages/web/scripts/check-mobile-layout.mjs` | PASS: existing mobile layout, 375/360/200%, navigation and reduced motion |
| `node packages/web/scripts/check-mobile-financial-layout.mjs` | PASS: new financial layout, 8/8 viewport cases <br>**訂正 (2026-08-31): 実体は 3/3 viewport cases** (`320` / `375` / `reduced-motion`)。削減分は実ルート検証がカバーし被覆低下なし。旧 8 ケースのうち 44px / focus / タブバー被りの判定は実在しない要素 `.financial-test-last-action` に対する空振りだった。詳細は `phase-07-acceptance.md` の「Addendum (2026-08-31) — 証跡の訂正」 |
| `git diff --check` | PASS |

The first P09 full-suite attempt had one existing async Import-history test remain in
its loading state. It passed 4/4 immediately in isolation and passed inside the final
302/302 run without changing that test or its source. This is recorded as a transient
test-runner timing event, not presented as a product fix or hidden from the result.

## Non-functional matrix

| Requirement | Evidence | Result |
|---|---|---|
| 44 x 44 CSS px touch targets | measured disclosure and action at 320/360/375/390; existing navigation inspector measured 44 px (88 px at 200%) | PASS |
| keyboard focus | real Tab sequence reaches final action; details/table have `:focus-visible`; named table region has `tabIndex=0` | PASS |
| 200% zoom/reflow | 320 x 640 equivalent retains conclusion, series, table, action; existing zoom=2 inspector passes | PASS |
| color independence | signed currency text, increase/decrease words, semantic summary and table remain without color | PASS |
| reduced motion | Chart.js animations are disabled/guarded; CSS media query reduces transitions; inspector confirms near-zero duration | PASS |
| safe area | main/tabbar padding uses `env(safe-area-inset-bottom)` and final action is not obscured | PASS |
| horizontal containment | document overflow <= 1 px; wide table overflow exists only in named local region | PASS |
| privacy | deterministic fictitious values only; credential-pattern scan has 0 matches; no `packages/api`, local credential file, or runtime dataset diff | PASS |
| performance | initial JS 104.50 KiB is below the 110 KiB gate; chart/model code remains route-lazy | PASS |
| operational safety | local processes were finite and stopped; no deploy, commit, push, PR, or remote mutation | PASS |

## Scope audit

Feature changes are limited to the delegated web components/pages/styles, focused
tests/Chrome inspection, this feature's local evidence, and the later runbook. The
working tree also contains system specification, graph, architecture, feature, and
task artifacts produced by the parent workflow; they are not P09 implementation
edits and were preserved. User/other-agent changes were not reverted.

The targeted credential-pattern scan checked private-key headers, common cloud key
forms, and literal local authentication assignments in the feature diff and returned
zero matches. Anonymous preview state was created in temporary or ignored local
storage only.

P10 independent-review gate: **OPEN**.

## P10 remediation same-digest QA addendum

- Source/test digest:
  `ab1e886cd0f38fb86adb879cfc25bbf26cddfc9db9d0258677a0141ffcf14db3`
- `pnpm lint`: PASS; Biome 278 files plus project-skill, glossary, and report-CSS
  consistency checks.
- `pnpm --filter @kanjo/web typecheck`: PASS, TypeScript errors 0.
- `pnpm --filter @kanjo/web build`: PASS, 180 modules; initial JS 104.50 KiB / 110
  KiB.
- exact full package command and unit + all serial render projects: 55 files / 303
  tests PASS.
- actual Vite routes: Matrix and Statements at 320/360/375/390/768/1280/1600 and
  200% zoom; Overview, Trends, Subscriptions, Household, and an imported AI report at
  360/375/390/1280. Every required figure had a positive CSS and bitmap canvas, all seven
  meaning elements, exact table, and document overflow <= 1 px.
- high-cardinality subscription fixture: actual canvas dataset count 7; canvas labels
  exactly equal the non-canvas series list; exact table retains all 20 named series
  plus `その他`.
- privacy scan: deterministic anonymous fixture only; credential-pattern matches 0.

The browser gate is now isolated in the configured `render` project, single-fork and
grouped after unit tests. No API, authentication, accounting, persistence, data,
infrastructure, dependency, or lockfile was changed by this feature remediation.

## Final localhost remediation QA

| Command / observation | Final result |
|---|---|
| `pnpm lint` | PASS: Biome 278 files plus skill, glossary, and report-CSS checks |
| `pnpm --filter @kanjo/web typecheck` | PASS: TypeScript errors 0 |
| `pnpm --filter @kanjo/web build` | PASS: 180 modules; initial JS 104.55 KiB / 110 KiB |
| `pnpm --filter @kanjo/web test` | PASS: 55 files / 304 tests in 272.30 s |
| `node packages/web/scripts/check-mobile-layout.mjs` | PASS: 375/360/200%, document width 375/375 at 200% |
| financial evidence inspector | PASS: 8/8; JSON/screenshots pinned to final digest <br>**訂正 (2026-08-31): 実体は 3/3**。同上、`phase-07-acceptance.md` の「Addendum (2026-08-31) — 証跡の訂正」 |
| `pnpm audit --audit-level=high` | PASS: no known vulnerabilities |
| `git diff --check` | PASS: whitespace errors 0 |
| throttled localhost | final digest: LCP 1.217 s, CLS 0.00, Lighthouse Accessibility 100 / Best Practices 100; 56 applicable checks PASS |

The warning color and 44 px `Term` target close the parent's contrast/target audit.
The layout placeholder is `aria-hidden`; all visible financial meaning remains in
the loaded content. The 386 px RED at 200% is retained in P06, and the final test
proves the repaired 375 px boundary without reducing the 161/205 px reservation at
ordinary mobile widths.
