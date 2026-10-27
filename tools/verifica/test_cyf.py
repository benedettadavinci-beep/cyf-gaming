"""La scritta CYF si vede davvero (R-240, R-514, baco B-03).

Fino alla 0.25.1 la scritta sul trampolino gigante c'era nel codice ma Luigi non la vedeva: nessuna prova guardava il gioco
dal punto di vista del giocatore. Qui si fotografa la scena dalla telecamera del rider e si contano i pixel arancioni CYF
(#ff5a1f, usato solo per le scritte CYF):
- 35 m prima di un trampolino gigante: i due cartelli e la scritta sulla salita (neve e due città);
- 70 m prima di un arco CYF: lo striscione sopra la pista;
- il rider fermo: la scritta sulla giacca (bianca con il bordo blu notte) nella foto, da guardare;
e si controlla che i cartelli stiano fuori dalla rampa e sopra lo stacco e che lo striscione stia sopra il salto più alto.
Le foto vanno in OUT (di serie /tmp/cyf-verifica/cyf). Esce con 1 se una scritta non si vede."""
import json, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/cyf'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """
  window.__dbg = { get P() { return P; }, get objs() { return GEN.objs; }, set mode(v) { mode = v; }, reset, applyTheme, ensureSpawned, center, hgt,
    god() { invuln = 1e9; lives = 99; }, frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); } };
""")
SCENE = os.environ.get('SCENE', 'neve,napoli,berlino').split(',')
MIN_TRAMPOLINO = int(os.environ.get('MIN_TRAMPOLINO', '250'))   # pixel arancioni minimi a 35 m (foto 1000 x 640)
MIN_ARCO = int(os.environ.get('MIN_ARCO', '250'))

fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what)

def arancioni(path, alto=None):
    im = Image.open(path).convert('RGB'); w, h = im.size
    box = (0, 0, w, h if alto is None else int(h * alto))
    n = 0
    for r, g, b in im.crop(box).getdata():
        if r > 200 and 50 < g < 140 and b < 90 and r - g > 90: n += 1
    return n

TROVA = """([scena, tipo]) => { const D = window.__dbg; D.applyTheme(scena); D.mode = 'solo'; D.reset(4242, null, false); D.god();
  let o = null; for (let z = 0; z > -30000 && !o; z -= 150) { D.P.z = z; D.P.x = D.center(z); D.ensureSpawned();
    o = D.objs.find(q => (tipo === 'ramp' ? q.type === 'ramp' && q.big : q.type === 'arco') && q.z < z - 90); }
  if (!o) return null;
  const info = { x: o.x, z: o.z };
  if (tipo === 'ramp') {
    const g = o.deco; info.figli = g ? g.children.length : 0;
    const pann = g ? g.children.filter(m => m.geometry && m.geometry.type === 'PlaneGeometry') : [];
    info.pannelli = pann.map(m => ({ dx: +(m.position.x - o.x).toFixed(2), sopra: +(m.position.y - 0.45 - D.hgt(o.x, o.z)).toFixed(2) }));
  } else info.basso = +(o.mesh.position.y - 0.9 - D.hgt(o.x, o.z)).toFixed(2);
  return info; }"""
VAI = """([x, z]) => { const D = window.__dbg; D.P.x = x; D.P.z = z; D.P.ang = 0; D.P.speed = 0; D.P.y = 0; D.ensureSpawned();
  document.getElementById('menu').hidden = true; return D.frames(10); }"""

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(viewport={'width': 1000, 'height': 640}, locale='it-IT'); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    for scena in SCENE:
        print(f'{scena}:', flush=True)
        r = pg.evaluate(TROVA, [scena, 'ramp'])
        check(r is not None, f'{scena}: c\'è un trampolino gigante')
        if r:
            check(r['figli'] == 5, f'{scena}: sul trampolino gigante scritta + 2 pali + 2 cartelli', json.dumps(r))
            check(all(abs(abs(q['dx']) - 3.75) < 0.01 and q['sopra'] > 2.9 for q in r['pannelli']), f'{scena}: cartelli fuori dalla rampa e più alti dello stacco', json.dumps(r['pannelli']))
            pg.evaluate(VAI, [r['x'], r['z'] + 35]); f = f'{OUT}/{scena}-trampolino.png'; pg.screenshot(path=f)
            n = arancioni(f); check(n >= MIN_TRAMPOLINO, f'{scena}: CYF del trampolino gigante visibile da 35 m', f'{n} pixel arancioni')
        a = pg.evaluate(TROVA, [scena, 'arco'])
        check(a is not None, f'{scena}: c\'è un arco CYF sopra la pista')
        if a:
            check(a['basso'] > 9.5, f'{scena}: lo striscione è più in alto della testa nel salto più alto (~8,6 m)', f'bordo basso a {a["basso"]} m')
            pg.evaluate(VAI, [a['x'], a['z'] + 70]); f = f'{OUT}/{scena}-arco.png'; pg.screenshot(path=f)
            n = arancioni(f, 0.6); check(n >= MIN_ARCO, f'{scena}: striscione CYF visibile da 70 m', f'{n} pixel arancioni')
        # il rider fermo all'inizio: la giacca con la scritta CYF (foto da guardare)
        pg.evaluate("() => { const D = window.__dbg; D.reset(4242, null, false); return D.frames(8); }")
        pg.screenshot(path=f'{OUT}/{scena}-giacca.png')
        pg.evaluate("() => { window.__dbg.mode = 'menu'; document.getElementById('menu').hidden = false; }")
    check(not errs, 'nessun errore nella pagina', '; '.join(errs[:3]))
    br.close()
print('Foto in', OUT)
print('OK' if not fails else f'FALLITE {len(fails)}: ' + '; '.join(fails))
sys.exit(1 if fails else 0)
