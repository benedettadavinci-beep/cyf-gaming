// Diagnosi di C-Y-F Gaming: registro degli eventi, errori inviati al server e pannello per il debug.
// Si carica PRIMA del gioco, così cattura anche gli errori di caricamento.
//
// - Ogni errore JavaScript (anche quelli non gestiti delle promesse) viene mandato in forma anonima a /api/errors,
//   con la versione del gioco e lo stato del momento. Massimo 8 invii per pagina, mai due volte lo stesso errore.
// - Il pannello si apre con ?debug=1 nell'indirizzo (resta acceso finché non si apre ?debug=0), con 5 tocchi veloci
//   sul numero di versione nel menu o con il tasto F2. Mostra fps, stato del gioco e della rete, ultimi eventi.
//   "Invia" manda la diagnosi completa al server e mostra un codice da comunicare a Luigi.
// - Il gioco scrive nel registro con CYFDiag.log('rete', 'aperta') e fornisce il suo stato con CYFDiag.state = () => ({...}).
(() => {
  const MAX_LOG = 300, MAX_SENT = 8;
  const t0 = performance.now();
  const logBuf = [], errs = [], sent = new Set();
  let sentCount = 0, panel = null, timer = 0;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  };
  const ver = () => (window.CYF && window.CYF.version) || '?';
  const secs = () => ((performance.now() - t0) / 1000).toFixed(1);
  const short = (s, n) => String(s == null ? '' : s).slice(0, n);
  // il browser in breve, senza dati personali
  const ua = () => {
    const u = navigator.userAgent;
    const os = /Android [\d.]+/.exec(u) || /(iPhone|iPad); CPU [^)]*OS [\d_]+/.exec(u) || /Windows NT [\d.]+|Mac OS X [\d_]+|Linux/.exec(u);
    const br = /(FBAN|FBAV|Instagram|WhatsApp|Telegram|SamsungBrowser|EdgA?|OPR|CriOS|FxiOS|Firefox|Chrome|Version)\/[\d.]+/.exec(u);
    return (os ? os[0] : '?') + ' · ' + (br ? br[0] : '?') + ' · ' + screen.width + '×' + screen.height + '@' + (window.devicePixelRatio || 1);
  };
  const state = () => { try { return D.state ? D.state() : {}; } catch (e) { return { stateError: String(e) }; } };

  function log(cat, text) {
    logBuf.push(secs() + 's [' + cat + '] ' + short(text, 200));
    if (logBuf.length > MAX_LOG) logBuf.shift();
  }

  function post(payload) {
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/errors', new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try { fetch('/api/errors', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {}); } catch (e) {}
  }

  function report(msg, src, stack) {
    msg = short(msg || 'errore sconosciuto', 300);
    src = short(src || '', 160);
    errs.push({ at: secs(), msg, src });
    log('ERRORE', msg + (src ? ' @ ' + src : ''));
    const key = msg + '|' + src;
    if (sent.has(key) || sentCount >= MAX_SENT) return;
    if (/^(chrome|moz|safari)-extension:/.test(src)) return;          // errori delle estensioni del browser, non del gioco
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') return;   // le prove locali non sporcano i dati veri
    sent.add(key); sentCount++;
    post({ ver: ver(), msg, src, stack: short(stack, 1500), ua: ua(), ctx: short(JSON.stringify(state()), 600) });
  }

  window.addEventListener('error', e => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) { report('Risorsa non caricata: ' + (t.tagName || '').toLowerCase(), t.src || t.href, ''); return; }
    const where = (e.filename || '').replace(location.origin, '') + (e.lineno ? ':' + e.lineno + ':' + (e.colno || 0) : '');
    report(e.message, where, e.error && e.error.stack);
  }, true);
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    report('Promise: ' + (r && r.message ? r.message : String(r)), '', r && r.stack);
  });

  // ---------- pannello ----------
  let frames = 0, worst = 0, lastF = 0, fps = 0, avg = 0, acc = 0;
  function tick(now) {
    if (!panel) return;
    if (lastF) { const d = now - lastF; acc += d; frames++; if (d > worst) worst = d; }
    lastF = now;
    requestAnimationFrame(tick);
  }
  function render() {
    if (!panel) return;
    if (frames) { fps = Math.round(1000 * frames / acc); avg = Math.round(acc / frames); }
    const s = state();
    const lines = [
      'v' + ver() + ' · ' + fps + ' fps (' + avg + ' ms, peggiore ' + Math.round(worst) + ' ms)',
      Object.entries(s).filter(([k]) => k !== 'gl').map(([k, v]) => k + ' ' + (typeof v === 'number' ? Math.round(v * 10) / 10 : v)).join(' · '),
      'errori: ' + errs.length + (errs.length ? ' — ultimo: ' + errs[errs.length - 1].msg : ''),
      '—',
      ...logBuf.slice(-8)
    ];
    panel.querySelector('pre').textContent = lines.join('\n');
    frames = 0; acc = 0; worst = 0;
  }
  function snapshot() {
    return { ver: ver(), at: new Date().toISOString(), page: location.pathname, ua: ua(), lang: navigator.language, state: state(), errors: errs, log: logBuf.slice(-120) };
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); return Promise.resolve(ok);
  }
  function openPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'cyfDiag';
    panel.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;max-width:min(96vw,520px);background:rgba(10,18,30,.82);color:#d9f2ff;' +
      'font:11px/1.35 ui-monospace,Consolas,monospace;border-radius:8px;padding:6px 8px;pointer-events:auto';
    panel.innerHTML = '<pre style="margin:0 0 6px;white-space:pre-wrap;word-break:break-word"></pre>' +
      '<button data-a="send">Invia</button> <button data-a="copy">Copia</button> <button data-a="close">Chiudi</button> <span data-a="msg"></span>';
    panel.querySelectorAll('button').forEach(b => { b.style.cssText = 'font:12px system-ui;padding:3px 8px;border-radius:6px;border:0;background:#2f7fd0;color:#fff'; });
    const msg = panel.querySelector('[data-a="msg"]');
    panel.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (a === 'close') { ls.set('cyf.debug', null); closePanel(); }
      if (a === 'copy') copy(JSON.stringify(snapshot(), null, 1)).then(ok => { msg.textContent = ok ? 'copiata' : 'copia non riuscita'; });
      if (a === 'send') {
        const code = Math.random().toString(36).slice(2, 7).toUpperCase();
        const s = snapshot();
        post({ ver: ver(), msg: 'Diagnosi inviata ' + code, src: 'pannello', ua: ua(), ctx: short(JSON.stringify(s.state), 600),
          stack: short(s.errors.map(x => x.at + 's ' + x.msg + ' @ ' + x.src).concat(s.log.slice(-40)).join('\n'), 1500) });
        msg.textContent = 'inviata: codice ' + code;
      }
    });
    document.body.append(panel);
    lastF = 0; requestAnimationFrame(tick);
    timer = setInterval(render, 500);
    log('diagnosi', 'pannello aperto');
  }
  function closePanel() { if (!panel) return; clearInterval(timer); panel.remove(); panel = null; }
  function toggle() { if (panel) { ls.set('cyf.debug', null); closePanel(); } else { ls.set('cyf.debug', '1'); openPanel(); } }

  // 5 tocchi in 3 secondi su un elemento (il numero di versione nel menu)
  function tapToOpen(el) {
    let taps = [];
    el.addEventListener('click', () => {
      const now = Date.now();
      taps = taps.filter(t => now - t < 3000).concat(now);
      if (taps.length >= 5) { taps = []; toggle(); }
    });
  }

  // R-246: da dove arriva questa visita, letto subito (prima che il gioco tolga i parametri dall'indirizzo):
  // sfida (link ?sfida=), batti (link "batti il mio tempo"), portale (?portale= o già in modalità portale), home (dalla
  // pagina iniziale del sito), diretto (tutto il resto). Niente dati personali.
  const fonte = (() => {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('batti')) return 'batti';
      if (q.has('sfida')) return 'sfida';
      if (q.has('portale') && !['0', 'no'].includes(String(q.get('portale')).toLowerCase())) return 'portale';
      if (sessionStorage.getItem('cyf.portale')) return 'portale';
      const r = document.referrer || '';
      if (r && r.indexOf(location.origin + '/') === 0 && r.indexOf('/pista-nera') < 0) return 'home';
    } catch (e) {}
    return 'diretto';
  })();
  // R-232: una volta per pagina, il giocatore (codice anonimo) e il tempo di caricamento, dall'apertura della pagina
  // alla prima immagine del gioco. Servono a contare quanti giocano e quanti tornano. Le prove locali non inviano.
  let visitaFatta = false;
  function visita(id, tel) {
    if (visitaFatta || !id) return;
    visitaFatta = true;
    log('misure', 'caricato in ' + (performance.now() / 1000).toFixed(1) + ' s · fonte ' + fonte);
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') return;
    const body = JSON.stringify({ id, ms: Math.round(performance.now()), tel: tel ? 1 : 0, fonte });
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/visita', new Blob([body], { type: 'application/json' }))) return; } catch (e) {}
    try { fetch('/api/visita', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {}); } catch (e) {}
  }

  const q = new URLSearchParams(location.search).get('debug');
  if (q === '1') ls.set('cyf.debug', '1');
  if (q === '0') ls.set('cyf.debug', null);
  const start = () => { if (ls.get('cyf.debug') === '1') openPanel(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('keydown', e => { if (e.key === 'F2') { e.preventDefault(); toggle(); } });

  log('pagina', location.pathname + ' · ' + ua());
  const D = window.CYFDiag = { log, report, snapshot, toggle, tapToOpen, visita, fonte, state: null, get errors() { return errs.slice(); } };
})();
