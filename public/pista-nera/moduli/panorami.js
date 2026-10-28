// modulo: panorami
// dipende da: base
// Sfondi delle città dipinti come una cartolina (R-405, dalla 0.20.0): per ogni città la veduta classica, larga 180°
// (4096 pixel, sul telefono 2048), con il suo monumento al centro, cioè in fondo alla discesa (R-308). Tutto è disegnato
// qui con il canvas, senza foto: le foto di Google si guardano solo come riferimento, per i diritti d'autore.
// Il cielo resta trasparente (si vede quello del gioco). Misure in metri sulla superficie del panorama (raggio 700 m):
// s = metri lungo l'arco (0 = dritto davanti, positivo a destra), h = metri d'altezza (0 = altezza degli occhi).
// Prospettiva: più una cosa è in basso (h negativa), più è vicina, quindi più grande e meno velata dalla foschia.
// PN.panorami.dipingi(nome, larghezza, cielo) restituisce la tela; GEOMETRIA dice come montarla (moduli/sfondi.js).
// Dalla 0.26.0 (R-513) dipingiPiani restituisce due tele: la città e, a parte, i monti lontani (il piano che nel gioco si
// muove meno); c'è anche la "neve", che prima aveva solo coni 3D.
window.PN = window.PN || {};
PN.panorami = (() => {
  const { mulberry32 } = PN.base;
  const R = 700, ALTO = 200, BASSO = -150, ARCO = Math.PI;
  const GEOMETRIA = { raggio: R, alto: ALTO, basso: BASSO, arco: ARCO };
  const S_MAX = R * ARCO / 2;   // ~1100 m da ogni lato
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  // una tela: nella pagina un <canvas>, dentro il worker (moduli/sfondi.js) un OffscreenCanvas
  // tele sul processore, non sulla scheda video: sono ~150.000 rettangoli piccoli, che il processore dipinge in pochi
  // decimi di secondo mentre la scheda video (soprattutto quella software delle prove) ci metteva da 11 a 45 secondi
  const CPU = { willReadFrequently: true };
  const nuovaTela = (w, h) => { if (typeof document === 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------- colori ----------
  const cache = new Map();
  const rgb = h => { let c = cache.get(h); if (!c) { const n = parseInt(h.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; cache.set(h, c); } return c; };
  const hex = c => '#' + c.map(v => cl(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const misti = new Map();   // i colori misti si ricalcolano spesso (decine di migliaia di palazzi): si tengono da parte
  const mix = (a, b, t) => {
    const key = a + b + Math.round(t * 400);
    let v = misti.get(key);
    if (v === undefined) {
      if (misti.size > 40000) { misti.clear(); cache.clear(); }   // mai troppo grande: una Map da milioni di voci rallenta tutto
      const A = rgb(a), B = rgb(b), q = Math.round(t * 400) / 400; v = hex(A.map((x, i) => x + (B[i] - x) * q)); misti.set(key, v);
    }
    return v;
  };
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${Math.round(a * 1000) / 1000})`; };
  // luce del sole (da sinistra, calda) o ombra (fredda)
  const luce = (c, f) => mix(c, f > 0 ? '#fff6e6' : '#1d2433', Math.abs(f));

  // ---------- prospettiva ----------
  // scala di una cosa che poggia a terra alla quota h (1 = vicina, in fondo alla tela; 0,1 = vicino all'orizzonte)
  const scala = h => Math.max(0.035, -h / 150);
  // foschia (0 = nitido, 0,9 = quasi colore del cielo) per una cosa di scala sc
  const foschia = (sc, f = 1) => cl(0.9 * Math.exp(-sc * 2.4 / f), 0.03, 0.9);

  // ---------- tela e coordinate ----------
  // piani: se vero (R-513) i monti lontani si dipingono su una seconda tela (P.cL, contesto P.gL): è il piano lontano,
  // che nel gioco si muove meno del resto quando il rider si sposta, così la cartolina ha profondità
  function tela(W, cielo, seme, citta, piani = false) {
    const k = W / (R * ARCO), Hpx = Math.round((ALTO - BASSO) * k);
    const c = nuovaTela(W, Hpx);
    const g = c.getContext('2d', CPU);
    const cL = piani ? nuovaTela(W, Hpx) : null;
    const rnd = mulberry32(seme);
    return {
      c, g, W, H: Hpx, k, rnd, orizzonte: cielo.orizzonte, nebbia: cielo.nebbia, fosch: citta.foschia || 1,
      piani, cL, gL: cL ? cL.getContext('2d', CPU) : g, lontano: false,
      x: s => W / 2 + s * k, y: h => (ALTO - h) * k, m: v => v * k,
      aria: (col, d) => mix(col, cielo.orizzonte, cl(d, 0, 0.92)),
      rr: (a, b) => a + rnd() * (b - a), pick: a => a[Math.floor(rnd() * a.length)]
    };
  }
  // un livello separato grande come la tela (per bucare, sfumare o riflettere un monumento); fn disegna su Q
  function strato(P, fn) {
    const c = nuovaTela(P.W, P.H);
    const Q = Object.assign({}, P, { c, g: c.getContext('2d', CPU) });
    fn(Q);
    return c;
  }
  function copia(P) { const c = nuovaTela(P.W, P.H); c.getContext('2d', CPU).drawImage(P.c, 0, 0); return c; }
  // una tela di passaggio si svuota appena usata: ognuna occupa ~11 MB e, lasciata al garbage collector, nel worker
  // si accumulano (con la grafica software la quarta città arrivava dopo 35 s invece di 3)
  const butta = c => { c.width = 0; c.height = 0; };
  // riflette nell'acqua quello che c'è già sulla tela
  function rifletti(P, ...args) { const c = copia(P); riflesso(P, c, ...args); butta(c); }
  function poli(P, pts, fill) {
    const g = P.g;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) { const [s, h] = pts[i]; if (i) g.lineTo(P.x(s), P.y(h)); else g.moveTo(P.x(s), P.y(h)); }
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  function rett(P, s, h, w, alt, fill) { P.g.fillStyle = fill; P.g.fillRect(P.x(s), P.y(h + alt), P.m(w), P.m(alt)); }
  function ellisse(P, s, h, rx, ry, fill) { const g = P.g; g.beginPath(); g.ellipse(P.x(s), P.y(h), Math.max(0.5, P.m(rx)), Math.max(0.5, P.m(ry)), 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function arco(P, s, h, w, alt, fill) {   // apertura ad arco a tutto sesto: larga w, alta alt (piedritti compresi)
    const g = P.g, r = w / 2, hp = Math.max(0, alt - r);
    g.beginPath(); g.moveTo(P.x(s - r), P.y(h)); g.lineTo(P.x(s - r), P.y(h + hp));
    g.arc(P.x(s), P.y(h + hp), Math.max(0.4, P.m(r)), Math.PI, 0); g.lineTo(P.x(s + r), P.y(h)); g.closePath();
    g.fillStyle = fill; g.fill();
  }
  // fascia orizzontale sfumata tra le quote h0 e h1 (alpha a0 → a1)
  function sfuma(P, h0, h1, c0, c1, a0 = 1, a1 = 1) {
    const g = P.g, y0 = P.y(h0), y1 = P.y(h1);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, rgba(c0, a0)); gr.addColorStop(1, rgba(c1, a1));
    g.fillStyle = gr; g.fillRect(0, Math.min(y0, y1), P.W, Math.abs(y1 - y0) + 1);
  }

  // ---------- paesaggio ----------
  // crinale di monti o colline: profilo a più scale, colore più velato verso la base, neve con il lato in ombra, bosco
  function crinale(P, o) {
    const pts = [], step = o.passo || 5, ph = o.fase ?? P.rnd() * 100;
    let top = -1e9;
    for (let s = o.da; s <= o.a + step; s += step) {
      const u = (s - o.da) / (o.a - o.da);
      let h = o.alt * (0.58 + 0.24 * Math.sin(s / 173 + ph) + 0.12 * Math.sin(s / 61 + ph * 2.3) + 0.05 * Math.sin(s / 19 + ph * 3.1));
      if (o.punte) h += o.alt * 0.42 * Math.pow(Math.abs(Math.sin(s / 97 + ph * 0.7)), 5) + (P.rnd() - 0.5) * o.alt * 0.04;
      if (o.forma) h *= o.forma(s, cl(u, 0, 1));
      pts.push([s, o.base + Math.max(0, h)]);
      top = Math.max(top, o.base + h);
    }
    // sul piano lontano (P.gL) vanno i monti veri: base all'altezza degli occhi o più su e senza bosco né case sopra
    // (quelli con il bosco hanno quartieri e monumenti appoggiati: restano con la città). o.piano lo decide a mano.
    const lontano = P.piani && (o.piano === 'lontano' || (o.piano !== 'vicino' && o.base >= -10 && !o.bosco));
    if (lontano) P.lontano = true;
    const g = lontano ? P.gL : P.g;
    const path = () => { g.beginPath(); g.moveTo(P.x(o.da), P.y(o.base - 3)); for (const [s, h] of pts) g.lineTo(P.x(s), P.y(h)); g.lineTo(P.x(o.a), P.y(o.base - 3)); g.closePath(); };
    const gr = g.createLinearGradient(0, P.y(top), 0, P.y(o.base));
    gr.addColorStop(0, o.colore); gr.addColorStop(1, mix(o.colore, P.orizzonte, o.velo ?? 0.45));
    path(); g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip();
    if (o.neve != null) {   // neve sopra una linea ondulata
      const sl = s => o.neve + o.alt * (0.08 * Math.sin(s / 41 + ph) + 0.05 * Math.sin(s / 13 + ph * 2));
      g.beginPath();
      pts.forEach(([s, h], i) => (i ? g.lineTo(P.x(s), P.y(h + 1)) : g.moveTo(P.x(s), P.y(h + 1))));
      for (let i = pts.length - 1; i >= 0; i--) { const [s, h] = pts[i]; g.lineTo(P.x(s), P.y(Math.min(h, sl(s)))); }
      g.closePath(); g.fillStyle = o.colNeve || '#f4f7fb'; g.fill();
    }
    // chiaroscuro dei versanti (il sole viene da sinistra): dove il crinale, smussato, scende verso destra il versante
    // guarda a destra ed è in ombra; dove sale guarda il sole. Colonne sottili con l'ombra che sfuma verso valle.
    if (o.punte || o.rilievo) {
      const k = Math.max(2, Math.round(30 / step)), n = pts.length, liscio = [];
      for (let i = 0; i < n; i++) { let t = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) { t += pts[j][1]; c++; } liscio.push(t / c); }
      const forza = o.rilievo ?? 1;
      for (let i = 1; i < n - 1; i++) {
        const pend = (liscio[i + 1] - liscio[i - 1]) / (2 * step);
        const a = cl(Math.abs(pend) * 0.5, 0, 0.2) * forza;
        if (a < 0.01) continue;
        const [s0, h0] = pts[i], x0 = P.x(s0 - step / 2), w = P.m(step) + 0.6;
        const gr = g.createLinearGradient(0, P.y(h0), 0, P.y(o.base));
        const c = pend < 0 ? '#24304a' : '#fff6e6', aa = pend < 0 ? a : a * 0.45;
        gr.addColorStop(0, rgba(c, aa)); gr.addColorStop(1, rgba(c, aa * 0.15));
        g.fillStyle = gr; g.fillRect(x0, P.y(h0) - 1, w, P.y(o.base) - P.y(h0) + 1);
      }
    }
    if (o.neve != null) { g.fillStyle = rgba(P.orizzonte, o.veloNeve ?? 0.25); g.fillRect(P.x(o.da), P.y(top), P.m(o.a - o.da), P.y(o.base) - P.y(top)); }
    if (o.bosco) {   // bosco: macchioline appena più scure o più chiare
      const n = Math.min(6000, Math.round((o.a - o.da) * Math.max(1, top - o.base) * P.k * 0.05));
      for (let i = 0; i < n; i++) {
        const s = P.rr(o.da, o.a), h = o.base + Math.pow(P.rnd(), 1.4) * (top - o.base);
        g.fillStyle = P.rnd() < 0.6 ? 'rgba(29,42,28,0.08)' : 'rgba(232,240,200,0.05)';
        g.fillRect(P.x(s), P.y(h), Math.max(1, P.m(P.rr(1, 2.6))), Math.max(1, P.m(P.rr(0.8, 1.8))));
      }
    }
    g.restore();
    const prof = pts;
    prof.alt = s => { const i = cl(Math.floor((s - o.da) / step), 0, prof.length - 2), [s0, h0] = prof[i], [s1, h1] = prof[i + 1]; return h0 + (h1 - h0) * cl((s - s0) / (s1 - s0), 0, 1); };
    return prof;
  }
  // acqua tra la riva (h0) e il fondo (h1): più chiara e velata lontano, più profonda vicino
  function acqua(P, h0, h1, lontano, vicino, da = -S_MAX, a = S_MAX) {
    const g = P.g, y0 = P.y(h0), y1 = P.y(h1), x0 = P.x(da), x1 = P.x(a);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, mix(lontano, P.orizzonte, 0.3)); gr.addColorStop(0.3, lontano); gr.addColorStop(1, vicino);
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // increspature: trattini chiari e scuri, più lunghi e spessi vicino
  function onde(P, h0, h1, col, da = -S_MAX, a = S_MAX, n = 1) {
    const g = P.g, y0 = P.y(h0), y1 = P.y(h1), x0 = P.x(da), x1 = P.x(a);
    const tot = Math.round((x1 - x0) * (y1 - y0) / 90 * n);
    for (let i = 0; i < tot; i++) {
      const t = Math.pow(P.rnd(), 1.3), y = y0 + (y1 - y0) * t;
      g.fillStyle = P.rnd() < 0.55 ? rgba('#ffffff', 0.07 + 0.16 * P.rnd()) : rgba(col, 0.25);
      g.fillRect(P.rr(x0, x1), y, P.m(3 + 26 * t) * P.rr(0.5, 1.5), Math.max(1, P.m(0.25 + 0.6 * t)));
    }
  }
  // riflesso nell'acqua di quello che sta sopra la quota hAsse (fino a "alto" metri sopra), dentro [da, a]
  function riflesso(P, sorgente, hAsse, alto, alpha, da = -S_MAX, a = S_MAX, sfoca = 1) {
    const g = P.g, ya = P.y(hAsse), hp = P.m(alto), x0 = Math.max(0, P.x(da)), w = Math.min(P.W, P.x(a)) - x0;
    if (w <= 0) return;
    g.save();
    g.beginPath(); g.rect(x0, ya, w, hp); g.clip();
    g.globalAlpha = alpha;
    if (sfoca > 0 && 'filter' in g) g.filter = `blur(${Math.max(0.5, P.m(sfoca)).toFixed(1)}px)`;
    g.translate(0, 2 * ya); g.scale(1, -1);
    g.drawImage(sorgente, x0, ya - hp, w, hp, x0, ya - hp, w, hp);
    g.restore();
  }

  // ---------- alberi (sz = altezza in metri, già in scala) ----------
  function pino(P, s, base, sz, col) {   // pino a ombrello (Roma, Napoli)
    poli(P, [[s - sz * 0.035, base], [s + sz * 0.035, base], [s + sz * 0.06, base + sz * 0.78], [s + sz * 0.02, base + sz * 0.78]], mix(col, '#4b3a2c', 0.65));
    ellisse(P, s + sz * 0.04, base + sz * 0.86, sz * 0.6, sz * 0.2, col);
    ellisse(P, s - sz * 0.1, base + sz * 0.93, sz * 0.42, sz * 0.13, luce(col, 0.14));
    ellisse(P, s + sz * 0.2, base + sz * 0.8, sz * 0.3, sz * 0.08, luce(col, -0.2));
  }
  function cipresso(P, s, base, sz, col) {
    ellisse(P, s, base + sz * 0.5, sz * 0.12, sz * 0.52, col);
    ellisse(P, s - sz * 0.035, base + sz * 0.56, sz * 0.055, sz * 0.38, luce(col, 0.12));
  }
  function chioma(P, s, base, sz, col) {   // latifoglia tonda (platani, tigli)
    rett(P, s - sz * 0.04, base, sz * 0.08, sz * 0.45, mix(col, '#4b3a2c', 0.55));
    ellisse(P, s, base + sz * 0.68, sz * 0.4, sz * 0.32, col);
    ellisse(P, s - sz * 0.14, base + sz * 0.76, sz * 0.24, sz * 0.2, luce(col, 0.15));
    ellisse(P, s + sz * 0.16, base + sz * 0.6, sz * 0.22, sz * 0.18, luce(col, -0.18));
  }
  function abete(P, s, base, sz, col) {
    rett(P, s - sz * 0.03, base, sz * 0.06, sz * 0.15, '#4b3a2c');
    poli(P, [[s - sz * 0.28, base + sz * 0.1], [s + sz * 0.28, base + sz * 0.1], [s, base + sz]], col);
    poli(P, [[s, base + sz], [s + sz * 0.28, base + sz * 0.1], [s + sz * 0.05, base + sz * 0.1]], luce(col, -0.18));
  }
  function palma(P, s, base, sz, col) {
    const g = P.g, cx = s + sz * 0.1, cy = base + sz;
    g.strokeStyle = mix(col, '#7a6040', 0.65); g.lineWidth = Math.max(1, P.m(sz * 0.045));
    g.beginPath(); g.moveTo(P.x(s), P.y(base)); g.quadraticCurveTo(P.x(s + sz * 0.16), P.y(base + sz * 0.5), P.x(cx), P.y(cy)); g.stroke();
    g.strokeStyle = col; g.lineWidth = Math.max(1, P.m(sz * 0.06));
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.05 - i * Math.PI / 7.5, ex = cx + Math.cos(a) * sz * 0.48, ey = cy - sz * 0.2 - Math.abs(Math.sin(a)) * sz * 0.05;
      g.beginPath(); g.moveTo(P.x(cx), P.y(cy)); g.quadraticCurveTo(P.x(cx + Math.cos(a) * sz * 0.3), P.y(cy + sz * 0.14), P.x(ex), P.y(ey)); g.stroke();
    }
  }
  const ALBERI = { pino, cipresso, chioma, abete, palma };
  function alberi(P, da, a, base, tipo, sz, cols, fitto = 0.6, d = 0) {
    for (let s = da; s < a; s += sz * P.rr(0.45, 1.3) / fitto) ALBERI[tipo](P, s, base + P.rr(-0.4, 0.4) * sz * 0.1, sz * P.rr(0.8, 1.2), P.aria(P.pick(cols), d));
  }

  // ---------- palazzi ----------
  // Stile di una città: muri, tetti e tipo di tetto, finestre (in metri), persiane, balconi, cornici.
  // Un palazzo largo w e alto h (metri già in scala sc) poggiato alla quota base; d = foschia.
  function palazzo(P, s, base, w, h, st, sc, d) {
    const g = P.g, x0 = P.x(s), yb = P.y(base), Wp = P.m(w), Hp = P.m(h), yt = yb - Hp;
    if (Wp < 0.6 || Hp < 0.6) return;
    const muro = P.aria(P.pick(st.muri), d);
    g.fillStyle = muro; g.fillRect(x0, yt, Wp, Hp);
    if (Wp < 9) {   // lontano: bastano la facciata, un'ombra sul lato e il tetto (sono pochi pixel)
      if (Wp >= 4) { g.fillStyle = luce(muro, s < 0 ? -0.25 : 0.1); g.fillRect(s < 0 ? x0 + Wp * 0.7 : x0, yt, Wp * 0.3, Hp); }
      const tt = st.tetto, hm = tt === 'falda' ? Math.min(Wp * 0.45, Hp * 0.5) : tt === 'mansarda' ? Math.min(P.m(5 * sc), Wp * 0.3) : tt === 'coppi' ? Math.min(P.m(2.5 * sc), Wp * 0.15) : 0;
      if (hm >= 0.6) { g.fillStyle = P.aria(P.pick(st.tetti || ['#7c858f']), d); g.fillRect(x0 + Wp * 0.1, yt - hm, Wp * 0.8, hm); }
      return;
    }
    // fianco verso il centro: a sinistra del centro si vede il fianco destro (in ombra), a destra quello sinistro (al sole)
    const f = Math.min(0.35, Math.abs(s) / S_MAX * 0.5) * Wp;
    if (f >= 0.8) {
      if (s < 0) { g.fillStyle = luce(muro, -0.28); g.fillRect(x0 + Wp - f, yt, f, Hp); }
      else { g.fillStyle = luce(muro, 0.12); g.fillRect(x0, yt, f, Hp); }
    }
    const fx0 = s < 0 ? x0 : x0 + f, fW = Wp - (f >= 0.8 ? f : 0);   // la facciata
    const piano = P.m((st.piano || 3.3) * sc), fw = P.m((st.finW || 1.2) * sc), fh = P.m((st.finH || 1.7) * sc), dx = P.m((st.finDx || 3) * sc);
    const terra = piano >= 2;
    if (fw >= 1.1 && piano >= 2.2) {
      const fin = P.aria(st.colFin || '#38424e', d * 0.9), rifl = P.aria(st.colRifl || '#8fa3b5', d * 0.9);
      const pers = st.persiane ? P.aria(P.pick(st.persiane), d) : null;
      const n = Math.max(1, Math.floor((fW - dx * 0.4) / dx)), m0 = fx0 + (fW - (n - 1) * dx - fw) / 2;
      let y = yt + piano * (st.sottotetto ?? 0.75), k = 0;
      while (y + fh < yb - (terra ? piano * 1.15 : piano * 0.2)) {
        if (st.cornici && k > 0) { g.fillStyle = luce(muro, 0.2); g.fillRect(fx0, y - piano * 0.28, fW, Math.max(1, piano * 0.07)); }
        if (st.balconi && fw >= 2 && (k === 1 || k === 4)) { g.fillStyle = P.aria(st.balconi, d); g.fillRect(fx0 + fW * 0.03, y + fh * 0.72, fW * 0.94, Math.max(1, fh * 0.12)); }
        for (let i = 0; i < n; i++) {
          const x = m0 + i * dx, q = P.rnd();
          if (pers && fw >= 2.5 && q < 0.25) { g.fillStyle = pers; g.fillRect(x, y, fw, fh); continue; }   // persiane chiuse
          g.fillStyle = fin; g.fillRect(x, y, fw, fh);
          if (fw >= 2.5) { g.fillStyle = q < 0.5 ? rifl : rgba(rifl, 0.45); g.fillRect(x, y, fw, fh * 0.35); }
          if (pers && fw >= 2.5) { g.fillStyle = pers; g.fillRect(x - fw * 0.42, y, fw * 0.38, fh); g.fillRect(x + fw * 1.04, y, fw * 0.38, fh); }
        }
        y += piano; k++;
      }
    } else if (piano >= 1.6) {   // finestre troppo piccole: solo le righe dei piani
      g.fillStyle = rgba('#26303c', 0.16 * (1 - d));
      for (let y = yt + piano * 0.6; y < yb - piano * 0.5; y += piano) g.fillRect(fx0, y, fW, Math.max(1, piano * 0.32));
    }
    if (st.graticcio && piano >= 6) {   // case a graticcio (Fachwerk): travi scure sui piani alti
      const tr = P.aria('#6a4a36', d), lw = Math.max(1, piano * 0.06);
      g.fillStyle = tr;
      for (let y = yt + piano * 0.2; y < yb - piano * 1.1; y += piano) g.fillRect(fx0, y, fW, lw);
      const n = Math.max(2, Math.round(fW / dx));
      for (let i = 0; i <= n; i++) g.fillRect(fx0 + (fW - lw) * i / n, yt, lw, yb - yt - piano * 1.1);
      g.strokeStyle = tr; g.lineWidth = lw;
      for (let y = yt + piano * 0.2; y + piano < yb - piano * 1.1; y += piano) { g.beginPath(); g.moveTo(fx0, y + piano); g.lineTo(fx0 + fW / n, y); g.moveTo(fx0 + fW, y + piano); g.lineTo(fx0 + fW - fW / n, y); g.stroke(); }
    }
    if (terra) { g.fillStyle = luce(muro, -0.2); g.fillRect(fx0, yb - piano * 1.1, fW, piano * 1.1); }   // piano terra, negozi
    if (Hp > 6) { g.fillStyle = 'rgba(20,24,32,0.08)'; g.fillRect(x0, yb - Hp * 0.25, Wp, Hp * 0.25); }
    tetto(P, s, base + h, w, st, muro, sc, d);
  }
  function tetto(P, s, top, w, st, muro, sc, d) {
    const t = st.tetto, col = P.aria(P.pick(st.tetti || ['#7c858f']), d), g = P.g;
    if (t === 'mansarda') {   // Parigi: zinco grigio-azzurro, abbaini e comignoli con i vasi in cotto
      const hm = Math.min(5.5 * sc, w * 0.3);
      rett(P, s - 0.3 * sc, top - 0.5 * sc, w + 0.6 * sc, 0.7 * sc, luce(muro, 0.25));
      poli(P, [[s - 0.2 * sc, top], [s + w + 0.2 * sc, top], [s + w - hm * 0.35, top + hm], [s + hm * 0.35, top + hm]], col);
      if (P.m(sc) > 0.45) {
        const ab = P.aria('#e8e0cf', d), vetro = P.aria('#4a5560', d);
        for (let x = s + 1.6 * sc; x < s + w - 2.4 * sc; x += 3.3 * sc) { rett(P, x, top + 0.6 * sc, 1.2 * sc, 2.1 * sc, ab); rett(P, x + 0.3 * sc, top + 0.8 * sc, 0.6 * sc, 1.2 * sc, vetro); }
      }
      const cot = P.aria('#c2724e', d), cam = P.aria(luce(P.pick(st.muri), -0.1), d);
      for (let x = s + P.rr(0.5, 3) * sc; x < s + w - 2 * sc; x += P.rr(5, 10) * sc) {
        rett(P, x, top + hm - 0.3 * sc, 2.2 * sc, 2.4 * sc, cam);
        if (P.m(sc) > 0.6) for (let v = 0; v < 4; v++) rett(P, x + (0.2 + v * 0.5) * sc, top + hm + 2.1 * sc, 0.32 * sc, 0.7 * sc, cot);
      }
    } else if (t === 'coppi') {   // Italia, Spagna, Portogallo: falde basse in coppi
      const hm = Math.min(3.2 * sc, w * 0.17);
      poli(P, [[s - 0.6 * sc, top], [s + w + 0.6 * sc, top], [s + w * 0.72, top + hm], [s + w * 0.28, top + hm]], col);
      poli(P, [[s + w * 0.5, top], [s + w + 0.6 * sc, top], [s + w * 0.72, top + hm], [s + w * 0.5, top + hm]], luce(col, -0.16));
      if (P.m(sc) > 0.9) { g.fillStyle = 'rgba(42,26,18,0.18)'; for (let y = top + hm * 0.33; y < top + hm; y += hm * 0.33) g.fillRect(P.x(s), P.y(y), P.m(w), 1); }
      if (st.altane && P.rnd() < 0.18) {   // altane e terrazzini sui tetti
        rett(P, s + w * 0.2, top + hm * 0.5, w * 0.3, 3 * sc, P.aria(P.pick(st.muri), d));
        poli(P, [[s + w * 0.17, top + hm * 0.5 + 3 * sc], [s + w * 0.53, top + hm * 0.5 + 3 * sc], [s + w * 0.35, top + hm * 0.5 + 4.2 * sc]], col);
      }
    } else if (t === 'falda') {   // Nord ed Est Europa: falde ripide, timpani, abbaini
      const hm = w * P.rr(0.32, 0.55);
      if (P.rnd() < 0.4) {   // timpano verso la strada
        poli(P, [[s, top], [s + w, top], [s + w / 2, top + hm]], muro);
        poli(P, [[s - 0.4 * sc, top], [s + w / 2, top + hm + 0.4 * sc], [s + w / 2, top + hm - 0.6 * sc], [s + 0.3 * sc, top]], col);
        poli(P, [[s + w + 0.4 * sc, top], [s + w / 2, top + hm + 0.4 * sc], [s + w / 2, top + hm - 0.6 * sc], [s + w - 0.3 * sc, top]], luce(col, -0.2));
        if (P.m(sc) > 0.6) rett(P, s + w * 0.42, top + hm * 0.3, w * 0.16, hm * 0.22, P.aria('#3c4650', d));
      } else {
        poli(P, [[s - 0.4 * sc, top], [s + w + 0.4 * sc, top], [s + w * 0.82, top + hm * 0.7], [s + w * 0.18, top + hm * 0.7]], col);
        poli(P, [[s + w * 0.6, top], [s + w + 0.4 * sc, top], [s + w * 0.82, top + hm * 0.7], [s + w * 0.6, top + hm * 0.7]], luce(col, -0.18));
        if (P.m(sc) > 0.6) for (let x = s + w * 0.22; x < s + w * 0.7; x += 3.5 * sc) { rett(P, x, top + hm * 0.2, 1.3 * sc, 1.6 * sc, P.aria('#e8e2d6', d)); rett(P, x + 0.35 * sc, top + hm * 0.25, 0.6 * sc, 0.9 * sc, P.aria('#3c4650', d)); }
      }
    } else {   // piatto: parapetto, volumi tecnici, a New York le cisterne di legno
      rett(P, s, top, w, 0.8 * sc, luce(muro, -0.1));
      if (P.rnd() < 0.45) rett(P, s + w * P.rr(0.1, 0.6), top + 0.8 * sc, w * 0.24, 2.4 * sc, luce(muro, -0.22));
      if (st.cisterne && P.rnd() < 0.4) {
        const x = s + w * P.rr(0.2, 0.7), c = P.aria('#7a5a3e', d);
        rett(P, x - 1.4 * sc, top + 0.8 * sc, 0.25 * sc, 2.4 * sc, c); rett(P, x + 1.2 * sc, top + 0.8 * sc, 0.25 * sc, 2.4 * sc, c);
        rett(P, x - 1.6 * sc, top + 3.2 * sc, 3.2 * sc, 3.2 * sc, c); poli(P, [[x - 1.8 * sc, top + 6.4 * sc], [x + 1.8 * sc, top + 6.4 * sc], [x, top + 7.8 * sc]], luce(c, -0.2));
      }
    }
  }
  // Quartieri in prospettiva: file di palazzi dalla quota h0 (lontano, verso l'orizzonte) a h1 (vicino); ogni fila più
  // grande e più nitida della precedente. o: { da, a, h0, h1, stile, alt e larg: [min, max] metri veri, forma(s, sc):
  // moltiplica l'altezza, libero(s, h, sc): true dove lasciare lo spazio (un viale, un fiume), alberi: { tipo, col, p, alt } }
  function quartieri(P, o) {
    const st = o.stile, alt = o.alt || st.alt, larg = o.larg || st.larg;
    const wMin = 3.5 / P.k;   // almeno 3,5 pixel: più lontano i palazzi si fondono
    let h = o.h0;
    while (h >= o.h1) {
      const sc = o.scala ? o.scala(h) : scala(h), d = foschia(sc, P.fosch * (o.foschia || 1));
      let s = o.da - P.rr(0, larg[1] * sc);
      while (s < o.a) {
        const w = Math.max(wMin, P.rr(larg[0], larg[1]) * sc);
        let hh = P.rr(alt[0], alt[1]) * sc * (o.forma ? o.forma(s + w / 2, sc) : 1);
        if (o.alte && P.rnd() < o.alte) hh *= P.rr(1.4, 2.1);   // qualche palazzo più alto
        const mezzo = s + w / 2;
        if (!(o.libero && o.libero(mezzo, h, sc)) && !(o.sotto && h > o.sotto(mezzo)) && hh > 0.3 / P.k) {
          if (o.alberi && P.rnd() < o.alberi.p) ALBERI[o.alberi.tipo](P, mezzo, h, P.rr(0.8, 1.2) * (o.alberi.alt || 14) * sc, P.aria(P.pick(o.alberi.col), d));
          else palazzo(P, s, h + P.rr(-0.25, 0.25) * sc, w, hh, st, sc, d);
        }
        s += w * P.rr(0.86, 1.0);
      }
      h -= Math.max(1.5, alt[0] * sc * (o.passo || 0.66)) * (o.fitte || 1);
    }
  }
  // grattacielo di vetro con le fasce dei piani; cima: 'antenna', 'punta', 'gradoni', 'tetto'
  function grattacielo(P, s, base, w, h, col, d, cima, tondo) {
    const g = P.g, x0 = P.x(s), x1 = P.x(s + w), yb = P.y(base), yt = P.y(base + h), c = P.aria(col, d);
    if (tondo) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, luce(c, 0.3)); gr.addColorStop(0.55, c); gr.addColorStop(1, luce(c, -0.32));
      g.fillStyle = gr; g.fillRect(x0, yt, x1 - x0, yb - yt);
    } else {   // squadrato: la facciata al sole e il fianco in ombra
      const f = (x1 - x0) * 0.3;
      g.fillStyle = luce(c, 0.1); g.fillRect(x0, yt, x1 - x0 - f, yb - yt);
      g.fillStyle = luce(c, -0.28); g.fillRect(x1 - f, yt, f, yb - yt);
    }
    const gv = g.createLinearGradient(0, yt, 0, yb);   // il cielo riflesso: più chiaro in alto
    gv.addColorStop(0, rgba('#ffffff', 0.18 * (1 - d))); gv.addColorStop(1, rgba('#ffffff', 0));
    g.fillStyle = gv; g.fillRect(x0, yt, x1 - x0, yb - yt);
    const pf = P.m(3.8);
    if (pf >= 1.5) { g.fillStyle = rgba('#1a2430', 0.16 * (1 - d)); for (let y = yt + pf; y < yb; y += pf) g.fillRect(x0, y, x1 - x0, Math.max(1, pf * 0.2)); }
    if (cima === 'antenna') { rett(P, s + w * 0.47, base + h, w * 0.06, h * 0.16, P.aria('#a0a8b2', d)); rett(P, s + w * 0.2, base + h, w * 0.6, w * 0.15, luce(c, -0.2)); }
    if (cima === 'punta') poli(P, [[s, base + h], [s + w, base + h], [s + w * 0.5, base + h + w * 1.1]], luce(c, 0.08));
    if (cima === 'gradoni') { rett(P, s + w * 0.15, base + h, w * 0.7, h * 0.05, c); rett(P, s + w * 0.3, base + h * 1.05, w * 0.4, h * 0.04, c); }
    if (cima === 'tetto') poli(P, [[s, base + h], [s + w, base + h], [s + w * 0.5, base + h + w * 0.35]], luce(c, -0.1));
  }
  // un viale o una piazza in prospettiva che porta al monumento: dalla quota h0 a h1, mezza larghezza "mezza" (m veri)
  function viale(P, o) {
    const g = P.g, a0 = o.mezza * scala(o.h0), a1 = o.mezza * scala(o.h1) * 1.2;
    const gr = g.createLinearGradient(0, P.y(o.h0), 0, P.y(o.h1));
    gr.addColorStop(0, P.aria(o.suolo, 0.55)); gr.addColorStop(1, P.aria(o.suolo, 0.12));
    poli(P, [[-a0, o.h0], [a0, o.h0], [a1, o.h1 - 2], [-a1, o.h1 - 2]], gr);
    if (o.prato) for (const l of [-1, 1]) poli(P, [[l * a0 * 0.2, o.h0], [l * a0 * 0.85, o.h0], [l * a1 * 0.85, o.h1 - 2], [l * a1 * 0.2, o.h1 - 2]], P.aria(o.prato, 0.25));
    if (!o.alberi) return;
    for (let h = o.h0; h >= o.h1; h -= Math.max(0.8, h * h * 0.0011 * (o.passo || 1))) {
      const sc = scala(h), d = foschia(sc, P.fosch);
      for (const l of [-1, 1]) for (const k of o.file || [1]) ALBERI[o.alberi.tipo](P, l * o.mezza * k * sc, h, (o.alberi.alt || 14) * sc * P.rr(0.9, 1.1), P.aria(P.pick(o.alberi.col), d));
    }
  }
  // gente a passeggio in una piazza (tra le quote h0 e h1, dentro la mezza larghezza "mezza" in metri veri)
  function gente(P, h0, h1, mezza, n) {
    const col = ['#2e3a4a', '#8a3b30', '#3f5f8a', '#e6e0d2', '#4a4a4a', '#b07a3a', '#2f5a48', '#c75b4a'];
    for (let i = 0; i < n; i++) {
      const h = h0 + (h1 - h0) * Math.pow(P.rnd(), 0.7), sc = scala(h), x = P.rr(-1, 1) * mezza * sc, a = 1.75 * sc;
      if (P.m(a) < 1.2) continue;
      rett(P, x - a * 0.13, h, a * 0.26, a * 0.78, P.pick(col));
      ellisse(P, x, h + a * 0.88, a * 0.12, a * 0.12, '#d9b8a0');
    }
  }
  function barca(P, s, base, w, vela) {
    poli(P, [[s - w / 2, base + w * 0.08], [s + w / 2, base + w * 0.08], [s + w * 0.38, base - w * 0.06], [s - w * 0.38, base - w * 0.06]], '#f4f4f2');
    if (vela) poli(P, [[s - w * 0.02, base + w * 0.1], [s - w * 0.02, base + w * 1.05], [s + w * 0.36, base + w * 0.14]], '#fbfbf8');
    else rett(P, s - w * 0.2, base + w * 0.08, w * 0.35, w * 0.12, '#dfe3e6');
  }

  // =====================================================================
  // ---------- monumenti (al centro, R-308) ----------
  // Torre Eiffel: profilo esponenziale (base larga 0,41 dell'altezza), i quattro piedi con l'arco, le piattaforme e la
  // trama del ferro; disegnata su un livello a parte per lasciare vuoti gli spazi tra i piedi.
  function eiffel(P, s, base, H, col) {
    const L = strato(P, Q => {
      const g = Q.g, c = Q.aria(col, 0.06);
      const hw = y => H * 0.205 * Math.exp(-3.2 * y);   // mezza larghezza alla quota relativa y
      const path = () => {
        g.beginPath(); g.moveTo(Q.x(s - hw(0)), Q.y(base));
        for (let y = 0; y <= 0.93; y += 0.01) g.lineTo(Q.x(s - hw(y)), Q.y(base + H * y));
        for (let y = 0.93; y >= 0; y -= 0.01) g.lineTo(Q.x(s + hw(y)), Q.y(base + H * y));
        g.closePath();
      };
      const gr = g.createLinearGradient(Q.x(s - hw(0)), 0, Q.x(s + hw(0)), 0);
      gr.addColorStop(0, luce(c, 0.18)); gr.addColorStop(0.5, c); gr.addColorStop(1, luce(c, -0.25));
      path(); g.fillStyle = gr; g.fill();
      g.save(); path(); g.clip();   // la trama a croce del ferro
      g.strokeStyle = rgba(luce(c, -0.45), 0.55); g.lineWidth = Math.max(0.7, Q.m(H * 0.0028));
      for (let y = 0; y < 0.93; y += 0.026) {
        const a = hw(y), b = hw(y + 0.026);
        g.beginPath();
        g.moveTo(Q.x(s - a), Q.y(base + H * y)); g.lineTo(Q.x(s + b), Q.y(base + H * (y + 0.026)));
        g.moveTo(Q.x(s + a), Q.y(base + H * y)); g.lineTo(Q.x(s - b), Q.y(base + H * (y + 0.026)));
        g.moveTo(Q.x(s - a), Q.y(base + H * y)); g.lineTo(Q.x(s + a), Q.y(base + H * y));
        g.stroke();
      }
      g.restore();
      // i vuoti: l'arco tra i piedi e lo spazio tra le gambe fino al secondo piano
      g.save(); g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.moveTo(Q.x(s - H * 0.125), Q.y(base));
      g.quadraticCurveTo(Q.x(s - H * 0.115), Q.y(base + H * 0.11), Q.x(s - H * 0.06), Q.y(base + H * 0.15));
      g.quadraticCurveTo(Q.x(s), Q.y(base + H * 0.172), Q.x(s + H * 0.06), Q.y(base + H * 0.15));
      g.quadraticCurveTo(Q.x(s + H * 0.115), Q.y(base + H * 0.11), Q.x(s + H * 0.125), Q.y(base));
      g.closePath(); g.fill();
      g.beginPath(); g.moveTo(Q.x(s - H * 0.052), Q.y(base + H * 0.205)); g.lineTo(Q.x(s - H * 0.018), Q.y(base + H * 0.36));
      g.lineTo(Q.x(s + H * 0.018), Q.y(base + H * 0.36)); g.lineTo(Q.x(s + H * 0.052), Q.y(base + H * 0.205)); g.closePath(); g.fill();
      g.restore();
      // l'arco decorativo sotto il primo piano, le piattaforme, la cima
      g.strokeStyle = c; g.lineWidth = Math.max(1, Q.m(H * 0.008));
      g.beginPath(); g.moveTo(Q.x(s - H * 0.115), Q.y(base + H * 0.12)); g.quadraticCurveTo(Q.x(s), Q.y(base + H * 0.205), Q.x(s + H * 0.115), Q.y(base + H * 0.12)); g.stroke();
      const piat = (y, mezza, alt) => { rett(Q, s - mezza, base + H * y, mezza * 2, H * alt, luce(c, -0.3)); rett(Q, s - mezza, base + H * (y + alt * 0.6), mezza * 2, H * alt * 0.4, luce(c, 0.05)); };
      piat(0.19, hw(0.19) + H * 0.012, 0.022);
      piat(0.38, hw(0.38) + H * 0.008, 0.016);
      piat(0.9, hw(0.9) + H * 0.006, 0.02);
      rett(Q, s - H * 0.004, base + H * 0.92, H * 0.008, H * 0.08, luce(c, -0.15));
    });
    P.g.drawImage(L, 0, 0);
    butta(L);
  }
  // cupola su tamburo con le colonnine e la lanterna
  function cupola(P, s, base, r, colT, colC, d, alta = 1.15) {
    const g = P.g, ct = P.aria(colT, d), cc = P.aria(colC, d);
    rett(P, s - r, base, r * 2, r * 0.75, ct);
    for (let i = -4; i <= 4; i++) rett(P, s + i * r * 0.22 - r * 0.035, base + r * 0.1, r * 0.07, r * 0.5, luce(ct, -0.3));
    rett(P, s - r * 1.05, base + r * 0.7, r * 2.1, r * 0.08, luce(ct, 0.15));
    g.beginPath(); g.ellipse(P.x(s), P.y(base + r * 0.78), P.m(r * 0.95), P.m(r * alta), 0, Math.PI, 0);
    const gr = g.createLinearGradient(P.x(s - r), 0, P.x(s + r), 0); gr.addColorStop(0, luce(cc, 0.3)); gr.addColorStop(0.45, cc); gr.addColorStop(1, luce(cc, -0.35));
    g.fillStyle = gr; g.fill();
    if (P.m(r) > 6) { g.strokeStyle = rgba(luce(cc, -0.4), 0.5); g.lineWidth = 1; for (let i = 1; i <= 3; i++) { g.beginPath(); g.ellipse(P.x(s), P.y(base + r * 0.78), P.m(r * 0.95 * i / 3.4), P.m(r * alta), 0, Math.PI, 0); g.stroke(); } }
    rett(P, s - r * 0.13, base + r * (0.75 + alta), r * 0.26, r * 0.35, ct);
    poli(P, [[s - r * 0.16, base + r * (1.1 + alta)], [s + r * 0.16, base + r * (1.1 + alta)], [s, base + r * (1.35 + alta)]], cc);
  }
  // Colosseo: metà visibile dell'ellisse (le arcate si stringono verso i lati), tre ordini di archi e l'attico; a destra
  // l'anello esterno è crollato e si vede quello interno, più basso e in ombra.
  function colosseo(P, s, base, W, H) {
    const L = strato(P, Q => {
      const g = Q.g, pietra = Q.aria('#dcc59e', 0.04), dentro = '#4e3d2e', N = 40;
      const X = phi => s + (W / 2) * Math.sin(phi);              // phi da -π/2 (sinistra) a π/2 (destra)
      const Y = phi => base - H * 0.04 * Math.cos(phi);          // la base si abbassa un po' al centro (è più vicina)
      const alto = phi => { const u = (phi + Math.PI / 2) / Math.PI; return u < 0.66 ? H : u < 0.7 ? H * (1 - (u - 0.66) * 6) : H * (0.72 - (u - 0.7) * 0.5) + H * 0.05 * Math.sin(u * 60); };
      // anello interno (si vede dove quello esterno è crollato)
      const inn = [];
      for (let i = 0; i <= 60; i++) { const phi = -Math.PI / 2 + Math.PI * i / 60; inn.push([s + (W * 0.44) * Math.sin(phi), Y(phi) + H * 0.02]); }
      for (let i = 60; i >= 0; i--) { const phi = -Math.PI / 2 + Math.PI * i / 60; inn.push([s + (W * 0.44) * Math.sin(phi), Y(phi) + H * 0.83]); }
      poli(Q, inn, luce(pietra, -0.22));
      for (let i = 0; i < N; i++) {
        const phi = -Math.PI / 2 + Math.PI * (i + 0.5) / N; if (phi < 0.3) continue;
        for (let o = 0; o < 3; o++) arco(Q, s + W * 0.44 * Math.sin(phi), Y(phi) + H * (0.06 + o * 0.25), W * 0.44 * Math.PI / N * Math.cos(phi) * 0.55, H * 0.16, luce(dentro, 0.1 + o * 0.08));
      }
      // anello esterno
      const pts = [];
      for (let i = 0; i <= 120; i++) { const phi = -Math.PI / 2 + Math.PI * i / 120; pts.push([X(phi), Y(phi)]); }
      for (let i = 120; i >= 0; i--) { const phi = -Math.PI / 2 + Math.PI * i / 120; pts.push([X(phi), Y(phi) + alto(phi)]); }
      g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(Q.x(a), Q.y(b)) : g.moveTo(Q.x(a), Q.y(b)))); g.closePath();
      const gr = g.createLinearGradient(Q.x(s - W / 2), 0, Q.x(s + W / 2), 0);
      gr.addColorStop(0, luce(pietra, -0.12)); gr.addColorStop(0.3, luce(pietra, 0.12)); gr.addColorStop(0.65, pietra); gr.addColorStop(1, luce(pietra, -0.3));
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      for (let i = 0; i < 260; i++) { g.fillStyle = Q.rnd() < 0.5 ? 'rgba(107,86,56,0.07)' : 'rgba(255,243,220,0.07)'; g.fillRect(Q.x(s + Q.rr(-W / 2, W / 2)), Q.y(base + Q.rr(0, H)), Q.m(Q.rr(2, 9)), Q.m(Q.rr(1, 6))); }   // macchie del travertino
      for (let o = 0; o < 3; o++) {   // tre ordini di arcate con le semicolonne
        const h0 = H * (0.03 + o * 0.245), ha = H * 0.175;
        for (let i = 0; i < N; i++) {
          const p0 = -Math.PI / 2 + Math.PI * i / N, p1 = -Math.PI / 2 + Math.PI * (i + 1) / N, pm = (p0 + p1) / 2;
          if (h0 + ha > alto(pm) - H * 0.02) continue;
          const xa = X(p0), xb = X(p1), w = (xb - xa);
          rett(Q, xa - w * 0.06, Y(pm) + h0, w * 0.12, H * 0.22, luce(pietra, 0.16));
          arco(Q, (xa + xb) / 2, Y(pm) + h0, w * 0.62, ha, mix(dentro, '#8a7254', o * 0.16));
          if (Q.m(w) > 3) arco(Q, (xa + xb) / 2 + w * 0.1, Y(pm) + h0, w * 0.4, ha * 0.85, 'rgba(42,30,20,0.35)');
        }
        rett(Q, s - W / 2, base + h0 + H * 0.2, W, H * 0.02, 'rgba(255,243,220,0.35)');
        rett(Q, s - W / 2, base + h0 + H * 0.218, W, H * 0.008, 'rgba(58,42,26,0.25)');
      }
      for (let i = 0; i < N; i += 2) { const p = -Math.PI / 2 + Math.PI * (i + 1) / N; if (alto(p) < H * 0.95) continue; rett(Q, X(p) - W * 0.006 * Math.cos(p), Y(p) + H * 0.84, W * 0.012 * Math.cos(p) + 0.3, H * 0.055, 'rgba(58,42,26,0.55)'); }   // l'attico
      g.restore();
    });
    P.g.drawImage(L, 0, 0);
    butta(L);
  }
  // Big Ben (Elizabeth Tower): fusto con le lesene, quadranti, la loggia delle campane e la guglia in ghisa
  function bigben(P, s, base, H) {
    const pietra = P.aria('#d6be8a', 0.04), ombra = luce(pietra, -0.3), w = H * 0.12, g = P.g;
    const gr = g.createLinearGradient(P.x(s - w / 2), 0, P.x(s + w / 2), 0); gr.addColorStop(0, luce(pietra, 0.12)); gr.addColorStop(0.6, pietra); gr.addColorStop(1, ombra);
    g.fillStyle = gr; g.fillRect(P.x(s - w / 2), P.y(base + H * 0.6), P.m(w), P.m(H * 0.6));
    for (let i = 0; i < 5; i++) rett(P, s - w / 2 + w * (0.08 + i * 0.205), base + H * 0.03, w * 0.04, H * 0.56, luce(pietra, -0.18));
    for (let y = 0.08; y < 0.58; y += 0.035) rett(P, s - w / 2, base + H * y, w, H * 0.004, 'rgba(91,74,46,0.35)');
    for (let y = 0.1; y < 0.56; y += 0.07) for (let i = 0; i < 4; i++) rett(P, s - w / 2 + w * (0.15 + i * 0.205), base + H * y, w * 0.08, H * 0.03, P.aria('#4a4a4a', 0.05));
    rett(P, s - w * 0.62, base + H * 0.6, w * 1.24, H * 0.13, pietra);
    rett(P, s + w * 0.3, base + H * 0.6, w * 0.32, H * 0.13, ombra);
    ellisse(P, s, base + H * 0.665, w * 0.47, w * 0.47, '#c9a646');
    ellisse(P, s, base + H * 0.665, w * 0.42, w * 0.42, '#f6efd9');
    g.strokeStyle = '#2b2b2b'; g.lineWidth = Math.max(1, P.m(w * 0.04));
    g.beginPath(); g.moveTo(P.x(s), P.y(base + H * 0.665)); g.lineTo(P.x(s - w * 0.12), P.y(base + H * 0.665 + w * 0.3));
    g.moveTo(P.x(s), P.y(base + H * 0.665)); g.lineTo(P.x(s + w * 0.3), P.y(base + H * 0.665 - w * 0.05)); g.stroke();
    if (P.m(w) > 14) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rett(P, s + Math.cos(a) * w * 0.36 - w * 0.015, base + H * 0.665 + Math.sin(a) * w * 0.36 - w * 0.015, w * 0.03, w * 0.03, '#2b2b2b'); }
    rett(P, s - w * 0.55, base + H * 0.73, w * 1.1, H * 0.06, pietra);
    for (let i = 0; i < 4; i++) arco(P, s - w * 0.36 + i * w * 0.24, base + H * 0.735, w * 0.13, H * 0.045, P.aria('#3c3a36', 0.05));
    rett(P, s - w * 0.6, base + H * 0.79, w * 1.2, H * 0.012, luce(pietra, 0.15));
    poli(P, [[s - w * 0.55, base + H * 0.8], [s + w * 0.55, base + H * 0.8], [s + w * 0.16, base + H * 0.95], [s - w * 0.16, base + H * 0.95]], P.aria('#4b5560', 0.04));
    poli(P, [[s, base + H * 0.8], [s + w * 0.55, base + H * 0.8], [s + w * 0.16, base + H * 0.95], [s, base + H * 0.95]], P.aria('#353d46', 0.04));
    poli(P, [[s - w * 0.16, base + H * 0.95], [s + w * 0.16, base + H * 0.95], [s, base + H]], P.aria('#4b5560', 0.04));
    rett(P, s - w * 0.02, base + H * 0.985, w * 0.04, H * 0.025, '#d8b24a');
    for (const dx of [-0.55, 0.55]) poli(P, [[s + w * dx - w * 0.07, base + H * 0.79], [s + w * dx + w * 0.07, base + H * 0.79], [s + w * dx, base + H * 0.87]], pietra);
  }
  // il Parlamento: facciata gotica lunga con le torrette a guglia, la torre centrale ottagonale e la Victoria Tower in fondo
  function parlamento(P, s0, s1, base, H, d) {
    const pietra = P.aria('#cfb784', d), ombra = luce(pietra, -0.25), scuro = 'rgba(58,58,58,0.55)', tetto = P.aria('#5d6870', d), L = s1 - s0;
    poli(P, [[s0, base + H], [s1, base + H], [s1 - 3, base + H + 6], [s0 + 3, base + H + 6]], tetto);
    rett(P, s0, base, L, H, pietra);
    for (let x = s0 + 1.2; x < s1 - 1; x += 3.4) { rett(P, x, base + H * 0.1, 0.45, H * 0.85, ombra); rett(P, x + 1.2, base + H * 0.2, 1, H * 0.16, scuro); rett(P, x + 1.2, base + H * 0.5, 1, H * 0.16, scuro); }
    rett(P, s0, base + H * 0.42, L, 0.8, luce(pietra, 0.18));
    for (let x = s0 + 2; x < s1; x += 16) {   // le torrette con la guglia
      rett(P, x, base, 4, H + 6, pietra); rett(P, x + 2.8, base, 1.2, H + 6, ombra);
      poli(P, [[x - 0.3, base + H + 6], [x + 4.3, base + H + 6], [x + 2, base + H + 13]], tetto);
    }
    const c = s0 + L * 0.55;   // la torre centrale
    rett(P, c - 7, base, 14, H * 2.3, pietra); rett(P, c + 3, base, 4, H * 2.3, ombra);
    for (let y = 0.4; y < 2.2; y += 0.35) arco(P, c - 2, base + H * y, 3.2, H * 0.22, scuro);
    poli(P, [[c - 8, base + H * 2.3], [c + 8, base + H * 2.3], [c, base + H * 3.4]], tetto);
    const vt = s0 - 18;   // la Victoria Tower
    rett(P, vt, base, 22, H * 3.6, pietra); rett(P, vt + 15, base, 7, H * 3.6, ombra);
    for (let y = 0.3; y < 3.3; y += 0.45) for (const dx of [5, 12]) arco(P, vt + dx, base + H * y, 3.5, H * 0.3, scuro);
    for (const dx of [0, 19]) { rett(P, vt + dx, base + H * 3.6, 3, 7, pietra); poli(P, [[vt + dx - 0.5, base + H * 3.6 + 7], [vt + dx + 3.5, base + H * 3.6 + 7], [vt + dx + 1.5, base + H * 3.6 + 13]], pietra); }
    rett(P, vt + 10.6, base + H * 3.6, 0.6, 14, '#4a4a4a'); rett(P, vt + 11.2, base + H * 3.6 + 10, 5, 3.4, '#b8463a');
  }
  function londonEye(P, s, base, r, d) {
    const g = P.g, c = P.aria('#e9eef2', d), cy = base + r * 1.12;
    g.strokeStyle = c; g.lineWidth = Math.max(1, P.m(r * 0.02));
    g.beginPath(); g.arc(P.x(s), P.y(cy), P.m(r), 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(P.x(s), P.y(cy), P.m(r * 0.95), 0, Math.PI * 2); g.stroke();
    g.lineWidth = Math.max(0.5, P.m(r * 0.005));
    for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16; g.beginPath(); g.moveTo(P.x(s), P.y(cy)); g.lineTo(P.x(s + Math.cos(a) * r), P.y(cy + Math.sin(a) * r)); g.stroke(); ellisse(P, s + Math.cos(a) * r * 1.03, cy + Math.sin(a) * r * 1.03, r * 0.025, r * 0.018, P.aria('#a9bccb', d)); }
    g.lineWidth = Math.max(1, P.m(r * 0.025));
    g.beginPath(); g.moveTo(P.x(s - r * 0.5), P.y(base)); g.lineTo(P.x(s), P.y(cy)); g.lineTo(P.x(s - r * 0.15), P.y(base)); g.stroke();
  }
  function shard(P, s, base, H, d) {
    const c = P.aria('#b3c6d4', d);
    poli(P, [[s - H * 0.13, base], [s + H * 0.12, base], [s + H * 0.012, base + H * 0.97], [s - H * 0.02, base + H]], c);
    poli(P, [[s + H * 0.01, base], [s + H * 0.12, base], [s + H * 0.012, base + H * 0.97]], luce(c, -0.22));
    poli(P, [[s - H * 0.13, base], [s - H * 0.06, base], [s - H * 0.012, base + H * 0.98], [s - H * 0.02, base + H]], luce(c, 0.15));
  }
  function cetriolo(P, s, base, H, d) {   // il "Gherkin"
    const g = P.g, c = P.aria('#6f8796', d);
    g.beginPath(); g.moveTo(P.x(s - H * 0.17), P.y(base)); g.bezierCurveTo(P.x(s - H * 0.27), P.y(base + H * 0.55), P.x(s - H * 0.12), P.y(base + H * 0.98), P.x(s), P.y(base + H));
    g.bezierCurveTo(P.x(s + H * 0.12), P.y(base + H * 0.98), P.x(s + H * 0.27), P.y(base + H * 0.55), P.x(s + H * 0.17), P.y(base)); g.closePath();
    const gr = g.createLinearGradient(P.x(s - H * 0.2), 0, P.x(s + H * 0.2), 0); gr.addColorStop(0, luce(c, 0.25)); gr.addColorStop(1, luce(c, -0.3));
    g.fillStyle = gr; g.fill();
  }
  function towerBridge(P, s, base, H, d) {
    const pietra = P.aria('#dad2be', d), blu = P.aria('#7d9bb8', d), ombra = luce(pietra, -0.25);
    rett(P, s - H * 1.6, base + H * 0.2, H * 3.2, H * 0.06, blu);
    for (const dx of [-H * 0.5, H * 0.5]) {
      rett(P, s + dx - H * 0.13, base, H * 0.26, H * 0.82, pietra); rett(P, s + dx + H * 0.06, base, H * 0.07, H * 0.82, ombra);
      arco(P, s + dx, base + H * 0.27, H * 0.12, H * 0.28, P.aria('#3f454b', d));
      poli(P, [[s + dx - H * 0.15, base + H * 0.82], [s + dx + H * 0.15, base + H * 0.82], [s + dx, base + H * 1.04]], blu);
      for (const k of [-1, 1]) poli(P, [[s + dx + k * H * 0.13 - H * 0.03, base + H * 0.82], [s + dx + k * H * 0.13 + H * 0.03, base + H * 0.82], [s + dx + k * H * 0.13, base + H * 0.92]], blu);
    }
    rett(P, s - H * 0.37, base + H * 0.66, H * 0.74, H * 0.07, blu);
    rett(P, s - H * 0.37, base + H * 0.25, H * 0.74, H * 0.03, blu);
  }
  // Duomo di Milano: facciata a capanna con i contrafforti a guglia, i portali, la selva di guglie e la Madonnina
  function duomo(P, s, base, W, H) {
    const L = strato(P, Q => {
      const marmo = Q.aria('#f1e9db', 0.03), ombra = luce(marmo, -0.18), scuro = luce(marmo, -0.35), g = Q.g;
      // tiburio e guglia maggiore dietro
      rett(Q, s - W * 0.06, base + H * 0.6, W * 0.12, H * 0.55, ombra);
      poli(Q, [[s - W * 0.035, base + H * 1.12], [s + W * 0.035, base + H * 1.12], [s + W * 0.012, base + H * 1.62], [s - W * 0.012, base + H * 1.62]], marmo);
      for (let y = 1.15; y < 1.6; y += 0.06) rett(Q, s - W * 0.03, base + H * y, W * 0.06, H * 0.005, ombra);
      ellisse(Q, s, base + H * 1.67, W * 0.007, W * 0.022, '#f0c040');
      // la selva di guglie del tetto
      for (let x = s - W * 0.5; x <= s + W * 0.5; x += W * 0.038) { const top = base + H * (0.72 + 0.14 * Math.cos((x - s) / W * Math.PI)); rett(Q, x - W * 0.004, top - H * 0.12, W * 0.008, H * 0.12, ombra); poli(Q, [[x - W * 0.006, top], [x + W * 0.006, top], [x, top + H * 0.13]], marmo); }
      // facciata a capanna, più alta al centro
      poli(Q, [[s - W / 2, base], [s + W / 2, base], [s + W / 2, base + H * 0.5], [s + W * 0.17, base + H * 0.62], [s, base + H * 0.86], [s - W * 0.17, base + H * 0.62], [s - W / 2, base + H * 0.5]], marmo);
      g.save(); g.globalAlpha = 0.5;
      for (let y = 0.04; y < 0.85; y += 0.022) rett(Q, s - W / 2, base + H * y, W, H * 0.002, ombra);
      g.restore();
      // i sei contrafforti con le guglie e le statue
      for (let i = 0; i <= 5; i++) {
        const x = s - W / 2 + W * 0.03 + i * (W * 0.94 / 5), cen = 1 - Math.abs(i - 2.5) / 2.5;
        const top = base + H * (0.5 + cen * 0.3);
        rett(Q, x - W * 0.018, base, W * 0.036, top - base, ombra);
        rett(Q, x - W * 0.008, base, W * 0.016, top - base, marmo);
        poli(Q, [[x - W * 0.022, top], [x + W * 0.022, top], [x + W * 0.006, top + H * 0.2], [x - W * 0.006, top + H * 0.2]], marmo);
        ellisse(Q, x, top + H * 0.22, W * 0.005, W * 0.012, marmo);
        for (let y = 0.15; y < (top - base) / H; y += 0.12) rett(Q, x - W * 0.012, base + H * y, W * 0.024, H * 0.035, scuro);
      }
      // portali e finestroni
      for (let i = 0; i < 5; i++) {
        const x = s - W * 0.376 + i * W * 0.188, big = i === 2;
        arco(Q, x, base, W * (big ? 0.075 : 0.05), H * (big ? 0.3 : 0.22), Q.aria('#5b4c42', 0.03));
        arco(Q, x, base + H * 0.34, W * 0.04, H * 0.16, Q.aria('#7e8a96', 0.03));
        poli(Q, [[x - W * 0.045, base + H * (big ? 0.3 : 0.22)], [x + W * 0.045, base + H * (big ? 0.3 : 0.22)], [x, base + H * (big ? 0.36 : 0.27)]], ombra);
      }
      const gr = g.createLinearGradient(Q.x(s), 0, Q.x(s + W / 2), 0); gr.addColorStop(0, 'rgba(30,36,50,0)'); gr.addColorStop(1, 'rgba(30,36,50,0.16)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(Q.x(s), Q.y(base + H * 1.7), Q.m(W), Q.m(H * 1.7)); g.globalCompositeOperation = 'source-over';
    });
    P.g.drawImage(L, 0, 0);
    butta(L);
  }
  // Römer di Francoforte: le tre case a gradoni con il balcone e l'orologio
  function romer(P, s, base, w) {
    const muri = ['#e1b49a', '#d09a7f', '#e8bea2'];
    for (let i = 0; i < 3; i++) {
      const x = s - w * 1.5 + i * w, col = P.aria(muri[i], 0.02), h = w * (i === 1 ? 1.15 : 1.05), ww = w * 0.97;
      rett(P, x, base, ww, h, col);
      const st = 5, gh = h * 0.95, pts = [[x, base + h]];
      for (let k = 0; k < st; k++) { const dx = ww / 2 * k / st, y = base + h + gh * (k + 1) / st; pts.push([x + dx, y], [x + dx + ww / 2 / st, y]); }
      for (let k = st - 1; k >= 0; k--) { const dx = ww / 2 * k / st, y = base + h + gh * (k + 1) / st; pts.push([x + ww - dx - ww / 2 / st, y], [x + ww - dx, y]); }
      pts.push([x + ww, base + h]);
      poli(P, pts, col);
      rett(P, x + ww * 0.82, base, ww * 0.18, h + gh * 0.3, luce(col, -0.12));
      for (let fy = 0.3; fy < 1.75; fy += 0.27) for (let fx = 0.12; fx < 0.88; fx += 0.2) if (fy < 0.95 || Math.abs(fx + 0.04 - 0.5) < (1.95 - fy) * 0.45) { rett(P, x + ww * fx, base + h * fy, ww * 0.1, h * 0.15, P.aria('#4e5965', 0.02)); rett(P, x + ww * fx, base + h * (fy + 0.1), ww * 0.1, h * 0.05, P.aria('#9fb0c0', 0.02)); }
      for (let a = 0; a < 3; a++) arco(P, x + ww * (0.18 + a * 0.32), base, ww * 0.2, h * 0.24, luce(col, -0.42));
      rett(P, x, base + h * 0.27, ww, h * 0.02, luce(col, 0.2));
      if (i === 1) { rett(P, x + ww * 0.1, base + h * 0.28, ww * 0.8, h * 0.035, '#4a3a30'); ellisse(P, x + ww / 2, base + h * 1.35, ww * 0.09, ww * 0.09, '#2e3a4a'); ellisse(P, x + ww / 2, base + h * 1.35, ww * 0.07, ww * 0.07, '#d8b24a'); }
    }
  }
  function puertaAlcala(P, s, base, W, H) {
    const pietra = P.aria('#e0d4ba', 0.03), ombra = luce(pietra, -0.22), scuro = P.aria('#40382f', 0.03), g = P.g;
    rett(P, s - W / 2, base, W, H * 0.66, pietra);
    for (const [dx, tipo] of [[-0.4, 0], [-0.2, 1], [0, 1], [0.2, 1], [0.4, 0]]) {   // tre archi al centro, due porte ai lati
      const x = s + W * dx, ww = W * (tipo ? 0.11 : 0.075), hh = H * (tipo ? 0.48 : 0.33);
      if (tipo) arco(P, x, base, ww, hh, scuro); else rett(P, x - ww / 2, base, ww, hh, scuro);
      if (tipo) rett(P, x - ww * 0.6, base + hh + H * 0.02, ww * 1.2, H * 0.03, ombra);
    }
    for (let i = -5; i <= 5; i++) { if (i === 0) continue; const x = s + i * W * 0.1 - W * 0.015; rett(P, x, base + H * 0.02, W * 0.03, H * 0.58, luce(pietra, 0.16)); rett(P, x + W * 0.022, base + H * 0.02, W * 0.008, H * 0.58, ombra); rett(P, x - W * 0.005, base + H * 0.58, W * 0.04, H * 0.025, pietra); }
    rett(P, s - W * 0.52, base + H * 0.62, W * 1.04, H * 0.07, pietra); rett(P, s - W * 0.52, base + H * 0.62, W * 1.04, H * 0.015, ombra);
    rett(P, s - W * 0.24, base + H * 0.69, W * 0.48, H * 0.2, pietra);   // attico con lo stemma, timpano, statue
    rett(P, s - W * 0.12, base + H * 0.72, W * 0.24, H * 0.13, luce(pietra, -0.08));
    ellisse(P, s, base + H * 0.785, W * 0.04, H * 0.05, P.aria('#b8963c', 0.03));
    poli(P, [[s - W * 0.26, base + H * 0.89], [s + W * 0.26, base + H * 0.89], [s, base + H * 1.0]], pietra);
    poli(P, [[s, base + H * 0.89], [s + W * 0.26, base + H * 0.89], [s, base + H * 1.0]], luce(pietra, -0.1));
    for (const dx of [-0.2, 0.2]) { rett(P, s + W * dx - W * 0.025, base + H * 0.89, W * 0.05, H * 0.07, ombra); ellisse(P, s + W * dx, base + H * 0.99, W * 0.022, H * 0.04, ombra); }
    for (const dx of [-0.45, 0.45]) ellisse(P, s + W * dx, base + H * 0.75, W * 0.03, H * 0.06, ombra);
    const gr = g.createLinearGradient(P.x(s - W / 2), 0, P.x(s + W / 2), 0); gr.addColorStop(0, 'rgba(255,246,230,0.10)'); gr.addColorStop(1, 'rgba(30,36,50,0.14)');
    g.fillStyle = gr; g.fillRect(P.x(s - W / 2), P.y(base + H * 0.69), P.m(W), P.m(H * 0.69));
  }
  // Torre di Belém: bastione sull'acqua con i merli a scudo, torre manuelina con la loggia e le garitte a cupoletta
  function belem(P, s, base, H) {
    const pietra = P.aria('#ece3cf', 0.02), ombra = luce(pietra, -0.22), scuro = P.aria('#57503f', 0.02), w = H * 0.3;
    rett(P, s - w * 1.5, base, w * 3, H * 0.27, pietra); rett(P, s + w * 1.1, base, w * 0.4, H * 0.27, ombra);
    for (let i = -7; i <= 7; i++) { const x = s + i * w * 0.2; rett(P, x - w * 0.06, base + H * 0.27, w * 0.12, H * 0.035, pietra); ellisse(P, x, base + H * 0.31, w * 0.06, w * 0.06, pietra); if (P.m(w) > 30) poli(P, [[x - w * 0.025, base + H * 0.3], [x + w * 0.025, base + H * 0.3], [x, base + H * 0.27]], '#9b4e3a'); }
    for (let i = -5; i <= 5; i += 2) rett(P, s + i * w * 0.24 - w * 0.03, base + H * 0.08, w * 0.06, H * 0.08, scuro);
    for (const dx of [-1.5, 1.5]) { rett(P, s + w * dx - w * 0.07, base + H * 0.22, w * 0.14, H * 0.1, pietra); ellisse(P, s + w * dx, base + H * 0.33, w * 0.08, w * 0.09, pietra); }
    rett(P, s - w / 2, base + H * 0.27, w, H * 0.62, pietra);
    rett(P, s + w * 0.3, base + H * 0.27, w * 0.2, H * 0.62, ombra);
    rett(P, s - w * 0.36, base + H * 0.47, w * 0.72, H * 0.11, scuro);   // la loggia rinascimentale
    for (let i = 0; i < 4; i++) arco(P, s - w * 0.27 + i * w * 0.18, base + H * 0.47, w * 0.13, H * 0.1, P.aria('#2f2a22', 0.02));
    rett(P, s - w * 0.42, base + H * 0.46, w * 0.84, H * 0.015, pietra);
    for (const y of [0.36, 0.64, 0.75]) { arco(P, s - w * 0.15, base + H * y, w * 0.12, H * 0.07, scuro); arco(P, s + w * 0.12, base + H * y, w * 0.12, H * 0.07, scuro); }
    ellisse(P, s, base + H * 0.83, w * 0.09, w * 0.09, P.aria('#8a8170', 0.02));
    rett(P, s - w * 0.58, base + H * 0.89, w * 1.16, H * 0.03, pietra);
    for (let i = -2; i <= 2; i++) { const x = s + i * w * 0.22; rett(P, x - w * 0.06, base + H * 0.92, w * 0.12, H * 0.03, pietra); ellisse(P, x, base + H * 0.955, w * 0.06, w * 0.06, pietra); }
    for (const dx of [-0.6, 0.6]) { rett(P, s + w * dx - w * 0.08, base + H * 0.86, w * 0.16, H * 0.09, pietra); ellisse(P, s + w * dx, base + H * 0.96, w * 0.09, w * 0.1, pietra); poli(P, [[s + w * dx - w * 0.02, base + H * 1.04], [s + w * dx + w * 0.02, base + H * 1.04], [s + w * dx, base + H * 1.08]], pietra); }
  }
  function ponteSospeso(P, s0, s1, base, hp, col, d) {
    const c = P.aria(col, d), g = P.g, L = s1 - s0;
    rett(P, s0, base + hp * 0.28, L, Math.max(1.5, hp * 0.035), c);
    rett(P, s0, base + hp * 0.25, L, Math.max(0.8, hp * 0.02), luce(c, -0.3));
    for (const t of [0.24, 0.76]) { const x = s0 + L * t; rett(P, x - hp * 0.035, base - 20, hp * 0.07, hp + 20, c); rett(P, x - hp * 0.04, base + hp * 0.62, hp * 0.08, hp * 0.03, c); rett(P, x - hp * 0.04, base + hp * 0.95, hp * 0.08, hp * 0.03, c); }
    g.strokeStyle = c; g.lineWidth = Math.max(1, P.m(hp * 0.012));
    g.beginPath(); g.moveTo(P.x(s0), P.y(base + hp * 0.3)); g.quadraticCurveTo(P.x(s0 + L * 0.13), P.y(base + hp * 0.5), P.x(s0 + L * 0.24), P.y(base + hp));
    g.quadraticCurveTo(P.x(s0 + L * 0.5), P.y(base + hp * 0.05), P.x(s0 + L * 0.76), P.y(base + hp)); g.quadraticCurveTo(P.x(s0 + L * 0.87), P.y(base + hp * 0.5), P.x(s1), P.y(base + hp * 0.3)); g.stroke();
    g.lineWidth = Math.max(0.5, P.m(hp * 0.004)); g.globalAlpha = 0.55;
    for (let x = s0 + L * 0.25; x < s0 + L * 0.75; x += L * 0.012) { const u = (x - s0 - L * 0.24) / (L * 0.52), y = hp * (1 - 4 * u * (1 - u) * 0.95); g.beginPath(); g.moveTo(P.x(x), P.y(base + hp * 0.31)); g.lineTo(P.x(x), P.y(base + Math.max(hp * 0.31, y))); g.stroke(); }
    g.globalAlpha = 1;
  }
  // Cattedrale di Zagabria: due campanili neogotici a guglia traforata, facciata con il rosone
  function cattedraleZagabria(P, s, base, H) {
    const L = strato(P, Q => {
      const pietra = Q.aria('#e7dfcd', 0.03), ombra = luce(pietra, -0.24), scuro = Q.aria('#4f4b45', 0.03), w = H * 0.42;
      rett(Q, s - w / 2, base, w, H * 0.4, pietra);
      poli(Q, [[s - w * 0.3, base + H * 0.4], [s + w * 0.3, base + H * 0.4], [s, base + H * 0.52]], pietra);
      arco(Q, s, base, w * 0.16, H * 0.17, scuro);
      ellisse(Q, s, base + H * 0.28, w * 0.09, w * 0.09, scuro); ellisse(Q, s, base + H * 0.28, w * 0.06, w * 0.06, Q.aria('#8a6f8a', 0.03));
      for (const dx of [-0.34, 0.34]) {
        const x = s + w * dx, tw = w * 0.24;
        rett(Q, x - tw / 2, base, tw, H * 0.64, pietra); rett(Q, x + tw * 0.22, base, tw * 0.28, H * 0.64, ombra);
        for (let y = 0.1; y < 0.6; y += 0.09) { arco(Q, x - tw * 0.16, base + H * y, tw * 0.17, H * 0.065, scuro); arco(Q, x + tw * 0.12, base + H * y, tw * 0.17, H * 0.065, scuro); }
        rett(Q, x - tw * 0.6, base + H * 0.63, tw * 1.2, H * 0.02, pietra);
        for (const k of [-0.5, 0.5]) poli(Q, [[x + tw * k - tw * 0.07, base + H * 0.65], [x + tw * k + tw * 0.07, base + H * 0.65], [x + tw * k, base + H * 0.73]], pietra);
        poli(Q, [[x - tw * 0.48, base + H * 0.65], [x + tw * 0.48, base + H * 0.65], [x, base + H]], pietra);   // la guglia traforata
        poli(Q, [[x, base + H * 0.65], [x + tw * 0.48, base + H * 0.65], [x, base + H]], ombra);
        for (let y = 0.69; y < 0.95; y += 0.045) { const half = tw * 0.48 * (1 - (y - 0.65) / 0.35); rett(Q, x - half * 0.5, base + H * y, half, H * 0.018, scuro); }
        rett(Q, x - tw * 0.02, base + H, tw * 0.04, H * 0.025, '#c9a646');
      }
      const g = Q.g, gr = g.createLinearGradient(Q.x(s - w / 2), 0, Q.x(s + w / 2), 0); gr.addColorStop(0, 'rgba(255,246,230,0.08)'); gr.addColorStop(1, 'rgba(30,36,50,0.12)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(Q.x(s - w / 2), Q.y(base + H * 1.05), Q.m(w), Q.m(H * 1.05)); g.globalCompositeOperation = 'source-over';
    });
    P.g.drawImage(L, 0, 0);
    butta(L);
  }
  // San Marco a Zagabria: il tetto a scacchi con i due stemmi
  function sanMarco(P, s, base, w, d) {
    const muro = P.aria('#f0eadc', d), g = P.g;
    rett(P, s, base, w, w * 0.42, muro);
    const h = w * 0.5, x0 = P.x(s - w * 0.03), x1 = P.x(s + w * 1.03), y0 = P.y(base + w * 0.42), y1 = P.y(base + w * 0.42 + h);
    g.save(); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo((x0 + x1) / 2, y1); g.closePath(); g.clip();
    const q = Math.max(1.5, P.m(w * 0.045));
    const rosso = P.aria('#c8352f', d), bianco = P.aria('#f2efe8', d), blu = P.aria('#2f5a9a', d);
    for (let yy = y1; yy < y0; yy += q) for (let xx = x0; xx < x1; xx += q) { g.fillStyle = (Math.floor((xx - x0) / q) + Math.floor((yy - y1) / q)) % 2 ? rosso : bianco; g.fillRect(xx, yy, q + 0.5, q + 0.5); }
    g.fillStyle = blu; g.fillRect(x0 + (x1 - x0) * 0.25, y0 - (y0 - y1) * 0.45, (x1 - x0) * 0.12, (y0 - y1) * 0.3); g.fillRect(x0 + (x1 - x0) * 0.63, y0 - (y0 - y1) * 0.45, (x1 - x0) * 0.12, (y0 - y1) * 0.3);
    g.restore();
    rett(P, s + w * 0.82, base, w * 0.17, w * 1.1, muro); poli(P, [[s + w * 0.8, base + w * 1.1], [s + w * 1.01, base + w * 1.1], [s + w * 0.905, base + w * 1.45]], P.aria('#5d7f60', d));
  }
  // Porta di Brandeburgo: sei colonne doriche scanalate, trabeazione con i triglifi, attico e la quadriga in rame
  function brandeburgo(P, s, base, W, H) {
    const pietra = P.aria('#e6dbc2', 0.03), ombra = luce(pietra, -0.3), scuro = P.aria('#3d3a35', 0.03), cw = W * 0.07;
    rett(P, s - W / 2, base, W, H * 0.62, scuro);   // i cinque passaggi, in ombra
    for (let i = 0; i < 6; i++) {
      const xx = s - W / 2 + i * (W - cw) / 5;
      rett(P, xx, base, cw, H * 0.62, pietra);
      for (let f = 0; f < 4; f++) rett(P, xx + cw * (0.1 + f * 0.24), base + H * 0.04, cw * 0.06, H * 0.54, luce(pietra, -0.14));
      rett(P, xx - cw * 0.08, base + H * 0.58, cw * 1.16, H * 0.04, pietra);
      rett(P, xx + cw * 0.7, base, cw * 0.3, H * 0.62, ombra);
    }
    rett(P, s - W * 0.52, base + H * 0.62, W * 1.04, H * 0.15, pietra);
    rett(P, s - W * 0.52, base + H * 0.62, W * 1.04, H * 0.025, ombra);
    for (let i = 0; i < 26; i++) rett(P, s - W * 0.5 + i * W * 0.04, base + H * 0.66, W * 0.012, H * 0.06, luce(pietra, -0.12));
    rett(P, s - W * 0.24, base + H * 0.77, W * 0.48, H * 0.1, pietra);
    rett(P, s - W * 0.2, base + H * 0.79, W * 0.4, H * 0.06, luce(pietra, -0.12));
    const v = P.aria('#4f7d68', 0.03), vs = luce(v, -0.25);   // la quadriga, verde rame
    for (let i = 0; i < 4; i++) { const x = s - W * 0.12 + i * W * 0.075; ellisse(P, x, base + H * 0.93, W * 0.032, H * 0.035, i % 2 ? vs : v); poli(P, [[x + W * 0.02, base + H * 0.94], [x + W * 0.035, base + H * 1.02], [x + W * 0.045, base + H * 0.99], [x + W * 0.03, base + H * 0.92]], v); rett(P, x - W * 0.02, base + H * 0.87, W * 0.006, H * 0.05, vs); rett(P, x + W * 0.015, base + H * 0.87, W * 0.006, H * 0.05, vs); }
    rett(P, s - W * 0.018, base + H * 0.87, W * 0.036, H * 0.14, v);
    ellisse(P, s, base + H * 1.03, W * 0.02, H * 0.03, v); rett(P, s + W * 0.012, base + H * 0.95, W * 0.004, H * 0.14, vs);
  }
  function fernsehturm(P, s, base, H, d) {
    const c = P.aria('#d0d3d8', d), g = P.g;
    poli(P, [[s - H * 0.04, base], [s + H * 0.04, base], [s + H * 0.02, base + H * 0.6], [s - H * 0.02, base + H * 0.6]], c);
    poli(P, [[s + H * 0.005, base], [s + H * 0.04, base], [s + H * 0.02, base + H * 0.6], [s + H * 0.005, base + H * 0.6]], luce(c, -0.2));
    const cy = base + H * 0.655, r = H * 0.062;
    const gr = g.createRadialGradient(P.x(s - r * 0.4), P.y(cy + r * 0.4), 1, P.x(s), P.y(cy), P.m(r));
    gr.addColorStop(0, P.aria('#f6f7fa', d)); gr.addColorStop(1, P.aria('#7e8896', d)); g.fillStyle = gr;
    g.beginPath(); g.arc(P.x(s), P.y(cy), P.m(r), 0, Math.PI * 2); g.fill();
    rett(P, s - r, cy - r * 0.08, r * 2, r * 0.16, 'rgba(58,66,80,0.5)');
    rett(P, s - H * 0.011, base + H * 0.715, H * 0.022, H * 0.12, c);
    for (let i = 0; i < 6; i++) rett(P, s - H * (0.006 - i * 0.0004), base + H * (0.835 + i * 0.027), H * (0.012 - i * 0.0008), H * 0.027, i % 2 ? P.aria('#d33a2e', d) : P.aria('#f4f4f4', d));
  }
  // Grossmünster: le due torri con le cupolette a lanterna, sulla Limmat
  function grossmunster(P, s, base, H) {
    const pietra = P.aria('#e9dfcd', 0.03), ombra = luce(pietra, -0.22), scuro = P.aria('#45423d', 0.03), w = H * 0.56, g = P.g;
    rett(P, s - w / 2, base, w, H * 0.36, pietra);
    poli(P, [[s - w * 0.52, base + H * 0.36], [s + w * 0.52, base + H * 0.36], [s + w * 0.3, base + H * 0.47], [s - w * 0.3, base + H * 0.47]], P.aria('#8a4f3e', 0.03));
    arco(P, s, base, w * 0.14, H * 0.16, scuro);
    for (let i = 0; i < 3; i++) arco(P, s - w * 0.1 + i * w * 0.1, base + H * 0.22, w * 0.05, H * 0.08, scuro);
    for (const dx of [-0.29, 0.29]) {
      const x = s + w * dx, tw = w * 0.22;
      rett(P, x - tw / 2, base, tw, H * 0.74, pietra); rett(P, x + tw * 0.24, base, tw * 0.26, H * 0.74, ombra);
      for (const y of [0.42, 0.53, 0.64]) { arco(P, x - tw * 0.17, base + H * y, tw * 0.17, H * 0.07, scuro); arco(P, x + tw * 0.17, base + H * y, tw * 0.17, H * 0.07, scuro); }
      ellisse(P, x, base + H * 0.3, tw * 0.17, tw * 0.17, P.aria('#2b3440', 0.03)); ellisse(P, x, base + H * 0.3, tw * 0.13, tw * 0.13, '#d8b24a');
      rett(P, x - tw * 0.6, base + H * 0.74, tw * 1.2, H * 0.025, pietra);
      rett(P, x - tw * 0.4, base + H * 0.765, tw * 0.8, H * 0.05, pietra);   // la base ottagonale e la cupoletta scura
      const cy = base + H * 0.815;
      g.fillStyle = P.aria('#3a3a3c', 0.03); g.beginPath(); g.moveTo(P.x(x - tw * 0.45), P.y(cy));
      g.bezierCurveTo(P.x(x - tw * 0.6), P.y(cy + H * 0.09), P.x(x - tw * 0.1), P.y(cy + H * 0.12), P.x(x), P.y(cy + H * 0.2));
      g.bezierCurveTo(P.x(x + tw * 0.1), P.y(cy + H * 0.12), P.x(x + tw * 0.6), P.y(cy + H * 0.09), P.x(x + tw * 0.45), P.y(cy)); g.fill();
      rett(P, x - tw * 0.03, cy + H * 0.2, tw * 0.06, H * 0.04, '#c9a646');
    }
  }
  // Statua della Libertà: isola con il forte, piedistallo, la statua verde rame con la fiaccola dorata (sole a sinistra)
  function liberty(P, s, base, H) {
    const pietra = P.aria('#cfc5ad', 0.03), pietraS = luce(pietra, -0.22), rame = P.aria('#84bfa9', 0.03), rameS = luce(rame, -0.3), rameL = luce(rame, 0.18), g = P.g;
    poli(P, [[s - H * 1.2, base], [s + H * 1.25, base], [s + H * 1.0, base + H * 0.04], [s - H * 0.95, base + H * 0.045]], P.aria('#6f7f5c', 0.05));
    alberi(P, s - H * 1.0, s - H * 0.45, base + H * 0.04, 'chioma', H * 0.05, ['#56703f', '#4b6638'], 0.7, 0.04);
    alberi(P, s + H * 0.45, s + H * 1.0, base + H * 0.04, 'chioma', H * 0.05, ['#56703f', '#4b6638'], 0.7, 0.04);
    poli(P, [[s - H * 0.42, base + H * 0.04], [s + H * 0.42, base + H * 0.04], [s + H * 0.34, base + H * 0.11], [s - H * 0.34, base + H * 0.11]], P.aria('#b9ae96', 0.03));
    poli(P, [[s - H * 0.12, base + H * 0.11], [s + H * 0.12, base + H * 0.11], [s + H * 0.095, base + H * 0.42], [s - H * 0.095, base + H * 0.42]], pietra);
    poli(P, [[s + H * 0.03, base + H * 0.11], [s + H * 0.12, base + H * 0.11], [s + H * 0.095, base + H * 0.42], [s + H * 0.03, base + H * 0.42]], pietraS);
    for (const y of [0.2, 0.3]) rett(P, s - H * 0.08, base + H * y, H * 0.16, H * 0.012, pietraS);
    rett(P, s - H * 0.105, base + H * 0.405, H * 0.21, H * 0.02, pietra);
    poli(P, [[s - H * 0.065, base + H * 0.425], [s + H * 0.065, base + H * 0.425], [s + H * 0.04, base + H * 0.66], [s + H * 0.032, base + H * 0.78], [s - H * 0.035, base + H * 0.78], [s - H * 0.05, base + H * 0.6]], rame);
    poli(P, [[s + H * 0.005, base + H * 0.425], [s + H * 0.065, base + H * 0.425], [s + H * 0.04, base + H * 0.66], [s + H * 0.032, base + H * 0.78], [s + H * 0.01, base + H * 0.78]], rameS);
    g.strokeStyle = rgba(luce(rame, -0.35), 0.6); g.lineWidth = Math.max(1, P.m(H * 0.004));
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(P.x(s - H * 0.04 + i * H * 0.022), P.y(base + H * 0.43)); g.lineTo(P.x(s - H * 0.03 + i * H * 0.018), P.y(base + H * 0.62)); g.stroke(); }
    poli(P, [[s - H * 0.07, base + H * 0.62], [s - H * 0.025, base + H * 0.62], [s - H * 0.035, base + H * 0.71], [s - H * 0.075, base + H * 0.7]], rameL);   // la tavola
    ellisse(P, s - H * 0.003, base + H * 0.81, H * 0.024, H * 0.03, rame);
    for (let i = -3; i <= 3; i++) poli(P, [[s - H * 0.003 + i * H * 0.007 - H * 0.004, base + H * 0.832], [s - H * 0.003 + i * H * 0.007 + H * 0.004, base + H * 0.832], [s - H * 0.003 + i * H * 0.016, base + H * 0.872]], rame);
    poli(P, [[s + H * 0.02, base + H * 0.7], [s + H * 0.045, base + H * 0.71], [s + H * 0.068, base + H * 0.94], [s + H * 0.048, base + H * 0.945]], rame);   // il braccio
    poli(P, [[s + H * 0.048, base + H * 0.94], [s + H * 0.072, base + H * 0.94], [s + H * 0.068, base + H * 0.965], [s + H * 0.052, base + H * 0.965]], rameS);
    ellisse(P, s + H * 0.06, base + H * 0.985, H * 0.013, H * 0.022, '#f3c443');
  }
  function empireState(P, s, base, H, d) {
    const c = P.aria('#bdb7aa', d), o = luce(c, -0.25);
    for (const [w, h0, h1] of [[0.26, 0, 0.2], [0.21, 0.2, 0.64], [0.15, 0.64, 0.79], [0.1, 0.79, 0.85], [0.055, 0.85, 0.9]]) {
      rett(P, s - H * w / 2, base + H * h0, H * w, H * (h1 - h0), c); rett(P, s + H * w * 0.22, base + H * h0, H * w * 0.28, H * (h1 - h0), o);
      if (P.m(H) > 120) for (let x = -w / 2 + 0.02; x < w / 2 - 0.02; x += 0.03) rett(P, s + H * x, base + H * h0, H * 0.004, H * (h1 - h0), 'rgba(58,58,58,0.15)');
    }
    poli(P, [[s - H * 0.022, base + H * 0.9], [s + H * 0.022, base + H * 0.9], [s, base + H]], c);
  }
  function chrysler(P, s, base, H, d) {
    const c = P.aria('#c9c6bf', d), acc = P.aria('#e3e7ec', d), g = P.g;
    rett(P, s - H * 0.085, base, H * 0.17, H * 0.72, c); rett(P, s + H * 0.03, base, H * 0.055, H * 0.72, luce(c, -0.25));
    for (let i = 0; i < 6; i++) { const r = H * (0.072 - i * 0.011), y = base + H * (0.72 + i * 0.04); g.beginPath(); g.ellipse(P.x(s), P.y(y), P.m(r), P.m(H * 0.045), 0, Math.PI, 0); g.fillStyle = i % 2 ? acc : luce(acc, -0.1); g.fill(); }
    poli(P, [[s - H * 0.012, base + H * 0.95], [s + H * 0.012, base + H * 0.95], [s, base + H * 1.06]], acc);
  }
  function oneWtc(P, s, base, H, d) {
    const c = P.aria('#a8c3d8', d), w = H * 0.12;
    poli(P, [[s - w / 2, base], [s + w / 2, base], [s + w * 0.3, base + H * 0.85], [s - w * 0.3, base + H * 0.85]], c);
    poli(P, [[s, base], [s + w / 2, base], [s + w * 0.3, base + H * 0.85], [s, base + H * 0.85]], luce(c, -0.2));
    poli(P, [[s - w / 2, base], [s - w * 0.1, base], [s - w * 0.3, base + H * 0.85]], luce(c, 0.15));
    rett(P, s - w * 0.03, base + H * 0.85, w * 0.06, H * 0.15, P.aria('#d0d6dc', d));
  }
  // il Vesuvio visto da Napoli: il monte Somma a sinistra (cresta frastagliata) e il cono tronco a destra, più alto; le
  // pendici basse verdi di vigne e paesi; luce da sinistra
  function vesuvio(P, s, base, H) {
    const g = P.g, col = P.aria('#7a7088', 0.3), som = P.aria('#837b8e', 0.38), verde = P.aria('#7d8e68', 0.42);
    const somma = [[s - H * 2.5, base], [s - H * 1.9, base + H * 0.3], [s - H * 1.55, base + H * 0.5], [s - H * 1.35, base + H * 0.6], [s - H * 1.22, base + H * 0.57], [s - H * 1.05, base + H * 0.68], [s - H * 0.92, base + H * 0.64], [s - H * 0.78, base + H * 0.71], [s - H * 0.6, base + H * 0.62], [s - H * 0.42, base + H * 0.5], [s - H * 0.25, base + H * 0.42], [s, base]];
    const cono = [[s - H * 1.5, base], [s - H * 0.36, base + H * 0.95], [s - H * 0.12, base + H], [s + H * 0.12, base + H * 0.985], [s + H * 0.34, base + H * 0.94], [s + H * 0.8, base + H * 0.55], [s + H * 2.1, base]];
    const riempi = (pts, c) => {
      g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(P.x(a), P.y(b)) : g.moveTo(P.x(a), P.y(b)))); g.closePath();
      const gr = g.createLinearGradient(0, P.y(base + H), 0, P.y(base)); gr.addColorStop(0, c); gr.addColorStop(0.55, mix(c, verde, 0.35)); gr.addColorStop(1, mix(verde, P.orizzonte, 0.35));
      g.fillStyle = gr; g.fill();
    };
    riempi(somma, som);
    riempi(cono, col);
    g.save();
    g.beginPath(); cono.forEach(([a, b], i) => (i ? g.lineTo(P.x(a), P.y(b)) : g.moveTo(P.x(a), P.y(b)))); g.closePath(); g.clip();
    poli(P, [[s + H * 0.05, base + H], [s + H * 0.34, base + H * 0.94], [s + H * 0.8, base + H * 0.55], [s + H * 2.1, base], [s + H * 0.35, base]], 'rgba(29,36,51,0.15)');
    g.lineWidth = Math.max(1, P.m(0.7));
    for (let i = 0; i < 26; i++) {   // canaloni corti sotto la cima
      const x0 = s + P.rr(-0.33, 0.32) * H, l = P.rr(0.12, 0.3) * H, dx = (x0 - s) * 0.5;
      g.strokeStyle = P.rnd() < 0.6 ? 'rgba(40,34,48,0.13)' : 'rgba(255,246,230,0.10)';
      g.beginPath(); g.moveTo(P.x(x0), P.y(base + H * 0.95 - Math.abs(x0 - s) * 0.15)); g.lineTo(P.x(x0 + dx), P.y(base + H * 0.95 - l)); g.stroke();
    }
    g.restore();
    poli(P, [[s - H * 0.3, base + H * 0.955], [s - H * 0.12, base + H * 0.99], [s + H * 0.1, base + H * 0.975], [s + H * 0.3, base + H * 0.945]], luce(col, -0.12));
  }
  function casteldellovo(P, s, base, w, d) {
    const tufo = P.aria('#cdb48c', d), ombra = luce(tufo, -0.25);
    poli(P, [[s - w * 0.7, base - w * 0.02], [s + w * 0.75, base - w * 0.02], [s + w * 0.65, base + w * 0.1], [s - w * 0.62, base + w * 0.1]], P.aria('#8a7a64', d));
    rett(P, s - w * 0.55, base + w * 0.1, w * 1.1, w * 0.17, tufo); rett(P, s + w * 0.35, base + w * 0.1, w * 0.2, w * 0.17, ombra);
    rett(P, s - w * 0.25, base + w * 0.27, w * 0.55, w * 0.11, tufo); rett(P, s + w * 0.18, base + w * 0.27, w * 0.12, w * 0.11, ombra);
    for (let x = s - w * 0.55; x < s + w * 0.55; x += w * 0.05) rett(P, x, base + w * 0.27, w * 0.025, w * 0.025, tufo);
    for (let x = s - w * 0.5; x < s + w * 0.5; x += w * 0.09) rett(P, x, base + w * 0.17, w * 0.02, w * 0.04, P.aria('#4e4438', d));
  }

  // =====================================================================
  // ---------- stili dei palazzi ----------
  const STILI = {
    napoli: { muri: ['#e9c27c', '#e3a27c', '#f2dcae', '#d98f6b', '#f5efe4', '#c97c5d', '#e6d3a8', '#d7b48a'], tetti: ['#b5603f', '#a8553a'], tetto: 'coppi', persiane: ['#5d7a5a', '#6b5844'], piano: 3.4, finW: 1.1, finH: 2, finDx: 3, alt: [10, 22], larg: [9, 18], altane: true },
    roma: { muri: ['#e2b878', '#d49660', '#c97a4f', '#ecd3a4', '#d8a878', '#b9674a', '#efe0bf', '#e6c08e'], tetti: ['#b5603f', '#a8553a', '#c06d48'], tetto: 'coppi', persiane: ['#4f6b4a', '#6b5844', '#7a7a6a'], piano: 3.5, finW: 1.1, finH: 2, finDx: 3.1, alt: [12, 22], larg: [12, 24], altane: true, cornici: true },
    milano: { muri: ['#ddd2bc', '#d2c0a2', '#c8b89e', '#e2d8c4', '#e7c9a1', '#cdbfa8'], tetti: ['#8d8a86', '#a76b4e'], tetto: 'coppi', persiane: ['#5a5f52', '#6a5a48'], piano: 3.4, finW: 1.2, finH: 2, finDx: 3.1, alt: [16, 26], larg: [14, 24], cornici: true },
    parigi: { muri: ['#e9dfc8', '#ddd1b8', '#ece3cf', '#d6c8ad', '#e4d8bf'], tetti: ['#7d8996', '#6f7b88', '#86919c'], tetto: 'mansarda', balconi: '#2a2c30', piano: 3.2, finW: 1.15, finH: 2.1, finDx: 2.6, alt: [16, 21], larg: [14, 26], cornici: true, colRifl: '#9aaab8' },
    londra: { muri: ['#9a6a4e', '#8a5a40', '#b08060', '#a89a88', '#c9b89a', '#e4dccb'], tetti: ['#55585c', '#6a5048', '#4e5358'], tetto: 'falda', piano: 3.2, finW: 1.2, finH: 2, finDx: 3, alt: [12, 22], larg: [10, 20], colFin: '#2e3640' },
    francoforte: { muri: ['#e8e0d0', '#d9c6ae', '#c99f86', '#e5d6bd', '#d4cbc0'], tetti: ['#6d6a6a', '#9a5a46', '#5f6066'], tetto: 'falda', piano: 3.2, finW: 1.3, finH: 1.8, finDx: 3, alt: [14, 24], larg: [12, 22] },
    fachwerk: { muri: ['#f4efe4', '#efe3cc', '#f2e6d8', '#e8d8c4', '#f6eee2'], tetti: ['#6e4a3a', '#8a5242', '#5e5a58'], tetto: 'falda', graticcio: true, piano: 3, finW: 1, finH: 1.5, finDx: 2.4, alt: [13, 20], larg: [7, 12] },
    madrid: { muri: ['#e7d2b0', '#dcc09a', '#f0e2c8', '#c9a27c', '#e2c6a2', '#d8b48c'], tetti: ['#b5603f', '#96604a', '#8a8580'], tetto: 'coppi', balconi: '#2e2a26', persiane: ['#6a5640'], piano: 3.5, finW: 1.2, finH: 2.2, finDx: 3, alt: [16, 28], larg: [14, 26], cornici: true },
    lisbona: { muri: ['#f3efe6', '#f2d7a8', '#e8b48a', '#f6f1e6', '#e9cfa0', '#c9dbe0', '#f0c9b8', '#e6dc9a'], tetti: ['#c8653f', '#b85a3a', '#d0734a'], tetto: 'coppi', piano: 3.2, finW: 1, finH: 1.8, finDx: 2.6, alt: [8, 18], larg: [7, 14] },
    zagabria: { muri: ['#efe6d2', '#e8d6a6', '#f2e8c8', '#d9c09a', '#e6d0b8', '#d8dcc8'], tetti: ['#b4482f', '#c45a38', '#9e4a34'], tetto: 'falda', piano: 3.3, finW: 1.1, finH: 1.8, finDx: 3, alt: [10, 20], larg: [10, 18] },
    berlino: { muri: ['#d6d0c4', '#c9bfae', '#e0d8c8', '#b9b1a2', '#d8c4a8', '#c4c8cc'], tetti: ['#6a6d72', '#8a5a46'], tetto: 'piatto', piano: 3.4, finW: 1.3, finH: 2, finDx: 3, alt: [18, 24], larg: [16, 30], cornici: true },
    zurigo: { muri: ['#efe9dc', '#e2d6bf', '#f2eadb', '#d9cbb0', '#e8dccf', '#d8e0d8'], tetti: ['#8f4f3e', '#6d6a68', '#a05a42'], tetto: 'falda', persiane: ['#4f6b4a', '#7a3a2e'], piano: 3.2, finW: 1.1, finH: 1.8, finDx: 2.8, alt: [12, 20], larg: [9, 16] },
    newyork: { muri: ['#9c6e58', '#b98b6c', '#c9b8a0', '#8a8a8a', '#d2c8b6', '#a87c62'], tetti: ['#4a4a4a'], tetto: 'piatto', cisterne: true, piano: 3.4, finW: 1.2, finH: 1.9, finDx: 2.6, alt: [18, 45], larg: [14, 28] }
  };

  // =====================================================================
  // ---------- le vedute delle città ----------
  // terra: colore del mare o del fiume davanti (disco sotto la cartolina); se manca, il suolo lontano prende il colore
  // della nebbia del gioco, così la fine della pista si fonde con la cartolina.
  const RICETTE = {
    // La Neve (R-513): una valle alpina. Lontano le cime con i ghiacciai, in mezzo i versanti con i boschi di abeti,
    // davanti il fondovalle bianco con le baite e il lago gelato. Prima (fino alla 0.25.5) c'erano solo coni 3D.
    neve: { nebbia: '#d6e7f3', seme: 5, dipingi(P) {
      crinale(P, { da: -1100, a: 1100, base: 14, alt: 108, punte: true, colore: P.aria('#7f95b4', 0.46), neve: 50, colNeve: '#f3f7fc', passo: 4, fase: 11, veloNeve: 0.28 });   // le cime con i ghiacciai
      crinale(P, { da: -1100, a: 1100, base: -2, alt: 92, punte: true, colore: P.aria('#8aa0bc', 0.34), neve: 40, colNeve: '#eef4fa', passo: 5, fase: 4, veloNeve: 0.22 });   // la catena più vicina
      crinale(P, { da: -1100, a: 1100, base: -30, alt: 86, colore: P.aria('#5a7a5c', 0.22), passo: 6, fase: 2, bosco: true, rilievo: 0.8, neve: 30, colNeve: '#e9f1f7', veloNeve: 0.15 });   // i versanti con il bosco
      for (const [h, sz, d] of [[-52, 14, 0.14], [-74, 20, 0.09], [-98, 28, 0.05]]) alberi(P, -1100, 1100, h, 'abete', sz, ['#3b5a3f', '#44663f', '#35523a'], 0.55, d);   // gli abeti, più grandi venendo avanti
      sfuma(P, -100, -150, '#f4f8fc', '#eef3f8', 0.95, 1);   // il fondovalle bianco
      for (let i = 0; i < 9; i++) { const s = P.rr(-900, 900), h = P.rr(-112, -126), sc = scala(h); if (Math.abs(s) < 120) continue; rett(P, s, h, 7 * sc, 4 * sc, P.aria('#6b4a34', 0.06)); poli(P, [[s - 1 * sc, h + 4 * sc], [s + 8 * sc, h + 4 * sc], [s + 3.5 * sc, h + 7 * sc]], P.aria('#f2f5f8', 0.06)); }   // le baite
      acqua(P, -128, -142, '#c8dcea', '#b4cde0', 200, 900);   // il lago gelato
      alberi(P, -1100, -150, -132, 'abete', 34, ['#2f4a34', '#3b5a3f'], 0.7, 0.02);
      alberi(P, 150, 1100, -132, 'abete', 34, ['#2f4a34', '#3b5a3f'], 0.7, 0.02);
    } },
    // Napoli dal lungomare: il golfo, il Vesuvio in fondo, la città sulla collina a sinistra, Castel dell'Ovo, Capri
    napoli: { nebbia: '#e1e8ec', terra: '#2f78b4', seme: 81, dipingi(P) {
      const st = STILI.napoli;
      crinale(P, { da: 300, a: 1100, base: -6, alt: 40, colore: P.aria('#8e9fb4', 0.5), passo: 8, fase: 2, forma: (s, u) => 0.3 + u * 0.9 });   // penisola sorrentina
      crinale(P, { da: 760, a: 1000, base: -6, alt: 34, colore: P.aria('#9babbf', 0.58), passo: 6, fase: 5, forma: (s, u) => Math.sin(u * Math.PI) });   // Capri
      vesuvio(P, 70, -7, 96);
      quartieri(P, { stile: st, da: -200, a: 300, h0: -6, h1: -8, foschia: 1.1 });   // Portici e Torre del Greco sotto il vulcano
      acqua(P, -8, -150, '#4a8cc6', '#1f63a3');
      rifletti(P, -8, 110, 0.22, -1100, 1100, 3);
      // a sinistra la collina di Posillipo e del Vomero con le case, Castel Sant'Elmo in cima; sotto, il lungomare
      const coll = crinale(P, { da: -1100, a: -230, base: -46, alt: 120, colore: P.aria('#76905f', 0.2), passo: 6, fase: 1, velo: 0.2, bosco: true, forma: s => Math.pow(cl((-230 - s) / 520, 0, 1), 0.8) });
      rett(P, -760, coll.alt(-725) - 4, 70, 14, P.aria('#cdb48c', 0.2)); rett(P, -772, coll.alt(-725) - 6, 94, 4, P.aria('#bba27a', 0.2));
      quartieri(P, { stile: st, da: -1100, a: -250, h0: 64, h1: -44, scala: () => 0.3, fitte: 1.4, sotto: s => coll.alt(s) - 6, alberi: { tipo: 'pino', col: ['#4a6638', '#3f5a35'], p: 0.06, alt: 18 } });
      quartieri(P, { stile: st, da: -1100, a: -250, h0: -48, h1: -92, libero: (s, h) => s > -250 + (h + 48) * 4 });
      casteldellovo(P, -170, -60, 74, 0.1);
      onde(P, -10, -150, '#174f86', -1100, 1100, 0.8);
      for (let i = 0; i < 12; i++) { const h = P.rr(-110, -24); barca(P, P.rr(-120, 760), h, P.rr(5, 9) * scala(h), P.rnd() < 0.6); }
      alberi(P, -1100, -270, -96, 'palma', 22, ['#4c6b3c', '#56743f'], 0.22, 0.04);   // le palme di via Caracciolo
    } },
    // Roma da via dei Fori Imperiali: il Colosseo, i pini, i tetti e le cupole, San Pietro lontano, i colli Albani
    roma: { nebbia: '#e8e0d2', seme: 17, dipingi(P) {
      const st = STILI.roma;
      crinale(P, { da: -1100, a: 1100, base: -4, alt: 42, colore: P.aria('#9eaa9a', 0.5), passo: 10, fase: 3 });   // colli Albani
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -60, alberi: { tipo: 'pino', col: ['#4a6a40', '#3f5d37'], p: 0.08, alt: 20 } });
      cupola(P, -520, -18, 32, '#e6d8bb', '#94a8b4', 0.32);   // San Pietro
      for (const [x, h, r] of [[-300, -40, 13], [300, -36, 12], [600, -44, 14], [-820, -40, 12], [140, -30, 9]]) cupola(P, x, h, r, '#e6d8bb', '#a6b2b6', 0.22);
      rett(P, 420, -50, 90, 22, P.aria('#f1ece0', 0.18)); for (let i = 0; i < 16; i++) rett(P, 422 + i * 5.5, -48, 2, 16, P.aria('#d4cdbd', 0.18));   // il Vittoriano
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -62, h1: -96, alberi: { tipo: 'pino', col: ['#4a6a40', '#3f5d37'], p: 0.12, alt: 20 } });
      colosseo(P, 0, -96, 440, 128);
      viale(P, { h0: -100, h1: -150, mezza: 230, suolo: '#c2b49a', alberi: { tipo: 'pino', col: ['#3f5d37', '#4a6a40'], alt: 24 }, file: [1.05] });
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -100, h1: -150, libero: (s, h, sc) => Math.abs(s) < 300 * sc + 40 });
      gente(P, -100, -140, 220, 60);
      for (const [x, h] of [[-190, -122], [-160, -126], [200, -128], [240, -122]]) { const sc = scala(h); for (let i = 0; i < 4; i++) rett(P, x + i * 4 * sc, h, 1.4 * sc, P.rr(6, 12) * sc, P.aria('#e6dcc4', 0.05)); }   // colonne dei Fori
    } },
    // Milano: piazza del Duomo, i grattacieli di Porta Nuova e CityLife, le Alpi nei giorni limpidi
    milano: { nebbia: '#dcdfe0', seme: 31, dipingi(P) {
      const st = STILI.milano;
      crinale(P, { da: -1100, a: 1100, base: 4, alt: 78, punte: true, colore: P.aria('#8394ae', 0.42), neve: 44, colNeve: '#f2f5fa', passo: 4, fase: 7, veloNeve: 0.3 });   // le Alpi
      for (const [x, h, w, top] of [[-560, 200, 30, 'antenna'], [-505, 140, 24, null], [-470, 120, 26, 'tetto'], [-620, 112, 22, null], [-680, 92, 26, null], [520, 150, 24, 'punta'], [570, 128, 30, null]]) grattacielo(P, x, -20, w, h, '#8fa6b8', 0.26, top);
      for (const x of [-440, -418]) { grattacielo(P, x, -20, 14, 80, '#8a9a82', 0.25); for (const f of [0.3, 0.55, 0.8]) alberi(P, x, x + 14, -20 + 80 * f, 'chioma', 4, ['#56743f'], 1.2, 0.25); }   // il Bosco Verticale
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -100, alte: 0.03 });
      duomo(P, 0, -104, 250, 120);
      viale(P, { h0: -106, h1: -150, mezza: 300, suolo: '#cfc6b6' });   // la piazza
      // l'ingresso della Galleria Vittorio Emanuele a sinistra e i portici a destra
      rett(P, -330, -110, 150, 44, P.aria('#e6d7bd', 0.06)); arco(P, -255, -110, 34, 38, P.aria('#4f4238', 0.06)); rett(P, -282, -72, 54, 10, P.aria('#e6d7bd', 0.06));
      for (let i = 0; i < 6; i++) { rett(P, -322 + i * 12, -104, 5, 9, P.aria('#5d554c', 0.06)); rett(P, -232 + i * 9, -104, 4, 9, P.aria('#5d554c', 0.06)); }
      rett(P, 180, -110, 150, 40, P.aria('#e0d2b8', 0.06)); for (let i = 0; i < 10; i++) arco(P, 190 + i * 14, -110, 9, 12, P.aria('#5d554c', 0.06));
      gente(P, -110, -142, 260, 90);
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -108, h1: -150, libero: (s, h, sc) => Math.abs(s) < 280 * sc + 60 });
    } },
    // Parigi dal Trocadéro: la Tour Eiffel sul Champ de Mars, i tetti in zinco, la cupola degli Invalides, Montmartre
    parigi: { nebbia: '#e4e1d8', seme: 7, dipingi(P) {
      const st = STILI.parigi;
      crinale(P, { da: 420, a: 860, base: -10, alt: 56, colore: P.aria('#8e9c7c', 0.38), passo: 5, fase: 4, forma: (s, u) => Math.pow(Math.sin(u * Math.PI), 0.7), bosco: true });   // Montmartre
      cupola(P, 640, 36, 18, '#f4f1e8', '#efede6', 0.28, 1.4); cupola(P, 612, 32, 8, '#f4f1e8', '#efede6', 0.28, 1.4); cupola(P, 668, 32, 8, '#f4f1e8', '#efede6', 0.28, 1.4);   // il Sacré-Cœur
      rett(P, 690, 28, 7, 40, P.aria('#f4f1e8', 0.28));
      for (const [x, h, w] of [[-760, 70, 26], [-720, 60, 20], [-800, 52, 22], [-690, 48, 18]]) grattacielo(P, x, -8, w, h, '#a3b2bf', 0.6);   // La Défense
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -88, alberi: { tipo: 'chioma', col: ['#6b8550', '#5f7a45'], p: 0.06, alt: 14 } });
      cupola(P, -300, -50, 18, '#ece4d0', '#d4b048', 0.14, 1.3);   // gli Invalides
      poli(P, [[-306, -50 + 18 * 2.45], [-294, -50 + 18 * 2.45], [-300, -50 + 18 * 2.9]], P.aria('#d4b048', 0.14));
      viale(P, { h0: -90, h1: -150, mezza: 210, suolo: '#cbbf9f', prato: '#7e9a58', alberi: { tipo: 'chioma', col: ['#5f7a45', '#6b8550', '#56703e'], alt: 16 }, file: [0.95, 1.12] });   // il Champ de Mars
      eiffel(P, 0, -94, 286, '#6e5544');
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -96, h1: -150, libero: (s, h, sc) => Math.abs(s) < 245 * sc + 6 });
    } },
    // Londra dal Westminster Bridge: Big Ben e il Parlamento sul Tamigi, il London Eye, la City e lo Shard
    londra: { nebbia: '#d2d5d8', terra: '#5a7280', seme: 11, foschia: 0.85, dipingi(P) {
      const st = STILI.londra;
      for (const [x, h, w, c] of [[440, 110, 26, '#93a8b8'], [500, 86, 30, '#a7b5c0'], [560, 132, 22, '#8aa0b2'], [700, 96, 28, '#9cb0be'], [-760, 80, 24, '#a2b3c0'], [-820, 104, 20, '#93a8b8']]) grattacielo(P, x, -10, w, h, c, 0.52);
      cetriolo(P, 620, -10, 110, 0.5);
      shard(P, 780, -12, 250, 0.45);
      cupola(P, 380, -14, 20, '#e3dccb', '#9aa3a8', 0.42);   // St Paul's
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -50, foschia: 0.9 });
      towerBridge(P, 880, -50, 56, 0.3);
      londonEye(P, 360, -62, 84, 0.12);
      quartieri(P, { stile: st, da: 300, a: 1100, h0: -52, h1: -62 });   // la South Bank
      quartieri(P, { stile: st, da: -1100, a: -340, h0: -52, h1: -64 });   // Whitehall
      acqua(P, -64, -150, '#6b8391', '#4b6574');
      parlamento(P, -330, -10, -66, 26, 0.04);
      bigben(P, 0, -70, 196);
      rett(P, -1100, -70, 2200, 4, P.aria('#bdb09a', 0.06));   // l'argine
      rifletti(P, -66, 140, 0.24, -1100, 1100, 2.5);
      // il Westminster Bridge: arcate basse verdi verso la riva sud
      const ponte = P.aria('#5f7f62', 0.05);
      rett(P, 14, -66, 320, 7, ponte); rett(P, 14, -59, 320, 2, P.aria('#d9cfb8', 0.05));
      for (let i = 0; i < 7; i++) { P.g.beginPath(); P.g.ellipse(P.x(36 + i * 44), P.y(-66), P.m(18), P.m(4.5), 0, Math.PI, 0); P.g.fillStyle = P.aria('#36483e', 0.05); P.g.fill(); }
      onde(P, -66, -150, '#3a5260', -1100, 1100, 0.7);
      for (let i = 0; i < 5; i++) { const h = P.rr(-130, -80); barca(P, P.rr(-700, 700), h, P.rr(10, 16) * scala(h), false); }
    } },
    // Francoforte: il Römer sul Römerberg con dietro lo skyline di "Mainhattan" e il Taunus
    francoforte: { nebbia: '#dcdee0', seme: 5, dipingi(P) {
      const st = STILI.francoforte, fw = Object.assign({}, st, STILI.fachwerk);
      crinale(P, { da: -1100, a: 1100, base: -2, alt: 36, colore: P.aria('#8f9c88', 0.5), passo: 10, fase: 6 });   // il Taunus
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -30 });
      // "Mainhattan": un gruppo di torri a due profondità, le più alte nel mezzo
      for (const [x, h, w, c, top] of [[-420, 96, 26, '#b8c6d2', null], [-360, 120, 30, '#a9b9c6', 'tetto'], [-150, 110, 24, '#9fb0bf', null], [210, 132, 28, '#a9b9c6', null], [300, 104, 34, '#b5c3cf', null], [380, 90, 24, '#9fb0bf', null], [-40, 128, 22, '#bfcad3', null], [90, 118, 26, '#aebfcc', 'gradoni']]) grattacielo(P, x, -24, w, h, c, 0.32, top);
      for (const [x, h, w, c, top] of [[-300, 236, 28, '#c9a48e', 'punta'], [-205, 196, 30, '#b9c7d2', 'gradoni'], [-95, 270, 34, '#9fb4c4', 'antenna'], [-20, 150, 22, '#8fa6b8', null], [40, 212, 30, '#7f98ad', 'antenna'], [120, 158, 24, '#6f8aa2', null], [150, 158, 24, '#6f8aa2', null], [240, 170, 28, '#a3b6c6', 'tetto'], [-250, 140, 26, '#9fb0bf', null]]) grattacielo(P, x, -30, w, h, c, 0.16, top);
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -32, h1: -98 });
      viale(P, { h0: -104, h1: -150, mezza: 190, suolo: '#b9ae9c' });   // il Römerberg
      romer(P, 0, -104, 42);
      gente(P, -106, -142, 160, 70);
      quartieri(P, { stile: fw, da: -1100, a: 1100, h0: -106, h1: -150, libero: (s, h, sc) => Math.abs(s) < 125 * sc + 75 });   // le case a graticcio
      rett(P, -60, -128, 8, 4, P.aria('#9a9086', 0.03)); rett(P, -57.5, -124, 3, 12, P.aria('#b0a698', 0.03)); ellisse(P, -56, -110, 1.8, 2.4, '#c9a646');   // la fontana della Giustizia
    } },
    // Madrid: la Puerta de Alcalá con il Retiro, il Metropolis, le Cuatro Torres e la Sierra de Guadarrama innevata
    madrid: { nebbia: '#ece4d4', seme: 23, dipingi(P) {
      const st = STILI.madrid;
      crinale(P, { da: -1100, a: 1100, base: 2, alt: 60, punte: true, colore: P.aria('#8796b0', 0.5), neve: 46, passo: 5, fase: 8 });   // la Sierra de Guadarrama
      for (const [x, h] of [[-560, 190], [-520, 186], [-480, 178], [-440, 160]]) grattacielo(P, x, -10, 22, h, '#a3b6c8', 0.42, x === -520 ? 'antenna' : 'tetto');   // le Cuatro Torres
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -80 });
      cupola(P, 420, -54, 15, '#f0e8d8', '#3f4650', 0.12, 1.3); ellisse(P, 420, -54 + 15 * 2.6, 3, 5, '#c9a646');   // il Metropolis
      alberi(P, -480, -90, -84, 'chioma', 22, ['#5d7a3e', '#668545', '#55703a'], 0.9, 0.08);   // il Retiro
      alberi(P, 90, 480, -84, 'chioma', 22, ['#5d7a3e', '#668545', '#55703a'], 0.9, 0.08);
      alberi(P, -600, 600, -96, 'chioma', 26, ['#5d7a3e', '#668545', '#55703a'], 0.6, 0.05);
      viale(P, { h0: -108, h1: -150, mezza: 360, suolo: '#cdbfa2', prato: '#8aa35c' });   // la plaza de la Independencia
      puertaAlcala(P, 0, -108, 150, 76);
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -112, h1: -150, libero: (s, h, sc) => Math.abs(s) < 400 * sc + 30 });
    } },
    // Lisbona: la Torre di Belém sul Tago, il Ponte 25 de Abril, il Cristo Rei e le colline con i tetti arancio
    lisbona: { nebbia: '#eaece6', terra: '#3f7ea6', seme: 13, dipingi(P) {
      const st = STILI.lisbona;
      crinale(P, { da: 100, a: 1100, base: -8, alt: 62, colore: P.aria('#879a76', 0.42), passo: 6, fase: 2, bosco: true, forma: (s, u) => 0.4 + 0.6 * Math.min(1, u * 3) });   // la riva sud, Almada
      rett(P, 640, 46, 5, 26, P.aria('#d8d2c2', 0.4)); rett(P, 630, 64, 25, 3, P.aria('#d8d2c2', 0.4)); rett(P, 641, 72, 3, 8, P.aria('#d8d2c2', 0.4));   // il Cristo Rei
      ponteSospeso(P, 150, 760, -8, 80, '#c0392b', 0.18);   // il Ponte 25 de Abril
      acqua(P, -8, -150, '#5c96bd', '#2c6f9a');
      const coll = crinale(P, { da: -1100, a: -180, base: -40, alt: 96, colore: P.aria('#93a47a', 0.25), passo: 6, fase: 1, bosco: true, forma: s => Math.pow(cl((-180 - s) / 420, 0, 1), 0.8) });   // Alfama, Bairro Alto
      rett(P, -700, coll.alt(-680) - 5, 50, 12, P.aria('#d6c8a8', 0.2)); for (let i = 0; i < 6; i++) rett(P, -700 + i * 9, coll.alt(-680) + 7, 3, 3, P.aria('#d6c8a8', 0.2));   // il castello di São Jorge
      quartieri(P, { stile: st, da: -1100, a: -190, h0: 56, h1: -38, scala: () => 0.28, fitte: 1.4, sotto: s => coll.alt(s) - 5 });
      quartieri(P, { stile: st, da: -1100, a: -180, h0: -42, h1: -84, libero: (s, h) => s > -180 + (h + 42) * 4 });
      rifletti(P, -8, 120, 0.22, -180, 1100, 2.5);
      const L = strato(P, Q => belem(Q, 0, -104, 132));
      P.g.drawImage(L, 0, 0);
      riflesso(P, L, -104, 132, 0.3, -120, 120, 1.5);
      butta(L);
      onde(P, -10, -150, '#1f5a82', -1100, 1100, 0.8);
      for (let i = 0; i < 8; i++) { const h = P.rr(-120, -20); barca(P, P.rr(-120, 900), h, P.rr(6, 10) * scala(h), P.rnd() < 0.7); }
    } },
    // Zagabria: la cattedrale con i due campanili sopra la città alta, San Marco col tetto a scacchi, la Medvednica
    zagabria: { nebbia: '#e2e4e2', seme: 19, dipingi(P) {
      const st = STILI.zagabria;
      crinale(P, { da: -1100, a: 1100, base: -4, alt: 84, colore: P.aria('#5f7d56', 0.42), passo: 6, fase: 9, bosco: true });   // la Medvednica
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -70, alberi: { tipo: 'chioma', col: ['#5a7a45', '#668548'], p: 0.08, alt: 14 } });
      sanMarco(P, -330, -54, 54, 0.08);
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -72, h1: -96, libero: s => Math.abs(s) < 120, alberi: { tipo: 'chioma', col: ['#5a7a45', '#668548'], p: 0.12, alt: 14 } });
      rett(P, 420, -60, 14, 60, P.aria('#e8e2d4', 0.12)); poli(P, [[418, 0], [436, 0], [427, 30]], P.aria('#5a7a5c', 0.12));   // la torre Lotrščak
      alberi(P, -1100, 1100, -74, 'chioma', 16, ['#5a7a45', '#668548', '#4f6e3c'], 0.35, 0.1);
      viale(P, { h0: -98, h1: -150, mezza: 230, suolo: '#c4bca8' });   // la piazza Kaptol
      cattedraleZagabria(P, 0, -96, 250);
      gente(P, -98, -140, 180, 60);
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -100, h1: -150, libero: (s, h, sc) => Math.abs(s) < 170 * sc + 50 });
    } },
    // Berlino: la Porta di Brandeburgo con la quadriga, il Tiergarten, la cupola del Reichstag, la torre della TV
    berlino: { nebbia: '#dcdfe1', seme: 29, dipingi(P) {
      const st = STILI.berlino;
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -60 });
      fernsehturm(P, 260, -30, 290, 0.3);
      rett(P, -520, -66, 160, 30, P.aria('#d8d0bc', 0.12));
      cupola(P, -440, -36, 22, '#d8d0bc', '#bcd6e2', 0.12, 1.0);   // il Reichstag con la cupola di vetro
      alberi(P, -1100, 1100, -70, 'chioma', 22, ['#55703f', '#5f7a45', '#4c6838'], 0.7, 0.1);   // il Tiergarten
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -76, h1: -102, libero: s => Math.abs(s) < 200 });
      viale(P, { h0: -102, h1: -150, mezza: 330, suolo: '#c6c0b2' });   // il Pariser Platz
      brandeburgo(P, 0, -104, 196, 104);
      gente(P, -106, -142, 280, 80);
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -108, h1: -150, libero: (s, h, sc) => Math.abs(s) < 380 * sc + 20 });
    } },
    // Zurigo: il Grossmünster sulla Limmat, il Fraumünster con la guglia verde, San Pietro, il lago e le Alpi
    zurigo: { nebbia: '#e8eef2', seme: 37, dipingi(P) {
      const st = STILI.zurigo;
      crinale(P, { da: -1100, a: 1100, base: 18, alt: 96, punte: true, colore: P.aria('#8094b0', 0.48), neve: 50, colNeve: '#f4f7fb', passo: 4, fase: 3, veloNeve: 0.3 });   // le Alpi oltre il lago
      crinale(P, { da: -1100, a: 1100, base: -4, alt: 34, colore: P.aria('#6a8a62', 0.4), passo: 8, fase: 5, bosco: true });   // Uetliberg e Zürichberg
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -6, h1: -46 });
      rett(P, -250, -50, 13, 84, P.aria('#ebe3d3', 0.08)); poli(P, [[-252, 34], [-235, 34], [-243.5, 78]], P.aria('#5f9a80', 0.08));   // il Fraumünster
      rett(P, 270, -50, 15, 72, P.aria('#ebe3d3', 0.08)); poli(P, [[268, 22], [287, 22], [277.5, 56]], P.aria('#4f6f60', 0.08)); ellisse(P, 277.5, 8, 6, 6, P.aria('#2f3a34', 0.08)); ellisse(P, 277.5, 8, 4.6, 4.6, '#c9a646');   // San Pietro
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -48, h1: -64, libero: s => Math.abs(s) < 70 });   // il Limmatquai
      grossmunster(P, 0, -66, 196);
      rett(P, -1100, -70, 2200, 4, P.aria('#b9b0a0', 0.05));   // il muro del lungofiume
      acqua(P, -70, -116, '#6a9ab8', '#4a84a8');   // la Limmat
      rifletti(P, -70, 46, 0.3, -1100, 1100, 1.5);
      onde(P, -70, -116, '#2c6488', -1100, 1100, 0.9);
      rett(P, -1100, -120, 2200, 4, P.aria('#b9b0a0', 0.03));
      quartieri(P, { stile: st, da: -1100, a: 1100, h0: -120, h1: -150, libero: (s, h, sc) => Math.abs(s) < 170 * sc + 60 });   // la riva di qua (la Schipfe)
    } },
    // New York dalla baia: la Statua della Libertà davanti a Manhattan, l'Empire State, il Chrysler, One WTC, il ponte di Brooklyn
    newyork: { nebbia: '#dedfda', terra: '#4e6f86', seme: 41, dipingi(P) {
      const cols = ['#9fb3c4', '#b5bdc4', '#8ea2b5', '#c9c4b8', '#a8a49a', '#b9ae9c'];
      for (let x = -1100; x < 1100; x += P.rr(12, 26)) grattacielo(P, x, -6, P.rr(12, 24), P.rr(30, 130) * (Math.abs(x + 150) < 450 ? 1 : 0.55), P.pick(cols), 0.58);
      empireState(P, -330, -8, 300, 0.42); chrysler(P, -250, -8, 240, 0.44);
      for (let x = -900; x < 900; x += P.rr(10, 22)) grattacielo(P, x, -10, P.rr(14, 26), P.rr(25, 95) * (Math.abs(x - 250) < 300 ? 1.2 : 0.7), P.pick(cols), 0.4, P.rnd() < 0.15 ? 'tetto' : null);
      oneWtc(P, 300, -12, 330, 0.35);
      quartieri(P, { stile: STILI.newyork, da: -1100, a: 1100, h0: -12, h1: -18, foschia: 0.9 });
      acqua(P, -18, -150, '#6c8ca2', '#3e6178');
      ponteSospeso(P, 520, 1000, -18, 90, '#b9b3a3', 0.3);   // il ponte di Brooklyn
      rifletti(P, -18, 150, 0.2, -1100, 1100, 2.5);
      const L = strato(P, Q => liberty(Q, 0, -108, 236));
      P.g.drawImage(L, 0, 0);
      riflesso(P, L, -108, 40, 0.25, -300, 300, 1.5);
      butta(L);
      onde(P, -20, -150, '#2c4a60', -1100, 1100, 0.8);
      for (let i = 0; i < 7; i++) { const h = P.rr(-120, -40); barca(P, P.rr(250, 800) * (P.rnd() < 0.5 ? 1 : -1), h, P.rr(10, 18) * scala(h), false); }
    } }
  };

  // Dipinge la città "nome" su una tela larga W. cielo: { orizzonte, nebbia } i colori del gioco (all'orizzonte e della
  // nebbia della pista): le cose lontane sfumano nel cielo, il fondo nella nebbia, così la cartolina si fonde con la pista.
  function dipingi(nome, W, cielo = {}) {
    const r = pittura(nome, W, cielo, false);
    return r ? r.vicino : null;
  }
  // Come dipingi, ma in due piani (R-513): { vicino: la città con il monumento, lontano: i monti su una tela larga W/4
  // (sono sfumati dalla foschia: bastano meno pixel, e la memoria della scheda video cresce di un sedicesimo) oppure
  // null se la città non ha monti lontani }
  function dipingiPiani(nome, W, cielo = {}) {
    return pittura(nome, W, cielo, true);
  }
  function pittura(nome, W, cielo, piani) {
    const Rc = RICETTE[nome];
    if (!Rc) return null;
    const c = { orizzonte: cielo.orizzonte || Rc.nebbia, nebbia: cielo.nebbia || Rc.nebbia };
    misti.clear(); cache.clear();   // i colori tenuti da parte servono solo alla città che si sta dipingendo
    const P = tela(W, c, Rc.seme, Rc, piani);
    Rc.dipingi(P);
    sfuma(P, 26, -4, c.orizzonte, c.orizzonte, 0, 0.16);   // un velo di foschia all'orizzonte
    sfuma(P, -4, -40, c.orizzonte, c.orizzonte, 0.16, 0);
    const fondo = terra(nome, c.nebbia);
    sfuma(P, -118, -150, fondo, fondo, 0, 1);   // in fondo il passaggio al suolo lontano (nebbia o acqua)
    let lontano = null;
    if (piani && P.cL) {
      if (P.lontano) {
        const Q = Object.assign({}, P, { g: P.gL });
        sfuma(Q, 26, -4, c.orizzonte, c.orizzonte, 0, 0.16);   // lo stesso velo anche sui monti
        sfuma(Q, -4, -40, c.orizzonte, c.orizzonte, 0.16, 0);
        lontano = nuovaTela(Math.max(64, Math.round(P.W / 4)), Math.max(16, Math.round(P.H / 4)));
        const gl = lontano.getContext('2d', CPU);
        gl.imageSmoothingEnabled = true; gl.imageSmoothingQuality = 'high';
        gl.drawImage(P.cL, 0, 0, lontano.width, lontano.height);
      }
      butta(P.cL);
    }
    return { vicino: P.c, lontano };
  }
  function terra(nome, nebbia) {
    const Rc = RICETTE[nome];
    if (!Rc) return null;
    return Rc.terra ? mix(Rc.terra, nebbia || Rc.nebbia, 0.15) : (nebbia || Rc.nebbia);
  }
  return { GEOMETRIA, citta: Object.keys(RICETTE), dipingi, dipingiPiani, terra };
})();
