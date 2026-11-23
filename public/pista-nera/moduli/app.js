// modulo: app
// dipende da: nessuno
// Il gioco installato sul telefono (R-548) e l'app Android di Google Play (R-547, R-550).
// - fonte 'app': il gioco aperto dall'app Android (lo stesso sito dentro un'app). Si riconosce da ?fonte=app, l'indirizzo
//   con cui l'app apre il sito, e come rete di sicurezza dal riferimento android-app:// che il telefono manda al primo
//   caricamento. Resta per tutta la visita (sessionStorage), anche se il gioco cambia l'indirizzo.
//   Nell'app non si mostrano i link per le donazioni: le regole di Google Play sui pagamenti non li ammettono
//   (lo decide chi li mostra leggendo PN.app.attivo: game.js nel gioco, la pagina iniziale per conto suo).
// - fonte 'icona': il sito aggiunto alla schermata Home dal browser (?fonte=icona, la partenza scritta nel manifest).
// - service worker /sw.js («rete prima»: con la rete si scarica sempre la versione nuova). In locale (127.0.0.1,
//   localhost) si registra solo con ?sw=1, così le prove del gioco misurano il sito senza service worker; ?sw=0 lo salta
//   ovunque. Non si registra dentro il riquadro di un portale.
// Puro: niente DOM a parte location, document.referrer, sessionStorage, matchMedia e navigator.serviceWorker.
window.PN = window.PN || {};
PN.app = (() => {
  const CHIAVE = 'cyf.app';
  const FONTI = ['app', 'icona'];
  let fonte = '';
  let chiesto = null;
  try {
    const q = new URLSearchParams(location.search);
    chiesto = q.get('sw');
    const f = String(q.get('fonte') || '').toLowerCase();
    if (FONTI.includes(f)) fonte = f;
    else if (String(document.referrer || '').indexOf('android-app://') === 0) fonte = 'app';
    else fonte = sessionStorage.getItem(CHIAVE) || '';
    if (!FONTI.includes(fonte)) fonte = '';
    if (fonte) sessionStorage.setItem(CHIAVE, fonte);
  } catch (e) { fonte = ''; }

  let installata = !!fonte;
  try { installata = installata || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches); } catch (e) {}

  // il service worker: la promessa dà la registrazione, oppure null se non c'è o non si può
  let sw = Promise.resolve(null);
  try {
    const locale = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    const riquadro = window.top !== window.self;
    if (navigator.serviceWorker && !riquadro && chiesto !== '0' && (!locale || chiesto === '1')) {
      sw = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => null);
    }
  } catch (e) {}

  return { attivo: fonte === 'app', installata, fonte, sw };
})();
