// modulo: missioni
// dipende da: base, lingua
// Missioni (R-243, S-45): 3 obiettivi alla volta, come le missioni di Subway Surfers e gli obiettivi di Alto's Odyssey.
// Valgono in allenamento, nella pista del giorno, nella sfida e nella sala online. Un obiettivo raggiunto vale una stella
// e al suo posto arriva subito un obiettivo nuovo, di un tipo che non c'è già. Le stelle non danno punti (S-45).
// Si salva sul dispositivo (cyf.missioni) e nel profilo con il codice personale (campo "mi", R-226), in forma corta:
// "stelle;codice:avanzamento,…", per esempio "7;flip3:1,porte10:4,km3:1250".
// Si crea con PN.missioni({ say, salvaProfilo }) dal gioco, che poi chiama:
//   evento(tipo, valore) mentre si gioca: 'atterraggio' {flips, gradi, grab, nomi}, 'porta' (serie di porte di fila),
//   'bonus', 'trampolino', 'metri' (metri fatti), 'velocita' (km/h), 'arrivo' {pos, of, daily, cadute};
//   salva() a fine discesa o gara; ricarica() quando il profilo arriva dal server; render() per il menu.
window.PN = window.PN || {};
PN.missioni = ({ say, salvaProfilo }) => {
  const { store } = PN.base;
  const { tr } = PN.lingua;
  const $ = id => document.getElementById(id);
  // codice, tipo, obiettivo. Per spin e velocità conta il migliore in un salto o in una discesa; per serie la serie di porte
  const CATALOGO = [
    ['flip1', 'flip', 1], ['flip3', 'flip', 3], ['flip5', 'flip', 5],
    ['spin360', 'spin', 360], ['spin540', 'spin', 540], ['spin720', 'spin', 720],
    ['grab3', 'grab', 3], ['grab8', 'grab', 8],
    ['combo1', 'combo', 1], ['combo3', 'combo', 3],
    ['porte10', 'porte', 10], ['porte25', 'porte', 25],
    ['serie5', 'serie', 5], ['serie8', 'serie', 8],
    ['bonus20', 'bonus', 20], ['bonus50', 'bonus', 50],
    ['big1', 'big', 1], ['big3', 'big', 3],
    ['km3', 'km', 3000], ['km8', 'km', 8000],
    ['vel70', 'vel', 70], ['vel78', 'vel', 78],
    ['gare1', 'gare', 1], ['gare3', 'gare', 3],
    ['podio1', 'podio', 1], ['giorno1', 'giorno', 1], ['pulita1', 'pulita', 1]
  ];
  const PER_ID = new Map(CATALOGO.map(([id, tipo, n]) => [id, { id, tipo, n }]));
  const MASSIMO = { spin: true, serie: true, vel: true };   // tipi in cui conta il migliore, non la somma
  const RE = /^\d{1,5}(;[a-z]{2,8}\d{1,3}:\d{1,6}(,[a-z]{2,8}\d{1,3}:\d{1,6}){0,2})?$/;   // uguale a MISSIONI_RE del server

  let stelle = 0, attive = [], sporco = false, ultimoScritto = 0;

  function leggi() {
    const s = store.get('cyf.missioni') || '';
    stelle = 0; attive = [];
    if (RE.test(s)) {
      const [st, lista] = s.split(';');
      stelle = +st || 0;
      for (const x of (lista || '').split(',').filter(Boolean)) {
        const [id, p] = x.split(':');
        const m = PER_ID.get(id);
        if (m && !attive.some(a => a.tipo === m.tipo)) attive.push({ ...m, p: Math.min(+p || 0, m.n) });
      }
    }
    let nuove = false;
    while (attive.length < 3) { attive.push(nuova()); nuove = true; }
    if (nuove) scrivi();
  }
  const testo = () => stelle + ';' + attive.map(a => a.id + ':' + Math.round(a.p)).join(',');
  function scrivi() { store.set('cyf.missioni', testo()); sporco = false; ultimoScritto = performance.now(); }
  // un obiettivo nuovo, di un tipo che non c'è già (S-45)
  function nuova() {
    const tipi = new Set(attive.map(a => a.tipo));
    const scelta = CATALOGO.filter(([, tipo]) => !tipi.has(tipo));
    const [id, tipo, n] = scelta[Math.floor(Math.random() * scelta.length)];
    return { id, tipo, n, p: 0 };
  }
  const nome = m => tr('mis_' + m.tipo + (m.n === 1 ? '1' : ''), { n: m.tipo === 'km' ? m.n / 1000 : m.n });

  // avanza le missioni di un tipo: somma (porte, bonus, km…) o migliore (rotazione, serie, velocità)
  function avanza(tipo, v) {
    if (!(v > 0)) return;
    for (let i = 0; i < attive.length; i++) {
      const m = attive[i];
      if (m.tipo !== tipo) continue;
      const p = Math.min(m.n, MASSIMO[tipo] ? Math.max(m.p, v) : m.p + v);
      if (p === m.p) continue;
      m.p = p; sporco = true;
      if (p >= m.n) {
        stelle++;
        say(tr('misDone', { m: nome(m) }), '#c98a00');
        attive[i] = nuova();
        scrivi();
        salvaProfilo();
      }
    }
    // l'avanzamento si scrive sul dispositivo al massimo ogni 2 s (i metri arrivano a ogni fotogramma)
    if (sporco && performance.now() - ultimoScritto > 2000) scrivi();
  }

  function evento(tipo, v) {
    if (tipo === 'atterraggio') {
      avanza('flip', v.flips);
      avanza('spin', v.gradi);
      if (v.grab) avanza('grab', 1);
      if (v.nomi >= 2) avanza('combo', 1);
    } else if (tipo === 'porta') { avanza('porte', 1); avanza('serie', v); }
    else if (tipo === 'bonus') avanza('bonus', 1);
    else if (tipo === 'trampolino') avanza('big', 1);
    else if (tipo === 'metri') avanza('km', v);
    else if (tipo === 'velocita') avanza('vel', Math.floor(v));
    else if (tipo === 'arrivo') {
      avanza('gare', 1);
      if (v.daily) avanza('giorno', 1);
      if (v.of >= 2 && v.pos >= 1 && v.pos <= 3) avanza('podio', 1);
      if (!v.cadute) avanza('pulita', 1);
    }
  }
  // fine discesa o gara: si scrive tutto, anche nel profilo
  function salva() { if (sporco) { scrivi(); salvaProfilo(); } }

  function render() {
    const box = $('misBox');
    if (!box) return;
    $('misTitle').textContent = '🎯 ' + tr('misTitle') + ' · ⭐ ' + stelle;
    const ul = $('misList');
    ul.innerHTML = '';
    for (const m of attive) {
      const li = document.createElement('li');
      const t = document.createElement('span'); t.className = 'mt'; t.textContent = nome(m);
      const q = document.createElement('span'); q.className = 'mq';
      q.textContent = m.tipo === 'km' ? (Math.floor(m.p / 100) / 10).toLocaleString(PN.lingua.lang) + '/' + m.n / 1000 + ' km'
        : m.tipo === 'vel' ? Math.round(m.p) + '/' + m.n + ' km/h' : m.tipo === 'spin' ? Math.round(m.p) + '°/' + m.n + '°' : Math.round(m.p) + '/' + m.n;
      const bar = document.createElement('i'); bar.style.width = Math.round(100 * m.p / m.n) + '%';
      li.append(t, q, bar);
      ul.append(li);
    }
    box.hidden = false;
  }

  leggi();
  return { evento, salva, render, ricarica() { leggi(); render(); }, get stelle() { return stelle; }, get attive() { return attive.map(a => ({ id: a.id, p: a.p, n: a.n })); } };
};
