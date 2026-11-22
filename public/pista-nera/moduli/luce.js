// modulo: luce
// dipende da: nessuno
// R-513, seconda parte (riga 4 dei prossimi passi, dalla 0.39.0): correzione di luce e colore. Tutta la scena 3D passa per
// il tone mapping ACES (come i giochi: le luci forti non bruciano più in bianco piatto, i colori sono più pieni e il
// contrasto più morbido), e ogni scenario ha la sua esposizione e il suo equilibrio tra sole e luce del cielo: le città
// del sud (Madrid, Lisbona, Roma, Napoli) con il sole più forte e caldo, quelle del nord e coperte (Londra, Berlino,
// Francoforte, Milano) con il sole più debole e più luce diffusa dal cielo, la Neve un po' più esposta perché la neve
// resti chiara. Il colore delle luci resta quello di ogni città (`theme.hemi`, `theme.sun` nelle schede).
// Le cartoline dipinte, il cielo e la nebbia non passano per il tone mapping (sono già colori finali): così l'orizzonte
// resta uguale e la pista si fonde con lo sfondo come prima. Vale su ogni dispositivo (costa una manciata di operazioni
// per pixel, niente passaggi in più): telefono e PC vedono gli stessi colori.
// `?luce=vecchia` spegne la correzione (per confrontare con prima, e per le prove). Una scheda città può dare
// `luce: { esp, sole, cielo }` per cambiare i suoi numeri senza toccare questo file.
// Si crea con PN.luce({ renderer, hemi, sun }) una volta sola, dal gioco (prima di disegnare); il gioco chiama
// applica(scenario, tema) a ogni cambio di scenario.
window.PN = window.PN || {};
PN.luce = (() => {
  // esp = esposizione del tone mapping; sole e cielo = moltiplicano le luci di base (sole 0,9, cielo 0,55)
  const BASE = { sole: 0.9, cielo: 0.55 };
  const SUD = { esp: 1.05, sole: 1.12, cielo: 0.92 };
  const NORD = { esp: 1.2, sole: 0.82, cielo: 1.15 };
  const MEDIO = { esp: 1.08, sole: 1.0, cielo: 1.0 };
  const TABELLA = {
    neve: { esp: 1.3, sole: 1.0, cielo: 1.0 },
    madrid: SUD, lisbona: SUD, roma: SUD, napoli: SUD,
    londra: NORD, berlino: NORD, francoforte: NORD, milano: NORD,
    parigi: MEDIO, zagabria: MEDIO, zurigo: MEDIO, newyork: MEDIO
  };
  const VECCHIA = { esp: 1, sole: 1, cielo: 1 };
  return ({ renderer, hemi, sun }) => {
    const spenta = new URLSearchParams(location.search).get('luce') === 'vecchia';
    // il tipo di tone mapping si sceglie una volta sola, prima che i materiali siano compilati (in r128 cambiarlo dopo
    // richiederebbe di ricompilarli tutti); l'esposizione invece si cambia quando si vuole
    renderer.toneMapping = spenta ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    let attuale = null;
    function valori(scenario, tema) {
      if (spenta) return VECCHIA;
      const v = Object.assign({}, TABELLA[scenario] || MEDIO, (tema && tema.luce) || {});
      return { esp: v.esp, sole: v.sole, cielo: v.cielo };
    }
    function applica(scenario, tema) {
      const v = valori(scenario, tema);
      renderer.toneMappingExposure = v.esp;
      if (hemi) hemi.intensity = BASE.cielo * v.cielo;
      if (sun) sun.intensity = BASE.sole * v.sole;
      attuale = Object.assign({ scenario }, v);
      return attuale;
    }
    return { applica, valori, spenta, get attuale() { return attuale; }, TABELLA, BASE };
  };
})();
