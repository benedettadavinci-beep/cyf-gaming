// modulo: audio
// dipende da: base, lingua
// Suoni del gioco con Web Audio: vento e carving che seguono la velocità, toni per acrobazie, cadute, conto alla rovescia,
// pulsante audio sì/no salvato sul dispositivo. Il contesto audio (audio.ac) serve anche ai messaggi vocali.
// Si crea con PN.audio({ btnSound, isCity, isActive }) dal gioco: isCity() dice se lo scenario è una città (carving più grave),
// isActive() se si sta scendendo (vento acceso).
window.PN = window.PN || {};
PN.audio = ({ btnSound, isCity, isActive }) => {
  const { store } = PN.base;
  const { tr } = PN.lingua;
  // ---------- sound ----------
  let audio = null, muted = store.get('pistaNera.muted') === '1';
  function initAudio() {
    if (audio) { if (audio.ac.state === 'suspended') audio.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
      const windF = ac.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 480;
      const windG = ac.createGain(); windG.gain.value = 0;
      const carveF = ac.createBiquadFilter(); carveF.type = 'bandpass'; carveF.frequency.value = 2600; carveF.Q.value = 0.7;
      const carveG = ac.createGain(); carveG.gain.value = 0;
      src.connect(windF); windF.connect(windG); windG.connect(master);
      src.connect(carveF); carveF.connect(carveG); carveG.connect(master);
      src.start();
      if (isCity()) carveF.frequency.value = 900;
      audio = { ac, master, windG, carveG, windF, carveF };
    } catch (e) { audio = null; }
  }
  function tone(type, f0, f1, dur, vol) {
    if (!audio || muted) return;
    const { ac, master } = audio;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, ac.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur * 0.7);
    g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.05);
  }
  const thump = v => tone('sine', 110, 45, 0.25, 0.35 * v);
  const chime = () => tone('triangle', 1320, 1760, 0.22, 0.12);
  const beep = hi => tone('square', hi ? 1046 : 523, hi ? 1046 : 523, hi ? 0.5 : 0.18, 0.08);
  function soundLevels(speed, carve, onSnow) {
    if (!audio) return;
    const now = audio.ac.currentTime, active = isActive();
    // velocità riferite agli 80 km/h (22 m/s) della 0.19.0 (R-242); prima ai 45 m/s
    audio.windG.gain.setTargetAtTime(active ? Math.min(0.32, (speed / 22) * 0.3) : 0.03, now, 0.15);
    audio.windF.frequency.setTargetAtTime(300 + speed * 36, now, 0.2);
    audio.carveG.gain.setTargetAtTime(active && onSnow ? Math.min(0.22, carve * (speed / 22) * 0.4 + 0.02) : 0, now, 0.06);
  }
  function setMuted(m) {
    muted = m;
    store.set('pistaNera.muted', m ? '1' : '0');
    btnSound.setAttribute('aria-pressed', String(!m));
    btnSound.textContent = m ? tr('audioOff') : tr('audioOn');
    if (audio) audio.master.gain.setTargetAtTime(m ? 0 : 0.9, audio.ac.currentTime, 0.05);
  }

  // iPhone: dopo una telefonata o un cambio di scheda il contesto audio resta "sospeso" e riparte solo dentro un tocco
  // (lo chiedono anche i portali, R-244): a ogni tocco o tasto, se è sospeso, lo si fa ripartire
  for (const ev of ['touchend', 'pointerdown', 'keydown']) window.addEventListener(ev, () => { if (audio && audio.ac.state === 'suspended') audio.ac.resume().catch(() => {}); }, { passive: true });
  return { initAudio, tone, thump, chime, beep, soundLevels, setMuted, get audio() { return audio; }, get muted() { return muted; } };
};
