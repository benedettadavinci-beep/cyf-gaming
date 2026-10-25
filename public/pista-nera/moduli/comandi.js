// modulo: comandi
// dipende da: base, audio
// Comandi del giocatore: tastiera sul PC (frecce o WASD, spazio, P, M, V, B, N), rotellina e pulsante Salta sul telefono.
// Espone keys/stick (lo stato dei comandi) e inSteer/inFast/inSlow, che la fisica legge a ogni fotogramma.
// Si crea con PN.comandi({ audio, azioni, stato }) dal gioco: azioni = { jump, togglePause, setMuted, voiceButton, useItem,
// enterInInput } sono le cose da fare quando si preme un tasto; stato dà mode e P.
window.PN = window.PN || {};
PN.comandi = ({ audio: AUDIO, azioni, stato }) => {
  const { clamp } = PN.base;
  const { initAudio } = AUDIO;
  const $ = id => document.getElementById(id);
  // ---------- input ----------
  const keys = { left: false, right: false, up: false, down: false };
  // rotellina sul telefono: x da -1 (sinistra) a 1 (destra), y da -1 (su = accelera) a 1 (giù = frena)
  const stick = { x: 0, y: 0, on: false };
  const inSteer = () => clamp((keys.right ? 1 : 0) - (keys.left ? 1 : 0) + stick.x, -1, 1);
  const inFast = () => (keys.down && !keys.up) || stick.y < -0.35;   // posizione raccolta, più veloce
  const inSlow = () => keys.up || stick.y > 0.35;                    // peso in avanti, frena
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') azioni.enterInInput(); return; }
    const mode = stato.mode;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    else if (k === ' ') { if (mode === 'solo' || mode === 'race') e.preventDefault(); if (!e.repeat) azioni.jump(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      // a terra frena (peso in avanti); in aria salto mortale in avanti
      if (mode === 'solo' || mode === 'race') e.preventDefault();
      keys.up = true;
    }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); keys.down = true; }
    else if (k === 'p' || k === 'P' || k === 'Escape') azioni.togglePause();
    else if (k === 'm' || k === 'M') azioni.setMuted(!AUDIO.muted);
    else if (k === 'v' || k === 'V') { if (!e.repeat) azioni.voiceButton(); }
    else if (k === 'b' || k === 'B') { if (!e.repeat) azioni.useItem('banana'); }
    else if (k === 'n' || k === 'N') { if (!e.repeat) azioni.useItem('bomb'); }
    else if (k === 'g' || k === 'G') { if (!e.repeat) azioni.useItem('bananone'); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = false;
    if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = keys.up = keys.down = false; stick.x = stick.y = 0; if (stato.mode === 'solo') azioni.togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && stato.mode === 'solo') azioni.togglePause(); });
  function holdButton(el, key) {
    const on = e => { e.preventDefault(); keys[key] = true; el.classList.add('on'); };
    const off = () => { keys[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, off));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  // sul telefono: Salta a terra salta, tenuto premuto in aria fa il salto mortale all'indietro
  const tJump = $('tJump');
  tJump.addEventListener('pointerdown', e => { e.preventDefault(); tJump.classList.add('on'); if (stato.P && stato.P.air) keys.down = true; else azioni.jump(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => tJump.addEventListener(ev, () => { keys.down = false; tJump.classList.remove('on'); }));
  tJump.addEventListener('contextmenu', e => e.preventDefault());
  // rotellina: compare dove si appoggia il dito; spostandolo a destra/sinistra si curva (più lo sposti, più curvi),
  // in su si accelera, in giù si frena; in aria destra/sinistra = avvitamento, su/giù = salto mortale
  const stickEl = $('stick'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
  const STICK_R = 54;
  let stickId = null, stickCx = 0, stickCy = 0;
  function stickRest() {
    const r = stickEl.getBoundingClientRect();
    stickBase.style.left = (r.width * 0.56) + 'px'; stickBase.style.top = (r.height * 0.58) + 'px';
    stickKnob.style.transform = '';
  }
  function stickMove(e) {
    const dx = e.clientX - stickCx, dy = e.clientY - stickCy;
    const d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
    const kx = dx * k, ky = dy * k;
    stickKnob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
    const dead = (v) => Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86;
    stick.x = dead(kx / STICK_R); stick.y = dead(ky / STICK_R);
  }
  stickEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (stickId !== null) return;
    stickId = e.pointerId;
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) {}
    const r = stickEl.getBoundingClientRect();
    // il centro della rotellina va sotto il dito, senza uscire dalla zona
    const cx = clamp(e.clientX - r.left, 66, r.width - 66), cy = clamp(e.clientY - r.top, 66, r.height - 66);
    stickCx = r.left + cx; stickCy = r.top + cy;
    stickBase.style.left = cx + 'px'; stickBase.style.top = cy + 'px';
    stick.on = true; stickEl.classList.add('on');
    stickMove(e);
    initAudio();
  });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = e => {
    if (e.pointerId !== stickId) return;
    stickId = null; stick.x = stick.y = 0; stick.on = false;
    stickEl.classList.remove('on'); stickRest();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => stickEl.addEventListener(ev, stickEnd));
  stickEl.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('resize', stickRest);
  stickRest();

  return { keys, stick, inSteer, inFast, inSlow, stickRest };
};
