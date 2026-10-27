// Classifica e contatori (Durable Object Leaderboard, SQLite): tempi per durata, pista del giorno, punti collezionati,
// profili con il codice personale, premi (maglie della settimana), contatori d'uso e misure, visite e ritorni, segnalazioni dei vocali, errori dei browser.
import { DurableObject } from 'cloudflare:workers';
import { lengthFor, fasciaCarico, cleanId, PROFILE_ALPH, cleanName } from './comune.mjs';
import { ritorni } from './ritorni.mjs';

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
    // chi apre la pagina del gioco, anche solo per allenarsi: una riga per giocatore e giorno (R-232)
    sql.exec('CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (day, id))');
    // pista del giorno (R-233): il tempo migliore di ogni giocatore per ogni giorno italiano
    sql.exec('CREATE TABLE IF NOT EXISTS giorno (day TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, ms INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 1, at INTEGER NOT NULL, PRIMARY KEY (day, id))');
    sql.exec('CREATE TABLE IF NOT EXISTS voice_reports (at INTEGER NOT NULL, room TEXT NOT NULL, reporter TEXT NOT NULL, reported TEXT NOT NULL)');
    // errori arrivati dai browser dei giocatori: uno per giorno, versione, messaggio e punto del codice, con il conteggio
    // profili con il codice personale (R-226): il codice è la chiave, id è il giocatore che lo usa
    sql.exec('CREATE TABLE IF NOT EXISTS profiles (code TEXT PRIMARY KEY, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL)');
    // premi vinti da ogni giocatore (R-245): per ora le maglie della settimana ("settimana3"); li assegna solo il server
    sql.exec('CREATE TABLE IF NOT EXISTS premi (id TEXT NOT NULL, premio TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (id, premio))');
    sql.exec('CREATE TABLE IF NOT EXISTS errors (day TEXT NOT NULL, ver TEXT NOT NULL, msg TEXT NOT NULL, src TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 1, first INTEGER NOT NULL, last INTEGER NOT NULL, ua TEXT, stack TEXT, ctx TEXT, PRIMARY KEY (day, ver, msg, src))');
  }
  async logError(e) {
    const s = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n);
    const sql = this.ctx.storage.sql, now = Date.now(), d = this.day();
    const ver = s(e.ver, 16) || '?', msg = s(e.msg, 300) || '?', src = s(e.src, 160);
    const old = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
    sql.exec('DELETE FROM errors WHERE day < ?', old);
    const known = sql.exec('SELECT 1 AS x FROM errors WHERE day = ? AND ver = ? AND msg = ? AND src = ?', d, ver, msg, src).toArray().length;
    // tetto di sicurezza: oltre 1.000 righe diverse si contano solo quelle già note
    if (!known && sql.exec('SELECT COUNT(*) AS c FROM errors').toArray()[0].c >= 1000) return;
    sql.exec(
      'INSERT INTO errors (day, ver, msg, src, n, first, last, ua, stack, ctx) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(day, ver, msg, src) DO UPDATE SET n = n + 1, last = excluded.last, ua = COALESCE(NULLIF(excluded.ua, \'\'), ua), stack = COALESCE(NULLIF(excluded.stack, \'\'), stack), ctx = COALESCE(NULLIF(excluded.ctx, \'\'), ctx)',
      d, ver, msg, src, now, now, s(e.ua, 160), s(e.stack, 1500), s(e.ctx, 600)
    );
    await this.bump('errors');
  }
  async errors(days = 7) {
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return this.ctx.storage.sql
      .exec('SELECT day, ver, msg, src, n, first, last, ua, stack, ctx FROM errors WHERE day >= ? ORDER BY last DESC LIMIT 200', from)
      .toArray();
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
  // più contatori in una chiamata sola (fine gara)
  async bumpMany(m) {
    for (const [k, n] of Object.entries(m || {})) if (n > 0) await this.bump(k, n);
  }
  // R-232: una visita al giorno per giocatore e il tempo di caricamento in fasce (telefono o PC)
  async visita(id, ms, tel) {
    const d = this.day(), sql = this.ctx.storage.sql;
    const had = sql.exec('SELECT 1 AS x FROM visits WHERE day = ? AND id = ?', d, id).toArray().length;
    if (!had) {
      sql.exec('INSERT OR IGNORE INTO visits (day, id) VALUES (?, ?)', d, id);
      await this.bump('visitors');
    }
    if (ms) {
      await this.bump('load_' + (tel ? 'tel' : 'pc') + '_' + fasciaCarico(ms));
      await this.bump('load_ms_sum', ms);
      await this.bump('load_n');
    }
  }
  // R-232: ritorni dopo 1, 7 e 30 giorni, su chi apre il gioco e su chi corre (ultimi 120 giorni)
  async ritorni() {
    const sql = this.ctx.storage.sql, oggi = this.day();
    const da = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    return {
      visite: ritorni(sql.exec('SELECT day, id FROM visits WHERE day >= ?', da).toArray(), oggi),
      corse: ritorni(sql.exec('SELECT day, id FROM seen WHERE day >= ?', da).toArray(), oggi)
    };
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
  // R-233: salva il tempo del giorno (resta il migliore) e restituisce posizione, quanti in classifica e il migliore
  async submitGiorno(day, id, name, ms) {
    const sql = this.ctx.storage.sql;
    id = cleanId(id);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    sql.exec(
      'INSERT INTO giorno (day, id, name, ms, tries, at) VALUES (?, ?, ?, ?, 1, ?) ' +
      'ON CONFLICT(day, id) DO UPDATE SET name = excluded.name, tries = tries + 1, at = CASE WHEN excluded.ms < ms THEN excluded.at ELSE at END, ms = MIN(ms, excluded.ms)',
      day, id, cleanName(name), Math.round(ms), Date.now()
    );
    const old = new Date(Date.parse(day + 'T00:00:00Z') - 400 * 86400000).toISOString().slice(0, 10);
    sql.exec('DELETE FROM giorno WHERE day < ?', old);
    return { ...this.posGiorno(day, id), record: Math.round(ms) };
  }
  posGiorno(day, id) {
    const sql = this.ctx.storage.sql;
    const row = sql.exec('SELECT ms FROM giorno WHERE day = ? AND id = ?', day, id).toArray()[0];
    const of = sql.exec('SELECT COUNT(*) AS c FROM giorno WHERE day = ?', day).toArray()[0].c;
    if (!row) return { best: null, rank: null, of };
    const rank = sql.exec('SELECT COUNT(*) AS c FROM giorno WHERE day = ? AND ms < ?', day, row.ms).toArray()[0].c + 1;
    return { best: row.ms, rank, of };
  }
  // classifica del giorno (a pari tempo vince chi l'ha fatto prima) e, con id, la posizione del giocatore
  async giorno(day, n = 20, id = '') {
    const top = this.ctx.storage.sql
      .exec('SELECT id, name, ms FROM giorno WHERE day = ? ORDER BY ms ASC, at ASC LIMIT ?', day, Math.min(50, n)).toArray()
      .map(r => ({ name: r.name, ms: r.ms, me: !!id && r.id === id }));
    const mine = id ? this.posGiorno(day, cleanId(id)) : { of: this.posGiorno(day, '').of };
    return { top, ...mine };
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
    return { ...(row || { points: 0, races: 0, wins: 0 }), premi: this.premiDi(id) };
  }
  // R-245: assegna un premio (maglia della settimana) a un giocatore; dice se è nuovo
  async premia(id, premio) {
    id = cleanId(id); premio = String(premio || '').replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (!id || !premio) return { nuovo: false };
    const sql = this.ctx.storage.sql;
    const had = sql.exec('SELECT 1 AS x FROM premi WHERE id = ? AND premio = ?', id, premio).toArray().length;
    if (had) return { nuovo: false };
    sql.exec('INSERT OR IGNORE INTO premi (id, premio, at) VALUES (?, ?, ?)', id, premio, Date.now());
    return { nuovo: true };
  }
  premiDi(id) {
    id = cleanId(id);
    if (!id) return [];
    return this.ctx.storage.sql.exec('SELECT premio FROM premi WHERE id = ? ORDER BY at ASC LIMIT 200', id).toArray().map(r => r.premio);
  }
  async saveProfile(id, code, data) {
    const sql = this.ctx.storage.sql, at = Date.now();
    if (code && sql.exec('SELECT 1 AS x FROM profiles WHERE code = ?', code).toArray().length) {
      sql.exec('UPDATE profiles SET id = ?, data = ?, at = ? WHERE code = ?', id, JSON.stringify(data), at, code);
      return { code, at };
    }
    if (sql.exec('SELECT COUNT(*) AS c FROM profiles').toArray()[0].c >= 200000) return { error: 'pieno' };
    let c = '';
    do { c = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => PROFILE_ALPH[b % PROFILE_ALPH.length]).join(''); }
    while (sql.exec('SELECT 1 AS x FROM profiles WHERE code = ?', c).toArray().length);
    sql.exec('INSERT INTO profiles (code, id, data, at) VALUES (?, ?, ?, ?)', c, id, JSON.stringify(data), at);
    return { code: c, at };
  }
  async profile(code) {
    const row = this.ctx.storage.sql.exec('SELECT id, data, at FROM profiles WHERE code = ?', code).toArray()[0];
    if (!row) return null;
    let data = {}; try { data = JSON.parse(row.data); } catch (e) {}
    return { id: row.id, data, at: row.at };
  }
  async topPoints(n = 10) {
    return this.ctx.storage.sql.exec('SELECT name, points, races, wins FROM players ORDER BY points DESC LIMIT ?', Math.min(50, n)).toArray();
  }
}
