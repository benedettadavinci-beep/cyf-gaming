// modulo: fisica
// dipende da: base
// Le regole del movimento, uguali per il rider e per gli avversari del computer (A-19): velocità massima lungo la pista,
// velocità che si cerca di tenere, salti, rampe e trampolini (superficie, stacco), cadute e punti delle acrobazie.
// Ogni cambio di fisica si fa qui, in un posto solo. Niente grafica e niente stato: solo numeri e funzioni pure, così si
// potranno usare anche nel server (controllo della traiettoria, F-04).
window.PN = window.PN || {};
PN.fisica = (() => {
  const { TAU, clamp } = PN.base;

  // Velocità come nella realtà (R-242, dalla 0.19.0): in uno studio con radar su 1.023 sciatori e snowboarder la media
  // è 52 km/h (snowboarder 44) e la massima 81,7 km/h. Qui: velocità massima lungo la pista (m/s) che cresce con i metri
  // percorsi d, da 41 km/h al via fino a 71 km/h dopo ~2,4 km; in posizione raccolta +12%, cioè 80 km/h, e mai oltre.
  // Prima: da 65 a 158 km/h (18 + min(26, d · 0,00975) m/s), con le rampe fino a 46 m/s.
  const vmax = d => 11.5 + Math.min(8.34, d * 0.0035);
  const MAX = 80 / 3.6;        // 80 km/h: nessuno va più veloce, nemmeno in discesa ripida o uscendo da una rampa
  const RACCOLTA = 1.12;       // posizione raccolta (freccia giù): +12%
  const FRENATA = 0.5;         // freccia su: metà velocità
  const AUTO = 11;             // velocità del rider che scende da solo nel menu
  const limita = v => (v > MAX ? MAX : v);
  const STERZO = 2.4;          // rad/s: quanto in fretta cambia la direzione
  const ANGOLO = 1.25;         // rad: angolo massimo rispetto alla pista
  const GRAVITA = 20;          // m/s²
  const SALTO = 6.4;           // spinta del salto (Spazio): ~1 m d'altezza, 0,64 s in aria
  const RAMPA = 8.6, TRAMPOLINO = 13.5;   // spinta allo stacco: rampa ~3 m e 1 s; trampolino gigante ~7 m e 1,5 s (R-214)
  const CADUTA = 0.85;         // secondi a terra dopo una caduta
  // velocità da tenere partendo da base (di solito vmax del punto): meno in curva, un po' di più in discesa ripida
  const obiettivo = (base, ang, drop) => base * Math.pow(Math.cos(ang), 1.6) * (1 + clamp(drop * 0.35, -0.2, 0.2));
  // velocità allo stacco dalla rampa
  const stacco = v => Math.min(v * 1.06, MAX);
  // invulnerabilità dopo una caduta: almeno 2,3 s, o il fermo più 1,5 s
  const invuln = stop => Math.max(2.3, stop + 1.5);

  // Altezza della superficie della rampa (sopra la sua base) nel punto z della pista. Ricalca il modello: profilo
  // quadratico da (-0,6; 0) a (4; 1,1) più lo spessore del bordo arrotondato (0,25 sulla neve, 0,2 in città),
  // scalato ×2 per il trampolino gigante. La rampa inizia RAMP_FOOT·k metri prima del suo centro (il rider ci sale 0,9 m
  // prima, quando ci arriva la punta della tavola) e stacca a 2·k dopo.
  const RAMP_FOOT = 2.85;
  function rampTop(r, z, citta) {
    const k = r.big ? 2 : 1, bev = citta ? 0.2 : 0.25;
    const xo = 2 - (z - r.z) / k;                      // coordinata lungo il profilo del modello
    if (xo < -0.6) return Math.max(0, xo + 0.6 + bev) * k;   // bordo arrotondato all'ingresso
    const c = 4 - Math.min(xo, 4);
    const u = (4.8 - Math.sqrt(Math.max(0, 23.04 - 0.8 * c))) / 0.4;   // parametro della curva quadratica
    return (1.1 * (1 - u) + bev) * k;
  }

  // Atterraggio: oltre ~57° di rotazione o ~63° di salto mortale si cade; poco storto = solo rallentamento.
  // spin0: la rotazione allo stacco (si conta solo quella fatta in aria; il rider passa da 0 a π scendendo "al contrario").
  // Restituisce { cade, sloppy, nomi, pts, mezziGiri }: pts già con il doppio sulla rampa, la combinazione e la metà se storto.
  const nearest = (v, step) => Math.round(v / step) * step;
  function atterraggio({ spin, spin0 = 0, flip, grabT, ramp }) {
    const errSpin = Math.abs(spin - nearest(spin, Math.PI)), errFlip = Math.abs(flip - nearest(flip, TAU));
    const mezziGiri = Math.round(Math.abs(spin - spin0) / Math.PI);
    const flips = Math.round(Math.abs(flip) / TAU), back = flip > 0, grabbed = grabT > 0.3;
    if (errSpin > 1.0 || errFlip > 1.1) return { cade: true, sloppy: false, nomi: [], pts: 0, mezziGiri };
    const sloppy = errSpin > 0.45 || errFlip > 0.5;
    const nomi = [];
    let pts = 0;
    if (flips >= 1) { nomi.push((flips > 1 ? flips + 'x ' : '') + (back ? 'Backflip' : 'Frontflip')); pts += 150 * flips; }
    if (mezziGiri >= 1) { nomi.push(mezziGiri * 180 + '°'); pts += 60 * mezziGiri; }
    if (grabbed) { nomi.push('Grab'); pts += 30 + Math.min(60, Math.round(grabT * 40)); }
    if (nomi.length) {
      if (ramp) pts *= 2;
      if (nomi.length > 1) pts = Math.round(pts * 1.5);
      if (sloppy) pts = Math.round(pts / 2);
    }
    return { cade: false, sloppy, nomi, pts, mezziGiri };
  }
  // dopo l'atterraggio: un numero dispari di mezzi giri vuol dire scendere "al contrario"
  const switchDopo = spin => (Math.round(spin / Math.PI) % 2 ? Math.PI : 0);

  return { vmax, MAX, limita, RACCOLTA, FRENATA, AUTO, STERZO, ANGOLO, GRAVITA, SALTO, RAMPA, TRAMPOLINO, CADUTA, obiettivo, stacco, invuln, RAMP_FOOT, rampTop, nearest, atterraggio, switchDopo };
})();
