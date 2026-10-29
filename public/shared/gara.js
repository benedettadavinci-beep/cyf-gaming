// modulo: gara
// dipende da: nessuno
// Regole di fine gara condivise tra server e gioco (R-519, dalla 0.28.0): tempo minimo possibile, tempo stimato di un
// avversario del computer ancora in pista, classifica finale con i punti del piazzamento e i premi (⚡ più veloce,
// 🤸 più acrobazie). Funzioni pure, senza orologio, senza rete, senza DOM: si provano in Node.
//
// Lo stesso file gira nel browser (tag <script>: PN.gara, usato dall'allenamento-gara locale in moduli/gara_locale.js)
// e nel server (import '../public/shared/gara.js', poi globalThis.CYF_GARA: src/avversari.mjs e src/comune.mjs),
// come shared/protocollo.js. Niente import/export.
globalThis.CYF_GARA = (() => {
  const VEL_MAX_MS = 24;                       // velocità massima possibile nel gioco (m/s), con margine: sotto il tempo minimo l'arrivo non vale
  const PUNTI_POSTO = [100, 70, 50];           // punti per 1°, 2°, 3°; chi arriva dopo ne prende 30
  const PUNTI_ALTRI = 30;
  const tempoMinimoMs = len => Math.floor(len / VEL_MAX_MS * 1000);

  // Tempo stimato di un avversario ancora in pista quando le persone sono tutte arrivate: va avanti alla sua velocità
  // media fino a quel momento. z: ultima posizione nota (negativa, si scende verso -z), el: ms dal via, len: metri della
  // gara. Restituisce i ms, oppure null se ha fatto troppo poca strada (meno di 200 m) o se il tempo è impossibile
  // (più veloce di minMs, il limite fisico) o oltre maxMs ("non arrivato").
  function stimaArrivo(z, el, len, minMs, maxMs) {
    if (typeof z !== 'number' || !(el > 0) || -z <= 200) return null;
    const stima = Math.round(el + (len + z) / (-z / el));
    return stima >= minMs && stima < maxMs ? stima : null;
  }

  // Classifica finale (come endRace del server): ordina per tempo (i non arrivati in fondo), assegna earned (punti del
  // piazzamento + punti rimasti dalla gara) e won, e calcola i premi. Modifica e restituisce l'elenco.
  // opzioni: daily (pista del giorno: niente punti del piazzamento, S-40), senzaPunti (allenamento-gara: nessuno guadagna
  // punti collezionati, earned = null per tutti). Gli avversari del computer non prendono punti mai (S-39).
  function classifica(results, opzioni = {}) {
    results.sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    let place = 0;
    for (const r of results) {
      const pos = r.ms != null ? place++ : -1;
      r.earned = (pos < 0 || opzioni.daily ? 0 : (PUNTI_POSTO[pos] ?? PUNTI_ALTRI)) + (r.p || 0);
      r.won = pos === 0;
      if (r.bot || opzioni.senzaPunti) r.earned = null;
    }
    const best = key => results.reduce((a, r) => (r[key] > (a ? a[key] : 0) ? r : a), null);
    const fast = best('top'), tricks = best('tk');
    const awards = {
      fastest: fast ? { id: fast.id, name: fast.name, color: fast.color, top: fast.top, bot: fast.bot ? 1 : 0 } : null,
      tricks: tricks ? { id: tricks.id, name: tricks.name, color: tricks.color, tk: tricks.tk, bot: tricks.bot ? 1 : 0 } : null
    };
    return { results, awards };
  }

  return { VEL_MAX_MS, PUNTI_POSTO, PUNTI_ALTRI, tempoMinimoMs, stimaArrivo, classifica };
})();
if (typeof window !== 'undefined') { window.PN = window.PN || {}; window.PN.gara = globalThis.CYF_GARA; }
