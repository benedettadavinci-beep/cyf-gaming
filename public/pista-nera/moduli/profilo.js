// modulo: profilo
// dipende da: base, lingua
// Impostazioni ricordate dal server con un codice personale (R-226, S-35): nome, lingua, città, maglia e capelli.
// Le impostazioni restano anche sul dispositivo (localStorage), così il gioco funziona pure senza server; il profilo
// sul server serve a ritrovarle su un altro telefono o PC. Il codice personale (8 caratteri) è la chiave del profilo:
// non coincide con il codice del giocatore che gli altri vedono in gara.
// Si crea con PN.profilo({ myId, aggiorna, say }) dal gioco:
//   myId è il codice del giocatore; aggiorna() rilegge le impostazioni salvate e le mostra (menu, rider, lingua, città);
//   say(testo, colore) mostra un avviso.
// salva() va chiamata solo quando è il giocatore a cambiare qualcosa: segna l'ora del cambio e manda il profilo al server.
window.PN = window.PN || {};
PN.profilo = ({ myId, aggiorna, say }) => {
  const { store } = PN.base;
  const { tr } = PN.lingua;
  const $ = id => document.getElementById(id);
  // dove stanno le impostazioni sul dispositivo
  const KEYS = { name: 'cyf.name', lang: 'cyf.lang', scena: 'cyf.scena', j: 'cyf.jersey', h: 'cyf.hair' };
  const pulisci = c => { const v = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-HJ-NP-Z2-9]{8}$/.test(v) ? v : ''; };
  const mostra = c => c.slice(0, 4) + '-' + c.slice(4);
  let code = pulisci(store.get('cyf.codice'));
  let timer = 0;
  const localAt = () => +(store.get('cyf.profiloAt') || 0);

  function raccogli() {
    const d = {};
    for (const k in KEYS) d[k] = store.get(KEYS[k]) || '';
    return d;
  }
  // scrive sul dispositivo le impostazioni arrivate dal server; nome, lingua e città vuoti non cancellano quelli che ci sono
  function scrivi(d) {
    d = d || {};
    for (const k of ['name', 'lang', 'scena']) if (d[k]) store.set(KEYS[k], d[k]);
    for (const k of ['j', 'h']) if (typeof d[k] === 'string') store.set(KEYS[k], d[k]);
  }
  function render() {
    $('profCode').textContent = code ? mostra(code) : tr('profNone');
    $('profCode').style.fontSize = code ? '' : '14px'; $('profCode').style.whiteSpace = code ? 'nowrap' : 'normal';
    $('btnProfCopy').hidden = !code;
  }
  function messaggio(t) { $('profMsg').hidden = !t; $('profMsg').textContent = t || ''; }

  async function invia() {
    const data = raccogli();
    if (!data.name) return;   // il profilo nasce solo quando c'è un nome (S-35)
    try {
      const res = await fetch('/api/profilo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: myId, code, data }) });
      const r = await res.json();
      if (!res.ok || !r.code) return;
      if (r.code !== code) { code = r.code; store.set('cyf.codice', code); render(); }
      store.set('cyf.profiloAt', String(r.at || Date.now()));
    } catch (e) { /* senza rete restano le impostazioni sul dispositivo; si riprova al prossimo cambio o caricamento */ }
  }
  // il giocatore ha cambiato qualcosa: dopo un attimo (più cambi insieme diventano un invio solo) va al server
  function salva() {
    store.set('cyf.profiloAt', String(Date.now()));
    clearTimeout(timer);
    timer = setTimeout(invia, 1200);
  }
  // all'apertura: se il server ha impostazioni più recenti (cambiate da un altro dispositivo) si usano quelle
  async function avvio() {
    render();
    if (!code) { invia(); return; }
    try {
      const res = await fetch('/api/profilo?code=' + code, { cache: 'no-store' });
      if (res.status === 404) { code = ''; store.set('cyf.codice', ''); render(); invia(); return; }
      if (!res.ok) return;
      const p = await res.json();
      if ((p.at || 0) > localAt()) { scrivi(p.data); store.set('cyf.profiloAt', String(p.at)); aggiorna(); }
      else if (localAt() > (p.at || 0)) invia();
    } catch (e) {}
  }
  // "Hai già un codice?": questo dispositivo diventa lo stesso giocatore (stessi punti) con le sue impostazioni
  async function usa(testo) {
    const c = pulisci(testo);
    if (!c) { messaggio(tr('profBad')); return; }
    try {
      const res = await fetch('/api/profilo?code=' + c, { cache: 'no-store' });
      if (res.status === 404 || res.status === 400) { messaggio(tr('profBad')); return; }
      if (!res.ok) { messaggio(tr('profOffline')); return; }
      const p = await res.json();
      if (p.id) store.set('cyf.id', p.id);
      store.set('cyf.codice', c);
      scrivi(p.data);
      store.set('cyf.profiloAt', String(p.at || Date.now()));
      messaggio('');
      say(tr('profLoaded'), '#1f9d4c');
      setTimeout(() => location.reload(), 700);   // si riparte con il codice del giocatore ritrovato
    } catch (e) { messaggio(tr('profOffline')); }
  }

  $('btnProfUse').addEventListener('click', () => usa($('inProfCode').value));
  $('inProfCode').addEventListener('keydown', e => { if (e.key === 'Enter') usa($('inProfCode').value); });
  $('btnProfCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(mostra(code)); $('btnProfCopy').textContent = tr('profCopied'); setTimeout(() => { $('btnProfCopy').textContent = tr('profCopy'); }, 1500); } catch (e) {}
  });

  return { salva, avvio, render, usa, raccogli, get code() { return code; } };
};
