"""Polvere di neve (R-513 seconda parte, 0.38.0, moduli/polvere.js), scritta partendo dal requisito.

Requisito: solo nella Neve, dietro la tavola nuvolette che si allargano e spariscono in 1-1,6 s; da 8 m/s in su,
~7 al secondo a 20 m/s andando dritti, ~25 in curva forte; sbuffo di 5-14 all'atterraggio (più forte se si arriva giù
forte) e di 14 alla caduta; massimo 160 sul PC (70 sul telefono); qualità alta tutta, media metà, bassa niente; niente
con meno movimento, nelle città, nei menu e nel conto alla rovescia; non cambia la guida.
Parte 1: il modulo con uno stato finto (numeri esatti, tempo di gioco simulato). Parte 2: il gioco vero in allenamento
nella Neve e a Roma (nessun errore, polvere solo nella Neve), con meno movimento, e le foto in OUT per il blocco 1.
Esce con 1 se qualcosa non va."""
import json, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """  window.__dbg = { get P() { return P; }, get mode() { return mode; }, startSolo, keys, get POL() { return POLVERE; },
    god() { invuln = 1e9; lives = 99; },
    frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); } };
""")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what + (f' [{extra}]' if extra else ''))

# un'istanza del modulo con stato finto; passi = [[secondi, { campi di P }, mode, theme, livello], …]
# restituisce, per ogni passo, quante nuvolette sono nate in quel passo e quante sono vive alla fine
FINTO = """(passi) => {
  const P = { x: 0, z: 0, y: 0, vy: 0, speed: 0, ang: 0, air: false, onRamp: null, crash: 0 };
  const S = { P, mode: 'solo', theme: 'neve' }, G = { livello: 'alta' };
  const mondo = new THREE.Group();
  const Q = PN.polvere({ world: mondo, hgt: () => 0, renderer: { getDrawingBufferSize: v => v.set(800, 600) }, stato: S, grafica: G });
  const out = []; let misuraMax = 0;
  for (const [secondi, campi, mode, theme, livello] of passi) {
    Object.assign(P, campi); S.mode = mode || 'solo'; S.theme = theme || 'neve'; G.livello = livello || 'alta';
    const prima = Q.conta().nate; let viveMax = 0;
    for (let t = 0; t < secondi - 1e-9; t += 1 / 60) {
      Q.passo(1 / 60); P.z -= P.speed / 60;
      viveMax = Math.max(viveMax, Q.conta().vive);
      const m = Q.punti.geometry.attributes.aMisura.array; for (let i = 0; i < m.length; i++) misuraMax = Math.max(misuraMax, m[i]);
    }
    out.push({ nate: Q.conta().nate - prima, vive: Q.conta().vive, viveMax, visibile: Q.punti.visible, max: Q.conta().max });
  }
  return { out, misuraMax: +misuraMax.toFixed(2), nelMondo: mondo.children.includes(Q.punti) };
}"""

def nuova(br, **opz):
    ctx = br.new_context(viewport={'width': 1000, 'height': 640}, locale='it-IT', **opz); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    return ctx

def gioca(ctx, scena, foto=None):
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/?qualita=alta&scena=' + scena, wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    r = pg.evaluate("""() => { const D = window.__dbg; D.startSolo(); const t0 = performance.now();
      return new Promise(ok => { const w = () => (D.mode === 'solo' || D.mode === 'race' || performance.now() - t0 > 30000) ? ok() : setTimeout(w, 200); w(); })
        .then(() => { D.god(); const n0 = D.POL.conta().nate; D.keys.down = true; const t1 = performance.now();
          const giro = () => D.frames(1).then(() => { D.P.ang = Math.sin((performance.now() - t1) / 600) > 0 ? 0.9 : -0.9; return performance.now() - t1 < 6000 ? giro() : null; });
          return giro().then(() => { D.keys.down = false; return { mode: D.mode, nate: D.POL.conta().nate - n0, vive: D.POL.conta().vive, vel: +D.P.speed.toFixed(1) }; }); }); }""")
    if foto: pg.screenshot(path=os.path.join(OUT, foto))
    pg.close()
    return r, errs

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = nuova(br)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('() => !!(window.__dbg && PN.polvere)'); pg.wait_for_timeout(500)

    print('1. Il modulo con uno stato finto (tempo di gioco simulato a 60 fotogrammi al secondo):', flush=True)
    dritto = {'speed': 20, 'ang': 0, 'air': False, 'crash': 0}
    r = pg.evaluate(FINTO, [[10, dritto]])
    n = r['out'][0]['nate'] / 10
    check(5 <= n <= 9.5, 'Neve, dritti a 20 m/s, qualità alta: ~7 nuvolette al secondo', f'{n:.1f}/s')
    check(r['nelMondo'] and r['out'][0]['visibile'], 'le nuvolette sono nel mondo 3D e si vedono')
    check(0.6 <= r['misuraMax'] <= 3.2, 'si allargano fino a ~2-3 m, non oltre', str(r['misuraMax']))
    rc = pg.evaluate(FINTO, [[10, dict(dritto, ang=0.9)]])
    nc = rc['out'][0]['nate'] / 10
    check(18 <= nc <= 34 and nc >= 3 * n, 'curvando forte (angolo 0,9) ~25 al secondo, almeno il triplo che dritti', f'{nc:.1f}/s')
    r = pg.evaluate(FINTO, [[5, dict(dritto, speed=7.5)], [5, dict(dritto, speed=7.5, ang=1.2)]])
    check(r['out'][0]['nate'] == 0, 'sotto gli 8 m/s andando dritti niente polvere', json.dumps(r['out'][0]))
    r = pg.evaluate(FINTO, [[10, dritto, 'solo', 'neve', 'media']])
    nm = r['out'][0]['nate'] / 10
    check(0.3 * n <= nm <= 0.7 * n, 'qualità media: circa metà', f'{nm:.1f}/s contro {n:.1f}/s')
    r = pg.evaluate(FINTO, [[10, dict(dritto, ang=1.2), 'solo', 'neve', 'bassa'], [10, dict(dritto, ang=1.2), 'solo', 'roma'],
                            [5, dict(dritto, ang=1.2), 'menu'], [5, dict(dritto, ang=1.2), 'countdown']])
    check([o['nate'] for o in r['out']] == [0, 0, 0, 0], 'niente polvere con qualità bassa, in città (Roma), nel menu e nel conto alla rovescia', json.dumps([o['nate'] for o in r['out']]))
    check(not r['out'][-1]['visibile'], 'senza nuvolette vive i punti sono nascosti (niente da disegnare)')
    r = pg.evaluate(FINTO, [[0.5, dict(dritto, air=True, vy=-14, speed=0)], [1 / 60, dict(dritto, air=False, vy=0, speed=0)],
                            [0.5, dict(dritto, air=True, vy=-2, speed=0)], [1 / 60, dict(dritto, air=False, vy=0, speed=0)],
                            [1 / 60, dict(dritto, crash=1, speed=0)]])
    o = [x['nate'] for x in r['out']]
    check(o[0] == 0 and o[1] == 14, 'atterraggio forte (vy −14 m/s): sbuffo di 14', json.dumps(o))
    check(o[3] == 6, 'atterraggio leggero (vy −2 m/s): sbuffo piccolo (6)', json.dumps(o))
    check(o[4] == 14, 'caduta: sbuffo di 14', json.dumps(o))
    r = pg.evaluate(FINTO, [[8, dict(dritto, speed=29, ang=1.25)], [1.7, dict(dritto, speed=0)]])
    check(r['out'][0]['viveMax'] <= r['out'][0]['max'] == 160, 'mai più di 160 nuvolette insieme sul PC', json.dumps(r['out'][0]))
    check(r['out'][1]['vive'] == 0 and not r['out'][1]['visibile'], 'fermandosi, dopo 1,7 s non resta niente (vita 1-1,6 s)', json.dumps(r['out'][1]))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs[:2]))
    ctx.close()

    print('2. Il gioco vero, allenamento con freccia giù e curva (qualità alta):', flush=True)
    ctx = nuova(br)
    r, e = gioca(ctx, 'neve', 'polvere-neve.png')
    check(r['nate'] > 5, 'nella Neve la polvere si alza davvero mentre si gioca', json.dumps(r))
    check(not e, 'nessun errore nella Neve', '; '.join(e[:2]))
    r, e = gioca(ctx, 'roma', 'polvere-roma.png')
    check(r['nate'] == 0, 'a Roma (asfalto) niente polvere di neve', json.dumps(r))
    check(not e, 'nessun errore a Roma', '; '.join(e[:2]))
    ctx.close()
    ctx = nuova(br, reduced_motion='reduce')
    r, e = gioca(ctx, 'neve')
    check(r['nate'] == 0, 'con «meno movimento» chiesto dal dispositivo niente polvere', json.dumps(r))
    check(not e, 'nessun errore con meno movimento', '; '.join(e[:2]))
    ctx.close()
    print('3. Telefono simulato:', flush=True)
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='it-IT'); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page(); e = []; pg.on('pageerror', lambda x: e.append(str(x)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('() => !!(window.__dbg && PN.polvere)'); pg.wait_for_timeout(500)
    r = pg.evaluate(FINTO, [[8, {'speed': 29, 'ang': 1.25, 'air': False, 'crash': 0}]])
    check(r['out'][0]['max'] == 70 and r['out'][0]['viveMax'] <= 70, 'sul telefono mai più di 70 nuvolette insieme', json.dumps(r['out'][0]))
    check(not e, 'nessun errore sul telefono', '; '.join(e[:2]))
    ctx.close()
    br.close()

print('foto in', OUT, '(polvere-neve.png, polvere-roma.png)')
print('\n' + ('PROBLEMI:\n - ' + '\n - '.join(fails) if fails else 'NESSUN PROBLEMA'))
raise SystemExit(1 if fails else 0)
