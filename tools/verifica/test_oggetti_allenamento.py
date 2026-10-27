"""Banane, bombe e bananoni in allenamento con gli avversari del computer (R-515).

Luigi (27/10): "quando gioco con le persone finte del gioco devo avere la stessa possibilità di usare bananone, banana e
bomba, come se fossero veri concorrenti". In allenamento non passa nulla dal server: gli oggetti si simulano sul telefono.
Si controlla:
- i pulsanti degli oggetti si vedono e si possono premere in allenamento (prima c'era solo il microfono);
- la banana lanciata ferma l'avversario davanti e costa i suoi punti;
- la bomba posata ferma l'avversario che ci passa sopra;
- un avversario che lancia ferma il rider, che non perde una vita (in allenamento le vite sono per gli ostacoli);
- gli avversari usano da soli gli oggetti quando hanno i punti.
Esce con 1 se qualcosa non va."""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """
  window.__dbg = { get P() { return P; }, get bonus() { return bonus; }, set bonus(v) { bonus = v; }, get lives() { return lives; },
    get mode() { return mode; }, startSolo, get BOT() { return BOT; }, get OGG() { return OGG; }, get stato() { return stato; },
    frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); } };
""")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what)

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(viewport={'width': 1000, 'height': 640}, locale='it-IT'); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    print('Allenamento con 3 avversari del computer:', flush=True)
    r = pg.evaluate("""() => { const D = window.__dbg; D.startSolo(); return D.frames(6).then(() => ({
        mode: D.mode, bots: D.BOT.lista.length, allena: D.stato.allenaConAvversari,
        items: !document.getElementById('items').hidden, dis: ['btnBanana', 'btnBomb', 'btnBananone'].map(id => document.getElementById(id).disabled) })); }""")
    check(r['mode'] == 'solo' and r['bots'] == 3 and r['allena'], 'allenamento partito con 3 avversari', json.dumps(r))
    check(r['items'] and not any(r['dis']), 'i pulsanti di banana, bomba e bananone si vedono e si possono premere', json.dumps(r))

    # banana all'avversario davanti
    r = pg.evaluate("""() => { const D = window.__dbg, P = D.P, b = D.BOT.lista[0];
        D.bonus = 2000; P.speed = 0; b.x = P.x; b.z = P.z - 25; b.speed = 0; b.air = false; b.y = 0; b.crash = 0; b.stopUntil = 0; b.inv = 0;
        for (const q of D.BOT.lista.slice(1)) { q.z = P.z + 80; q.speed = 0; }   // gli altri dietro, lontani
        const prima = D.bonus; D.OGG.useItem('banana');
        return new Promise(res => setTimeout(() => res({ costo: prima - D.bonus, fermo: b.stopUntil > performance.now(), id: b.id }), 900)); }""")
    check(r['costo'] == 50, 'la banana costa 50 punti', json.dumps(r))
    check(r['fermo'], 'la banana ferma l\'avversario davanti', json.dumps(r))

    # bomba posata: l'avversario che ci passa sopra si ferma
    r = pg.evaluate("""() => { const D = window.__dbg, P = D.P, b = D.BOT.lista[1];
        b.crash = 0; b.stopUntil = 0; b.inv = 0; b.air = false; b.y = 0;
        const n0 = D.OGG.hazards.size; D.OGG.useItem.last = 0; D.OGG.useItem('bomb');
        const h = [...D.OGG.hazards.values()].find(q => q.kind === 'bomb');
        if (!h) return { n0, n1: D.OGG.hazards.size };
        b.x = h.x; b.z = h.z; b.speed = 0;
        return D.frames(6).then(() => ({ n0, posata: true, fermo: b.stopUntil > performance.now(), rimasta: D.OGG.hazards.has(h.hid) })); }""")
    check(r.get('posata'), 'la bomba si posa dietro il rider', json.dumps(r))
    check(r.get('fermo') and not r.get('rimasta'), 'l\'avversario che passa sulla bomba si ferma e la bomba sparisce', json.dumps(r))

    # un avversario lancia al rider: fermo, ma senza perdere una vita
    r = pg.evaluate("""() => { const D = window.__dbg, P = D.P; P.crash = 0; P.air = false; P.y = 0;
        const vite = D.lives; const id = D.stato.myId; D.BOT.colpo(id, 'banana', 'Prova');
        return new Promise(res => setTimeout(() => res({ fermo: P.stopUntil > performance.now(), vite0: vite, vite1: D.lives }), 900)); }""")
    check(r['fermo'], 'la banana di un avversario ferma il rider', json.dumps(r))
    check(r['vite1'] == r['vite0'], 'in allenamento la banana non toglie una vita', json.dumps(r))

    # gli avversari usano da soli gli oggetti: il più forte con i punti per il bananone e il rider davanti
    r = pg.evaluate("""() => { const D = window.__dbg, P = D.P;
        P.crash = 0; P.stopUntil = 0; P.air = false; P.y = 0;
        const b = D.BOT.lista.find(q => q.liv === 'forte') || D.BOT.lista[0];
        b.bonus = 3000; b.oggT = 0; b.crash = 0; b.stopUntil = 0; b.air = false; b.y = 0; b.x = P.x; b.z = P.z + 25;
        const p0 = b.bonus, t0 = performance.now();
        return new Promise(res => { const f = () => { if (b.bonus < p0 || performance.now() - t0 > 20000) res({ speso: p0 - b.bonus, ms: Math.round(performance.now() - t0) }); else setTimeout(f, 200); }; f(); }); }""")
    check(r['speso'] > 0, 'gli avversari del computer usano da soli banane, bombe e bananoni', json.dumps(r))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs[:3]))
    br.close()
print('OK' if not fails else f'FALLITE {len(fails)}: ' + '; '.join(fails))
sys.exit(1 if fails else 0)
