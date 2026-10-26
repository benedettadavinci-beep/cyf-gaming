// Quanti giocatori tornano (R-232): per ogni giorno di prima visita, quanti erano nuovi e quanti sono tornati
// esattamente 1, 7 e 30 giorni dopo (la "retention" classica D1, D7, D30 usata negli studi sui giochi).
// Funzione pura, senza Cloudflare: la usa il server (src/worker.js) e la provano i test in Node.
//
// righe: [{ day: 'AAAA-MM-GG', id }] (un giocatore compare al massimo una volta per giorno)
// oggi:  'AAAA-MM-GG'
// Un valore è null finché quel giorno non è ancora arrivato (per esempio D7 di chi è entrato 3 giorni fa).

const GIORNO = 86400000;
const piu = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * GIORNO).toISOString().slice(0, 10);
const perc = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
export const PASSI = [1, 7, 30];

export function ritorni(righe, oggi, quanti = 60) {
  const giorniDi = new Map();   // id → insieme dei giorni in cui è passato
  for (const r of righe) {
    if (!r || !r.id || !r.day) continue;
    if (!giorniDi.has(r.id)) giorniDi.set(r.id, new Set());
    giorniDi.get(r.id).add(r.day);
  }
  const coorti = new Map();      // giorno della prima visita → { nuovi, d1, d7, d30 }
  for (const giorni of giorniDi.values()) {
    const primo = [...giorni].sort()[0];
    if (!coorti.has(primo)) coorti.set(primo, { giorno: primo, nuovi: 0, d1: 0, d7: 0, d30: 0 });
    const c = coorti.get(primo);
    c.nuovi++;
    for (const n of PASSI) if (giorni.has(piu(primo, n))) c['d' + n]++;
  }
  const lista = [...coorti.values()].sort((a, b) => (a.giorno < b.giorno ? 1 : -1)).slice(0, quanti);
  // totale pesato sui soli giorni "maturi" per ogni passo
  const totale = {};
  for (const n of PASSI) {
    let base = 0, tornati = 0;
    for (const c of lista) {
      if (piu(c.giorno, n) > oggi) { c['d' + n] = null; continue; }
      base += c.nuovi; tornati += c['d' + n];
    }
    totale['d' + n] = { base, tornati, perc: perc(tornati, base) };
  }
  for (const c of lista) for (const n of PASSI) c['p' + n] = c['d' + n] == null ? null : perc(c['d' + n], c.nuovi);
  return { oggi, totale, giorni: lista };
}
