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

function timetableClause(text) {
  const src = String(text || '').trim();
  let cut = src.length;
  for (const sep of [':', ';', ' — ']) { const i = src.indexOf(sep); if (i > 0 && i < cut) cut = i; }
  const m = /[.!?](\s|$)/.exec(src);
  if (m && m.index > 0 && m.index < cut) cut = m.index;
  let what = src.slice(0, cut).trim();
  let rest = src.slice(cut).replace(/^\s*(?:—|[:;.!?])\s*/, '').trim();
  if (what.length > 70) {
    const head = what.slice(0, 70);
    const sp = head.lastIndexOf(' ');
    const trimmed = (sp > 30 ? head.slice(0, sp) : head).replace(/[\s,;:.–-]+$/, '');
    rest = (what.slice(trimmed.length).trim() + (rest ? ' ' + rest : '')).trim();
    what = trimmed + '…';
  }
  return { what, details: rest };
}
function timetableFoodRow(item) {
  const type = item.type;
  const name = item.name || '';
  const notes = [];
  if (item.hours) notes.push('Hours: ' + item.hours);
  if (item.parking) notes.push('Parking: ' + item.parking);
  if (item.cash) notes.push('Cash: ' + item.cash);
  return {
    when: item.slot || (type === 'coffee' ? 'Coffee' : 'Stock-up'),
    what: name || 'Food stop',
    details: [item.specialty, item.why, item.plan].filter(Boolean).join(' · '),
    notes,
    sourceIds: [item.id || `food:${type}:${name}`],
    period: 'day',
    kind: 'FOOD-' + type
  };
}
function projectTimetable(day) {
  const periods = ['morning', 'afternoon', 'evening'];
  const label = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  const blocks = { morning: [], afternoon: [], evening: [] };
  for (const period of periods) {
    for (const seg of (day && day[period]) || []) {
      const text = String(seg.text || '');
      const prev = blocks[period][blocks[period].length - 1];
      if (seg.type === 'CAUTION') {
        if (prev) { prev.notes.push(text); prev.sourceIds.push(seg.id); continue; }
        blocks[period].push({ when: label[period], what: 'Caution', details: '', notes: [text], sourceIds: [seg.id], period, kind: 'CAUTION' });
        continue;
      }
      const tm = /\b\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\b/.exec(text);
      const { what, details } = timetableClause(text);
      blocks[period].push({ when: tm ? tm[0] : label[period], what: what || seg.type || label[period], details, notes: [], sourceIds: [seg.id], period, kind: seg.type });
    }
  }
  const pre = { morning: [], afternoon: [], evening: [] };
  const post = { morning: [], afternoon: [], evening: [] };
  const tail = [];
  for (const item of foodRows(day && day.food)) {
    const row = timetableFoodRow(item);
    const s = String(item.slot || '').toLowerCase();
    if (item.type === 'coffee' || item.type === 'market' || s.includes('breakfast') || s.includes('morning') || s.includes('stock-up')) post.morning.push(row);
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
    rows.push({ when: '—', what: 'Park / cash', details: '', notes, sourceIds: ['day:' + day.day + ':footer'], period: 'day', kind: 'DAY' });
  }
  return rows;
}
if (typeof module !== 'undefined') module.exports = { projectTimetable, foodRows };
