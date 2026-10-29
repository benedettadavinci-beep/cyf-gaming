// Scelta della sala e prenotazione del posto (B-04, dalla 0.26.2). Funzioni pure, senza stato e senza Durable Object,
// così si provano in Node (test_server.mjs T17). Le usa /api/quick (worker.js) e la stanza (stanza.mjs).
//
// Il baco: /api/quick sceglieva la sala contando solo chi era già dentro; tra la risposta e il saluto (`hello`) passano
// 0,1-0,5 s, e in quell'intervallo 50 persone che premono "Online" insieme vedevano tutte la stessa sala libera: 42 respinte
// con "La sfida è piena". Ora ogni sala tiene i posti PRENOTATI da /api/quick negli ultimi PRENOTAZIONE_MS: la scelta conta
// presenti + prenotati, la prenotazione è un'operazione sola nella stanza (i Durable Objects fanno una chiamata alla volta),
// e il saluto la consuma. Una prenotazione non usata scade da sola.

export const PRENOTAZIONE_MS = 10000;   // quanto dura un posto prenotato senza che arrivi il saluto

// Toglie dalla mappa { id → istante } le prenotazioni scadute e quelle di chi è già dentro. Modifica la mappa, restituisce quante restano.
export function pulisciPrenotazioni(prenotazioni, dentro, now = Date.now(), durata = PRENOTAZIONE_MS) {
  for (const [k, at] of prenotazioni) if (now - at > durata || dentro.has(k)) prenotazioni.delete(k);
  return prenotazioni.size;
}

// Prova a prenotare un posto: presenti + prenotati deve restare sotto max. Restituisce true se il posto c'è (e lo segna).
export function prenotaPosto(prenotazioni, id, presenti, max, now = Date.now()) {
  if (presenti + prenotazioni.size >= max) return false;
  prenotazioni.set(id || ('p' + now + Math.random().toString(36).slice(2, 8)), now);
  return true;
}

// Posti occupati in una sala, come li vede /api/quick: presenti più prenotati non ancora consumati
export const occupati = info => (info.players || 0) + (info.prenotati || 0);

// Sala online (ONLINE1…): le sale nell'ordine in cui provare a prenotare. Meglio una sala con gente che aspetta (anche solo
// prenotata), poi una con la gara in corso (si entra svantaggiati, R-119), poi la prima vuota. Le piene si saltano.
export function ordinaSaleOnline(infos, max) {
  const punti = i => ((i.phase === 'lobby' || i.phase === 'results') ? (occupati(i) > 0 ? 3 : 1) : 2);
  return infos.filter(i => occupati(i) < max).sort((a, b) => punti(b) - punti(a) || a.n - b.n);
}

// Sale del Gran Premio (GP01…): si riempie la prima, poi la seconda… (R-247): prima la più piena non ancora piena, a parità la prima
export function ordinaSaleGp(infos, max) {
  return infos.filter(i => occupati(i) < max).sort((a, b) => occupati(b) - occupati(a) || a.n - b.n);
}
