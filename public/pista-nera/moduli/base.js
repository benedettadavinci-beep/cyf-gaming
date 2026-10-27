// modulo: base
// dipende da: nessuno
// Costanti e funzioni pure di Pista Nera: niente DOM (tranne matchMedia e localStorage), niente scena. Si carica anche
// nel worker che dipinge gli sfondi (moduli/sfondi.js): lì THREE e localStorage non servono e non si toccano.
// Ogni altro modulo può usarle; questo non usa nessun altro modulo.
window.PN = window.PN || {};
PN.base = (() => {
  const TAU = Math.PI * 2;
  const SLOPE_DEG = 16;
  const SLOPE = SLOPE_DEG * Math.PI / 180;
  const START_ALT = 2950;
  const HORIZON = '#d6e7f3';
  const PALETTE = ['#ff5a1f', '#2f7fd0', '#1f8a4c', '#e2b007', '#9b4dca', '#e2352b', '#00a3a3', '#f06292'];
  // matchMedia non c'è dentro un worker (gli sfondi si dipingono anche lì, R-405): lì vale "no"
  const mq = q => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const isPhone = mq('(pointer: coarse)');
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = n => Math.round(n).toLocaleString('it-IT');
  const fmtTime = ms => {
    if (ms == null) return '—';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
  };
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  return { TAU, SLOPE_DEG, SLOPE, START_ALT, HORIZON, PALETTE, reduceMotion, isPhone, rand, clamp, fmt, fmtTime, lin, store, mulberry32 };
})();
