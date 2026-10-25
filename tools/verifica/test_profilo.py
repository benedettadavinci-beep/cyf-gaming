"""Personaggio (R-227…R-229), capelli (R-225) e impostazioni ricordate con il codice personale (R-226), come su due telefoni:
il telefono A apre "Modifica il personaggio", sceglie maglia, pantaloni, capelli, casco e tavola, poi lingua e nome, e riceve il codice; il telefono B scrive il codice e ritrova tutto
(stesso giocatore); A cambia i capelli e B li ritrova alla riapertura; un codice sbagliato dà "Codice non trovato"."""
import os, sys, json
from playwright.sync_api import sync_playwright
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()
B=os.environ.get('BASE', 'http://127.0.0.1:8787') + '/pista-nera/'
def ctx(br, w=390, h=800):
    c = br.new_context(locale='it-IT', viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True)
    c.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript')); c.route('**/fonts.g*/**', lambda r: r.abort()); return c
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    a = ctx(br).new_page(); errs=[]; a.on('pageerror', lambda e: errs.append(str(e)))
    a.goto(B, wait_until='domcontentloaded'); a.wait_for_timeout(2500)
    a.fill('#inName', 'Luigi'); a.dispatch_event('#inName', 'change')
    a.click('#btnLook'); a.wait_for_timeout(500)
    a.select_option('#selHairStyle', 'coda'); a.select_option('#selHairColor', '3'); a.select_option('#selJersey', 'colore-verde')
    a.select_option('#selPants', '4'); a.select_option('#selHelmet', 'integrale'); a.select_option('#selHelmetColor', '2'); a.select_option('#selBoard', 'longboard'); a.select_option('#selBoardColor', '6')
    a.click('#btnLookDone')
    a.click('[data-lang="en"]'); a.wait_for_timeout(2500)
    code = a.evaluate("localStorage.getItem('cyf.codice')"); idA = a.evaluate("localStorage.getItem('cyf.id')")
    a.evaluate("document.getElementById('profBox').open = true"); a.evaluate("document.getElementById('profBox').scrollIntoView()"); a.wait_for_timeout(300)
    print('A', code, idA, a.evaluate("localStorage.getItem('cyf.hair')"), a.inner_text('#profCode'))
    ca = a.context; a.close()
    b = ctx(br).new_page(); b.on('pageerror', lambda e: errs.append(str(e)))
    b.goto(B, wait_until='domcontentloaded', timeout=90000); b.wait_for_timeout(2500)
    b.evaluate("document.getElementById('profBox').open = true")
    b.fill('#inProfCode', code[:4].lower()+'-'+code[4:].lower())
    with b.expect_navigation(timeout=60000): b.click('#btnProfUse')
    b.wait_for_function("document.getElementById('profCode').textContent.includes('-') && document.getElementById('inName').value", timeout=60000)
    r = b.evaluate("() => ({ id: localStorage.getItem('cyf.id'), name: document.getElementById('inName').value, hs: document.getElementById('selHairStyle').value, hc: document.getElementById('selHairColor').value, j: document.getElementById('selJersey').value, gear: ['cyf.pants', 'cyf.helmet', 'cyf.board'].map(k => localStorage.getItem(k)), lang: document.documentElement.lang, code: document.getElementById('profCode').textContent })")
    print('B', json.dumps(r))
    ok = r['id']==idA and r['name']=='Luigi' and r['hs']=='coda' and r['hc']=='3' and r['j']=='colore-verde' and r['gear']==['4', 'integrale:2', 'longboard:6'] and r['lang']=='en'
    # A cambia i capelli: B li ritrova alla prossima apertura
    b.close(); a = ca.new_page(); a.goto(B, wait_until='domcontentloaded', timeout=90000); a.wait_for_timeout(3000)
    a.click('#btnLook'); a.wait_for_timeout(500); a.select_option('#selHairStyle', 'rasati'); a.click('#btnLookDone'); a.wait_for_timeout(2500); cb = b.context; a.close()
    b = cb.new_page(); b.goto(B, wait_until='domcontentloaded', timeout=90000); b.wait_for_timeout(4000)
    hs2 = b.evaluate("document.getElementById('selHairStyle').value")
    print('B dopo modifica su A:', hs2)
    ok = ok and hs2 == 'rasati'
    b.close(); bad = ctx(br).new_page(); bad.goto(B, wait_until='domcontentloaded', timeout=90000); bad.wait_for_timeout(2000)
    bad.evaluate("document.getElementById('profBox').open = true"); bad.fill('#inProfCode', 'ZZZZ-ZZZZ'); bad.click('#btnProfUse'); bad.wait_for_timeout(1500)
    m = bad.inner_text('#profMsg'); print('codice sbagliato:', m); ok = ok and 'non trovato' in m
    print('errori pagina:', errs); br.close()
print('NESSUN PROBLEMA' if ok and not errs else 'PROBLEMI: profilo o capelli non ritrovati')
sys.exit(0 if ok and not errs else 1)
