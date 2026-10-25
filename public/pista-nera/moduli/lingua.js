// modulo: lingua
// dipende da: base
// Lingua del gioco (it, en, fr, es): scelta iniziale, testi (tr), posizioni in classifica, lunghezze. I testi stanno in i18n.js.
window.PN = window.PN || {};
PN.lingua = (() => {
  const { store } = PN.base;
  // ---------- lingua (italiano, inglese, francese, spagnolo): testi in i18n.js ----------
  const DICT = window.CYF_I18N || { it: {} };
  const LANGS = ['it', 'en', 'fr', 'es'];
  let lang = (() => {
    // ?lang= dall'indirizzo (arriva dalla home), poi la lingua salvata, poi quelle del dispositivo
    let asked = null;
    try { asked = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (LANGS.includes(asked)) return asked;
    const saved = store.get('cyf.lang');
    if (LANGS.includes(saved)) return saved;
    const navs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'it'];
    for (const n of navs) { const c = String(n).slice(0, 2).toLowerCase(); if (LANGS.includes(c)) return c; }
    return 'it';
  })();
  function tr(k, v) {
    let s = (DICT[lang] && DICT[lang][k]) ?? (DICT.it && DICT.it[k]) ?? k;
    if (v) for (const n in v) s = s.split('{' + n + '}').join(v[n]);
    return s;
  }
  // posizione in classifica nella lingua scelta: 1° · 1st · 1er · 1.º
  const enOrd = (typeof Intl !== 'undefined' && Intl.PluralRules) ? new Intl.PluralRules('en', { type: 'ordinal' }) : null;
  const ord = n => {
    if (lang === 'en') return n + ({ one: 'st', two: 'nd', few: 'rd' }[enOrd ? enOrd.select(n) : 'other'] || 'th');
    if (lang === 'fr') return n === 1 ? '1er' : n + 'e';
    if (lang === 'es') return n + '.º';
    return n + '°';
  };
  const fmtLen = m => m >= 1000 ? (Math.round(m / 100) / 10).toLocaleString(lang) + ' km' : Math.round(m) + ' m';
  return { DICT, LANGS, get lang() { return lang; }, setLang(l) { lang = LANGS.includes(l) ? l : 'it'; return lang; }, tr, ord, fmtLen };
})();
