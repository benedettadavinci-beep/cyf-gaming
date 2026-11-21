"""Misure delle prestazioni a ogni giro notturno, con soglie (A-14, riga 2 della tabella «Cosa fa Claude»).

Per il PC e per il telefono simulato misura:
  - peso della pagina: KB di pagina e file scaricati fino alla fine di 15 s di allenamento (corpi decompressi, Resource Timing);
  - caricamento: millisecondi dall'apertura a gioco pronto (scritta della versione in basso);
  - fps nel browser delle prove: media degli fps di gioco dopo 15 s di allenamento (qualità alta fissa, così la discesa
    automatica non cambia la misura). Il browser delle prove disegna con il processore (swiftshader): i numeri non sono
    quelli di un telefono vero, servono a vedere se una modifica rallenta rispetto alle notti prima.
Le soglie sono in `misure_soglie.json` accanto a questo file; il risultato va in OUT/misure.json.
Esce con 1 se una misura supera la soglia (peso o caricamento sopra il massimo, fps sotto il minimo)."""
import json, os, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica'); os.makedirs(OUT, exist_ok=True)
QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('CYF_REPO', os.path.join(QUI, '..', '..'))
SOGLIE = json.load(open(os.path.join(QUI, 'misure_soglie.json'), encoding='utf-8'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + "  window.__m = { startSolo, get QUALITA() { return QUALITA; }, get mode() { return mode; } };\n")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what + (f' [{extra}]' if extra else ''))

DISPOSITIVI = {
    'pc': dict(viewport={'width': 1280, 'height': 720}, device_scale_factor=1),
    'tel': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
}
risultati = {'quando': time.strftime('%Y-%m-%d %H:%M'), 'soglie': SOGLIE}
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for nome, opz in DISPOSITIVI.items():
        print(f'{nome}:', flush=True)
        ctx = br.new_context(locale='it-IT', **opz); ctx.set_default_timeout(180000)
        ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
        ctx.route('**/fonts.g*/**', lambda r: r.abort())   # i caratteri di Google non sono nostri: fuori dal peso
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/pista-nera/?qualita=alta', wait_until='domcontentloaded')
        pg.wait_for_function("() => { const v = document.getElementById('verLabel'); return v && /^v\\d/.test(v.textContent) && window.__m; }")
        ms = pg.evaluate('() => Math.round(performance.now())')
        fps = pg.evaluate("""() => { const M = window.__m; M.startSolo(); const t0 = performance.now();
          return new Promise(ok => { const w = () => (M.mode === 'race' || performance.now() - t0 > 30000) ? ok() : setTimeout(w, 200); w(); })
            .then(() => new Promise(ok => setTimeout(ok, 15000))).then(() => M.QUALITA.fps()); }""")
        # peso = pagina e tutti i file scaricati fino a qui (anche modelli, cartolina e suoni caricati dopo la partenza):
        # corpi decompressi (Resource Timing); game.js è quello della prova, con 1 riga in più
        kb = pg.evaluate("""() => Math.round(performance.getEntriesByType('navigation').concat(performance.getEntriesByType('resource'))
          .reduce((s, e) => s + (e.decodedBodySize || 0), 0) / 1024)""")
        s = SOGLIE[nome]
        risultati[nome] = {'peso_kb': kb, 'caricamento_ms': ms, 'fps': fps}
        check(kb <= s['peso_kb_max'], f'peso della pagina {kb} KB (massimo {s["peso_kb_max"]})')
        check(ms <= s['caricamento_ms_max'], f'caricamento {ms} ms (massimo {s["caricamento_ms_max"]})')
        check(fps >= s['fps_min'], f'fps nel browser delle prove {fps} (minimo {s["fps_min"]})')
        check(not errs, 'nessun errore nella pagina', '; '.join(errs[:2]))
        ctx.close()
    br.close()

json.dump(risultati, open(os.path.join(OUT, 'misure.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('misure in', os.path.join(OUT, 'misure.json'), json.dumps({k: risultati[k] for k in DISPOSITIVI}))
print('\n' + ('PROBLEMI:\n - ' + '\n - '.join(fails) if fails else 'NESSUN PROBLEMA'))
raise SystemExit(1 if fails else 0)
