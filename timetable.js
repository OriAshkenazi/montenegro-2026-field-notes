function foodRows(food) {
  if (!food) return [];
  const rows = [
    ...(food.coffee || []).map(x => ({...x, type:'coffee'})),
    ...(food.supermarkets || []).map(x => ({...x, type:'market', slot:'Stock-up'})),
    ...(food.meals || []).map(x => ({...x, type:'meal'}))
  ];
  const rank = x => { const s=(x.slot||'').toLowerCase(); return s.includes('morning') ? 0 : s.includes('breakfast') ? 1 : s.includes('stock-up') ? 2 : s.includes('lunch') ? 3 : s.includes('dinner') ? 4 : 5; };
  return rows.map((x,i)=>({...x,_i:i})).sort((a,b)=>rank(a)-rank(b)||a._i-b._i);
}

const TT_TIP = /\b(confirm|call|carry|cash|bring|reserve|book|do not|don't|never|turn back|shoes|footwear|grippy|deadline|cutoff|cut-off|if closed|check (?:amscg|weather|live)|only if|ask about)\b/i;
const TT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

function foodKey(item) {
  return (item && item.id) || `${item && item.type}:${item && item.name}`;
}
function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function fmtTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function mergeSentencePieces(pieces) {
  const out = [];
  for (const raw of pieces) {
    const p = raw.trim();
    if (!p) continue;
    if (out.length && (/^[0-9a-z)]/.test(p) || /\b(?:St|Mt|Dr|Sv|approx|vs|No|Approx)\.$/.test(out[out.length - 1]))) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out;
}
function manualSentences(src) {
  // Manual equivalent of split(/(?<=[.!?])\s+(?=[A-Z"“(])/) that works without lookbehind support.
  const pieces = [];
  let start = 0;
  const re = /[.!?]+\s+/g;
  let m;
  while ((m = re.exec(src))) {
    const next = src.charAt(m.index + m[0].length);
    if (/[A-Z"“(]/.test(next)) { pieces.push(src.slice(start, m.index + m[0].length)); start = m.index + m[0].length; }
  }
  pieces.push(src.slice(start));
  return pieces;
}
function splitSentences(text) {
  const src = String(text || '').trim();
  if (!src) return [];
  let pieces;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    pieces = Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(src), x => x.segment);
  } else {
    pieces = manualSentences(src);
  }
  return mergeSentencePieces(pieces);
}
function ttTitleCase(s) {
  return String(s || '').toLowerCase().split(/[\s_-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
function ttFoodParts(item) {
  const sentences = [item.specialty, item.why, item.plan].filter(Boolean).flatMap(splitSentences);
  const details = [], notes = [];
  for (const s of sentences) (TT_TIP.test(s) ? notes : details).push(s);
  if (!details.length && notes.length) details.push(notes.shift());
  if (item.hours) notes.push('Hours: ' + item.hours);
  if (item.parking) notes.push('Parking: ' + item.parking);
  if (item.cash) notes.push('Payment: ' + item.cash);
  return { details, notes };
}
function timetableFoodRow(item) {
  const { details, notes } = ttFoodParts(item);
  const row = {
    when: item.slot || (item.type === 'coffee' ? 'Coffee' : 'Stock-up'),
    what: item.name || 'Food stop',
    details, notes,
    sourceIds: [foodKey(item)],
    period: 'day',
    kind: 'FOOD-' + item.type
  };
  if (item.waypointId) row.waypointId = item.waypointId;
  return row;
}
function projectTimetable(day, opts) {
  void opts;
  const periods = ['morning', 'afternoon', 'evening'];
  const blocks = { morning: [], afternoon: [], evening: [] };
  const conflicts = [];
  const foods = foodRows(day && day.food);
  const byKey = new Map(foods.map(f => [foodKey(f), f]));
  const consumed = new Set();
  let cursor = parseTime(day && day.startAt);
  let driveAdjustedMin = 0;
  let prev = null;
  for (const period of periods) {
    for (const seg of (day && day[period]) || []) {
      const text = String(seg.text || '');
      if (seg.type === 'CAUTION' || seg.note === true) {
        if (prev) { prev.notes.push(text); prev.sourceIds.push(seg.id); }
        else {
          prev = { when: TT_LABEL[period], what: seg.title || 'Heads-up', details: [], notes: [text], sourceIds: [seg.id], period, kind: seg.type };
          blocks[period].push(prev);
        }
        continue;
      }
      const fixed = parseTime(seg.fixedAt);
      let start = cursor;
      if (fixed !== null) {
        if (cursor !== null && fixed < cursor - 15) conflicts.push({ id: seg.id, fixedAt: seg.fixedAt, cursor: fmtTime(cursor) });
        start = cursor === null ? fixed : Math.max(cursor, fixed);
      }
      const adj = seg.driveMin && seg.driveMin.adjusted;
      if (typeof adj === 'number') driveAdjustedMin += adj;
      const dur = adj ?? seg.dwellMin ?? 0;
      let when = TT_LABEL[period];
      const row = { when, what: '', details: [], notes: [], sourceIds: [seg.id], period, kind: seg.type };
      const due = parseTime(seg.dueBy);
      if (due !== null) {
        row.notes.push('Deadline: ' + seg.dueBy);
        if (start !== null && start + dur > due) conflicts.push({ id: seg.id, dueBy: seg.dueBy, cursor: fmtTime(start + dur) });
      }
      if (start !== null) {
        const end = start + dur;
        when = dur ? fmtTime(start) + '–' + fmtTime(end) : fmtTime(start);
        row.start = start; row.end = end;
        cursor = end;
      }
      row.when = when;
      let sentences = splitSentences(text);
      if (seg.title) row.what = seg.title;
      else if (sentences.length && sentences[0].length <= 60) row.what = sentences.shift().replace(/[.!?]+$/, '');
      else row.what = ttTitleCase(seg.type) || 'Stop';
      for (const s of sentences) (TT_TIP.test(s) ? row.notes : row.details).push(s);
      if (!row.details.length && row.notes.length && sentences.length) row.details.push(row.notes.shift());
      const f = seg.foodId ? byKey.get(seg.foodId) : null;
      if (f && !consumed.has(seg.foodId)) {
        consumed.add(seg.foodId);
        const { details, notes } = ttFoodParts(f);
        row.details.push(...details);
        row.notes.push(...notes);
        row.sourceIds.push(foodKey(f));
        if (f.waypointId) row.waypointId = f.waypointId;
      }
      blocks[period].push(row);
      prev = row;
    }
  }
  const pre = { morning: [], afternoon: [], evening: [] };
  const post = { morning: [], afternoon: [], evening: [] };
  const tail = [];
  for (const item of foods) {
    if (consumed.has(foodKey(item))) continue;
    const row = timetableFoodRow(item);
    const s = String(item.slot || '').toLowerCase();
    if (item.type === 'market' || s.includes('stock-up')) post.evening.push(row);
    else if (item.type === 'coffee' || s.includes('breakfast') || s.includes('morning')) post.morning.push(row);
    else if (s.includes('lunch')) pre.afternoon.push(row);
    else if (s.includes('dinner')) pre.evening.push(row);
    else tail.push(row);
  }
  const rows = [];
  for (const period of periods) rows.push(...pre[period], ...blocks[period], ...post[period]);
  rows.push(...tail);
  if (day && (day.parking || day.cash)) {
    const notes = [];
    if (day.parking) notes.push('Parking: ' + day.parking);
    if (day.cash) notes.push('Cash: ' + day.cash);
    rows.push({ when: '—', what: 'Park / cash', details: [], notes, sourceIds: ['day:' + day.day + ':footer'], period: 'day', kind: 'DAY' });
  }
  return { rows, conflicts, totals: { driveAdjustedMin } };
}
if (typeof module !== 'undefined') module.exports = { fmt: fmtTime, parse: parseTime, splitSentences, foodKey, projectTimetable, foodRows };
