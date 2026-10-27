// Nomi non definiti: legge ogni file JavaScript del gioco con acorn, segue gli scope (funzioni, blocchi, parametri,
// catch, for) e segnala gli identificatori che non sono dichiarati da nessuna parte e non sono globali del browser.
// Trova in mezzo secondo errori come "COST is not defined" che altrimenti saltano fuori solo in gara.
//
//   node tools/verifica/nomi.mjs            esce con 1 se trova nomi non definiti
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = d => fs.readdirSync(path.join(ROOT, d)).flatMap(f => (fs.statSync(path.join(ROOT, d, f)).isDirectory() ? walk(path.join(d, f)) : /\.js$/.test(f) ? [path.join(d, f)] : []));
const files = ['public/pista-nera/game.js', 'public/pista-nera/diagnosi.js', 'public/pista-nera/i18n.js', 'public/shared/protocollo.js', 'public/config.js', ...walk('public/pista-nera/moduli'), ...walk('public/pista-nera/citta')];

// globali ammessi: quelli del browser più quelli che il gioco definisce su window
const GLOBALS = new Set(('window document navigator location history localStorage sessionStorage performance console setTimeout clearTimeout setInterval clearInterval ' +
  'requestAnimationFrame cancelAnimationFrame fetch WebSocket Audio AudioContext webkitAudioContext Blob URL Worker OffscreenCanvas ImageBitmap atob btoa JSON Math Number String Array Object Boolean Date RegExp Map Set WeakMap Promise Error TypeError ' +
  'Symbol Intl Float32Array Uint8Array Int16Array ArrayBuffer DataView Event CustomEvent MutationObserver Proxy Reflect isFinite isNaN parseInt parseFloat encodeURIComponent decodeURIComponent ' +
  'alert confirm prompt screen devicePixelRatio innerWidth innerHeight matchMedia getComputedStyle structuredClone queueMicrotask globalThis undefined NaN Infinity arguments module ' +
  'URLSearchParams getSelection ResizeObserver TextEncoder TextDecoder crypto Worker OffscreenCanvas createImageBitmap ImageBitmap self postMessage THREE PN CYF CYF_I18N CYFDiag CYF_PROTOCOLLO').split(/\s+/));

const problems = [];
function check(file) {
  const src = read(file);
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true }); }
  catch (e) { problems.push(file + ': ' + e.message); return; }
  // 1) raccolta delle dichiarazioni per scope (hoisting: var e function valgono in tutta la funzione, let/const/class nel blocco)
  const scopeOf = new Map();   // nodo di scope → Set di nomi
  const declare = (scope, name) => { if (!scopeOf.has(scope)) scopeOf.set(scope, new Set()); scopeOf.get(scope).add(name); };
  const patternNames = (p, out = []) => {
    if (!p) return out;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'ObjectPattern') for (const pr of p.properties) patternNames(pr.type === 'RestElement' ? pr.argument : pr.value, out);
    else if (p.type === 'ArrayPattern') for (const el of p.elements) patternNames(el, out);
    else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
    else if (p.type === 'RestElement') patternNames(p.argument, out);
    return out;
  };
  const isFn = n => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
  const isBlock = n => n.type === 'BlockStatement' || n.type === 'ForStatement' || n.type === 'ForInStatement' || n.type === 'ForOfStatement' || n.type === 'SwitchStatement' || n.type === 'CatchClause';
  const refs = [];   // { name, chain: [scopes…], loc }
  function visit(node, chain, parent) {
    if (!node || typeof node.type !== 'string') return;
    let ch = chain;
    if (isFn(node)) {
      ch = [...chain, node];
      for (const p of node.params) for (const n of patternNames(p)) declare(node, n);
      if (node.type === 'FunctionExpression' && node.id) declare(node, node.id.name);
      if (node.type === 'FunctionDeclaration' && node.id) declare(nearestFn(chain), node.id.name);
    } else if (isBlock(node)) {
      ch = [...chain, node];
      if (node.type === 'CatchClause' && node.param) for (const n of patternNames(node.param)) declare(node, n);
    } else if (node.type === 'Program') ch = [node];
    if (node.type === 'VariableDeclaration') {
      const target = node.kind === 'var' ? nearestFn(ch) : ch[ch.length - 1];
      for (const d of node.declarations) for (const n of patternNames(d.id)) declare(target, n);
    }
    if (node.type === 'ClassDeclaration' && node.id) declare(ch[ch.length - 1], node.id.name);
    if (node.type === 'Identifier') {
      // è un riferimento se non è una chiave di proprietà, un nome di dichiarazione o un'etichetta
      if (parent && (
        (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
        ((parent.type === 'Property' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed && !parent.shorthand) ||
        (parent.type === 'MethodDefinition' && parent.key === node) ||
        (parent.type === 'VariableDeclarator' && parent.id === node) ||
        (isFn(parent) && (parent.id === node || parent.params.includes(node))) ||
        (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') ||
        (parent.type === 'ClassDeclaration' && parent.id === node) ||
        (parent.type === 'CatchClause' && parent.param === node) ||
        ((parent.type === 'ObjectPattern' || parent.type === 'ArrayPattern' || parent.type === 'AssignmentPattern' || parent.type === 'RestElement') && parent.type !== 'AssignmentPattern'))) {
        // dentro un pattern i nomi sono dichiarazioni (gestite sopra), tranne i valori di default
      } else if (!(parent && parent.type === 'AssignmentPattern' && parent.left === node)) refs.push({ name: node.name, chain: ch, loc: node.loc.start });
    }
    for (const k in node) {
      if (k === 'loc' || k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) for (const x of v) visit(x, ch, node);
      else if (v && typeof v.type === 'string') visit(v, ch, node);
    }
  }
  function nearestFn(chain) { for (let i = chain.length - 1; i >= 0; i--) if (isFn(chain[i]) || chain[i].type === 'Program') return chain[i]; return chain[0]; }
  visit(ast, [], null);
  // 2) ogni riferimento deve risolversi in uno scope della catena o nei globali
  for (const r of refs) {
    if (GLOBALS.has(r.name)) continue;
    let ok = false;
    for (const s of r.chain) if (scopeOf.get(s) && scopeOf.get(s).has(r.name)) { ok = true; break; }
    if (!ok) problems.push(`${file}:${r.loc.line}:${r.loc.column + 1}  "${r.name}" non è definito`);
  }
}
for (const f of files) check(f);
const uniq = [...new Set(problems)];
console.log(uniq.length ? 'NOMI NON DEFINITI:\n' + uniq.map(p => ' - ' + p).join('\n') : 'Nessun nome non definito in ' + files.length + ' file.');
process.exit(uniq.length ? 1 : 0);
