'use strict';

// Renders the whole trip as plain Markdown and static HTML so chatbots and other
// readers that never run JavaScript see the same plan the app draws at runtime.
// Every value in itinerary.json and waypoints.json must reach the output; unknown
// fields fall through to a generic "key: value" line and tests/llm-export.test.js
// fails the build if anything is dropped.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { projectTimetable } = require(path.join(root, 'timetable.js'));

const PERIODS = ['morning', 'afternoon', 'evening'];
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function loadInputs() {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const html = read('index.html');
  const siteUrl = (/<meta property="og:url" content="([^"]+)"/.exec(html) || [])[1] || './';
  const hubsSource = /const hubs = (\[[\s\S]*?\]);/.exec(read('weather.js'));
  // weather.js keeps its hubs in a closure; evaluate just that literal.
  const hubs = hubsSource ? Function(`"use strict";return (${hubsSource[1]});`)() : [];
  return {
    itinerary: JSON.parse(read('itinerary.json')),
    waypointsFile: JSON.parse(read('waypoints.json')),
    ui: JSON.parse(read('locales/en.json')).ui,
    hubs,
    siteUrl
  };
}

// ---- tiny document model rendered to both Markdown and HTML ----
// Inline content is an array of strings, {b}, {a, href} and {code} parts.
const link = (text, href) => ({ a: String(text), href: String(href) });
const bold = text => ({ b: String(text) });
const inl = (...parts) => parts.flat().filter(part => part !== null && part !== undefined && part !== '');

function mdInline(parts) {
  return inl(parts).map(p => typeof p === 'string' || typeof p === 'number' ? String(p) : p.b !== undefined ? `**${p.b}**` : p.a !== undefined ? `[${p.a.replace(/[[\]]/g, '\\$&')}](${p.href.replace(/[()\s]/g, encodeURIComponent)})` : `\`${p.code}\``).join('');
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function htmlInline(parts) {
  return inl(parts).map(p => typeof p === 'string' || typeof p === 'number' ? esc(p) : p.b !== undefined ? `<b>${esc(p.b)}</b>` : p.a !== undefined ? `<a href="${esc(p.href)}">${esc(p.a)}</a>` : `<code>${esc(p.code)}</code>`).join('');
}

function toMarkdown(doc) {
  const out = [];
  for (const node of doc) {
    if (node.h) out.push(`${'#'.repeat(node.h)} ${mdInline(node.text)}`);
    else if (node.p) out.push(mdInline(node.p));
    else if (node.ul) out.push(node.ul.map(item => renderMdItem(item, 0)).join('\n'));
    else if (node.table) {
      const row = cells => `| ${cells.map(c => mdInline(c).replace(/\|/g, '\\|')).join(' | ')} |`;
      out.push([row(node.table.head), `|${node.table.head.map(() => ' --- ').join('|')}|`, ...node.table.rows.map(row)].join('\n'));
    }
  }
  return out.join('\n\n') + '\n';
}
function renderMdItem(item, depth) {
  const pad = '  '.repeat(depth);
  const { text, children } = Array.isArray(item) || typeof item !== 'object' || item.a !== undefined || item.b !== undefined ? { text: item, children: [] } : item;
  return [`${pad}- ${mdInline(text)}`, ...(children || []).map(child => renderMdItem(child, depth + 1))].join('\n');
}

function toHtml(doc) {
  const out = [];
  for (const node of doc) {
    if (node.h) out.push(`<h${node.h}>${htmlInline(node.text)}</h${node.h}>`);
    else if (node.p) out.push(`<p>${htmlInline(node.p)}</p>`);
    else if (node.ul) out.push(renderHtmlList(node.ul));
    else if (node.table) out.push(`<table><thead><tr>${node.table.head.map(c => `<th>${htmlInline(c)}</th>`).join('')}</tr></thead><tbody>${node.table.rows.map(r => `<tr>${r.map(c => `<td>${htmlInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  }
  return out.join('\n');
}
function renderHtmlList(items) {
  return `<ul>${items.map(item => {
    const { text, children } = Array.isArray(item) || typeof item !== 'object' || item.a !== undefined || item.b !== undefined ? { text: item, children: [] } : item;
    return `<li>${htmlInline(text)}${children && children.length ? renderHtmlList(children) : ''}</li>`;
  }).join('')}</ul>`;
}

// ---- value helpers ----
function plain(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(plain).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}: ${plain(v)}`).join('; ');
  return String(value);
}
// Anything a renderer does not know about still gets printed.
function rest(obj, known) {
  return Object.keys(obj || {}).filter(key => !known.includes(key)).map(key => inl(bold(`${key}:`), ' ', plain(obj[key])));
}
const field = (label, value) => value === undefined || value === null || value === '' ? null : inl(bold(`${label}:`), ' ', typeof value === 'object' && !Array.isArray(value) && value.a === undefined ? plain(value) : value);
const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const fieldLink = (label, url) => url ? inl(bold(`${label}:`), ' ', link(host(url), url)) : null;
const compact = list => list.filter(Boolean);
const minutes = n => n >= 60 ? `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')} min` : `${n} min`;
function isoDate(label, year) {
  const m = /([A-Z][a-z]{2})\s+(\d{1,2})/.exec(label || '');
  return m && MONTHS[m[1]] ? `${year}-${String(MONTHS[m[1]]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : null;
}

function buildDocument(inputs) {
  const { itinerary: trip, waypointsFile, ui, hubs, siteUrl } = inputs;
  const route = trip.routes.primary;
  const waypoints = waypointsFile.waypoints;
  const wp = new Map(waypoints.map(point => [point.id, point]));
  const wpName = id => (wp.get(id) || {}).name || id;
  const year = String(trip.updated || '').slice(0, 4) || '2026';
  const firstDay = isoDate(route.days[0].date, year);
  const lastDay = isoDate(route.days[route.days.length - 1].date, year);
  const doc = [];
  const h = (level, ...text) => doc.push({ h: level, text: inl(text) });
  const p = (...text) => doc.push({ p: inl(text) });
  const ul = items => { const list = compact(items); if (list.length) doc.push({ ul: list }); };

  h(1, `${ui['meta.title']} — ${ui['hero.title1']} ${ui['hero.title2']}`);
  p(`This is the complete plain-text version of the Montenegro Field Notes trip app (${siteUrl}). It contains every entry of the itinerary, food and provisions, stays, budget, emergency numbers, map waypoints and sources, generated from the same data the app uses. Plan data updated ${trip.updated}; sources checked ${trip.sourcesChecked}. Clock times are the app’s computed timetable (fixed times plus drive and dwell durations); items without a clock time are listed under their part of the day.`);
  ul([
    field('Trip', `${ui['brand.dates']} · ${ui['hero.eyebrow']}`),
    field('Dates', `${firstDay} to ${lastDay} (${route.days.length} days, ${route.nightBreakdown.reduce((n, x) => n + x.nights, 0)} nights)`),
    field('Route name', trip.routeNames.primary),
    field('Flights', ui['hero.route']),
    field('Bases', route.nightBreakdown.map(n => `${n.base} · ${n.nights} nights (${n.dates})`).join('; ')),
    field('Summary', ui['hero.deck']),
    field('Planning rule', `Daily driving ceiling ${trip.drivingCeilingAdjustedHours} h adjusted; drive times include a +${trip.terrainBufferPercent}% terrain buffer over nominal routing times.`),
    field('App', link(siteUrl, siteUrl)),
    ...rest(trip, ['updated', 'drivingCeilingAdjustedHours', 'terrainBufferPercent', 'routeNames', 'routes', 'budget', 'cashTracker', 'emergency', 'curatedPool', 'sources', 'sourcesChecked', 'stays', 'flightPayment'])
  ]);

  h(2, 'Contents');
  ul(['Trip at a glance', 'Stays', ...route.days.map(d => `${d.heading} (${d.date})`), 'Quick status checks', 'Budget', 'Emergency numbers and field guide', 'Experience index', 'Live weather', 'Map waypoints', 'Sources']);

  h(2, 'Trip at a glance');
  doc.push({ table: { head: ['Day', 'Date', 'Region', 'Base', 'Adjusted driving'], rows: route.days.map(d => [String(d.day), `${d.date} (${isoDate(d.date, year)})`, d.region, d.base, `${d.adjustedHours} h`]) } });
  h(3, ui['ops.nights']);
  ul(route.nightBreakdown.map(n => inl(`${n.base} — ${n.nights} nights, ${n.dates}`, rest(n, ['base', 'nights', 'dates']).map(r => inl(' · ', r)))));

  h(2, 'Stays');
  for (const stay of trip.stays) {
    h(3, `${stay.name} (${stay.status})`);
    ul([
      field('Dates', stay.dates), field('Address', stay.address), field('Room', stay.room), field('Check-in', stay.checkIn), field('Check-out', stay.checkout),
      field('Price', stay.price), field('Payment', stay.payment), field('Cancellation', stay.cancellation), field('Booking', stay.confirmation),
      field('Phone', stay.phone), field('Amenities', stay.amenities), stay.mapWaypointId && wp.get(stay.mapWaypointId) ? fieldLink('Map', wp.get(stay.mapWaypointId).googleUrl) : null,
      ...rest(stay, ['name', 'status', 'dates', 'address', 'room', 'checkIn', 'checkout', 'price', 'payment', 'cancellation', 'confirmation', 'phone', 'amenities', 'mapWaypointId'])
    ]);
  }

  for (const day of route.days) {
    const projected = projectTimetable(day);
    const when = new Map();
    for (const row of projected.rows) for (const id of row.sourceIds || []) if (!when.has(id)) when.set(id, row.when);
    const foods = new Map();
    for (const group of Object.values(day.food || {})) for (const item of group) foods.set(item.id, item);

    h(2, `${day.heading} (${day.date})`);
    ul([
      field('Date', isoDate(day.date, year)), field('Region', day.region), field('Overnight base', day.base), field('Day starts', day.startAt),
      field('Driving route', day.drive), field('Adjusted driving total', `${day.adjustedHours} h (timetable drive legs sum to ${minutes(projected.totals.driveAdjustedMin)})`),
      field('Interests', (day.tags || []).join(', ')),
      ...rest(day, ['day', 'date', 'region', 'base', 'drive', 'adjustedHours', 'morning', 'afternoon', 'evening', 'parking', 'cash', 'stops', 'tags', 'heading', 'food', 'startAt'])
    ]);
    if (projected.conflicts.length) p(bold('Timetable warnings:'), ' ', projected.conflicts.map(c => `${c.id}: ${c.fixedAt ? `fixed ${c.fixedAt} but previous items run to ${c.cursor}` : `due by ${c.dueBy} but projected to finish ${c.cursor}`}`).join('; '));

    for (const period of PERIODS) {
      const segments = day[period] || [];
      if (!segments.length) continue;
      h(3, period[0].toUpperCase() + period.slice(1));
      const items = [];
      for (const seg of segments) {
        const extra = rest(seg, ['type', 'text', 'id', 'title', 'fixedAt', 'dueBy', 'dwellMin', 'driveMin', 'leg', 'foodId', 'note']);
        // Cautions and notes belong to the item before them, as in the app's timetable.
        if ((seg.type === 'CAUTION' || seg.note === true) && items.length) {
          items[items.length - 1].children.push({ text: inl(bold(seg.type === 'CAUTION' ? `CAUTION${seg.title ? ` · ${seg.title}` : ''}:` : `Note (${seg.type}${seg.title ? ` · ${seg.title}` : ''}):`), ' ', seg.text), children: extra });
          continue;
        }
        const time = when.get(seg.id);
        const clock = time && /\d/.test(time) ? `${time} · ` : '';
        items.push({ text: inl(bold(`${clock}${seg.type}${seg.title ? ` · ${seg.title}` : ''}`), ' — ', seg.text), children: compact([
          field('Fixed time', seg.fixedAt),
          field('Deadline', seg.dueBy),
          seg.dwellMin !== undefined ? field('Time on site', `${seg.dwellMin} min`) : null,
          seg.driveMin ? field('Drive time', `${seg.driveMin.nominal} min nominal / ${seg.driveMin.adjusted} min adjusted${seg.driveMin.source ? ` (source ${seg.driveMin.source}` : ''}${seg.driveMin.checked ? `, checked ${seg.driveMin.checked})` : seg.driveMin.source ? ')' : ''}${rest(seg.driveMin, ['nominal', 'adjusted', 'source', 'checked']).map(r => ' · ' + mdInline(r)).join('')}`) : null,
          seg.leg ? field('Leg', `${wpName(seg.leg.from)} → ${wpName(seg.leg.to)}${seg.leg.via && seg.leg.via.length ? ` via ${seg.leg.via.map(wpName).join(', ')}` : ''}${rest(seg.leg, ['from', 'to', 'via']).map(r => ' · ' + mdInline(r)).join('')}`) : null,
          seg.foodId && foods.get(seg.foodId) ? field('Food stop', `${foods.get(seg.foodId).name} (details under Food & provisions for this day)`) : null,
          ...extra
        ]) });
      }
      ul(items);
    }

    const food = day.food || {};
    const groups = [['meals', 'Meals'], ['coffee', 'Coffee'], ['supermarkets', 'Supermarkets and stock-up stops'], ...Object.keys(food).filter(k => !['meals', 'coffee', 'supermarkets'].includes(k)).map(k => [k, k])];
    if (groups.some(([key]) => (food[key] || []).length)) {
      h(3, 'Food & provisions');
      for (const [key, label] of groups) {
        if (!(food[key] || []).length) continue;
        p(bold(label));
        ul(food[key].map(item => ({
          text: inl(bold(item.slot ? `${item.slot} · ${item.name}` : item.name), item.specialty ? ` — ${item.specialty}` : '', item.why ? ` — ${item.why}` : ''),
          children: compact([
            field('Hours', item.hours), field('Parking', item.parking), field('Payment', item.cash),
            item.durationMinutes !== undefined ? field('Time planned', `${item.durationMinutes} min`) : null,
            field('Plan', item.plan), fieldLink('Map', item.mapUrl), fieldLink('Source', item.sourceUrl),
            ...rest(item, ['slot', 'name', 'specialty', 'why', 'hours', 'parking', 'cash', 'durationMinutes', 'plan', 'mapUrl', 'sourceUrl', 'id', 'waypointId'])
          ])
        })));
      }
    }
    if (day.parking || day.cash) {
      h(3, 'Parking and cash');
      ul([field('Parking', day.parking), field('Cash', day.cash)]);
    }
    if ((day.stops || []).length) {
      h(3, 'Route and map links');
      ul(day.stops.map(([name, url]) => inl(link(name, url))));
    }
  }

  h(2, `${ui['checks.title']} checks`);
  ul(route.checks.map(c => inl(bold(`${c.status}:`), ' ', c.name, rest(c, ['name', 'status']).map(r => inl(' · ', r)))));

  h(2, 'Budget');
  p(`${ui['budget.eyebrow']}. ${ui['budget.intro']}`);
  ul(trip.budget.map(b => ({
    text: inl(bold(b.label), ' — ', b.currency && b.currency !== 'EUR' ? `${b.currency} ${b.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (EUR planning range €${b.min}–€${b.max})` : b.actual !== undefined ? `€${b.actual} actual (range €${b.min}–€${b.max})` : `€${b.min}–€${b.max}`),
    children: compact([field('Note', b.note), ...rest(b, ['label', 'min', 'max', 'note', 'actual', 'currency', 'amount'])])
  })));
  const eurMin = trip.budget.filter(b => !b.currency || b.currency === 'EUR').reduce((n, b) => n + b.min, 0);
  const eurMax = trip.budget.filter(b => !b.currency || b.currency === 'EUR').reduce((n, b) => n + b.max, 0);
  p(bold('EUR total:'), ` €${eurMin.toFixed(2)}–€${eurMax.toFixed(2)} (${ui['budget.total']}). ${ui['budget.note']}`);
  const fp = trip.flightPayment;
  ul([field('Flight payment', `${fp.currency} ${fp.amount} · ${fp.status} · merchant ${fp.merchant} · ${fp.date} · ${fp.passengers} passengers${rest(fp, ['amount', 'currency', 'status', 'merchant', 'date', 'passengers']).map(r => ' · ' + mdInline(r)).join('')}`),
    field(ui['cash.eyebrow'], `${ui['cash.head']} — ${ui['cash.note']} Cash target €${trip.cashTracker.target} (the app lets you mark it as carried on your device, stored under “${trip.cashTracker.storageKey}”).${rest(trip.cashTracker, ['target', 'storageKey']).map(r => ' ' + mdInline(r)).join('')}`)]);

  h(2, 'Emergency numbers and field guide');
  ul(trip.emergency.map(e => inl(bold(e.number), ` — ${e.label} (${e.href})`, rest(e, ['number', 'label', 'href']).map(r => inl(' · ', r)))));
  p(`${ui['safety.title']} ${ui['safety.eyebrow']}.`);
  ul([1, 2, 3].map(n => inl(bold(`${ui[`field.${n}.kicker`]} — ${ui[`field.${n}.title`]}`), ' ', ui[`field.${n}.body`])));

  h(2, ui['curated.title']);
  p(ui['curated.intro']);
  doc.push({ table: { head: [ui['curated.id'], ui['curated.region'], ui['curated.venue'], ui['curated.tag'], 'Map'], rows: trip.curatedPool.map(c => [c.itemId, c.region, wpName(c.waypointId) + rest(c, ['itemId', 'region', 'tag', 'waypointId']).map(r => ' · ' + mdInline(r)).join(''), c.tag, wp.get(c.waypointId) ? inl(link('Google Maps', wp.get(c.waypointId).googleUrl)) : ''])} });

  h(2, 'Live weather');
  p('The app’s Live weather tab loads a 16-day Open-Meteo forecast for these route hubs when opened; the forecast itself is not part of this static file. To check current conditions, query Open-Meteo for the coordinates below. Mountain alerts in the app flag lows of 2 °C or less or rain chance above 60% at the highland hubs. Forecast data by Open-Meteo (https://open-meteo.com/).');
  ul(hubs.map(hub => inl(bold(hub.name), ` — ${hub.region} · ${hub.lat}, ${hub.lon} · `, link('forecast JSON', `https://api.open-meteo.com/v1/forecast?latitude=${hub.lat}&longitude=${hub.lon}&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset&timezone=auto`))));

  h(2, 'Map waypoints');
  p(`All ${waypoints.length} places on the app’s map (waypoints file version ${waypointsFile.version}). “Days” lists the itinerary days that use each place.`);
  ul(waypoints.map(w => ({
    text: inl(bold(w.name), ` — ${w.category} · ${w.lat}, ${w.lng} · `, link('Google Maps', w.googleUrl)),
    children: compact([
      w.days ? field('Days', Object.entries(w.days).map(([k, v]) => `${k === 'primary' ? '' : k + ': '}${[].concat(v).join(', ')}`).join('; ')) : null,
      field('Payment', w.cash), field('Booking', w.bookingStatus), field('Operating note', w.operatingNote),
      w.aliases && w.aliases.length ? field('Also called', w.aliases.join('; ')) : null,
      field('Pin precision', w.precision), field('Coordinates from', w.coordinateSource), fieldLink('Source', w.sourceUrl),
      ...rest(w, ['id', 'name', 'category', 'lat', 'lng', 'googleUrl', 'days', 'cash', 'bookingStatus', 'operatingNote', 'aliases', 'precision', 'coordinateSource', 'sourceUrl'])
    ])
  })));

  h(2, `Sources (checked ${trip.sourcesChecked})`);
  ul(trip.sources.map(([name, url]) => inl(link(name, url))));
  p(`${ui['footer.version']} · ${ui['footer.built']}`);
  return { doc, firstDay, lastDay };
}

function buildJsonLd(inputs, dates) {
  const { itinerary: trip, waypointsFile, ui, siteUrl } = inputs;
  const wp = new Map(waypointsFile.waypoints.map(point => [point.id, point]));
  const year = String(trip.updated || '').slice(0, 4) || '2026';
  const place = w => ({ '@type': 'Place', name: w.name, geo: { '@type': 'GeoCoordinates', latitude: w.lat, longitude: w.lng }, hasMap: w.googleUrl });
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: `${ui['meta.title']} — ${ui['hero.title1']} ${ui['hero.title2']}`,
    description: ui['hero.deck'],
    url: siteUrl,
    touristType: 'Two adults, self-drive road trip',
    startDate: dates.firstDay,
    endDate: dates.lastDay,
    subjectOf: { '@type': 'DigitalDocument', name: 'Complete trip plan (Markdown)', url: new URL('trip.md', siteUrl).href, encodingFormat: 'text/markdown' },
    itinerary: {
      '@type': 'ItemList',
      itemListElement: trip.routes.primary.days.map((day, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'TouristTrip',
          name: `Day ${day.day} · ${day.heading}`,
          description: `${day.region}. Base: ${day.base}. Drive: ${day.drive}`,
          startDate: isoDate(day.date, year),
          itinerary: { '@type': 'ItemList', itemListElement: [...new Set(inputs.waypointsFile.waypoints.filter(w => w.days && [].concat(w.days.primary || []).includes(day.day)).map(w => w.id))].map((id, i) => ({ '@type': 'ListItem', position: i + 1, item: place(wp.get(id)) })) }
        }
      }))
    },
    subTrip: trip.stays.map(stay => ({
      '@type': 'LodgingReservation',
      reservationId: stay.confirmation,
      reservationStatus: 'https://schema.org/ReservationConfirmed',
      description: `${stay.dates}. ${stay.room}. ${stay.price}. ${stay.payment}`,
      reservationFor: { '@type': 'LodgingBusiness', name: stay.name, address: stay.address, telephone: stay.phone, ...(wp.get(stay.mapWaypointId) ? { geo: place(wp.get(stay.mapWaypointId)).geo } : {}) }
    }))
  };
}

function buildLlmsTxt(inputs, markdownSize) {
  const { itinerary: trip, ui, siteUrl } = inputs;
  const route = trip.routes.primary;
  return `# ${ui['meta.title']}

> ${ui['hero.deck']} Personal six-day self-drive trip plan for two travelers, ${ui['brand.dates'].replace(/^Montenegro · /, '')}: ${route.nightBreakdown.map(n => `${n.base} (${n.nights} nights, ${n.dates})`).join(', then ')}.

The app at ${siteUrl} renders its content with JavaScript. The complete plan as plain text is at the link below; read it to answer questions about this trip.

## Trip plan

- [Complete trip plan](${new URL('trip.md', siteUrl).href}): every day's timetable, drives, food and provisions, stays and bookings, budget, emergency numbers, all map waypoints and sources (${Math.round(markdownSize / 1024)} KB Markdown)
- [Same content, llms-full.txt](${new URL('llms-full.txt', siteUrl).href})

## Raw data

- [itinerary.json](${new URL('itinerary.json', siteUrl).href}): source data for the timeline, food, stays and budget
- [waypoints.json](${new URL('waypoints.json', siteUrl).href}): map places with coordinates

## Days

${route.days.map(d => `- Day ${d.day} · ${d.date}: ${d.heading}`).join('\n')}
`;
}

function buildExports(inputs = loadInputs()) {
  const { doc, firstDay, lastDay } = buildDocument(inputs);
  const markdown = toMarkdown(doc);
  return {
    markdown,
    html: toHtml(doc),
    jsonLd: buildJsonLd(inputs, { firstDay, lastDay }),
    llmsTxt: buildLlmsTxt(inputs, Buffer.byteLength(markdown))
  };
}

module.exports = { buildExports, loadInputs };

if (require.main === module) {
  const out = process.argv[2] || path.join(root, 'dist');
  const { markdown, llmsTxt } = buildExports();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'trip.md'), markdown);
  fs.writeFileSync(path.join(out, 'llms.txt'), llmsTxt);
  process.stdout.write(`Wrote trip.md (${markdown.length} chars) and llms.txt to ${out}\n`);
}
