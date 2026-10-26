// modulo: bot
// dipende da: base, protocollo, tracciato, lingua, fisica, pista, oggetti, avversari
// Avversari guidati dal software (R-234…R-239, S-39): giocatori come gli altri, che però guida il gioco. Stessa fisica del
// rider (velocità massima, curve, salti, rampe, cadute), stessi ostacoli (li conoscono dal tracciato, anche lontano dal
// giocatore), acrobazie con i punti, banane, bombe e bananoni in gara. Livelli misti: forte, medio, lento.
// In gara li guida un solo dispositivo, il "pilota" scelto dal server (net.pilota): manda le loro posizioni come quelle di
// un giocatore; gli altri li vedono come avversari normali. In allenamento li guida il proprio dispositivo.
// Le regole del movimento sono quelle di moduli/fisica.js, le stesse del rider (A-19).
// Si crea con PN.bot({ pista, rampTop, net, stato, oggetti, avversari, say, crash }) dal gioco.
window.PN = window.PN || {};
PN.bot = ({ pista, rampTop, net, stato, oggetti, avversari, say, crash }) => {
  const F = PN.fisica, RAMP_FOOT = F.RAMP_FOOT;
  const { TAU, clamp, mulberry32 } = PN.base;
  const { tr } = PN.lingua;
  const { COSTI, FERMO, NOMI_BOT } = PN.protocollo;
  const { center, hgt } = pista;

  // ---------- livelli (S-39): velocità rispetto al massimo, ostacoli visti, prudenza, rampe, acrobazie, atterraggi ----------
  // v: frazione della velocità massima (le persone in posizione raccolta arrivano a 1,12); vede: quota di ostacoli che
  // vede in tempo; margine: metri in più di distanza dagli ostacoli; ogni: secondi tra una decisione e l'altra;
  // rampe e porte: quante ne cerca; trucco: quanto spesso fa un'acrobazia; atterra: atterraggi riusciti; oggetti: banane e bombe
  const LIV = {
    forte: { v: 1.03, vede: 0.97, margine: 0.9, ogni: 0.14, rampe: 0.12, porte: 0.2, trucco: 0.9, atterra: 0.97, oggetti: 1.0 },
    medio: { v: 0.85, vede: 0.9, margine: 0.5, ogni: 0.2, rampe: 0.08, porte: 0.12, trucco: 0.7, atterra: 0.93, oggetti: 0.75 },
    lento: { v: 0.75, vede: 0.84, margine: 0.35, ogni: 0.28, rampe: 0.05, porte: 0.06, trucco: 0.5, atterra: 0.88, oggetti: 0.5 }
  };
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

  function crea(d) {
    const L = LIV[d.liv] || LIV.medio, rnd = mulberry32(hash(d.id));
    const z = d.z || 0, x = d.x != null ? d.x : center(z);
    const b = {
      id: d.id, nome: d.nome, liv: LIV[d.liv] ? d.liv : 'medio', L, rnd, quota: rnd(),
      x, z, y: d.y || 0, prevZ: z, ang: d.a || 0, speed: d.v || 0, vy: 0, air: false, spin: 0, spin0: 0, flip: 0, grab: 0, grabT: 0, airT: 0,
      crash: 0, stopUntil: 0, inv: 0, onRamp: null, ramp: false, rampe: new Set(), presi: new Set(), porte: new Set(),
      bonus: d.p || 0, top: d.top || 0, tk: d.tk || 0, combo: 0, k: 0,
      frenaT: 0, meta: x - center(z), pref: (rnd() - 0.5) * 10, prefT: 2 + rnd() * 4, pianoT: 0, salto: null, trucco: null,
      oggT: 8 + rnd() * 10, arrivato: !!d.arrivato
    };
    return b;
  }

  // ---------- un passo di simulazione (come update() del gioco per il rider) ----------
  // amb: { dati (tracciato), ora, gara, fermi (conto alla rovescia), lunghezza, oggetti (banane e bombe permesse),
  //        rivali() → [{ id, x, z }], pericoli (banane e bombe in pista), vicino: { z } in allenamento }
  // Restituisce gli eventi: arrivo, lancio, posa, pestato.
  function passo(b, dt, amb) {
    const ev = [];
    if (amb.fermi) { b.speed = 0; return ev; }
    const d = Math.max(0, -b.z);
    const vmax = F.vmax(d);
    if (b.inv > 0) b.inv -= dt;
    if (b.stopUntil > amb.ora) { b.speed = 0; if (b.crash > 0) b.crash -= dt; }   // fermo dopo una banana o una bomba
    else if (b.crash > 0) { b.crash -= dt; b.speed = Math.max(2, b.speed - 14 * dt); }
    else if (!b.air) {
      let steer;
      if (b.arrivato) steer = clamp((center(b.z - 10) - b.x) * 0.15, -0.5, 0.5);
      else { pianifica(b, dt, amb); steer = guida(b); }
      b.ang += steer * F.STERZO * dt;
      b.ang = clamp(b.ang, -F.ANGOLO, F.ANGOLO);
      const ax = b.x + Math.sin(b.ang) * 2, az = b.z - Math.cos(b.ang) * 2;
      const drop = hgt(b.x, b.z) - hgt(ax, az);
      let target = F.obiettivo(vmax * b.L.v, b.ang, drop);
      // allenamento: niente traguardo, gli avversari restano nei paraggi (R-239): dietro accelerano, davanti rallentano
      if (amb.vicino) target *= clamp(1 + (b.z - amb.vicino.z) * 0.0016, 0.75, 1.2);
      if (b.frenaT > 0) { b.frenaT -= dt; target *= 0.5; }
      if (b.arrivato) target = 0;
      b.speed += (target - b.speed) * (target > b.speed ? 0.75 : (b.arrivato ? 0.9 : 1.3)) * dt;
      b.speed = F.limita(b.speed);
      b.k = b.arrivato || b.frenaT > 0 ? -0.6 : (Math.abs(b.ang) < 0.35 && b.speed > 9 ? 0.8 : 0);   // posizione raccolta o frenata (si vede)
      // roccia da saltare: si stacca poco prima, come farebbe una persona premendo Salta
      if (b.salto && !b.onRamp && b.z - b.salto.z < Math.max(2.2, b.speed * 0.3) && b.z > b.salto.z) { b.salto = null; salta(b); }
    } else {
      inAria(b, dt);
      if (b.y <= 0) { b.onRamp = null; atterra(b); }
    }

    const g0 = hgt(b.x, b.z);
    b.prevZ = b.z;
    b.x += Math.sin(b.ang) * b.speed * dt;
    b.z -= Math.cos(b.ang) * b.speed * dt;
    const g1 = hgt(b.x, b.z);
    if (!b.air && !b.onRamp && b.crash <= 0) {
      if ((g0 - g1) / Math.max(dt, 1e-4) > 3.2 && b.speed > 16) { b.air = true; b.vy = 0; b.y = g0 - g1; b.ramp = false; inizioAria(b); }
    } else if (b.air) b.y += g0 - g1;
    // restano dentro la strada (paline e palazzi)
    const c = center(b.z), off = b.x - c;
    if (Math.abs(off) > 18) { b.x = c + Math.sign(off) * 18; if (Math.sign(b.ang) === Math.sign(off)) b.ang = -b.ang * 0.4; }
    b.top = Math.max(b.top, b.speed);

    if (b.onRamp && !b.air) {
      const r = b.onRamp, k = r.big ? 2 : 1;
      b.y = rampTop(r, b.z) + hgt(r.x, r.z) - hgt(b.x, b.z);
      if (Math.abs(b.x - r.x) > 1.7 * k) { b.onRamp = null; b.air = true; b.vy = 0; inizioAria(b); }
      else if (b.z <= r.z - 2 * k) {
        b.onRamp = null; b.air = true; b.vy = r.big ? F.TRAMPOLINO : F.RAMPA; b.spin = b.spin % TAU; b.ramp = true; inizioAria(b);
        b.speed = F.stacco(b.speed);
        scegliTrucco(b);
      }
    }
    tocca(b, amb);
    if (amb.oggetti && !b.arrivato) { pericoli(b, amb, ev); usaOggetti(b, dt, amb, ev); }
    if (amb.gara && !b.arrivato && -b.z >= amb.lunghezza) { b.arrivato = true; ev.push({ t: 'arrivo' }); }
    return ev;
  }

  // quali ostacoli vede in tempo questo avversario (sempre gli stessi per lui: niente memoria da tenere)
  const vede = (b, o) => ((o.k + b.quota) % 1) < b.L.vede;
  // ogni tanto sceglie la "corsia" (distanza dal centro): per ogni corsia possibile prova 2,2 s di guida con lo stesso
  // sterzo che userà davvero (rampe e salti compresi) e conta gli ostacoli che prenderebbe, le porte e i bonus
  function pianifica(b, dt, amb) {
    b.prefT -= dt;
    if (b.prefT <= 0) { b.prefT = 3 + b.rnd() * 5; b.pref = clamp(b.pref + (b.rnd() - 0.5) * 8, -9, 9); }
    b.pianoT -= dt;
    if (b.pianoT > 0) return;
    b.pianoT = b.L.ogni * (0.7 + b.rnd() * 0.6);
    const v = Math.max(10, b.speed), far = v * 2.3 + 12;
    const list = amb.dati.vicini(b.z - 0.5, b.z - far).filter(o => vede(b, o)).sort((p, q) => q.z - p.z);
    const haz = [];
    if (amb.pericoli) for (const [, h] of amb.pericoli) if (h.armed && !h.chase && h.owner !== b.id && h.z < b.z - 0.5 && h.z > b.z - far && ((h.x * 7.3 + h.z * 3.1) % 1 + 1) % 1 < b.L.vede) haz.push(h);
    const cur = b.x - center(b.z);
    const scegli = vv => {
      let best = null;
      // si parte dalla corsia di adesso: di solito è buona, e le altre si scartano appena sono peggio
      const ordine = [];
      for (let off = -15; off <= 15; off += 1.5) ordine.push(off);   // una corsia ogni 1,5 m: 21 prove
      ordine.sort((p, q) => Math.abs(p - b.meta) - Math.abs(q - b.meta));
      for (const off of ordine) {
        const extra = Math.abs(off - cur) * 0.1 + Math.abs(off - b.pref) * 0.04 + Math.abs(off - b.meta) * 0.05 + Math.max(0, Math.abs(off) - 12) * 0.6;
        const r = prova(b, off, vv, list, haz, best ? best.costo - extra : Infinity);
        r.costo += extra;
        if (!best || r.costo < best.costo) best = { off, ...r };
      }
      return best;
    };
    let best = scegli(v);
    // nessuna corsia libera: frena (come una persona con la freccia su) e riprova più piano
    if (best.costo >= 90 && v > 8) { const piano = scegli(v * 0.55); if (piano.costo < best.costo - 50) { best = piano; b.frenaT = 0.6; } }
    b.meta = best.off;
    b.salto = best.roccia ? { z: best.roccia.z } : null;
  }
  // 2,2 s di guida simulata verso la corsia off, a passi di 0,05 s (abbastanza per vedere dove si atterra dopo una rampa)
  // limite: oltre questo costo la corsia è già peggio della migliore trovata e si smette (i premi valgono al massimo una ventina di punti)
  function prova(b, off, v, list, haz, limite) {
    const M = b.L.margine, dtp = 0.05, porte = new Set();
    let i0 = 0;   // gli oggetti sono in ordine di quota: si guardano solo quelli appena superati
    let x = b.x, z = b.z, ang = b.ang, y = b.y, vy = b.vy, air = b.air, costo = 0, roccia = null, tj = -9, rampa = b.onRamp;
    // altezza del salto deciso per una roccia: si stacca 0,28 s prima di arrivarci, con la stessa spinta di Salta
    const yJ = t => { const u = t - tj; return u > 0 && u < 0.64 ? 6.4 * u - 10 * u * u : 0; };
    for (let t = 0; t < 2.2; t += dtp) {
      if (!air) {
        const L = clamp(v * 0.45, 6, 18), tx = center(z - L) + off;
        const steer = clamp((clamp(Math.atan2(tx - x, L), -1, 1) - ang) * 3.5, -1, 1);
        ang = clamp(ang + steer * 2.4 * dtp, -1.25, 1.25);
      }
      const x0 = x, z0 = z;
      x += Math.sin(ang) * v * dtp; z -= Math.cos(ang) * v * dtp;
      if (air) { vy -= 20 * dtp; y += vy * dtp; if (y <= 0) { air = false; y = 0; vy = 0; } }
      // sulla rampa già imboccata: si stacca alla fine e si vola senza poter curvare
      if (rampa && !air && z <= rampa.z - 2 * (rampa.big ? 2 : 1)) { air = true; y = 1.35 * (rampa.big ? 2 : 1); vy = rampa.big ? 13.5 : 8.6; rampa = null; }
      const xAt = oz => x0 + (x - x0) * ((z0 - oz) / Math.max(1e-3, z0 - z));
      for (; i0 < list.length && list[i0].z > z; i0++) {
        const o = list[i0];
        const dx = Math.abs(o.x - xAt(o.z)), yy = Math.max(y, yJ(t));
        if (o.type === 'tree') { if (dx < 0.8 * o.s + 0.6 + M && yy < 5.5 * o.s) costo += 100; }
        else if (o.type === 'rock') {
          if (dx < 1.1 * o.s + 0.5 + M * 0.6 && yy < 0.8 * o.s) {
            // la si può saltare se c'è ancora il tempo di staccare (o se il salto era già deciso)
            const deciso = b.salto && b.salto.z === o.z;
            if (!air && (deciso || b.z - o.z > b.speed * 0.3) && !roccia) { roccia = o; costo += deciso ? 2 : 12; tj = t - 0.3; }
            else costo += 100;
          }
        } else if (o.type === 'gate') {
          if (yy < 1.7 && (Math.abs(xAt(o.z) - (o.x - o.half)) < 0.6 + M * 0.5 || Math.abs(xAt(o.z) - (o.x + o.half)) < 0.6 + M * 0.5)) costo += 100;
          else if (!b.porte.has(o.n) && !porte.has(o.n) && dx < o.half - 0.5 && ((o.k * 5.3 + b.quota) % 1) < b.L.porte) { porte.add(o.n); costo -= 2; }
        } else if (o.type === 'ramp') {
          const k = o.big ? 2 : 1;
          if (!air && yy === 0 && !b.rampe.has(o.n) && dx < 1.5 * k) {
            // sulla rampa: si stacca e si vola, senza poter curvare (come il giocatore)
            if (dx > 1.0 * k) costo += 4;   // preso di striscio: si cade di lato
            costo += ((o.k * 3.7 + b.quota) % 1) < b.L.rampe ? -4 * k : 4;
            air = true; y = 1.35 * k; vy = o.big ? 13.5 : 8.6;
          }
        } else if (o.type === 'gem') { if (!b.presi.has(o.n) && dx < 0.7 && yy < 2.2) costo -= 0.3; }
      }
      if (costo > limite + 20) return { costo, roccia };
      for (const h of haz) {
        if (h.z > z0 || h.z <= z) continue;
        const r0 = h.kind === 'bomb' ? 2.4 : h.kind === 'bananone' ? 2 : 1;
        if (Math.abs(h.x - xAt(h.z)) < r0 + 0.5 + M * 0.5 && Math.max(y, yJ(t)) < 1.2) costo += 60;
      }
    }
    return { costo, roccia };
  }
  // sterzo verso la corsia scelta, guardando un po' avanti
  function guida(b) {
    const L = clamp(b.speed * 0.45, 6, 18);
    const tx = center(b.z - L) + b.meta;
    const want = clamp(Math.atan2(tx - b.x, L), -1.0, 1.0);
    return clamp((want - b.ang) * 3.5, -1, 1);
  }
  function inizioAria(b) { b.flip = 0; b.grab = 0; b.grabT = 0; b.airT = 0; b.spin0 = b.spin; b.trucco = null; }
  function salta(b) { b.onRamp = null; b.air = true; b.vy = F.SALTO; b.ramp = false; inizioAria(b); }
  // acrobazia scelta allo stacco dalla rampa, secondo il tempo in aria e il livello
  function scegliTrucco(b) {
    const T = (b.vy + Math.sqrt(b.vy * b.vy + 40 * Math.max(0, b.y))) / 20;
    const L = b.L, utile = T - 0.3;
    if (b.rnd() > L.trucco || utile < 0.3) { b.trucco = { spin: 0, flip: 0, grab: b.rnd() < 0.6, sbaglia: false }; return; }
    let flip = 0;
    if (utile > 0.8 && b.rnd() < (b.liv === 'forte' ? 0.55 : b.liv === 'medio' ? 0.3 : 0.12)) flip = b.rnd() < 0.5 ? TAU : -TAU;
    const maxHalf = Math.floor(utile / 0.36);
    let half = Math.min(maxHalf, 1 + Math.floor(b.rnd() * (b.liv === 'forte' ? 3 : b.liv === 'medio' ? 2 : 1.4)));
    if (flip) half = Math.min(half, Math.max(0, Math.floor((utile - 0.75) / 0.36)));
    const dir = b.rnd() < 0.5 ? 1 : -1;
    b.trucco = { spin: half * Math.PI * dir, flip, grab: !flip && !half, sbaglia: b.rnd() > L.atterra };
  }
  function inAria(b, dt) {
    b.airT += dt;
    const T = b.trucco;
    if (T) {
      // chi sbaglia si ferma a metà rotazione: atterra storto e cade
      const tS = b.spin0 + (T.sbaglia && T.spin ? T.spin - Math.sign(T.spin) * 1.4 : T.spin);
      const tF = T.sbaglia && T.flip && !T.spin ? T.flip - Math.sign(T.flip) * 1.6 : T.flip;
      b.spin += clamp(tS - b.spin, -9 * dt, 9 * dt);
      b.flip += clamp(tF - b.flip, -8.5 * dt, 8.5 * dt);
      const wantGrab = T.grab && b.airT > 0.18 && b.vy > -9;
      b.grab += ((wantGrab ? 1 : 0) - b.grab) * Math.min(1, 9 * dt);
      if (b.grab > 0.8) b.grabT += dt;
    }
    b.vy -= F.GRAVITA * dt;
    b.y += b.vy * dt;
    // atterraggio assistito, come per il giocatore: poco prima di toccare terra si raddrizza (non chi ha deciso di sbagliare)
    const tg = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 40 * Math.max(0, b.y)))) / 20;
    if (b.vy < 0 && tg < 0.3 && !(T && T.sbaglia)) {
      b.spin += clamp(nearest(b.spin, Math.PI) - b.spin, -7 * dt, 7 * dt);
      b.flip += clamp(nearest(b.flip, TAU) - b.flip, -9 * dt, 9 * dt);
    }
  }
  const nearest = F.nearest;
  // atterraggio con i punti: stesse regole del giocatore (moduli/fisica.js)
  function atterra(b) {
    b.y = 0; b.vy = 0; b.air = false;
    const A = F.atterraggio({ spin: b.spin, spin0: b.spin0, flip: b.flip, grabT: b.grabT, ramp: b.ramp });
    b.grab = 0; b.trucco = null;
    if (A.cade) { b.spin = 0; b.flip = 0; cade(b, 0); return; }
    if (A.sloppy) b.speed *= 0.75;
    if (A.nomi.length) { b.tk += A.nomi.length; b.bonus += A.pts; }
    b.spin = F.switchDopo(b.spin);
    b.flip = 0;
  }
  // caduta (ostacolo, atterraggio storto) o colpo (stop: secondi da fermo, R-223, R-224, R-231)
  function cade(b, stop) {
    if (b.inv > 0 || b.crash > 0) return false;
    b.crash = F.CADUTA; b.inv = F.invuln(stop); b.stopUntil = stop ? performance.now() + stop * 1000 : 0;
    b.speed *= 0.3; b.air = false; b.y = 0; b.vy = 0; b.spin = 0; b.flip = 0; b.grab = 0; b.onRamp = null; b.combo = 0; b.trucco = null; b.salto = null;
    return true;
  }
  // ostacoli, rampe, bonus e porte toccati (come collide() del gioco)
  function tocca(b, amb) {
    if (b.crash > 0) return;
    for (const o of amb.dati.vicini(b.z + 6, b.z - 7)) {
      const dz = o.z - b.z, dx = o.x - b.x, d2 = dx * dx + dz * dz;
      if (o.type === 'tree') { if (b.y < 5.5 * o.s && d2 < (0.8 * o.s) ** 2) cade(b, 0); }
      else if (o.type === 'rock') { if (b.y < 0.75 * o.s && d2 < (1.1 * o.s) ** 2) cade(b, 0); }
      else if (o.type === 'ramp') {
        const k = o.big ? 2 : 1;
        if (!b.rampe.has(o.n) && !b.air && Math.abs(dx) < 1.5 * k && b.z < o.z + RAMP_FOOT * k + 0.9 && b.z > o.z - 1.2 * k) {
          b.rampe.add(o.n); b.onRamp = o; b.y = Math.max(b.y, rampTop(o, b.z) + hgt(o.x, o.z) - hgt(b.x, b.z));
        }
      } else if (o.type === 'gem') { if (!b.presi.has(o.n) && b.y < 2.2 && d2 < 0.95 * 0.95) { b.presi.add(o.n); b.bonus += 10; } }
      else if (o.type === 'gate') {
        const left = o.x - o.half, right = o.x + o.half;
        if (b.y < 1.7 && Math.abs(dz) < 0.25 && (Math.abs(b.x - left) < 0.2 || Math.abs(b.x - right) < 0.2)) cade(b, 0);
        if (!b.porte.has(o.n) && b.prevZ > o.z && b.z <= o.z) {
          b.porte.add(o.n);
          if (b.x > left && b.x < right) { b.combo++; b.bonus += 50 * b.combo; } else b.combo = 0;
        }
      }
      if (b.crash > 0) return;
    }
    for (const s of [b.rampe, b.presi, b.porte]) if (s.size > 300) { const keep = [...s].slice(-100); s.clear(); for (const n of keep) s.add(n); }
  }
  // banane e bombe in pista: chi ci passa sopra cade (come collideHazards() degli oggetti)
  function pericoli(b, amb, ev) {
    if (b.inv > 0 || b.crash > 0 || !amb.pericoli) return;
    for (const [hid, h] of amb.pericoli) {
      if (!h.armed || h.chase || h.owner === b.id) continue;
      const dx = h.x - b.x, dz = h.z - b.z, d2 = dx * dx + dz * dz;
      const hit = h.kind === 'bomb' ? (d2 < 2.4 * 2.4 && b.y < 1.6) : h.kind === 'bananone' ? (d2 < 2.0 * 2.0 && b.y < 1.2) : (d2 < 1.0 && b.y < 0.7);
      if (!hit) continue;
      if (cade(b, FERMO[h.kind] || FERMO.banana)) ev.push({ t: 'pestato', hid, owner: h.owner, kind: h.kind });
      return;
    }
  }
  // in gara usano i punti come le persone: banana o bananone a chi sta davanti, bomba se qualcuno è vicino dietro
  function usaOggetti(b, dt, amb, ev) {
    b.oggT -= dt;
    if (b.oggT > 0 || b.crash > 0 || b.stopUntil > amb.ora || b.air) return;
    b.oggT = 1;
    const L = b.L, r = b.rnd;
    let davanti = null, dietro = null;
    for (const q of amb.rivali()) {
      if (q.id === b.id) continue;
      const dd = b.z - q.z;
      if (dd > 2 && (!davanti || dd < b.z - davanti.z)) davanti = q;
      if (dd < -3 && dd > -45 && (!dietro || dd > b.z - dietro.z)) dietro = q;
    }
    let e = null;
    if (davanti && b.bonus >= COSTI.bananone && r() < 0.5 * L.oggetti) e = { t: 'lancio', kind: 'bananone', bersaglio: davanti.id };
    else if (davanti && b.bonus >= COSTI.banana && b.z - davanti.z < 300 && r() < 0.15 * L.oggetti) e = { t: 'lancio', kind: 'banana', bersaglio: davanti.id };
    else if (dietro && b.bonus >= COSTI.bomb && r() < 0.12 * L.oggetti) e = { t: 'posa', kind: 'bomb', x: b.x - Math.sin(b.ang) * 3, z: b.z + Math.cos(b.ang) * 3 };
    if (!e) return;
    b.bonus -= COSTI[e.kind];
    b.oggT = 18 + r() * 22;
    ev.push(e);
  }
  // quello che si manda agli altri (come il messaggio "pos" di un giocatore)
  const statoDi = b => ({
    id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(2), a: +b.ang.toFixed(3), s: +b.spin.toFixed(2), f: +b.flip.toFixed(2),
    g: b.grab > 0.5 ? 1 : 0, v: +b.speed.toFixed(2), c: b.crash > 0 ? 1 : 0, k: b.k, top: +b.top.toFixed(1), tk: b.tk, p: Math.max(0, Math.round(b.bonus))
  });

  // ---------- gestione: allenamento e gara ----------
  let lista = [], dati = null, modo = null, hn = 0;
  const LIVELLI = ['forte', 'medio', 'lento', 'medio'];
  function ferma() { lista = []; dati = null; modo = null; }
  // allenamento (R-239): 3 avversari partono accanto al rider, con nomi e aspetto a caso
  function allenamento(seme) {
    ferma();
    modo = 'allenamento';
    dati = PN.tracciato.dati(seme, { center, gara: false });
    const P = stato.P, nomi = [...NOMI_BOT].sort(() => Math.random() - 0.5), tag = Math.random().toString(36).slice(2, 7);
    [-2.6, 2.6, 5.2].forEach((dx, i) => {
      const id = 'bot-' + tag + i, info = { id, name: nomi[i], color: i + 1, bot: 1 };
      lista.push(crea({ id, nome: info.name, liv: LIVELLI[i], x: P.x + dx, z: P.z - 1 - i, v: P.speed }));
      avversari.botUpdate(id, statoDi(lista[i]), info);
    });
  }
  // gara: solo il pilota li guida. Se lo diventa a gara avviata (chi guidava è uscito) riparte da dove erano
  function gara() {
    ferma();
    if (net.pilota !== stato.myId) return;
    const racers = net.racers, n = racers.length;
    modo = 'gara';
    dati = PN.tracciato.dati(net.seed, { center, gara: true, lunghezza: stato.raceLen });
    racers.forEach((r, slot) => {
      if (!r.bot) return;
      const rm = avversari.remotes.get(r.id), da = rm && rm.has && rm.tz < -0.5 ? rm : null;
      lista.push(crea({
        id: r.id, nome: r.name, liv: r.lv,
        x: da ? da.tx : center(0) + (slot - (n - 1) / 2) * 2.6, z: da ? da.tz : 0, a: da ? da.ta : 0, v: da ? da.v : 0,
        p: da ? da.p : 0, top: da ? da.top : 0, tk: da ? da.tk : 0, arrivato: net.finished.has(r.id)
      }));
    });
  }
  function rivali() {
    const out = [], P = stato.P;
    if (!net.finished.has(stato.myId)) out.push({ id: stato.myId, x: P.x, z: P.z });
    for (const [id, r] of avversari.remotes) if (r.has && r.model.group.visible && !net.finished.has(id) && !lista.some(b => b.id === id)) out.push({ id, x: r.tx, z: r.tz });
    for (const b of lista) if (!b.arrivato) out.push({ id: b.id, x: b.x, z: b.z });
    return out;
  }
  // un fotogramma: si muovono tutti, poi si mostrano (senza aspettare la rete)
  function aggiorna(dt) {
    if (!modo || !lista.length) return;
    const inGara = modo === 'gara';
    if (inGara && net.pilota !== stato.myId) { ferma(); return; }
    let zMin = Infinity, zMax = -Infinity;
    for (const b of lista) { zMin = Math.min(zMin, b.z); zMax = Math.max(zMax, b.z); }
    dati.avanza(zMin - 260);
    dati.dimentica(zMax + 20);
    const amb = {
      dati, ora: performance.now(), gara: inGara, fermi: inGara && stato.mode === 'countdown', lunghezza: stato.raceLen,
      oggetti: inGara && !net.daily, rivali, pericoli: oggetti.hazards, vicino: inGara ? null : { z: stato.P.z }
    };
    for (const b of lista) {
      for (const e of passo(b, dt, amb)) evento(b, e);
      avversari.botUpdate(b.id, statoDi(b), inGara ? null : { id: b.id, name: b.nome, color: 1 + lista.indexOf(b), bot: 1 });
    }
  }
  function evento(b, e) {
    if (e.t === 'arrivo') { net.send({ t: 'botfinish', id: b.id, top: +b.top.toFixed(1), tk: b.tk, p: Math.max(0, Math.round(b.bonus)) }); return; }
    const hid = b.id + '-' + net.round + '-' + (++hn);
    if (e.t === 'lancio') {
      net.send({ t: 'throw', target: e.bersaglio, hid, kind: e.kind, as: b.id });
      avversari.playThrow(b.id);
      oggetti.showThrow(b.id, e.bersaglio, hid, e.kind);
      colpo(e.bersaglio, e.kind, b.nome);
    } else if (e.t === 'posa') {
      oggetti.addHazard({ hid, owner: b.id, kind: e.kind, x: e.x, z: e.z });
      net.send({ t: 'drop', kind: e.kind, x: +e.x.toFixed(2), z: +e.z.toFixed(2), hid, as: b.id });
    } else if (e.t === 'pestato') {
      oggetti.removeHazard(e.hid);
      net.send({ t: 'hit', hid: e.hid, owner: e.owner, kind: e.kind, as: b.id });
      if (e.owner === stato.myId) say(tr(e.kind === 'bomb' ? 'hitYourBomb' : e.kind === 'bananone' ? 'hitYourBananone' : 'hitYourBanana', { n: b.nome }), '#ff5a1f');
    }
  }
  // banana o bananone lanciati (da un avversario del software o da una persona): chi è colpito si ferma dopo il volo.
  // Regola R-241: chi in quel momento è in aria (salto, rampa, trampolino) non viene colpito, persone e avversari
  function colpo(bersaglio, kind, chi) {
    const big = kind === 'bananone';
    setTimeout(() => {
      if (!stato.racing()) return;
      if (bersaglio === stato.myId) {
        if (stato.P.air) { say(tr('dodgedAir'), '#1f8a4c'); return; }
        crash(tr(big ? 'crashBananoneThrown' : 'crashBananaThrown', { n: chi || tr('someone') }), FERMO[big ? 'bananone' : 'banana']);
        return;
      }
      const b = lista.find(x => x.id === bersaglio);
      if (b && !b.air) cade(b, FERMO[big ? 'bananone' : 'banana']);
    }, 450);
  }
  const guida_ = id => lista.some(b => b.id === id);
  // ogni 100 ms il pilota manda le posizioni di tutti gli avversari in un messaggio solo
  function invia() { if (modo === 'gara' && lista.length && net.pilota === stato.myId) net.send({ t: 'bots', b: lista.map(statoDi) }); }

  return { LIV, crea, passo, cade, statoDi, allenamento, gara, ferma, aggiorna, colpo, invia, guida: guida_, get lista() { return lista; }, get modo() { return modo; } };
};
