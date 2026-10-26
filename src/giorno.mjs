// Pista del giorno (R-233): quale giorno è (ora italiana), il suo numero, la città e il seed della pista.
// Funzioni pure, senza Cloudflare: le usa il server (src/worker.js) e le provano i test in Node.
// Il giorno cambia a mezzanotte di Roma (ora legale compresa); la #1 è il 26/10/2026 (S-40).

export const PRIMO_GIORNO = '2026-10-26';
// 13 giorni di fila tutti diversi, poi si ricomincia: due giorni di fila non hanno mai la stessa città (S-40)
export const ORDINE = ['napoli', 'neve', 'roma', 'parigi', 'londra', 'milano', 'berlino', 'madrid', 'newyork', 'zagabria', 'lisbona', 'francoforte', 'zurigo'];
export const MINUTI = 5;

const GIORNO = 86400000;
let fmt = null;
try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) {}

// ultima domenica di un mese (giorno del mese), per il ripiego senza Intl
const ultimaDomenica = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
// ora legale europea: dall'ultima domenica di marzo all'ultima di ottobre, alle 01:00 UTC
function oraLegale(ms) {
  const y = new Date(ms).getUTCFullYear();
  const da = Date.UTC(y, 2, ultimaDomenica(y, 2), 1), a = Date.UTC(y, 9, ultimaDomenica(y, 9), 1);
  return ms >= da && ms < a;
}

// 'AAAA-MM-GG' del giorno italiano in quell'istante
export function giornoDi(ms = Date.now()) {
  if (fmt) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    if (p.year && p.month && p.day) return p.year + '-' + p.month + '-' + p.day;
  }
  return new Date(ms + (oraLegale(ms) ? 2 : 1) * 3600000).toISOString().slice(0, 10);
}

// numero progressivo: #1 il primo giorno
export const numeroDi = giorno => Math.round((Date.parse(giorno + 'T00:00:00Z') - Date.parse(PRIMO_GIORNO + 'T00:00:00Z')) / GIORNO) + 1;
export const scenaDi = giorno => ORDINE[((numeroDi(giorno) - 1) % ORDINE.length + ORDINE.length) % ORDINE.length];

// seed della pista: lo stesso per tutti quel giorno (FNV-1a sul testo del giorno, 31 bit come i seed delle gare)
export function seedDi(giorno) {
  let h = 0x811c9dc5;
  const s = 'cyf-pista-del-giorno:' + giorno;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h & 0x7fffffff;
}

export function pistaDelGiorno(ms = Date.now()) {
  const giorno = giornoDi(ms);
  return { giorno, n: numeroDi(giorno), scena: scenaDi(giorno), seed: seedDi(giorno), minuti: MINUTI };
}
