// modulo: protocollo
// dipende da: nessuno
// Il contratto dei messaggi tra gioco e server (A-12): un posto solo per i tipi di messaggio, i campi obbligatori,
// le costanti che gioco e server devono condividere (città, durate, costi di banane e bombe, numero massimo di giocatori)
// e il numero di versione del protocollo.
//
// Lo stesso file gira nel browser (tag <script>: PN.protocollo) e nel server (import '../public/shared/protocollo.js',
// poi globalThis.CYF_PROTOCOLLO). Non usa import/export né niente di specifico del browser.
//
// VERSIONE va aumentata ogni volta che cambia un messaggio o un campo. Il gioco la manda nel "hello"; se è diversa da
// quella del server, il server risponde { t: 'aggiorna' } e chiude: chi ha ancora la pagina vecchia aperta vede
// "aggiorna la pagina" invece di errori strani.
globalThis.CYF_PROTOCOLLO = (() => {
  const VERSIONE = 3;   // 2 (0.13.0): "pronto" e banana lanciata ("throw"); 3 (0.14.0): capelli scelti (h) in hello, jersey, lobby e racers

  // città: ogni città ha la sua pista, quindi in una gara tutti corrono nella stessa città (R-118, R-312)
  const SCENE = ['neve', 'napoli', 'roma', 'milano', 'parigi', 'londra', 'francoforte', 'madrid', 'lisbona', 'zagabria', 'berlino', 'zurigo', 'newyork'];
  const cleanScena = s => (SCENE.includes(s) ? s : 'neve');
  const DURATIONS = [5, 10, 15];               // minuti di gara
  const MAX_PLAYERS = 8;
  const DROP_KINDS = ['banana', 'bomb'];
  const COSTI = { banana: 50, bomb: 150 };     // punti della gara spesi per lasciare l'oggetto (R-113)

  // messaggi dal gioco al server: tipo → campi obbligatori con il loro tipo ("n" numero, "s" testo, "b" vero/falso)
  const CLIENT = {
    hello:       { id: 's', name: 's', v: 'n' },                  // j (maglia), h (capelli "forma:colore", R-225) e sc (città) facoltativi
    settings:    { minutes: 'n' },                                // solo l'organizzatore
    scena:       { scena: 's' },                                  // solo l'organizzatore
    jersey:      { j: 's' },                                      // h (capelli) facoltativo
    ready:       {},
    start:       {},                                              // solo l'organizzatore
    loaded:      {},                                              // la pista è caricata e disegnata (R-119)
    pronto:      {},                                              // "Sono pronto" durante l'attesa prima del via: alza la mano (R-222)
    throw:       { target: 's', hid: 's' },                       // banana lanciata al giocatore davanti (R-224)
    pos:         { x: 'n', z: 'n' },                              // y, a, s, f, g, v, c, k, top, tk, p facoltativi
    finish:      {},                                              // top, tk, p facoltativi
    drop:        { kind: 's', x: 'n', z: 'n', hid: 's' },
    hit:         { hid: 's' },                                    // owner, kind facoltativi
    voice:       { mime: 's', data: 's' },                        // dur facoltativa
    reportVoice: { id: 's' }
  };
  // messaggi dal server al gioco
  const SERVER = {
    welcome:      { you: 's', code: 's', now: 'n' },
    lobby:        { phase: 's' },
    full:         {},
    aggiorna:     {},                                             // versione del protocollo diversa: ricaricare la pagina
    countdown:    { seed: 'n', startAt: 'n', scena: 's' },
    gather:       { loaded: 'o' },                                // anche ready: chi ha alzato la mano (R-222)
    throw:        { id: 's', target: 's', hid: 's' },
    go:           { startAt: 'n', now: 'n' },
    racers:       { racers: 'o' },
    pos:          { id: 's', x: 'n', z: 'n' },
    left:         { id: 's' },
    drop:         { kind: 's', x: 'n', z: 'n', hid: 's' },
    hit:          { hid: 's' },
    finished:     { ms: 'n' },
    results:      { results: 'o' },
    voice:        { id: 's', data: 's' },
    voiceOk:      { next: 'n' },
    voiceWait:    { next: 'n', now: 'n' },
    voiceBlocked: {},
    reported:     {}
  };

  // controlla un messaggio contro il contratto: restituisce null se va bene, altrimenti il motivo
  function valida(m, verso) {
    const tab = verso === 'server' ? SERVER : CLIENT;
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return 'messaggio senza tipo';
    const campi = tab[m.t];
    if (!campi) return 'tipo sconosciuto: ' + m.t;
    for (const k in campi) {
      const v = m[k], atteso = campi[k];
      const ok = atteso === 'n' ? typeof v === 'number' && Number.isFinite(v) : atteso === 's' ? typeof v === 'string' : atteso === 'b' ? typeof v === 'boolean' : v != null && typeof v === 'object';
      if (!ok) return 'campo "' + k + '" mancante o sbagliato in ' + m.t;
    }
    return null;
  }

  return { VERSIONE, SCENE, cleanScena, DURATIONS, MAX_PLAYERS, DROP_KINDS, COSTI, CLIENT, SERVER, valida };
})();
if (typeof window !== 'undefined') { window.PN = window.PN || {}; window.PN.protocollo = globalThis.CYF_PROTOCOLLO; }
