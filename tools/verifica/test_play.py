"""Google Play (R-547…R-549) nel browser: sito installabile, service worker «rete prima», app Android, privacy e termini.

Scritta partendo dai requisiti:
- R-548: la pagina dichiara manifest e icone; il service worker si registra (in locale solo con ?sw=1), con la rete lascia
  passare tutto e non salva le chiamate al server; senza rete riapre le pagine già viste e, per le altre, la pagina
  «Sei senza rete» nella lingua del giocatore.
- R-547: nell'app Android (?fonte=app) niente link per le donazioni, nel gioco e nella pagina iniziale; la visita si
  conta come "app", dall'icona della schermata Home come "icona".
- R-549: in fondo al menu i link a Privacy e Termini; le due pagine in 4 lingue con responsabile e contatto presi da
  config.js; il riquadro dei termini si apre e si chiude (il giro con il microfono vero è in test_vocale.py).
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
PHONE = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
problems = []
def check(cond, label, extra=''):
    print(('  ✓ ' if cond else '  ✗ ') + label + (f'  [{extra}]' if extra else ''))
    if not cond: problems.append(label + (f' [{extra}]' if extra else ''))
def nuovo(br, lingua='it-IT', **altro):
    ctx = br.new_context(locale=lingua, **PHONE, **altro)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    ctx.set_default_timeout(60000)
    return ctx
def gioco(pg, coda=''):
    pg.goto(f'{BASE}/pista-nera/{coda}', wait_until='domcontentloaded')
    pg.wait_for_function("window.PN && PN.app && PN.termini && window.CYFDiag && document.getElementById('verLabel').textContent")
DONA = "() => [...document.querySelectorAll('[data-donate]')].map(a => !a.hidden && !!a.getAttribute('href') && getComputedStyle(a).display !== 'none')"

with sync_playwright() as p:
    br = p.chromium.launch(args=ARGS)

    print('P1 · sito installabile (R-548): manifest e icone dichiarati nelle due pagine, niente service worker nelle prove senza ?sw=1')
    ctx = nuovo(br); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    gioco(pg)
    testa = pg.evaluate("""async () => {
      const q = s => { const e = document.querySelector(s); return e ? (e.getAttribute('href') || e.getAttribute('content')) : null; };
      const m = await (await fetch(q('link[rel=manifest]'))).json();
      return { manifest: q('link[rel=manifest]'), tema: q('meta[name=theme-color]'), apple: q('link[rel=apple-touch-icon]'), icona: q('link[rel=icon]'),
               start: m.start_url, nome: m.short_name, sw: (await navigator.serviceWorker.getRegistrations()).length,
               fonte: PN.app.fonte, attivo: PN.app.attivo, diag: CYFDiag.fonte, reg: await PN.app.sw };
    }""")
    check(testa['manifest'] == '/manifest.webmanifest' and testa['start'] == '/pista-nera/?fonte=icona' and testa['nome'] == 'Pista Nera' and testa['tema'] == '#0c1828' and testa['apple'] and testa['icona'],
          'la pagina del gioco dichiara manifest, colore e icone', json.dumps(testa))
    check(testa['sw'] == 0 and testa['reg'] is None, 'in locale, senza ?sw=1, il service worker non si registra (le altre prove misurano il sito senza)', str(testa['sw']))
    check(testa['fonte'] == '' and not testa['attivo'] and testa['diag'] == 'diretto', 'apertura normale: non è l\'app, visita "diretto"', json.dumps([testa['fonte'], testa['diag']]))
    check(all(pg.evaluate(DONA)), 'sul sito i link per le donazioni si vedono', json.dumps(pg.evaluate(DONA)))
    legali = pg.evaluate("() => [...document.querySelectorAll('.legali a')].map(a => [a.getAttribute('href'), a.textContent, a.offsetParent !== null])")
    check(legali == [['/privacy/', 'Privacy', True], ['/termini/', 'Termini d\'uso', True]], 'in fondo al menu i link a Privacy e Termini d\'uso (R-549)', json.dumps(legali, ensure_ascii=False))
    pg.goto(f'{BASE}/', wait_until='domcontentloaded'); pg.wait_for_timeout(400)
    home = pg.evaluate("""() => ({ manifest: document.querySelector('link[rel=manifest]').getAttribute('href'),
      piede: [...document.querySelectorAll('footer a')].map(a => [a.getAttribute('href'), a.textContent]), dona: !document.querySelector('[data-donate]').hidden })""")
    check(home['manifest'] == '/manifest.webmanifest' and home['piede'] == [['/privacy/', 'Privacy'], ['/termini/', 'Termini d\'uso']] and home['dona'],
          'anche la pagina iniziale dichiara il manifest e ha i link a Privacy e Termini', json.dumps(home, ensure_ascii=False))
    check(not errs, 'nessun errore nelle pagine', ' | '.join(errs)[:200])
    ctx.close()

    print('P2 · riquadro dei termini (R-549): si apre, «Non ora» non salva, «Accetto» salva la data dei termini')
    ctx = nuovo(br, 'en-GB'); pg = ctx.new_page(); gioco(pg)
    r1 = pg.evaluate("""async () => {
      const box = document.getElementById('termini'), prima = PN.termini.accettati();
      const a = PN.termini.chiedi(); const aperto = !box.hidden; const titolo = box.querySelector('h2').textContent, si = document.getElementById('btnTerminiSi').textContent;
      document.getElementById('btnTerminiNo').click(); const no = await a;
      const dopoNo = { chiuso: box.hidden, accettati: PN.termini.accettati(), salvato: localStorage.getItem('cyf.termini') };
      const b = PN.termini.chiedi(); document.getElementById('btnTerminiSi').click(); const ok = await b;
      return { prima, aperto, titolo, si, no, dopoNo, ok, chiuso: box.hidden, accettati: PN.termini.accettati(), salvato: localStorage.getItem('cyf.termini'), versione: PN.termini.VERSIONE, subito: await PN.termini.chiedi() };
    }""")
    check(not r1['prima'] and r1['aperto'] and r1['titolo'] == 'Before you send a voice message' and r1['si'] == 'I accept the terms', 'il riquadro si apre, nella lingua del giocatore (inglese)', json.dumps([r1['titolo'], r1['si']]))
    check(r1['no'] is False and r1['dopoNo'] == {'chiuso': True, 'accettati': False, 'salvato': None}, '«Non ora»: risposta no, riquadro chiuso, niente salvato', json.dumps(r1['dopoNo']))
    check(r1['ok'] is True and r1['chiuso'] and r1['accettati'] and r1['salvato'] == r1['versione'] and r1['subito'] is True, '«Accetto»: risposta sì, data dei termini salvata, la volta dopo non si chiede più', json.dumps([r1['salvato'], r1['versione']]))
    ctx.close()

    print('P3 · app Android (R-547): con ?fonte=app niente donazioni, nel gioco e nella pagina iniziale; ?fonte=icona è la schermata Home')
    ctx = nuovo(br); pg = ctx.new_page(); gioco(pg, '?fonte=app')
    a = pg.evaluate("() => ({ fonte: PN.app.fonte, attivo: PN.app.attivo, installata: PN.app.installata, diag: CYFDiag.fonte })")
    check(a == {'fonte': 'app', 'attivo': True, 'installata': True, 'diag': 'app'}, 'aperto dall\'app: PN.app.attivo e visita contata come "app"', json.dumps(a))
    check(not any(pg.evaluate(DONA)), 'nell\'app nessun link per le donazioni nel gioco (regole di Google Play sui pagamenti)', json.dumps(pg.evaluate(DONA)))
    check(pg.evaluate("() => [...document.querySelectorAll('.legali a')].every(a => a.offsetParent !== null)"), 'nell\'app i link a Privacy e Termini restano')
    gioco(pg)   # stessa scheda, indirizzo senza il parametro: resta l'app per tutta la visita
    check(pg.evaluate("PN.app.attivo") and not any(pg.evaluate(DONA)), 'resta l\'app per tutta la visita anche senza il parametro nell\'indirizzo')
    pg.goto(f'{BASE}/', wait_until='domcontentloaded'); pg.wait_for_timeout(400)
    check(pg.evaluate("document.querySelector('[data-donate]').hidden"), 'nell\'app nessun link per le donazioni nemmeno nella pagina iniziale')
    ctx.close()
    ctx = nuovo(br); pg = ctx.new_page(); gioco(pg, '?fonte=icona')
    i = pg.evaluate("() => ({ fonte: PN.app.fonte, attivo: PN.app.attivo, installata: PN.app.installata, diag: CYFDiag.fonte })")
    check(i == {'fonte': 'icona', 'attivo': False, 'installata': True, 'diag': 'icona'} and all(pg.evaluate(DONA)), 'dall\'icona della schermata Home: visita "icona", non è l\'app di Google Play (le donazioni restano)', json.dumps(i))
    ctx.close()
    ctx = nuovo(br); pg = ctx.new_page(); gioco(pg, '?sfida=ABCDE&fonte=app')
    check(pg.evaluate("CYFDiag.fonte") == 'sfida' and pg.evaluate("PN.app.attivo"), 'un link di sfida aperto nell\'app conta come "sfida" (la fonte più precisa) ma resta l\'app')
    ctx.close()

    print('P4 · service worker «rete prima» (R-548), con ?sw=1: con la rete tutto passa, senza rete le pagine viste e la pagina «senza rete»')
    ctx = nuovo(br, 'es-ES'); pg = ctx.new_page(); gioco(pg, '?sw=1')
    stato = pg.evaluate("""async () => { const r = await PN.app.sw; if (!r) return null; await navigator.serviceWorker.ready;
      for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(f => setTimeout(f, 100));
      return { scope: new URL(r.scope).pathname, attivo: !!r.active, controlla: !!navigator.serviceWorker.controller }; }""")
    check(stato == {'scope': '/', 'attivo': True, 'controlla': True}, 'il service worker si registra su tutto il sito, si attiva e prende subito la pagina', json.dumps(stato))
    gioco(pg, '?sw=1')   # seconda apertura: adesso ogni file passa dal service worker e resta una copia
    pg.wait_for_timeout(1500)
    copia = pg.evaluate("""async () => { const c = await caches.open((await caches.keys())[0]); const k = (await c.keys()).map(r => new URL(r.url).pathname + new URL(r.url).search);
      const stats = await (await fetch('/api/stats')).json();
      return { n: k.length, pagina: k.some(x => x.startsWith('/pista-nera/')), gioco: k.includes('/pista-nera/game.js'), offline: k.includes('/offline.html'), api: k.filter(x => x.startsWith('/api/')).length,
               sw: k.includes('/sw.js'), statsOk: Array.isArray(stats), versione: document.getElementById('verLabel').textContent }; }""")
    check(copia['n'] > 20 and copia['pagina'] and copia['gioco'] and copia['offline'], 'resta una copia delle pagine e dei file del gioco, più la pagina «senza rete»', json.dumps(copia))
    check(copia['api'] == 0 and not copia['sw'] and copia['statsOk'], 'le chiamate al server (/api/…) passano e non vengono mai salvate', str(copia['api']))
    pg.goto(f'{BASE}/privacy?sw=1', wait_until='domcontentloaded'); pg.wait_for_timeout(600)   # vista con la rete: l'indirizzo senza barra viene reindirizzato a /privacy/
    ctx.set_offline(True)
    pg.goto(f'{BASE}/pista-nera/?sw=1&sfida=ZZZZZ', wait_until='domcontentloaded')
    senza = pg.evaluate("() => ({ titolo: document.title, menu: !!document.getElementById('menu'), moduli: !!(window.PN && PN.app && PN.termini) })")
    check(senza['titolo'].startswith('Pista Nera') and senza['menu'] and senza['moduli'], 'senza rete il gioco si riapre dalla copia, anche con parametri diversi nell\'indirizzo', json.dumps(senza))
    api = pg.evaluate("fetch('/api/stats').then(r => 'risposta ' + r.status, e => 'errore di rete')")
    check(api == 'errore di rete', 'senza rete le chiamate al server falliscono (nessun dato vecchio spacciato per nuovo)', api)
    pg.goto(f'{BASE}/privacy', wait_until='domcontentloaded')
    check(pg.evaluate("document.querySelectorAll('[data-lingua]').length") == 4, 'senza rete si riapre anche una pagina vista dopo un reindirizzamento (/privacy)')
    pg.goto(f'{BASE}/pagina-mai-vista', wait_until='domcontentloaded')
    off = pg.evaluate("() => ({ h1: document.querySelector('h1').textContent, bottone: document.getElementById('riprova').textContent, lang: document.documentElement.lang })")
    check(off == {'h1': 'Estás sin conexión', 'bottone': 'Reintentar', 'lang': 'es'}, 'una pagina mai vista, senza rete, diventa «senza rete» nella lingua del giocatore (spagnolo)', json.dumps(off, ensure_ascii=False))
    ctx.set_offline(False)
    pg.goto(f'{BASE}/pista-nera/?sw=1', wait_until='domcontentloaded'); pg.wait_for_function("window.PN && PN.app")
    check(pg.evaluate("fetch('/api/stats').then(r => r.status)") == 200, 'tornata la rete, tutto riparte dal server')
    spento = pg.evaluate("""async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); return (await navigator.serviceWorker.getRegistrations()).length; }""")
    check(spento == 0, 'il service worker si può togliere (pulizia della prova)')
    ctx.close()
    ctx = nuovo(br); pg = ctx.new_page(); gioco(pg, '?sw=0')
    check(pg.evaluate("PN.app.sw.then(r => r === null)"), 'con ?sw=0 il service worker non si registra')
    ctx.close()

    print('P5 · pagine Privacy e Termini (R-549): 4 lingue, lingua del giocatore, responsabile e contatto da config.js')
    VISTA = "() => ({ lang: document.documentElement.lang, visibili: [...document.querySelectorAll('[data-lingua]')].filter(a => !a.hidden).map(a => a.getAttribute('data-lingua')), h1: document.querySelector('[data-lingua]:not([hidden]) h1').textContent, contatto: document.querySelector('[data-lingua]:not([hidden]) [data-contatto]').textContent, titolo: document.title })"
    for pagina, titoli in (('privacy', {'it': 'Privacy di Pista Nera', 'en': 'Pista Nera privacy', 'fr': 'Confidentialité de Pista Nera', 'es': 'Privacidad de Pista Nera'}),
                           ('termini', {'it': 'Termini d\'uso di Pista Nera', 'en': 'Pista Nera terms of use', 'fr': 'Conditions d\'utilisation de Pista Nera', 'es': 'Términos de uso de Pista Nera'})):
        ctx = nuovo(br, 'fr-FR'); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/{pagina}/', wait_until='domcontentloaded'); pg.wait_for_timeout(300)
        v = pg.evaluate(VISTA)
        check(v['lang'] == 'fr' and v['visibili'] == ['fr'] and v['h1'] == titoli['fr'] and v['titolo'].startswith(titoli['fr']), f'/{pagina}/ si apre nella lingua del dispositivo (francese), una lingua sola alla volta', json.dumps(v, ensure_ascii=False))
        check('Google Play' in v['contatto'], f'/{pagina}/: finché config.js non ha il contatto la pagina lo dice chiaramente', v['contatto'])
        viste = {}
        for l in ('it', 'en', 'es'):
            pg.click(f'[data-lang="{l}"]'); pg.wait_for_timeout(100); w = pg.evaluate(VISTA); viste[l] = [w['visibili'], w['h1']]
        check(all(viste[l] == [[l], titoli[l]] for l in viste) and pg.evaluate("localStorage.getItem('cyf.lang')") == 'es', f'/{pagina}/: i pulsanti cambiano lingua e la scelta resta (la stessa del gioco)', json.dumps(viste, ensure_ascii=False))
        pg.goto(f'{BASE}/{pagina}/?lang=en', wait_until='domcontentloaded'); pg.wait_for_timeout(200)
        check(pg.evaluate(VISTA)['visibili'] == ['en'], f'/{pagina}/?lang=en apre l\'inglese (indirizzo da dare a Google Play)')
        check(not errs, f'/{pagina}/ senza errori', ' | '.join(errs)[:200])
        ctx.close()
        # con responsabile e contatto scritti in config.js
        ctx = nuovo(br); pg = ctx.new_page()
        ctx.route('**/config.js*', lambda r: r.fulfill(body="window.CYF = { version: 'x', titolare: 'Mario Rossi', contatto: 'ciao@example.org' };", content_type='application/javascript'))
        pg.goto(f'{BASE}/{pagina}/', wait_until='domcontentloaded'); pg.wait_for_timeout(300)
        c = pg.evaluate("() => ({ t: [...new Set([...document.querySelectorAll('[data-titolare]')].map(e => e.textContent))], m: [...new Set([...document.querySelectorAll('[data-contatto] a')].map(a => a.getAttribute('href')))], vuoti: [...document.querySelectorAll('[data-contatto]')].filter(e => !e.querySelector('a')).length })")
        check(c == {'t': ['Mario Rossi'], 'm': ['mailto:ciao@example.org'], 'vuoti': 0}, f'/{pagina}/: responsabile e contatto (link email) presi da config.js, in tutte le lingue', json.dumps(c))
        ctx.close()

    br.close()

print()
if problems:
    print(f'PROBLEMI ({len(problems)}):')
    for x in problems: print(' -', x)
    sys.exit(1)
print('Google Play: tutto a posto')
