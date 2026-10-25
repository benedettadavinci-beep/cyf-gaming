import json, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = sys.argv[2] if len(sys.argv) > 2 else '/home/claude/foto'
os.makedirs(OUT, exist_ok=True)
LANGS = {'it': 'it-IT', 'en': 'en-GB', 'fr': 'fr-FR', 'es': 'es-ES'}
EXPECT_HOME = {'it': 'Gioca', 'en': 'Play', 'fr': 'Jouer', 'es': 'Jugar'}
EXPECT_GAME = {'it': 'Crea una sfida', 'en': 'Create a challenge', 'fr': 'Créer un défi', 'es': 'Crear un desafío'}
DEVICES = {'telefono': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
           'pc': dict(viewport={'width': 1366, 'height': 860})}

OVERFLOW_JS = """() => {
  const out = [];
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('pagina più larga dello schermo: ' + document.documentElement.scrollWidth);
  document.querySelectorAll('button, a, span, li, p, h1, h2, label, select, option, div').forEach(el => {
    const cs = getComputedStyle(el);
    if (!el.offsetParent || cs.visibility === 'hidden') return;
    if (el.children.length) return;
    if (el.scrollWidth > el.clientWidth + 2 && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap')) out.push('testo tagliato: ' + el.textContent.trim().slice(0, 50));
  });
  return out;
}"""

problems = []
import os
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()
def local(ctx):
    ctx.route('**/cdnjs.cloudflare.com/**three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    return ctx
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    for dev, opts in DEVICES.items():
        for l, loc in LANGS.items():
            ctx = br.new_context(locale=loc, **opts); local(ctx)
            page = ctx.new_page()
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
            # 1. home: lingua scelta dal dispositivo
            page.goto(BASE + '/', wait_until='networkidle')
            got = page.evaluate('document.documentElement.lang')
            play = page.locator('.play').inner_text()
            if got != l or EXPECT_HOME[l] not in play: problems.append(f'{dev} {l}: home in "{got}", pulsante "{play}"')
            pressed = page.locator('[data-lang][aria-pressed="true"]').get_attribute('data-lang')
            if pressed != l: problems.append(f'{dev} {l}: selettore evidenzia {pressed}')
            desc = page.locator('meta[name=description]').get_attribute('content')
            for o in page.evaluate(OVERFLOW_JS): problems.append(f'{dev} {l} home: {o}')
            page.screenshot(path=f'{OUT}/home-{dev}-{l}.png', full_page=True)
            # 2. entra nel gioco dalla scheda: stessa lingua
            page.locator('[data-game]').click()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2500)
            glang = page.evaluate('document.documentElement.lang')
            body = page.locator('body').inner_text()
            if glang != l or EXPECT_GAME[l] not in body: problems.append(f'{dev} {l}: gioco in "{glang}", testo atteso mancante')
            if 'lang=' in page.url: problems.append(f'{dev} {l}: ?lang resta nell\'indirizzo {page.url}')
            for o in page.evaluate(OVERFLOW_JS): problems.append(f'{dev} {l} gioco: {o}')
            page.screenshot(path=f'{OUT}/gioco-{dev}-{l}.png')
            real = [e for e in errs if 'WebGL' not in e and 'GPU' not in e and 'favicon' not in e and 'ERR_FAILED' not in e]
            if real: problems.append(f'{dev} {l}: errori in console {real[:3]}')
            print(dev, l, 'home:', got, '|', play, '| gioco:', glang, '| descr:', desc[:40])
            ctx.close()

    # 3. scelta a mano sulla home, poi il gioco la rispetta; il gioco la cambia e la home la rispetta
    ctx = br.new_context(locale='it-IT', **DEVICES['telefono']); page = ctx.new_page(); local(ctx)
    page.goto(BASE + '/'); page.click('[data-lang=fr]')
    t = page.locator('[data-i18n=step1]').inner_text()
    page.goto(BASE + '/pista-nera/'); page.wait_for_timeout(1500)
    g = page.evaluate('document.documentElement.lang')
    page.click('#menu [data-lang=es]') if page.locator('#menu [data-lang=es]').count() else page.locator('[data-lang=es]').first.click()
    page.goto(BASE + '/'); h = page.evaluate('document.documentElement.lang')
    print('scelta a mano: home fr ->', t, '| gioco', g, '| cambio nel gioco a es -> home', h)
    if not (t.startswith('Saisis') and g == 'fr' and h == 'es'): problems.append('scelta a mano non condivisa tra home e gioco')
    ctx.close()

    # 4. link con ?lang=en e navigazione senza salvataggio (localStorage bloccato)
    ctx = br.new_context(locale='de-DE', **DEVICES['telefono']); local(ctx)
    ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('bloccato')}})")
    page = ctx.new_page(); page.goto(BASE + '/?lang=en')
    a = page.evaluate('document.documentElement.lang'); u = page.url
    page.locator('[data-game]').click(); page.wait_for_timeout(2000)
    b = page.evaluate('document.documentElement.lang')
    print('senza salvataggio, ?lang=en: home', a, '| indirizzo', u, '| gioco', b)
    if not (a == 'en' and b == 'en' and 'lang=' not in u): problems.append('?lang o navigazione privata non funziona')
    ctx.close()

    # 5. lingua del dispositivo non supportata (tedesco) -> italiano; seconda lingua del dispositivo usata
    ctx = br.new_context(locale='de-DE'); page = ctx.new_page(); page.goto(BASE + '/'); local(ctx)
    d = page.evaluate('document.documentElement.lang'); ctx.close()
    ctx = br.new_context(locale='de-DE'); ctx.add_init_script("Object.defineProperty(navigator,'languages',{get:()=>['de-DE','fr-CH']})"); local(ctx)
    page = ctx.new_page(); page.goto(BASE + '/'); d2 = page.evaluate('document.documentElement.lang'); ctx.close()
    print('dispositivo tedesco ->', d, '| tedesco+francese ->', d2)
    if d != 'it' or d2 != 'fr': problems.append('ripiego della lingua del dispositivo')

    # 6. invito ?sfida= con ?lang=: il codice resta
    ctx = br.new_context(locale='it-IT'); page = ctx.new_page(); local(ctx)
    page.goto(BASE + '/pista-nera/?sfida=K7QXM&lang=es'); page.wait_for_timeout(2500)
    print('invito con lingua:', page.evaluate('document.documentElement.lang'), page.url)
    if 'lang=' in page.url or page.evaluate('document.documentElement.lang') != 'es': problems.append('invito con ?lang')
    ctx.close()
    br.close()

print('\nPROBLEMI:' if problems else '\nNESSUN PROBLEMA')
for x in problems: print(' -', x)
import sys as _sys
_sys.exit(1 if problems else 0)   # esito per il cancello dei test: 1 = qualcosa non va
