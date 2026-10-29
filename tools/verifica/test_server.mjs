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
      this.ws = new WebSocket(WS + (this.path || '/api/room/') + this.code);
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
  ok(lb && lb.length === 8400, 'durata 10 min → lunghezza 8.400 m (R-242)', lb && String(lb.length));
  A.send({ t: 'settings', minutes: 7 }); await sleep(300); ok(A.last('lobby').minutes === 10, 'durata non ammessa (7) ignorata');
  A.send({ t: 'settings', minutes: 5 }); await B.wait(m => m.t === 'lobby' && m.minutes === 5, 3000);
  const t0 = Date.now();
  A.send({ t: 'start' });
  const cA = await A.waitType('countdown'), cB = await B.waitType('countdown');
  ok(cA && cB && cA.seed === cB.seed && cA.startAt === cB.startAt, 'stesso seed e stesso istante di partenza per tutti');
  ok(cA && Math.abs(cA.startAt - cA.now - 5000) < 50, 'conto alla rovescia di 5 s', cA && String(cA.startAt - cA.now));
  ok(cA && cA.racers.length === 2 && cA.racers.every(r => 'j' in r), 'elenco dei corridori con la maglia');
  ok(cA && cA.length === 4200 && cA.minutes === 5, 'gara da 5 min = 4.200 m (50 km/h di media, R-242)');
  // posizioni: inoltrate agli altri, con limiti
  A.send({ t: 'pos', x: 1, z: -50, y: 0, a: 0, s: 0, f: 0, g: 0, v: 999, c: 0, k: 0, top: 18, tk: 2, p: 120 });
  const pB = await B.waitType('pos', 2000);
  ok(pB && pB.id === A.id && pB.v === 60, 'posizione inoltrata agli altri, velocità limitata a 60', pB && String(pB.v));
  // arrivo appena dopo il via: più veloce del limite fisico → tempo non valido
  await sleep(Math.max(0, cA.startAt - Date.now() + 200));
  A.send({ t: 'finish', top: 18, tk: 2, p: 120 });
  const fA = await A.waitType('finished', 3000);
  ok(fA && fA.id === A.id && fA.ms === null, 'arrivo troppo veloce scartato (ms = null)', JSON.stringify(fA));
  B.send({ t: 'finish', top: 22, tk: 5, p: 80 });   // velocità massime sotto gli 80 km/h (R-242): oltre, il server le taglia a 24 m/s
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
  ok(PROTO.COSTI.banana === 1500 && PROTO.COSTI.bomb === 50 && PROTO.COSTI.bananone === 1500 && PROTO.FERMO.bananone === 4, 'costi 0.27.0 (R-520, R-521, S-54): banana 1.500, bomba 50, bananone 1.500 fisso; il bananone ferma 4 s', JSON.stringify(PROTO.COSTI));
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
  ok(lb && lb.autoBot === true && lb.autoAt - lb.now > 13000 && lb.autoAt - lb.now <= 15000 && lb.hostId === null, 'da soli: tra 15 s si parte con gli avversari del computer (R-235), e non c\'è organizzatore', lb && JSON.stringify({ autoBot: lb.autoBot, tra: lb.autoAt - lb.now }));
  A.send({ t: 'start' }); ok(!(await A.waitType('countdown', 800)), 'in sala online "Parti" non esiste');
  await B.connect(); await B.waitType('welcome');
  lb = await A.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  ok(lb && !lb.autoBot && lb.autoAt - lb.now > 28000 && lb.autoAt - lb.now <= 30000, 'con 2 giocatori la gara parte da sola entro 30 s, senza avversari del computer', lb && String(lb.autoAt - lb.now));
  A.send({ t: 'settings', minutes: 15 }); await sleep(300); ok(A.last('lobby').minutes === 5, 'in sala online la durata resta 5 minuti');
  A.send({ t: 'ready', ready: true }); B.send({ t: 'ready', ready: true });
  lb = await A.wait(m => m.t === 'lobby' && m.players.every(p => p.ready), 3000);
  ok(lb && lb.autoAt - lb.now <= 3000, 'tutti pronti: parte entro 3 s', lb && String(lb.autoAt - lb.now));
  // qui conta che parta da solo (i 3 s sono controllati sopra): 10 s di margine, il 27/10 con il processore carico 6 s non sono bastati una volta
  const cd = await B.waitType('countdown', 10000); ok(!!cd, 'conto alla rovescia partito da solo');
  A.close(); B.close();
}

console.log('T7 · stesso giocatore da un\'altra scheda');
{
  const code = rnd();
  const A1 = new Client(code, 'same' + code, 'Uno'); await A1.connect(); await A1.waitType('welcome');
  const A2 = new Client(code, 'same' + code, 'Uno'); await A2.connect(); await A2.waitType('welcome');
  const cl = await A1.wait(m => m.t === '__closed', 3000);
  ok(cl && cl.code === 4000, 'la vecchia scheda viene chiusa con il codice 4000', cl && String(cl.code));
  const lb = await A2.wait(m => m.t === 'lobby' && m.players.length === 1, 3000) || A2.last('lobby');
  ok(lb && lb.players.length === 1, 'nella stanza resta un solo giocatore', lb && String(lb.players.length));
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

console.log('T11 · misure (R-232): punti fatti per gara, oggetti usati, visite, tempo di caricamento e ritorni');
{
  const today = new Date().toISOString().slice(0, 10);
  const giorno = async () => ((await api('/api/stats')).body || []).find(r => r.day === today) || {};
  const prima = await giorno();
  // gara breve a due: A lancia una banana e lascia una bomba (200 punti spesi) e arriva con 1.400 punti → 1.600 fatti; B ne fa 10
  const code = rnd();
  const A = new Client(code, 'ma' + code, 'Misura'); await A.connect(); await A.waitType('welcome');
  const B = new Client(code, 'mb' + code, 'Bersaglio'); await B.connect(); await B.waitType('welcome');
  await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  A.send({ t: 'start' }); await B.waitType('gathering', 3000);
  A.send({ t: 'pronto' }); B.send({ t: 'pronto' });
  const go = await A.waitType('go', 3000);
  await sleep(Math.max(0, (go ? go.startAt - go.now : 5000) + 300));
  A.send({ t: 'pos', x: 0, z: -20, top: 20, tk: 1, p: 1600 }); await sleep(200);
  A.send({ t: 'throw', target: B.id, hid: 'm1' }); await B.wait(m => m.t === 'throw' && m.hid === 'm1', 2000);
  await sleep(1000);
  A.send({ t: 'drop', kind: 'bomb', x: 1, z: -12, hid: 'm2' }); await B.wait(m => m.t === 'drop' && m.hid === 'm2', 2000);
  A.send({ t: 'finish', top: 20, tk: 1, p: 1400 }); B.send({ t: 'finish', top: 10, tk: 0, p: 10 });
  const res = await A.waitType('results', 4000);
  ok(!!res, 'la gara di prova finisce');
  await sleep(600);
  const dopo = await giorno();
  const d = k => (dopo[k] || 0) - (prima[k] || 0);
  ok(d('pts_n') === 2 && d('pts_1500') === 1 && d('pts_lt50') === 1 && d('pts_sum') === 1610,
    'punti fatti in gara = rimasti + spesi, contati in fasce (1.600 → fascia del bananone, 10 → sotto la banana)',
    JSON.stringify({ n: d('pts_n'), f1500: d('pts_1500'), lt50: d('pts_lt50'), somma: d('pts_sum') }));
  ok(d('use_banana') === 1 && d('use_bomb') === 1, 'oggetti usati contati per tipo', JSON.stringify({ banana: d('use_banana'), bomba: d('use_bomb') }));
  A.close(); B.close();

  // visite e tempo di caricamento
  const vis = (b) => fetch(BASE + '/api/visita', { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b) }).then(r => r.status);
  const s0 = await giorno();
  const vid = 'v' + code;
  ok(await vis({ id: vid, ms: 2500, tel: 1 }) === 200, 'POST /api/visita accettato');
  await vis({ id: vid, ms: 7000, tel: 0 });
  await vis({ id: vid, ms: -5 });
  const s1 = await giorno();
  const e = k => (s1[k] || 0) - (s0[k] || 0);
  ok(e('visitors') === 1, 'lo stesso giocatore conta una visita sola al giorno', String(e('visitors')));
  ok(e('load_tel_lt3') === 1 && e('load_pc_6_10') === 1 && e('load_n') === 2 && e('load_ms_sum') === 9500, 'tempo di caricamento in fasce, telefono o PC; un tempo non valido non si conta',
    JSON.stringify({ tel3: e('load_tel_lt3'), pc6: e('load_pc_6_10'), n: e('load_n'), somma: e('load_ms_sum') }));
  ok(await vis('{non json') === 400 && await vis({ ms: 100 }) === 400 && await vis('x'.repeat(400)) === 413, 'visita senza id o non valida rifiutata (400/413)');
  ok((await fetch(BASE + '/api/visita')).status === 405, '/api/visita accetta solo POST');

  // ritorni: risposta del server e calcolo provato con dati inventati
  const rt = await api('/api/ritorni');
  const oggiV = rt.body && rt.body.visite.giorni.find(g => g.giorno === today);
  ok(rt.status === 200 && oggiV && oggiV.nuovi >= 1 && oggiV.d1 === null && rt.body.corse && Array.isArray(rt.body.corse.giorni),
    '/api/ritorni: visite e corse per giorno di prima visita; il ritorno di domani non c\'è ancora (null)', rt.body && JSON.stringify(oggiV));
  const { ritorni } = await import('../../src/ritorni.mjs');
  const finto = ritorni([
    { id: 'a', day: '2026-10-01' }, { id: 'a', day: '2026-10-02' }, { id: 'a', day: '2026-10-08' },
    { id: 'b', day: '2026-10-01' }, { id: 'c', day: '2026-10-02' }, { id: 'c', day: '2026-10-03' }, { id: 'd', day: '2026-10-20' }
  ], '2026-10-21');
  const g1 = finto.giorni.find(g => g.giorno === '2026-10-01');
  ok(g1.nuovi === 2 && g1.d1 === 1 && g1.d7 === 1 && g1.d30 === null && finto.totale.d1.perc === 50 && finto.totale.d7.perc === 33.3,
    'ritorni calcolati giusti: D1 50%, D7 33,3%, D30 non ancora maturo', JSON.stringify(finto.totale));

  // fonte della visita (R-246): visit_<fonte> su /api/stats e ritorni divisi per fonte su /api/ritorni
  const s2 = await giorno();
  ok(await vis({ id: 'vf' + code, ms: 1000, tel: 1, fonte: 'batti' }) === 200, 'POST /api/visita con la fonte accettato');
  await vis({ id: 'vf' + code, fonte: 'portale' });            // seconda visita dello stesso giorno: non conta
  await vis({ id: 'vg' + code, fonte: 'q<script>!' });         // fonte sconosciuta o sporca → "diretto"
  const s3 = await giorno();
  const f = k => (s3[k] || 0) - (s2[k] || 0);
  ok(f('visit_batti') === 1 && f('visit_portale') === 0 && f('visit_diretto') === 1 && f('visitors') === 2,
    'la fonte conta con la prima visita del giorno; una fonte sconosciuta vale "diretto"',
    JSON.stringify({ batti: f('visit_batti'), portale: f('visit_portale'), diretto: f('visit_diretto') }));
  const rt2 = await api('/api/ritorni');
  const fonti = rt2.body && rt2.body.fonti;
  ok(rt2.status === 200 && fonti && fonti.batti && fonti.batti.giorni.some(g => g.giorno === today && g.nuovi >= 1),
    '/api/ritorni ha i ritorni divisi per la fonte della prima visita (R-246)', fonti && Object.keys(fonti).join(','));
  const { ritorniPerFonte } = await import('../../src/ritorni.mjs');
  const pf = ritorniPerFonte([
    { id: 'a', day: '2026-10-01', fonte: 'sfida' }, { id: 'a', day: '2026-10-02', fonte: 'home' },
    { id: 'b', day: '2026-10-01' }, { id: 'b', day: '2026-10-02', fonte: 'sfida' }
  ], '2026-10-03');
  ok(pf.sfida && pf.sfida.giorni[0].nuovi === 1 && pf.sfida.giorni[0].d1 === 1 && pf.diretto && pf.diretto.giorni[0].d1 === 1 && !pf.home,
    'per fonte conta la PRIMA visita: a è "sfida" anche se poi torna dalla home; b senza fonte è "diretto"', JSON.stringify(Object.keys(pf)));
}

console.log('T12 · pista del giorno (R-233): giorno italiano, città e seed uguali per tutti, stanza da soli, classifica del giorno');
{
  const G = await import('../../src/giorno.mjs');
  const gd = iso => G.giornoDi(Date.parse(iso));
  ok(gd('2026-10-25T22:59:00Z') === '2026-10-25' && gd('2026-10-25T23:00:00Z') === '2026-10-26' && gd('2026-07-01T21:59:00Z') === '2026-07-01' && gd('2026-07-01T22:00:00Z') === '2026-07-02',
    'il giorno cambia a mezzanotte italiana, con e senza ora legale');
  const giorni = Array.from({ length: 13 }, (_, i) => new Date(Date.parse('2026-10-26T12:00:00Z') + i * 86400000).toISOString().slice(0, 10));
  ok(G.numeroDi('2026-10-26') === 1 && G.scenaDi('2026-10-26') === 'napoli' && new Set(giorni.map(G.scenaDi)).size === 13 && G.scenaDi('2026-11-08') === 'napoli',
    '#1 il 26/10 a Napoli; 13 giorni di fila tutti con una città diversa, poi si ricomincia');
  ok(G.seedDi('2026-10-26') === G.seedDi('2026-10-26') && G.seedDi('2026-10-26') !== G.seedDi('2026-10-27') && G.seedDi('2026-10-26') < 2 ** 31, 'seed uguale per tutti nello stesso giorno, diverso il giorno dopo');
  const oggi = G.pistaDelGiorno();
  const a = await api('/api/giorno');
  ok(a.status === 200 && a.body.n === oggi.n && a.body.scena === oggi.scena && a.body.minuti === 5 && Array.isArray(a.body.top) && typeof a.body.of === 'number',
    '/api/giorno: numero, città, durata e classifica di oggi', JSON.stringify({ n: a.body && a.body.n, scena: a.body && a.body.scena, of: a.body && a.body.of }));

  const code = 'G' + rnd().slice(0, 5) + 'Q';
  const D = new Client(code, 'gd' + code, 'Giornata'); D.path = '/api/giorno/';
  await D.connect(); const w = await D.waitType('welcome');
  ok(w && w.daily === true && w.max === 1, 'la stanza del giorno è da soli', w && JSON.stringify({ daily: w.daily, max: w.max }));
  const lb = await D.waitType('lobby', 2000);
  ok(lb && lb.scena === oggi.scena, 'nella stanza del giorno si vede già la città di oggi', lb && lb.scena);
  const X = new Client(code, 'gx' + code, 'Intruso'); X.path = '/api/giorno/';
  await X.connect(); const fx = await X.wait(m => m.t === 'full' || m.t === '__closed', 3000);
  ok(fx && (fx.t === 'full' || fx.code === 1008), 'un secondo giocatore non entra nella stanza del giorno di un altro', fx && fx.t);
  const N = new Client(code, 'gn' + code, 'Amico'); await N.connect(); const wn = await N.waitType('welcome');
  ok(wn && !wn.daily, 'lo stesso codice nelle sfide è un\'altra stanza (non è la pista del giorno)'); N.close();

  D.send({ t: 'settings', minutes: 15 }); D.send({ t: 'scena', scena: 'roma' });
  const t0 = Date.now(); D.send({ t: 'start' });
  const g = await D.waitType('gathering', 3000);
  ok(g && g.seed === oggi.seed && g.scena === oggi.scena && g.minutes === 5 && g.giorno && g.giorno.n === oggi.n,
    'la gara del giorno ha seed, città e 5 minuti di oggi (durata e città chieste dal giocatore ignorate)', g && JSON.stringify({ seed: g.seed === oggi.seed, scena: g.scena, min: g.minutes }));
  const go = await D.waitType('go', 5000);
  ok(go && Date.now() - t0 < 4000, 'si parte appena la pista è caricata, senza i 25 s della sfida', go && String(Date.now() - t0) + ' ms');
  const Y = new Client(code, 'gy' + code, 'Altro'); Y.path = '/api/giorno/';
  const code2 = 'G' + rnd().slice(0, 5) + 'W'; Y.code = code2;
  await Y.connect(); await Y.waitType('welcome'); Y.send({ t: 'start' }); const g2 = await Y.waitType('gathering', 3000);
  ok(g2 && g2.seed === g.seed && g2.scena === g.scena, 'un altro giocatore, in un\'altra stanza, corre la stessa pista'); Y.close();
  await sleep(Math.max(0, go.startAt - go.now + 200));
  D.send({ t: 'pos', x: 0, z: -20, top: 12, tk: 1, p: 70 });
  D.send({ t: 'finish', top: 12, tk: 1, p: 70 });
  const res = await D.waitType('results', 4000);
  const r0 = res && res.results[0];
  ok(res && r0 && r0.ms === null && r0.earned === 70, 'arrivo troppo veloce non valido; da soli niente punti del primo posto, solo quelli fatti in gara', r0 && JSON.stringify({ ms: r0.ms, earned: r0.earned }));
  ok(res && res.giorno && res.giorno.n === oggi.n && res.giorno.scena === oggi.scena && res.giorno.rank === null && Array.isArray(res.giorno.top),
    'i risultati portano la pista del giorno e la sua classifica (senza tempo valido niente posizione)', res && JSON.stringify(res.giorno).slice(0, 160));
  D.send({ t: 'start' }); const g3 = await D.wait(m => m.t === 'gathering' && m.round === 2, 3000);
  ok(g3 && g3.seed === oggi.seed, 'Riprova: stessa pista del giorno'); 
  D.close(); await sleep(500);
  const D2 = new Client(code, 'gd' + code, 'Giornata'); D2.path = '/api/giorno/';
  await D2.connect(); await D2.waitType('welcome'); const lb2 = await D2.waitType('lobby', 2000);
  ok(lb2 && lb2.round === 0 && lb2.phase === 'lobby', 'chi esce lascia la stanza del giorno vuota e pulita (niente resta salvato)', lb2 && JSON.stringify({ round: lb2.round, phase: lb2.phase }));
  D2.close();
}

console.log('T13 · avversari del computer (R-234…R-238, S-39): sfida, pilota, posizioni, azioni, arrivo, sala online e pista del giorno');
{
  const AV = await import('../../src/avversari.mjs');
  ok(AV.stimaArrivo(-6000, 150000, 12000, 230769, 600000) === 300000 && AV.stimaArrivo(-150, 5000, 12000, 230769, 600000) === null && AV.stimaArrivo(-3000, 10000, 12000, 230769, 600000) === null,
    'tempo stimato a fine gara: alla velocità media fino a lì; troppo poca strada o tempo impossibile = non arrivato');
  const code = rnd();
  const A = new Client(code, 'ba' + code, 'Capo'), B = new Client(code, 'bb' + code, 'Ospite');
  await A.connect(); await A.waitType('welcome'); await B.connect(); await B.waitType('welcome');
  await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  B.send({ t: 'settings', minutes: 5, bots: 4 }); await sleep(300);
  ok((A.last('lobby').bots || 0) === 0, 'solo chi organizza sceglie gli avversari del computer');
  A.send({ t: 'settings', minutes: 5, bots: 2 });
  let lb = await B.wait(m => m.t === 'lobby' && m.bots === 2, 3000);
  ok(!!lb, 'chi organizza ne sceglie 2 e la stanza lo vede (R-237)');
  A.send({ t: 'settings', minutes: 5, bots: 9 }); await sleep(300);
  ok(A.last('lobby').bots === 2, 'più di 4 avversari non si possono scegliere');
  A.send({ t: 'start' });
  const g = await B.waitType('gathering', 3000);
  const bots = g ? g.racers.filter(r => r.bot) : [];
  ok(g && g.racers.length === 4 && bots.length === 2 && bots.every(b => b.name && b.lv && /^bot/.test(b.id)) && bots[0].lv === 'forte' && bots[1].lv === 'medio',
    'in gara 2 persone e 2 avversari, con nome e livello (misti)', g && JSON.stringify(g.racers.map(r => r.name + (r.bot ? '/' + r.lv : ''))));
  ok(g && g.pilota === A.id && bots.every(b => g.ready.includes(b.id)), 'li guida chi organizza; gli avversari hanno già alzato la mano', g && JSON.stringify({ pilota: g.pilota, ready: g.ready.length }));
  ok(g && new Set(g.racers.map(r => r.color)).size === 4, 'ognuno ha il suo colore');
  A.send({ t: 'pronto' }); B.send({ t: 'pronto' });
  const go = await B.waitType('go', 6000);
  ok(!!go, 'quando le persone sono pronte si parte (gli avversari non fanno aspettare)');
  await sleep(Math.max(0, go.startAt - go.now + 150));
  const [b1, b2] = bots;
  A.send({ t: 'pos', x: 0, z: -10 });
  A.send({ t: 'bots', b: [{ id: b1.id, x: 1, z: -300, y: 0, a: 0.1, s: 0, f: 0, g: 0, v: 40, c: 0, k: 0.8, top: 41, tk: 3, p: 220 }, { id: 'nessuno', x: 0, z: -5 }] });
  const bm = await B.waitType('bots', 2000);
  ok(bm && bm.b.length === 1 && bm.b[0].id === b1.id && bm.b[0].z === -300 && bm.b[0].p === 220, 'il pilota manda le posizioni degli avversari e gli altri le ricevono (gli sconosciuti no)', bm && JSON.stringify(bm.b));
  B.send({ t: 'bots', b: [{ id: b1.id, x: 5, z: -999 }] });
  ok(!(await A.wait(m => m.t === 'bots', 700)), 'chi non è il pilota non può muovere gli avversari');
  A.send({ t: 'drop', kind: 'bomb', x: 1, z: -290, hid: 'bd1', as: b1.id });
  const dr = await B.waitType('drop', 2000);
  ok(dr && dr.id === b1.id && dr.name === b1.name, 'il pilota lascia una bomba a nome di un avversario', dr && JSON.stringify(dr));
  B.send({ t: 'drop', kind: 'bomb', x: 1, z: -290, hid: 'bd2', as: b1.id });
  ok(!(await A.wait(m => m.t === 'drop' && m.hid === 'bd2', 700)), 'chi non è il pilota non può agire a nome di un avversario');
  await sleep(950);
  A.send({ t: 'throw', target: B.id, hid: 'bt1', kind: 'banana', as: b1.id });
  const th = await B.waitType('throw', 2000);
  ok(th && th.id === b1.id && th.target === B.id, 'un avversario lancia una banana a una persona', th && JSON.stringify(th));
  B.send({ t: 'throw', target: b2.id, hid: 'bt2', kind: 'banana' });
  const th2 = await A.wait(m => m.t === 'throw' && m.hid === 'bt2', 2000);
  ok(th2 && th2.target === b2.id, 'una persona lancia una banana a un avversario (arriva al pilota, che lo ferma)');
  A.send({ t: 'botfinish', id: b2.id, top: 30, tk: 1, p: 40 });
  const fb = await B.wait(m => m.t === 'finished' && m.id === b2.id, 2000);
  ok(fb && fb.ms === null, 'arrivo di un avversario troppo veloce: non valido, come per le persone');
  A.close();
  const pl = await B.waitType('pilota', 3000);
  ok(pl && pl.id === B.id && pl.bots.some(q => q.id === b1.id && q.z === -300), 'chi guidava esce: li prende l\'altra persona, con le ultime posizioni (S-39)', pl && JSON.stringify(pl).slice(0, 160));
  B.send({ t: 'bots', b: [{ id: b1.id, x: 1, z: -320, v: 40 }] });
  B.send({ t: 'finish', top: 20, tk: 0, p: 10 });
  const res = await B.waitType('results', 4000);
  const rb = res ? res.results.filter(r => r.bot) : [];
  ok(res && rb.length === 2 && rb.every(r => r.earned === null), 'risultati: gli avversari ci sono, con 🤖, e non prendono punti', res && JSON.stringify(res.results.map(r => [r.name, r.ms, r.bot || 0, r.earned])));
  const lbd = (await api('/api/leaderboard?min=5')).body;
  ok(!lbd.some(r => rb.some(b => b.name === r.name && /^bot/.test(b.id) && r.ms === b.ms)), 'i tempi degli avversari non vanno nella classifica generale');
  B.close();

  // sala online da soli (R-235): con "Sono pronto" si parte dopo 3 s con 3 avversari
  const q = await api('/api/quick');
  const O = new Client(q.body.code, 'bo' + Date.now(), 'Solitario'); await O.connect(); await O.waitType('welcome');
  let lo = await O.wait(m => m.t === 'lobby' && m.players.length === 1 && m.autoBot, 3000);
  if (lo && (lo.phase === 'lobby' || lo.phase === 'results')) {   // anche dopo una gara (risultati) vale lo stesso
    O.send({ t: 'ready', ready: true });
    const go2 = await O.waitType('gathering', 6000);
    const ob = go2 ? go2.racers.filter(r => r.bot) : [];
    ok(go2 && ob.length === 3 && go2.pilota === O.id && go2.racers.length === 4, 'sala online da soli: si parte con 3 avversari del computer, guidati da chi c\'è', go2 && JSON.stringify({ n: go2.racers.length, bot: ob.length, pilota: go2.pilota === O.id }));
  } else ok(false, 'sala online da soli: stanza libera trovata', lo && lo.phase);
  O.close();

  // pista del giorno (R-238): 3 avversari, niente banane nemmeno a nome loro
  const gc = 'G' + rnd().slice(0, 5) + 'B';
  const Gd = new Client(gc, 'bg' + gc, 'Mattiniero'); Gd.path = '/api/giorno/';
  await Gd.connect(); await Gd.waitType('welcome'); Gd.send({ t: 'start' });
  const gg = await Gd.waitType('gathering', 3000);
  const gb = gg ? gg.racers.filter(r => r.bot) : [];
  ok(gg && gb.length === 3 && gg.pilota === Gd.id && gb.map(b => b.lv).join() === 'forte,medio,lento', 'pista del giorno: 3 avversari (forte, medio, lento) guidati dal giocatore', gg && JSON.stringify(gb.map(b => b.lv)));
  Gd.close();
}

console.log('T14 · batti il mio tempo (R-236, S-44): pistaNumero e la pista di un giorno passato, fuori da ogni classifica');
{
  const G = await import('../../src/giorno.mjs');
  const oggi = G.pistaDelGiorno();
  const p1 = G.pistaNumero(1);
  ok(p1 && p1.n === 1 && p1.giorno === '2026-10-26' && p1.scena === G.scenaDi('2026-10-26') && p1.seed === G.seedDi('2026-10-26') && p1.minuti === 5,
    'pistaNumero(1): il 26/10, con la sua città e il suo seed', p1 && JSON.stringify({ giorno: p1.giorno, scena: p1.scena }));
  ok(G.pistaNumero(oggi.n).seed === oggi.seed && G.pistaNumero(oggi.n + 1) === null && G.pistaNumero(0) === null && G.pistaNumero('x') === null,
    'pistaNumero: oggi è la pista di oggi; domani, 0 e "x" non esistono (null)');
  // stanza della pista di un giorno passato (?n=…&b=1): si corre quella pista
  const code = 'G' + rnd().slice(0, 5) + 'R';
  const R = new Client(code + '?n=1&b=1', 'rn' + code, 'Rivincita'); R.path = '/api/giorno/';
  await R.connect(); const w = await R.waitType('welcome');
  ok(w && w.daily === true, 'il link con ?n= apre una stanza della pista del giorno');
  R.send({ t: 'start' });
  const g = await R.waitType('gathering', 3000);
  ok(g && g.seed === p1.seed && g.scena === p1.scena && g.giorno && g.giorno.n === 1,
    'si corre la pista #1 (seed e città del 26/10), non quella di oggi', g && JSON.stringify({ n: g.giorno && g.giorno.n, scena: g.scena, seedOk: g.seed === p1.seed }));
  R.close();
}

console.log('T15 · città della settimana (R-245, S-47): calendario, premio della settimana e /api/giorno');
{
  const C = (await import('../../src/settimana.mjs'));
  const CAL = C.CALENDARIO;
  const w1 = CAL.settimanaDi('2026-10-28');
  ok(w1.n === 1 && w1.scena === 'roma' && w1.premio === 'settimana1' && w1.da === '2026-10-26' && w1.a === '2026-11-01',
    'settimana #1 (26/10-1/11): Roma, maglia "settimana1"', JSON.stringify(w1));
  ok(CAL.settimanaDi('2026-11-02').n === 2 && CAL.settimanaDi('2026-11-02').scena === 'napoli' && CAL.settimanaDi('2026-10-25').n === 0,
    'il 2/11 inizia la settimana #2 (Napoli); prima del 26/10 non c\'è la settimana');
  const tredici = Array.from({ length: 13 }, (_, i) => CAL.scenaDi(i + 1));
  ok(new Set(tredici).size === 13 && CAL.scenaDi(14) === CAL.scenaDi(1), '13 settimane tutte con una città diversa, poi si ricomincia');
  ok(CAL.numeroDelPremio('settimana12') === 12 && CAL.numeroDelPremio('settimana') === 0 && CAL.numeroDelPremio('x9') === 0,
    'numeroDelPremio legge solo le maglie "settimanaN"');
  const lun = Date.parse('2026-10-28T12:00:00Z');
  ok(C.premioPerGara('roma', lun) === 'settimana1' && C.premioPerGara('napoli', lun) === '' && C.premioPerGara('napoli', Date.parse('2026-11-03T12:00:00Z')) === 'settimana2',
    'il premio arriva solo per una gara finita nella città della settimana');
  const a = await api('/api/giorno');
  const s = a.body && a.body.settimana;
  ok(a.status === 200 && s && s.n >= 1 && s.scena && CAL.numeroDelPremio(s.premio) === s.n,
    '/api/giorno porta anche la settimana di adesso (numero, città, premio)', s && JSON.stringify({ n: s.n, scena: s.scena, premio: s.premio }));
}

console.log('T16 · Gran Premio delle 21 (R-247, S-49): orario, finestra d\'ingresso, seme della sera e sale GP');
{
  const GP = await import('../../src/granpremio.mjs');
  const C = (await import('../../src/settimana.mjs'));
  const alle = iso => Date.parse(iso);
  // il 28/10/2026 l'Italia è in ora solare: le 21:00 italiane sono le 20:00 UTC
  const g21 = GP.granPremio(alle('2026-10-28T20:03:00Z'));
  ok(g21.giorno === '2026-10-28' && g21.aperto && g21.inCorso, 'alle 21:03 italiane il Gran Premio di oggi è in corso e si entra ancora', JSON.stringify({ giorno: g21.giorno, aperto: g21.aperto, inCorso: g21.inCorso }));
  const g2050 = GP.granPremio(alle('2026-10-28T19:51:00Z'));
  ok(g2050.aperto && !g2050.inCorso, 'dalle 20:50 italiane la sala è aperta ma il via non è dato');
  const g18 = GP.granPremio(alle('2026-10-28T17:00:00Z'));
  ok(g18.giorno === '2026-10-28' && !g18.aperto, 'alle 18 italiane il Gran Premio di stasera non è ancora aperto');
  const g2107 = GP.granPremio(alle('2026-10-28T20:07:00Z'));
  ok(g2107.giorno === '2026-10-29', 'alle 21:07 italiane (oltre i 6 minuti) conta già il Gran Premio di domani');
  ok(g21.chiave === 'gp:2026-10-28' && g21.seed === GP.granPremio(alle('2026-10-28T20:01:00Z')).seed && g21.seed !== g2107.seed,
    'stessa sera stesso seme per tutte le sale (chiave gp:<giorno>), sere diverse semi diversi');
  ok(g21.scena === C.settimanaCorrente(alle('2026-10-28T20:03:00Z')).scena && g21.minuti === 5,
    'il Gran Premio si corre nella città della settimana, 5 minuti', g21.scena);
  // il server: /api/gp e la sala GP01 (il via vero delle 21 non si può provare di notte: è legato all\'orologio)
  const a = await api('/api/gp');
  const b = a.body || {};
  ok(a.status === 200 && typeof b.at === 'number' && typeof b.now === 'number' && b.scena && typeof b.aperto === 'boolean' && Array.isArray(b.top),
    '/api/gp: orario del via, orologio del server, città, finestra e classifica della sera', JSON.stringify({ aperto: b.aperto, inCorso: b.inCorso, scena: b.scena }));
  const vero = GP.granPremio();
  ok(b.aperto === vero.aperto && Math.abs(b.at - vero.at) < 2000, 'l\'orario di /api/gp è quello calcolato da granPremio()');
  const q = await api('/api/quick?gp=1');
  if (vero.aperto) ok(q.status === 200 && GP.GP_RE.test(q.body && q.body.code), 'finestra aperta: /api/quick?gp=1 dà una sala GP', q.body && q.body.code);
  else ok(q.status === 409 && q.body && typeof q.body.at === 'number', 'finestra chiusa: /api/quick?gp=1 risponde 409 con l\'orario del via', String(q.status));
  const P = new Client('GP01', 'gp' + Date.now(), 'Puntuale');
  await P.connect(); const w = await P.waitType('welcome');
  const lb = await P.waitType('lobby', 2000);
  ok(w && w.pub === true && typeof w.gp === 'number' && w.gp >= 1 && lb && lb.gp === w.gp,
    'la sala GP01 è pubblica e si presenta come sala del Gran Premio (1 = aspetta il via, 2 = dopo il via)', w && String(w.gp));
  P.close();
}

if (process.env.VELOCE === '1') console.log('T8 saltata (VELOCE=1: giro rapido del cancello; il giro completo la fa ogni notte)');
else {
console.log('T8 · gara valida con attesa reale (≥ 175 s), classifica, punti, chi esce è "non arrivato", contatori');
{
  const statsBefore = (await api('/api/stats')).body;
  const code = rnd();
  const name = 'Veloce' + code.slice(0, 3);
  const A = new Client(code, 'wa' + code, name), B = new Client(code, 'wb' + code, 'Lento');
  await A.connect(); await A.waitType('welcome'); await B.connect(); await B.waitType('welcome');
  await B.wait(m => m.t === 'lobby' && m.players.length === 2, 3000);
  // la sfida si corre nella città della settimana (R-245): chi arriva con un tempo valido vince la maglia
  const sett = ((await api('/api/giorno')).body || {}).settimana || { scena: 'roma', premio: '' };
  A.send({ t: 'scena', scena: sett.scena });
  await B.wait(m => m.t === 'lobby' && m.scena === sett.scena, 3000);
  A.send({ t: 'start' }); const cd = await A.waitType('countdown');
  ok(cd && cd.scena === sett.scena, 'la gara parte nella città della settimana', cd && cd.scena);
  // nello stesso tempo una pista del giorno valida (R-233)
  const vcode = 'G' + code.slice(0, 5) + 'V';
  const V = new Client(vcode, 'gv' + code, 'Del giorno' + code.slice(0, 3)); V.path = '/api/giorno/';
  await V.connect(); await V.waitType('welcome'); V.send({ t: 'start' }); const vgo = await V.waitType('go', 5000);
  const vStart = Date.now() + (vgo ? vgo.startAt - vgo.now : 5000);
  // e una pista di un giorno passato da un link "batti il mio tempo" (R-236, S-44): valida ma fuori dalle classifiche
  const pcode = 'G' + code.slice(0, 5) + 'P';
  const pname = 'Passato' + code.slice(0, 3);
  const P = new Client(pcode + '?n=1&b=1', 'gp' + code, pname); P.path = '/api/giorno/';
  await P.connect(); await P.waitType('welcome'); P.send({ t: 'start' }); const pgo = await P.waitType('go', 5000);
  const pStart = Date.now() + (pgo ? pgo.startAt - pgo.now : 5000);
  const pScena = (P.last('gathering') || {}).scena;
  const minMs = Math.floor(4200 / 24 * 1000);   // 4,2 km a 24 m/s, il limite fisico con margine (R-242)
  console.log('   aspetto', Math.round((cd.startAt + minMs - Date.now()) / 1000), 's per un arrivo valido…');
  const pinger = setInterval(() => { A.send({ t: 'pos', x: 0, z: -100, top: 21, tk: 3, p: 210 }); B.send({ t: 'pos', x: 0, z: -90, top: 19, tk: 7, p: 50 }); V.send({ t: 'pos', x: 0, z: -80, top: 18, tk: 2, p: 90 }); P.send({ t: 'pos', x: 0, z: -70, top: 17, tk: 1, p: 60 }); }, 5000);
  await sleep(cd.startAt + minMs + 1500 - Date.now());
  A.send({ t: 'finish', top: 21, tk: 3, p: 210 });
  const fA = await A.waitType('finished', 3000);
  ok(fA && typeof fA.ms === 'number' && fA.ms >= minMs, 'arrivo valido con tempo misurato dal server', fA && String(fA.ms));
  clearInterval(pinger);
  // la pista del giorno passato (R-236): arrivo valido, ma niente classifiche
  await sleep(Math.max(0, pStart + minMs + 1500 - Date.now()));
  P.send({ t: 'finish', top: 17, tk: 1, p: 60 });
  const pf = await P.waitType('finished', 3000), pr = await P.waitType('results', 4000);
  ok(pf && typeof pf.ms === 'number' && pf.ms >= minMs, 'pista passata: arrivo valido con tempo misurato dal server', pf && String(pf.ms));
  ok(pr && pr.giorno && pr.giorno.n === 1 && pr.giorno.rivincita === true && pr.giorno.rank === undefined,
    'pista passata: i risultati dicono che è una rivincita, senza posizione del giorno', pr && JSON.stringify(pr.giorno));
  ok(pr && pr.results[0] && pr.results[0].earned === 60, 'pista passata: solo i punti fatti in gara', pr && String(pr.results[0].earned));
  P.close();
  await sleep(Math.max(0, vStart + minMs + 1500 - Date.now()));
  V.send({ t: 'finish', top: 18, tk: 2, p: 90 });
  const vf = await V.waitType('finished', 3000), vr = await V.waitType('results', 4000);
  ok(vf && typeof vf.ms === 'number' && vf.ms >= minMs, 'pista del giorno: arrivo valido con tempo misurato dal server', vf && String(vf.ms));
  const vg = vr && vr.giorno;
  ok(vg && vg.record === vf.ms && vg.best <= vf.ms && vg.rank >= 1 && vg.of >= vg.rank && vg.top.some(r => r.me && r.ms === vg.best),
    'pista del giorno: tempo nella classifica del giorno, con posizione e "sei tu" in classifica', vg && JSON.stringify({ rank: vg.rank, of: vg.of, best: vg.best }));
  ok(vr && vr.results[0].earned === 90, 'pista del giorno: punti = solo quelli fatti in gara (90)', vr && String(vr.results[0].earned));
  const ag = (await api('/api/giorno?id=' + V.id)).body;
  ok(ag && ag.rank === vg.rank && ag.best === vg.best && ag.top.some(r => r.name === V.name), '/api/giorno?id=…: posizione e migliore del giocatore', ag && JSON.stringify({ rank: ag.rank, best: ag.best }));
  V.close();
  B.close();   // l'altro se ne va: la gara finisce e lui risulta non arrivato
  const res = await A.waitType('results', 5000);
  ok(!!res, 'la gara si chiude quando non resta nessuno in pista');
  if (res) {
    const rA = res.results[0], rB = res.results[1];
    ok(rA.id === A.id && rA.ms === fA.ms && rB.id === B.id && rB.dnf && rB.ms === null, 'classifica: il valido primo, chi è uscito "non arrivato"');
    ok(rA.earned === 100 + 210 && rB.earned === 50, 'punti: 100 al vincitore + 210 rimasti; 0 + 50 al non arrivato', rA.earned + '/' + rB.earned);
    ok(rA.total === 310, 'totale del vincitore salvato sul server', String(rA.total));
    ok(res.awards.fastest.id === A.id && res.awards.tricks.id === B.id, 'premi: velocità a A (21 m/s), acrobazie a B (7)');
    if (sett.premio) ok(rA.premio === sett.premio && rB.premio === undefined,
      'maglia della settimana al solo arrivo valido nella città della settimana (R-245)', JSON.stringify({ A: rA.premio, B: rB.premio }));
  }
  const me = (await api('/api/me?id=' + A.id)).body; ok(me.points === 310 && me.races === 1 && me.wins === 1, '/api/me: punti, gare e vittorie', JSON.stringify(me));
  if (sett.premio) ok(Array.isArray(me.premi) && me.premi.includes(sett.premio), '/api/me ricorda la maglia della settimana vinta (R-245)', JSON.stringify(me.premi));
  const lbd = (await api('/api/leaderboard?min=5')).body;
  const row = lbd.find(r => r.name === name); ok(row && row.ms === fA.ms, 'tempo in classifica (5 min)', JSON.stringify(row));
  ok(!lbd.some(r => r.name === pname), 'il tempo della pista passata NON va nella classifica generale (S-44)');
  const giornoOggi = (await api('/api/giorno')).body;
  ok(!(giornoOggi.top || []).some(r => r.name === pname), 'il tempo della pista passata NON va nella classifica del giorno (S-44)');
  const lbd10 = (await api('/api/leaderboard?min=10')).body; ok(!lbd10.find(r => r.name === name), 'non compare nella classifica dei 10 min');
  const pts = (await api('/api/points')).body; ok(pts.some(r => r.name === name && r.points === 310), '/api/points lo elenca');
  const stats = (await api('/api/stats')).body;
  const today = new Date().toISOString().slice(0, 10);
  const row0 = stats.find(r => r.day === today) || {}, rowB = (statsBefore || []).find(r => r.day === today) || {};
  const d = k => (row0[k] || 0) - (rowB[k] || 0);
  // in questo blocco corrono tre gare: la sfida A-B, la pista del giorno di V (R-233) e la pista passata di P (R-236)
  ok(d('races_started') === 3 && d('races_finished') === 3 && d('racers') === 4 && d('players') >= 4, '/api/stats: gare avviate/finite, corridori e giocatori unici del giorno', JSON.stringify({ started: d('races_started'), finished: d('races_finished'), racers: d('racers'), players: d('players') }));
  ok(d('batti_gare') === 1, 'una gara partita da un link "batti il mio tempo" è contata (R-236)', String(d('batti_gare')));
  if (sett.premio) {
    const attesi = 1 + ((giornoOggi.scena === sett.scena) ? 1 : 0) + ((pScena === sett.scena) ? 1 : 0);   // A sempre; V e P solo se corrono nella città della settimana
    ok(d('settimana_gare') === attesi && d('settimana_premi') === attesi, 'gare e maglie della settimana contate (R-245)', JSON.stringify({ gare: d('settimana_gare'), premi: d('settimana_premi'), attesi }));
  }
  ok((row0.voice_reports || 0) >= 2, '/api/stats conta le segnalazioni dei vocali', String(row0.voice_reports));
  A.close();
}
}

console.log('\n' + (problems.length ? 'PROBLEMI:' : 'NESSUN PROBLEMA'));
for (const p of problems) console.log(' -', p);
process.exit(problems.length ? 1 : 0);   // esito per il cancello dei test: 1 = qualcosa non va
