// modulo: sala
// dipende da: nessuno
// La sala pubblica in cui entrare (modalità online e Gran Premio, B-04 dalla 0.26.2). Chiede a /api/quick (con ?gp=1 per
// il Gran Premio) il codice della sala: il server prenota il posto per 10 s e risponde con il codice. Se poi la stanza
// risponde "full" (posto preso da qualcun altro nel frattempo: succede solo se molte persone premono "Online" nello stesso
// istante), il gioco non mostra l'errore ma chiede un'altra sala da solo, fino a 3 volte, con una piccola attesa a caso
// (0,2-1 s) perché non ripartano tutti insieme; l'errore resta solo se anche il terzo tentativo fallisce.
// Si crea con PN.sala({ myId, diag }) dal gioco:
//   chiedi(gp)  → Promise di { code, players } (o errore: { status, body } se il server ha risposto, altrimenti l'eccezione);
//                 azzera i tentativi: è la pressione del pulsante
//   riprova(gp) → Promise di { code, players } oppure null se i 3 tentativi sono finiti; da chiamare su "full"
//   tentativi() → quanti nuovi tentativi sono stati fatti dopo l'ultimo "full" (per la diagnosi e le prove)
window.PN = window.PN || {};
PN.sala = ({ myId, diag }) => {
  const TENTATIVI = 3, ATTESA_MIN_MS = 200, ATTESA_MAX_MS = 1000;
  let n = 0;
  const log = m => { if (diag && diag.log) diag.log('rete', m); };
  async function chiama(gp) {
    const res = await fetch('/api/quick?id=' + encodeURIComponent(myId || '') + (gp ? '&gp=1' : ''), { cache: 'no-store' });
    let d = null; try { d = await res.json(); } catch (e) { d = null; }
    if (!res.ok || !d || !d.code) { const err = new Error('quick ' + res.status); err.status = res.status; err.body = d; throw err; }
    return d;
  }
  return {
    chiedi(gp) { n = 0; return chiama(gp); },
    async riprova(gp) {
      if (n >= TENTATIVI) { log('sala piena, tentativi finiti'); return null; }
      n++;
      const attesa = ATTESA_MIN_MS + Math.random() * (ATTESA_MAX_MS - ATTESA_MIN_MS);
      log('sala piena, nuovo tentativo ' + n + ' tra ' + Math.round(attesa) + ' ms');
      await new Promise(r => setTimeout(r, attesa));
      try { return await chiama(gp); } catch (e) { return null; }
    },
    tentativi: () => n
  };
};
