// modulo: tracciato
// dipende da: base
// Le file di ostacoli, bonus, rampe e porte della pista come semplici dati (dove sono, quanto sono grandi), senza
// modelli 3D. È l'unico posto in cui si decide la pista: stessi numeri casuali e stesso ordine di sempre, quindi stessa
// pista per tutti con lo stesso seme (R-103) e uguale in ogni città (R-309).
// - riga(z, ctx): una fila. La usa la generazione (che poi costruisce i modelli) e i dati qui sotto.
// - dati(seme, opz): tutta la pista come dati, generata man mano. La usano gli avversari guidati dal software (R-234)
//   per sapere dove sono alberi, rocce, rampe e porte anche lontano dal giocatore, dove i modelli non ci sono.
window.PN = window.PN || {};
PN.tracciato = (() => {
  const { TAU, clamp, mulberry32 } = PN.base;

  // Una fila alla quota z. ctx: { r: numeri casuali della pista, center(z), inBigZone(x, z, pad),
  // metti(o): un oggetto nuovo, zona(z): spazio libero di un trampolino gigante (va tolto quello che copre) }.
  // Ogni r() qui consuma un numero casuale: l'ordine non va cambiato, altrimenti cambia la pista.
  function riga(z, ctx) {
    slalom(z, ctx);
    const r = ctx.r, rr = (a, b) => a + r() * (b - a);
    const d = -z, c = ctx.center(z);
    const n = r() < Math.min(0.8, 0.4 + d / 3500) ? 2 : 1;
    const xs = [];
    for (let i = 0; i < n; i++) {
      let x = c + rr(-15.5, 15.5);
      const kind = r();
      if (xs.some(v => Math.abs(v - x) < 4.5) || ctx.inBigZone(x, z, 1.3)) continue;
      xs.push(x);
      // R-310 (0.10.0): ostacoli −35% (alberi fino a 0,247, rocce fino a 0,377). R-313 (0.19.0): alberi, rocce e porte
      // −30% esatto: alberi fino a 0,173, rocce da 0,173 a 0,264, porte da 0,881 in su; il resto della fila resta vuoto
      if (kind < 0.173) {
        const s = rr(0.75, 1.05);
        const tilt = [(r() - 0.5) * 0.1, (r() - 0.5) * 0.1];
        const gi = r() < 0.3 ? 1 : 0;
        const sy = 0.9 + r() * 0.25, ry = r() * TAU;   // stessi numeri casuali in ogni scenario: la pista resta identica
        ctx.metti({ type: 'tree', x, z, s, tilt, gi, sy, ry });
      } else if (kind < 0.264) {
        const s = rr(0.8, 1.25), ry = r() * TAU;
        ctx.metti({ type: 'rock', x, z, s, ry });
      } else if (kind < 0.58) { /* posto lasciato libero */ }
      else if (kind < 0.71) {
        const k = 3 + Math.floor(r() * 3);
        for (let j = 0; j < k; j++) {
          const gz = z - j * 2.2, gx = x + (ctx.center(gz) - c) + Math.sin(j * 0.9) * 0.8;   // la fila di bonus segue la curva della strada: uguale in ogni città (R-309)
          if (ctx.inBigZone(gx, gz, 0.5)) continue;
          ctx.metti({ type: 'gem', x: gx, z: gz, phase: j, alt: (Math.round(z) + j) % 2 });
        }
      } else if (kind < 0.83) {
        // circa una rampa su sette (15%) è un trampolino gigante: grande il doppio, fa saltare molto più in alto (R-214)
        const big = r() < 0.15;
        // R-541: niente rampa se lei o il suo atterraggio coprirebbero una porta da slalom (la toglierebbero). Il numero
        // casuale di big è già consumato, quindi il resto della pista non cambia
        if (portaVicina(x, z + 6, z - (big ? 48 : 30), (big ? 3.8 : 2.6) + 3, ctx.center)) continue;
        if (big) {
          x = clamp(x, c - 13.5, c + 13.5);   // largo 6 m: resta tutto dentro la strada
          ctx.zona({ x, z0: z + 5, z1: z - 5.5, hw: 3.6 });
        }
        ctx.metti({ type: 'ramp', x, z, big });
        // B-06: davanti alla rampa niente alberi, rocce, porte o altre rampe dove si atterra. Salto dalla rampa: stacco a
        // 4 m dal centro, ~0,9 s in aria, fino a 22 m/s → si atterra entro ~26 m; trampolino gigante: stacco a 8 m, ~1,5 s
        // → entro ~42 m. Il corridoio è dritto come il volo (non segue la curva della strada) e largo come la rampa più
        // un margine. Non consuma numeri casuali: la pista resta la stessa per tutti, solo senza ostacoli lì
        ctx.zona({ x, z0: z - 1, z1: z - (big ? 48 : 30), hw: big ? 3.8 : 2.6, atterraggio: true });
      } else if (kind < 0.881) { /* posto lasciato libero (prima c'era una porta) */ }
      else {
        // R-541 (dalla 0.34.0): niente più porte a caso, ora sono in sequenze da slalom (slalom qui sotto); i due numeri
        // casuali si consumano come prima, così il resto della pista resta uguale
        rr(-9, 9); r();
      }
    }
  }
  // R-541 (dalla 0.34.0): porte come nello slalom gigante delle Olimpiadi. Sequenze di PORTE porte, una ogni PASSO metri,
  // rosse e blu alternate e spostate LATO metri a destra e a sinistra della strada, con PAUSA metri liberi tra una sequenza
  // e l'altra. Non usano numeri casuali: stessa posizione per tutti. Davanti e dietro ogni porta niente ostacoli (zona).
  // riga(z) mette le porte tra la fila prima (ctx.sopra) e la sua quota z, prima degli ostacoli della fila.
  const SLALOM = { inizio: 70, porte: 8, passo: 26, pausa: 150, lato: 6.5 };
  // c'è una porta da slalom tra le quote z0 e z1 (z0 > z1) a meno di hw metri da x?
  function portaVicina(x, z0, z1, hw, center) {
    const S = SLALOM, giro = S.porte * S.passo + S.pausa, dA = -z0, dB = -z1;
    for (let sez = Math.max(0, Math.floor((dA - S.inizio) / giro)); S.inizio + sez * giro <= dB; sez++)
      for (let j = 0; j < S.porte; j++) {
        const d = S.inizio + sez * giro + j * S.passo;
        if (d < dA || d > dB) continue;
        const lato = (j % 2 ? 1 : -1) * (sez % 2 ? -1 : 1);
        if (Math.abs(center(-d) + lato * S.lato - x) < hw) return true;
      }
    return false;
  }
  function slalom(z, ctx) {
    const sopra = ctx.sopra != null && ctx.sopra > z ? ctx.sopra : z + 10;
    const S = SLALOM, giro = S.porte * S.passo + S.pausa, dA = -sopra, dB = -z;   // distanze dalla partenza, dA < dB
    for (let sez = Math.max(0, Math.floor((dA - S.inizio) / giro)); S.inizio + sez * giro <= dB; sez++) {
      for (let j = 0; j < S.porte; j++) {
        const d = S.inizio + sez * giro + j * S.passo;
        if (d <= dA || d > dB) continue;
        const gz = -d, lato = (j % 2 ? 1 : -1) * (sez % 2 ? -1 : 1), gx = ctx.center(gz) + lato * S.lato;
        if (ctx.inBigZone(gx, gz, 2.7)) continue;
        ctx.zona({ x: gx, z0: gz + 5, z1: gz - 5, hw: 3.2 });
        ctx.metti({ type: 'gate', x: gx, z: gz, half: 2.4, gi: j % 2 });
      }
    }
  }
  // gli oggetti che un trampolino gigante coprirebbe (anche quelli della fila prima) vanno tolti
  function coperto(o, zone) {
    if (o.type !== 'tree' && o.type !== 'rock' && o.type !== 'gem' && o.type !== 'ramp' && o.type !== 'gate') return false;
    const hw = zone.hw + (o.type === 'gate' ? o.half + 0.3 : o.type === 'gem' ? 0.5 : 1.3);
    return o.z <= zone.z0 && o.z >= zone.z1 && Math.abs(o.x - zone.x) < hw;
  }
  // passo tra una fila e l'altra (più fitto andando avanti); consuma un numero casuale
  const passo = (r, z) => (6 + r() * 4) * Math.max(0.5, 1 - (-z) / 3200);

  // Tutta la pista come dati. opz: { center(z), gara: true se c'è il traguardo (niente file negli ultimi 25 m), lunghezza }.
  // avanza(z): costruisce le file fino alla quota z (si scende verso z negativa); vicini(z0, z1): gli oggetti tra z0 e z1
  // (z0 > z1); dimentica(z): toglie quello che sta sopra la quota z (ormai alle spalle di tutti).
  function dati(seme, opz) {
    const r = mulberry32(seme);
    let rowZ = -28, objs = [], zones = [];
    const inBigZone = (x, z, pad) => zones.some(b => z <= b.z0 && z >= b.z1 && Math.abs(x - b.x) < b.hw + pad);
    let n = 0;
    const ctx = {
      r, center: opz.center, inBigZone,
      metti: o => { o.n = ++n; o.k = ((o.x * 12.9898 + o.z * 78.233) % 1 + 1) % 1; objs.push(o); },
      zona: zone => { zones.push(zone); objs = objs.filter(o => !coperto(o, zone)); }
    };
    function avanza(z) {
      while (rowZ > z) {
        if (!opz.gara || -rowZ < opz.lunghezza - 25) { riga(rowZ, ctx); ctx.sopra = rowZ; }
        rowZ -= passo(r, rowZ);
      }
    }
    function vicini(z0, z1) { return objs.filter(o => o.z <= z0 && o.z >= z1); }
    function dimentica(z) {
      if (objs.length && objs[0].z > z) objs = objs.filter(o => o.z <= z);
      if (zones.length && zones[0].z1 > z) zones = zones.filter(b => b.z1 <= z);
    }
    return { avanza, vicini, dimentica, get oggetti() { return objs; } };
  }

  return { riga, coperto, passo, dati, SLALOM, portaVicina };
})();
