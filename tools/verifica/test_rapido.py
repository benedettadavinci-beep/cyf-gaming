"""Giro rapido nel browser (~1-2 min), per il cancello dei test a ogni modifica.

Per ognuno dei 13 scenari: la pagina si apre senza errori, l'allenamento parte e il rider scende davvero.
Poi: pannello di debug con ?debug=1 e cattura degli errori nel registro della diagnosi.
Usa lo stato pubblicato da diagnosi.js (window.CYFDiag), quindi non modifica game.js.
"""
import os, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()
SCENE = ['neve', 'napoli', 'roma', 'milano', 'parigi', 'londra', 'francoforte', 'madrid', 'lisbona', 'zagabria', 'berlino', 'zurigo', 'newyork']
problems = []
def check(cond, label, extra=''):
    print(('  ✓ ' if cond else '  ✗ ') + label + (f'  [{extra}]' if extra else ''))
    if not cond: problems.append(label + (f' [{extra}]' if extra else ''))

t0 = time.time()
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(locale='it-IT', viewport={'width': 720, 'height': 460})
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    ctx.set_default_timeout(60000)

    print('R1 · 13 scenari nella stessa pagina: cambio scenario, allenamento, il rider scende, ritorno al menu')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and not any(x in (m.location or {}).get('url', '') for x in ('fonts.g', 'favicon')) else None)
    pg.goto(f'{BASE}/pista-nera/?scena=neve', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    check(pg.evaluate('window.CYFDiag.state().scena') == 'neve' and not errs, '?scena=neve apre la pagina senza errori', '; '.join(errs)[:200])
    for sc in SCENE:
        del errs[:]
        # clic via JS: con la grafica software Playwright aspetterebbe a lungo che la pagina sia ferma
        pg.evaluate("""sc => { const s = document.getElementById('selScena'); s.value = sc; s.dispatchEvent(new Event('change'));
                               document.getElementById('btnSolo').click(); }""", sc)
        try: pg.wait_for_function('window.CYFDiag.state().dist > 0.5', timeout=20000)
        except Exception: pass
        st = pg.evaluate('window.CYFDiag.state()')
        check(not errs and st['scena'] == sc and st['modo'] == 'solo' and st['dist'] > 0.5,
              f'{sc}: nessun errore, allenamento partito, {st["dist"]:.1f} m percorsi', '; '.join(errs)[:200])
        pg.evaluate("document.getElementById('btnMenu').click()")
        check(pg.evaluate('window.CYFDiag.state().modo') == 'menu', f'{sc}: ritorno al menu') if sc == SCENE[-1] else None
    pg.close()

    print('R2 · diagnosi: pannello, versione nel menu, errori nel registro')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?debug=1', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    pg.wait_for_timeout(1200)
    txt = pg.inner_text('#cyfDiag pre') if pg.query_selector('#cyfDiag') else ''
    check('fps' in txt and 'modo menu' in txt, 'con ?debug=1 il pannello mostra fps e stato', txt.split('\n')[0][:80])
    ver = pg.inner_text('#verLabel')
    check(ver.startswith('v') and ver != 'v?', 'numero di versione nel menu', ver)
    pg.evaluate("document.querySelector('#cyfDiag button[data-a=close]').click()")
    check(pg.query_selector('#cyfDiag') is None, '"Chiudi" spegne il pannello')
    pg.evaluate("for (let i = 0; i < 5; i++) document.getElementById('verLabel').click()")
    check(pg.query_selector('#cyfDiag') is not None, '5 tocchi sulla versione lo riaprono')
    pg.evaluate("setTimeout(() => { throw new Error('errore di prova') }, 0)")
    pg.wait_for_timeout(300)
    e = pg.evaluate('window.CYFDiag.errors')
    check(any('errore di prova' in x['msg'] for x in e), 'un errore JavaScript finisce nel registro della diagnosi', str(e)[:120])
    snap = pg.evaluate('window.CYFDiag.snapshot()')
    check(snap['ver'] == ver[1:] and any('[rete]' in l or '[gioco]' in l for l in snap['log']), 'la diagnosi contiene versione e registro degli eventi')
    mis = [l for l in snap['log'] if '[misure]' in l]
    check(len(mis) == 1, 'tempo di caricamento misurato una volta alla prima immagine (R-232; in locale non si invia)', mis[0] if mis else 'manca')
    pg.evaluate("localStorage.removeItem('cyf.debug')")
    pg.close()

    print('R3 · pista del giorno (R-233): pulsante nel menu, si parte subito nella città di oggi, niente banane')
    import json
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?scena=roma', wait_until='domcontentloaded')
    pg.wait_for_function("document.getElementById('dailyName').textContent.includes('#')", timeout=20000)
    G = pg.evaluate("fetch('/api/giorno', { cache: 'no-store' }).then(r => r.json())")
    nome = pg.inner_text('#dailyName'); info = pg.inner_text('#dailyInfo')
    check(f"#{G['n']}" in nome and info.strip() != '', 'nel menu il pulsante mostra numero e città di oggi, e sotto il migliore del giorno', nome + ' · ' + info)
    pg.evaluate("document.querySelector('[data-lang=en]').click()")
    check(pg.inner_text('#dailyName').find('Daily slope') >= 0, 'cambiando lingua il pulsante si traduce', pg.inner_text('#dailyName'))
    pg.evaluate("document.querySelector('[data-lang=it]').click()")
    pg.evaluate("document.getElementById('inName').value = 'Prova giorno'; document.getElementById('btnDaily').click()")
    try: pg.wait_for_function("['countdown', 'race'].includes(window.CYFDiag.state().modo) && window.CYFDiag.state().fase !== 'lobby'", timeout=30000)
    except Exception: pass
    st = pg.evaluate('window.CYFDiag.state()')
    check(st['modo'] in ('countdown', 'race') and st['scena'] == G['scena'] and st['stanza'].startswith('G') and st['gara'] == 12000,
          'si parte subito, senza stanza d\'attesa, nella città di oggi con la gara da 5 minuti', json.dumps({k: st[k] for k in ('modo', 'scena', 'stanza', 'gara')}))
    check(pg.evaluate("document.getElementById('items').hidden") and pg.evaluate("document.getElementById('lobby').hidden"), 'niente banane e bombe, e niente stanza della sfida')
    check(not errs and '?sfida=' not in pg.url, 'nessun errore e nessun link di sfida nell\'indirizzo', '; '.join(errs)[:200])
    br.close()

print(f'\nTempo: {time.time() - t0:.0f} s')
print('\n' + ('PROBLEMI:' if problems else 'NESSUN PROBLEMA'))
for x in problems: print(' -', x)
sys.exit(1 if problems else 0)
