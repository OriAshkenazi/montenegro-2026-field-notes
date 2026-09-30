# Handoff · iOS redesign → reusable trip template

Planning handoff from a Claude Code cloud session (2026-09-30). Nothing here has been implemented yet. **The live site must not change during the trip (1–6 Oct 2026):** do not build into `gh-pages` or merge redesign work into this repo's `main`.

## Goal

Turn Montenegro Field Notes into an **app template for many trips**, serving two audiences:

1. **Travellers**: an iOS-native-feeling offline PWA that shows the trip.
2. **AI agents**: a harness for developing a new trip within explicit constraints (schema, validator, scaffold, preview, skill).

This trip's data (`itinerary.json`, `waypoints.json`, locales) becomes the first test fixture.

## Git strategy (decided in principle)

- **New repo** for the template, seeded from this repo's `main` *with history*. The name is still open, e.g. `field-notes` or `trip-field-notes`.
- This repo stays the frozen, live Montenegro trip. Trip-time content fixes go to this repo's `main` and deploy as usual.
- Deploys here are manual: `dist/` is published to `gh-pages`, and there is no CI. Pushing branches never changes the live site.
- Don't preview under the live site's own address (e.g. a `gh-pages/preview/` subfolder): the root service worker covers every path, so the two apps could mix cached files. If a phone preview is needed before 6 Oct, use a separate throwaway Pages repo.

## Stack (recommended; not yet confirmed by the user)

Stay a static offline PWA shared by link. Don't go native; Capacitor can wrap it later if the App Store is ever wanted.

| Area | Now | Proposed |
|---|---|---|
| Language | Plain JS on very long single lines | TypeScript, normal formatting |
| Data contract | Prose rules in `MASTER-PLAN.md` | Zod schemas → generated JSON Schema |
| UI | `innerHTML` strings | Preact + Vite |
| Map | Leaflet raster, dark mode by inverting tile colours | MapLibre GL + per-trip PMTiles extract (true offline, styled to match, real dark mode) |
| Service worker | Hand-written, manual `?rev=` | vite-plugin-pwa (Workbox) |
| Tests | node:test | Vitest + Playwright (iPhone-size screenshots per trip) |
| Node | 16 | 22 |

Keep: design tokens (`style.css` §1), the content model rules, the `trip.md` / `llms.txt` export, and Hebrew/RTL as a first-class feature.
Risk: PMTiles size. Each trip config sets the maximum zoom and the area covered; the file downloads on install, not on first page load.

## Proposed repo layout

```
app/                      viewer: shell, tabs, map, weather, packing, i18n (UI strings only)
schema/                   Zod → trip.schema.json
trips/
  montenegro-2026/        fixture: this trip, moved over as-is
  _mini/                  tiny synthetic 2-day trip that exposes hidden Montenegro assumptions
scripts/  new-trip · check · build --trip · preview (screenshots) · export (trip.md)
AGENTS.md + .claude/skills/plan-trip/
```

Trip-specific content that currently lives in the code and must move into trip data:
- `index.html`: hero copy + six SVG scenes, cash card (€225.39, Runolist, Europcar hold), Field Guide structure.
- `weather.js`: 13 hard-coded weather hubs with coordinates.
- `app.js`: `packDefaults`, cash amount.
- `scripts/audit-pins.js`: `TOWNS` table.
- `locales/*.json`: mixes UI wording with trip content (`pack.*` ×84, `w.*` ×45, `art.*` ×28, `glance.*`, `hub.*`).

## Viewer: iOS redesign

- **Bottom tab bar** on phones: icon + 10px label, frosted glass (`backdrop-filter: blur(20px) saturate(180%)`), hairline border, `env(safe-area-inset-bottom)`. Compact bar with the icon beside the label in phone landscape; top tab bar at ≥1000px (iPadOS style). Tabs are config-driven, at most 5.
- **Tapping the active tab scrolls that section to the top.** Each tab keeps its own scroll position.
- **Hero only on the Route tab.** Other sections get a large title that collapses into a thin nav bar when scrolled away.
- **Offsets that currently depend on `--tabs-h`** must move to a new `--top-chrome` value: view bar, Field Guide jump-bar, pinned bag names, day sticky headers / `syncDayStickyOffset`, `scroll-padding-top`, `--day-sticky-top`.
- **Map (open decision):** the recommendation is a **floating "Field map" bar above the tab bar**, like the Apple Music mini-player.
  - Tapping it opens half and full sheet sizes; the full sheet covers the tab bar.
  - Existing links that open a place on the map keep working unchanged.
  - The iOS swipe-home workaround (`cancelDrawerDrag` / `visibilitychange`) can be removed.
  - The alternative is a 6th Map tab, which means merging Budget into the Field Guide.
- **Map UI in the Apple Maps style:** a round ✕ in place of "Collapse", glass zoom/fit controls, a row of day chips in place of the dropdown, the place list as rows (dot, name, subtitle, chevron), and 12px-radius callout popups.
- **Polish:** iOS segmented controls (grey track, white thumb), inset grouped lists, `apple-mobile-web-app-status-bar-style`, `user-select:none` on app chrome, respect reduced motion.
- **Checks:** Playwright at 390×844 and in landscape, in HE and EN, light and dark mode.

## Agent harness

- **Schema + validator** with agent-readable errors: the path of the failing field plus a fix hint.
- **Per-trip constraints enforced by the validator:** dates, travellers, pace, budget ceiling, driving ceiling, languages.
- **Checks:**
  - every place referenced in the itinerary exists on the map;
  - daily driving stays under the ceiling after the terrain uplift;
  - stays cover every night;
  - the budget adds up;
  - every piece of text exists in every language;
  - sources carry the date they were checked;
  - map pins sit near the towns they claim (towns come from trip data).
- **`AGENTS.md`:** the `MASTER-PLAN.md` content rules made general: one canonical home per fact, stable IDs, logistics with the day they affect, no duplicated prose.
- **`plan-trip` skill:** research → places → itinerary → check → preview.

### Constraints recovered from Codex's first commit (`664a5c3:MASTER-PLAN.md`)

The original Codex prompts weren't available in the cloud session. This list is inferred from the output's "Guardrail stress test" and section names:

- Travellers: 2 adults; luggage 2 large checked cases + 2 cabin trolleys; bags checked in or hidden before any excursion; rental car boot physically tested; insurance terms spelled out (glass, tyres, underbody).
- Driving: at most 3.5 h a day after a +20% mountain uplift.
- Daylight: mountain drives and boat trips end at least 45 min before twilight (guardrail about 17:30).
- Airports: 60–90 min buffer after landing. Last day: hotel within 30 min of the airport; terminal by a fixed time.
- Coverage: regions (Coast / Central / North) × 7 interest tags. Curated pool columns: Item ID, Region, Activity or Venue, Interest Tag, …
- Output sections: itinerary table (morning / afternoon / evening / transit & cash), budget table by category with basis and ranges, feasibility decision, weather fallback branch, PASS/FAIL stress test with evidence, sources with the date checked, offline PWA.

## Order of work

1. Seed the new repo; move Montenegro content into `trips/montenegro-2026/`.
2. Schemas + validator, run against Montenegro.
3. New-stack app built straight into the iOS design. Acceptance:
   - **content parity:** every value in `itinerary.json` / `waypoints.json` is rendered (reuse the idea behind `tests/llm-export.test.js`);
   - **behaviour parity checklist:** opening a place from a day card, packing ticks saved on the device, offline, weather fallback, cash tracker, HE/EN.
4. `_mini` fixture; remove the hard-coding it exposes.
5. Harness: scaffold, check, preview, `AGENTS.md`, skill.
6. Per-trip deploys.

## Open decisions

1. Where trips live. Recommended: one repo for all trips, each deployed to its own address (`/<trip>/`), with an explicit per-trip deploy step so engine changes never reach a trip that's under way. The alternative is a GitHub template repo with one repo per trip.
2. Repo name.
3. Map: floating bar (recommended) vs. a Map tab.
4. Confirm the stack.

## First task for the local session: extract the Codex harness prompts

The prompts are in `~/.codex/sessions/` (the project cwd is `~/Documents/ChatGPT/Montenegro Trip`). Two known sessions:
- `2026/09/28/rollout-2026-09-28T23-14-13-01a0e9a7-58d9-7982-b66a-0e70634cdd91.jsonl` (Oct 4–5 route work)
- `2026/09/28/rollout-2026-09-28T22-28-18-01a0e97d-4cba-7801-918d-4dd461ffbc82.jsonl` (Oct 2–3 route work)

Look also for a local `agentic-trip-planner` repo: Codex mentioned it as a nested repo, and it may hold templates.

To extract them:
1. Collect every user message longer than ~1,500 characters from sessions whose `session_meta.cwd` contains `Montenegro Trip`. Skip injected `<environment_context>` / AGENTS.md blocks, and deduplicate near-identical versions (keep the latest, note what changed).
2. Write the results to `codex-prompts.md`.
3. Distil them into reusable templates: mark which parts are trip-specific (turn those into placeholders) and which are generic harness rules.
4. Map each constraint to a schema field or validator rule, merging them with the recovered list above.
