// modulo: settimana
// dipende da: base, lingua, calendario, schermate
// Città della settimana con la maglia esclusiva (R-245, S-47): riquadro nel menu con la città in evidenza, la scadenza,
// il premio e il pulsante "Corri a …"; le maglie vinte (premi) arrivano dal server (/api/me e il messaggio "results")
// e restano sul dispositivo in cyf.premi ("settimana1,settimana3"); le legge moduli/personaggio.js per il menu delle maglie.
// La settimana di adesso (numero, città, premio, lunedì e domenica) la manda il server con /api/giorno (campo settimana):
// la tiene moduli/schermate.js insieme alla pista del giorno (schermate.giorno).
// Si crea con PN.settimana({ schermate, say, vaiInCitta, cambiato }) dal gioco: schermate.giorno ha la settimana;
// say(testo, colore) mostra un avviso; vaiInCitta(scena) mette la città nel menu; cambiato() avvisa che i premi sono
// cambiati (il personaggio aggiorna il suo menu delle maglie).
window.PN = window.PN || {};
PN.settimana = ({ schermate, say, vaiInCitta, cambiato }) => {
  const { store } = PN.base;
  const { tr, cityName } = PN.lingua;
  const C = PN.calendario;
  const $ = id => document.getElementById(id);
  let premi = String(store.get('cyf.premi') || '').split(',').filter(p => C.numeroDelPremio(p) > 0);
  const scrivi = () => store.set('cyf.premi', premi.join(','));
  // la settimana di adesso, dai dati di /api/giorno (null finché non sono arrivati)
  const adesso = () => { const g = schermate.giorno; return g && g.settimana && g.settimana.n >= 1 ? g.settimana : null; };

  // domenica della settimana nella lingua scelta ("1/11")
  function fmtGiorno(d) {
    try { return new Date(d + 'T12:00:00Z').toLocaleDateString(PN.lingua.lang, { day: 'numeric', month: 'numeric' }); } catch (e) { return d; }
  }

  // ---------- premi ----------
  const vinta = premio => premi.includes(premio);
  // la lista dal server (/api/me): si aggiunge a quella del dispositivo
  function imposta(lista) {
    const nuovi = (Array.isArray(lista) ? lista : []).map(String).filter(p => C.numeroDelPremio(p) > 0);
    const prima = premi.join(',');
    premi = [...new Set([...premi, ...nuovi])];
    if (premi.join(',') !== prima) { scrivi(); cambiato(); render(); }
  }
  // a fine gara il server dice che la maglia è vinta adesso
  function vinto(premio) {
    const n = C.numeroDelPremio(premio);
    if (!n) return;
    if (!vinta(premio)) { premi.push(premio); scrivi(); cambiato(); }
    say(tr('weekToast', { n, city: cityName(C.scenaDi(n)) }), '#c98a00');
    render();
  }

  // ---------- riquadro nel menu ----------
  function render() {
    const box = $('weekBox');
    if (!box) return;
    const w = adesso();
    box.hidden = !w;
    if (!w) return;
    const city = cityName(w.scena);
    $('weekName').textContent = '🏙️ ' + tr('weekTitle', { n: w.n, city });
    $('weekInfo').textContent = tr('weekUntil', { d: fmtGiorno(w.a) }) + ' · ' + (vinta(w.premio) ? tr('weekWon', { n: w.n }) : tr('weekPrize', { n: w.n, city }));
    $('btnWeekGo').textContent = tr('weekGo', { city });
    box.classList.toggle('won', vinta(w.premio));
  }
  $('btnWeekGo').addEventListener('click', () => { const w = adesso(); if (w) vaiInCitta(w.scena); });

  return { render, imposta, vinto, vinta, get premi() { return premi.slice(); } };
};
