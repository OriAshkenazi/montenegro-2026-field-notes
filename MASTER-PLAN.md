# Montenegro Field Notes · build record

The expanded timeline is the canonical home for daily plans, detailed food recommendations, parking instructions, route conditions, and operational guidance.

## Content model

- `itinerary.json` owns the primary day timeline and its rich food records. Timeline segments and food records have stable IDs; food records point to waypoints by `waypointId`.
- `waypoints.json` contains map metadata: IDs, names, categories, coordinates, payment badges, map links, and day references. Do not add long-form advice or contact prose here.
- The Food & Provisions and experience views are compact indexes derived from itinerary IDs. Their links open the matching timeline card and map pin. Map popups expose only waypoint metadata and those links.
- Keep route-specific logistics and hazards with the day they affect. The Field Guide is reserved for universal quick references. Avoid parallel schedule tables and copied warning paragraphs.

The service worker caches the static app shell, itinerary data, waypoint metadata, and Leaflet assets. Viewed OpenStreetMap tiles use a bounded runtime cache. Preserve relative asset paths so the app works from the GitHub Pages project subpath.

## Validation and release

Use Node 16 and the checked-in npm lockfile. Run `npm ci` for setup and `npm run verify` for JavaScript/HTML lint, data and navigation checks, the existing waypoint/weather tests, optimized `dist/` generation, and the production smoke check. The build minifies HTML, CSS, and JavaScript and synchronizes asset revisions with the service-worker cache version.

The build also writes `trip.md` (with an identical `llms-full.txt`) and `llms.txt` from `scripts/llm-export.js`, embeds the same trip text and Schema.org `TouristTrip` JSON-LD in `index.html` for readers that do not run JavaScript, and adds `.nojekyll` so GitHub Pages serves the Markdown as-is. `tests/llm-export.test.js` fails if any value in `itinerary.json` or `waypoints.json` is missing from `trip.md`; new fields fall through to a generic line until they get a proper renderer.

Publish the contents of `dist/` at the root of the `gh-pages` branch. GitHub Pages serves the app at `https://oriashkenazi.github.io/montenegro-2026-field-notes/`.
