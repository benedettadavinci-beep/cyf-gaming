// Avversari guidati dal software (R-234, S-39): calcoli del server che si possono provare da soli.
// Dalla 0.28.0 il tempo stimato sta in public/shared/gara.js (lo usa anche l'allenamento-gara nel gioco, R-519): qui si
// riesporta, così test_server.mjs e stanza.mjs non cambiano.
import '../public/shared/gara.js';

// Tempo stimato di un avversario ancora in pista quando le persone sono tutte arrivate: va avanti alla sua velocità
// media fino a quel momento. z: ultima posizione nota (negativa, si scende verso -z), el: ms dal via, len: metri della
// gara. Restituisce i ms, oppure null se ha fatto troppo poca strada (meno di 200 m) o se il tempo è impossibile
// (più veloce di minMs, il limite fisico) o oltre maxMs ("non arrivato").
export const stimaArrivo = globalThis.CYF_GARA.stimaArrivo;
