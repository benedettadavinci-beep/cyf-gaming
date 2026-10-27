// modulo: portale
// dipende da: nessuno
// Modalità portale (R-244, S-46): il gioco aperto dentro un portale di giochi nel browser (CrazyGames, Poki).
// Si accende con ?portale=<nome> nell'indirizzo che si dà al portale (per esempio …/pista-nera/?portale=crazygames)
// e, come rete di sicurezza, quando la pagina è aperta nel riquadro (iframe) di un portale conosciuto. Resta accesa per
// tutta la visita (sessionStorage), anche se il gioco cambia l'indirizzo per la sfida o la pista del giorno.
// Che cosa cambia sul portale lo decidono gli altri moduli leggendo PN.portale.attivo:
// - game.js: niente pulsante delle donazioni, il titolo "C-Y-F Gaming" non è un link, classe "portale" sulla pagina;
// - schermate.js: nella stanza della sfida il codice al posto del link (niente WhatsApp e Telegram);
// - sfida.js: testi da condividere senza link ("su CrazyGames");
// - vocali.js: messaggi vocali spenti finché il giocatore non li accende.
// Puro: niente DOM a parte location, document.referrer e sessionStorage, letti una volta all'avvio.
window.PN = window.PN || {};
PN.portale = (() => {
  // nome → come lo chiamiamo nei testi; il riferimento del browser (referrer) lo riconosce dal dominio
  const PORTALI = { crazygames: 'CrazyGames', poki: 'Poki' };
  const CHIAVE = 'cyf.portale';
  let nome = '';
  try {
    const q = new URLSearchParams(location.search);
    const p = String(q.get('portale') || '').toLowerCase();
    if (PORTALI[p]) nome = p;
    else if (p === '1' || p === 'si') nome = 'portale';
    else if (p === '0' || p === 'no') nome = '';
    else nome = sessionStorage.getItem(CHIAVE) || '';
    // dentro il riquadro di un portale conosciuto senza il parametro: il browser di solito manda almeno il dominio di chi incornicia
    if (!nome && window.top !== window.self) {
      const ref = String(document.referrer || '').toLowerCase();
      for (const k in PORTALI) if (ref.includes('//' + k + '.') || ref.includes('.' + k + '.')) nome = k;
    }
    if (nome) sessionStorage.setItem(CHIAVE, nome); else sessionStorage.removeItem(CHIAVE);
  } catch (e) { nome = ''; }

  const attivo = !!nome;
  const titolo = PORTALI[nome] || (attivo ? 'portale' : '');
  return {
    attivo, nome, titolo,
    // un link al nostro sito non si manda dal portale (porterebbe i giocatori fuori): al suo posto un testo
    link: (url, testo) => (attivo ? (testo || '') : url),
    // fonte della visita per le misure (R-246)
    fonte: attivo ? 'portale' : ''
  };
})();
