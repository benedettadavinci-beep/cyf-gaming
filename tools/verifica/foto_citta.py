"""Foto delle città con gli oggetti ai lati e i bordi, più conteggio di prop/edge e controllo che la pista resti identica."""
import json, os, sys
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto-citta'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()   # copia locale di three r128: npm pack three@0.128.0
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
GAME = GAME.replace(hook, hook + "  window.__dbg = { get P() { return P; }, get objs() { return GEN.objs; }, set mode(v) { mode = v; }, get mode() { return mode; }, reset, applyTheme, assets, CITY_CFG, center, camera, god() { invuln = 1e9; lives = 99; }, frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); } };\n")
SIDE = float(sys.argv[2]) if len(sys.argv) > 2 else 0
cities = sys.argv[1].split(',') if len(sys.argv) > 1 else ['napoli','roma','milano','parigi','londra','francoforte','madrid','lisbona','zagabria','berlino','zurigo','newyork']
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(locale='it-IT', viewport={'width': 720, 'height': 460}); ctx.set_default_timeout(120000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200); pg.evaluate(f'window.__side = {SIDE}')
    snow = pg.evaluate("() => { const D = window.__dbg; D.applyTheme('neve'); D.mode = 'solo'; D.reset(4242, null, false); return D.objs.filter(o => ['rock','gem','ramp','gate','marker'].includes(o.type) || (o.type === 'tree' && Math.abs(o.x - D.center(o.z)) < 16)).map(o => [o.type, +o.x.toFixed(2), +o.z.toFixed(2)]); }")
    for key in cities:
        info = pg.evaluate("""([key, z]) => { const D = window.__dbg; D.applyTheme(key); D.mode = 'solo'; D.reset(4242, null, false); D.god();
          const layout = D.objs.filter(o => ['rock','gem','ramp','gate','marker'].includes(o.type) || (o.type === 'tree' && Math.abs(o.x - D.center(o.z)) < 16)).map(o => [o.type, +o.x.toFixed(2), +o.z.toFixed(2)]);
          const by = {}; for (const o of D.objs) by[o.type] = (by[o.type] || 0) + 1;
          const props = D.objs.filter(o => o.type === 'prop').map(o => +Math.abs(o.x - D.center(o.z)).toFixed(1));
          D.P.z = z; D.P.x = D.center(z) + (window.__side || 0); D.P.ang = window.__side ? 0.45 : 0; D.P.speed = 22; document.getElementById('menu').hidden = true;
          return D.frames(6).then(() => ({ by, props, layout })); }""", [key, -140])
        pg.screenshot(path=f'{OUT}/{key}.png')
        same = info['layout'] == snow
        print(key, json.dumps(info['by']), 'prop a', info['props'][:6], 'm dal centro', '| pista uguale alla neve:', same)
        pg.evaluate("() => { window.__dbg.mode = 'menu'; document.getElementById('menu').hidden = false; }")
    print('errori:', errs)
    br.close()
