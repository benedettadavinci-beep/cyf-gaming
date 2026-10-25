// Matrice dei moduli di Pista Nera: chi definisce cosa, chi usa cosa.
//
//   node tools/verifica/matrice.mjs            stampa la matrice e aggiorna MODULI.md
//   node tools/verifica/matrice.mjs --check    esce con 1 se un modulo usa qualcosa che non è nella matrice dichiarata
//
// Legge i file in public/pista-nera/moduli/*.js (ognuno espone PN.<nome>) e game.js, e per ogni file
// elenca i nomi PN.<modulo>.<x> che usa. La matrice è la tabella "modulo → dipende da".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'public', 'pista-nera');
const check = process.argv.includes('--check');
const read = f => fs.readFileSync(f, 'utf8');

// i file che contano: moduli/*.js, game.js, diagnosi.js, i18n.js e shared/*.js
const files = [];
const modDir = path.join(DIR, 'moduli');
if (fs.existsSync(modDir)) for (const f of fs.readdirSync(modDir).filter(f => f.endsWith('.js')).sort()) files.push({ name: 'moduli/' + f, file: path.join(modDir, f) });
for (const f of ['game.js', 'diagnosi.js', 'i18n.js']) if (fs.existsSync(path.join(DIR, f))) files.push({ name: f, file: path.join(DIR, f) });
const sharedDir = path.join(ROOT, 'public', 'shared');
if (fs.existsSync(sharedDir)) for (const f of fs.readdirSync(sharedDir).filter(f => f.endsWith('.js')).sort()) files.push({ name: 'shared/' + f, file: path.join(sharedDir, f) });

// ogni modulo dichiara in testa: "// modulo: <nome>" e "// dipende da: a, b, c" (oppure "nessuno")
const info = new Map();
for (const f of files) {
  const src = read(f.file);
  const mod = (/^\/\/ modulo:\s*(\S+)/m.exec(src) || [])[1] || null;
  const depLine = (/^\/\/ dipende da:\s*(.+)$/m.exec(src) || [])[1] || '';
  const declared = depLine.trim() === 'nessuno' || !depLine ? [] : depLine.split(',').map(s => s.trim()).filter(Boolean);
  const defines = new Set();
  for (const m of src.matchAll(/PN\.([A-Za-z_]\w*)\s*=\s*/g)) defines.add(m[1]);
  const uses = new Map();
  for (const m of src.matchAll(/PN\.([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?/g)) {
    if (defines.has(m[1]) && mod === m[1]) continue;
    if (!uses.has(m[1])) uses.set(m[1], new Set());
    if (m[2]) uses.get(m[1]).add(m[2]);
  }
  // istanze ricevute come parametri: "PN.citta = ({ world, pista }) =>" dipende da pista se esiste un modulo con quel nome;
  // "pista: PISTA" oppure "audio: AUDIO" nelle chiamate del gioco vale lo stesso
  const head = /PN\.[A-Za-z_]\w*\s*=\s*\(\{([^}]*)\}\)\s*=>/.exec(src);
  const inst = new Map();   // nome del parametro → modulo ("audio: AUDIO" → AUDIO è un'istanza di audio)
  if (head) for (const part of head[1].split(',').map(x => x.trim()).filter(Boolean)) {
    const [n, alias] = part.split(':').map(x => x.trim());
    if (n !== mod && !uses.has(n)) uses.set(n, new Set());
    inst.set(alias || n, n);
  }
  // cosa si usa davvero: "const { a, b } = PN.x;" oppure "= pista;" (istanza ricevuta) oppure "AUDIO.initAudio"
  for (const m of src.matchAll(/const \{([^}]*)\}\s*=\s*(?:PN\.)?([A-Za-z_]\w*)\s*;/g)) {
    const target = inst.get(m[2]) || m[2];
    if (!uses.has(target) || target === mod) continue;
    for (const n of m[1].split(',').map(x => x.trim().split(':')[0].trim()).filter(Boolean)) uses.get(target).add(n);
  }
  for (const [alias, target] of inst) if (uses.has(target)) for (const m of src.matchAll(new RegExp('(?<![\\w.])' + alias + '\\.([A-Za-z_]\\w*)', 'g'))) uses.get(target).add(m[1]);
  info.set(f.name, { mod, declared, defines: [...defines], uses, lines: src.split('\n').length });
}

const known = new Set([...info.values()].map(i => i.mod).filter(Boolean));
const problems = [];
const rows = [];
for (const [name, i] of info) {
  for (const u of [...i.uses.keys()]) if (!known.has(u)) i.uses.delete(u);   // "world", "net"… non sono moduli
  const used = [...i.uses.keys()].filter(u => u !== i.mod);
  for (const u of used) {
    if (i.mod && !i.declared.includes(u)) problems.push(`${name} usa PN.${u} ma non lo dichiara in "// dipende da:"`);
  }
  for (const d of i.declared) if (!used.includes(d)) problems.push(`${name} dichiara di dipendere da ${d} ma non lo usa`);
  rows.push({ name, mod: i.mod || '—', lines: i.lines, deps: used.map(u => u + ' (' + [...i.uses.get(u)].slice(0, 6).join(', ') + ([...i.uses.get(u)].length > 6 ? ', …' : '') + ')') });
}

// moduli che si usano a vicenda = ciclo: vietato (così si possono modificare separatamente)
const graph = new Map([...info.values()].filter(i => i.mod).map(i => [i.mod, [...i.uses.keys()].filter(u => u !== i.mod)]));
const seen = new Set(), stack = new Set();
const visit = (n, trail) => {
  if (stack.has(n)) { problems.push('ciclo tra moduli: ' + [...trail, n].join(' → ')); return; }
  if (seen.has(n) || !graph.has(n)) return;
  stack.add(n); seen.add(n);
  for (const d of graph.get(n)) visit(d, [...trail, n]);
  stack.delete(n);
};
for (const n of graph.keys()) visit(n, []);

let out = '| File | Modulo (PN.…) | Righe | Dipende da (cosa usa) |\n|---|---|---|---|\n';
for (const r of rows) out += `| \`${r.name}\` | ${r.mod} | ${r.lines} | ${r.deps.length ? r.deps.join('; ') : 'nessuno'} |\n`;
console.log(out);
if (!check) {
  const md = path.join(ROOT, 'MODULI.md');
  if (fs.existsSync(md)) {
    const s = read(md);
    const a = s.indexOf('<!-- matrice -->'), b = s.indexOf('<!-- /matrice -->');
    if (a >= 0 && b > a) fs.writeFileSync(md, s.slice(0, a) + '<!-- matrice -->\n' + out + s.slice(b));
  }
}
if (problems.length) { console.log('PROBLEMI:'); for (const p of problems) console.log(' -', p); }
else console.log('Matrice coerente: ogni modulo usa solo quello che dichiara, nessun ciclo.');
process.exit(check && problems.length ? 1 : 0);
