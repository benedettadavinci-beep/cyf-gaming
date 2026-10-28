// modulo: qualita
// dipende da: base
// Qualità grafica scelta in automatico e fps veri dei giocatori (A-14, R-513; dalla 0.26.0, scritta di giorno senza prove).
// Tre livelli: alta (pixel dello schermo fino a 2 per pixel, ombre 2048), media (1,5; ombre 1024), bassa (1; ombre 512).
// All'apertura si sceglie dal dispositivo: PC alta; telefono alta se ha almeno 6 GB di memoria o 8 processori, altrimenti
// media. Poi si misura: se nei primi 20 secondi di gioco (allenamento o gara) la media è sotto i 28 fps si scende di un
// livello, una volta sola per pagina, e la scelta resta salvata (`cyf.qualita`). `?qualita=alta|media|bassa` la forza.
// Dopo 45 secondi di gioco la media degli fps, il livello e telefono/PC vanno una volta sola a /api/fps (niente dati
// personali): da /api/stats si legge come va il gioco sui telefoni veri (fps_tel_*, fps_pc_*, q_*).
// Si crea con PN.qualita({ renderer, ombra, telefono, dopoCambio }) una volta sola, dal gioco.
window.PN = window.PN || {};
PN.qualita = (() => {
  const LIVELLI = ['bassa', 'media', 'alta'];
  const PIXEL = { alta: 2, media: 1.5, bassa: 1 };
  const OMBRE = { alta: 2048, media: 1024, bassa: 512 };
  const SOGLIA_FPS = 28, FINESTRA_S = 20, INVIO_S = 45;
  return ({ renderer, ombra, telefono, dopoCambio }) => {
    const { store } = PN.base;
    const forzato = new URLSearchParams(location.search).get('qualita');
    function iniziale() {
      if (LIVELLI.includes(forzato)) return forzato;
      const salvato = store.get('cyf.qualita');
      if (LIVELLI.includes(salvato)) return salvato;
      if (!telefono) return 'alta';
      const mem = navigator.deviceMemory || 0, cpu = navigator.hardwareConcurrency || 0;
      return mem >= 6 || cpu >= 8 ? 'alta' : 'media';
    }
    let livello = iniziale(), abbassato = false, inviato = false;
    let frames = 0, acc = 0, framesTot = 0, accTot = 0;

    function applica(l, salva) {
      livello = l;
      if (salva) store.set('cyf.qualita', l);
      try { renderer.setPixelRatio(Math.min(PIXEL[l], window.devicePixelRatio || 1)); } catch (e) {}
      try {
        if (ombra && ombra.mapSize && ombra.mapSize.x !== OMBRE[l]) {
          ombra.mapSize.set(OMBRE[l], OMBRE[l]);
          if (ombra.map) { ombra.map.dispose(); ombra.map = null; }   // Three.js la ricrea alla misura nuova
        }
      } catch (e) {}
      if (dopoCambio) dopoCambio(l);
    }
    applica(livello, false);

    // il gioco lo chiama ogni fotogramma con dt in secondi e se si sta giocando (allenamento o gara): nei menu non si misura
    function tick(dt, giocando) {
      if (!giocando || !(dt > 0)) return;
      frames++; acc += dt; framesTot++; accTot += dt;
      if (!abbassato && acc >= FINESTRA_S) {
        const fps = frames / acc;
        abbassato = true;
        const i = LIVELLI.indexOf(livello);
        if (fps < SOGLIA_FPS && i > 0) { applica(LIVELLI[i - 1], true); if (window.CYFDiag) window.CYFDiag.log('misure', Math.round(fps) + ' fps: qualità ' + livello); }
        frames = 0; acc = 0;
      }
      if (!inviato && accTot >= INVIO_S) { inviato = true; invia(framesTot / accTot); }
    }
    function invia(fps) {
      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') return;   // le prove locali non inviano
      const id = store.get('cyf.id');
      if (!id) return;
      const body = JSON.stringify({ id, fps: Math.round(fps * 10) / 10, tel: telefono ? 1 : 0, q: livello });
      try { if (navigator.sendBeacon && navigator.sendBeacon('/api/fps', new Blob([body], { type: 'application/json' }))) return; } catch (e) {}
      try { fetch('/api/fps', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {}); } catch (e) {}
    }
    // media degli fps di gioco finora (per la diagnosi), 0 se non si è ancora giocato
    const fps = () => (accTot > 0 ? Math.round(framesTot / accTot) : 0);
    return { get livello() { return livello; }, LIVELLI, applica, tick, fps };
  };
})();
