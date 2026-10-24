import os
import json
from playwright.sync_api import sync_playwright
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()   # copia locale di three r128: npm pack three@0.128.0
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read().replace("  applyLang(lang);\n", "  applyLang(lang);\n  window.__dbg = { get P() { return P; }, stick, keys, get t() { return t; }, get mode() { return mode; }, god() { invuln = 1e9; lives = 99; } };\n")
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(locale='it-IT', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.set_default_timeout(90000)
    pg.goto('http://127.0.0.1:8787/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1000)
    pg.click('#btnSolo'); pg.wait_for_timeout(500); pg.evaluate('__dbg.god()')
    def run(label, setter, clear, gsecs):
        pg.evaluate('__dbg.god()'); pg.evaluate(setter); t0 = pg.evaluate('__dbg.t')
        pg.wait_for_function(f'__dbg.t - {t0} > {gsecs}', timeout=120000)
        r = pg.evaluate('({v: __dbg.P.speed, ang: __dbg.P.ang, crash: __dbg.P.crash})'); pg.evaluate(clear)
        print(f'{label:28s} dopo {gsecs}s di gioco: velocità {r["v"]:.1f} m/s  angolo {r["ang"]:.2f}  caduta {r["crash"]:.1f}')
    pg.wait_for_function('__dbg.t > 4', timeout=120000)
    run('tastiera giù (accelera)', '__dbg.keys.down = true', '__dbg.keys.down = false', 3)
    run('tastiera su (frena)', '__dbg.keys.up = true', '__dbg.keys.up = false', 3)
    run('rotellina su (accelera)', '__dbg.stick.y = -1', '__dbg.stick.y = 0', 3)
    run('rotellina giù (frena)', '__dbg.stick.y = 1', '__dbg.stick.y = 0', 3)
    run('tastiera destra', '__dbg.keys.right = true', '__dbg.keys.right = false', 0.4)
    run('rotellina destra piena', '__dbg.stick.x = 1', '__dbg.stick.x = 0', 0.4)
    run('rotellina sinistra piena', '__dbg.stick.x = -1', '__dbg.stick.x = 0', 0.8)
    run('rotellina sinistra a metà', '__dbg.stick.x = -0.4', '__dbg.stick.x = 0', 0.8)
    t_real = pg.evaluate('performance.now()') / 1000
    print('tempo di gioco', round(pg.evaluate('__dbg.t'), 1), 's su', round(t_real, 1), 's reali')
    br.close()
