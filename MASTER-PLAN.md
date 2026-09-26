# Montenegro Field Notes · build record

The public PWA is the canonical trip plan. The full six-day primary route, alpine-weather fallback, mobility instructions, budget, safety/emergency information, navigation links, curated activity schema, sources, and branch-specific guardrail checks live in `itinerary.json` and render through `app.js`.

## Route model

- Primary: Kotor for nights 1, 4, 5; Žabljak for nights 2, 3. This reaches Durmitor and Tara Canyon while limiting stays to two bases.
- Fallback: Kotor for all five nights; Days 3–5 cover Lovćen/Cetinje, Lake Skadar, and the Bay of Kotor without high alpine roads.
- The coast–Žabljak transfer fails the 3.5 h adjusted driving limit at the currently cited 3 h 04 route estimate (3 h 41 after +20%). The primary route surfaces that failure and only allows the drive if live routing is at most 2 h 55, roads are open, and conditions are safe. Constraint compliance is not guaranteed.
- The Đurđevića Tara bridge is scheduled closed for the entire trip, through Oct 26, 2026 at 12:00. The route does not cross it.

## Validation

The data is static JSON. `app.js` renders complete day cards, the synchronized schedule, route-specific checks, and candidate experiences. `sw.js` caches the application shell and itinerary JSON for offline use. GitHub Pages serves the repository’s `gh-pages` branch at the project site URL.

Refer to the in-app Sources section for current official fees, road notices, fuel prices, park charges, route references, and operating details. Prices and date-specific October operations marked for confirmation are planning estimates, not reservations.
