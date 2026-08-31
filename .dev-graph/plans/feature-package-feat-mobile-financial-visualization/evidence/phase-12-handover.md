# P12 Local screen-test handoff

- Task: `SYS-MOBFIN-P12`
- Result: **PASS**
- Runbook: `docs/runbooks/mobile-financial-visualization-test.md`
- Validated at: `2026-08-30T16:04:48Z`
- Production/remote mutation: none

## Required handoff

| Item | Fixed instruction |
|---|---|
| localhost URL | `http://localhost:8787/` by default; use the URL printed by Wrangler if that port is occupied |
| local-only identity | password-only `default` session; no username; password is the operator-created `AUTH_PASSWORD` in ignored `packages/api/.dev.vars` |
| anonymous seed | `scripts/seed-local.mjs`, fixed-seed fictitious MF/freee CSVs under `samples/`; no `data/` input |
| seed invocation | source the ignored `.dev.vars` into a non-tracing shell, run the script, then unset `AUTH_PASSWORD` and `SESSION_SECRET` |
| mobile scenarios | 360/375/390 px across Overview, Trends, Matrix, Subscriptions, Household, Statements; verify all seven meaning elements and no document overflow |
| wider/reflow scenarios | 768/1280/1600 and 320/200%-equivalent; verify semantic continuity, safe area, focus, and local-only table scrolling |
| shutdown | one `Ctrl-C` in the `pnpm run preview` terminal; `preview:smoke` shuts down and removes its own temporary state |

No reusable password is stored in this public repository or evidence. The operator
who starts the final localhost preview owns the local value and may disclose it to
the requesting user out of band for that local session only.

## Top-to-bottom walkthrough result

The runbook was validated as one composed local flow, using finite executions so no
second long-lived server conflicts with the final handoff server:

1. Prerequisites were checked: Node.js v22.21.1, pnpm 10.9.0, and Chrome
   151.0.7922.174 at the documented path.
2. The local identity contract was checked against `.dev.vars.example`, the login
   page, and the API auth guard. It is username-free, fail-closed, and maps an
   authenticated password session to the local `default` identity.
3. The finite `pnpm run preview` acceptance execution from P07 applied local
   migrations, built the SPA, served `GET /` with status 200 on the available port
   8788, and stopped cleanly. Port 8788 was selected only because 8787 was occupied;
   the runbook instructs the operator to follow Wrangler's actual printed URL.
4. `KANJO_SEED_SCENARIO=tight node scripts/seed-local.mjs --generate-only` regenerated
   216 + 144 anonymous MF rows and 96 + 64 anonymous freee rows. `git diff --quiet --
   samples` then returned 0, proving the generated files are byte-equivalent after
   Git normalization to the existing anonymous samples and did not alter them.
5. The current `pnpm run preview:smoke` invocation passed in 51.88 s (test body
   51.32 s). It used an isolated temporary D1/R2 and ephemeral authentication,
   applied all migrations, served the SPA, rejected unauthenticated API access,
   logged in, and completed cash plus attachment create/read/delete before removing
   its temporary directory and stopping its server. Exit code: 0.
6. The final-digest actual-route Chrome gate covered the runbook's financial routes,
   seven meaning elements, canvas geometry/bitmap, subscription summary/exact-table
   relationship, overflow, focus, tap targets, safe area, reduced motion, and all
   specified viewports. P11 contains the route-by-route results and screenshots.
7. The shutdown procedure was observed in both modes: the finite plain preview was
   stopped after its 200 response, while the isolated smoke left no owned Wrangler
   child running.

This composed run avoids reading or overwriting any existing local credential and
still exercises every executable boundary in the documented manual flow. The final
operator will start the persistent instance and report its actual port and local-only
password separately, as required by the user.

## Required command results

| Command | Exit | Result |
|---|---:|---|
| `pnpm run preview:smoke` | 0 | 1/1 PASS; migrations, SPA, auth, cash and attachment lifecycle; 51.88 s |
| `git status --short --ignored` | 0 | tracked feature/document changes visible; expected ignored local build/state directories visible; no `.dev.vars` content printed |
| `git diff --check` | 0 | whitespace errors 0 |

The status check showed no sample diff after regeneration. It also confirmed that
local Wrangler state, dependency folders, and web build output remain ignored.
Neither a production credential nor a local credential value was emitted to the
evidence.

P13 close-out gate: **OPEN**.

## Final-digest handoff refresh

The isolated `pnpm run preview:smoke` was rerun after the final Web build and passed
1/1 in 36.89 s (test body 36.59 s). It again applied all local migrations, served
the SPA, rejected unauthenticated access, authenticated with an ephemeral local
password, and completed cash plus attachment create/read/delete before removing its
temporary state. No repository credential was read or printed.

The parent-owned persistent localhost audit additionally recorded final-digest LCP
1.217 s, CLS 0.00, and Lighthouse mobile Accessibility/Best Practices 100/100
(56 applicable checks passed; four authenticated-app SEO/agentic checks are
intentionally not satisfied). The runbook keeps
the password as an environment-owned value and contains only anonymous sample paths
and expected screen results; the final actual URL/password remain a parent handoff,
not repository evidence.
