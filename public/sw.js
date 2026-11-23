// Service worker di C-Y-F Gaming (R-548): «rete prima».
// Regola: se c'è rete si scarica SEMPRE la versione nuova del sito, come senza service worker; solo quando la rete
// manca si usa l'ultima copia salvata, e per le pagine mai salvate la pagina /offline.html. Così non può mai restare
// in giro una versione vecchia del gioco. Non tocca: le chiamate al server delle gare (/api/…, WebSocket), le richieste
// che non sono GET e tutto ciò che arriva da altri siti (caratteri, pubblicità).
// Per spegnerlo in emergenza: pubblicare questo file con il solo contenuto di SPEGNI qui sotto.
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', e => e.waitUntil(self.registration.unregister()));
const CACHE = 'cyf-rete-prima-1';
const OFFLINE = '/offline.html';
// Una risposta arrivata dopo un reindirizzamento (per esempio /privacy → /privacy/, /offline.html → /offline) il browser
// non la accetta per aprire una pagina: prima di darla se ne fa una copia pulita.
const pulita = async res => (res && res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res);

self.addEventListener('install', e => {
  // la pagina "sei offline" si salva subito; se non riesce il service worker si installa lo stesso
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(OFFLINE, { cache: 'reload' }))).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  let u;
  try { u = new URL(r.url); } catch (x) { return; }
  if (u.origin !== self.location.origin) return;
  if (u.pathname.startsWith('/api/') || u.pathname === '/sw.js') return;
  e.respondWith((async () => {
    try {
      const res = await fetch(r);
      // si salva solo una risposta buona e completa del nostro sito
      if (res && res.status === 200 && res.type === 'basic') {
        const copia = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(r, copia)).catch(() => {}));
      }
      return res;
    } catch (err) {
      const c = await caches.open(CACHE);
      // una pagina si ritrova anche se l'indirizzo ha parametri diversi (?sfida=…, ?fonte=…)
      let salvata = await c.match(r, { ignoreSearch: r.mode === 'navigate' });
      // /privacy e /privacy/ sono la stessa pagina: la copia sta sotto l'indirizzo con la barra finale
      if (!salvata && r.mode === 'navigate' && !u.pathname.endsWith('/')) salvata = await c.match(u.origin + u.pathname + '/', { ignoreSearch: true });
      if (salvata) return pulita(salvata);
      if (r.mode === 'navigate') { const off = await c.match(OFFLINE); if (off) return pulita(off); }
      throw err;
    }
  })());
});
