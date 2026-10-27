// modulo: granpremio
// dipende da: base, lingua
// Gran Premio delle 21 (R-247, S-49): la gara ad appuntamento fisso di ogni sera, nella città della settimana, tutti
// nella stessa sala. Qui: il riquadro nel menu con il conto alla rovescia e il pulsante "Entra nel Gran Premio" (attivo
// da 10 minuti prima a 6 minuti dopo il via), i dati di /api/gp (orario, città, classifica della sera e propria posizione)
// e la classifica della sera nei risultati. L'orario lo decide il server: il gioco mostra solo "tra quanto".
// Si crea con PN.granpremio({ myId, entra, cambiato }) dal gioco: entra() chiede la sala a /api/quick?gp=1 e si collega;
// cambiato() avvisa che sono arrivati dati nuovi (per esempio la propria posizione, da mostrare nei risultati). Il gioco
// chiama carica() quando torna al menu e a fine Gran Premio, render() al cambio di lingua.
window.PN = window.PN || {};
PN.granpremio = ({ myId, entra, cambiato }) => {
  const { fmtTime } = PN.base;
  const { tr, ord, cityName } = PN.lingua;
  const $ = id => document.getElementById(id);
  let gp = null, offset = 0;   // offset: orologio del server − orologio del dispositivo
  const adesso = () => Date.now() + offset;
  const oraLocale = at => { try { return new Date(at).toLocaleTimeString(PN.lingua.lang, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }); } catch (e) { return '21:00'; } };
  // "1 h 08 min", "7 min", "42 s"
  function fraQuanto(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return h + ' h ' + String(m).padStart(2, '0') + ' min';
    if (m) return m + ' min';
    return s + ' s';
  }

  async function carica() {
    try {
      const res = await fetch('/api/gp?id=' + encodeURIComponent(myId), { cache: 'no-store' });
      if (!res.ok) throw new Error();
      gp = await res.json();
      if (gp.now) offset = gp.now - Date.now();
    } catch (e) { gp = null; }
    render();
    if (cambiato) cambiato();
  }

  // ---------- riquadro nel menu ----------
  function render() {
    const box = $('gpBox');
    if (!box) return;
    box.hidden = !gp;
    if (!gp) return;
    const now = adesso(), city = cityName(gp.scena);
    const aperto = now >= gp.at - 10 * 60000 && now <= gp.at + 6 * 60000, inCorso = now >= gp.at && now <= gp.at + 6 * 60000;
    $('gpName').textContent = '🏆 ' + tr('gpTitle', { h: oraLocale(gp.at), city });
    let info;
    if (inCorso) info = tr('gpRunning');
    else if (aperto) info = tr('gpOpen', { t: fraQuanto(gp.at - now) });
    else info = tr('gpIn', { t: fraQuanto(gp.at - now) });
    // dopo il Gran Premio di stasera: la propria posizione e il migliore
    if (gp.rank && now > gp.at) info = tr('gpDone', { p: ord(gp.rank), k: gp.of, t: fmtTime(gp.best) }) + ' · ' + tr('gpIn', { t: fraQuanto(gp.at - now) });
    $('gpInfo').textContent = info;
    const b = $('btnGp');
    b.disabled = !aperto;
    b.textContent = tr(inCorso ? 'gpBtnLate' : 'gpBtn');
    box.classList.toggle('open', aperto);
  }
  // il conto alla rovescia si aggiorna da solo; quando scatta la finestra si ricaricano i dati (classifica e orario nuovo)
  let ultimo = null;
  setInterval(() => {
    if (!gp || $('gpBox').hidden) return;
    const now = adesso(), chiave = (now >= gp.at - 10 * 60000) + ':' + (now >= gp.at) + ':' + (now > gp.at + 6 * 60000);
    if (ultimo !== null && chiave !== ultimo && now > gp.at + 6 * 60000) carica(); else render();
    ultimo = chiave;
  }, 1000);
  $('btnGp').addEventListener('click', () => entra());

  // ---------- risultati: la classifica della sera (tutte le sale) ----------
  function risultati(ol, titolo, g) {
    if (!g) return false;
    titolo.textContent = tr('gpBoard', { city: cityName(g.scena) });
    ol.innerHTML = '';
    for (const r of (g.top || []).slice(0, 10)) {
      const li = document.createElement('li');
      li.textContent = r.name;
      if (r.me) li.className = 'me';
      const s = document.createElement('span'); s.textContent = fmtTime(r.ms);
      li.append(s);
      ol.append(li);
    }
    return true;
  }

  return { carica, render, risultati, get gp() { return gp; } };
};
