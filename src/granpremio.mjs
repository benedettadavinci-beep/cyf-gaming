// Gran Premio delle 21 (R-247, S-49): la gara ad appuntamento fisso, ogni sera alla stessa ora italiana, nella città
// della settimana, con la stessa pista per tutte le sale. Funzioni pure, provabili in Node: le usa il server
// (src/worker.js e src/stanza.mjs); il gioco riceve l'orario da /api/gp e non calcola niente da solo.
import { giornoDi, seedDi, MINUTI } from './giorno.mjs';
import { settimanaCorrente } from './settimana.mjs';

export const ORA_GP = 21;                      // ora italiana della partenza (una costante: un secondo orario si aggiunge qui)
export const MINUTO_GP = 0;
export const APERTURA_MS = 10 * 60 * 1000;     // si entra nella sala da 10 minuti prima
export const RITARDO_MS = 6 * 60 * 1000;       // fino a 6 minuti dopo il via si entra ancora (svantaggiati, R-119)
export const SALE_GP = 8;                      // GP01…GP08, 8 persone l'una
export const GP_RE = /^GP\d{2}$/;

let fmt = null;
try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) {}
// ultima domenica di un mese (giorno del mese), per il ripiego senza Intl
const ultimaDomenica = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
function oraLegale(ms) {
  const y = new Date(ms).getUTCFullYear();
  const da = Date.UTC(y, 2, ultimaDomenica(y, 2), 1), a = Date.UTC(y, 9, ultimaDomenica(y, 9), 1);
  return ms >= da && ms < a;
}
// secondi dalla mezzanotte italiana, nell'istante dato
function secondiDelGiorno(ms) {
  if (fmt) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    if (p.hour != null) return (+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second);
  }
  const d = new Date(ms + (oraLegale(ms) ? 2 : 1) * 3600000);
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}
// l'istante (ms) del Gran Premio del giorno italiano che contiene ms (anche se è già passato)
export function gpDelGiorno(ms = Date.now()) {
  const s = secondiDelGiorno(ms);
  return Math.round(ms / 1000) * 1000 - s * 1000 + (ORA_GP * 3600 + MINUTO_GP * 60) * 1000;
}
// la chiave della classifica della sera (stessa tabella della pista del giorno, S-49)
export const chiaveGP = giorno => 'gp:' + giorno;

// Il Gran Premio che conta adesso: quello di oggi finché si può ancora entrare (fino a 6 minuti dopo il via), altrimenti
// il prossimo. { at, giorno, scena, seed, minuti, aperto (si può entrare), inCorso (il via è già stato dato), chiave }
export function granPremio(ms = Date.now()) {
  let at = gpDelGiorno(ms);
  if (ms > at + RITARDO_MS) at = gpDelGiorno(at + 24 * 3600000);   // domani (l'ora legale cambia di notte, non tra le 21 e le 21)
  const giorno = giornoDi(at);
  const w = settimanaCorrente(at);
  return {
    at, giorno, scena: w.n >= 1 ? w.scena : 'neve', seed: seedDi(chiaveGP(giorno)), minuti: MINUTI, chiave: chiaveGP(giorno),
    aperto: ms >= at - APERTURA_MS && ms <= at + RITARDO_MS, inCorso: ms >= at && ms <= at + RITARDO_MS
  };
}
