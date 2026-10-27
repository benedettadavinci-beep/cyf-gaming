// modulo: avversari
// dipende da: base, lingua, rider, pista
// Gli altri giocatori in pista: modello con il nome sopra, posizione interpolata tra un messaggio di rete e l'altro,
// classifica (standings) e classifica dal vivo in alto a destra (renderLive). Anche gli avversari guidati dal software
// (R-234): in pista uguali agli altri, con l'aspetto dal loro codice; un piccolo 🤖 solo in classifica.
// Si crea con PN.avversari({ world, pista, net, stato }) dal gioco: pista è l'istanza di PN.pista; stato dà lo stato
// del gioco in sola lettura (P, mode, racing(), raceLen, isCity(), myId).
window.PN = window.PN || {};
PN.avversari = ({ world, pista, net, stato }) => {
  const { TAU, PALETTE, fmtTime } = PN.base;
  const { tr, ord, fmtLen } = PN.lingua;
  const { jerseyOf, makeRider, bodyTurn, switchOf, lookBot } = PN.rider;
  const { center, hgt } = pista;
  const $ = id => document.getElementById(id);
  // ---------- remote riders ----------
  const remotes = new Map();
  function nameSprite(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 36px "Barlow Condensed", Arial, sans-serif';
    const w = Math.min(250, g.measureText(text).width + 52);
    const x0 = (256 - w) / 2;
    g.fillStyle = 'rgba(12,24,40,0.72)';
    g.beginPath();
    if (g.roundRect) g.roundRect(x0, 8, w, 48, 12); else g.rect(x0, 8, w, 48);
    g.fill();
    g.fillStyle = color; g.beginPath(); g.arc(x0 + 20, 32, 7, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.fillText(text, x0 + 36, 34);
    const t2 = new THREE.CanvasTexture(c); t2.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t2, depthWrite: false, transparent: true }));
    sp.scale.set(2.4, 0.6, 1);
    return sp;
  }
  function remoteFor(id, info, mySlot) {
    if (info && info.bot) info = Object.assign({}, info, lookBot(id));   // aspetto degli avversari del software
    let r = remotes.get(id);
    if (!r) {
      const color = PALETTE[(info.color || 0) % PALETTE.length];
      const model = makeRider(color);
      model.setColor(color, jerseyOf(info.j) ? info.j : '');   // anche le maglie della settimana degli altri (R-245)
      model.setBoard(stato.isCity() ? 'skate' : 'snow');
      const label = nameSprite(info.name || 'Rider', color);
      label.position.y = 2.3;
      model.group.add(label);
      world.add(model.group);
      r = { model, nome: info.name || 'Rider', x: 0, z: 0, y: 0, a: 0, s: 0, tx: 0, tz: 0, ty: 0, ta: 0, v: 0, c: 0, last: 0, has: false };
      remotes.set(id, r);
    }
    r.model.setLook(id, info.h);   // gli stessi capelli che vede lui: scelti (R-225) o a caso dal suo codice (R-220)
    r.model.setGear(info);   // pantaloni, casco e tavola scelti da lui (R-229)
    const slot = net.racers.findIndex(x => x.id === id), n = net.racers.length;
    r.tx = r.x = center(0) + (slot - (n - 1) / 2) * 2.6; r.tz = r.z = 0; r.y = r.ty = 0; r.a = r.ta = 0; r.v = 0; r.has = true;
    r.model.group.visible = true;
    r.ready = (net.ready || []).includes(id);
    return r;
  }
  function remoteUpdate(m) {
    if (!stato.racing()) return;
    const info = net.racers.find(x => x.id === m.id);
    if (!info) return;
    const r = remotes.get(m.id) || remoteFor(m.id, info);
    r.tx = m.x; r.tz = m.z; r.ty = m.y; r.ta = m.a; r.s = m.s; r.f = m.f || 0; r.g = m.g ? 1 : 0; r.v = m.v; r.c = m.c; r.k = m.k || 0; r.last = performance.now(); r.has = true;
    if (m.p != null) { r.p = m.p; r.top = m.top || 0; r.tk = m.tk || 0; }   // punti e statistiche degli avversari del software (servono a chi li guida dopo)
  }
  // avversari del software guidati da questo dispositivo (R-234): posizione esatta, senza aspettare la rete.
  // info serve in allenamento, dove non c'è l'elenco dei concorrenti del server
  function botUpdate(id, m, info) {
    let r = remotes.get(id);
    if (!r) { const inf = info || net.racers.find(x => x.id === id); if (!inf) return; r = remoteFor(id, inf); }
    r.tx = r.x = m.x; r.tz = r.z = m.z; r.ty = r.y = m.y; r.ta = r.a = m.a; r.s = m.s; r.f = m.f; r.g = m.g; r.v = m.v; r.c = m.c; r.k = m.k;
    r.p = m.p; r.top = m.top; r.tk = m.tk; r.last = performance.now(); r.has = true; r.model.group.visible = true;
  }
  function updateRemotes(dt) {
    const now = performance.now();
    for (const [, r] of remotes) {
      if (!r.has || !r.model.group.visible) continue;
      const age = Math.min(0.35, (now - r.last) / 1000);
      const px = r.tx + Math.sin(r.ta) * r.v * age, pz = r.tz - Math.cos(r.ta) * r.v * age;
      const k = Math.min(1, 10 * dt);
      r.x += (px - r.x) * k; r.z += (pz - r.z) * k; r.y += (r.ty - r.y) * k; r.a += (r.ta - r.a) * k;
      const g = r.model.group;
      g.position.set(r.x, hgt(r.x, r.z) + r.y, r.z);
      g.rotation.y = -r.a;
      r.gs = (r.gs || 0) + ((r.g || 0) - (r.gs || 0)) * Math.min(1, 9 * dt);
      bodyTurn(r.model.body, r.c ? (now / 120) % TAU : (r.f || 0), r.s, 0);
      r.ks = (r.ks || 0) + ((r.y > 0.3 ? 0 : (r.k || 0)) - (r.ks || 0)) * Math.min(1, 8 * dt);
      // mano alzata durante l'attesa (R-222) e gesto del lancio della banana (R-224)
      r.hs = (r.hs || 0) + ((r.ready && stato.mode === 'countdown' ? 1 : 0) - (r.hs || 0)) * Math.min(1, 8 * dt);
      if (r.thrT > 0) { r.thrT += dt / 0.55; if (r.thrT >= 1) r.thrT = 0; }
      r.model.pose(Math.min(1, 0.35 + r.gs * 0.45 + Math.max(0, r.ks) * 0.55), r.y > 0.3 ? 1 : 0.3, 0, r.gs, Math.max(0, -r.ks), switchOf(r.s || 0), r.hs, r.thrT || 0);
    }
  }
  // chi ha premuto "Sono pronto" (elenco di codici dal server)
  function setReady(list) { for (const [id, r] of remotes) r.ready = list.includes(id); }
  function playThrow(id) { const r = remotes.get(id); if (r) r.thrT = 0.001; }
  function hideRemotes() { for (const [, r] of remotes) r.model.group.visible = false; }
  function removeRemote(id) { const r = remotes.get(id); if (r) { world.remove(r.model.group); remotes.delete(id); } }
  function clearRemotes() { for (const id of [...remotes.keys()]) removeRemote(id); }

  function standings() {
    const { myId, P } = stato;
    const list = net.racers.map(r => {
      const rm = r.id === myId ? null : remotes.get(r.id);
      return { id: r.id, name: r.name, bot: !!r.bot, color: r.id === myId ? net.myColor : r.color, d: r.id === myId ? -P.z : (rm ? -rm.tz : 0), ms: net.finished.get(r.id) };
    });
    list.sort((a, b) => {
      const fa = a.ms != null, fb = b.ms != null;
      if (fa && fb) return a.ms - b.ms;
      if (fa !== fb) return fa ? -1 : 1;
      return b.d - a.d;
    });
    return list;
  }
  function racePlace() {
    const list = standings(), myId = stato.myId;
    return { place: list.findIndex(x => x.id === myId) + 1, of: list.length, list };
  }
  // classifica dal vivo in alto a destra: posizione, nome e distacco dal primo (o il tempo, per chi è arrivato)
  function renderLive(list) {
    const { myId, raceLen } = stato;
    const ol = $('liveList');
    ol.innerHTML = '';
    const lead = list.find(x => x.ms == null);
    const leadD = list.length ? (list[0].ms != null ? raceLen : list[0].d) : 0;
    list.slice(0, 8).forEach((r, i) => {
      const li = document.createElement('li');
      if (r.id === myId) li.className = 'me';
      const pos = document.createElement('span'); pos.textContent = ord(i + 1);
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = PALETTE[(r.color || 0) % PALETTE.length];
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name + (r.bot ? ' 🤖' : '') + (r.id === myId ? tr('you') : '');
      const gap = document.createElement('span'); gap.className = 'gap';
      gap.textContent = r.ms != null ? fmtTime(r.ms) : (i === 0 ? fmtLen(Math.max(0, raceLen - r.d)) : '−' + fmtLen(Math.max(0, leadD - r.d)));
      li.append(pos, dot, nm, gap);
      ol.append(li);
    });
    $('liveTitle').textContent = tr('liveTitle');
    void lead;
  }
  return { remotes, nameSprite, remoteFor, remoteUpdate, botUpdate, updateRemotes, setReady, playThrow, hideRemotes, removeRemote, clearRemotes, standings, racePlace, renderLive };
};
