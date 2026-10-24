"""Primo piano del rider da più angolazioni: espone camera/rider solo dentro il test (game.js modificato al volo)."""
import base64, sys, os
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/cyf-verifica/rider'
SCENA = sys.argv[2] if len(sys.argv) > 2 else 'neve'
os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()   # copia locale di three r128: npm pack three@0.128.0
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + "  window.__dbg = { camera, me, rider, scene, renderer, world, THREE, pose: (...a) => me.pose(...a) };\n")

SHOTS = [  # nome, posizione camera relativa al rider, punto guardato (y)
    ('dietro', (0.0, 1.7, 3.0), 0.85),      # come in gioco: alle spalle, un po' sopra
    ('fianco', (2.9, 1.2, 0.0), 0.85),       # dal lato del petto (+x)
    ('tre-quarti', (2.0, 1.3, -2.0), 0.85),   # davanti-lato: si vede il viso
    ('schiena', (-2.9, 1.2, 0.3), 0.85),
    ('testa', (0.55, 1.6, -0.75), 1.45),
    ('testa-dietro', (-0.3, 1.75, 0.85), 1.45),     # primo piano della testa
]
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(viewport={'width': 900, 'height': 900}, locale='it-IT')
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:8787/pista-nera/?scena={SCENA}', wait_until='domcontentloaded')
    pg.wait_for_function('window.__dbg', timeout=60000)
    pg.wait_for_timeout(1500)
    for pose_name, pose_args in [('normale', '0.35, 0.3, 0, 0, 0'), ('curva', '0.6, 0.6, 0.25, 0, 0'), ('raccolto', '0.95, 0.2, 0, 0, 0')]:
        for name, (dx, dy, dz), ly in SHOTS:
            if pose_name != 'normale' and name not in ('dietro', 'fianco', 'tre-quarti'): continue
            data = pg.evaluate("""([dx,dy,dz,ly,pa]) => {
              const D = window.__dbg, T = D.THREE;
              D.me.pose(...pa);
              const c = new T.PerspectiveCamera(35, 1, 0.05, 500);
              const r = D.rider; r.updateMatrixWorld(true);
              const base = new T.Vector3(); r.getWorldPosition(base);
              const q = new T.Quaternion(); r.getWorldQuaternion(q);
              const off = new T.Vector3(dx,dy,dz).applyQuaternion(q);
              c.position.copy(base).add(off);
              c.lookAt(base.clone().add(new T.Vector3(0, ly, 0).applyQuaternion(q)));
              D.renderer.setSize(900, 900, false);
              D.renderer.render(D.scene, c);
              return D.renderer.domElement.toDataURL('image/png');
            }""", [dx, dy, dz, ly, [float(x) for x in pose_args.split(',')]])
            open(f'{OUT}/{pose_name}-{name}.png', 'wb').write(base64.b64decode(data.split(',')[1]))
    print('errori:', errs[:3])
    br.close()
