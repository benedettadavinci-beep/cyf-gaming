// C-Y-F Gaming — server delle gare.
// Ogni sfida è una "stanza" (Durable Object RaceRoom) identificata da un codice.
// - Stanze private (codice di 5 caratteri): chi la crea sceglie la durata (5, 10 o 15 minuti) e preme Parti.
// - Stanze pubbliche (ONLINE1, ONLINE2…): modalità online; la gara parte da sola quando ci sono almeno 2 giocatori.
// I giocatori si collegano via WebSocket; il server tiene il conto alla rovescia, dà a tutti lo stesso
// tracciato (seed), inoltra posizioni, banane e bombe, misura i tempi con il PROPRIO orologio e assegna i punti.
// Classifica dei tempi e punti collezionati stanno nel Durable Object Leaderboard (SQLite).

import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 8;
const AVG_SPEED_MS = 40;                     // velocità media di un giocatore medio: serve a trasformare minuti in metri
const DURATIONS = [5, 10, 15];               // minuti
const lengthFor = min => min * 60 * AVG_SPEED_MS;
const MAX_SPEED_MS = 52;                     // velocità massima possibile nel gioco (m/s), con margine
const COUNTDOWN_MS = 5000;
const CODE_RE = /^[A-Z0-9]{4,8}$/;
const PUBLIC_RE = /^ONLINE\d{1,2}$/;
const PUBLIC_ROOMS = 20;
const AUTO_START_MS = 30000;                 // stanze pubbliche: la gara parte 30 s dopo che ci sono almeno 2 giocatori
const VOICE_COOLDOWN_MS = 3 * 60 * 1000;     // un messaggio vocale ogni 3 minuti per giocatore
const VOICE_MAX_CHARS = 300000;              // 8 s di WAV a 12 kHz e 16 bit sono 192 KB, cioè 256.000 caratteri in base64
const VOICE_MIME = ['audio/wav', 'audio/x-wav', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/aac'];
const DROP_KINDS = ['banana', 'bomb'];
const PLACE_POINTS = [100, 70, 50];          // punti per 1°, 2°, 3°; chi arriva dopo ne prende 30

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) }
  });
const board = env => env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global'));
const cleanId = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /api/room/ABCDE  → WebSocket verso la stanza
    if (url.pathname.startsWith('/api/room/')) {
      const code = (url.pathname.split('/')[3] || '').toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: 'Codice stanza non valido' }, { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Serve una connessione WebSocket' }, { status: 426 });
      const stub = env.RACE.get(env.RACE.idFromName(code));
      return stub.fetch(request);
    }

    // /api/quick → la stanza pubblica in cui entrare (modalità online)
    if (url.pathname === '/api/quick') {
      let best = null;
      for (let i = 1; i <= PUBLIC_ROOMS; i++) {
        const code = 'ONLINE' + i;
        let info;
        try { info = await env.RACE.get(env.RACE.idFromName(code)).info(); } catch (e) { continue; }
        if (info.players >= MAX_PLAYERS) continue;
        // meglio una sala con gente che aspetta; altrimenti una con una gara in corso; altrimenti la prima vuota
        const score = (info.phase === 'lobby' || info.phase === 'results') ? (info.players > 0 ? 3 : 1) : 2;
        if (!best || score > best.score) best = { code, score, players: info.players };
        if (score === 3) break;
      }
      return json(best ? { code: best.code, players: best.players } : { error: 'Tutte le sale sono piene' }, { status: best ? 200 : 503 });
    }

    // /api/leaderboard?min=5 → migliori tempi per la durata scelta
    if (url.pathname === '/api/leaderboard') {
      const min = DURATIONS.includes(+url.searchParams.get('min')) ? +url.searchParams.get('min') : 5;
      return json(await board(env).top(20, lengthFor(min)));
    }

    // /api/me?id=… → punti collezionati da un giocatore
    if (url.pathname === '/api/me') {
      const id = cleanId(url.searchParams.get('id'));
      if (!id) return json({ error: 'id mancante' }, { status: 400 });
      return json(await board(env).player(id));
    }

    // /api/points → giocatori con più punti
    if (url.pathname === '/api/points') return json(await board(env).topPoints(10));

    // /api/stats → contatori aggregati degli ultimi 14 giorni
    if (url.pathname === '/api/stats') return json(await board(env).stats(14));

    if (url.pathname.startsWith('/api/')) return json({ error: 'Non trovato' }, { status: 404 });
    return env.ASSETS.fetch(request);
  }
};

const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Rider';
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = null;
    this.stats = new Map();    // ultime statistiche dichiarate da ogni corridore (velocità max, acrobazie, punti gara)
    this.lastDrop = new Map();
    // i client mandano "ping" ogni 20 s: risponde il sistema senza svegliare la stanza
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async load(code) {
    if (!this.state) {
      this.state = (await this.ctx.storage.get('state')) || {
        code: code || '', phase: 'lobby', seed: 0, startAt: 0, hostId: null, racers: [], results: [], round: 0
      };
      const st = this.state;
      if (!DURATIONS.includes(st.minutes)) st.minutes = 5;
      if (st.autoAt === undefined) st.autoAt = 0;
      if (st.timeoutAt === undefined) st.timeoutAt = 0;
    }
    if (code && !this.state.code) this.state.code = code;
    this.state.pub = PUBLIC_RE.test(this.state.code);
    return this.state;
  }
  save() { return this.ctx.storage.put('state', this.state); }

  // RPC usata da /api/quick
  async info() {
    await this.load();
    return { players: this.players().length, phase: this.state.phase };
  }

  async fetch(request) {
    const code = (new URL(request.url).pathname.split('/')[3] || '').toUpperCase();
    await this.load(code);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null, name: null, ready: false, color: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  sockets(except) { return this.ctx.getWebSockets().filter(ws => ws !== except); }
  players(except) {
    return this.sockets(except)
      .map(ws => ws.deserializeAttachment())
      .filter(a => a && a.id);
  }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* socket già chiuso */ } }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.sockets(except)) {
      const a = ws.deserializeAttachment();
      if (a && a.id) { try { ws.send(s); } catch (e) {} }
    }
  }
  lobbyMsg(except) {
    const st = this.state;
    return {
      t: 'lobby', phase: st.phase, hostId: st.pub ? null : st.hostId, round: st.round, pub: st.pub,
      minutes: st.minutes, length: lengthFor(st.minutes), autoAt: st.autoAt, now: Date.now(),
      players: this.players(except).map(p => ({ id: p.id, name: p.name, ready: p.ready, color: p.color, j: p.j || '' }))
    };
  }
  fixHost(except) {
    const ids = this.players(except).map(p => p.id);
    if (!ids.includes(this.state.hostId)) this.state.hostId = ids[0] || null;
  }

  // stanze pubbliche: con almeno 2 giocatori in attesa parte il conto alla rovescia automatico
  updateAuto(except) {
    const st = this.state;
    if (!st.pub) { st.autoAt = 0; return; }
    if (st.phase !== 'lobby' && st.phase !== 'results') { st.autoAt = 0; return; }
    const list = this.players(except);
    if (list.length < 2) { st.autoAt = 0; return; }
    const now = Date.now();
    if (!st.autoAt) st.autoAt = now + AUTO_START_MS;
    if (list.every(p => p.ready)) st.autoAt = Math.min(st.autoAt, now + 3000);
  }
  async schedule() {
    const st = this.state;
    const times = [st.autoAt, (st.phase === 'countdown' || st.phase === 'racing') ? st.timeoutAt : 0].filter(Boolean);
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }

  async startRace() {
    const st = this.state;
    const list = this.players();
    if (!list.length) return;
    const now = Date.now();
    st.phase = 'countdown';
    st.round += 1;
    st.seed = (Math.random() * 2 ** 31) | 0;
    st.startAt = now + COUNTDOWN_MS;
    st.autoAt = 0;
    st.timeoutAt = st.startAt + st.minutes * 2 * 60 * 1000;   // chi non arriva entro il doppio del tempo previsto è "non arrivato"
    st.racers = list.map(p => ({ id: p.id, name: p.name, color: p.color, j: p.j || '' }));
    st.results = [];
    st.drops = 0;
    this.stats = new Map();
    for (const s of this.sockets()) { const a = s.deserializeAttachment(); if (a && a.id) { a.ready = false; s.serializeAttachment(a); } }
    await this.save();
    await this.schedule();
    board(this.env).bump('races_started').catch(() => {});
    board(this.env).bump('racers', list.length).catch(() => {});
    this.broadcast({ t: 'countdown', now, seed: st.seed, startAt: st.startAt, racers: st.racers, length: lengthFor(st.minutes), minutes: st.minutes, round: st.round });
    this.broadcast(this.lobbyMsg());
  }

  readStats(id, m) {
    const st = this.state;
    const cap = st.minutes * 1500 + 2000;
    const s = { top: num(m.top, 0, MAX_SPEED_MS), tk: Math.round(num(m.tk, 0, 999)), p: Math.round(num(m.p, 0, cap)) };
    this.stats.set(id, s);
    return s;
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string') return;
    // solo i messaggi vocali possono essere grandi
    if (raw.length > 2000 && !(raw.length <= VOICE_MAX_CHARS + 500 && raw.startsWith('{"t":"voice"'))) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const st = await this.load();
    const me = ws.deserializeAttachment() || {};
    const now = Date.now();

    if (m.t === 'hello') {
      const others = this.players(ws);
      if (others.length >= MAX_PLAYERS) { this.send(ws, { t: 'full' }); ws.close(1008, 'Stanza piena'); return; }
      const id = cleanId(m.id);
      if (!id) return;
      // stesso giocatore riconnesso da un'altra scheda: chiude la vecchia connessione
      for (const old of this.sockets(ws)) {
        const a = old.deserializeAttachment();
        if (a && a.id === id) { old.serializeAttachment({ id: null }); try { old.close(4000, 'Riconnesso altrove'); } catch (e) {} }
      }
      const used = new Set(others.map(p => p.color));
      let color = 0; while (used.has(color)) color++;
      const j = typeof m.j === 'string' && /^[a-z-]{1,24}$/.test(m.j) ? m.j : '';
      Object.assign(me, { id, name: cleanName(m.name), ready: false, color, j });
      ws.serializeAttachment(me);
      this.fixHost();
      if (!st.hostId) st.hostId = id;
      this.updateAuto();
      await this.save();
      await this.schedule();
      board(this.env).touch(id).catch(() => {});
      this.send(ws, {
        t: 'welcome', you: id, code: st.code, now, max: MAX_PLAYERS, length: lengthFor(st.minutes), minutes: st.minutes, pub: st.pub,
        phase: st.phase, seed: st.seed, startAt: st.startAt, racers: st.racers, results: st.results, awards: st.awards || null,
        voiceNext: ((st.voiceAt || {})[id] || 0) + VOICE_COOLDOWN_MS
      });
      this.broadcast(this.lobbyMsg());
      return;
    }
    if (!me.id) return;

    if (m.t === 'ready') {
      me.ready = !!m.ready;
      ws.serializeAttachment(me);
      this.updateAuto();
      await this.save();
      await this.schedule();
      this.broadcast(this.lobbyMsg());
      return;
    }

    if (m.t === 'settings') {
      if (st.pub || me.id !== st.hostId || (st.phase !== 'lobby' && st.phase !== 'results')) return;
      if (DURATIONS.includes(m.minutes)) st.minutes = m.minutes;
      await this.save();
      this.broadcast(this.lobbyMsg());
      return;
    }

    if (m.t === 'start') {
      if (st.pub || me.id !== st.hostId || (st.phase !== 'lobby' && st.phase !== 'results')) return;
      await this.startRace();
      return;
    }

    if (m.t === 'pos') {
      if (st.phase !== 'countdown' && st.phase !== 'racing') return;
      if (st.phase === 'countdown' && now >= st.startAt) st.phase = 'racing';
      this.readStats(me.id, m);
      this.broadcast({
        t: 'pos', id: me.id,
        x: num(m.x, -1e5, 1e5), z: num(m.z, -1e5, 1e5), y: num(m.y, -50, 50),
        a: num(m.a, -4, 4), s: num(m.s, -100, 100), f: num(m.f, -100, 100), g: m.g ? 1 : 0,
        v: num(m.v, 0, 60), c: m.c ? 1 : 0, k: num(m.k, -1, 1)
      }, ws);
      return;
    }

    // banane e bombe: il server controlla solo che chi le lascia sia in gara e non esageri
    if (m.t === 'drop') {
      if (st.phase !== 'racing' || !st.racers.some(r => r.id === me.id) || !DROP_KINDS.includes(m.kind)) return;
      if (now - (this.lastDrop.get(me.id) || 0) < 900) return;
      this.lastDrop.set(me.id, now);
      st.drops = (st.drops || 0) + 1;
      if (st.drops > 400) return;
      const hid = String(m.hid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
      if (!hid) return;
      this.broadcast({ t: 'drop', id: me.id, name: me.name, kind: m.kind, x: num(m.x, -1e5, 1e5), z: num(m.z, -1e5, 1e5), hid }, ws);
      return;
    }
    if (m.t === 'hit') {
      if (st.phase !== 'racing') return;
      const hid = String(m.hid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
      if (!hid) return;
      this.broadcast({ t: 'hit', hid, id: me.id, name: me.name, owner: cleanId(m.owner), kind: DROP_KINDS.includes(m.kind) ? m.kind : 'banana' }, ws);
      return;
    }

    if (m.t === 'voice') {
      if ((st.voiceBlock || {})[me.id]) { this.send(ws, { t: 'voiceBlocked' }); return; }
      const data = typeof m.data === 'string' ? m.data : '';
      const mime = VOICE_MIME.includes(m.mime) ? m.mime : null;
      if (!mime || !data || data.length > VOICE_MAX_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return;
      st.voiceAt = st.voiceAt || {};
      const next = (st.voiceAt[me.id] || 0) + VOICE_COOLDOWN_MS;
      if (now < next) { this.send(ws, { t: 'voiceWait', next, now }); return; }
      for (const k of Object.keys(st.voiceAt)) if (st.voiceAt[k] + VOICE_COOLDOWN_MS < now) delete st.voiceAt[k];
      st.voiceAt[me.id] = now;
      await this.save();
      this.send(ws, { t: 'voiceOk', next: now + VOICE_COOLDOWN_MS, now });
      this.broadcast({ t: 'voice', id: me.id, name: me.name, color: me.color, mime, data, dur: num(m.dur, 0, 15) }, ws);
      return;
    }

    // segnalazione di un vocale offensivo: con 2 segnalazioni da persone diverse
    // il server smette di inoltrare i vocali di quel giocatore in questa stanza
    if (m.t === 'reportVoice') {
      const rid = cleanId(m.id);
      if (!rid || rid === me.id) return;
      st.voiceRep = st.voiceRep || {};
      const lst = st.voiceRep[rid] = st.voiceRep[rid] || [];
      if (!lst.includes(me.id)) lst.push(me.id);
      if (lst.length > 8) lst.shift();
      if (lst.length >= 2) { st.voiceBlock = st.voiceBlock || {}; st.voiceBlock[rid] = true; }
      await this.save();
      board(this.env).reportVoice(st.code, me.id, rid).catch(() => {});
      this.send(ws, { t: 'reported' });
      return;
    }

    if (m.t === 'finish') {
      if (st.phase !== 'countdown' && st.phase !== 'racing') return;
      if (!st.racers.some(r => r.id === me.id) || st.results.some(r => r.id === me.id)) return;
      const ms = now - st.startAt;            // tempo misurato dal server
      const valid = ms >= Math.floor(lengthFor(st.minutes) / MAX_SPEED_MS * 1000);
      const s = this.readStats(me.id, m);
      st.results.push({ id: me.id, name: me.name, color: me.color, ms: valid ? ms : null, dnf: !valid, top: s.top, tk: s.tk, p: s.p });
      await this.save();
      this.broadcast({ t: 'finished', id: me.id, ms: valid ? ms : null });
      if (valid) {
        try { await board(this.env).submit(me.name, ms, lengthFor(st.minutes)); } catch (e) {}
      }
      await this.maybeEnd();
      return;
    }
  }

  async maybeEnd(except) {
    const st = this.state;
    if (st.phase !== 'countdown' && st.phase !== 'racing') return;
    const online = new Set(this.players(except).map(p => p.id));
    const waiting = st.racers.filter(r => online.has(r.id) && !st.results.some(x => x.id === r.id));
    if (waiting.length === 0) await this.endRace(except);
  }

  async endRace(except) {
    const st = this.state;
    for (const r of st.racers) {
      if (st.results.some(x => x.id === r.id)) continue;
      const s = this.stats.get(r.id) || { top: 0, tk: 0, p: 0 };
      st.results.push({ id: r.id, name: r.name, color: r.color, ms: null, dnf: true, top: s.top, tk: s.tk, p: s.p });
    }
    st.results.sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    // punti: posizione in classifica + punti rimasti dalla gara (acrobazie, bonus, meno quelli spesi)
    let place = 0;
    for (const r of st.results) {
      const pos = r.ms != null ? place++ : -1;
      r.earned = (pos < 0 ? 0 : (PLACE_POINTS[pos] ?? 30)) + (r.p || 0);
      r.won = pos === 0;
    }
    const best = (key) => st.results.reduce((a, r) => (r[key] > (a ? a[key] : 0) ? r : a), null);
    const fast = best('top'), tricks = best('tk');
    st.awards = {
      fastest: fast ? { id: fast.id, name: fast.name, color: fast.color, top: fast.top } : null,
      tricks: tricks ? { id: tricks.id, name: tricks.name, color: tricks.color, tk: tricks.tk } : null
    };
    try {
      const totals = await board(this.env).addPoints(st.results.map(r => ({ id: r.id, name: r.name, earned: r.earned, won: r.won })));
      for (const r of st.results) r.total = totals[r.id] ?? null;
    } catch (e) {}
    st.phase = 'results';
    st.timeoutAt = 0;
    board(this.env).bump('races_finished').catch(() => {});
    this.fixHost(except);
    this.updateAuto(except);
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'results', results: st.results, awards: st.awards, round: st.round, minutes: st.minutes }, except);
    this.broadcast(this.lobbyMsg(except), except);
  }

  async alarm() {
    await this.load();
    const st = this.state, now = Date.now();
    if ((st.phase === 'countdown' || st.phase === 'racing') && st.timeoutAt && now >= st.timeoutAt - 50) { await this.endRace(); return; }
    if ((st.phase === 'lobby' || st.phase === 'results') && st.autoAt && now >= st.autoAt - 50) {
      if (this.players().length >= 2) { await this.startRace(); return; }
      st.autoAt = 0;
      await this.save();
    }
    await this.schedule();
  }

  async webSocketClose(ws, code) {
    await this.load();
    const me = ws.deserializeAttachment();
    try { ws.close(1000, 'Chiusa'); } catch (e) {}
    if (!me || !me.id) return;
    this.fixHost(ws);
    if (this.players(ws).length === 0 && this.state.phase !== 'countdown' && this.state.phase !== 'racing') {
      this.state.phase = 'lobby';
      this.state.voiceRep = {};
      this.state.voiceBlock = {};
    }
    this.updateAuto(ws);
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'left', id: me.id }, ws);
    this.broadcast(this.lobbyMsg(ws), ws);
    await this.maybeEnd(ws);
  }
  async webSocketError(ws) { await this.webSocketClose(ws, 1011); }
}

export class Leaderboard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY, name TEXT NOT NULL, ms INTEGER NOT NULL, at INTEGER NOT NULL)');
    // la lunghezza della gara (prima era sempre 2.000 m)
    const cols = sql.exec('PRAGMA table_info(runs)').toArray().map(c => c.name);
    if (!cols.includes('len')) sql.exec('ALTER TABLE runs ADD COLUMN len INTEGER NOT NULL DEFAULT 2000');
    sql.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, races INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL)');
    // contatori aggregati per giorno (niente cookie, niente dati personali)
    sql.exec('CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, metric TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, metric))');
    sql.exec('CREATE TABLE IF NOT EXISTS seen (day TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (day, id))');
    sql.exec('CREATE TABLE IF NOT EXISTS voice_reports (at INTEGER NOT NULL, room TEXT NOT NULL, reporter TEXT NOT NULL, reported TEXT NOT NULL)');
  }
  day() { return new Date().toISOString().slice(0, 10); }
  async bump(metric, n = 1) {
    this.ctx.storage.sql.exec(
      'INSERT INTO stats (day, metric, value) VALUES (?, ?, ?) ON CONFLICT(day, metric) DO UPDATE SET value = value + excluded.value',
      this.day(), String(metric).slice(0, 32), Math.max(0, Math.round(n))
    );
  }
  // un giocatore conta una volta sola al giorno
  async touch(id) {
    id = cleanId(id);
    if (!id) return;
    const d = this.day(), sql = this.ctx.storage.sql;
    const had = sql.exec('SELECT 1 AS x FROM seen WHERE day = ? AND id = ?', d, id).toArray().length;
    if (!had) {
      sql.exec('INSERT OR IGNORE INTO seen (day, id) VALUES (?, ?)', d, id);
      await this.bump('players');
    }
  }
  async reportVoice(room, reporter, reported) {
    this.ctx.storage.sql.exec('INSERT INTO voice_reports (at, room, reporter, reported) VALUES (?, ?, ?, ?)', Date.now(), String(room).slice(0, 8), cleanId(reporter), cleanId(reported));
    await this.bump('voice_reports');
  }
  async stats(days = 14) {
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const rows = this.ctx.storage.sql.exec('SELECT day, metric, value FROM stats WHERE day >= ? ORDER BY day DESC', from).toArray();
    const out = {};
    for (const r of rows) (out[r.day] = out[r.day] || { day: r.day })[r.metric] = r.value;
    return Object.values(out).sort((a, b) => (a.day < b.day ? 1 : -1));
  }
  async submit(name, ms, len) {
    this.ctx.storage.sql.exec('INSERT INTO runs (name, ms, at, len) VALUES (?, ?, ?, ?)', cleanName(name), Math.round(ms), Date.now(), Math.round(len));
  }
  async top(n = 20, len = lengthFor(5)) {
    return this.ctx.storage.sql
      .exec('SELECT name, MIN(ms) AS ms FROM runs WHERE len = ? GROUP BY name ORDER BY ms ASC LIMIT ?', Math.round(len), Math.min(50, n))
      .toArray();
  }
  // aggiunge i punti della gara a ogni giocatore e restituisce i totali aggiornati
  async addPoints(list) {
    const sql = this.ctx.storage.sql, now = Date.now(), out = {};
    for (const r of list) {
      const id = cleanId(r.id);
      if (!id) continue;
      sql.exec(
        'INSERT INTO players (id, name, points, races, wins, at) VALUES (?, ?, ?, 1, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET name = excluded.name, points = points + excluded.points, races = races + 1, wins = wins + excluded.wins, at = excluded.at',
        id, cleanName(r.name), Math.max(0, Math.round(r.earned || 0)), r.won ? 1 : 0, now
      );
      const row = sql.exec('SELECT points FROM players WHERE id = ?', id).toArray()[0];
      out[id] = row ? row.points : 0;
    }
    return out;
  }
  async player(id) {
    const row = this.ctx.storage.sql.exec('SELECT name, points, races, wins FROM players WHERE id = ?', cleanId(id)).toArray()[0];
    return row || { points: 0, races: 0, wins: 0 };
  }
  async topPoints(n = 10) {
    return this.ctx.storage.sql.exec('SELECT name, points, races, wins FROM players ORDER BY points DESC LIMIT ?', Math.min(50, n)).toArray();
  }
}
