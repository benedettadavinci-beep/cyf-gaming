// Pagine /privacy/ e /termini/ (R-549): sceglie la lingua (la stessa del gioco, chiave cyf.lang), mostra il testo in
// quella lingua e scrive chi risponde del gioco e il contatto presi da /config.js (titolare, contatto).
(function () {
  var LINGUE = ['it', 'en', 'fr', 'es'];
  // testo mostrato finché titolare e contatto non sono scritti in config.js
  var MANCA = {
    it: 'sarà pubblicato qui prima dell\'uscita su Google Play',
    en: 'will be published here before the release on Google Play',
    fr: 'sera publié ici avant la sortie sur Google Play',
    es: 'se publicará aquí antes del lanzamiento en Google Play'
  };
  var l = null;
  try { l = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (LINGUE.indexOf(l) < 0) { try { l = localStorage.getItem('cyf.lang'); } catch (e) {} }
  if (LINGUE.indexOf(l) < 0) {
    var n = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'it']);
    for (var i = 0; i < n.length && LINGUE.indexOf(l) < 0; i++) l = String(n[i]).slice(0, 2).toLowerCase();
  }
  if (LINGUE.indexOf(l) < 0) l = 'it';

  var cfg = window.CYF || {};
  function riempi(sel, valore, email) {
    document.querySelectorAll(sel).forEach(function (el) {
      var lingua = (el.closest('[data-lingua]') || document.documentElement).getAttribute('data-lingua') || 'it';
      el.textContent = '';
      if (!valore) { el.textContent = MANCA[lingua] || MANCA.it; return; }
      if (email) { var a = document.createElement('a'); a.href = 'mailto:' + valore; a.textContent = valore; el.appendChild(a); }
      else el.textContent = valore;
    });
  }
  riempi('[data-titolare]', String(cfg.titolare || '').trim(), false);
  riempi('[data-contatto]', String(cfg.contatto || '').trim(), true);

  function mostra(lingua) {
    if (LINGUE.indexOf(lingua) < 0) lingua = 'it';
    document.documentElement.lang = lingua;
    document.querySelectorAll('[data-lingua]').forEach(function (a) { a.hidden = a.getAttribute('data-lingua') !== lingua; });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lingua)); });
    var t = document.querySelector('[data-lingua="' + lingua + '"] h1');
    if (t) document.title = t.textContent + ' · C-Y-F Gaming';
  }
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var scelta = b.getAttribute('data-lang');
      try { localStorage.setItem('cyf.lang', scelta); } catch (e) {}
      mostra(scelta);
    });
  });
  mostra(l);
})();
