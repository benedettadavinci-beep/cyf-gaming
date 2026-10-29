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
  const VERSIONE = 7;   // 2 (0.13.0): "pronto" e banana lanciata ("throw"); 3 (0.14.0): capelli (h); 4 (0.15.0): pantaloni (p), casco (e), tavola (s); 5 (0.16.0): bananone (kind nel "throw"); 6 (0.17.0): pista del giorno (daily nel "welcome", giorno in "countdown" e "results"); 7 (0.18.0): avversari del software (bots, botfinish, pilota, as)

  // città: ogni città ha la sua pista, quindi in una gara tutti corrono nella stessa città (R-118, R-312)
  const SCENE = ['neve', 'napoli', 'roma', 'milano', 'parigi', 'londra', 'francoforte', 'madrid', 'lisbona', 'zagabria', 'berlino', 'zurigo', 'newyork'];
  const cleanScena = s => (SCENE.includes(s) ? s : 'neve');
  const DURATIONS = [5, 10, 15];               // minuti di gara
  const MAX_PLAYERS = 8;
  const DROP_KINDS = ['banana', 'bomb', 'bananone'];
  const THROW_KINDS = ['banana', 'bananone'];   // oggetti che si lanciano al giocatore davanti (R-224, R-231)
  // punti della gara spesi per lasciare l'oggetto (R-113). Dalla 0.27.0 (R-520, R-521, 29/10): banana 1.500 (era 50),
  // bomba 50 (era 150), così sulla pista si trovano soprattutto bombe; bananone 1.500 fisso (S-54, non più 10 volte la bomba)
  const COSTI = { banana: 1500, bomb: 50, bananone: 1500 };
  const FERMO = { banana: 2, bomb: 4, bananone: 4 };   // secondi di fermo per chi viene colpito (R-223, R-224, R-231)
  // avversari guidati dal software (R-234, S-39): nomi comuni in più lingue, usati dal server (gare) e dal gioco (allenamento)
  const NOMI_BOT = ['Marco', 'Giulia', 'Luca', 'Sofia', 'Matteo', 'Chiara', 'Davide', 'Elena', 'Paolo', 'Sara', 'Andrea', 'Marta', 'Léa', 'Hugo', 'Chloé', 'Louis',
    'Lucía', 'Mateo', 'Carmen', 'Javier', 'Emma', 'Noah', 'Olivia', 'Jack', 'Mia', 'Leon', 'Hannah', 'Felix', 'Ana', 'Tiago', 'Ivan', 'Petra', 'Nina', 'Tom', 'Alex', 'Zoe'];
  const MAX_BOTS = 4;                          // avversari che chi organizza può aggiungere a una sfida (R-237)

  // messaggi dal gioco al server: tipo → campi obbligatori con il loro tipo ("n" numero, "s" testo, "b" vero/falso)
  const CLIENT = {
    hello:       { id: 's', name: 's', v: 'n' },                  // facoltativi: j (maglia), h (capelli), p (pantaloni), e (casco), s (tavola), sc (città)
    settings:    { minutes: 'n' },                                // solo l'organizzatore; bots facoltativo: avversari del software 0…4 (R-237)
    scena:       { scena: 's' },                                  // solo l'organizzatore
    jersey:      { j: 's' },                                      // aspetto del personaggio (R-229): h, p, e, s facoltativi
    ready:       {},
    start:       {},                                              // solo l'organizzatore
    loaded:      {},                                              // la pista è caricata e disegnata (R-119)
    pronto:      {},                                              // "Sono pronto" durante l'attesa prima del via: alza la mano (R-222)
    throw:       { target: 's', hid: 's' },                       // banana lanciata al giocatore davanti (R-224); kind facoltativo: 'banana' o 'bananone' (R-231)
    pos:         { x: 'n', z: 'n' },                              // y, a, s, f, g, v, c, k, top, tk, p facoltativi
    finish:      {},                                              // top, tk, p facoltativi
    drop:        { kind: 's', x: 'n', z: 'n', hid: 's' },        // as facoltativo: un avversario del software (solo il pilota), anche in throw e hit
    hit:         { hid: 's' },                                    // owner, kind, as facoltativi
    bots:        { b: 'o' },                                      // posizioni degli avversari del software, solo dal pilota (R-234)
    botfinish:   { id: 's' },                                     // un avversario del software arriva al traguardo; top, tk, p facoltativi
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
    reported:     {},
    bots:         { b: 'o' },                                      // posizioni degli avversari del software (R-234)
    pilota:       { id: 's' }                                      // chi guida gli avversari del software (S-39); bots facoltativo: le ultime posizioni
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

  return { VERSIONE, SCENE, cleanScena, DURATIONS, MAX_PLAYERS, DROP_KINDS, THROW_KINDS, COSTI, FERMO, NOMI_BOT, MAX_BOTS, CLIENT, SERVER, valida };
})();
if (typeof window !== 'undefined') { window.PN = window.PN || {}; window.PN.protocollo = globalThis.CYF_PROTOCOLLO; }
