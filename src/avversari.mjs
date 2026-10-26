// Avversari guidati dal software (R-234, S-39): calcoli del server che si possono provare da soli.

// Tempo stimato di un avversario ancora in pista quando le persone sono tutte arrivate: va avanti alla sua velocità
// media fino a quel momento. z: ultima posizione nota (negativa, si scende verso -z), el: ms dal via, len: metri della
// gara. Restituisce i ms, oppure null se ha fatto troppo poca strada (meno di 200 m) o se il tempo è impossibile
// (più veloce di minMs, il limite fisico) o oltre maxMs ("non arrivato").
export function stimaArrivo(z, el, len, minMs, maxMs) {
  if (typeof z !== 'number' || !(el > 0) || -z <= 200) return null;
  const stima = Math.round(el + (len + z) / (-z / el));
  return stima >= minMs && stima < maxMs ? stima : null;
}
