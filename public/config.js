// Impostazioni di C-Y-F Gaming modificabili senza toccare il codice dei giochi.
window.CYF = {
  // Versione pubblicata (la stessa dello storico in REQUISITI.md): serve a controllare che l'aggiornamento sia online
  version: '0.29.0',
  // Link per le donazioni (es. https://paypal.me/nome oppure https://ko-fi.com/nome).
  // Se è vuoto, i pulsanti "Sostieni" restano nascosti.
  donateUrl: 'https://paypal.me/Limper17',
  // Pubblicità (R-517): fornitore 'nessuno' (niente riquadro), 'prova' (riquadro finto per vedere dove compare) o 'google'
  // (AdSense: servono client "ca-pub-…" e slot dell'unità da 300×100). ogniS: secondi minimi tra un annuncio e l'altro.
  // In fondo all'indirizzo del gioco ?pubblicita=prova accende la prova solo per quella visita, ?pubblicita=0 la spegne.
  pubblicita: { fornitore: 'nessuno', client: '', slot: '', ogniS: 60 }
};
