# Montenegro Field Notes · build record

The public PWA is the canonical trip plan. The full six-day primary route, alpine-weather fallback, mobility instructions, budget, safety/emergency information, navigation links, curated activity schema, sources, and branch-specific guardrail checks live in `itinerary.json` and render through `app.js`.

## Route model

- Primary: Kotor for nights 1, 4, 5; Žabljak for nights 2, 3. This reaches Durmitor and Tara Canyon while limiting stays to two bases.
- Fallback: Kotor for all five nights; Days 3–5 cover Lovćen/Cetinje, Lake Skadar, and the Bay of Kotor without high alpine roads.
- The adjusted daily driving ceiling is 5.5 h after the +20% terrain allowance. Day 3 features the P14/Sedlo out-and-back from Žabljak to the Plužine/Piva viewpoint, provisionally estimated at 5 h 24 adjusted. Public route estimates vary, so this remains conditional until all waypoints are checked on the day; remove optional spurs first and switch to the coast-only fallback if the core route exceeds 5.5 h.
- Day 1 offers the Kamenari–Lepetane car ferry as a transfer option, followed by direct hotel check-in and luggage unloading. Day 2 includes only a short Black Lake visit after hotel check-in; longer hikes are time-boxed optional alternatives.
- Official National Parks of Montenegro 2026 listings show €5/person/day entries and a €13.50/person annual pass; Skadar’s listing includes one cruise. Verify the ticket terms and October boat operations before travel. Traveler prices in supplied notes are historical.
- P14 is a high mountain road: skip it for snow, ice, poor visibility, a closure or unsafe conditions, and finish high-altitude driving by 16:00. Check AMSCG and local weather on the day.
- The Đurđevića Tara bridge is scheduled closed for the entire trip, through Oct 26, 2026 at 12:00. The route does not cross it.

## Validation

The data is static JSON. `app.js` renders complete day cards, the synchronized schedule, route-specific checks, and candidate experiences. `sw.js` caches the application shell and itinerary JSON for offline use. GitHub Pages serves the repository’s `gh-pages` branch at the project site URL.

Refer to the in-app Sources section for official park fees, P14 season/elevation, ferry schedule and toll, road notices, fuel prices, route references, and operating details. Prices and date-specific October operations marked for confirmation are planning estimates, not reservations.
