// modulo: vocali
// dipende da: base, lingua, audio, portale
// Messaggi vocali nella sfida: registrazione con Web Audio (funziona su tutti i telefoni), invio in WAV, riproduzione
// con doppia via (Web Audio, poi elemento audio), pulsante con l'attesa, silenzia e segnala (R-213, R-116).
// Casella "Messaggi vocali" nel menu (R-244): spenti, il microfono non c'è e i vocali degli altri non si sentono;
// la scelta resta sul dispositivo (cyf.vocali). Sul portale partono spenti (S-46), altrove accesi.
// Si crea con PN.vocali({ net, audio, say, isOnline, isTraining, serverNow }) dal gioco:
//   net.send(m) manda al server; audio è l'istanza di PN.audio (contesto audio e muto); say(testo, colore) mostra un avviso;
//   isOnline() dice se si è in una stanza collegata; isTraining() se si è in allenamento; serverNow() l'ora del server.
window.PN = window.PN || {};
PN.vocali = ({ net, audio: AUDIO, say, isOnline, isTraining, serverNow }) => {
  const { isPhone, store, PALETTE } = PN.base;
  const { tr } = PN.lingua;
  const $ = id => document.getElementById(id);
  // ---------- messaggi vocali (solo in sfida, uno ogni 3 minuti: il limite lo controlla il server) ----------
  const VOICE_MAX_S = 8;
  const voice = { stream: null, nodes: null, chunks: [], recording: false, startT: 0, timer: null, next: 0, rate: 0, ownAc: null };
  const btnVoice = $('btnVoice'), voiceNow = $('voiceNow'), voiceLbl = $('voiceLbl'), chkVocali = $('chkVocali');
  const online = isOnline;
  // vocali accesi? scelta del giocatore; senza scelta, spenti solo sul portale (R-244)
  const abilitati = () => { const v = store.get('cyf.vocali'); return v === '1' || v === '0' ? v === '1' : !PN.portale.attivo; };
  if (chkVocali) {
    chkVocali.checked = abilitati();
    chkVocali.addEventListener('change', () => {
      store.set('cyf.vocali', chkVocali.checked ? '1' : '0');
      if (!chkVocali.checked) { if (voice.recording) stopVoice(true); stopPlaying(); }
      updateVoiceBtn();
    });
  }
  const fmtWait = ms => { const s2 = Math.ceil(ms / 1000); return Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0'); };
  function updateVoiceBtn() {
    if (!abilitati()) { btnVoice.hidden = true; return; }
    const on = online();
    // si vede sempre mentre si gioca; in allenamento è spento e spiega che i vocali sono per le sfide
    const solo = !on && isTraining();
    btnVoice.hidden = !on && !solo;
    btnVoice.classList.toggle('solo', solo);
    if (solo) { btnVoice.disabled = false; voiceLbl.textContent = tr('voiceTalk'); return; }
    if (!on) return;
    const wait = voice.next - serverNow();
    btnVoice.classList.toggle('rec', voice.recording);
    if (voice.recording) {
      voiceLbl.textContent = tr('voiceSend') + ' ' + Math.max(0, Math.ceil(VOICE_MAX_S - (performance.now() - voice.startT) / 1000));
      btnVoice.disabled = false;
    } else if (wait > 0) {
      voiceLbl.textContent = fmtWait(wait);
      btnVoice.disabled = true;
    } else {
      voiceLbl.textContent = isPhone ? tr('voiceTalk') : tr('voiceTalk') + ' (V)';
      btnVoice.disabled = false;
    }
  }
  setInterval(updateVoiceBtn, 250);
  btnVoice.addEventListener('click', () => voiceButton());
  $('btnMute').addEventListener('click', () => {
    if (!voiceFrom) return;
    mutedIds.add(voiceFrom.id);
    store.set('cyf.muted', JSON.stringify([...mutedIds].slice(-50)));
    stopPlaying();
    say(tr('mutedToast', { n: voiceFrom.name }), '#13233a');
  });
  $('btnReport').addEventListener('click', () => {
    if (!voiceFrom) return;
    net.send({ t: 'reportVoice', id: voiceFrom.id });
  });
  // Registrazione con Web Audio invece di MediaRecorder: funziona su tutti i telefoni (anche dove MediaRecorder manca,
  // come in certe app con browser interno, o registra in un formato che gli altri telefoni non sanno riprodurre).
  // I campioni del microfono vengono ridotti a un quarto della frequenza (11-12 kHz, più che sufficiente per la voce)
  // e inviati come WAV, che ogni browser sa decodificare.
  function voiceContext() {
    AUDIO.initAudio();
    if (AUDIO.audio && AUDIO.audio.ac) return AUDIO.audio.ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { voice.ownAc = voice.ownAc || new AC(); } catch (e) { return null; }
    return voice.ownAc;
  }
  async function voiceButton() {
    if (!abilitati()) return;
    if (!online()) { if (isTraining()) say(tr('voiceOnlyChallenge'), '#13233a'); return; }
    if (voice.recording) { stopVoice(); return; }
    const wait = voice.next - serverNow();
    if (wait > 0) { say(tr('voiceWait', { t: fmtWait(wait) }), '#13233a'); return; }
    const md = navigator.mediaDevices;
    const ac = voiceContext();
    if (!md || !md.getUserMedia || !ac || !ac.createScriptProcessor) { say(tr('voiceNoRec'), '#d8302a'); return; }
    let stream;
    try { stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { say(tr('voiceNoMic'), '#d8302a'); return; }
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) {} }
    let nodes;
    try {
      const src = ac.createMediaStreamSource(stream);
      const proc = ac.createScriptProcessor(4096, 1, 1);
      const sink = ac.createGain(); sink.gain.value = 0;   // il processore deve stare collegato all'uscita, ma non si deve sentire
      proc.onaudioprocess = e => { if (voice.recording) voice.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(sink); sink.connect(ac.destination);
      nodes = { src, proc, sink };
    } catch (e) { stream.getTracks().forEach(t => t.stop()); say(tr('voiceNoRec'), '#d8302a'); return; }
    voice.stream = stream; voice.nodes = nodes; voice.chunks = []; voice.rate = ac.sampleRate;
    voice.recording = true;
    voice.startT = performance.now();
    voice.timer = setTimeout(stopVoice, VOICE_MAX_S * 1000);
    updateVoiceBtn();
  }
  function stopVoice(cancel) {
    clearTimeout(voice.timer);
    const was = voice.recording;
    voice.recording = false;
    if (voice.nodes) { for (const n of Object.values(voice.nodes)) { try { n.disconnect(); } catch (e) {} } voice.nodes = null; }
    if (voice.stream) voice.stream.getTracks().forEach(t => t.stop());
    voice.stream = null;
    if (was && !cancel) sendVoice();
    voice.chunks = [];
    updateVoiceBtn();
  }
  // WAV mono a 16 bit; ogni campione in uscita è la media di 4 campioni del microfono (filtro semplice contro l'aliasing)
  function wavFromChunks(chunks, rate) {
    const n = chunks.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(n); let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    const DEC = 4, outRate = Math.round(rate / DEC), len = Math.floor(n / DEC);
    const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf);
    const str = (p, t) => { for (let i = 0; i < t.length; i++) v.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) {
      let x = 0;
      for (let k = 0; k < DEC; k++) x += all[i * DEC + k];
      x = Math.max(-1, Math.min(1, x / DEC));
      v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
    }
    return { buf, dur: len / outRate };
  }
  function sendVoice() {
    const { buf, dur } = wavFromChunks(voice.chunks, voice.rate || 48000);
    if (dur < 0.5) return;
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    const data = btoa(bin);
    if (data.length > 300000) { say(tr('voiceTooLong'), '#d8302a'); return; }
    net.send({ t: 'voice', mime: 'audio/wav', data, dur: Math.round(dur * 10) / 10 });
  }
  let voicePlaying = null, voiceFrom = null;
  function stopPlaying() { if (voicePlaying) { try { voicePlaying.stop(); } catch (e) {} voicePlaying = null; } voiceNow.hidden = true; }
  // giocatori silenziati su questo dispositivo (resta anche dopo la chiusura)
  const mutedIds = new Set((() => { try { return JSON.parse(store.get('cyf.muted') || '[]'); } catch (e) { return []; } })());
  function playVoice(m) {
    const who = m.name || tr('someone');
    if (!abilitati() || mutedIds.has(m.id)) return;
    voiceFrom = { id: m.id, name: who };
    if (AUDIO.muted) { say(tr('voiceMuted', { n: who }), '#13233a'); return; }
    let bytes;
    try { const bin = atob(m.data); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); }
    catch (e) { return; }
    const show = () => { voiceNow.hidden = false; voiceNow.querySelector('b').textContent = who; voiceNow.querySelector('i').style.background = PALETTE[(m.color || 0) % PALETTE.length]; };
    const hide = () => { voiceNow.hidden = true; voicePlaying = null; };
    const bad = () => { hide(); say(tr('voiceBadFormat', { n: who }), '#d8302a'); };
    stopPlaying();
    // 2) elemento audio classico: ripiego se il contesto audio non è disponibile o non decodifica il formato
    const viaAudioTag = () => {
      let url;
      try { url = URL.createObjectURL(new Blob([bytes], { type: m.mime || 'audio/wav' })); } catch (e) { bad(); return; }
      const a = new Audio(url); a.volume = 1;
      const me2 = { stop() { try { a.pause(); } catch (e) {} URL.revokeObjectURL(url); } };
      a.onended = () => { URL.revokeObjectURL(url); if (voicePlaying === me2) hide(); };
      a.onerror = () => { URL.revokeObjectURL(url); if (voicePlaying === me2) bad(); };
      voicePlaying = me2; show();
      a.play().catch(() => { if (voicePlaying === me2) bad(); });
    };
    // 1) Web Audio: suona anche senza un tocco recente (il contesto è già sbloccato dal gioco) e decodifica il WAV su ogni telefono
    const ac = voiceContext();
    if (ac && ac.state === 'running' && ac.decodeAudioData) {
      try {
        const dec = ac.decodeAudioData(bytes.buffer.slice(0), buffer => {
          const srcN = ac.createBufferSource(); srcN.buffer = buffer;
          srcN.connect(ac.destination);
          const me2 = { stop() { try { srcN.stop(); } catch (e) {} } };
          srcN.onended = () => { if (voicePlaying === me2) hide(); };
          voicePlaying = me2; show();
          srcN.start();
        }, () => viaAudioTag());
        // decodeAudioData restituisce anche una promessa: se il formato non si decodifica va a vuoto senza "errore non gestito" sul telefono
        if (dec && dec.catch) dec.catch(() => {});
      } catch (e) { viaAudioTag(); }
    } else viaAudioTag();
  }

  return { voice, fmtWait, updateVoiceBtn, voiceButton, stopVoice, playVoice, mutedIds, abilitati, get playing() { return voicePlaying; } };
};
