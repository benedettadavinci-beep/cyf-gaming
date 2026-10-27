// modulo: calendario
// dipende da: nessuno
// Calendario della città della settimana (R-245, S-47): da un giorno ('AAAA-MM-GG', ora italiana) alla settimana,
// alla città in evidenza e al premio (la maglia esclusiva "settimana<N>"). Funzioni pure, senza date del sistema:
// il giorno italiano lo calcola il server (src/giorno.mjs) e lo manda al gioco con /api/giorno.
//
// Lo stesso file gira nel browser (tag <script>: PN.calendario) e nel server (import '../public/shared/calendario.js',
// poi globalThis.CYF_CALENDARIO), come shared/protocollo.js. Niente import/export, niente DOM.
globalThis.CYF_CALENDARIO = (() => {
  const PRIMO_LUNEDI = '2026-10-26';   // settimana #1: 26/10-1/11/2026
  // 13 settimane tutte diverse, poi si ricomincia; ordine diverso da quello della pista del giorno (src/giorno.mjs, S-47)
  const ORDINE = ['roma', 'napoli', 'milano', 'londra', 'parigi', 'newyork', 'berlino', 'lisbona', 'madrid', 'zurigo', 'zagabria', 'francoforte', 'neve'];
  const GIORNO = 86400000, SETTIMANA = 7 * GIORNO;
  const PREMIO_RE = /^settimana(\d{1,3})$/;   // la maglia della settimana N
  const utc = giorno => Date.parse(giorno + 'T00:00:00Z');
  const data = ms => new Date(ms).toISOString().slice(0, 10);

  // numero della settimana (#1 la prima) in cui cade il giorno; 0 o negativo prima del primo lunedì
  const numeroDi = giorno => Math.floor((utc(giorno) - utc(PRIMO_LUNEDI)) / SETTIMANA) + 1;
  const scenaDi = n => ORDINE[((n - 1) % ORDINE.length + ORDINE.length) % ORDINE.length];
  const premioDi = n => 'settimana' + n;
  // "settimana12" → 12, altrimenti 0
  const numeroDelPremio = premio => { const m = PREMIO_RE.exec(String(premio || '')); return m ? +m[1] : 0; };

  // tutto della settimana di un giorno: { n, scena, premio, da (lunedì), a (domenica) }
  function settimanaDi(giorno) {
    const n = numeroDi(giorno);
    const da = utc(PRIMO_LUNEDI) + (n - 1) * SETTIMANA;
    return { n, scena: scenaDi(n), premio: premioDi(n), da: data(da), a: data(da + 6 * GIORNO) };
  }

  return { PRIMO_LUNEDI, ORDINE, PREMIO_RE, numeroDi, scenaDi, premioDi, numeroDelPremio, settimanaDi };
})();
if (typeof window !== 'undefined') { window.PN = window.PN || {}; window.PN.calendario = globalThis.CYF_CALENDARIO; }
