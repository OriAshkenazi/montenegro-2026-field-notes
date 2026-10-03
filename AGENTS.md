# AGENTS.md: Montenegro Field Notes PWA

Rules for agents changing this repo. The repo is **public** and the site is served from `gh-pages` at https://oriashkenazi.github.io/montenegro-2026-field-notes/.

## Layout
- `itinerary.json`: the trip data. Use targeted text edits; the file is not a plain `json.dump` layout.
- `waypoints.json`: map pins. Stops and legs must reference exact names and ids.
- `locales/he.json` `content`: the Hebrew for every English sentence in itinerary text fields.
- `app.js`, `timetable.js`, `i18n.js`, `sw.js`, `style.css`: the app itself.
- `tests/` and `scripts/` (`npm run verify` runs lint, tests, build and smoke).

## Workflow
1. Work in your own git worktree from the latest `origin/main`, never in a shared checkout. Only one deployer at a time.
2. Update the Hebrew for every new sentence and remove orphaned keys. Facts (times, €, phone numbers, road refs) stay verbatim, and waypoint names stay linkable.
3. Bump the cache revision: `rev=` in `index.html`, `app.js`, `i18n.js`, `sw.js` and `tests/waypoints.test.js`, plus `CACHE`/`VERSION` in `sw.js` and the test.
4. `npm run verify` must pass, run from a git worktree.
5. Rebase, then push `main` (fast-forward only, never force).
6. Publish `dist/` to `gh-pages` with `rsync --checksum`, compare it with `diff -r`, and push fast-forward.
7. Check the live site: confirm the live `sw.js` rev and grep for one changed string.
8. Run an independent audit after itinerary changes on trip days.

## Data rules
- **Routes and drive times come from routing data.** Use an unconstrained OSRM route checked against known closures; adjusted = nominal × 1.2. Record `driveMin.source` and `driveMin.checked`. Never encode a route assumption you haven't checked. Example: the R-10 to Mojkovac does **not** cross Đurđevića Tara Bridge.
- **Guardrail tests that encode facts** (closures, route choices, meal windows) carry a comment with their source and date. Update them when the facts or the travellers' decisions change; don't weaken safety guardrails silently.
- **Recommendations** (`communityPicks`, notes) state their source. Facebook-sourced names and private phone numbers never go into this repo.
