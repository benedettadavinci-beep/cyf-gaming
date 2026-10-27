// Città della settimana (R-245): la settimana italiana di adesso, con città e premio.
// Il calendario (settimana → città → maglia) sta in public/shared/calendario.js, uguale per gioco e server;
// qui si aggiunge solo il giorno italiano (src/giorno.mjs). Funzioni pure, provabili in Node.
import '../public/shared/calendario.js';
import { giornoDi } from './giorno.mjs';

export const CALENDARIO = globalThis.CYF_CALENDARIO;

// { n, scena, premio, da, a } della settimana in cui cade l'istante (ora italiana)
export const settimanaCorrente = (ms = Date.now()) => CALENDARIO.settimanaDi(giornoDi(ms));

// il premio della settimana per una gara finita adesso nella città data, altrimenti ''
export function premioPerGara(scena, ms = Date.now()) {
  const w = settimanaCorrente(ms);
  return w.n >= 1 && w.scena === scena ? w.premio : '';
}
