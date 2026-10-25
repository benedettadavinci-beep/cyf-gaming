// Prove del server delle gare (src/worker.js) con client WebSocket simulati, contro wrangler dev su 127.0.0.1:8787
import '../../public/shared/protocollo.js';
const PROTO = globalThis.CYF_PROTOCOLLO;
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const WS = BASE.replace(/^http/, 'ws');
const problems = [];
const ok = (cond, label, extra = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + label + (extra ? '  [' + extra + ']' : '')); if (!cond) problems.push(label + (extra ? ' [' + extra + ']' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Attesa della sfida dopo "Parti" (R-119): online 25 s; cancello.sh accende wrangler dev con ATTESA_SFIDA_MS=10000
// per non rallentare le prove (il valore di 25 s online lo controlla controlli.mjs, C5).
const W = Number(process.env.ATTESA_SFIDA_MS) || 25000;

class Client {
  constructor(code, id, name, j = '') { this.code = code; this.id = id; this.name = name; this.j = j; this.msgs = []; this.closed = null; this.waiters = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(WS + '/api/room/' + this.code);
      this.ws.onopen = () => { this.send({ t: 'hello', v: this.v === undefined ? PROTO.VERSIONE : this.v, id: this.id, name: this.name, j: this.j, sc: this.sc }); res(); };
      this.ws.onmessage = ev => {
        if (ev.data === 'pong') return;
        let m = JSON.parse(ev.data);
        // dalla 0.10: "countdown" apre l'attesa dei concorrenti (startAt 0) e "go" fa partire i 5 s.
        // Il client simulato dice subito "caricato" (salvo autoLoad = false) e per le prove vecchie
        // ricompone il "countdown" di una volta quando arriva il "go".
        if (m.t === 'countdown') { this.gather = m; this.push({ ...m, t: 'gathering' }); if (this.autoLoad !== false) this.send({ t: 'loaded' }); return; }
        if (m.t === 'go') { this.push(m); m = { ...(this.gather || {}), t: 'countdown', now: m.now, startAt: m.startAt }; }
        this.push(m);
      };
      this.ws.onclose = ev => { this.closed = { code: ev.code, reason: ev.reason }; for (const w of [...this.waiters]) if (w.pred({ t: '__closed', code: ev.code })) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res({ t: '__closed', code: ev.code }); } };
      this.ws.onerror = e => rej(e);
    });
  }
  push(m) { this.msgs.push(m); for (const w of [...this.waiters]) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); } }
  send(m) { this.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }
  wait(pred, ms = 4000 + W) {
    const past = this.msgs.find(pred);
    if (past) return Promise.resolve(past);
    return new Promise(res => { const w = { pred, res }; this.waiters.push(w); setTimeout(() => { if (this.waiters.includes(w)) { this.waiters.splice(this.waiters.indexOf(w), 1); res(null); } }, ms); });
  }
  waitType(t, ms) { return this.wait(m => m.t === t, ms); }
  last(t) { return [...this.msgs].reverse().find(m => m.t === t) || null; }
  close() { try { this.ws.close(1000); } catch (e) {} }
}
const api = async (p) => { const r = await fetch(BASE + p); let b = null; try { b = await r.json(); } catch (e) {} return { status: r.status, body: b }; };
const rnd = () => Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X').padEnd(5, 'Q');

console.log('T1 · indirizzi e codici');
{
  const a = await api('/api/room/ABC'); ok(a.status === 400, 'codice di 3 caratteri rifiutato (400)', String(a.status));
  const b = await api('/api/room/ABCDE'); ok(b.status === 426, 'senza WebSocket risponde 426', String(b.status));
  const c = await api('/api/leaderboard?min=7'); ok(c.status === 200 && Array.isArray(c.body), 'leaderboard con durata non valida ripiega sui 5 minuti');
  const d = await api('/api/me'); ok(d.status === 400, '/api/me senza id → 400', String(d.status));
  const e = await api('/api/xyz'); ok(e.status === 404, '/api/xyz → 404', String(e.status));
  const f = await api('/api/stats'); ok(f.status === 200 && Array.isArray(f.body), '/api/stats risponde con una lista');
  const g = await api('/api/points'); ok(g.status === 200 && Array.isArray(g.body), '/api/points risponde con una lista');
}

console.log('T2b · città della gara (R-118): la sceglie chi organizza, uguale per tutti');
{
  const code = rnd();
  const h = new Client(code, 'hs' + code, 'Capo'); h.sc = 'lisbona'; await h.connect(); await h.waitType('welcome');
  const g = new Client(code, 'gs' + code, 'Ospite'); g.sc = 'napoli'; await g.connect(); await g.waitType('welcome');
  let l = await g.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  ok(l && l.scena === 'lisbona', 'la stanza prende la città di chi la crea', l && l.scena);
  g.send({ t: 'scena', scena: 'berlino' }); await sleep(400);
  ok(g.last('lobby').scena === 'lisbona', 'l\'ospite non può cambiare la città della gara', g.last('lobby').scena);
  h.send({ t: 'scena', scena: 'roma' });
  l = await g.wait(m => m.t === 'lobby' && m.scena === 'roma', 3000);
  ok(!!l, 'chi organizza cambia la città e tutti la vedono');
  h.send({ t: 'scena', scena: 'atlantide' });
  l = await g.wait(m => m.t === 'lobby' && m.scena === 'neve', 3000);
  ok(!!l, 'città sconosciuta → Neve');
  h.send({ t: 'scena', scena: 'roma' }); await g.wait(m => m.t === 'lobby' && m.scena === 'roma', 3000);
  h.send({ t: 'start' });
  const [ch, cg] = await Promise.all([h.waitType('countdown'), g.waitType('countdown')]);
  ok(ch && cg && ch.scena === 'roma' && cg.scena === 'roma' && ch.seed === cg.seed, 'conto alla rovescia: stessa città e stesso seed per tutti', JSON.stringify({ h: ch && ch.scena, g: cg && cg.scena }));
  const late = new Client(code, 'ls' + code, 'Ritardo'); late.sc = 'madrid'; await late.connect();
  const w = await late.waitType('welcome');
  ok(w && w.scena === 'roma', 'chi entra durante la gara riceve la città della gara', w && w.scena);
  h.close(); g.close(); late.close();
  // sala pubblica: la città è quella di chi aspetta da più tempo
  const p1 = new Client('ONLINE20', 'o1' + code, 'Primo'); p1.sc = 'madrid'; await p1.connect(); await p1.waitType('welcome');
  const p2 = new Client('ONLINE20', 'o2' + code, 'Secondo'); p2.sc = 'zurigo'; await p2.connect(); await p2.waitType('welcome');
  l = await p2.wait(m => m.t === 'lobby' && m.players.length >= 2, 3000);
  ok(l && l.scena === 'madrid', 'sala online: città di chi aspetta da più tempo', l && l.scena);
  p1.close(); p2.close(); await sleep(300);
}

console.log('T2c · attesa dei concorrenti prima del via (R-119) e maglia nella stanza (R-118)');
{
  const code = rnd();
  const A = new Client(code, 'ga' + code, 'Capo'); A.autoLoad = false; await A.connect(); await A.waitType('welcome');
  const B = new Client(code, 'gb' + code, 'Lento'); B.autoLoad = false; await B.connect(); await B.waitType('welcome');
  B.send({ t: 'jersey', j: 'napoli' });
  const lj = await A.wait(m => m.t === 'lobby' && m.players.some(p => p.id === B.id && p.j === 'napoli'), 3000);
  ok(!!lj, 'chi non organizza può cambiare la maglia nella stanza e gli altri la vedono');
  A.send({ t: 'start' });
  const g = await B.waitType('gathering', 3000);
  ok(g && g.startAt === 0 && Math.abs(g.gatherUntil - g.now - W) < 300, 'dopo "Parti" niente via: si aspetta il tempo fisso della sfida (' + W / 1000 + ' s; online 25 s)', g && JSON.stringify({ startAt: g.startAt, wait: g.gatherUntil - g.now }));
  B.send({ t: 'jersey', j: 'roma' }); await sleep(300);
  ok(!A.msgs.some(m => m.t === 'lobby' && m.players.some(p => p.id === B.id && p.j === 'roma')), 'durante la gara la maglia non si cambia');
  A.send({ t: 'loaded' }); B.send({ t: 'loaded' });
  const ga = await B.wait(m => m.t === 'gather' && m.loaded.length === 2, 3000);
  // chi apre l'invito durante l'attesa entra subito in gara
  const E = new Client(code, 'ge' + code, 'Invitato'); E.autoLoad = false; await E.connect();
  const we = await E.waitType('welcome'); const re = await A.wait(m => m.t === 'racers' && m.racers.some(r => r.id === E.id), 3000);
  ok(we && we.startAt === 0 && we.racers.some(r => r.id === E.id) && !!re, 'chi apre l\'invito durante l\'attesa entra in gara prima del via', we && JSON.stringify({ startAt: we.startAt, inRace: we.racers.some(r => r.id === E.id), told: !!re }));
  E.send({ t: 'loaded' });
  const early = await A.waitType('go', Math.max(0, g.gatherUntil - Date.now() - 400));
  ok(!!ga && !early, 'tutti pronti, ma il conto alla rovescia non parte prima della fine dell\'attesa (R-119, corretto nella 0.11.1)', early ? 'partito ' + (early.now - g.now) + ' ms dopo "Parti"' : '');
  const go = await A.waitType('go', W + 5000);
  ok(go && go.now - g.gatherUntil > -200 && go.now - g.gatherUntil < 5000 && Math.abs(go.startAt - go.now - 5000) < 50, 'a fine attesa parte il conto alla rovescia di 5 s, uguale per tutti', go && JSON.stringify({ dopo: go.now - g.now, cd: go.startAt - go.now }));
  // chi entra a gara partita corre lo stesso, dalla partenza e con il tempo che corre già
  await sleep(Math.max(0, go.startAt - Date.now() + 300));
  A.send({ t: 'pos', x: 0, z: -10, y: 0, a: 0, s: 0, f: 0, g: 0, v: 20, c: 0 });
  const C = new Client(code, 'gc' + code, 'Ritardo'); await C.connect();
  const wc = await C.waitType('welcome');
  const rac = await A.wait(m => m.t === 'racers' && m.racers.some(r => r.id === C.id), 3000);
  ok(wc && wc.startAt === go.startAt && wc.racers.some(r => r.id === C.id) && !!rac, 'chi entra dopo il via entra in gara (svantaggiato) e gli altri lo vedono', wc && JSON.stringify({ s: wc.startAt === go.startAt, inRace: wc.racers.some(r => r.id === C.id), told: !!rac }));
  A.close(); B.close(); C.close(); E.close(); await sleep(300);
}
{
  const code = rnd();
  const A = new Client(code, 'ta' + code, 'Capo'); A.autoLoad = false; await A.connect(); await A.waitType('welcome');
  const B = new Client(code, 'tb' + code, 'Assente'); B.autoLoad = false; await B.connect(); await B.waitType('welcome');
  const D = new Client(code, 'td' + code, 'Esce'); D.autoLoad = false; await D.connect(); await D.waitType('welcome');
  A.send({ t: 'start' }); const g = await A.waitType('gathering', 3000);
  A.send({ t: 'loaded' }); await sleep(300);
  D.close();                                      // chi esce durante l'attesa non blocca: resta B, che non carica mai
  console.log('   aspetto la fine dell\'attesa (' + W / 1000 + ' s)…');
  const go = await A.waitType('go', W + 10000);   // la sveglia del server può tardare un po' se la macchina è carica
  ok(go && go.now - g.gatherUntil > -200 && go.now - g.gatherUntil < 5000 && Math.abs(go.startAt - go.now - 5000) < 50, 'chi non carica mai e chi esce non bloccano: a fine attesa si parte con chi c\'è (5 s di conto alla rovescia)', go && String(go.now - g.now));
  A.close(); B.close(); await sleep(300);
}

console.log('T1b · protocollo condiviso (A-12): versione nel hello, messaggi fuori contratto ignorati');
{
  const code = rnd();
  const old = new Client(code, 'old' + code, 'Vecchio'); old.v = PROTO.VERSIONE + 1; await old.connect();
  const agg = await old.waitType('aggiorna', 3000); const cl = await old.wait(m => m.t === '__closed', 3000);
  ok(!!agg && cl && cl.code === 4001, 'pagina con un\'altra versione del protocollo: "aggiorna" e chiusura 4001', JSON.stringify({ agg: !!agg, close: cl && cl.code }));
  const A = new Client(code, 'pa' + code, 'A'); await A.connect(); await A.waitType('welcome');
  A.send({ t: 'boh' }); A.send({ t: 'settings' }); A.send({ t: 'drop', kind: 'banana' }); A.send('{"t":5}');
  await sleep(400);
  ok(!A.closed && A.ws.readyState === 1, 'messaggi fuori contratto (tipo sconosciuto, campi mancanti) ignorati senza chiudere');
  ok(PROTO.valida({ t: 'hello', id: 'x', name: 'y', v: 1 }, 'client') === null && PROTO.valida({ t: 'pos', x: 1 }, 'client') !== null, 'valida(): accetta i messaggi giusti e segnala i campi mancanti');
  A.close(); await sleep(200);
}

console.log('T2d · "Sono pronto" durante l\'attesa (R-222): se tutti alzano la mano si parte subito');
{
  const code = rnd();
  const A = new Client(code, 'ra' + code, 'Capo'); await A.connect(); await A.waitType('welcome');
  const B = new Client(code, 'rb' + code, 'Amico'); await B.connect(); await B.waitType('welcome');
  await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  A.send({ t: 'pronto' });
  ok(!(await B.waitType('gather', 600)), 'prima di "Parti" il pulsante "Sono pronto" non conta');
  A.send({ t: 'start' }); const g = await B.waitType('gathering', 3000);
  A.send({ t: 'pronto' });
  const ga = await B.wait(m => m.t === 'gather' && (m.ready || []).includes(A.id), 2000);
  ok(!!ga && !(await B.waitType('go', 600)), 'uno pronto su due: gli altri vedono la sua mano alzata, ma si aspetta ancora', ga && JSON.stringify(ga.ready));
  const t0 = Date.now(); B.send({ t: 'pronto' });
  const go = await A.waitType('go', 2000);
  ok(go && go.now - g.now < W - 300 && Math.abs(go.startAt - go.now - 5000) < 50, 'tutti pronti: l\'attesa finisce subito e partono i 5 s', go && JSON.stringify({ dopo: go.now - g.now, cd: go.startAt - go.now, risposta: Date.now() - t0 }));
  A.close(); B.close(); await sleep(300);
}

console.log('T2 · stanza piena (8 giocatori, il 9° rifiutato) e pulizia dei nomi');
{
  const code = rnd();
  const cs = [];
  for (let i = 0; i < 8; i++) { const c = new Client(code, 'p' + i + code, 'Giocatore' + i); await c.connect(); cs.push(c); await c.waitType('welcome'); }
  const lobby = await cs[0].wait(m => m.t === 'lobby' && m.players.length === 8, 3000);
  ok(!!lobby, '8 giocatori nella stanza', lobby ? '' : 'lobby non ha mai avuto 8 giocatori');
  const nine = new Client(code, 'p9' + code, 'Nono'); await nine.connect();
  const full = await nine.waitType('full', 3000); const cl = await nine.wait(m => m.t === '__closed', 3000);
  ok(!!full && cl && cl.code === 1008, 'il 9° riceve "full" e viene chiuso con 1008', JSON.stringify({ full: !!full, close: cl && cl.code }));
  const colors = new Set(lobby ? lobby.players.map(p => p.color) : []);
  ok(colors.size === 8, '8 colori di giacca tutti diversi', [...colors].join(','));
  // nome con caratteri vietati e troppo lungo
  const dirty = new Client(rnd(), 'pdirty', 'A<b>cdefghijklmnopqrstuvwxyz'); await dirty.connect();
  const lw = await dirty.wait(m => m.t === 'lobby' && m.players.length === 1, 3000);
  ok(lw && lw.players[0].name === 'Abcdefghijklmnop', 'nome ripulito (niente < >, massimo 16 caratteri)', lw && lw.players[0].name);
  dirty.close(); nine.close(); cs.forEach(c => c.close());
}

console.log('T3 · organizzatore, durata, partenza, stesso seed, arrivo troppo veloce');
{
  const code = rnd();
  const A = new Client(code, 'host' + code, 'Luigi', 'napoli'), B = new Client(code, 'guest' + code, 'Ospite', 'roma');
  await A.connect(); await A.waitType('welcome'); await B.connect(); await B.waitType('welcome');
  let lb = await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  ok(lb && lb.hostId === A.id, 'il primo entrato è l\'organizzatore', lb && lb.hostId);
  ok(lb && lb.players.find(p => p.id === A.id).j === 'napoli', 'la maglia scelta viaggia nella lobby (gli avversari la vedono)');
  B.send({ t: 'settings', minutes: 15 }); await sleep(400);
  lb = A.last('lobby'); ok(lb.minutes === 5, 'un non organizzatore non può cambiare la durata', String(lb.minutes));
  B.send({ t: 'start' }); const cd0 = await A.waitType('countdown', 1200); ok(!cd0, 'un non organizzatore non può far partire la gara');
  A.send({ t: 'settings', minutes: 10 }); lb = await B.wait(m => m.t === 'lobby' && m.minutes === 10, 3000);
  ok(lb && lb.length === 24000, 'durata 10 min → lunghezza 24.000 m', lb && String(lb.length));
  A.send({ t: 'settings', minutes: 7 }); await sleep(300); ok(A.last('lobby').minutes === 10, 'durata non ammessa (7) ignorata');
  A.send({ t: 'settings', minutes: 5 }); await B.wait(m => m.t === 'lobby' && m.minutes === 5, 3000);
  const t0 = Date.now();
  A.send({ t: 'start' });
  const cA = await A.waitType('countdown'), cB = await B.waitType('countdown');
  ok(cA && cB && cA.seed === cB.seed && cA.startAt === cB.startAt, 'stesso seed e stesso istante di partenza per tutti');
  ok(cA && Math.abs(cA.startAt - cA.now - 5000) < 50, 'conto alla rovescia di 5 s', cA && String(cA.startAt - cA.now));
  ok(cA && cA.racers.length === 2 && cA.racers.every(r => 'j' in r), 'elenco dei corridori con la maglia');
  ok(cA && cA.length === 12000 && cA.minutes === 5, 'gara da 5 min = 12.000 m');
  // posizioni: inoltrate agli altri, con limiti
  A.send({ t: 'pos', x: 1, z: -50, y: 0, a: 0, s: 0, f: 0, g: 0, v: 999, c: 0, k: 0, top: 30, tk: 2, p: 120 });
  const pB = await B.waitType('pos', 2000);
  ok(pB && pB.id === A.id && pB.v === 60, 'posizione inoltrata agli altri, velocità limitata a 60', pB && String(pB.v));
  // arrivo appena dopo il via: più veloce del limite fisico → tempo non valido
  await sleep(Math.max(0, cA.startAt - Date.now() + 200));
  A.send({ t: 'finish', top: 30, tk: 2, p: 120 });
  const fA = await A.waitType('finished', 3000);
  ok(fA && fA.id === A.id && fA.ms === null, 'arrivo troppo veloce scartato (ms = null)', JSON.stringify(fA));
  B.send({ t: 'finish', top: 44, tk: 5, p: 80 });
  const res = await A.waitType('results', 3000);
  ok(!!res, 'con tutti arrivati arrivano i risultati');
  if (res) {
    const rA = res.results.find(r => r.id === A.id), rB = res.results.find(r => r.id === B.id);
    ok(rA.dnf && rA.ms === null && rB.dnf && rB.ms === null, 'entrambi "non arrivati" (troppo veloci)');
    ok(rA.earned === 120 && rB.earned === 80, 'punti = 0 per la posizione (non arrivati) + punti rimasti della gara', rA.earned + '/' + rB.earned);
    ok(res.awards && res.awards.fastest.id === B.id && res.awards.tricks.id === B.id, 'premi: velocità massima e più acrobazie a chi li ha fatti');
    ok(res.round === 1, 'gara n. 1');
  }
  // rivincita: solo l'organizzatore
  B.send({ t: 'start' }); ok(!(await A.wait(m => m.t === 'countdown' && m.round === 2, 1000)), 'rivincita: un ospite non può lanciarla');
  A.send({ t: 'start' }); const c2 = await B.wait(m => m.t === 'countdown' && m.round === 2, W + 4000); ok(!!c2, 'rivincita lanciata dall\'organizzatore (gara n. 2)');
  // l'organizzatore se ne va: passa all'altro
  A.close(); const lb2 = await B.wait(m => m.t === 'lobby' && m.hostId === B.id, 3000); ok(!!lb2, 'se l\'organizzatore esce, il ruolo passa al giocatore rimasto');
  B.close();
}

console.log('T4 · banane e bombe (solo in gara, non più di una ogni 0,9 s)');
{
  const code = rnd();
  const A = new Client(code, 'ha' + code, 'A'), B = new Client(code, 'gb' + code, 'B');
  await A.connect(); await A.waitType('welcome'); await B.connect(); await B.waitType('welcome');
  await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  A.send({ t: 'drop', kind: 'banana', x: 1, z: -10, hid: 'h1' });
  ok(!(await B.waitType('drop', 800)), 'in sala d\'attesa le banane non si lasciano');
  A.send({ t: 'start' }); await B.waitType('countdown');
  await sleep(5300);
  A.send({ t: 'pos', x: 0, z: -20, top: 10, tk: 0, p: 100 });   // fa passare la stanza a "racing"
  await sleep(200);
  A.send({ t: 'drop', kind: 'banana', x: 1, z: -10, hid: 'h1' });
  const d1 = await B.waitType('drop', 2000); ok(d1 && d1.kind === 'banana' && d1.hid === 'h1' && d1.id === A.id, 'banana inoltrata all\'avversario in gara');
  A.send({ t: 'drop', kind: 'bomb', x: 1, z: -12, hid: 'h2' });
  ok(!(await B.wait(m => m.t === 'drop' && m.hid === 'h2', 700)), 'seconda cosa lasciata entro 0,9 s ignorata');
  await sleep(1000);
  A.send({ t: 'drop', kind: 'trap', x: 1, z: -12, hid: 'h3' });
  ok(!(await B.wait(m => m.t === 'drop' && m.hid === 'h3', 700)), 'tipo sconosciuto ("trap") ignorato');
  B.send({ t: 'hit', hid: 'h1', owner: A.id, kind: 'banana' });
  const h = await A.waitType('hit', 2000); ok(h && h.hid === 'h1' && h.owner === A.id && h.name === 'B', 'chi scivola lo dice a tutti, e chi l\'ha lasciata lo sa');
  // banana lanciata al giocatore davanti (R-224)
  await sleep(1000);
  A.send({ t: 'throw', target: B.id, hid: 't1' });
  const th = await B.waitType('throw', 2000);
  ok(th && th.id === A.id && th.target === B.id && th.hid === 't1' && th.name === 'A', 'banana lanciata: il bersaglio e gli altri la ricevono con chi l\'ha lanciata', th && JSON.stringify(th));
  await sleep(1000);
  A.send({ t: 'throw', target: A.id, hid: 't2' }); A.send({ t: 'throw', target: 'pNessuno', hid: 't3' });
  ok(!(await B.wait(m => m.t === 'throw' && (m.hid === 't2' || m.hid === 't3'), 800)), 'non si lancia a se stessi né a chi non è in gara');
  // bananone (R-231): stesso lancio con kind 'bananone'; un tipo sconosciuto diventa una banana
  await sleep(1000);
  A.send({ t: 'throw', target: B.id, hid: 't4', kind: 'bananone' });
  const tb = await B.wait(m => m.t === 'throw' && m.hid === 't4', 2000);
  ok(tb && tb.kind === 'bananone' && tb.target === B.id, 'bananone lanciato: arriva al bersaglio con il suo tipo', tb && JSON.stringify(tb));
  await sleep(1000);
  A.send({ t: 'throw', target: B.id, hid: 't5', kind: 'missile' });
  const tx = await B.wait(m => m.t === 'throw' && m.hid === 't5', 2000);
  ok(tx && tx.kind === 'banana', 'tipo di lancio sconosciuto trattato come banana', tx && JSON.stringify(tx));
  await sleep(1000);
  A.send({ t: 'drop', kind: 'bananone', x: 1, z: -14, hid: 'h4' });
  const db = await B.wait(m => m.t === 'drop' && m.hid === 'h4', 2000);
  ok(db && db.kind === 'bananone', 'bananone sulla pista (nessuno davanti) inoltrato agli altri', db && JSON.stringify(db));
  ok(PROTO.COSTI.bananone === PROTO.COSTI.bomb * 10 && PROTO.FERMO.bananone === 4, 'bananone: costa 10 volte la bomba e ferma 4 s', JSON.stringify(PROTO.COSTI));
  A.close(); B.close();
}

console.log('T5 · vocali: inoltro, uno ogni 3 minuti, formati, segnalazioni e blocco');
{
  const code = rnd();
  const A = new Client(code, 'va' + code, 'Voce'), B = new Client(code, 'vb' + code, 'Ascolta'), C = new Client(code, 'vc' + code, 'Terzo');
  for (const c of [A, B, C]) { await c.connect(); await c.waitType('welcome'); }
  await C.wait(m => m.t === 'lobby' && m.players.length === 3, 3000);
  const data = 'QUJDRA=='.repeat(100);
  A.send({ t: 'voice', mime: 'audio/x-fake', data, dur: 2 });
  ok(!(await B.waitType('voice', 700)) && !(await A.waitType('voiceOk', 300)), 'formato audio sconosciuto scartato');
  A.send({ t: 'voice', mime: 'audio/webm;codecs=opus', data, dur: 2 });
  const vB = await B.waitType('voice', 2000), okA = await A.waitType('voiceOk', 2000);
  ok(vB && vB.id === A.id && vB.data === data && vB.name === 'Voce', 'vocale inoltrato agli altri con nome e colore');
  ok(okA && okA.next - okA.now === 180000, 'prossimo vocale fra 3 minuti', okA && String(okA.next - okA.now));
  A.send({ t: 'voice', mime: 'audio/webm;codecs=opus', data, dur: 2 });
  const w = await A.waitType('voiceWait', 2000); ok(w && w.next > w.now, 'secondo vocale entro 3 minuti: il server fa aspettare');
  ok(!(await B.wait(m => m.t === 'voice' && B.msgs.filter(x => x.t === 'voice').length > 1, 500)), 'e non lo inoltra');
  // segnalazioni: due dalla stessa persona non bastano
  B.send({ t: 'reportVoice', id: A.id }); ok(!!(await B.waitType('reported', 2000)), 'segnalazione confermata');
  B.send({ t: 'reportVoice', id: A.id }); await B.wait(m => m.t === 'reported' && B.msgs.filter(x => x.t === 'reported').length > 1, 2000);
  A.send({ t: 'voice', mime: 'audio/webm;codecs=opus', data, dur: 2 });
  ok(!!(await A.wait(m => m.t === 'voiceWait' && A.msgs.filter(x => x.t === 'voiceWait').length > 1, 2000)) && !A.last('voiceBlocked'), 'due segnalazioni dalla stessa persona non bloccano');
  A.send({ t: 'reportVoice', id: A.id }); await sleep(300); ok(!A.last('reported'), 'non ci si può segnalare da soli');
  C.send({ t: 'reportVoice', id: A.id }); await C.waitType('reported', 2000);
  A.send({ t: 'voice', mime: 'audio/webm;codecs=opus', data, dur: 2 });
  ok(!!(await A.waitType('voiceBlocked', 2000)), 'alla seconda persona che segnala, i vocali del segnalato sono bloccati');
  A.close(); B.close(); C.close();
}

console.log('T6 · sala online: /api/quick, partenza automatica in 30 s, 3 s se tutti pronti');
{
  const q = await api('/api/quick');
  ok(q.status === 200 && /^ONLINE\d+$/.test(q.body.code), '/api/quick indica una sala ONLINEn', q.body && q.body.code);
  const code = q.body.code;
  const A = new Client(code, 'oa' + code + Date.now(), 'Online1'), B = new Client(code, 'ob' + code + Date.now(), 'Online2');
  await A.connect(); const wA = await A.waitType('welcome'); ok(wA && wA.pub === true, 'la sala è pubblica');
  let lb = await A.wait(m => m.t === 'lobby' && m.players.length === 1, 3000);
  ok(lb && lb.autoAt === 0 && lb.hostId === null, 'da soli non parte niente e non c\'è organizzatore');
  A.send({ t: 'start' }); ok(!(await A.waitType('countdown', 800)), 'in sala online "Parti" non esiste');
  await B.connect(); await B.waitType('welcome');
  lb = await A.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  ok(lb && lb.autoAt - lb.now > 28000 && lb.autoAt - lb.now <= 30000, 'con 2 giocatori la gara parte da sola entro 30 s', lb && String(lb.autoAt - lb.now));
  A.send({ t: 'settings', minutes: 15 }); await sleep(300); ok(A.last('lobby').minutes === 5, 'in sala online la durata resta 5 minuti');
  A.send({ t: 'ready', ready: true }); B.send({ t: 'ready', ready: true });
  lb = await A.wait(m => m.t === 'lobby' && m.players.every(p => p.ready), 3000);
  ok(lb && lb.autoAt - lb.now <= 3000, 'tutti pronti: parte entro 3 s', lb && String(lb.autoAt - lb.now));
  const cd = await B.waitType('countdown', 6000); ok(!!cd, 'conto alla rovescia partito da solo');
  A.close(); B.close();
}

console.log('T7 · stesso giocatore da un\'altra scheda');
{
  const code = rnd();
  const A1 = new Client(code, 'same' + code, 'Uno'); await A1.connect(); await A1.waitType('welcome');
  const A2 = new Client(code, 'same' + code, 'Uno'); await A2.connect(); await A2.waitType('welcome');
  const cl = await A1.wait(m => m.t === '__closed', 3000);
  ok(cl && cl.code === 4000, 'la vecchia scheda viene chiusa con il codice 4000', cl && String(cl.code));
  const lb = A2.last('lobby'); ok(lb && lb.players.length === 1, 'nella stanza resta un solo giocatore');
  A2.close();
}

console.log('T9 · errori dai browser: /api/errors li riceve, li raggruppa e rifiuta quelli troppo grandi');
{
  const msg = 'Prova errore ' + rnd();
  const post = b => fetch(BASE + '/api/errors', { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b), headers: { 'content-type': 'application/json' } });
  const r1 = await post({ ver: 'test', msg, src: 'game.js:1:1', stack: 'riga', ua: 'prova', ctx: '{}' });
  await post({ ver: 'test', msg, src: 'game.js:1:1' });
  ok(r1.status === 200, 'POST /api/errors accettato', String(r1.status));
  const big = await post('x'.repeat(9000)); ok(big.status === 413, 'errore troppo grande rifiutato (413)', String(big.status));
  const bad = await post('{non json'); ok(bad.status === 400, 'JSON non valido rifiutato (400)', String(bad.status));
  const list = (await api('/api/errors')).body;
  const row = Array.isArray(list) && list.find(r => r.msg === msg);
  ok(row && row.n === 2 && row.ver === 'test' && row.src === 'game.js:1:1', 'lo stesso errore due volte = una riga con conteggio 2', JSON.stringify(row));
}

console.log('T10 · personaggio: capelli, pantaloni, casco, tavola (R-225, R-229) e profilo con codice personale (R-226)');
{
  const code = rnd();
  const A = new Client(code, 'ha' + code, 'Capo'); await A.connect(); await A.waitType('welcome');
  const B = new Client(code, 'hb' + code, 'Ospite'); await B.connect(); await B.waitType('welcome');
  A.send({ t: 'jersey', j: 'roma', h: 'coda:3' });
  const lh = await B.wait(m => m.t === 'lobby' && m.players.some(p => p.id === A.id && p.h === 'coda:3'), 3000);
  ok(!!lh, 'i capelli scelti arrivano agli altri giocatori della stanza');
  A.send({ t: 'jersey', j: 'roma', h: 'coda:3', p: '4', e: 'integrale:2', s: 'longboard:6' });
  const lg = await B.wait(m => m.t === 'lobby' && m.players.some(p => p.id === A.id && p.p === '4' && p.e === 'integrale:2' && p.s === 'longboard:6'), 3000);
  ok(!!lg, 'pantaloni, casco e tavola scelti arrivano agli altri giocatori (R-229)');
  A.send({ t: 'jersey', j: 'roma', h: '<script>' });
  const lb = await B.wait(m => m.t === 'lobby' && m.players.some(p => p.id === A.id && p.h === ''), 3000);
  ok(!!lb, 'capelli non validi scartati (restano "a caso")');
  A.close(); B.close();
  const post = b => fetch(BASE + '/api/profilo', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json' } }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  const id = 'pf' + code;
  const c1 = await post({ id, data: { name: 'Luigi<b>', lang: 'en', scena: 'napoli', j: 'colore-verde', h: 'lunghi:4', p: '2', e: 'sci:1', s: 'cruiser:3', extra: 'x' } });
  const pc = c1.body && c1.body.code;
  ok(c1.status === 200 && /^[A-HJ-NP-Z2-9]{8}$/.test(pc || ''), 'il primo salvataggio crea il codice personale di 8 caratteri', JSON.stringify(c1.body));
  const g1 = await api('/api/profilo?code=' + pc);
  ok(g1.status === 200 && g1.body.id === id && g1.body.data.name === 'Luigib' && g1.body.data.lang === 'en' && g1.body.data.scena === 'napoli' && g1.body.data.j === 'colore-verde' && g1.body.data.h === 'lunghi:4' && g1.body.data.p === '2' && g1.body.data.e === 'sci:1' && g1.body.data.s === 'cruiser:3' && !('extra' in g1.body.data), 'con il codice si ritrovano giocatore e impostazioni, ripulite', JSON.stringify(g1.body));
  const g1b = await api('/api/profilo?code=' + pc.toLowerCase().slice(0, 4) + '-' + pc.slice(4).toLowerCase());
  ok(g1b.status === 200 && g1b.body.id === id, 'il codice vale anche scritto minuscolo e con il trattino');
  await sleep(5);
  const c2 = await post({ id, code: pc, data: { name: 'Luigi', lang: 'xx', scena: 'marte', j: 'roma', h: ':2' } });
  const g2 = await api('/api/profilo?code=' + pc);
  ok(c2.body.code === pc && g2.body.data.j === 'roma' && g2.body.data.h === ':2' && g2.body.data.lang === '' && g2.body.data.scena === '' && g2.body.at > g1.body.at, 'un nuovo salvataggio con lo stesso codice aggiorna il profilo (lingua e città sconosciute scartate)', JSON.stringify(g2.body));
  const nf = await api('/api/profilo?code=ZZZZZZZZ'); ok(nf.status === 404, 'codice sconosciuto: 404', String(nf.status));
  const bad = await api('/api/profilo?code=12'); ok(bad.status === 400, 'codice non valido: 400', String(bad.status));
  const noid = await post({ data: { name: 'x' } }); ok(noid.status === 400, 'senza id il profilo non si salva (400)', String(noid.status));
  const big = await post({ id, data: { name: 'x'.repeat(3000) } }); ok(big.status === 413, 'profilo troppo grande rifiutato (413)', String(big.status));
}

if (process.env.VELOCE === '1') console.log('T8 saltata (VELOCE=1: giro rapido del cancello; il giro completo la fa ogni notte)');
else {
console.log('T8 · gara valida con attesa reale (≥ 231 s), classifica, punti, chi esce è "non arrivato", contatori');
{
  const statsBefore = (await api('/api/stats')).body;
  const code = rnd();
  const name = 'Veloce' + code.slice(0, 3);
  const A = new Client(code, 'wa' + code, name), B = new Client(code, 'wb' + code, 'Lento');
  await A.connect(); await A.waitType('welcome'); await B.connect(); await B.waitType('welcome');
  await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  A.send({ t: 'start' }); const cd = await A.waitType('countdown');
  const minMs = Math.floor(12000 / 52 * 1000);
  console.log('   aspetto', Math.round((cd.startAt + minMs - Date.now()) / 1000), 's per un arrivo valido…');
  const pinger = setInterval(() => { A.send({ t: 'pos', x: 0, z: -100, top: 41, tk: 3, p: 210 }); B.send({ t: 'pos', x: 0, z: -90, top: 38, tk: 7, p: 50 }); }, 5000);
  await sleep(cd.startAt + minMs + 1500 - Date.now());
  A.send({ t: 'finish', top: 41, tk: 3, p: 210 });
  const fA = await A.waitType('finished', 3000);
  ok(fA && typeof fA.ms === 'number' && fA.ms >= minMs, 'arrivo valido con tempo misurato dal server', fA && String(fA.ms));
  clearInterval(pinger);
  B.close();   // l'altro se ne va: la gara finisce e lui risulta non arrivato
  const res = await A.waitType('results', 5000);
  ok(!!res, 'la gara si chiude quando non resta nessuno in pista');
  if (res) {
    const rA = res.results[0], rB = res.results[1];
    ok(rA.id === A.id && rA.ms === fA.ms && rB.id === B.id && rB.dnf && rB.ms === null, 'classifica: il valido primo, chi è uscito "non arrivato"');
    ok(rA.earned === 100 + 210 && rB.earned === 50, 'punti: 100 al vincitore + 210 rimasti; 0 + 50 al non arrivato', rA.earned + '/' + rB.earned);
    ok(rA.total === 310, 'totale del vincitore salvato sul server', String(rA.total));
    ok(res.awards.fastest.id === A.id && res.awards.tricks.id === B.id, 'premi: velocità a A (41 m/s), acrobazie a B (7)');
  }
  const me = (await api('/api/me?id=' + A.id)).body; ok(me.points === 310 && me.races === 1 && me.wins === 1, '/api/me: punti, gare e vittorie', JSON.stringify(me));
  const lbd = (await api('/api/leaderboard?min=5')).body;
  const row = lbd.find(r => r.name === name); ok(row && row.ms === fA.ms, 'tempo in classifica (5 min)', JSON.stringify(row));
  const lbd10 = (await api('/api/leaderboard?min=10')).body; ok(!lbd10.find(r => r.name === name), 'non compare nella classifica dei 10 min');
  const pts = (await api('/api/points')).body; ok(pts.some(r => r.name === name && r.points === 310), '/api/points lo elenca');
  const stats = (await api('/api/stats')).body;
  const today = new Date().toISOString().slice(0, 10);
  const row0 = stats.find(r => r.day === today) || {}, rowB = (statsBefore || []).find(r => r.day === today) || {};
  const d = k => (row0[k] || 0) - (rowB[k] || 0);
  ok(d('races_started') === 1 && d('races_finished') === 1 && d('racers') === 2 && d('players') >= 2, '/api/stats: gare avviate/finite, corridori e giocatori unici del giorno', JSON.stringify({ started: d('races_started'), finished: d('races_finished'), racers: d('racers'), players: d('players') }));
  ok((row0.voice_reports || 0) >= 2, '/api/stats conta le segnalazioni dei vocali', String(row0.voice_reports));
  A.close();
}
}

console.log('\n' + (problems.length ? 'PROBLEMI:' : 'NESSUN PROBLEMA'));
for (const p of problems) console.log(' -', p);
process.exit(problems.length ? 1 : 0);   // esito per il cancello dei test: 1 = qualcosa non va
