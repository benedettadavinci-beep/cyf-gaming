// modulo: pubblicita
// dipende da: lingua, portale
// Riquadro pubblicitario piccolo (R-517, decisione di Luigi del 28/10/2026): compare solo nei momenti di attesa, mai in
// gara. Dove: la sala d'attesa prima del via (con il "5" e il "4" del conto alla rovescia; al "3" sparisce, così il
// "3, 2, 1" è pulito), la stanza online o del Gran Premio che aspetta la partenza automatica, la schermata dei risultati.
// Chi serve l'annuncio ("fornitore"), scelto in config.js (window.CYF.pubblicita) o con ?pubblicita=… nell'indirizzo:
// - nessuno (default): il riquadro non esiste, per nessuno;
// - prova: un riquadro finto "spazio pubblicitario", per vedere dove e quando compare (resta acceso per la visita);
// - google: AdSense (H5 Games Ads / unità display) con client e slot in config.js; se l'annuncio non arriva il riquadro resta nascosto;
// - sul portale (PN.portale.attivo) solo l'SDK del portale, se c'è (CrazyGames: ads spenti nel Basic Launch, niente
//   annunci di altri): senza SDK niente riquadro.
// Regole (CrazyGames e buon senso): mai durante il conto alla rovescia finale e la gara, mai nel menu, mai alla prima
// gara della visita, non più di uno ogni OGNI_S secondi (config pubblicita.ogniS, default 60); "prova" le salta.
// Si crea con PN.pubblicita({ diag }) dal gioco, che chiama mostra('attesa' | 'lobby' | 'risultati') e nascondi().
window.PN = window.PN || {};
PN.pubblicita = ({ diag }) => {
  const { tr } = PN.lingua;
  const PORTALE = PN.portale;
  const $ = id => document.getElementById(id);
  const CFG = (window.CYF && window.CYF.pubblicita) || {};
  const CHIAVE = 'cyf.pubblicita';
  const OGNI_S = Number(CFG.ogniS) >= 10 ? Number(CFG.ogniS) : 60;
  const LARGO = 300, ALTO = 100;   // misura del riquadro (il formato "banner mobile grande" degli annunci)
  // cagnolino di prova: disegno originale, 120×64, il corpo salta (gruppo .salto), la coda e l'orecchio si muovono (CSS)
  const CANE = '<svg viewBox="0 0 120 64" width="110" height="58" xmlns="http://www.w3.org/2000/svg">'
    + '<ellipse class="ombra" cx="60" cy="59" rx="30" ry="3.5" fill="rgba(19,35,58,.18)"/>'
    + '<g class="salto">'
    + '<path class="coda" d="M22 34 Q10 26 14 16" fill="none" stroke="#b5702e" stroke-width="5" stroke-linecap="round"/>'
    + '<rect x="30" y="38" width="7" height="16" rx="3.5" fill="#b5702e"/><rect x="42" y="38" width="7" height="16" rx="3.5" fill="#9e5f24"/>'
    + '<rect x="66" y="38" width="7" height="16" rx="3.5" fill="#b5702e"/><rect x="78" y="38" width="7" height="16" rx="3.5" fill="#9e5f24"/>'
    + '<ellipse cx="56" cy="36" rx="34" ry="15" fill="#c98540"/><ellipse cx="60" cy="42" rx="16" ry="7" fill="#f2d9b8"/>'
    + '<circle cx="90" cy="26" r="14" fill="#c98540"/><ellipse cx="100" cy="31" rx="9" ry="6" fill="#f2d9b8"/>'
    + '<ellipse class="orecchio" cx="80" cy="18" rx="6" ry="11" fill="#9e5f24" transform="rotate(-20 80 18)"/>'
    + '<circle cx="93" cy="23" r="2.6" fill="#13233a"/><circle cx="93.8" cy="22.2" r=".9" fill="#fff"/>'
    + '<circle cx="106" cy="29" r="3" fill="#13233a"/><path d="M99 34 q4 3 7 0" fill="none" stroke="#13233a" stroke-width="1.5" stroke-linecap="round"/>'
    + '</g></svg>';

  // ---------- chi serve l'annuncio ----------
  let fornitore = '';
  try {
    const q = new URLSearchParams(location.search);
    const p = String(q.get('pubblicita') || '').toLowerCase();
    if (p === 'prova' || p === 'google') { fornitore = p; sessionStorage.setItem(CHIAVE, p); }
    else if (p === '0' || p === 'no') { fornitore = 'nessuno'; sessionStorage.removeItem(CHIAVE); }
    else fornitore = sessionStorage.getItem(CHIAVE) || String(CFG.fornitore || 'nessuno').toLowerCase();
  } catch (e) { fornitore = String(CFG.fornitore || 'nessuno').toLowerCase(); }
  if (PORTALE.attivo) fornitore = 'portale';   // sul portale decide il portale (R-244): niente annunci nostri
  if (!['prova', 'google', 'portale'].includes(fornitore)) fornitore = 'nessuno';
  const attivo = fornitore !== 'nessuno';
  if (diag) diag.log('pubblicita', fornitore);

  // ---------- il riquadro (un solo nodo, spostato tra la pista, la stanza e i risultati) ----------
  let box = null, contenuto = null, dove = '', ultimo = 0, gare = +(sessionStorage.getItem('cyf.gare') || 0), caricato = false;
  function crea() {
    if (box) return box;
    box = document.createElement('div');
    box.className = 'adbox'; box.id = 'adBox'; box.hidden = true;
    box.innerHTML = '<small class="adlbl"></small><div class="adcontent" id="adContent"></div><button type="button" class="adclose" aria-label="×">×</button>';
    contenuto = box.querySelector('.adcontent');
    box.querySelector('.adclose').addEventListener('click', () => { nascondi(); chiuso = dove; });
    return box;
  }
  let chiuso = '';   // il giocatore ha chiuso il riquadro in questo posto: non lo si riapre finché non cambia posto

  // si può mostrare adesso? (le regole stanno qui, così sono in un posto solo)
  function permesso(posto) {
    if (!attivo) return false;
    if (fornitore === 'prova') return true;
    if (fornitore === 'portale' && !(window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.banner)) return false;
    if (gare < 1) return false;                              // prima gara della visita: niente annunci
    if (Date.now() - ultimo < OGNI_S * 1000) return false;   // non più di uno ogni OGNI_S secondi
    return true;
  }

  // riempie il riquadro secondo il fornitore; restituisce false se non c'è niente da mostrare
  function riempi() {
    contenuto.innerHTML = '';
    if (fornitore === 'prova') {
      // riquadro di prova (richiesta di Luigi del 28/10 alle 20:09): un cagnolino disegnato qui che saltella, così si vede
      // come viene un annuncio animato in quel posto; con "riduci il movimento" sta fermo (CSS)
      contenuto.innerHTML = '<div class="adprova"><div class="adcane" aria-hidden="true">' + CANE + '</div><div class="adtesto"><b>' + tr('adDemoTitle') + '</b><span>' + tr('adDemoText') + '</span></div></div>';
      return true;
    }
    if (fornitore === 'google') {
      if (!CFG.client || !CFG.slot) return false;
      if (!caricato) {
        caricato = true;
        const s = document.createElement('script');
        s.async = true; s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CFG.client);
        document.head.appendChild(s);
      }
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle'; ins.style.cssText = 'display:inline-block;width:' + LARGO + 'px;height:' + ALTO + 'px';
      ins.setAttribute('data-ad-client', CFG.client); ins.setAttribute('data-ad-slot', CFG.slot);
      contenuto.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { return false; }
      // se dopo 3 s l'annuncio non è arrivato (nessuna riga disponibile, ad blocker) il riquadro si nasconde da solo
      setTimeout(() => { if (box && !box.hidden && ins.getAttribute('data-ad-status') !== 'filled') nascondi(); }, 3000);
      return true;
    }
    if (fornitore === 'portale') {
      try { window.CrazyGames.SDK.banner.requestBanner({ id: 'adContent', width: LARGO, height: ALTO }).catch(() => nascondi()); } catch (e) { return false; }
      return true;
    }
    return false;
  }

  // mostra il riquadro in un posto: 'attesa' (sopra la pista, in un angolo), 'lobby' (nella stanza che aspetta la
  // partenza automatica), 'risultati' (nella schermata dei risultati). Chiamarla a ogni fotogramma non costa: se è già lì non fa niente
  function mostra(posto) {
    if (!attivo) return;
    if (box && !box.hidden && dove === posto) return;
    if (chiuso === posto) return;
    if (!permesso(posto)) return;
    crea();
    const casa = posto === 'lobby' ? $('lobbyAd') : posto === 'risultati' ? $('resAd') : $('stage');
    if (!casa) return;
    if (box.parentNode !== casa) casa.appendChild(box);
    box.classList.toggle('in-stage', posto === 'attesa');
    box.querySelector('.adlbl').textContent = tr('adLabel');
    if (!riempi()) { box.hidden = true; return; }
    dove = posto; box.hidden = false; ultimo = Date.now();
    if (casa.id === 'lobbyAd' || casa.id === 'resAd') casa.hidden = false;
    if (diag) diag.log('pubblicita', 'mostra ' + posto);
  }
  function nascondi() {
    if (!box || box.hidden) return;
    box.hidden = true;
    if (fornitore === 'portale') { try { window.CrazyGames.SDK.banner.clearBanner('adContent'); } catch (e) {} }
    contenuto.innerHTML = '';
    for (const id of ['lobbyAd', 'resAd']) { const c = $(id); if (c && c.contains(box)) c.hidden = true; }
    if (diag) diag.log('pubblicita', 'nascosto');
  }
  // il cambio di posto riapre il riquadro anche se il giocatore lo aveva chiuso nel posto precedente
  function cambioPosto() { chiuso = ''; }
  // una gara iniziata: dalla seconda gara della visita gli annunci veri possono comparire
  function garaIniziata() { gare++; try { sessionStorage.setItem('cyf.gare', String(gare)); } catch (e) {} }

  return { attivo, fornitore, mostra, nascondi, cambioPosto, garaIniziata, get visibile() { return !!box && !box.hidden; } };
};
