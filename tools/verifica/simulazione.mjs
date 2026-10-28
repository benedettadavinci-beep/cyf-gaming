// Simulazione di carico del server delle gare (src/stanza.mjs) con molti giocatori insieme, contro wrangler dev
// (o un altro server con BASE=…). Non è una prova del cancello: dice che cosa succede con N persone collegate nello
// stesso momento in più gare, e misura il ritardo con cui le posizioni arrivano agli altri, i messaggi persi, chi
// resta fuori dalle sale e quanto il server impiega a chiudere la gara e a scrivere la classifica.
//
//   node tools/verifica/simulazione.mjs                 50 giocatori, modalità "sfida": sale da 7-8 con un 9° di troppo
//   node tools/verifica/simulazione.mjs --modo=online   50 giocatori che premono "Online" nello stesso secondo (/api/quick)
//   --n=50 giocatori, --sala=8 posti per sala (sfida), --gara=200 secondi di gara di chi va a velocità media (i più lenti
//   ci mettono fino a 235 s), --hz=10 posizioni al secondo, --bots=0 avversari del software per sala (sfida),
//   --ritmo=0 ms tra un arrivo e l'altro (online), --imbroglione=1 il primo giocatore arriva prima del limite fisico,
//   --solo-ingresso=1 (online) si ferma dopo l'ingresso nelle sale, senza correre
//
// Il server misura il tempo e scarta gli arrivi più veloci del limite fisico (4.200 m / 24 m/s = 175 s): per avere
// tempi validi la gara dura almeno --gara secondi (175 + qualche secondo). Il server locale non è la rete di Cloudflare:
// i ritardi misurati qui dicono se la logica regge, non quanto è veloce la rete vera.
import '../../public/shared/protocollo.js';
const PROTO = globalThis.CYF_PROTOCOLLO;
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const WS = BASE.replace(/^http/, 'ws');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const N = Number(arg('n', 50)), SALA = Number(arg('sala', 8)), GARA_S = Number(arg('gara', 200)), HZ = Number(arg('hz', 10));
const MODO = arg('modo', 'sfida'), BOTS = Number(arg('bots', 0)), RITMO = Number(arg('ritmo', 0)), IMBROGLIONE = arg('imbroglione', '1') === '1';
const SOLO_INGRESSO = arg('solo-ingresso', '0') === '1';   // online: si ferma dopo l'ingresso nelle sale (per provare solo /api/quick)
const W = Number(process.env.ATTESA_SFIDA_MS) || 25000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const log = s => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + ' s  ' + s);
const api = async p => { const r = await fetch(BASE + p); let b = null; try { b = await r.json(); } catch (e) {} return { status: r.status, body: b }; };
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const ms1 = v => (v == null ? '-' : Math.round(v) + ' ms');
const massimo = arr => (arr.length ? arr.reduce((a, b) => (b > a ? b : a), -Infinity) : null);   // Math.max(...arr) sbaglia con centinaia di migliaia di valori

// ritardo del server: il mittente mette nella x i millisecondi del suo orologio modulo 100.000 (la x vera non serve alla
// simulazione), chi riceve calcola la differenza. Tutti i client girano nello stesso processo, quindi l'orologio è uno solo.
const stamp = () => Date.now() % 100000;
const lag = x => ((Date.now() % 100000) - x + 100000) % 100000;

class Giocatore {
  constructor(code, i) {
    this.code = code; this.i = i; this.id = 'sim' + i + 'x' + code.toLowerCase(); this.name = 'Sim' + String(i).padStart(2, '0');
    this.msgs = { pos: 0, lobby: 0, altri: 0 }; this.lags = []; this.closed = null; this.waiters = [];
    this.events = {};                      // tipo → quando è arrivato (ms dall'inizio)
    this.vel = 0.85 + (i % 10) * 0.03;     // ognuno va a una velocità diversa: arrivi scaglionati
    if (i === 0 && IMBROGLIONE) this.vel = 1.4;   // il primo giocatore "arriva" più veloce del limite fisico: il server deve scartarlo
  }
  connect(path = '/api/room/') {
    return new Promise((res, rej) => {
      const t = Date.now();
      this.ws = new WebSocket(WS + path + this.code);
      this.ws.onopen = () => { this.tConn = Date.now() - t; this.send({ t: 'hello', v: PROTO.VERSIONE, id: this.id, name: this.name, j: 'rossa', sc: 'roma' }); res(); };
      this.ws.onmessage = ev => {
        if (ev.data === 'pong') return;
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'pos') { this.msgs.pos++; if (typeof m.x === 'number') this.lags.push(lag(m.x)); return; }
        if (m.t === 'lobby') { this.msgs.lobby++; this.lobby = m; } else this.msgs.altri++;
        if (!(m.t in this.events)) this.events[m.t] = Date.now() - t0;
        if (m.t === 'welcome') this.welcome = m;
        if (m.t === 'countdown') { this.countdown = m; this.send({ t: 'loaded' }); }
        if (m.t === 'go') this.startAt = m.startAt;
        if (m.t === 'results') this.results = m;
        if (m.t === 'full') this.full = true;
        for (const w of [...this.waiters]) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); }
      };
      this.ws.onclose = ev => { this.closed = { code: ev.code, reason: ev.reason, at: Date.now() - t0 }; };
      this.ws.onerror = e => { this.err = String(e && e.message || e); rej(e); };
    });
  }
  send(m) { try { this.ws.send(JSON.stringify(m)); } catch (e) { this.errSend = (this.errSend || 0) + 1; } }
  wait(pred, ms) {
    const gia = pred.giaArrivato && pred.giaArrivato(this);
    if (gia) return Promise.resolve(gia);
    return new Promise(res => { const w = { pred, res }; this.waiters.push(w); setTimeout(() => { if (this.waiters.includes(w)) { this.waiters.splice(this.waiters.indexOf(w), 1); res(null); } }, ms); });
  }
  // corre: posizioni a HZ al secondo dal via, arrivo quando ha percorso la lunghezza (velocità media 14 m/s × vel)
  async corri(lengthM) {
    while (!this.startAt && !this.closed) await sleep(100);
    if (this.closed) return;
    const dt = 1000 / HZ, vmed = (lengthM / GARA_S) * this.vel;   // m/s medi di questo giocatore
    let z = 0, n = 0;
    while (!this.closed) {
      const el = (Date.now() - this.startAt) / 1000;
      if (el >= 0) {
        z = Math.min(lengthM, el * vmed);
        this.send({ t: 'pos', x: stamp(), z, y: 0, a: 0, s: 0, f: 0, g: 0, v: vmed, c: 0, k: 0, p: n % 7 === 0 ? 10 : 0 });
        n++;
        if (z >= lengthM) { this.send({ t: 'finish', top: 19.7, tk: 3, p: 120 }); this.inviati = n; this.tFinish = Date.now() - t0; return; }
      }
      await sleep(dt);
    }
  }
  close() { try { this.ws.close(1000); } catch (e) {} }
}

// lag del ciclo del processo della simulazione: se è alto, è il client che rallenta, non il server
let loopLagMax = 0, loopLagSum = 0, loopLagN = 0;
{ let last = Date.now(); setInterval(() => { const d = Date.now() - last - 200; last = Date.now(); if (d > loopLagMax) loopLagMax = d; loopLagSum += Math.max(0, d); loopLagN++; }, 200).unref(); }

// /api/stats: una riga per giorno { day, metrica: valore, … }; qui si sommano i giorni
async function statsServer() { const s = await api('/api/stats'); const m = {}; for (const r of (s.body || [])) for (const [k, v] of Object.entries(r)) if (k !== 'day') m[k] = (m[k] || 0) + v; return { raw: s.body, m }; }

const giocatori = [], sale = [];
const lengthM = 5 * 60 * 14;   // 4.200 m, gara da 5 minuti
log(`simulazione: ${N} giocatori, modo ${MODO}, gara ${GARA_S} s, ${HZ} posizioni/s, server ${BASE}`);
const statsPrima = await statsServer();

if (MODO === 'sfida') {
  // sale da al massimo SALA posti, riempite in modo uniforme (50 → 6 da 7 e 1 da 8); in più un giocatore di troppo sulla sala piena
  const nSale = Math.ceil(N / SALA), base = Math.floor(N / nSale), resto = N % nSale;
  for (let s = 0; s < nSale; s++) sale.push({ code: 'SIM' + String(s + 1).padStart(2, '0') + 'X', n: base + (s < resto ? 1 : 0), gioc: [] });
  log(`${nSale} sale di sfida: ` + sale.map(s => s.code + '×' + s.n).join(', '));
  let i = 0;
  for (const s of sale) for (let k = 0; k < s.n; k++) { const g = new Giocatore(s.code, i++); giocatori.push(g); s.gioc.push(g); }
  // tutti si collegano insieme
  const tc = Date.now();
  await Promise.allSettled(giocatori.map(g => g.connect()));
  await Promise.all(giocatori.map(g => g.wait(m => m.t === 'welcome', 5000)));
  const ok = giocatori.filter(g => g.welcome).length;
  log(`collegati e accolti: ${ok}/${N} in ${Date.now() - tc} ms (apertura socket: mediana ${ms1(pct(giocatori.map(g => g.tConn), 0.5))}, max ${ms1(massimo(giocatori.map(g => g.tConn)))})`);
  // un giocatore di troppo sulla sala più piena: se la sala è al massimo (8) deve ricevere "full"
  const piena = sale.reduce((a, s) => (s.n > a.n ? s : a), sale[0]);
  const extra = new Giocatore(piena.code, 999); await extra.connect();
  const f = await extra.wait(m => m.t === 'full', 4000);
  log(`giocatore di troppo nella sala ${piena.code} (${piena.n} dentro): ${f ? 'respinto con "full" (chiusura ' + (extra.closed ? extra.closed.code : 'in corso') + ')' : piena.n >= PROTO.MAX_PLAYERS ? 'NON respinto: ERRORE' : 'entrato (la sala non era piena)'}`);
  extra.close();
  // l'organizzatore di ogni sala (hostId nel "lobby": con 50 arrivi insieme non è detto che sia il primo della lista)
  // sceglie 5 minuti e gli avversari, poi "Parti"
  await sleep(500);
  for (const s of sale) { s.host = s.gioc.find(g => g.lobby && g.lobby.hostId === g.id) || s.gioc[0]; s.host.send({ t: 'settings', minutes: 5, bots: BOTS }); }
  await sleep(300);
  const tp = Date.now();
  for (const s of sale) s.host.send({ t: 'start' });
  await Promise.all(giocatori.map(g => g.wait(m => m.t === 'countdown', 5000)));
  const cd = giocatori.filter(g => g.countdown).length;
  log(`"Parti" in tutte le sale: conto alla rovescia ricevuto da ${cd}/${N} (${Date.now() - tp} ms)`);
  // attesa fissa della sfida (W) poi "go": con "pronto" da tutti si parte subito (R-222): qui si aspetta l'attesa vera
  await Promise.all(giocatori.map(g => g.wait(m => m.t === 'go', W + 8000)));
  const go = giocatori.filter(g => g.startAt).length;
  log(`via ricevuto da ${go}/${N} (attesa della sfida ${W / 1000} s + 5 s di conto alla rovescia)`);
} else {
  // online: tutti premono "Online" nello stesso secondo (o ogni RITMO ms): /api/quick dice la sala, poi hello
  log(`${N} giocatori chiedono /api/quick` + (RITMO ? ` uno ogni ${RITMO} ms` : ' nello stesso istante'));
  const tc = Date.now();
  const entra = async i => {
    const q = await api('/api/quick');
    const code = q.body && q.body.code;
    const g = new Giocatore(code || 'ONLINE1', i); g.quick = q.status; g.quickCode = code; giocatori.push(g);
    if (!code) { g.err = 'quick ' + q.status; return; }
    await g.connect();
    await g.wait(m => m.t === 'welcome' || m.t === 'full', 5000);
    // "full": il gioco mostra "la sfida è piena" e il giocatore deve premere di nuovo: qui riprova una volta, dopo un attimo
    if (g.full) {
      g.riprova = true;
      await sleep(200 + Math.random() * 800);
      const q2 = await api('/api/quick');
      g.quickCode2 = q2.body && q2.body.code;
      if (g.quickCode2) { g.code = g.quickCode2; g.full = false; g.closed = null; await g.connect(); await g.wait(m => m.t === 'welcome' || m.t === 'full', 5000); }
    }
  };
  const lavori = [];
  for (let i = 0; i < N; i++) { lavori.push(entra(i)); if (RITMO) await sleep(RITMO); }
  await Promise.allSettled(lavori);
  const dentro = giocatori.filter(g => g.welcome && !g.full);
  const perSala = {};
  for (const g of dentro) perSala[g.code] = (perSala[g.code] || 0) + 1;
  const prime = {}; for (const g of giocatori) prime[g.quickCode || '-'] = (prime[g.quickCode || '-'] || 0) + 1;
  log(`/api/quick ha risposto: ` + Object.entries(prime).map(([c, n]) => c + '×' + n).join(', '));
  log(`respinti con "full" al primo tentativo: ${giocatori.filter(g => g.riprova).length}; dentro dopo il secondo: ${dentro.filter(g => g.riprova).length}; ancora fuori: ${giocatori.filter(g => g.full || !g.welcome).length}`);
  log(`in sala dopo ${Date.now() - tc} ms: ${dentro.length}/${N} — ` + Object.entries(perSala).sort().map(([c, n]) => c + '×' + n).join(', '));
  for (const c of Object.keys(perSala)) sale.push({ code: c, n: perSala[c], gioc: dentro.filter(g => g.code === c) });
  if (SOLO_INGRESSO) { log('solo ingresso: fine'); for (const g of giocatori) g.close(); await sleep(300); process.exit(0); }
  // le sale online partono da sole: con 2+ persone dopo 30 s (3 s se tutti "pronti"); da soli dopo 15 s con gli avversari
  for (const g of dentro) g.send({ t: 'ready', ready: true });
  await Promise.all(dentro.map(g => g.wait(m => m.t === 'countdown', 45000)));
  log(`partenza automatica: conto alla rovescia ricevuto da ${dentro.filter(g => g.countdown).length}/${dentro.length}`);
  await Promise.all(dentro.map(g => g.wait(m => m.t === 'go', 50000)));
  log(`via ricevuto da ${dentro.filter(g => g.startAt).length}/${dentro.length}`);
}

// la gara
const inGara = giocatori.filter(g => g.startAt && !g.full);
const nBot = sale.reduce((a, s) => { const g = s.gioc.find(x => x.countdown); return a + (g ? g.countdown.racers.filter(r => r.bot).length : 0); }, 0);
log(`gara: ${inGara.length} persone corrono in ${sale.length} sale` + (nBot ? ` (+ ${nBot} avversari del software)` : '') + (IMBROGLIONE ? '; Sim00 corre più veloce del limite fisico' : ''));
const tg = Date.now();
await Promise.all(inGara.map(g => g.corri(lengthM)));
const tArrivi = Date.now();
log(`tutti arrivati al traguardo in ${((tArrivi - tg) / 1000).toFixed(1)} s dal via`);
const attRis = m => m.t === 'results'; attRis.giaArrivato = g => g.results;   // nelle sale che hanno già finito i risultati sono già arrivati
await Promise.all(inGara.map(g => g.wait(attRis, 30000)));
const conRis = inGara.filter(g => g.results);
log(`risultati ricevuti da ${conRis.length}/${inGara.length}`);
await sleep(1500);
const statsDopo = await statsServer();

// il riepilogo
const lagTutti = inGara.flatMap(g => g.lags);
const posRicevute = inGara.reduce((a, g) => a + g.msgs.pos, 0), posInviate = inGara.reduce((a, g) => a + (g.inviati || 0), 0);
// ogni posizione inviata va a (persone nella sala − 1): posizioni attese
const attese = sale.reduce((a, s) => a + s.gioc.filter(g => g.startAt).reduce((b, g) => b + (g.inviati || 0) * (s.gioc.filter(x => x.startAt).length - 1), 0), 0);
const righe = [];
righe.push(`giocatori ${N} · sale ${sale.length} (partite ${sale.filter(s => s.gioc.some(g => g.countdown)).length}) · persone in gara ${inGara.length} · con risultati ${conRis.length}`);
righe.push(`posizioni inviate ${posInviate} (${(posInviate / Math.max(1, (tArrivi - tg) / 1000)).toFixed(0)}/s) · inoltrate dal server ${posRicevute} su ${attese} attese (${attese ? (100 * posRicevute / attese).toFixed(1) : '-'} %)`);
righe.push(`ritardo di inoltro delle posizioni: mediana ${ms1(pct(lagTutti, 0.5))}, 90% ${ms1(pct(lagTutti, 0.9))}, 99% ${ms1(pct(lagTutti, 0.99))}, max ${ms1(massimo(lagTutti))}`);
righe.push(`lag del processo della simulazione (client): medio ${loopLagN ? (loopLagSum / loopLagN).toFixed(1) : '-'} ms, max ${loopLagMax} ms`);
const chiusure = giocatori.filter(g => g.closed && g.closed.code !== 1000 && !g.full);
righe.push(`connessioni cadute durante la gara: ${chiusure.length}` + (chiusure.length ? ' (' + chiusure.slice(0, 5).map(g => g.name + ':' + g.closed.code).join(', ') + ')' : ''));
righe.push(`errori di invio: ${giocatori.reduce((a, g) => a + (g.errSend || 0), 0)}`);
// risultati: tempi validi, posizione e punti
for (const s of sale) {
  const g = s.gioc.find(x => x.results);
  if (!g) { righe.push(`sala ${s.code}: nessun risultato`); continue; }
  const r = g.results.results, persone = r.filter(x => !x.bot), validi = persone.filter(x => x.ms != null), dnf = persone.filter(x => x.dnf);
  const ultimoArrivo = massimo(s.gioc.filter(x => x.tFinish).map(x => x.tFinish));
  const primoRis = -massimo(s.gioc.filter(x => x.events.results).map(x => -x.events.results));
  righe.push(`sala ${s.code}: ${persone.length} persone, tempi validi ${validi.length}, non arrivati ${dnf.length}, vincitore ${validi[0] ? validi[0].name + ' ' + (validi[0].ms / 1000).toFixed(1) + ' s' : '-'}, punti al 1° ${validi[0] ? validi[0].earned : '-'}; risultati ${Math.round(primoRis - ultimoArrivo)} ms dopo l'ultimo arrivo` + (g.results.results.some(x => x.premio) ? ' · maglia della settimana assegnata' : ''));
}
const d = (k) => (statsDopo.m[k] || 0) - (statsPrima.m[k] || 0);
righe.push(`misure del server (/api/stats, differenza): races_started +${d('races_started')}, races_finished +${d('races_finished')}, racers +${d('racers')}, pts_n +${d('pts_n')}, settimana_gare +${d('settimana_gare')}`);
const lb = await api('/api/leaderboard?min=5');
righe.push(`classifica generale (5 min): ${Array.isArray(lb.body) ? lb.body.length : '-'} tempi, primo ${lb.body && lb.body[0] ? lb.body[0].name + ' ' + (lb.body[0].ms / 1000).toFixed(1) + ' s' : '-'}`);
console.log('\n══ Riepilogo della simulazione (' + MODO + ')');
for (const r of righe) console.log('  ' + r);
for (const g of giocatori) g.close();
await sleep(300);
process.exit(0);
