// La stanza di una gara (Durable Object RaceRoom), una per codice: sfide con gli amici, sale online (ONLINE1…) e
// stanze della pista del giorno. WebSocket con i giocatori, attesa e conto alla rovescia, stesso seme per tutti,
// inoltro di posizioni, banane, bombe e vocali, tempi misurati dal server, punti, avversari del computer (R-234).
import { DurableObject } from 'cloudflare:workers';
import { PROTO, MAX_PLAYERS, DURATIONS, lengthFor, MAX_SPEED_MS, COUNTDOWN_MS, GATHER_MAX_MS, ATTESA_SFIDA_MS, PUBLIC_RE, AUTO_START_MS, VOICE_COOLDOWN_MS, VOICE_MAX_CHARS, VOICE_MIME, DROP_KINDS, cleanScena, PLACE_POINTS, BOT_ATTESA_MS, BOT_SALA, BOT_LIVELLI, BOT_PILOTA_MS, fasciaPunti, board, cleanId, cleanHair, cleanGear, cleanJersey, cleanName, num, BOT_GIORNO } from './comune.mjs';
import { pistaDelGiorno, pistaNumero } from './giorno.mjs';
import { premioPerGara } from './settimana.mjs';
import { granPremio, GP_RE } from './granpremio.mjs';
import { stimaArrivo } from './avversari.mjs';
import { pulisciPrenotazioni, prenotaPosto } from './sale.mjs';

export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = null;
    this.stats = new Map();    // ultime statistiche dichiarate da ogni corridore (velocità max, acrobazie, punti gara)
    this.lastDrop = new Map();
    this.botUltimo = new Map();   // ultima posizione nota di ogni avversario del software (per il tempo stimato e per un nuovo pilota)
    this.botsAt = 0;              // quando il pilota ha mandato le posizioni l'ultima volta
    this.prenotazioni = new Map();   // posti prenotati da /api/quick e non ancora consumati dal saluto (B-04): id → istante
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
    // sale del Gran Premio delle 21 (R-247): pubbliche come ONLINE1…, ma partono all'ora fissa con la stessa pista
    this.state.gp = GP_RE.test(this.state.code);
    this.state.pub = PUBLIC_RE.test(this.state.code) || this.state.gp;
    return this.state;
  }
  save() { return this.ctx.storage.put('state', this.state); }

  // RPC usata da /api/quick: presenti, posti prenotati negli ultimi 10 s (B-04) e fase
  async info() {
    await this.load();
    return { players: this.players().length, prenotati: this.prenotati(), phase: this.state.phase };
  }
  // prenotazioni ancora valide: toglie quelle scadute e quelle di chi nel frattempo è entrato
  prenotati() { return pulisciPrenotazioni(this.prenotazioni, new Set(this.players().map(p => p.id))); }
  // RPC usata da /api/quick (B-04): prenota un posto se presenti + prenotati sono sotto il massimo. Una chiamata alla volta
  // per stanza (input gate dei Durable Objects), quindi 50 richieste nello stesso istante ricevono 50 risposte coerenti
  async prenota(id) {
    await this.load();
    const presenti = this.players().length;
    this.prenotati();
    const ok = prenotaPosto(this.prenotazioni, id, presenti, this.state.daily ? 1 : MAX_PLAYERS);
    return { ok, players: presenti, prenotati: this.prenotazioni.size };
  }

  async fetch(request) {
    const parts = new URL(request.url).pathname.split('/');
    const code = (parts[3] || '').toUpperCase();
    await this.load(code);
    if (parts[2] === 'giorno' && !this.state.daily) {
      this.state.daily = true;
      // R-236: chi arriva da un link "batti il mio tempo" (?b=1) e, per una pista di un giorno passato, il suo numero (?n=):
      // si corre la pista di quel giorno, ma il tempo non entra in nessuna classifica (S-44)
      const q = new URL(request.url).searchParams;
      const g = q.get('n') ? pistaNumero(q.get('n')) : null;
      this.state.rivN = g && g.n !== pistaDelGiorno().n ? g.n : 0;
      this.state.batti = q.get('b') === '1';
      await this.save();
    }
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
      t: 'lobby', phase: st.phase, hostId: st.pub ? null : st.hostId, round: st.round, pub: st.pub, gp: st.gp ? (this.gpAttivo() ? 1 : 2) : 0,   // 1 = aspetta il via delle 21, 2 = sala GP dopo il Gran Premio
      minutes: st.minutes, length: lengthFor(st.minutes), autoAt: st.autoAt, autoBot: !!st.autoBot, bots: st.nBots || 0, now: Date.now(), scena: this.roomScena(except),
      players: this.players(except).map(p => ({ id: p.id, name: p.name, ready: p.ready, color: p.color, j: p.j || '', h: p.h || '', p: p.p || '', e: p.e || '', s: p.s || '' }))
    };
  }
  // città della prossima gara: nelle sfide la sceglie chi organizza (resta anche se poi esce);
  // nelle sale pubbliche è quella di chi aspetta da più tempo
  roomScena(except) {
    const st = this.state;
    if (st.daily) return this.pistaGiorno().scena;   // pista del giorno: la città di oggi (R-233) o del giorno del link (R-236)
    if (st.gp && this.gpAttivo()) return granPremio().scena;   // Gran Premio delle 21: la città della settimana (R-247)
    const host = this.players(except).find(p => p.id === st.hostId);
    if (st.pub || !st.scena) return cleanScena(host && host.sc);
    return cleanScena(st.scena);
  }
  // pista del giorno da correre: quella di oggi, oppure quella di un giorno passato arrivata con il link (R-236)
  pistaGiorno(now = Date.now()) {
    return (this.state.rivN && pistaNumero(this.state.rivN, now)) || pistaDelGiorno(now);
  }
  fixHost(except) {
    const ids = this.players(except).map(p => p.id);
    if (!ids.includes(this.state.hostId)) this.state.hostId = ids[0] || null;
  }

  // Gran Premio (R-247): in una sala GP la prossima gara è il Gran Premio di stasera finché non è stato corso qui
  // e si è ancora nella finestra (da 10 minuti prima a 6 minuti dopo il via); poi la sala è una sala online normale
  gpAttivo(now = Date.now()) {
    const st = this.state;
    if (!st.gp) return false;
    const g = granPremio(now);
    return g.aperto && st.gpFatto !== g.giorno;
  }
  // stanze pubbliche: con almeno 2 giocatori in attesa parte il conto alla rovescia automatico; da soli, dopo 15 s
  // si parte con gli avversari guidati dal software (R-235)
  updateAuto(except) {
    const st = this.state;
    if (!st.pub || (st.phase !== 'lobby' && st.phase !== 'results')) { st.autoAt = 0; st.autoBot = false; return; }
    const list = this.players(except);
    const now = Date.now();
    if (list.length === 0) { st.autoAt = 0; st.autoBot = false; return; }
    if (this.gpAttivo(now)) {
      // Gran Premio: si parte all'ora fissa (subito se il via è già passato), con chi c'è; da soli con gli avversari del software
      const g = granPremio(now);
      st.autoAt = g.inCorso ? now + 3000 : g.at;
      st.autoBot = list.length === 1;
      return;
    }
    if (list.length === 1) {
      if (!st.autoBot || !st.autoAt) st.autoAt = now + BOT_ATTESA_MS;
      st.autoBot = true;
      if (list[0].ready) st.autoAt = Math.min(st.autoAt, now + 3000);
      return;
    }
    if (st.autoBot) { st.autoAt = 0; st.autoBot = false; }   // è arrivato qualcuno: la gara è tra persone, come prima
    if (!st.autoAt) st.autoAt = now + AUTO_START_MS;
    if (list.every(p => p.ready)) st.autoAt = Math.min(st.autoAt, now + 3000);
  }
  async schedule() {
    const st = this.state;
    const times = [st.autoAt, (st.phase === 'countdown' || st.phase === 'racing') ? st.timeoutAt : 0, st.phase === 'countdown' && !st.startAt ? st.gatherUntil : 0].filter(Boolean);
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
    // pista del giorno: seed, città e durata del giorno italiano in cui si parte (S-40)
    if (st.daily) { const g = this.pistaGiorno(now); st.giorno = g; st.seed = g.seed; st.minutes = g.minuti; st.scena = g.scena; }
    // Gran Premio delle 21 (R-247): stessa pista per tutte le sale della sera, città della settimana, 5 minuti; la classifica
    // della sera ha la chiave gp:<giorno>. Le gare successive nella stessa sala sono gare online normali
    st.gpChiave = '';
    if (this.gpAttivo(now)) { const g = granPremio(now); st.gpFatto = g.giorno; st.gpChiave = g.chiave; st.seed = g.seed; st.minutes = g.minuti; st.scena = g.scena; }
    // attesa: il conto alla rovescia di 5 s parte solo quando tutti hanno caricato la gara (o dopo 40 s)
    st.startAt = 0;
    st.gatherUntil = now + (st.pub || st.daily ? GATHER_MAX_MS : this.attesaSfida());
    st.loaded = [];
    st.ready = [];   // chi ha premuto "Sono pronto" durante l'attesa (R-222)
    st.autoAt = 0;
    st.timeoutAt = 0;
    st.racers = list.map(p => ({ id: p.id, name: p.name, color: p.color, j: p.j || '', h: p.h || '', p: p.p || '', e: p.e || '', s: p.s || '' }));
    // avversari guidati dal software (R-234): nella pista del giorno 3, nella sala online 3 se si è da soli, nella sfida quanti ne sceglie chi organizza
    const nb = Math.max(0, Math.min(st.daily ? BOT_GIORNO : st.pub ? (list.length === 1 ? BOT_SALA : 0) : (st.nBots || 0), MAX_PLAYERS - list.length));
    const bots = this.creaBot(nb, st.racers);
    st.racers.push(...bots);
    // chi li guida (S-39): chi organizza se è in gara, altrimenti la prima persona
    st.pilota = bots.length ? (list.some(p => p.id === st.hostId) ? st.hostId : list[0].id) : null;
    this.botUltimo = new Map(); this.botsAt = now;
    st.raceScena = st.daily ? st.giorno.scena : st.gpChiave ? st.scena : this.roomScena();
    st.results = [];
    st.drops = 0;
    st.spesa = {};      // punti spesi da ogni corridore in banane, bombe e bananoni (R-232)
    st.usati = {};      // oggetti usati in questa gara, per tipo (R-232)
    this.stats = new Map();
    for (const s of this.sockets()) { const a = s.deserializeAttachment(); if (a && a.id) { a.ready = false; s.serializeAttachment(a); } }
    st.ready = bots.map(b => b.id);   // gli avversari alzano subito la mano (R-237)
    await this.save();
    await this.schedule();
    board(this.env).bump('races_started').catch(() => {});
    if (bots.length) board(this.env).bump('races_bots').catch(() => {});
    if (st.daily && st.batti) board(this.env).bump('batti_gare').catch(() => {});   // gare partite da un link "batti il mio tempo" (R-236)
    if (st.gpChiave) board(this.env).bumpMany({ gp_sale: 1, gp_persone: list.length }).catch(() => {});   // Gran Premio (R-247)
    board(this.env).bump('racers', list.length).catch(() => {});
    this.broadcast({ t: 'countdown', now, seed: st.seed, startAt: 0, gatherUntil: st.gatherUntil, loaded: [], ready: st.ready, pilota: st.pilota, racers: st.racers, length: lengthFor(st.minutes), minutes: st.minutes, round: st.round, scena: st.raceScena, giorno: st.daily ? { n: st.giorno.n, giorno: st.giorno.giorno, ...(st.rivN ? { rivincita: true } : {}) } : null });
    this.broadcast(this.lobbyMsg());
  }

  // avversari guidati dal software (R-234): nomi da una lista comune, colori liberi, livelli misti. Il loro aspetto lo
  // calcola il gioco dal codice (uguale su ogni dispositivo), quindi qui bastano codice, nome, colore e livello
  creaBot(n, racers) {
    const usati = new Set(racers.map(r => r.color)), nomi = new Set(racers.map(r => r.name.toLowerCase()));
    const liberi = PROTO.NOMI_BOT.filter(x => !nomi.has(x.toLowerCase())).sort(() => Math.random() - 0.5);
    const out = [];
    for (let i = 0; i < n; i++) {
      let color = 0; while (usati.has(color) && color < MAX_PLAYERS) color++;
      usati.add(color);
      const id = 'bot' + this.state.round + 'x' + i + Math.random().toString(36).slice(2, 7);
      out.push({ id, name: liberi[i % liberi.length] || 'Rider', color: color % MAX_PLAYERS, j: '', h: '', p: '', e: '', s: '', bot: 1, lv: BOT_LIVELLI[i % BOT_LIVELLI.length] });
    }
    return out;
  }
  // chi compie un'azione: il giocatore stesso, oppure un avversario del software se lo manda il pilota (campo "as")
  attore(me, m) {
    if (!m.as) return me;
    const st = this.state, id = cleanId(m.as);
    if (me.id !== st.pilota) return null;
    const r = st.racers.find(x => x.id === id && x.bot);
    return r ? { id: r.id, name: r.name, bot: true } : null;
  }
  // un'altra persona in gara prende la guida degli avversari (S-39): chi guidava è uscito o non manda più niente
  nuovoPilota(id, except) {
    const st = this.state;
    if (!st.racers.some(r => r.bot)) return;
    if (!id) {
      const online = new Set(this.players(except).map(p => p.id));
      const r = st.racers.find(x => !x.bot && online.has(x.id));
      id = r ? r.id : null;
    }
    st.pilota = id;
    this.botsAt = Date.now();
    if (id) this.broadcast({ t: 'pilota', id, bots: [...this.botUltimo.values()] }, except);
  }

  // Attesa fissa della sfida. Solo le prove locali la accorciano con la variabile ATTESA_SFIDA_MS di wrangler dev
  // (tools/verifica/cancello.sh); online la variabile non esiste e valgono i 40 s.
  attesaSfida() {
    const v = Number(this.env && this.env.ATTESA_SFIDA_MS);
    return v >= 1000 && v <= ATTESA_SFIDA_MS ? v : ATTESA_SFIDA_MS;
  }
  // sala online: tutti i corridori ancora collegati hanno caricato la gara? allora parte il conto alla rovescia.
  // Nella sfida no: si aspettano sempre i 40 s interi (la sveglia del server chiama go() alla scadenza).
  async maybeGo(except) {
    const st = this.state;
    if (st.phase !== 'countdown' || st.startAt) return;
    const online = new Set(this.players(except).map(p => p.id));
    const here = st.racers.filter(r => online.has(r.id));
    // tutti hanno alzato la mano: si parte subito, nella sfida e nelle sale online (R-222)
    if (here.length && here.every(r => (st.ready || []).includes(r.id))) { await this.go(except); return; }
    if (!st.pub && !st.daily) return;
    const missing = here.filter(r => !st.loaded.includes(r.id));
    if (missing.length === 0) await this.go(except);
  }
  async go(except) {
    const st = this.state, now = Date.now();
    st.startAt = now + COUNTDOWN_MS;
    st.gatherUntil = 0;
    st.timeoutAt = st.startAt + st.minutes * 2 * 60 * 1000;   // chi non arriva entro il doppio del tempo previsto è "non arrivato"
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'go', now, startAt: st.startAt, loaded: st.loaded }, except);
  }

  // misure (R-232): punti spesi e oggetti usati; si mandano al Leaderboard tutti insieme a fine gara
  contaOggetto(id, kind) {
    const st = this.state;
    st.spesa = st.spesa || {}; st.usati = st.usati || {};
    st.spesa[id] = (st.spesa[id] || 0) + (PROTO.COSTI[kind] || 0);
    st.usati[kind] = (st.usati[kind] || 0) + 1;
  }
  // a fine gara: per ogni corridore i punti fatti in gara (rimasti + spesi) in fasce, la somma e gli oggetti usati
  misureGara() {
    const st = this.state, m = {};
    const add = (k, n = 1) => { m[k] = (m[k] || 0) + n; };
    for (const r of st.results) {
      if (r.bot) continue;   // gli avversari del software non contano nelle misure (S-39)
      const fatti = (r.p || 0) + ((st.spesa || {})[r.id] || 0);
      add(fasciaPunti(fatti)); add('pts_sum', fatti); add('pts_n');
    }
    for (const [k, n] of Object.entries(st.usati || {})) add('use_' + k, n);
    return m;
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
    if (PROTO.valida(m, 'client')) return;   // fuori dal contratto (tipo sconosciuto o campo mancante): si ignora
    const st = await this.load();
    const me = ws.deserializeAttachment() || {};
    const now = Date.now();

    if (m.t === 'hello') {
      // pagina vecchia ancora aperta: versione del protocollo diversa → "aggiorna la pagina" invece di errori strani
      if (m.v !== PROTO.VERSIONE) { this.send(ws, { t: 'aggiorna', v: PROTO.VERSIONE }); ws.close(4001, 'Aggiorna la pagina'); return; }
      const others = this.players(ws);
      if (others.length >= (st.daily ? 1 : MAX_PLAYERS)) { this.send(ws, { t: 'full' }); ws.close(1008, 'Stanza piena'); return; }
      const id = cleanId(m.id);
      if (!id) return;
      this.prenotazioni.delete(id);   // il posto prenotato da /api/quick è occupato davvero (B-04)
      // stesso giocatore riconnesso da un'altra scheda: chiude la vecchia connessione
      for (const old of this.sockets(ws)) {
        const a = old.deserializeAttachment();
        if (a && a.id === id) { old.serializeAttachment({ id: null }); try { old.close(4000, 'Riconnesso altrove'); } catch (e) {} }
      }
      const used = new Set(others.map(p => p.color));
      let color = 0; while (used.has(color)) color++;
      const j = cleanJersey(m.j);
      Object.assign(me, { id, name: cleanName(m.name), ready: false, color, j, h: cleanHair(m.h), ...cleanGear(m), sc: cleanScena(m.sc) });
      ws.serializeAttachment(me);
      this.fixHost();
      if (!st.hostId) st.hostId = id;
      if (!others.length) st.scena = me.sc;   // stanza vuota: chi entra organizza e porta la sua città
      // gara già avviata: chi entra ora corre lo stesso (R-119). Durante l'attesa lo si aspetta come gli altri;
      // dopo il via parte dalla linea di partenza con il tempo che corre già, quindi svantaggiato
      let joined = false;
      if ((st.phase === 'countdown' || st.phase === 'racing') && !st.racers.some(r => r.id === id) && st.racers.length < MAX_PLAYERS) {
        st.racers.push({ id, name: me.name, color, j });
        joined = true;
      }
      this.updateAuto();
      await this.save();
      await this.schedule();
      board(this.env).touch(id).catch(() => {});
      this.send(ws, {
        t: 'welcome', you: id, code: st.code, now, max: st.daily ? 1 : MAX_PLAYERS, length: lengthFor(st.minutes), minutes: st.minutes, pub: st.pub, daily: !!st.daily, gp: st.gp ? (this.gpAttivo() ? 1 : 2) : 0,
        pilota: st.pilota || null, bots: [...this.botUltimo.values()],
        phase: st.phase, seed: st.seed, startAt: st.startAt, gatherUntil: st.gatherUntil || 0, loaded: st.loaded || [], ready: st.ready || [], racers: st.racers, scena: cleanScena(st.raceScena), results: st.results, awards: st.awards || null,
        voiceNext: ((st.voiceAt || {})[id] || 0) + VOICE_COOLDOWN_MS
      });
      if (joined) this.broadcast({ t: 'racers', racers: st.racers }, ws);
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
      if (st.pub || st.daily || me.id !== st.hostId || (st.phase !== 'lobby' && st.phase !== 'results')) return;
      if (DURATIONS.includes(m.minutes)) st.minutes = m.minutes;
      if (Number.isInteger(m.bots) && m.bots >= 0 && m.bots <= PROTO.MAX_BOTS) st.nBots = m.bots;   // avversari del software (R-237)
      await this.save();
      this.broadcast(this.lobbyMsg());
      return;
    }

    if (m.t === 'pronto') {
      if (st.phase !== 'countdown' || st.startAt || !st.racers.some(r => r.id === me.id)) return;
      st.ready = st.ready || [];
      if (st.ready.includes(me.id)) return;
      st.ready.push(me.id);
      await this.save();
      this.broadcast({ t: 'gather', loaded: st.loaded, ready: st.ready, gatherUntil: st.gatherUntil, now });
      await this.maybeGo();
      return;
    }
    if (m.t === 'loaded') {
      if (st.phase !== 'countdown' || st.startAt || !st.racers.some(r => r.id === me.id) || st.loaded.includes(me.id)) return;
      st.loaded.push(me.id);
      await this.save();
      this.broadcast({ t: 'gather', loaded: st.loaded, ready: st.ready || [], gatherUntil: st.gatherUntil, now });
      await this.maybeGo();
      return;
    }

    // maglia: l'unica cosa che sceglie chi non organizza (R-118); si cambia nella stanza prima della gara
    if (m.t === 'jersey') {
      if (st.phase === 'countdown' || st.phase === 'racing') return;
      me.j = cleanJersey(m.j);
      if ('h' in m) me.h = cleanHair(m.h);   // anche i capelli (R-225)
      if ('p' in m || 'e' in m || 's' in m) Object.assign(me, cleanGear(m));   // e pantaloni, casco, tavola (R-229)
      ws.serializeAttachment(me);
      this.broadcast(this.lobbyMsg());
      return;
    }

    if (m.t === 'scena') {
      me.sc = cleanScena(m.scena);
      ws.serializeAttachment(me);
      if (!st.pub && !st.daily && me.id === st.hostId && (st.phase === 'lobby' || st.phase === 'results')) st.scena = me.sc;
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
      if (st.phase === 'countdown' && st.startAt && now >= st.startAt) st.phase = 'racing';
      this.readStats(me.id, m);
      // il pilota non manda più le posizioni degli avversari (app in secondo piano, rete persa): li prende chi è qui (S-39)
      if (st.pilota && st.pilota !== me.id && now - this.botsAt > BOT_PILOTA_MS && st.racers.some(r => r.id === me.id && !r.bot)) this.nuovoPilota(me.id);
      this.broadcast({
        t: 'pos', id: me.id,
        x: num(m.x, -1e5, 1e5), z: num(m.z, -1e5, 1e5), y: num(m.y, -50, 50),
        a: num(m.a, -4, 4), s: num(m.s, -100, 100), f: num(m.f, -100, 100), g: m.g ? 1 : 0,
        v: num(m.v, 0, 60), c: m.c ? 1 : 0, k: num(m.k, -1, 1)
      }, ws);
      return;
    }

    // banane e bombe: il server controlla solo che chi le lascia sia in gara e non esageri.
    // "as": lo fa un avversario del software, e lo può dire solo il pilota (R-234)
    if (m.t === 'drop') {
      const chi = this.attore(me, m);
      if (!chi || st.daily || st.phase !== 'racing' || !st.racers.some(r => r.id === chi.id) || !DROP_KINDS.includes(m.kind)) return;
      if (now - (this.lastDrop.get(chi.id) || 0) < 900) return;
      this.lastDrop.set(chi.id, now);
      st.drops = (st.drops || 0) + 1;
      if (st.drops > 400) return;
      const hid = String(m.hid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
      if (!hid) return;
      if (!chi.bot) this.contaOggetto(chi.id, m.kind);
      this.broadcast({ t: 'drop', id: chi.id, name: chi.name, kind: m.kind, x: num(m.x, -1e5, 1e5), z: num(m.z, -1e5, 1e5), hid }, ws);
      return;
    }
    // banana o bananone lanciati al giocatore davanti (R-224, R-231): il server li inoltra a tutti, il bersaglio si ferma 2 s (banana) o 4 s (bananone)
    if (m.t === 'throw') {
      const chi = this.attore(me, m);
      if (!chi || st.daily || st.phase !== 'racing' || !st.racers.some(r => r.id === chi.id)) return;
      const target = cleanId(m.target);
      if (!target || target === chi.id || !st.racers.some(r => r.id === target)) return;
      if (now - (this.lastDrop.get(chi.id) || 0) < 900) return;
      this.lastDrop.set(chi.id, now);
      const hid = String(m.hid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
      if (!hid) return;
      const kind = PROTO.THROW_KINDS.includes(m.kind) ? m.kind : 'banana';
      if (!chi.bot) this.contaOggetto(chi.id, kind);
      this.broadcast({ t: 'throw', id: chi.id, name: chi.name, target, hid, kind }, ws);
      return;
    }
    if (m.t === 'hit') {
      const chi = this.attore(me, m);
      if (!chi || st.phase !== 'racing') return;
      const hid = String(m.hid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
      if (!hid) return;
      this.broadcast({ t: 'hit', hid, id: chi.id, name: chi.name, owner: cleanId(m.owner), kind: DROP_KINDS.includes(m.kind) ? m.kind : 'banana' }, ws);
      return;
    }

    // posizioni degli avversari del software (R-234): solo dal pilota, un messaggio per tutti, inoltrato agli altri
    if (m.t === 'bots') {
      if ((st.phase !== 'countdown' && st.phase !== 'racing') || me.id !== st.pilota || !Array.isArray(m.b)) return;
      if (st.phase === 'countdown' && st.startAt && now >= st.startAt) st.phase = 'racing';
      this.botsAt = now;
      const out = [];
      for (const e of m.b.slice(0, MAX_PLAYERS)) {
        if (!e || typeof e !== 'object') continue;
        const id = cleanId(e.id);
        if (!st.racers.some(r => r.id === id && r.bot)) continue;
        const s = this.readStats(id, e);
        const q = {
          id, x: num(e.x, -1e5, 1e5), z: num(e.z, -1e5, 1e5), y: num(e.y, -50, 50), a: num(e.a, -4, 4), s: num(e.s, -100, 100), f: num(e.f, -100, 100),
          g: e.g ? 1 : 0, v: num(e.v, 0, 60), c: e.c ? 1 : 0, k: num(e.k, -1, 1), p: s.p, top: s.top, tk: s.tk
        };
        this.botUltimo.set(id, q);
        out.push(q);
      }
      if (out.length) this.broadcast({ t: 'bots', b: out }, ws);
      return;
    }
    // un avversario del software arriva: il tempo lo misura il server, come per le persone; niente classifica generale
    if (m.t === 'botfinish') {
      if ((st.phase !== 'countdown' && st.phase !== 'racing') || me.id !== st.pilota) return;
      const id = cleanId(m.id), r = st.racers.find(x => x.id === id && x.bot);
      if (!r || st.results.some(x => x.id === id) || !st.startAt || now < st.startAt) return;
      const ms = now - st.startAt;
      const valid = ms >= Math.floor(lengthFor(st.minutes) / MAX_SPEED_MS * 1000);
      const s = this.readStats(id, m);
      st.results.push({ id, name: r.name, color: r.color, ms: valid ? ms : null, dnf: !valid, top: s.top, tk: s.tk, p: s.p, bot: 1 });
      await this.save();
      this.broadcast({ t: 'finished', id, ms: valid ? ms : null });
      return;
    }

    if (m.t === 'voice') {
      if (st.daily) return;   // da soli non c'è nessuno da sentire (S-40)
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
      if (!st.startAt || now < st.startAt) return;   // nessuno può arrivare prima del via
      const ms = now - st.startAt;            // tempo misurato dal server
      const valid = ms >= Math.floor(lengthFor(st.minutes) / MAX_SPEED_MS * 1000);
      const s = this.readStats(me.id, m);
      st.results.push({ id: me.id, name: me.name, color: me.color, ms: valid ? ms : null, dnf: !valid, top: s.top, tk: s.tk, p: s.p });
      await this.save();
      this.broadcast({ t: 'finished', id: me.id, ms: valid ? ms : null });
      // pista di un giorno passato rifatta dal link (R-236): il tempo non entra in nessuna classifica (S-44)
      if (valid && !st.rivN) {
        try { await board(this.env).submit(me.name, ms, lengthFor(st.minutes)); } catch (e) {}
        // pista del giorno: il migliore di ognuno nella classifica del giorno in cui è partito (R-233, S-40)
        if (st.daily && st.giorno) { try { st.esitoGiorno = await board(this.env).submitGiorno(st.giorno.giorno, me.id, me.name, ms); } catch (e) {} }
        // Gran Premio: il migliore di ognuno nella classifica della sera, tutte le sale insieme (R-247)
        if (st.gpChiave) { try { await board(this.env).submitGiorno(st.gpChiave, me.id, me.name, ms); } catch (e) {} }
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
    const st = this.state, now = Date.now();
    const minMs = Math.floor(lengthFor(st.minutes) / MAX_SPEED_MS * 1000);
    for (const r of st.racers) {
      if (st.results.some(x => x.id === r.id)) continue;
      const s = this.stats.get(r.id) || { top: 0, tk: 0, p: 0 };
      // avversari del software ancora in pista: tempo calcolato dalla loro velocità media fino a ora (S-39), così nessuno aspetta
      const u = r.bot ? this.botUltimo.get(r.id) : null;
      const ms = u && st.startAt ? stimaArrivo(u.z, now - st.startAt, lengthFor(st.minutes), minMs, st.minutes * 2 * 60 * 1000) : null;
      st.results.push({ id: r.id, name: r.name, color: r.color, ms, dnf: ms == null, top: s.top, tk: s.tk, p: s.p, ...(r.bot ? { bot: 1 } : {}) });
    }
    st.results.sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    // punti: posizione in classifica + punti rimasti dalla gara (acrobazie, bonus, meno quelli spesi)
    let place = 0;
    for (const r of st.results) {
      const pos = r.ms != null ? place++ : -1;
      r.earned = (pos < 0 || st.daily ? 0 : (PLACE_POINTS[pos] ?? 30)) + (r.p || 0);   // pista del giorno: da soli, niente punti del piazzamento (S-40)
      r.won = pos === 0;
      if (r.bot) r.earned = null;   // gli avversari del software non prendono punti (S-39); il piazzamento delle persone li conta
    }
    const best = (key) => st.results.reduce((a, r) => (r[key] > (a ? a[key] : 0) ? r : a), null);
    const fast = best('top'), tricks = best('tk');
    st.awards = {
      fastest: fast ? { id: fast.id, name: fast.name, color: fast.color, top: fast.top, bot: fast.bot ? 1 : 0 } : null,
      tricks: tricks ? { id: tricks.id, name: tricks.name, color: tricks.color, tk: tricks.tk, bot: tricks.bot ? 1 : 0 } : null
    };
    try {
      const totals = await board(this.env).addPoints(st.results.filter(r => !r.bot).map(r => ({ id: r.id, name: r.name, earned: r.earned, won: r.won })));
      for (const r of st.results) r.total = totals[r.id] ?? null;
    } catch (e) {}
    // città della settimana (R-245): chi finisce la gara nella città in evidenza vince la maglia della settimana; la decide
    // e la ricorda il server (nei risultati "premio" solo per chi la vince adesso)
    const premio = premioPerGara(st.raceScena, now);
    if (premio) {
      let gare = 0, nuovi = 0;
      for (const r of st.results) {
        if (r.bot || r.ms == null) continue;
        gare++;
        try { if ((await board(this.env).premia(r.id, premio)).nuovo) { r.premio = premio; nuovi++; } } catch (e) {}
      }
      if (gare) board(this.env).bumpMany({ settimana_gare: gare, settimana_premi: nuovi }).catch(() => {});
    }
    st.phase = 'results';
    st.timeoutAt = 0;
    board(this.env).bump('races_finished').catch(() => {});
    board(this.env).bumpMany(this.misureGara()).catch(() => {});
    this.fixHost(except);
    this.updateAuto(except);
    await this.save();
    await this.schedule();
    let giorno = null;
    if (st.daily && st.giorno && st.rivN) giorno = { n: st.giorno.n, giorno: st.giorno.giorno, scena: st.giorno.scena, rivincita: true };
    else if (st.daily && st.giorno) {
      try { giorno = { n: st.giorno.n, giorno: st.giorno.giorno, scena: st.giorno.scena, ...(st.esitoGiorno || {}), ...(await board(this.env).giorno(st.giorno.giorno, 10, (st.racers[0] || {}).id)) }; } catch (e) {}
      st.esitoGiorno = null;
    }
    // Gran Premio (R-247): la classifica della sera (primi 10 di tutte le sale); la propria posizione la chiede il gioco a /api/gp
    let gp = null;
    if (st.gpChiave) { try { gp = { giorno: st.gpFatto, scena: st.raceScena, ...(await board(this.env).giorno(st.gpChiave, 10, '')) }; } catch (e) {} }
    this.broadcast({ t: 'results', results: st.results, awards: st.awards, round: st.round, minutes: st.minutes, giorno, gp }, except);
    this.broadcast(this.lobbyMsg(except), except);
  }

  async alarm() {
    await this.load();
    const st = this.state, now = Date.now();
    if (st.phase === 'countdown' && !st.startAt && st.gatherUntil && now >= st.gatherUntil - 50) { await this.go(); return; }   // 40 s scaduti: si parte con chi c'è
    if ((st.phase === 'countdown' || st.phase === 'racing') && st.timeoutAt && now >= st.timeoutAt - 50) { await this.endRace(); return; }
    if ((st.phase === 'lobby' || st.phase === 'results') && st.autoAt && now >= st.autoAt - 50) {
      if (this.players().length >= (st.autoBot ? 1 : 2)) { await this.startRace(); return; }   // da soli: con gli avversari del software (R-235)
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
    // chi guidava gli avversari del software è uscito durante la gara: li prende un'altra persona (S-39)
    if ((this.state.phase === 'countdown' || this.state.phase === 'racing') && this.state.pilota === me.id) this.nuovoPilota(null, ws);
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
    if (this.state.phase === 'countdown') await this.maybeGo(ws);   // chi esce durante l'attesa non blocca gli altri
    // pista del giorno: quando il giocatore se ne va la stanza non serve più (non resta niente salvato)
    if (this.state.daily && this.players(ws).length === 0) {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.state = null;
    }
  }
  async webSocketError(ws) { await this.webSocketClose(ws, 1011); }
}
