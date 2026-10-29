// modulo: schermate
// dipende da: base, lingua, protocollo, portale
// Tutto quello che il giocatore legge sullo schermo, fuori dalla scena 3D: schermate (menu, stanza, risultati, pausa),
// avvisi a scomparsa (say), striscione (setBanner), stanza della sfida con link e condivisione, risultati con premi,
// HUD in alto (tempo, posizione, velocità, distanza, punti, vite) e classifica dei migliori tempi del menu.
// Si crea con PN.schermate({ diag, stato }) dal gioco: stato dà lo stato della partita in sola lettura (mode, theme, P,
// myId, net, serverNow, raceLen, bonus, lives, myTotal, racing, distM, score, racePlace, renderLive, amIn, toMenu).
// stato si legge solo quando serve (al clic, a ogni fotogramma): così il modulo si può creare prima della rete.
window.PN = window.PN || {};
PN.schermate = ({ diag, stato: S }) => {
  const { PALETTE, START_ALT, SLOPE, fmt, fmtTime } = PN.base;
  const { tr, ord, fmtLen, cityName } = PN.lingua;
  const $ = id => document.getElementById(id);
  const kmh = v => v * 3.6;
  const selScena = $('selScena');
  // ---------- overlays & HUD ----------
  const OVERLAYS = ['menu', 'lobby', 'raceResults', 'over', 'pause'];
  // cambiando schermata si chiude anche "Modifica il personaggio" (per esempio quando parte la gara)
  function show(id) { for (const o of OVERLAYS) $(o).hidden = o !== id; $('look').hidden = true; diag.log('schermata', id || 'gioco'); }
  const banner = $('banner');
  function setBanner(text) { banner.hidden = !text; banner.textContent = text || ''; if (!text) banner.classList.remove('wait'); }

  function hudLabels() {
    const race = S.racing(), allena = S.allenaConAvversari;   // allenamento con gli avversari: posizione e classifica come in gara (B-05, R-519)
    $('k1').textContent = race ? tr('hudTime') : tr('hudPoints');
    $('k2').textContent = race || allena ? tr('hudPlace') : tr('hudDistance');
    $('kSpeed').textContent = tr('hudSpeed');
    $('k4').textContent = race ? tr('hudLeft') : allena ? tr('hudDistance') : tr('hudAltitude');
    $('k5').textContent = tr('hudPoints');
    $('hLives').hidden = race;
    $('sPts').hidden = !race;
    $('live').hidden = !(race || allena);
    $('items').hidden = !(race || S.allenaConAvversari) || !!S.net.daily;   // pista del giorno: niente banane e bombe (S-40); in allenamento con gli avversari sì (R-515)
  }

  const toasts = $('toasts');
  function say(text, color) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = text; el.style.color = color || '#13233a';
    toasts.appendChild(el);
    setTimeout(() => el.remove(), 1150);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }

  function renderLobby() {
    const pub = S.net.pub;
    $('lobbyShare').hidden = pub;
    $('lobbyPublic').hidden = !pub;
    $('lobbyBrand').textContent = pub ? tr(S.net.gp ? 'gpBrand' : 'onlineBrand') : tr('lobbyBrand');   // sala del Gran Premio (R-247)
    $('lobbyCode').textContent = S.net.code || '—';
    const link = location.origin + location.pathname + '?sfida=' + (S.net.code || '');
    $('linkText').textContent = link;
    // sul portale (R-244) niente link né WhatsApp/Telegram: gli amici entrano con il codice
    const portale = PN.portale.attivo;
    $('linkText').hidden = portale; $('shareWa').hidden = portale; $('shareTg').hidden = portale;
    $('btnCopy').textContent = tr(portale ? 'copyCode' : 'copyLink');
    $('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(tr('shareMsg', { code: S.net.code || '', link }));
    $('shareTg').href = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(tr('shareMsg2', { code: S.net.code || '' }));
    const ul = $('lobbyPlayers');
    ul.innerHTML = '';
    for (const p of S.net.players) {
      const li = document.createElement('li');
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[p.color % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = p.name + (p.id === S.myId ? tr('you') : '');
      li.append(dot, nm);
      if (!pub && p.id === S.net.hostId) { const h = document.createElement('span'); h.className = 'pill host'; h.textContent = tr('host'); li.append(h); }
      const r = document.createElement('span'); r.className = 'pill' + (p.ready ? ' ok' : ''); r.textContent = p.ready ? tr('ready') : tr('waiting');
      li.append(r);
      ul.append(li);
    }
    // avversari del computer scelti da chi organizza (R-237)
    if (!pub && S.net.bots > 0) { const li = document.createElement('li'); const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = tr('botsInRoom', { n: S.net.bots }); li.append(nm); ul.append(li); }
    const isHost = !pub && S.net.hostId === S.myId;
    // durata della gara: la sceglie chi organizza (nelle sale pubbliche è sempre 5 minuti)
    $('durBox').hidden = pub;
    document.querySelectorAll('[data-min]').forEach(b => {
      b.setAttribute('aria-pressed', String(+b.dataset.min === S.net.minutes));
      b.disabled = !isHost;
    });
    $('durLabel').textContent = tr('durationLabel') + (isHost ? '' : ' · ' + tr('durationHost'));
    // quanti avversari del computer aggiungere (R-237): li sceglie chi organizza
    $('botBox').hidden = pub;
    document.querySelectorAll('[data-bots]').forEach(b => { b.setAttribute('aria-pressed', String(+b.dataset.bots === (S.net.bots || 0))); b.disabled = !isHost; });
    $('botLabel').textContent = tr('botsLabel') + (isHost ? '' : ' · ' + tr('durationHost'));
    // città della gara: la sceglie chi organizza; gli altri la vedono e basta
    const rc = $('selRoomCity');
    if (rc.options.length !== selScena.options.length) rc.innerHTML = selScena.innerHTML;
    for (let i = 0; i < rc.options.length; i++) rc.options[i].textContent = selScena.options[i].textContent;
    rc.value = S.net.roomScena || selScena.value;
    rc.disabled = !isHost;
    $('cityLabel').textContent = tr('raceCity') + (isHost ? '' : ' · ' + tr(pub ? 'raceCityPub' : 'raceCityHost'));
    const mine = S.net.players.find(p => p.id === S.myId);
    $('btnReady').textContent = mine && mine.ready ? tr('notReady') : tr('imReady');
    $('btnGo').hidden = !isHost;
    const busy = S.net.phase === 'countdown' || S.net.phase === 'racing';
    $('btnGo').disabled = busy;
    $('btnLeave').textContent = pub ? tr('leaveOnline') : tr('leaveChallenge');
    renderLobbyStatus();
  }
  function renderLobbyStatus() {
    const n = S.net.players.length, ready = S.net.players.filter(p => p.ready).length;
    const busy = S.net.phase === 'countdown' || S.net.phase === 'racing';
    const isHost = !S.net.pub && S.net.hostId === S.myId;
    let status;
    if (!S.net.ws || S.net.ws.readyState !== 1) status = tr('connecting');
    else if (busy && !S.amIn(S.net.racers)) status = tr('raceRunning');
    else if (S.net.pub && S.net.gp === 1 && S.net.autoAt) {
      // Gran Premio (R-247): si aspetta il via delle 21, tutti insieme
      const left = Math.max(0, S.net.autoAt - S.serverNow());
      status = tr('gpWaiting', { h: oraRoma(S.net.autoAt), s: fmtAttesa(left), n });
    }
    else if (S.net.pub) {
      const left = S.net.autoAt ? Math.max(0, Math.ceil((S.net.autoAt - S.serverNow()) / 1000)) : 0;
      status = n < 2 ? (S.net.autoBot && left ? tr('pubBots', { s: left }) : tr('pubWaiting')) : (left ? tr('pubStartsIn', { n, s: left }) : tr('pubStarting', { n }));
    }
    else if (n < 2) status = tr('shareLink');
    else status = tr('lobbyCount', { n, r: ready }) + ' ' + (isHost ? tr('pressGo') : tr('waitHost'));
    $('lobbyStatus').textContent = status;
  }
  // ora italiana "21:00" e attesa "3:12" / "42 s" per il Gran Premio (R-247)
  const oraRoma = at => { try { return new Date(at).toLocaleTimeString(PN.lingua.lang, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }); } catch (e) { return '21:00'; } };
  const fmtAttesa = ms => { const s2 = Math.ceil(ms / 1000); return s2 >= 60 ? Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0') : s2 + ' s'; };
  // il conto alla rovescia delle sale pubbliche si aggiorna da solo
  setInterval(() => {
    if (!S.net.pub) return;
    if (S.mode === 'lobby') renderLobbyStatus();
    else if (S.mode === 'results') renderResultsStatus();
  }, 500);
  document.querySelectorAll('[data-min]').forEach(b => b.addEventListener('click', () => S.net.send({ t: 'settings', minutes: +b.dataset.min })));
  document.querySelectorAll('[data-bots]').forEach(b => b.addEventListener('click', () => S.net.send({ t: 'settings', minutes: S.net.minutes || 5, bots: +b.dataset.bots })));
  $('selRoomCity').addEventListener('change', () => {
    selScena.value = $('selRoomCity').value;
    selScena.dispatchEvent(new Event('change'));
  });
  $('btnReady').addEventListener('click', () => {
    const mine = S.net.players.find(p => p.id === S.myId);
    S.net.send({ t: 'ready', ready: !(mine && mine.ready) });
  });
  $('btnGo').addEventListener('click', () => S.net.send({ t: 'start' }));
  $('btnRematch').addEventListener('click', () => S.net.send({ t: 'start' }));
  $('btnCopy').addEventListener('click', async () => {
    const portale = PN.portale.attivo;
    const link = portale ? (S.net.code || '') : $('linkText').textContent;   // sul portale si copia il codice (R-244)
    try { await navigator.clipboard.writeText(link); $('btnCopy').textContent = tr(portale ? 'codeCopied' : 'linkCopied'); setTimeout(() => ($('btnCopy').textContent = tr(portale ? 'copyCode' : 'copyLink')), 1800); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($(portale ? 'lobbyCode' : 'linkText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('btnCopy').textContent = tr('copyManual'); }
  });
  $('btnLeave').addEventListener('click', () => S.toMenu());
  $('btnResLeave').addEventListener('click', () => S.toMenu());
  // Condividi e 🖼️ Immagine: in moduli/sfida.js (R-236, D-05)
  function renderResults() {
    const G = S.net.daily && S.net.giorno;
    const GP = S.net.gpRes;   // Gran Premio (R-247): la classifica della sera arriva con i risultati
    $('resRound').textContent = G ? tr('dailyTitle', { n: G.n, city: cityName(G.scena) }) + ' · ' + (S.net.minutes || 5) + ' min'
      : S.net.locale ? tr('trainTitle') + ' · ' + cityName(S.net.scena) + ' · ' + tr('raceN', { n: S.net.round || 1 })   // allenamento-gara (R-519)
      : GP ? tr('gpRound', { city: cityName(GP.scena) }) + ' · ' + (S.net.minutes || 5) + ' min'
      : (S.net.pub ? tr('onlineBrand') : tr('challenge') + ' ' + (S.net.code || '')) + ' · ' + tr('raceN', { n: S.net.round || 1 }) + ' · ' + (S.net.minutes || 5) + ' min';
    const ul = $('resList');
    ul.innerHTML = '';
    S.net.results.forEach((r, i) => {
      const li = document.createElement('li');
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = r.ms != null ? (G && S.net.results.length < 2 ? '🏁' : i === 0 ? '🏆' : ord(i + 1)) : '–';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(r.color || 0) % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = r.name + (r.bot ? ' 🤖' : '') + (r.id === S.myId ? tr('you') : '');   // 🤖: avversario del computer (R-234)
      const tm = document.createElement('span'); tm.className = r.ms != null ? 'time' : 'time dnf'; tm.textContent = r.ms != null ? fmtTime(r.ms) : tr('dnf');
      li.append(pos, dot, nm, tm);
      if (r.earned != null) { const e = document.createElement('span'); e.className = 'earned'; e.textContent = '+' + fmt(r.earned); li.append(e); }
      ul.append(li);
    });
    // premi: chi ha toccato la velocità più alta e chi ha fatto più acrobazie
    const aw = $('awards');
    aw.innerHTML = '';
    const award = (label, a, value) => {
      if (!a) return;
      const d = document.createElement('div');
      const k = document.createElement('span'); k.className = 'k'; k.textContent = label;
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(a.color || 0) % PALETTE.length];
      const n = document.createElement('span'); n.textContent = a.name + (a.bot ? ' 🤖' : '') + (a.id === S.myId ? tr('you') : '');
      const v = document.createElement('b'); v.textContent = value; v.style.marginLeft = 'auto';
      d.append(k, dot, n, v);
      aw.append(d);
    };
    const A = S.net.awards || {};
    if (A.fastest && A.fastest.top > 0) award('⚡ ' + tr('awardSpeed'), A.fastest, Math.round(kmh(A.fastest.top)) + ' km/h');
    if (A.tricks && A.tricks.tk > 0) award('🤸 ' + tr('awardTricks'), A.tricks, String(A.tricks.tk));
    aw.hidden = !aw.children.length;
    const mine = S.net.results.find(r => r.id === S.myId);
    $('resMine').hidden = !mine || mine.earned == null;
    if (mine && mine.earned != null) $('resMine').innerHTML = tr('earnedLine', { e: '<span>' + fmt(mine.earned) + '</span>', t: fmt(mine.total ?? S.myTotal) });
    const isHost = !S.net.pub && S.net.hostId === S.myId;
    $('btnRematch').hidden = !isHost && !S.net.daily;   // pista del giorno: Riprova c'è sempre (si è da soli); allenamento: Ricomincia (R-519)
    $('btnRematch').textContent = tr(S.net.daily ? 'dailyRetry' : S.net.locale ? 'trainAgain' : 'rematch');
    renderDayResults(G);
    renderResultsStatus();
    if (S.sfida) S.sfida.risultati();   // "batti il mio tempo": esito della sfida e immagine pronta (R-236)
  }
  // pista del giorno: posizione di oggi e classifica del giorno (R-233); Gran Premio: classifica della sera (R-247)
  function renderDayResults(G) {
    const GP = S.net.gpRes;
    if (!G && GP && S.granpremio) {
      $('resDay').hidden = false;
      const mio = S.granpremio.gp;   // la propria posizione arriva da /api/gp, dopo i risultati
      $('resDayRank').textContent = mio && mio.rank && mio.giorno === GP.giorno ? tr('gpDone', { p: ord(mio.rank), k: mio.of, t: fmtTime(mio.best) }) : tr('gpHint');
      $('resDayBoardBox').hidden = !S.granpremio.risultati($('resDayBoard'), $('resDayTitle'), GP);
      return;
    }
    $('resDayTitle').textContent = tr('dailyBoard');
    $('resDay').hidden = !G;
    if (!G) return;
    // pista di un giorno passato rifatta dal link (R-236): niente classifica
    $('resDayRank').textContent = G.rivincita ? tr('rivalReplay', { n: G.n }) : G.rank ? tr('dailyRank', { p: ord(G.rank), k: G.of, t: fmtTime(G.best) }) : tr('dailyNoTime');
    $('resDayBoardBox').hidden = !!G.rivincita;
    fillDayBoard($('resDayBoard'), G.rivincita ? [] : G.top || []);
  }
  function fillDayBoard(ol, rows) {
    ol.innerHTML = '';
    for (const r of rows.slice(0, 10)) {
      const li = document.createElement('li');
      li.textContent = r.name;
      if (r.me) li.className = 'me';
      const s = document.createElement('span'); s.textContent = fmtTime(r.ms);
      li.append(s);
      ol.append(li);
    }
  }
  function renderResultsStatus() {
    let txt;
    if (S.net.daily) txt = tr('dailyHint');
    else if (S.net.locale) txt = tr('trainHint');   // allenamento-gara (R-519)
    else if (S.net.pub) {
      const left = S.net.autoAt ? Math.max(0, Math.ceil((S.net.autoAt - S.serverNow()) / 1000)) : 0;
      txt = S.net.players.length < 2 ? (S.net.autoBot && left ? tr('pubBots', { s: left }) : tr('pubWaiting')) : (left ? tr('nextRaceIn', { s: left }) : tr('pubStarting', { n: S.net.players.length }));
    } else {
      const isHost = S.net.hostId === S.myId;
      const host = S.net.players.find(p => p.id === S.net.hostId);
      txt = isHost ? tr('rematchHint') : tr('waitRematch', { n: host ? host.name : tr('hostName') });
    }
    $('resStatus').textContent = txt;
  }
  // ---------- HUD ----------
  let hudT = 0, liveT = 1;
  function hud(dt) {
    hudT += dt;
    if (hudT < 0.08) return;
    hudT = 0;
    $('vSpeed').textContent = Math.round(kmh(S.P.speed)) + ' km/h';
    if (S.racing()) {
      const el = S.mode === 'countdown' ? 0 : (S.net.finished.get(S.myId) ?? Math.max(0, S.serverNow() - S.net.startAt));
      $('v1').textContent = fmtTime(el);
      const pl = S.racePlace();
      $('v2').textContent = tr('placeOf', { p: ord(pl.place), n: pl.of });
      $('v4').textContent = fmtLen(Math.max(0, S.raceLen - S.distM()));
      $('v5').textContent = fmt(S.bonus);
      // sempre premibili in gara: senza punti abbastanza sono più chiari e, se premuti, dicono quanti punti servono (R-230)
      for (const [id, k] of [['btnBanana', 'banana'], ['btnBomb', 'bomb'], ['btnBananone', 'bananone']]) { const b = $(id); b.disabled = S.mode !== 'race'; b.classList.toggle('short', S.bonus < PN.protocollo.COSTI[k]); }
      liveT += 0.08;
      if (liveT > 0.25) { liveT = 0; S.renderLive(pl.list); }
    } else {
      if (S.allenaConAvversari) for (const [id, k] of [['btnBanana', 'banana'], ['btnBomb', 'bomb'], ['btnBananone', 'bananone']]) { const b = $(id); b.disabled = S.mode !== 'solo'; b.classList.toggle('short', S.bonus < PN.protocollo.COSTI[k]); }   // R-515
      $('v1').textContent = fmt(S.score());
      if (S.allenaConAvversari) {
        // come in gara: posizione tra gli avversari e classifica dal vivo (B-05, R-519); la distanza va al posto della quota
        const pl = S.racePlace();
        $('v2').textContent = tr('placeOf', { p: ord(pl.place), n: pl.of });
        $('v4').textContent = fmt(Math.floor(S.distM())) + ' m';
        liveT += 0.08;
        if (liveT > 0.25) { liveT = 0; S.renderLive(pl.list); }
      } else {
        $('v2').textContent = fmt(Math.floor(S.distM())) + ' m';
        $('v4').textContent = fmt(Math.max(0, START_ALT - S.distM() * Math.sin(SLOPE))) + ' m';
      }
    }
  }
  function renderLives() {
    const box = $('hLives');
    box.innerHTML = '';
    for (let i = 0; i < 3; i++) { const s = document.createElement('span'); s.className = 'life' + (i >= S.lives ? ' lost' : ''); box.appendChild(s); }
  }

  // ---------- pista del giorno nel menu (R-233): numero, città, il migliore di oggi e il proprio ----------
  let giorno = null;
  function renderDaily() {
    const b = $('btnDaily');
    if (!giorno) { b.hidden = true; if (S.sfida) S.sfida.render(); if (S.settimana) S.settimana.render(); return; }
    b.hidden = false;
    $('dailyName').textContent = '🏁 ' + tr('dailyBtn', { n: giorno.n, city: cityName(giorno.scena) });
    const top = (giorno.top || [])[0];
    let info = top ? tr('dailyBest', { name: top.name, t: fmtTime(top.ms), k: giorno.of }) : tr('dailyNone');
    if (giorno.rank) info = tr('dailyMine', { t: fmtTime(giorno.best), p: ord(giorno.rank), k: giorno.of });
    $('dailyInfo').textContent = info;
    if (S.sfida) S.sfida.render();   // il riquadro "ti sfida" sa ora se la pista del link è di oggi (R-236)
    if (S.settimana) S.settimana.render();   // città della settimana e maglia (R-245)
  }
  async function loadDaily() {
    try {
      const res = await fetch('/api/giorno?id=' + encodeURIComponent(S.myId), { cache: 'no-store' });
      if (!res.ok) throw new Error();
      giorno = await res.json();
    } catch (e) { giorno = null; }
    renderDaily();
  }

  async function loadBoard() {
    loadDaily();
    try {
      const res = await fetch('/api/leaderboard?min=5', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const rows = await res.json();
      const ol = $('board');
      ol.innerHTML = '';
      for (const r of rows.slice(0, 10)) {
        const li = document.createElement('li');
        li.textContent = r.name;
        const s = document.createElement('span'); s.textContent = fmtTime(r.ms);
        li.append(s);
        ol.append(li);
      }
      $('boardBox').hidden = rows.length === 0;
    } catch (e) { $('boardBox').hidden = true; }
  }

  return { show, banner, setBanner, hudLabels, say, renderLobby, renderLobbyStatus, renderResults, renderResultsStatus, hud, renderLives, loadBoard, renderDaily, cityName, get giorno() { return giorno; } };
};
