"""Qualità grafica scelta in automatico (A-14, R-524; moduli/qualita.js), scritta partendo dal requisito.

1. `?qualita=alta|media|bassa` forza il livello: sul PC (schermo con 2 pixel per pixel) alta = 2 pixel e ombre 2048,
   media = 1,5 e 1024, bassa = 1 e 512; la diagnosi mostra il livello.
2. PC: se nei primi 20 s di gioco la media è sotto i 28 fps si scende di un livello, una volta sola per pagina, e la scelta
   resta salvata (`cyf.qualita`); sopra i 28 fps non si scende; nei menu non si misura.
3. Telefono (R-524): pixel 1,5 / 1,25 / 1; si misura dopo 3 s su finestre di 5 s e si scende ogni volta che si va
   sotto i 45 fps, mai sotto bassa e mai in salita.
4. Le prove in locale non mandano niente a /api/fps.
Esce con 1 se qualcosa non va."""
import json, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + "  window.__q = { renderer, sun, get QUALITA() { return QUALITA; } };\n")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what + (f' [{extra}]' if extra else ''))

# un'istanza di prova del modulo con un renderer finto: si contano i pixel chiesti e la misura delle ombre
FINTO = """([tel, inizio, passi]) => {
  const chiesti = [];
  const ombra = { mapSize: { x: 2048, y: 2048, set(a, b) { this.x = a; this.y = b; } }, map: null };
  const Q = PN.qualita({ renderer: { setPixelRatio: v => chiesti.push(v) }, ombra, telefono: tel });
  if (inizio) Q.applica(inizio, false);
  const livelli = [];
  for (const [fps, secondi, giocando] of passi) {
    const dt = 1 / fps; let t = 0;
    while (t < secondi) { Q.tick(dt, giocando); t += dt; }
    livelli.push(Q.livello);
  }
  return { livelli, ombra: ombra.mapSize.x, pixel: chiesti[chiesti.length - 1], salvato: localStorage.getItem('cyf.qualita') };
}"""

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    def pagina(q='', dsf=2):
        ctx = br.new_context(viewport={'width': 900, 'height': 600}, device_scale_factor=dsf, locale='it-IT'); ctx.set_default_timeout(120000)
        ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
        ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
        ctx.route('**/fonts.g*/**', lambda r: r.abort())
        inviati = []
        ctx.route('**/api/fps', lambda r: (inviati.append(1), r.fulfill(status=200, body='{}')))
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/pista-nera/' + q, wait_until='domcontentloaded'); pg.wait_for_function('window.__q && window.CYFDiag'); pg.wait_for_timeout(800)
        return ctx, pg, errs, inviati

    print('1. ?qualita= forza il livello (PC, schermo 2×):', flush=True)
    attesi = {'alta': (2, 2048), 'media': (1.5, 1024), 'bassa': (1, 512)}
    for liv, (px, om) in attesi.items():
        ctx, pg, errs, _ = pagina('?qualita=' + liv)
        r = pg.evaluate("() => ({ px: window.__q.renderer.getPixelRatio(), om: window.__q.sun.shadow.mapSize.x, liv: window.__q.QUALITA.livello, diag: window.CYFDiag && window.CYFDiag.state ? window.CYFDiag.state().qualita : null })")
        check(r['liv'] == liv and abs(r['px'] - px) < 1e-6 and r['om'] == om, f'?qualita={liv}: pixel {px} e ombre {om}', json.dumps(r))
        if r['diag'] is not None: check(r['diag'] == liv, f'la diagnosi mostra qualita = {liv}', str(r['diag']))
        check(not errs, f'nessun errore nella pagina con ?qualita={liv}', '; '.join(errs[:2]))
        ctx.close()
    ctx, pg, errs, _ = pagina('?qualita=pazza')
    r = pg.evaluate("() => window.__q.QUALITA.livello")
    check(r == 'alta', 'un valore sconosciuto di ?qualita= non conta: sul PC resta alta', r)
    ctx.close()

    print('2. PC: discesa automatica una volta sola sotto i 28 fps:', flush=True)
    ctx, pg, errs, inviati = pagina('')
    r = pg.evaluate(FINTO, [False, 'alta', [[20, 21, True], [10, 25, True]]])
    check(r['livelli'] == ['media', 'media'], 'a 20 fps per 21 s si scende da alta a media, poi non si scende più', json.dumps(r))
    check(r['salvato'] == 'media' and r['ombra'] == 1024 and abs(r['pixel'] - 1.5) < 1e-6, 'scelta salvata in cyf.qualita, ombre 1024 e pixel 1,5', json.dumps(r))
    pg.evaluate("() => localStorage.removeItem('cyf.qualita')")
    r = pg.evaluate(FINTO, [False, 'alta', [[50, 22, True]]])
    check(r['livelli'] == ['alta'] and r['salvato'] is None, 'a 50 fps si resta in alta e non si salva niente', json.dumps(r))
    r = pg.evaluate(FINTO, [False, 'alta', [[10, 30, False]]])
    check(r['livelli'] == ['alta'], 'nei menu (non si gioca) non si misura', json.dumps(r))
    r = pg.evaluate(FINTO, [False, 'bassa', [[5, 22, True]]])
    check(r['livelli'] == ['bassa'], 'da bassa non si scende oltre', json.dumps(r))
    pg.evaluate("() => localStorage.removeItem('cyf.qualita')")

    print('3. Telefono (R-524): finestre di 5 s dopo 3 s, sotto i 45 fps si scende ogni volta:', flush=True)
    r = pg.evaluate(FINTO, [True, 'alta', [[30, 2.9, True], [30, 5.2, True], [30, 5.2, True], [30, 5.2, True]]])
    check(r['livelli'] == ['alta', 'media', 'bassa', 'bassa'], 'a 30 fps: niente nei primi 3 s, poi alta → media → bassa, mai sotto', json.dumps(r))
    check(abs(r['pixel'] - 1) < 1e-6 and r['ombra'] == 512 and r['salvato'] == 'bassa', 'telefono in bassa: 1 pixel, ombre 512, scelta salvata', json.dumps(r))
    pg.evaluate("() => localStorage.removeItem('cyf.qualita')")
    r = pg.evaluate(FINTO, [True, 'media', [[60, 20, True]]])
    check(r['livelli'] == ['media'] and abs(r['pixel'] - 1.25) < 1e-6, 'a 60 fps il telefono resta in media (1,25 pixel), mai in salita', json.dumps(r))
    r = pg.evaluate(FINTO, [True, 'bassa', [[60, 20, True]]])
    check(r['livelli'] == ['bassa'], 'anche con fps alti da bassa non si risale nella stessa pagina', json.dumps(r))

    print('4. In locale niente invii a /api/fps:', flush=True)
    pg.evaluate(FINTO, [False, 'alta', [[60, 50, True]]])
    pg.wait_for_timeout(500)
    check(len(inviati) == 0, 'dopo 50 s di gioco simulato su 127.0.0.1 nessuna richiesta a /api/fps', str(len(inviati)))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs[:2]))
    ctx.close()
    br.close()

print('\n' + ('PROBLEMI:\n - ' + '\n - '.join(fails) if fails else 'NESSUN PROBLEMA'))
raise SystemExit(1 if fails else 0)
