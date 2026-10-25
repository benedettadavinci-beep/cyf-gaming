"""Gara vera sul server locale (2 giocatori), poi il server 'manda' la classifica finale
(5 giocatori) per vedere schermata dei risultati, posizioni e testo da condividere nelle 4 lingue."""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto-risultati'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()   # copia locale di three r128: npm pack three@0.128.0
LANGS = {'it': 'it-IT', 'en': 'en-GB', 'fr': 'fr-FR', 'es': 'es-ES'}
problems = []

def local(ctx):
    ctx.route('**/cdnjs.cloudflare.com/**three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())

def results_msg(me_id):
    rs = [('Anna', 61234, 70, 4), ('Bob', 62100, 66, 2), ('ME', 63050, 64, 7), ('Dario', 65500, 59, 1), ('Eva', None, 40, 0)]
    out = []
    for i, (n, ms, top, tk) in enumerate(rs):
        rid = me_id if n == 'ME' else 'p' + n
        out.append({'id': rid, 'name': 'Tu' if n == 'ME' else n, 'color': i, 'ms': ms, 'dnf': ms is None, 'top': top, 'tk': tk, 'p': 100,
                    'earned': [100, 70, 50, 30, 0][i], 'won': i == 0, 'total': 500 if n == 'ME' else 0})
    return {'t': 'results', 'results': out, 'round': 1, 'minutes': 5,
            'awards': {'fastest': {'id': 'pAnna', 'name': 'Anna', 'color': 0, 'top': 70}, 'tricks': {'id': me_id, 'name': 'Tu', 'color': 2, 'tk': 7}}}

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for dev, opts in {'telefono': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True), 
                      'pc': dict(viewport={'width': 1366, 'height': 860})}.items():
        for l, loc in LANGS.items():
            if os.environ.get('SOLO') and f'{dev}-{l}' not in os.environ['SOLO'].split(','): continue
            host = br.new_context(locale=loc, **opts); local(host); host.set_default_timeout(120000)
            host.add_init_script("window.__shared=null; Object.defineProperty(navigator,'share',{value: async (d) => { window.__shared = d.text; }, configurable: true})")
            routes = []
            host.route_web_socket('**/api/room/**', lambda ws: routes.append((ws, ws.connect_to_server())))
            pg = host.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
            pg.fill('#inName', 'Tu')
            pg.click('#btnCreate') if pg.locator('#btnCreate').count() else pg.locator('button', has_text=['Crea', 'Create', 'Créer', 'Crear'][list(LANGS).index(l)]).first.click()
            pg.wait_for_timeout(1500)
            code = pg.evaluate("new URLSearchParams(location.search).get('sfida')")
            # secondo giocatore
            g = br.new_context(locale='it-IT', viewport={'width': 320, 'height': 240}); local(g); g.set_default_timeout(120000)
            g.add_init_script("localStorage.setItem('cyf.id','pGuest'); localStorage.setItem('cyf.name','Ospite')")
            gp = g.new_page(); gp.goto(f'{BASE}/pista-nera/?sfida={code}', wait_until='domcontentloaded'); gp.wait_for_timeout(2000)
            lobby = pg.locator('body').inner_text()
            go = pg.locator('#btnGo') if pg.locator('#btnGo').count() else pg.get_by_role('button', name={'it': 'Parti', 'en': 'Start', 'fr': 'Lancer', 'es': 'Empezar'}[l])
            go.first.click()
            pg.wait_for_timeout(9000)
            live = pg.locator('body').inner_text()
            pg.screenshot(path=f'{OUT}/gara-{dev}-{l}.png')
            me = pg.evaluate("localStorage.getItem('cyf.id')")
            ws, _ = routes[-1]
            ws.send(json.dumps(results_msg(me)))
            pg.wait_for_timeout(1500)
            res = pg.locator('#raceResults').inner_text() if pg.locator('#raceResults').count() else pg.locator('body').inner_text()
            pg.screenshot(path=f'{OUT}/risultati-{dev}-{l}.png')
            # testo condiviso: senza navigator.share apre WhatsApp, intercettiamo l'indirizzo
            pg.evaluate("window.__opened=[]; window.open=(u)=>{window.__opened.push(u); return null}")
            share = pg.locator('#btnShareRes')
            shared = ''
            if share.count():
                share.click(); pg.wait_for_timeout(300)
                shared = pg.evaluate('window.__shared') or ''
            over = pg.evaluate("""() => [...document.querySelectorAll('#raceResults *')].filter(e => e.offsetParent && !e.children.length && e.scrollWidth > e.clientWidth + 2 && (getComputedStyle(e).overflow !== 'visible' || e.tagName === 'BUTTON')).map(e => e.textContent.trim().slice(0,40)).concat([...document.querySelectorAll('#raceResults button')].filter(b => b.offsetParent && b.scrollWidth > b.clientWidth + 1).map(b => 'pulsante ' + b.textContent))""")
            print(f'--- {dev} {l}')
            print('  vivo   :', ' | '.join(x for x in live.split('\n') if x.strip())[:240])
            print('  finale :', ' | '.join(x for x in res.split('\n') if x.strip())[:400])
            print('  condivi:', shared)
            if over: problems.append(f'{dev} {l}: testi tagliati {over}')
            if errs: problems.append(f'{dev} {l}: errori {errs[:2]}')
            bad = {'en': ['°', '1e '], 'fr': ['°', '1e '], 'es': ['°'], 'it': []}[l]
            for b in bad:
                if b in res.replace('3°', '') or b in shared: problems.append(f'{dev} {l}: trovato "{b}" nei risultati/condivisione')
            g.close(); host.close()
    br.close()
print('\nPROBLEMI:' if problems else '\nNESSUN PROBLEMA')
for x in problems: print(' -', x)
import sys as _sys
_sys.exit(1 if problems else 0)   # esito per il cancello dei test: 1 = qualcosa non va
