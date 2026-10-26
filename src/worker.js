// C-Y-F Gaming — server delle gare.
// Ogni sfida è una "stanza" (Durable Object RaceRoom) identificata da un codice.
// - Stanze private (codice di 5 caratteri): chi la crea sceglie la durata (5, 10 o 15 minuti) e preme Parti.
// - Stanze pubbliche (ONLINE1, ONLINE2…): modalità online; la gara parte da sola quando ci sono almeno 2 giocatori.
// - Pista del giorno (/api/giorno/<codice>, R-233): una stanza da 1 giocatore, con la città e il seed del giorno;
//   il tempo lo misura il server e il migliore di ognuno va nella classifica del giorno.
// I giocatori si collegano via WebSocket; il server tiene il conto alla rovescia, dà a tutti lo stesso
// tracciato (seed), inoltra posizioni, banane e bombe, misura i tempi con il PROPRIO orologio e assegna i punti.
// Classifica dei tempi e punti collezionati stanno nel Durable Object Leaderboard (SQLite).
//
// Il server è diviso in parti (A-20): qui gli indirizzi /api/…; la stanza delle gare in stanza.mjs, la classifica in
// classifica.mjs, costanti e funzioni comuni in comune.mjs; calcoli puri in giorno.mjs, ritorni.mjs, avversari.mjs.

import { MAX_PLAYERS, DURATIONS, lengthFor, CODE_RE, PUBLIC_ROOMS, json, board, cleanId, cleanProfileCode, cleanProfile } from './comune.mjs';
import { pistaDelGiorno } from './giorno.mjs';
// le due classi dei Durable Objects devono uscire dal file principale (wrangler.jsonc)
export { RaceRoom } from './stanza.mjs';
export { Leaderboard } from './classifica.mjs';

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

    // /api/giorno/<codice> → WebSocket verso una stanza della pista del giorno (R-233): nomi separati dalle sfide
    if (url.pathname.startsWith('/api/giorno/')) {
      const code = (url.pathname.split('/')[3] || '').toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: 'Codice non valido' }, { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Serve una connessione WebSocket' }, { status: 426 });
      return env.RACE.get(env.RACE.idFromName('giorno:' + code)).fetch(request);
    }
    // /api/giorno?id=… → la pista di oggi (numero, città), la classifica del giorno e, con id, il migliore del giocatore
    if (url.pathname === '/api/giorno') {
      const g = pistaDelGiorno();
      const b = await board(env).giorno(g.giorno, 20, cleanId(url.searchParams.get('id')));
      return json({ n: g.n, giorno: g.giorno, scena: g.scena, minuti: g.minuti, ...b });
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

    // /api/profilo (R-226): POST { id, code?, data } salva le impostazioni e restituisce il codice personale
    // (lo crea la prima volta); GET ?code=… restituisce { id, data, at } per ritrovarle su un altro dispositivo
    if (url.pathname === '/api/profilo') {
      if (request.method === 'POST') {
        const body = await request.text();
        if (body.length > 2000) return json({ error: 'Troppo grande' }, { status: 413 });
        let b; try { b = JSON.parse(body); } catch (x) { return json({ error: 'JSON non valido' }, { status: 400 }); }
        const id = cleanId(b && b.id);
        if (!id) return json({ error: 'id mancante' }, { status: 400 });
        return json(await board(env).saveProfile(id, cleanProfileCode(b.code), cleanProfile(b.data)));
      }
      const code = cleanProfileCode(url.searchParams.get('code'));
      if (!code) return json({ error: 'Codice non valido' }, { status: 400 });
      const p = await board(env).profile(code);
      return p ? json(p) : json({ error: 'Codice sconosciuto' }, { status: 404 });
    }

    // /api/points → giocatori con più punti
    if (url.pathname === '/api/points') return json(await board(env).topPoints(10));

    // /api/stats → contatori aggregati degli ultimi 14 giorni
    if (url.pathname === '/api/stats') return json(await board(env).stats(14));

    // /api/visita (R-232): POST { id, ms, tel } una volta per pagina aperta del gioco, anche in allenamento:
    // conta il giocatore una volta al giorno e il tempo di caricamento (ms) in fasce, telefono o PC. Niente dati personali.
    if (url.pathname === '/api/visita') {
      if (request.method !== 'POST') return json({ error: 'Serve POST' }, { status: 405 });
      const body = await request.text();
      if (body.length > 300) return json({ error: 'Troppo grande' }, { status: 413 });
      let b; try { b = JSON.parse(body); } catch (x) { return json({ error: 'JSON non valido' }, { status: 400 }); }
      const id = cleanId(b && b.id);
      if (!id) return json({ error: 'id mancante' }, { status: 400 });
      const ms = typeof b.ms === 'number' && Number.isFinite(b.ms) && b.ms > 0 && b.ms < 600000 ? Math.round(b.ms) : 0;
      await board(env).visita(id, ms, b.tel ? 1 : 0);
      return json({ ok: true });
    }

    // /api/ritorni (R-232): quanti giocatori tornano dopo 1, 7 e 30 giorni, per giorno di prima visita.
    // "visite" = chi apre il gioco (dalla 0.16.1), "corse" = chi entra in una gara (dal 24/10)
    if (url.pathname === '/api/ritorni') return json(await board(env).ritorni());

    // /api/errors → POST: un telefono segnala un errore del gioco (anonimo); GET: errori degli ultimi giorni, raggruppati
    if (url.pathname === '/api/errors') {
      if (request.method === 'POST') {
        const body = await request.text();
        if (body.length > 8000) return json({ error: 'Troppo grande' }, { status: 413 });
        let e; try { e = JSON.parse(body); } catch (x) { return json({ error: 'JSON non valido' }, { status: 400 }); }
        await board(env).logError(e || {});
        return json({ ok: true });
      }
      const days = Math.max(1, Math.min(30, +url.searchParams.get('giorni') || 7));
      return json(await board(env).errors(days));
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Non trovato' }, { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
