"""Luce e colori (R-513 seconda parte, 0.39.0, moduli/luce.js), scritta partendo dal requisito.

Requisito: tutta la scena 3D passa per il tone mapping ACES; ogni scenario ha la sua esposizione e il suo equilibrio tra
sole e luce del cielo (sud: sole più forte, nord: più luce diffusa, Neve più esposta); cartoline dipinte, cielo e suolo
lontano NON passano per il tone mapping (sono colori finali); vale su ogni dispositivo; `?luce=vecchia` la spegne.
La scena non deve diventare più scura o più chiara di prima in modo visibile: la luminosità media della pista resta entro
il 15 % di quella con `?luce=vecchia`.
Parte 1: il modulo con un renderer finto (numeri esatti). Parte 2: il gioco vero in allenamento (Neve, Roma, Londra; PC e
telefono simulato), foto in OUT per il blocco 1. Esce con 1 se qualcosa non va."""
import io, json, os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """  window.__dbg = { get mode() { return mode; }, startSolo, get LUCE() { return LUCE; }, renderer, scene, hemi, sun,
    get theme() { return theme; }, applyTheme, god() { invuln = 1e9; lives = 99; } };
""")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what + (f' [{extra}]' if extra else ''))

SCENARI = ['neve', 'napoli', 'roma', 'milano', 'parigi', 'londra', 'francoforte', 'madrid', 'lisbona', 'zagabria', 'berlino', 'zurigo', 'newyork']
SUD, NORD = ['madrid', 'lisbona', 'roma', 'napoli'], ['londra', 'berlino', 'francoforte', 'milano']

FINTO = """(scenari) => {
  const R = { toneMapping: -1, toneMappingExposure: -1 }, hemi = { intensity: 0 }, sun = { intensity: 0 };
  const L = PN.luce({ renderer: R, hemi, sun });
  const out = { tipo: R.toneMapping, ACES: THREE.ACESFilmicToneMapping, tabella: Object.keys(L.TABELLA), v: {} };
  for (const s of scenari) { L.applica(s); out.v[s] = { esp: R.toneMappingExposure, sole: +sun.intensity.toFixed(4), cielo: +hemi.intensity.toFixed(4) }; }
  L.applica('roma', { luce: { esp: 0.97 } }); out.scheda = R.toneMappingExposure;
  L.applica('atlantide'); out.ignoto = R.toneMappingExposure;
  return out;
}"""

def nuova(br, **opz):
    ctx = br.new_context(**dict({'viewport': {'width': 1000, 'height': 640}, 'locale': 'it-IT'}, **opz)); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    return ctx

def gioca(ctx, scena, luce, foto=None):
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?qualita=alta&cielo=fermo&scena={scena}&luce={luce}', wait_until='domcontentloaded')
    pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    pg.evaluate("() => { __dbg.startSolo(); __dbg.god(); }")
    pg.wait_for_function("() => __dbg.mode === 'solo' || __dbg.mode === 'race'", timeout=30000)
    pg.wait_for_timeout(5000)   # le cartoline si dipingono nel worker
    info = pg.evaluate("""() => { const D = __dbg; const mats = [];
      D.scene.traverse(o => { const m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach(x => mats.push(x)); });
      const fondo = mats.filter(m => m.fog === false && ((m.isShaderMaterial && m.uniforms && m.uniforms.map) || (m.isMeshBasicMaterial && m.map)));   // cartoline e suolo lontano: dipinti, con la loro tela
      return { tipo: D.renderer.toneMapping, esp: D.renderer.toneMappingExposure, sole: +D.sun.intensity.toFixed(4), cielo: +D.hemi.intensity.toFixed(4),
        fondo: fondo.length, fondoToneMapped: fondo.filter(m => m.toneMapped !== false).length,
        attuale: D.LUCE.attuale, mode: D.mode }; }""")
    png = pg.screenshot()
    if foto: open(os.path.join(OUT, foto), 'wb').write(png)
    im = Image.open(io.BytesIO(png)).convert('L'); w, h = im.size
    info['pista'] = ImageStat.Stat(im.crop((w // 4, int(h * 0.62), 3 * w // 4, int(h * 0.86)))).mean[0]
    pg.close()
    return info, errs

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = nuova(br)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('() => !!(window.__dbg && PN.luce)'); pg.wait_for_timeout(500)

    print('1. Il modulo con un renderer finto:', flush=True)
    r = pg.evaluate(FINTO, SCENARI)
    check(r['tipo'] == r['ACES'], 'tone mapping ACES acceso alla creazione', str(r['tipo']))
    check(sorted(r['tabella']) == sorted(SCENARI), 'ogni scenario (Neve e 12 città) ha i suoi numeri', ','.join(sorted(set(SCENARI) ^ set(r['tabella']))))
    v = r['v']
    check(all(0.9 <= v[s]['esp'] <= 1.4 for s in SCENARI), 'esposizione tra 0,9 e 1,4 ovunque', json.dumps({s: v[s]['esp'] for s in SCENARI}))
    check(all(v[s]['sole'] > v[n]['sole'] and v[s]['cielo'] < v[n]['cielo'] for s in SUD for n in NORD),
          'città del sud: sole più forte e meno cielo delle città del nord', json.dumps({s: v[s] for s in SUD[:1] + NORD[:1]}))
    check(all(v['neve']['esp'] >= v[c]['esp'] for c in SCENARI), 'la Neve è la più esposta (la neve resta chiara)', str(v['neve']['esp']))
    check(abs(v['neve']['sole'] - 0.9) < 1e-6 and abs(v['neve']['cielo'] - 0.55) < 1e-6, 'nella Neve le luci restano quelle di prima (sole 0,9, cielo 0,55)', json.dumps(v['neve']))
    check(abs(r['scheda'] - 0.97) < 1e-6, 'una scheda città può dare la sua esposizione (luce.esp)', str(r['scheda']))
    check(0.9 <= r['ignoto'] <= 1.4, 'uno scenario sconosciuto prende i numeri medi', str(r['ignoto']))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs[:2]))
    pg.close()

    print('2. Il gioco vero, allenamento (PC, qualità alta): luce nuova contro ?luce=vecchia', flush=True)
    for sc in ['neve', 'roma', 'londra']:
        nuovo, e1 = gioca(ctx, sc, 'nuova', f'luce-{sc}.png')
        vecchio, e2 = gioca(ctx, sc, 'vecchia', f'luce-{sc}-vecchia.png')
        atteso = v[sc]
        check(nuovo['tipo'] == r['ACES'] and abs(nuovo['esp'] - atteso['esp']) < 1e-6, f'{sc}: ACES con esposizione {atteso["esp"]}', f'{nuovo["tipo"]} {nuovo["esp"]}')
        check(abs(nuovo['sole'] - atteso['sole']) < 1e-4 and abs(nuovo['cielo'] - atteso['cielo']) < 1e-4, f'{sc}: sole e cielo come la tabella', json.dumps([nuovo['sole'], nuovo['cielo']]))
        check(nuovo['fondo'] >= 1 and nuovo['fondoToneMapped'] == 0, f'{sc}: cartoline e suolo lontano fuori dal tone mapping', f'{nuovo["fondo"]} materiali, {nuovo["fondoToneMapped"]} con tone mapping')
        check(vecchio['tipo'] == 0 and vecchio['esp'] == 1 and abs(vecchio['sole'] - 0.9) < 1e-4, f'{sc}: con ?luce=vecchia tutto come prima', json.dumps([vecchio['tipo'], vecchio['esp'], vecchio['sole']]))
        d = (nuovo['pista'] - vecchio['pista']) / max(1, vecchio['pista'])
        check(abs(d) <= 0.15, f'{sc}: luminosità della pista entro il 15 % di prima', f'{vecchio["pista"]:.0f} → {nuovo["pista"]:.0f} ({d:+.0%})')
        check(nuovo['mode'] in ('solo', 'race') and not e1 and not e2, f'{sc}: si gioca, nessun errore', '; '.join((e1 + e2)[:2]))
    ctx.close()

    print('3. Telefono simulato (vale su ogni dispositivo):', flush=True)
    ctx = nuova(br, **{k: v for k, v in p.devices['Pixel 7'].items() if k != 'default_browser_type'})
    tel, e = gioca(ctx, 'madrid', 'nuova', 'luce-madrid-telefono.png')
    check(tel['tipo'] == r['ACES'] and abs(tel['esp'] - v['madrid']['esp']) < 1e-6, 'telefono, Madrid: stesso tone mapping e stessa esposizione del PC', f'{tel["tipo"]} {tel["esp"]}')
    check(not e, 'telefono: nessun errore', '; '.join(e[:2]))
    ctx.close()
    br.close()

print('foto in', OUT, '(luce-*.png: nuova e con ?luce=vecchia)')
print('\n' + ('PROBLEMI:\n - ' + '\n - '.join(fails) if fails else 'NESSUN PROBLEMA'))
raise SystemExit(1 if fails else 0)
