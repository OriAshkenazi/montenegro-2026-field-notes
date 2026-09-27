# Montenegro Field Notes · build record

The public PWA is the canonical trip plan. The full six-day primary route, alpine-weather fallback, mobility instructions, budget, safety/emergency information, navigation links, curated activity schema, sources, and branch-specific guardrail checks live in `itinerary.json` and render through `app.js`.

## Route model

- Primary: Žabljak for nights Oct 1–3, then Kotor for nights Oct 4–5. This reaches Durmitor and Tara with one normal hotel move.
- Day 1: drive directly from TIV to pre-booked Žabljak lodging after rental pickup. Current published route estimates vary; use 3 h 20 min as one nominal published estimate (other current route results vary), or about 4 h adjusted after the +20% terrain allowance. With a 15:15–15:30 departure, the projected arrival is around 19:15–19:30. That is after Oct 1 sunset and the existing daylight cutoff, so it is explicitly recorded as an accepted exception, never as a safety pass. Skip the ferry and all sightseeing stops. Check live road/weather, visibility, fatigue, delays and confirmed late check-in before departure. If the go/no-go fails, stay in Kotor and reassess a northbound transfer on Day 2; if the northern route remains unsafe, use the full coast-only fallback.
- Day 2 is a recovery day at Žabljak with a short Black Lake visit. If the Day 1 contingency was used, Day 2 becomes a direct Kotor–Žabljak transfer; visit the lake only after check-in and only if time, light and energy allow.
- Day 3 features the P14/Sedlo out-and-back from Žabljak to the Plužine/Piva viewpoint, provisionally estimated at 5 h 24 adjusted. This leaves only six minutes under the 5.5 h cap. Verify the complete live route with waypoints that morning, remove optional spurs, and skip P14 if unsafe or if the core route exceeds the cap. Finish high-altitude driving by 16:00.
- Day 4 transfers to Kotor; Day 5 remains a flexible coastal/Central outing; Day 6 keeps the TIV car-return and terminal deadlines.
- Weather fallback: Kotor all five nights; Days 3–5 cover Lovćen/Cetinje, Lake Skadar and the Bay without high alpine roads. The Đurđevića Tara bridge closure through Oct 26, 2026 at noon is avoided.
- Official National Parks of Montenegro 2026 listings show €5/person/day entries and a €13.50/person annual pass; Skadar’s listing includes one cruise. Verify ticket terms and October boat operations before travel. Traveler prices remain historical anecdotes.

## Route text authoring and display

The day timeline and master schedule use typed sentence segments so readers can scan driving, lodging, stops, and cautions without changing the route chronology. For every day in both `primary` and `fallback`, `morning`, `afternoon`, and `evening` are arrays of `{ "type": "DRIVE", "text": "..." }` objects. Keep segments in the order a traveler encounters them. Use one concise sentence or closely related instruction per segment; split a sentence when it combines unrelated actions.

Use only these types: `DRIVE` for routes, roads and travel time; `STAY` for accommodation and check-in; `SEE` for sights, venues and landmarks; `WALK` for hikes and walking; `EAT` for meals and food; `WATER` for boats, swimming and rafting; `WELLNESS` for spa and recovery experiences; `LOGISTICS` for tickets, airport steps, payment and practical arrangements; `CAUTION` for hazards, closures, go/no-go decisions and things to skip. Choose the type based on the sentence’s main instruction. Split unrelated actions into separate segments rather than giving one segment multiple labels. Do not add presentation markup or category labels inside `text`; the renderer supplies the icon, visible label and color. Keep navigation destinations in the day’s existing `stops` array so map links remain functional.

`app.js` renders the same ordered segments in the expandable day cards and the master schedule. If adding a type, update `segmentTypes`, the route key in `index.html`, matching styles in `style.css`, and this taxonomy together. Keep the text label and icon meaningful without color, and check wrapping on a narrow screen. After editing itinerary content, validate every segment in both branches and bump the service-worker cache revision and asset query revision in `sw.js`/`index.html` before publication so offline clients receive the update.

## Validation

The itinerary is static JSON. `app.js` renders day cards, the synchronized schedule, branch checks and candidate experiences. Route segment `type` values must belong to the documented taxonomy and each `text` must be non-empty. `sw.js` caches the application shell and itinerary JSON for offline use. GitHub Pages serves the repository’s `gh-pages` branch at the project site URL.

Sources checked Sep 27, 2026. The route change requires checking both six-day branches, five-night totals, one normal primary hotel move, the conditional Day 1 daylight exception and abort path, P14’s conditional drive ceiling, luggage security, and the Day 6 airport deadline. Bump the service-worker cache version and asset query revision on publication so offline clients receive the new itinerary.

Refer to the in-app Sources section for official park fees, P14 season/elevation, road notices, route estimates, fuel prices and operating details. Prices and date-specific October operations marked for confirmation are planning estimates, not reservations.
