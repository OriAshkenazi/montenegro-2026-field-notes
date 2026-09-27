# Montenegro Field Notes · build record

The public PWA is the canonical trip plan. Six days, confirmed lodging, activity options, safety guidance, budget estimates, navigation links, and the single route's guardrail checks live in `itinerary.json` and render through `app.js`.

## Confirmed bases and route

- Runolist Chalet, Narodnih heroja, 84220 Žabljak: check-in Oct 1, checkout Oct 4 (three nights).
- Conte Hotel & Restaurant, Ul. Marka Martinovića bb, 85336 Perast: check-in Oct 4, checkout Oct 6 (two nights).
- Day 1 remains a direct TIV-to-Runolist transfer using planning estimates, with an after-sunset exception. The flight number, rental voucher, and individual late-arrival agreement have not been supplied. If conditions are unsafe, stop safely and arrange lodging directly; no alternate lodging booking is represented.
- Day 3 P14/Sedlo is conditional at about 5 h 24 adjusted, with only the Piva viewpoint. Verify all live waypoints and finish high-altitude driving by 16:00; cancel for snow, ice, poor visibility, closure, or an over-cap route.
- Day 4 transfers from Runolist to Conte in Perast. Perast old town restricts vehicle access May–October; use a signed entrance car park and contact Conte about available assistance to reception. Its published check-in starts at 15:00 and checkout is by 11:00; confirm individual booking terms.
- Day 6 is a Perast-to-TIV transfer. The existing 11:30 car-return and 12:15 terminal targets remain planning assumptions until the rental voucher is supplied.
- Weather or road changes cancel optional activities within the fixed booked stays. No separate Kotor-only overnight route is represented. The Tara Bridge closure through Oct 26, 2026 at noon is avoided.

## Route text and single source of truth

The day timeline and master schedule use typed sentence segments. Each day in `routes.primary.days` has ordered `morning`, `afternoon`, and `evening` arrays of `{ "type": "DRIVE", "text": "..." }` objects. Valid types are DRIVE, STAY, SEE, WALK, EAT, WATER, WELLNESS, LOGISTICS, and CAUTION. Keep each segment concise and retain navigation destinations in that day's `stops` array.

`app.js` renders the same itinerary data in day cards, the master schedule, quick references, and the map. `waypoints.json` is the shared place index for timeline links, map markers, popup shortcuts, food venues, and offline coordinate lookup. Keep stop and food item names aligned with waypoint names and day memberships. The Runolist map/weather point is an approximate Borje-area locality pin; its address query opens the property search. Conte uses an OpenStreetMap hotel building/reception anchor because the booked annex is unknown.

The map drawer has peek, half, and full states, uses Leaflet with OpenStreetMap tiles, filters route waypoints by selected day, and opens the corresponding day card from lodging popups. Leaflet assets and waypoint data are cached in the service-worker shell; viewed OSM tiles use a bounded runtime cache. The offline waypoint list remains available when tiles are unavailable.

## Validation and release

Run `node tests/waypoints.test.js` and `node tests/weather.test.js`. The itinerary is static JSON; there is no separate bundler. When itinerary, waypoint, app, style, or weather assets change, update the asset query revisions in `index.html` and `sw.js`, increment the service-worker cache version, and version the weather local-storage key when forecast coordinates change.

GitHub Pages serves the static app from the repository's `gh-pages` branch at `https://oriashkenazi.github.io/montenegro-2026-field-notes/`. Reservation identifiers, individual booking terms, flight details, rental voucher conditions, and actual costs must remain unclaimed until supplied by the traveler.
