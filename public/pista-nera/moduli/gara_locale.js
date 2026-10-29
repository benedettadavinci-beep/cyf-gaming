// modulo: gara_locale
// dipende da: protocollo, gara
// Allenamento uguale alla gara (R-519, seconda parte, dalla 0.28.0): sul telefono, senza server, una gara vera contro i
// 3 avversari del computer con lo STESSO codice della gara online. Qui c'è un "server finto": un oggetto che si comporta
// come il WebSocket della stanza (readyState, send, close) e che risponde con gli stessi messaggi del server vero
// (countdown, go, finished, results), così game.js, bot.js, oggetti.js e schermate.js non sanno la differenza.
// Via: 3-2-1 appena la pista è caricata (niente attesa della sala, niente "Sono pronto"). Traguardo: LUNGHEZZA m.
// Il tempo lo misura questo oggetto con l'orologio del dispositivo (offset 0). Gli avversari li guida questo dispositivo
// (pilota = il giocatore, come in gara quando si è soli) e corrono fino al traguardo; chi è ancora in pista quando il
// giocatore arriva ha il tempo stimato dalla sua velocità media, come fa il server (shared/gara.js). Nessuno guadagna
// punti collezionati (sono del server: earned = null per tutti, come per gli avversari). Niente vite (S-53, ripiego).
// Si crea con PN.garaLocale({ myId, onMsg, diag }) dal gioco; ws() dà l'oggetto da mettere in net.ws, avvia({ me, scena,
// seed }) manda il primo "countdown". "start" (Ricomincia dai risultati) fa ripartire una gara nuova con un seme nuovo.
window.PN = window.PN || {};
PN.garaLocale = ({ myId, onMsg, diag }) => {
  const { MAX_PLAYERS, NOMI_BOT } = PN.protocollo;
  const G = PN.gara;
  const LUNGHEZZA = 2000;                   // metri fino al traguardo in allenamento (R-519)
  const MINUTI = 2;                         // "2 min" nei titoli: la durata che corrisponde ai 2 km
  const CONTO_MS = 3000;                    // 3-2-1 (in gara 5 s dopo l'attesa della sala)
  const ATTESA_MAX_MS = 4000;               // se "loaded" non arriva (pagina lenta) si parte lo stesso dopo 4 s
  const TEMPO_MAX_MS = 6 * 60 * 1000;       // chi non arriva entro 6 minuti (2 km anche frenando sono ~3,5 min) è "non arrivato"
  const LIVELLI = ['forte', 'medio', 'lento'];
  const CODICE = 'ALLENAMENTO';
  let st = null, timer = 0, timeoutT = 0, timeoutAt = 0, round = 0, chiuso = false;
  const log = m => { if (diag && diag.log) diag.log('rete', 'locale: ' + m); };
  // i messaggi arrivano al gioco al giro successivo, come dalla rete: così "results" non interrompe a metà chi ha appena
  // mandato "finish" (in game.js dopo l'invio si scrive ancora il banner "aspetta gli altri")
  const manda = m => { if (!chiuso) setTimeout(() => { if (!chiuso) onMsg(m); }, 0); };
  const creaBot = (n, racers) => {
    const usati = new Set(racers.map(r => r.color)), nomi = new Set(racers.map(r => r.name.toLowerCase()));
    const liberi = NOMI_BOT.filter(x => !nomi.has(x.toLowerCase())).sort(() => Math.random() - 0.5);
    const out = [];
    for (let i = 0; i < n; i++) {
      let color = 0; while (usati.has(color) && color < MAX_PLAYERS) color++;
      usati.add(color);
      out.push({ id: 'botL' + round + 'x' + i + Math.random().toString(36).slice(2, 7), name: liberi[i % liberi.length] || 'Rider', color: color % MAX_PLAYERS, j: '', h: '', p: '', e: '', s: '', bot: 1, lv: LIVELLI[i % LIVELLI.length] });
    }
    return out;
  };
  function nuovaGara(me, scena, seed) {
    clearTimeout(timer); clearTimeout(timeoutT);
    round++;
    const racers = [{ id: myId, name: me.name, color: me.color || 0, j: me.j || '', h: me.h || '', p: me.p || '', e: me.e || '', s: me.s || '' }];
    racers.push(...creaBot(3, racers));
    st = { me, scena, seed: seed || ((Math.random() * 2 ** 31) | 0), racers, startAt: 0, results: [], botUltimo: new Map(), stats: new Map(), fase: 'countdown' };
    const now = Date.now();
    log('gara ' + round + ', seme ' + st.seed);
    manda({ t: 'countdown', now, seed: st.seed, startAt: 0, gatherUntil: now + ATTESA_MAX_MS, loaded: [], ready: [], pilota: myId, racers: st.racers, length: LUNGHEZZA, minutes: MINUTI, round, scena, giorno: null });
    timer = setTimeout(via, ATTESA_MAX_MS);
  }
  function via() {
    if (!st || st.startAt) return;
    clearTimeout(timer);
    const now = Date.now();
    st.startAt = now + CONTO_MS;
    timeoutAt = st.startAt + TEMPO_MAX_MS;
    manda({ t: 'go', now, startAt: st.startAt, loaded: [myId] });
    timeoutT = setTimeout(() => fine(), timeoutAt - now);
  }
  const statsDi = (id, m) => ({ top: +m.top || 0, tk: +m.tk || 0, p: Math.max(0, Math.round(+m.p || 0)) });
  function arrivo(id, m) {
    if (!st || st.fase !== 'countdown' || !st.startAt) return;
    const r = st.racers.find(x => x.id === id);
    if (!r || st.results.some(x => x.id === id)) return;
    const now = Date.now();
    if (now < st.startAt) return;
    const ms = now - st.startAt, valid = ms >= G.tempoMinimoMs(LUNGHEZZA), s = statsDi(id, m);
    st.results.push({ id, name: r.name, color: r.color, ms: valid ? ms : null, dnf: !valid, top: s.top, tk: s.tk, p: s.p, ...(r.bot ? { bot: 1 } : {}) });
    manda({ t: 'finished', id, ms: valid ? ms : null });
    if (id === myId) fine();   // come in gara: quando le persone sono tutte arrivate, i risultati
  }
  function fine() {
    if (!st || st.fase !== 'countdown') return;
    clearTimeout(timeoutT);
    const now = Date.now(), minMs = G.tempoMinimoMs(LUNGHEZZA);
    for (const r of st.racers) {
      if (st.results.some(x => x.id === r.id)) continue;
      const s = st.stats.get(r.id) || { top: 0, tk: 0, p: 0 };
      const u = r.bot ? st.botUltimo.get(r.id) : null;
      const ms = u && st.startAt ? G.stimaArrivo(u.z, now - st.startAt, LUNGHEZZA, minMs, TEMPO_MAX_MS) : null;
      st.results.push({ id: r.id, name: r.name, color: r.color, ms, dnf: ms == null, top: s.top, tk: s.tk, p: s.p, ...(r.bot ? { bot: 1 } : {}) });
    }
    const { awards } = G.classifica(st.results, { senzaPunti: true });
    st.fase = 'results';
    log('risultati: ' + st.results.map(r => r.name + ' ' + (r.ms == null ? '–' : r.ms)).join(', '));
    manda({ t: 'results', results: st.results, awards, round, minutes: MINUTI, giorno: null, gp: null });
  }
  // i messaggi che il gioco manda al "server"
  function ricevi(m) {
    if (!st) return;
    if (m.t === 'loaded' || m.t === 'pronto') { if (st.fase === 'countdown' && !st.startAt) via(); return; }
    if (m.t === 'finish') { arrivo(myId, m); return; }
    if (m.t === 'botfinish') { arrivo(String(m.id || ''), m); return; }
    if (m.t === 'bots' && Array.isArray(m.b)) { for (const e of m.b) if (e && e.id) { st.botUltimo.set(e.id, e); st.stats.set(e.id, statsDi(e.id, e)); } return; }
    if (m.t === 'pos') { st.stats.set(myId, statsDi(myId, m)); return; }
    if (m.t === 'start') { if (st.fase === 'results') nuovaGara(st.me, st.scena, 0); return; }
    // pos, throw, drop, hit, jersey, voice…: in gara il server li inoltra agli altri; qui gli altri sono gli avversari del
    // computer guidati da questo stesso dispositivo, che li hanno già visti
  }
  const ws = {
    readyState: 1,
    send(s) { let m; try { m = JSON.parse(s); } catch (e) { return; } if (m && typeof m === 'object') ricevi(m); },
    close() { chiuso = true; ws.readyState = 3; clearTimeout(timer); clearTimeout(timeoutT); st = null; log('chiusa'); }
  };
  return {
    ws: () => ws,
    get codice() { return CODICE; },
    get lunghezza() { return LUNGHEZZA; },
    avvia({ me, scena, seed }) { chiuso = false; ws.readyState = 1; nuovaGara(me, scena, seed); },
    get stato() { return st; }
  };
};
