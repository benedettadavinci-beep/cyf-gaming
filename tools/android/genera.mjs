// Rigenera il progetto dell'app Android (cartella android/) da android/twa-manifest.json (R-550).
// L'app è lo stesso sito aperto a schermo intero dentro un'app (TWA): qui non c'è codice del gioco.
//
// Quando serve: se cambia l'indirizzo del sito (dominio nuovo), il nome, i colori, le icone o la versione dell'app.
// Basta cambiare android/twa-manifest.json e rilanciare:
//
//   npm install --no-save --prefix /tmp/bw @bubblewrap/core@1.27.0
//   NODE_PATH=/tmp/bw/node_modules node tools/android/genera.mjs
//
// Le icone si leggono dalla cartella public/ di questo repository (servite in locale): non serve che il sito sia già
// online. Il file .aab lo costruisce GitHub (.github/workflows/android.yml), non questo script.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEST = path.join(ROOT, 'android');
const require = createRequire(path.join(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter)[0] : ROOT, 'x.js'));
const { TwaGenerator, TwaManifest, ConsoleLog, fetchUtils } = require('@bubblewrap/core');

const json = JSON.parse(fs.readFileSync(path.join(DEST, 'twa-manifest.json'), 'utf8'));
const sito = 'https://' + json.host;

// piccolo server locale sulla cartella public/, solo per dare le icone al generatore
const TIPI = { '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, 'public', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPI[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const locale = 'http://127.0.0.1:' + server.address().port;

try {
  fetchUtils.setFetchEngine('node-fetch');
  const dati = { ...json };
  // icone e manifest del sito si leggono dalla copia locale (il generatore li scarica)
  for (const k of ['iconUrl', 'maskableIconUrl', 'monochromeIconUrl', 'webManifestUrl']) if (dati[k]) dati[k] = dati[k].replace(sito, locale);
  const twa = new TwaManifest(dati);
  const errore = twa.validate();
  if (errore) throw new Error('twa-manifest.json non valido: ' + errore);
  // si tolgono i file generati la volta prima, non twa-manifest.json né il README
  for (const f of ['app', 'gradle', 'build.gradle', 'settings.gradle', 'gradle.properties', 'gradlew', 'gradlew.bat', 'store_icon.png', 'manifest-checksum.txt'])
    fs.rmSync(path.join(DEST, f), { recursive: true, force: true });
  await new TwaGenerator().createTwaProject(DEST, twa, new ConsoleLog('genera'));
  // nei file generati non deve restare l'indirizzo locale: si rimette quello vero del sito
  const giro = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? giro(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of giro(DEST).filter(f => /\.(gradle|xml|json|properties|txt|java|kt)$/.test(f) && !f.endsWith('twa-manifest.json'))) {
    const t = fs.readFileSync(f, 'utf8');
    if (t.includes(locale)) fs.writeFileSync(f, t.split(locale).join(sito));
  }
  console.log('Progetto Android rigenerato in android/ per ' + sito + json.startUrl + ' (' + json.packageId + ', versione ' + json.appVersion + ', codice ' + json.appVersionCode + ')');
} finally {
  server.close();
}
