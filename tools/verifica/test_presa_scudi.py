"""Presa della tavola (R-544, 0.36.0) e scudi sulla pista (R-545, 0.37.0), in allenamento con gli avversari.

Presa: in aria freccia giù (o rotellina in basso) = la mano tiene la tavola; senza tasti niente presa automatica;
sui saltini (meno di mezzo secondo d'aria) la presa non parte; il salto mortale all'indietro è su Spazio/Salta
premuti di nuovo in aria (keys.back), non più su freccia giù.
Scudi: bolle viola, giallo-verdi e azzurre, tante di ogni tipo quanti i corridori; passandoci sopra lo scudo si
attiva con il conto alla rovescia in alto; non si sommano; lo scudo giusto para il colpo, quello sbagliato no.
Foto delle bolle in OUT. Esce con 1 se qualcosa non va."""
import json, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """
  window.__dbg = { get P() { return P; }, get bonus() { return bonus; }, set bonus(v) { bonus = v; }, get mode() { return mode; },
    startSolo, keys, stick, world, center, get SC() { return SC; }, get BOT() { return BOT; }, get stato() { return stato; },
    god() { invuln = 1e9; lives = 99; }, set invuln(v) { invuln = v; },
    frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); } };
  window.__toasts = [];
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__toasts.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true });
""")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what + (f' [{extra}]' if extra else ''))

# bolle ancora sulla pista: gruppi nel mondo il cui primo figlio è la sfera di raggio 0,85 (moduli/scudi.js, crea)
BOLLE = """() => window.__dbg.world.children.filter(g => g.isGroup && g.children[0] && g.children[0].geometry && g.children[0].geometry.type === 'SphereGeometry'
  && g.children[0].geometry.parameters.radius === 0.85).map(g => ({ x: g.position.x, z: g.position.z, c: g.children[0].material.color.getHexString() }))"""

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(viewport={'width': 1000, 'height': 640}, locale='it-IT'); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    r = pg.evaluate("""() => { const D = window.__dbg; D.startSolo(); return D.frames(6).then(() => new Promise(ok => { const t0 = performance.now(); const w = () => (D.mode === 'race' || performance.now() - t0 > 30000) ? ok() : setTimeout(w, 200); w(); })).then(() => ({ mode: D.mode, bots: D.BOT.lista.length })); }""")
    check(r['mode'] == 'race' and r['bots'] == 3, 'allenamento partito con 3 avversari (4 corridori)', json.dumps(r))

    print('Presa della tavola (R-544):', flush=True)
    def aria(y, vy, down=False, back=False, n=30):
        return pg.evaluate("""([y, vy, down, back, n]) => { const D = window.__dbg; D.god(); const P = D.P; P.crash = 0; P.stop = 0; P.z -= 5; P.x = D.center(P.z);
          P.air = true; P.airT = 0; P.y = y; P.vy = vy; P.spin = 0; P.flip = 0; P.grab = 0; P.grabT = 0; P.onRamp = null; P.ramp = false;
          D.keys.down = down; D.keys.back = back; window.__toasts.length = 0; let gmax = 0;
          const loop = k => D.frames(1).then(() => { gmax = Math.max(gmax, P.grab); return k > 1 && P.air ? loop(k - 1) : null; });
          return loop(n).then(() => { const out = { gmax: +gmax.toFixed(2), flip: +P.flip.toFixed(2), grabT: +P.grabT.toFixed(2), air: P.air, toast: window.__toasts.join('|') }; D.keys.down = false; D.keys.back = false; return out; }); }""",
          [y, vy, down, back, n])
    a = aria(6, 8, down=True, n=400)
    check(a['gmax'] > 0.8 and a['grabT'] > 0.2, 'in aria con freccia giù la mano tiene la tavola', json.dumps(a))
    check('grab' in a['toast'].lower(), 'atterrando la presa vale punti ("Grab")', a['toast'])
    b = aria(6, 8, down=False, n=400)
    check(b['gmax'] < 0.1, 'senza tasti in aria nessuna presa automatica', json.dumps(b))
    c = aria(0.2, 1.0, down=True, n=60)
    check(c['gmax'] < 0.3, 'sui saltini (meno di mezzo secondo d\'aria) la presa non parte', json.dumps(c))
    d = aria(6, 8, back=True, n=40)
    check(abs(d['flip']) > 1, 'Spazio/Salta di nuovo in aria = salto mortale all\'indietro', json.dumps(d))
    check(abs(a['flip']) < 0.5, 'freccia giù in aria non fa più il salto mortale', json.dumps(a))

    print('Scudi sulla pista (R-545):', flush=True)
    bolle = pg.evaluate(BOLLE)
    colori = {}
    for q in bolle: colori[q['c']] = colori.get(q['c'], 0) + 1
    check(len(bolle) == 12 and len(colori) == 3 and all(v == 4 for v in colori.values()), 'tre tipi di bolle, 4 per tipo (come i corridori)', json.dumps(colori))
    check(all(abs(q['x'] - pg.evaluate('z => window.__dbg.center(z)', q['z'])) < 7 for q in bolle), 'le bolle sono sulla strada (entro 6 m dal centro)')
    # foto di una bolla da 12 m
    q = sorted(bolle, key=lambda q: -q['z'])[0]
    pg.evaluate("""q => { const D = window.__dbg; D.god(); const P = D.P; P.air = false; P.y = 0; P.vy = 0; P.z = q.z + 12; P.x = q.x; P.speed = 0.01; P.ang = 0; }""", q)
    pg.wait_for_timeout(1500); pg.screenshot(path=f'{OUT}/scudi-bolla.png')
    r = pg.evaluate("""q => { const D = window.__dbg; const P = D.P; window.__toasts.length = 0; P.z = q.z + 0.5; P.x = q.x; P.speed = 3;
      return D.frames(8).then(() => { const k = ['banana', 'bananone', 'bomb'].filter(k => D.SC.protegge(k)); const b = document.getElementById('scudoBadge');
        return { attivi: k, badge: b ? b.style.display : 'manca', testo: b ? b.textContent : '', toast: window.__toasts.join('|') }; }); }""", q)
    check(len(r['attivi']) == 1 and r['badge'] == 'block' and ' s' in r['testo'], 'passando sopra la bolla lo scudo si attiva con il conto alla rovescia in alto', json.dumps(r, ensure_ascii=False))
    mio = r['attivi'][0] if r['attivi'] else None
    pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/scudi-attivo.png')
    rimaste = pg.evaluate(BOLLE)
    check(len(rimaste) == 11, 'la bolla presa sparisce dalla pista', str(len(rimaste)))
    altra = sorted(rimaste, key=lambda q: -q['z'])[0]
    r2 = pg.evaluate("""q => { const D = window.__dbg; const P = D.P; window.__toasts.length = 0; P.z = q.z + 0.5; P.x = q.x; P.speed = 3;
      return D.frames(8).then(() => ({ attivi: ['banana', 'bananone', 'bomb'].filter(k => D.SC.protegge(k)), toast: window.__toasts.join('|') })); }""", altra)
    check(r2['attivi'] == [mio] and len(pg.evaluate(BOLLE)) == 11, 'con uno scudo attivo non se ne prende un altro (non si sommano)', json.dumps(r2, ensure_ascii=False))
    # colpo lanciato del tipo protetto: niente fermo; di un altro tipo: fermo come sempre
    sbagliato = 'bomb' if mio != 'bomb' else 'banana'
    def colpo(kind):
        return pg.evaluate("""kind => { const D = window.__dbg; const P = D.P; D.invuln = 0; P.crash = 0; P.stop = 0; P.stopUntil = 0; P.air = false; P.y = 0; D.keys.left = D.keys.right = false; window.__toasts.length = 0;
          D.BOT.colpo(D.stato.myId, kind, 'Prova');
          return new Promise(ok => setTimeout(ok, 2200)).then(() => ({ fermo: (P.stopUntil || 0) > 0, toast: window.__toasts.join('|') })); }""", kind)
    if mio in ('banana', 'bananone'):
        ok = colpo(mio)
        check(not ok['fermo'], f'scudo {mio}: il {mio} lanciato non ferma', json.dumps(ok, ensure_ascii=False))
    ko = colpo('bananone' if mio == 'banana' else 'banana')
    check(ko['fermo'] or 'schiv' in ko['toast'].lower(), 'lo scudo di un altro tipo non para il colpo (o la schivata del 25 %, R-540)', json.dumps(ko, ensure_ascii=False))
    check(not errs, 'nessun errore JavaScript', '; '.join(errs[:3]))
    br.close()
print('\n' + ('PROBLEMI:' if fails else 'NESSUN PROBLEMA'))
for x in fails: print(' -', x)
raise SystemExit(1 if fails else 0)
