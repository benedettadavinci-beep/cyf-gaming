// C-Y-F Gaming — server delle gare.
// Ogni sfida è una "stanza" (Durable Object RaceRoom) identificata da un codice di 5 caratteri.
// I giocatori si collegano via WebSocket; il server tiene il conto alla rovescia, dà a tutti lo stesso
// tracciato (seed), inoltra le posizioni e misura i tempi con il PROPRIO orologio.
// La classifica generale sta in un unico Durable Object Leaderboard con database SQLite.

import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 8;
const RACE_LENGTH_M = 2000;
const MAX_SPEED_MS = 47;                    // velocità massima possibile nel gioco (m/s), con margine
const MIN_RACE_MS = Math.floor((RACE_LENGTH_M / MAX_SPEED_MS) * 1000);
const COUNTDOWN_MS = 5000;
const RACE_TIMEOUT_MS = 4 * 60 * 1000;      // dopo 4 minuti chi non è arrivato è "non classificato"
const CODE_RE = /^[A-Z0-9]{4,8}$/;
const VOICE_COOLDOWN_MS = 3 * 60 * 1000;    // un messaggio vocale ogni 3 minuti per giocatore
const VOICE_MAX_CHARS = 200000;             // circa 150 KB di audio (base64): bastano ~10 s
const VOICE_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/aac'];

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) }
  });

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

    // /api/leaderboard → migliori tempi sui 2.000 m
    if (url.pathname === '/api/leaderboard') {
      const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global'));
      return json(await stub.top(20));
    }

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
    // i client mandano "ping" ogni 20 s: risponde il sistema senza svegliare la stanza
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async load(code) {
    if (!this.state) {
      this.state = (await this.ctx.storage.get('state')) || {
        code: code || '', phase: 'lobby', seed: 0, startAt: 0, hostId: null, racers: [], results: [], round: 0
      };
    }
    if (code && !this.state.code) this.state.code = code;
    return this.state;
  }
  save() { return this.ctx.storage.put('state', this.state); }

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
      t: 'lobby', phase: st.phase, hostId: st.hostId, round: st.round,
      players: this.players(except).map(p => ({ id: p.id, name: p.name, ready: p.ready, color: p.color }))
    };
  }
  fixHost(except) {
    const ids = this.players(except).map(p => p.id);
    if (!ids.includes(this.state.hostId)) this.state.hostId = ids[0] || null;
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
      const id = String(m.id || '').slice(0, 40);
      if (!id) return;
      // stesso giocatore riconnesso da un'altra scheda: chiude la vecchia connessione
      for (const old of this.sockets(ws)) {
        const a = old.deserializeAttachment();
        if (a && a.id === id) { old.serializeAttachment({ id: null }); try { old.close(4000, 'Riconnesso altrove'); } catch (e) {} }
      }
      const used = new Set(others.map(p => p.color));
      let color = 0; while (used.has(color)) color++;
      Object.assign(me, { id, name: cleanName(m.name), ready: false, color });
      ws.serializeAttachment(me);
      this.fixHost();
      if (!st.hostId) st.hostId = id;
      await this.save();
      this.send(ws, {
        t: 'welcome', you: id, code: st.code, now, max: MAX_PLAYERS, length: RACE_LENGTH_M,
        phase: st.phase, seed: st.seed, startAt: st.startAt, racers: st.racers, results: st.results,
        voiceNext: ((st.voiceAt || {})[id] || 0) + VOICE_COOLDOWN_MS
      });
      this.broadcast(this.lobbyMsg());
      return;
    }
    if (!me.id) return;

    if (m.t === 'ready') {
      me.ready = !!m.ready;
      ws.serializeAttachment(me);
      this.broadcast(this.lobbyMsg());
      return;
    }

    if (m.t === 'start') {
      if (me.id !== st.hostId || (st.phase !== 'lobby' && st.phase !== 'results')) return;
      const list = this.players();
      st.phase = 'countdown';
      st.round += 1;
      st.seed = (Math.random() * 2 ** 31) | 0;
      st.startAt = now + COUNTDOWN_MS;
      st.racers = list.map(p => ({ id: p.id, name: p.name, color: p.color }));
      st.results = [];
      for (const s of this.sockets()) { const a = s.deserializeAttachment(); if (a && a.id) { a.ready = false; s.serializeAttachment(a); } }
      await this.save();
      await this.ctx.storage.setAlarm(st.startAt + RACE_TIMEOUT_MS);
      this.broadcast({ t: 'countdown', now, seed: st.seed, startAt: st.startAt, racers: st.racers, length: RACE_LENGTH_M, round: st.round });
      return;
    }

    if (m.t === 'pos') {
      if (st.phase !== 'countdown' && st.phase !== 'racing') return;
      if (st.phase === 'countdown' && now >= st.startAt) st.phase = 'racing';
      this.broadcast({
        t: 'pos', id: me.id,
        x: num(m.x, -1e5, 1e5), z: num(m.z, -1e5, 1e5), y: num(m.y, -50, 50),
        a: num(m.a, -4, 4), s: num(m.s, -100, 100), f: num(m.f, -100, 100), g: m.g ? 1 : 0,
        v: num(m.v, 0, 60), c: m.c ? 1 : 0
      }, ws);
      return;
    }

    if (m.t === 'voice') {
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

    if (m.t === 'finish') {
      if (st.phase !== 'countdown' && st.phase !== 'racing') return;
      if (!st.racers.some(r => r.id === me.id) || st.results.some(r => r.id === me.id)) return;
      const ms = now - st.startAt;            // tempo misurato dal server
      const valid = ms >= MIN_RACE_MS;
      st.results.push({ id: me.id, name: me.name, color: me.color, ms: valid ? ms : null, dnf: !valid });
      await this.save();
      this.broadcast({ t: 'finished', id: me.id, ms: valid ? ms : null });
      if (valid) {
        try { await this.env.LEADERBOARD.get(this.env.LEADERBOARD.idFromName('global')).submit(me.name, ms); } catch (e) {}
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
    for (const r of st.racers) if (!st.results.some(x => x.id === r.id)) st.results.push({ id: r.id, name: r.name, color: r.color, ms: null, dnf: true });
    st.results.sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    st.phase = 'results';
    this.fixHost(except);
    await this.save();
    await this.ctx.storage.deleteAlarm();
    this.broadcast({ t: 'results', results: st.results, round: st.round }, except);
    this.broadcast(this.lobbyMsg(except), except);
  }

  async alarm() {
    await this.load();
    if (this.state.phase === 'countdown' || this.state.phase === 'racing') await this.endRace();
  }

  async webSocketClose(ws, code) {
    await this.load();
    const me = ws.deserializeAttachment();
    try { ws.close(1000, 'Chiusa'); } catch (e) {}
    if (!me || !me.id) return;
    this.fixHost(ws);
    if (this.players(ws).length === 0 && this.state.phase !== 'countdown' && this.state.phase !== 'racing') {
      this.state.phase = 'lobby';
    }
    await this.save();
    this.broadcast({ t: 'left', id: me.id }, ws);
    this.broadcast(this.lobbyMsg(ws), ws);
    await this.maybeEnd(ws);
  }
  async webSocketError(ws) { await this.webSocketClose(ws, 1011); }
}

export class Leaderboard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY, name TEXT NOT NULL, ms INTEGER NOT NULL, at INTEGER NOT NULL)');
  }
  async submit(name, ms) {
    this.ctx.storage.sql.exec('INSERT INTO runs (name, ms, at) VALUES (?, ?, ?)', cleanName(name), Math.round(ms), Date.now());
  }
  async top(n = 20) {
    return this.ctx.storage.sql
      .exec('SELECT name, MIN(ms) AS ms FROM runs GROUP BY name ORDER BY ms ASC LIMIT ?', Math.min(50, n))
      .toArray();
  }
}
