// modulo: sfida
// dipende da: base, lingua, protocollo, schermate, portale
// "Batti il mio tempo" (R-236, S-44) e immagine del risultato (D-05).
// - Link: …/pista-nera/?batti=<numero della pista del giorno>&t=<tempo in ms>&da=<nome>&c=<città>. Il tempo viaggia nel
//   link e non è controllato dal server (S-44): serve solo a mostrare il tempo da battere, non cambia nessuna classifica.
// - Menu: riquadro "🎯 Marco ti sfida" con Accetta la sfida (e ✕). Se la pista è di un giorno passato il server fa
//   correre quella pista, ma il tempo non entra in classifica (?n= nel collegamento).
// - In gara: riga con il distacco STIMATO (si suppone che l'amico sia andato sempre alla stessa media).
// - Fine gara: "Hai battuto Marco di 3,21 s!" oppure "Marco è ancora davanti…"; Condividi manda testo, link e immagine.
// - Immagine 1080×1080 fatta sul telefono: la scena della gara in quel momento, scurita, con tempo e posizione.
// Si crea con PN.sfida({ stato, schermate, say, foto, accetta }) dal gioco: stato in sola lettura (mode, net, myId, theme,
// racing, serverNow, distM, raceLen); schermate.cityName(scena); foto() disegna la scena e restituisce il canvas del
// gioco; accetta(sfida) parte con la pista del giorno della sfida.
window.PN = window.PN || {};
PN.sfida = ({ stato: S, schermate, say, foto, accetta }) => {
  const { fmtTime } = PN.base;
  const { tr, ord } = PN.lingua;
  const $ = id => document.getElementById(id);
  const MIN_MS = 60000, MAX_MS = 3600000;
  const pulisciNome = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);

  // la sfida arrivata con il link (resta finché la si chiude con ✕ o ne arriva un'altra)
  let sfida = null;
  try {
    const q = new URLSearchParams(location.search);
    const n = parseInt(q.get('batti'), 10), ms = parseInt(q.get('t'), 10), da = pulisciNome(q.get('da'));
    if (n >= 1 && n < 100000 && ms >= MIN_MS && ms <= MAX_MS && da) {
      sfida = { n, ms, da, c: PN.protocollo.SCENE.includes(q.get('c')) ? q.get('c') : '' };
      for (const k of ['batti', 't', 'da', 'c']) q.delete(k);   // tolta dall'indirizzo: resta solo nel menu
      const r = q.toString();
      history.replaceState(null, '', location.pathname + (r ? '?' + r : '') + location.hash);
    }
  } catch (e) {}

  const secondi = ms => (Math.abs(ms) / 1000).toLocaleString(PN.lingua.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' s';
  // sul portale (R-244) i testi non portano il link al nostro sito: al suo posto "su CrazyGames"
  const dove = url => PN.portale.link(url, tr('portalWhere', { p: PN.portale.titolo }));
  const oggi = () => schermate.giorno;   // la pista del giorno di oggi (numero e città), quando è arrivata dal server
  // la sfida vale per la gara in corso? Pista del giorno con lo stesso numero
  const inGioco = () => !!(sfida && S.net.daily && S.net.giorno && S.net.giorno.n === sfida.n);

  // ---------- menu ----------
  function render() {
    const box = $('rivalCard');
    if (!box) return;
    box.hidden = !sfida;
    if (!sfida) return;
    const g = oggi();
    const passata = g ? sfida.n < g.n : false;
    $('rivalWho').textContent = tr('rivalCard', { name: sfida.da });
    $('rivalTrack').textContent = tr('rivalTrack', { n: sfida.n, city: schermate.cityName(sfida.c || (g && g.n === sfida.n ? g.scena : 'neve')), t: fmtTime(sfida.ms) });
    $('rivalPast').hidden = !passata;
  }
  $('btnRivalGo').addEventListener('click', () => { if (sfida) accetta(sfida); });
  $('btnRivalX').addEventListener('click', () => { sfida = null; render(); });

  // ---------- in gara: distacco stimato ----------
  let hudT = 0;
  function hud(dt) {
    const el = $('rival');
    const on = inGioco() && S.mode === 'race';
    if (el.hidden === on) el.hidden = !on;
    if (!on || (hudT += dt) < 0.2) return;
    hudT = 0;
    const tempo = S.net.finished.get(S.myId) ?? Math.max(0, S.serverNow() - S.net.startAt);
    const suo = sfida.ms * Math.min(1, S.distM() / S.raceLen);   // dove sarebbe l'amico, alla sua media
    const d = tempo - suo;
    el.textContent = tr('rivalHud', { name: sfida.da, t: fmtTime(sfida.ms), d: (d < 0 ? '−' : '+') + secondi(d) });
    el.classList.toggle('ahead', d < 0);
  }

  // ---------- risultati ----------
  const mio = () => { const r = S.net.results.find(x => x.id === S.myId); return r && r.ms != null ? r.ms : null; };
  function esito() {
    if (!inGioco()) return null;
    const ms = mio();
    return ms == null ? null : { vinta: ms < sfida.ms, d: Math.abs(ms - sfida.ms), ms };
  }
  function risultati() {
    const el = $('resRival');
    const e = esito();
    el.hidden = !e;
    if (e) {
      el.textContent = tr(e.vinta ? 'rivalWin' : 'rivalLose', { name: sfida.da, d: secondi(e.d) });
      el.classList.toggle('win', e.vinta);
    }
    prepara();
  }

  // ---------- testo, link e immagine ----------
  function dati() {
    const i = S.net.results.findIndex(r => r.id === S.myId);
    const me = i >= 0 ? S.net.results[i] : null;
    const G = S.net.daily && S.net.giorno;
    const city = schermate.cityName(G ? G.scena : S.theme);
    const ms = me && me.ms != null ? me.ms : null;
    if (G) {
      // pista del giorno: si sfida con il migliore di oggi (o con il tempo di questa discesa, per una pista passata)
      const t = G.rivincita ? ms : (G.best != null ? G.best : ms);
      const link = dove(t != null ? location.origin + location.pathname + '?batti=' + G.n + '&t=' + t + '&da=' + encodeURIComponent(S.nome()) + '&c=' + G.scena : location.origin + location.pathname);
      return { G, t, city, link, titolo: tr('dailyTitle', { n: G.n, city }), pos: G.rivincita || !G.rank ? '' : tr('imgDayRank', { p: ord(G.rank), k: G.of || 1 }) };
    }
    const link = dove(location.origin + location.pathname);
    const n = S.net.results.length;
    return { G: null, t: ms, city, link, pos: ms != null ? tr('imgRank', { p: ord(i + 1), k: n }) : '', place: ms != null ? ord(i + 1) : '…',
      titolo: (S.net.pub ? tr('onlineBrand') : tr('challenge')) + ' · ' + city + ' · ' + (S.net.minutes || 5) + ' min' };
  }
  function testo(d) {
    const e = esito();
    if (d.G && e && e.vinta) return tr('shareBeat', { name: sfida.da, n: d.G.n, city: d.city, t: fmtTime(d.t), link: d.link });
    if (d.G && d.G.rivincita) return tr('shareReplay', { n: d.G.n, city: d.city, t: fmtTime(d.t), link: d.link });
    if (d.G) return tr('shareDaily', { n: d.G.n, city: d.city, t: fmtTime(d.t), p: d.G.rank ? ord(d.G.rank) : '…', k: d.G.of || 1, link: d.link });
    return tr(S.theme === 'neve' ? 'shareResultSnow' : 'shareResult', { p: d.place, city: d.city, t: fmtTime(d.t), link: d.link });
  }

  // immagine 1080×1080 (D-05): la scena di adesso, scurita, con le scritte. Se la scena non si può leggere, uno sfondo blu
  function immagine(d) {
    const W = 1080, c = document.createElement('canvas');
    c.width = c.height = W;
    const g = c.getContext('2d');
    const sf = g.createLinearGradient(0, 0, 0, W); sf.addColorStop(0, '#2f7fd0'); sf.addColorStop(1, '#0c1828');
    g.fillStyle = sf; g.fillRect(0, 0, W, W);
    try {
      const v = foto();
      const k = Math.max(W / v.width, W / v.height), w = v.width * k, h = v.height * k;
      g.drawImage(v, (W - w) / 2, (W - h) / 2, w, h);
    } catch (e) {}
    const sc = g.createLinearGradient(0, 0, 0, W);
    sc.addColorStop(0, 'rgba(12,24,40,.78)'); sc.addColorStop(0.45, 'rgba(12,24,40,.35)'); sc.addColorStop(1, 'rgba(12,24,40,.85)');
    g.fillStyle = sc; g.fillRect(0, 0, W, W);
    const DISP = '"Rubik Mono One", "Arial Black", Impact, sans-serif', BODY = '"Barlow Condensed", "Arial Narrow", sans-serif';
    const riga = (t, y, font, col, max = W - 120) => { g.font = font; g.fillStyle = col; g.textAlign = 'center'; g.fillText(t, W / 2, y, max); };
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 12;
    riga('C-Y-F GAMING', 110, '700 40px ' + BODY, '#d6e7f3');
    riga('PISTA NERA', 200, '84px ' + DISP, '#ff5a1f');
    riga(d.titolo, 300, '700 54px ' + BODY, '#ffffff');
    riga(d.t != null ? fmtTime(d.t) : '—', 540, '150px ' + DISP, '#ffffff');
    if (d.pos) riga(d.pos, 640, '700 64px ' + BODY, '#ffb08a');
    const e = esito();
    if (d.G && e) riga(tr(e.vinta ? 'imgBeat' : 'imgLost', { name: sfida.da, d: secondi(e.d) }), 730, '700 52px ' + BODY, e.vinta ? '#7ee2a1' : '#ffd0c2');
    riga(tr('imgCall'), 900, '56px ' + DISP, '#ffffff');
    riga(location.host + location.pathname, 980, '600 36px ' + BODY, '#d6e7f3');
    return new Promise(ok => { try { c.toBlob(b => ok(b), 'image/png'); } catch (x) { ok(null); } });
  }
  // l'immagine si prepara appena compaiono i risultati: al tocco su Condividi è già pronta, così il telefono non
  // considera la condivisione "non chiesta dal giocatore" (Safari la permette solo subito dopo il tocco)
  let pronta = null, chiave = '';
  function prepara() {
    const d = dati();
    const k = [S.net.round, S.net.results.length, d.t, d.pos, PN.lingua.lang, esito() ? 1 : 0].join('|');
    if (k !== chiave || !pronta) { chiave = k; pronta = immagine(d).catch(() => null); }
    return pronta;
  }
  const nomeFile = d => 'pista-nera' + (d.G ? '-giorno-' + d.G.n : '') + (d.t != null ? '-' + fmtTime(d.t).replace(/[:.]/g, '-') : '') + '.png';

  async function condividi() {
    const d = dati();
    const txt = testo(d);
    // telefoni che condividono anche i file (Android con Chrome, iPhone con Safari): testo e immagine insieme
    try {
      const b = navigator.canShare ? await prepara() : null;
      const f = b && new File([b], nomeFile(d), { type: 'image/png' });
      if (f && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: txt }); return; }
      if (navigator.share) { await navigator.share({ text: txt }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  }
  // pulsante 🖼️ Immagine: si condivide se si può, altrimenti si scarica
  async function salvaImmagine() {
    const d = dati();
    const b = await prepara();
    if (!b) { say(tr('imgErr'), '#d8302a'); return; }
    const f = new File([b], nomeFile(d), { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = f.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $('btnShareRes').addEventListener('click', condividi);
  $('btnImgRes').addEventListener('click', salvaImmagine);

  return { render, hud, risultati, condividi, get sfida() { return sfida; }, get attiva() { return inGioco(); } };
};
