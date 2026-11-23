// modulo: termini
// dipende da: base
// Termini d'uso accettati prima del primo vocale (R-549). Dove i giocatori si mandano contenuti (i vocali) Google Play
// chiede che i termini siano accettati prima di poterli mandare, oltre a «Silenzia» e «Segnala» che ci sono già (R-213, R-116).
// La scelta resta sul dispositivo: cyf.termini = data dei termini accettati. Se i termini cambiano in modo importante si
// cambia VERSIONE e il riquadro ricompare una volta sola.
// Il riquadro #termini è in index.html, i suoi testi in i18n.js (termsTitle, termsText, termsAccept, termsLater).
//   PN.termini.accettati() → true se questo dispositivo li ha già accettati
//   PN.termini.chiedi()    → promessa: mostra il riquadro e dà true («Accetto i termini») o false («Non ora»)
// Tocca solo i propri elementi: #termini, #btnTerminiSi, #btnTerminiNo.
window.PN = window.PN || {};
PN.termini = (() => {
  const { store } = PN.base;
  const CHIAVE = 'cyf.termini';
  const VERSIONE = '2026-11-23';
  const $ = id => document.getElementById(id);
  const box = $('termini'), si = $('btnTerminiSi'), no = $('btnTerminiNo');
  // senza memoria sul dispositivo (navigazione privata) l'accettazione vale almeno finché la pagina resta aperta
  let ora = false;
  let attesa = null;
  const accettati = () => ora || store.get(CHIAVE) === VERSIONE;

  function chiudi(ok) {
    if (box) box.hidden = true;
    if (ok) { ora = true; store.set(CHIAVE, VERSIONE); }
    const f = attesa;
    attesa = null;
    if (f) f(!!ok);
  }
  if (si) si.addEventListener('click', () => chiudi(true));
  if (no) no.addEventListener('click', () => chiudi(false));

  function chiedi() {
    if (accettati()) return Promise.resolve(true);
    if (!box || !si) return Promise.resolve(false);
    if (attesa) attesa(false);   // una richiesta già aperta vale «non ora»
    box.hidden = false;
    try { si.focus(); } catch (e) {}
    return new Promise(r => { attesa = r; });
  }

  return { accettati, chiedi, VERSIONE };
})();
