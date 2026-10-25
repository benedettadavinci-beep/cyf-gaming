// Controlli statici di C-Y-F Gaming, in pochi secondi e senza browser né server:
// 1. sintassi di tutti i file JavaScript;
// 2. ogni testo usato dal gioco (tr('…'), attributi data-i18n della pagina, schede delle città) esiste in tutte e 4 le lingue;
// 3. le 4 lingue hanno le stesse chiavi e gli stessi segnaposto ({n}, {t}…);
// 4. la versione di public/config.js compare nello storico di REQUISITI.md.
// Uso: node tools/verifica/controlli.mjs   (esce con 1 se trova problemi)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf-8');
const problems = [];
const ok = (cond, label, extra = '') => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (extra ? '  [' + extra + ']' : ''));
  if (!cond) problems.push(label + (extra ? ' [' + extra + ']' : ''));
};

console.log('C1 · sintassi dei file JavaScript');
const walk = d => readdirSync(join(ROOT, d)).flatMap(f => {
  const p = join(d, f);
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(m?js)$/.test(f) ? [p] : [];
});
for (const f of [...walk('public'), ...walk('src'), ...walk('tools')]) {
  try { execFileSync(process.execPath, ['--check', join(ROOT, f)], { stdio: 'pipe' }); ok(true, f); }
  catch (e) { ok(false, f, String(e.stderr || e).split('\n').slice(0, 4).join(' ')); }
}

console.log('C2 · lingue: stesse chiavi e stessi segnaposto in it, en, fr, es');
const box = { window: {} };
vm.runInNewContext(read('public/pista-nera/i18n.js'), box);
const L = box.window.CYF_I18N || {};
const LANGS = ['it', 'en', 'fr', 'es'];
ok(LANGS.every(l => L[l]), 'le 4 lingue ci sono', Object.keys(L).join(','));
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
for (const l of LANGS.slice(1)) {
  const miss = Object.keys(L.it).filter(k => !(k in L[l]));
  const extra = Object.keys(L[l]).filter(k => !(k in L.it));
  const ph = Object.keys(L.it).filter(k => k in L[l] && holes(L.it[k]) !== holes(L[l][k]));
  ok(!miss.length, l + ': nessun testo mancante', miss.slice(0, 12).join(', '));
  ok(!extra.length, l + ': nessun testo in più', extra.slice(0, 12).join(', '));
  ok(!ph.length, l + ': stessi segnaposto dell\'italiano', ph.slice(0, 12).join(', '));
}

console.log('C3 · ogni testo usato dal gioco esiste');
// game.js più tutti i moduli e le schede delle città: i testi si usano ovunque
const jsFiles = ['public/pista-nera/game.js', ...walk('public/pista-nera/moduli'), ...(existsSync(join(ROOT, 'public/pista-nera/citta')) ? walk('public/pista-nera/citta') : [])];
const game = jsFiles.map(f => read(f)).join('\n');
const html = read('public/pista-nera/index.html');
const used = new Map();   // chiave → dove
const use = (k, where) => { if (!used.has(k)) used.set(k, where); };
// tr('chiave') e tr(condizione ? 'a' : 'b')
for (const m of game.matchAll(/\btr\(([^;\n]{0,160}?)(?:,\s*\{|\))/g)) {
  for (const s of m[1].matchAll(/(===?\s*|!==?\s*)?'([A-Za-z][A-Za-z0-9_]*)'(\s*\+)?/g)) {
    if (s[1] || s[3]) continue;   // 'bomb' in "kind === 'bomb' ?" è un confronto; 'food_' + x è un prefisso
    use(s[2], 'game.js');
  }
}
// tr('prefisso_' + valore): il prefisso con i valori delle schede delle città
const prefixes = [...game.matchAll(/\btr\('([a-z]+_)'\s*\+/g)].map(m => m[1]);
// schede delle città: messaggi di caduta e cibi
for (const m of game.matchAll(/\b(tallCrash|lowCrash|markerCrash):\s*'([A-Za-z0-9_]+)'/g)) use(m[2], 'CITY_CFG.' + m[1]);
for (const m of game.matchAll(/\b(fa|fb):\s*'([A-Za-z0-9_]+)'/g)) for (const p of prefixes.length ? prefixes : ['food_']) if (p === 'food_') use(p + m[2], 'CITY_CFG.' + m[1]);
// attributi della pagina
for (const m of html.matchAll(/data-i18n(?:-html|-ph|-title|-aria)?="([^"]+)"/g)) use(m[1], 'index.html');
const missing = [...used].filter(([k]) => !(k in L.it));
ok(used.size > 100, 'testi trovati nel codice (' + jsFiles.length + ' file)', String(used.size));
ok(!missing.length, 'tutti i testi usati esistono in italiano (e quindi, per C2, nelle 4 lingue)', missing.slice(0, 15).map(([k, w]) => k + ' (' + w + ')').join(', '));

console.log('C4 · versione');
const ver = (/version:\s*'([\d.]+)'/.exec(read('public/config.js')) || [])[1];
const req = read('REQUISITI.md');
ok(!!ver, 'versione in public/config.js', ver);
ok(new RegExp('^\\| ' + (ver || 'x').replace(/\./g, '\\.') + ' \\|', 'm').test(req), 'la versione ' + ver + ' è nello storico di REQUISITI.md');

console.log('C5 · attesa della sfida (R-119)');
const wk = read('src/worker.js'), wr = read('wrangler.jsonc');
ok(/const ATTESA_SFIDA_MS = 40000;/.test(wk), 'nella sfida si aspettano 40 s dopo "Parti"');
ok(!/ATTESA_SFIDA_MS/.test(wr), 'online nessuna variabile accorcia l\'attesa (ATTESA_SFIDA_MS solo nelle prove locali)');

console.log('\n' + (problems.length ? 'PROBLEMI:' : 'NESSUN PROBLEMA'));
for (const p of problems) console.log(' -', p);
process.exit(problems.length ? 1 : 0);
