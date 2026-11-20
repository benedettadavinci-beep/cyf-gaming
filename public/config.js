// Impostazioni di C-Y-F Gaming modificabili senza toccare il codice dei giochi.
window.CYF = {
  // Versione pubblicata (la stessa dello storico in REQUISITI.md): serve a controllare che l'aggiornamento sia online
  version: '0.37.1',
  // Link per le donazioni (es. https://paypal.me/nome oppure https://ko-fi.com/nome).
  // Se è vuoto, i pulsanti "Sostieni" restano nascosti.
  donateUrl: 'https://paypal.me/Limper17',
  // Pubblicità (R-517): fornitore 'nessuno' (niente riquadro), 'prova' (riquadro finto per vedere dove compare) o 'google'
  // (AdSense: servono client "ca-pub-…" e slot dell'unità da 300×100). ogniS: secondi minimi tra un annuncio e l'altro.
  // In fondo all'indirizzo del gioco ?pubblicita=prova accende la prova solo per quella visita, ?pubblicita=0 la spegne.
  pubblicita: { fornitore: 'nessuno', client: '', slot: '', ogniS: 60 },
  // Cartelloni sui palazzi delle città (R-535): uno per palazzo, verso la strada. Elenco vuoto = sigla CYF ovunque.
  // Per la pubblicità aggiungere gli annunci in ordine, si alternano palazzo dopo palazzo, uguali per tutti i giocatori:
  //   annunci: [{ immagine: 'https://sito/logo.png' }, { testo: 'CYF' }, { immagine: '/pubblicita/marca.jpg' }]
  // Formato dell'immagine: 2:1 (per esempio 1024×512), PNG o JPG; da un altro sito serve il permesso CORS.
  // Sul portale (CrazyGames, Poki) si vede sempre solo CYF.
  cartelloni: { annunci: [] }
};
