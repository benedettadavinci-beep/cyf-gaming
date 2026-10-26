// Costanti e funzioni in comune tra le parti del server (A-20): durate e lunghezze delle gare, limiti, pulizia dei dati
// che arrivano dai giocatori, risposte JSON, accesso alla classifica. Nessuno stato.
import '../public/shared/protocollo.js';
export const PROTO = globalThis.CYF_PROTOCOLLO;

export const MAX_PLAYERS = PROTO.MAX_PLAYERS;
export const AVG_SPEED_MS = 14;                     // velocità media di un giocatore medio: serve a trasformare minuti in metri
export const DURATIONS = PROTO.DURATIONS;            // minuti
export const lengthFor = min => min * 60 * AVG_SPEED_MS;
export const MAX_SPEED_MS = 24;                     // velocità massima possibile nel gioco (m/s), con margine
export const COUNTDOWN_MS = 5000;
export const GATHER_MAX_MS = 40000;                 // sala online: dopo l'avvio si aspetta che tutti abbiano caricato la gara, al massimo 40 s (R-119)
export const ATTESA_SFIDA_MS = 25000;               // sfida con gli amici: dopo "Parti" si aspettano 25 s, così chi ha l'invito fa in tempo a entrare (R-119); prima se tutti sono pronti (R-222)
export const CODE_RE = /^[A-Z0-9]{4,8}$/;
export const PUBLIC_RE = /^ONLINE\d{1,2}$/;
export const PUBLIC_ROOMS = 20;
export const AUTO_START_MS = 30000;                 // stanze pubbliche: la gara parte 30 s dopo che ci sono almeno 2 giocatori
export const VOICE_COOLDOWN_MS = 3 * 60 * 1000;     // un messaggio vocale ogni 3 minuti per giocatore
export const VOICE_MAX_CHARS = 300000;              // 8 s di WAV a 12 kHz e 16 bit sono 192 KB, cioè 256.000 caratteri in base64
export const VOICE_MIME = ['audio/wav', 'audio/x-wav', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/aac'];
export const DROP_KINDS = PROTO.DROP_KINDS;
// scenari: ogni città ha la sua pista, quindi in una gara tutti corrono nella stessa città (R-118, R-312)
export const cleanScena = PROTO.cleanScena;
export const PLACE_POINTS = [100, 70, 50];          // punti per 1°, 2°, 3°; chi arriva dopo ne prende 30
// avversari guidati dal software (R-234…R-238, S-39)
export const BOT_ATTESA_MS = 15000;                 // sala online: da soli per 15 s, poi si parte con gli avversari (R-235)
export const BOT_SALA = 3, BOT_GIORNO = 3;          // quanti nella sala online vuota e nella pista del giorno (R-238)
export const BOT_LIVELLI = ['forte', 'medio', 'lento', 'medio'];   // livelli misti
export const BOT_PILOTA_MS = 3000;                 // se chi li guida non manda le loro posizioni per 3 s, li prende un'altra persona
// misure (R-232): fasce dei punti fatti in una gara, allineate ai costi (sotto la banana, banana, bomba, bananone)
// e fasce del tempo di caricamento della pagina del gioco (3 s è la soglia dello studio di Google sui siti da telefono)
export const fasciaPunti = g => (g < PROTO.COSTI.banana ? 'pts_lt50' : g < PROTO.COSTI.bomb ? 'pts_50_149' : g < PROTO.COSTI.bananone ? 'pts_150_1499' : 'pts_1500');
export const fasciaCarico = ms => (ms < 3000 ? 'lt3' : ms < 6000 ? '3_6' : ms < 10000 ? '6_10' : 'gt10');

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) }
  });
export const board = env => env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global'));
export const cleanId = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
// capelli scelti (R-225): "forma:colore", parti vuote = a caso
export const cleanHair = h => (typeof h === 'string' && /^[a-z]{0,12}:[0-9]?$/.test(h) ? h : '');
// personaggio (R-228): pantaloni "3", casco e tavola "tipo:colore"; vuoto = normale
export const cleanGear = m => ({
  p: typeof m.p === 'string' && /^[0-9]?$/.test(m.p) ? m.p : '',
  e: cleanHair(m.e), s: cleanHair(m.s)
});
// profilo con codice personale (R-226): 8 caratteri senza lettere che si confondono (0/O, 1/I/L)
export const PROFILE_ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const cleanProfileCode = c => { const v = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-HJ-NP-Z2-9]{8}$/.test(v) ? v : ''; };
export const LANGS = ['it', 'en', 'fr', 'es'];
// solo i campi conosciuti, puliti: nome, lingua, città, maglia, capelli, pantaloni, casco, tavola
export function cleanProfile(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    name: d.name ? cleanName(d.name) : '', lang: LANGS.includes(d.lang) ? d.lang : '', scena: PROTO.SCENE.includes(d.scena) ? d.scena : '',
    j: typeof d.j === 'string' && /^[a-z-]{0,24}$/.test(d.j) ? d.j : '', h: cleanHair(d.h), ...cleanGear(d)
  };
}

export const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Rider';
export const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
