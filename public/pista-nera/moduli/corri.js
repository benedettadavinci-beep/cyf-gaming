// modulo: corri
// dipende da: base
// «Corri ora» per chi arriva la prima volta (R-552, proposta F-24 del 22/11): nella home, finché su questo dispositivo
// non si è finita nessuna gara, un pulsante grande in cima fa partire subito l'allenamento (3 avversari del computer,
// 2 km, R-519), cioè lo stesso pulsante «Allenati da solo» (#btnSolo) senza altre scelte.
// La prima gara finita si segna in cyf.primaGara quando compare la fine dell'allenamento (#over) o la classifica di una
// gara (#raceResults): da lì il pulsante non compare più.
// Si spegne senza toccare il codice: CYF.corriOra = false in public/config.js (per tutti), ?corri=0 (una visita);
// ?corri=1 lo mostra anche a chi ha già corso, per provarlo.
// Tocca solo i propri elementi: #btnCorri. Legge (senza modificarli) #btnSolo, #over, #raceResults.
window.PN = window.PN || {};
PN.corri = (() => {
  const { store } = PN.base;
  const CHIAVE = 'cyf.primaGara';
  const $ = id => document.getElementById(id);
  const btn = $('btnCorri');
  const param = new URLSearchParams(location.search).get('corri');
  const spento = (window.CYF && window.CYF.corriOra === false) || param === '0';
  const forza = param === '1';
  const giaCorso = () => !!store.get(CHIAVE);

  function aggiorna() { if (btn) btn.hidden = spento || (giaCorso() && !forza); }

  function segnaFinita() {
    if (giaCorso()) return;
    store.set(CHIAVE, new Date().toISOString().slice(0, 10));
    aggiorna();
  }

  if (btn) {
    aggiorna();
    btn.addEventListener('click', () => { const s = $('btnSolo'); if (s) s.click(); });
  }
  // la fine di una gara si riconosce da quando i due riquadri smettono di essere nascosti
  if (!spento && 'MutationObserver' in window) {
    const guarda = el => {
      if (!el) return;
      new MutationObserver(() => { if (!el.hidden) segnaFinita(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    };
    guarda($('over'));
    guarda($('raceResults'));
  }
  return { aggiorna, giaCorso };
})();
