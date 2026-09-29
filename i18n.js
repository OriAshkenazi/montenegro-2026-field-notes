// Live EN (LTR) / HE (RTL) localization. Data stays English; translation happens only at render boundaries.
// Globals: t (UI string), tc (itinerary content, sentence-level), tr (timetable fragments), bidi, bidiText, bidiRuns, getLang, setLang, onLangChange, i18nReady, applyStatic.
// The content translator is `tc` (not `L`) because Leaflet owns window.L in the browser; in non-browser hosts (tests) `L` is aliased to `tc`.
(() => {
  const LANG_KEY = 'mne-lang', dict = { en: {}, he: {} }, listeners = [], memo = new Map();
  let content = {}, heAliases = {}, hasContent = false, heOk = true, lang = detect();
  // Hebrew is the primary language; English only when the traveler picked it.
  function detect() {
    try { if (localStorage.getItem(LANG_KEY) === 'en') return 'en'; } catch (e) { /* storage blocked */ }
    return 'he';
  }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function t(key, vars, fallback) {
    let s = dict[lang] && dict[lang][key];
    if (s == null) s = dict.en[key];
    if (s == null) s = fallback != null ? fallback : key;
    return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
  }
  // Hebrew content is keyed by the English sentence as produced by splitSentences (timetable.js).
  function tc(text) {
    if (lang !== 'he' || !hasContent || typeof text !== 'string' || !text) return text;
    if (memo.has(text)) return memo.get(text);
    let out = content[text];
    if (out == null) out = splitSentences(text).map(s => (content[s] != null ? content[s] : s)).join(' ');
    memo.set(text, out);
    return out;
  }
  function tr(fragment) {
    if (lang !== 'he' || !fragment) return fragment;
    const s = String(fragment);
    if (hasContent) {
      if (content[s] != null) return content[s];
      for (const p of ['.', '!', '?']) if (content[s + p] != null) return content[s + p].replace(/[.!?]+$/, '');
    }
    const lit = dict.he['tt.lit.' + s];
    if (lit != null) return lit;
    const m = /^(Hours|Parking|Payment|Cash|Deadline): ([\s\S]*)$/.exec(s);
    if (m) return t('tt.pre.' + m[1]) + ': ' + tc(m[2]);
    return tc(s);
  }
  // Latin/digit runs (codes, phones, times, amounts, Latin place names) are isolated left-to-right inside RTL text.
  // A token is a space-free Latin/number unit (M-8, 08:00–01:00, €1.20/hour, Risan/Lipci). In a Hebrew
  // sentence separate tokens already read in the right order, so tokens are only merged into one LTR run
  // when the phrase itself must read left-to-right: multi-word names, phone numbers and number+unit measures.
  const CH = 'A-Za-z0-9\\u00C0-\\u024F\\u1E00-\\u1EFF', RUN = new RegExp(`[~≈+€₪$£#]?[${CH}]+(?:[.:,\\-–—/'’%°@&+\\uE000-\\uF8FF]{1,2}[${CH}]+)*[%°]?`, 'g');
  const PHONE = /\+\d[\d ]{6,}\d/g, UNIT = /^(?:h|hr|hrs|min|mins|km|m|kg|cm|kph|km\/h)$/, WORD = /^[A-Za-zÀ-ɏḀ-ỿ][A-Za-zÀ-ɏḀ-ỿ'’.&-]*$/, NUM = /^[~≈+€₪$£#]?\d[\d.,:–-]*$/;
  function joinable(a, b) { return (WORD.test(a) && WORD.test(b)) || (NUM.test(a) && UNIT.test(b)) || (UNIT.test(a) && NUM.test(b)); }
  function bidiRuns(text) {
    const src = String(text), phones = [], tokens = [];
    let m;
    for (const re = new RegExp(PHONE.source, 'g'); (m = re.exec(src));) phones.push([m.index, m.index + m[0].length]);
    for (const re = new RegExp(RUN.source, 'g'); (m = re.exec(src));) {
      const a = m.index, b = a + m[0].length;
      if (!phones.some(([x, y]) => a < y && b > x)) tokens.push([a, b]);
    }
    const runs = [];
    for (const [a, b] of tokens) {
      const last = runs[runs.length - 1];
      if (last && src.slice(last[1], a) === ' ' && joinable(src.slice(last[2], last[1]), src.slice(a, b))) { last[1] = b; last[2] = a; }
      else runs.push([a, b, a]);
    }
    return [...phones, ...runs.map(([a, b]) => [a, b])].sort((x, y) => x[0] - y[0]);
  }
  function bidi(html) {
    if (lang !== 'he' || !html) return html;
    return String(html).replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
      if (tag) return tag;
      const ents = [], s = text.replace(/→/g, '←').replace(/&#?\w+;/g, e => { ents.push(e); return String.fromCharCode(0xE000 + ents.length - 1); });
      let out = '', last = 0;
      for (const [a, b] of bidiRuns(s)) { out += `${s.slice(last, a)}<bdi dir="ltr">${s.slice(a, b)}</bdi>`; last = b; }
      out += s.slice(last);
      return out.replace(/[-]/g, c => ents[c.charCodeAt(0) - 0xE000]);
    });
  }
  // Text-only variant of bidi() for textContent/aria strings: isolates Latin/digit runs with LRI..PDI.
  function bidiText(text) {
    if (lang !== 'he' || !text) return text;
    const s = String(text).replace(/→/g, '←');
    let out = '', last = 0;
    for (const [a, b] of bidiRuns(s)) { out += `${s.slice(last, a)}⁦${s.slice(a, b)}⁩`; last = b; }
    return out + s.slice(last);
  }
  function applyAttrs() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = lang; root.dir = lang === 'he' ? 'rtl' : 'ltr'; root.setAttribute('data-lang', lang);
    document.querySelectorAll('.lang-switch [data-lang]').forEach(b => { b.setAttribute('aria-checked', String(b.dataset.lang === lang)); b.tabIndex = b.dataset.lang === lang ? 0 : -1; });
  }
  function applyStatic() {
    applyAttrs();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const s = t(el.dataset.i18n);
      if (lang === 'he' && el.tagName !== 'TITLE' && /[A-Za-z0-9]/.test(s)) el.innerHTML = bidi(esc(s)); else el.textContent = s;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = bidi(t(el.dataset.i18nHtml)); });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
      const i = pair.indexOf(':');
      if (i > 0) el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
    }));
  }
  function setLang(next) {
    if ((next !== 'en' && next !== 'he') || (next === 'he' && !heOk)) return;
    lang = next;
    try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* storage blocked */ }
    memo.clear();
    applyStatic();
    listeners.slice().forEach(fn => { try { fn(next); } catch (e) { console.error(e); } });
  }
  const getLang = () => lang;
  const onLangChange = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
  const load = url => fetch(url).then(r => { if (!r.ok) throw new Error(`Locale request returned ${r.status}.`); return r.json(); });
  let i18nReady;
  try {
    i18nReady = Promise.all([
      load('./locales/en.json?rev=2026-09-29k').catch(() => null),
      load('./locales/he.json?rev=2026-09-29k').catch(() => null)
    ]).then(([en, he]) => {
      if (en && en.ui) dict.en = en.ui;
      if (he && he.ui) { dict.he = he.ui; content = he.content || {}; heAliases = he.aliases || {}; hasContent = Object.keys(content).length > 0; } else heOk = false;
      if (lang === 'he' && !heOk) lang = 'en';
      memo.clear();
      applyAttrs();
    }).finally(() => { if (typeof document !== 'undefined') document.documentElement.classList.add('i18n-ready'); });
  } catch (e) { heOk = false; lang = 'en'; i18nReady = Promise.resolve(); }
  // Hebrew phrasings that wrap a Latin place name (e.g. "שדה התעופה Tivat") keep map links pointing at the specific waypoint.
  const placeAliases = id => (lang === 'he' && heAliases[id]) || [];
  Object.assign(globalThis, { t, tc, placeAliases, tr, bidi, bidiText, bidiRuns, getLang, setLang, onLangChange, i18nReady, applyStatic });
  if (typeof window === 'undefined' && typeof globalThis.L === 'undefined') globalThis.L = tc;
})();
