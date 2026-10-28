"""Prove nel browser delle novità 0.21-0.25 (scritte di giorno, provate dal turno di notte):
- N1 "batti il mio tempo" (R-236, S-44): riquadro "ti sfida" con ?batti=, indirizzo ripulito, ✕ che chiude;
- N2 missioni (R-243, S-45): riquadro nel menu, avanzamento mentre si gioca, stella e obiettivo nuovo, "mi" nel profilo;
- N3 modalità portale (R-244, S-46): niente donazioni e link, codice al posto del link nella stanza, vocali spenti;
- N4 città della settimana (R-245, S-47): riquadro nel menu, "Corri a …" mette la città nel menu;
- N5 Gran Premio delle 21 (R-247, S-49): riquadro con orario e conto alla rovescia, pulsante attivo solo nella finestra;
- N6 gara completa da un link "batti il mio tempo": riga del distacco in gara, esito nei risultati e pulsante Immagine
  (è la prova lunga: si scende tutta la pista del giorno #1, ~4-6 minuti).
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
problems = []
def check(cond, label, extra=''):
    print(('  ✓ ' if cond else '  ✗ ') + label + (f'  [{extra}]' if extra else ''))
    if not cond: problems.append(label + (f' [{extra}]' if extra else ''))

t0 = time.time()
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(locale='it-IT', viewport={'width': 720, 'height': 460}, accept_downloads=True)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    ctx.set_default_timeout(60000)

    print('N1 · "batti il mio tempo" (R-236): riquadro nel menu con ?batti=, indirizzo ripulito, ✕ che chiude')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?batti=1&t=61000&da=Marco&c=napoli', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    G = pg.evaluate("fetch('/api/giorno', { cache: 'no-store' }).then(r => r.json())")
    check(not pg.evaluate("document.getElementById('rivalCard').hidden"), 'il riquadro "ti sfida" compare nel menu')
    who = pg.inner_text('#rivalWho'); track = pg.inner_text('#rivalTrack')
    check('Marco' in who, 'il riquadro dice chi ti sfida', who)
    check('#1' in track and '1:01' in track, 'il riquadro dice la pista (#1) e il tempo da battere (1:01)', track)
    check('batti=' not in pg.url and 'da=' not in pg.url, 'la sfida è tolta dall\'indirizzo (resta solo nel menu)', pg.url)
    check(pg.evaluate("document.getElementById('rivalPast').hidden") == (G['n'] <= 1), 'la nota "pista di un giorno passato" compare solo se la pista non è quella di oggi')
    check(pg.evaluate("window.CYFDiag.fonte") == 'batti', 'la visita di chi apre il link ha fonte "batti" (R-246)', pg.evaluate("window.CYFDiag.fonte"))
    pg.evaluate("document.getElementById('btnRivalX').click()")
    check(pg.evaluate("document.getElementById('rivalCard').hidden"), '✕ chiude il riquadro')
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    pg.close()

    print('N2 · missioni (R-243): riquadro nel menu, avanzamento giocando, stella e obiettivo nuovo, "mi" nel profilo')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?scena=neve', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    # si parte con 4 stelle e il km3 quasi finito: bastano 15 m di discesa per la quinta stella
    # (con la grafica software il gioco va a ~0,15x: pochi metri costano già una decina di secondi)
    pg.evaluate("localStorage.setItem('cyf.missioni', '4;km3:2985,porte10:3,flip1:0')")
    pg.reload(wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    check(not pg.evaluate("document.getElementById('misBox').hidden"), 'il riquadro delle missioni è nel menu')
    check('⭐ 4' in pg.inner_text('#misTitle'), 'il titolo mostra le stelle', pg.inner_text('#misTitle'))
    check(pg.evaluate("document.querySelectorAll('#misList li').length") == 3, '3 obiettivi alla volta')
    pg.evaluate("document.getElementById('btnSolo').click()")
    pg.wait_for_function('window.CYFDiag.state().dist > 16', timeout=90000)
    pg.wait_for_function("(localStorage.getItem('cyf.missioni') || '').startsWith('5;')", timeout=30000)
    s = pg.evaluate("localStorage.getItem('cyf.missioni')")
    check(s.startswith('5;') and 'km3' not in s and len(s.split(';')[1].split(',')) == 3,
          'obiettivo raggiunto: stella nuova, il km3 lascia il posto a un obiettivo nuovo (sempre 3)', s)
    pg.evaluate("document.getElementById('btnMenu').click()")
    pg.wait_for_function("window.CYFDiag.state().modo === 'menu'")
    check('⭐ 5' in pg.inner_text('#misTitle'), 'tornati al menu il titolo mostra la stella nuova', pg.inner_text('#misTitle'))
    # "mi" nel profilo (R-226): il server lo salva e lo ridà con il codice personale
    prof = pg.evaluate("""fetch('/api/profilo', { method: 'POST', body: JSON.stringify({ id: 'mi' + Date.now(), data: { name: 'Mi', mi: '5;flip1:0,porte10:3,km3:0' } }) }).then(r => r.json())""")
    letto = pg.evaluate(f"fetch('/api/profilo?code={prof['code']}').then(r => r.json())")
    check(letto['data']['mi'] == '5;flip1:0,porte10:3,km3:0', 'le missioni viaggiano nel profilo (campo "mi") con il codice personale', json.dumps(letto['data'].get('mi')))
    sporco = pg.evaluate("""fetch('/api/profilo', { method: 'POST', body: JSON.stringify({ id: 'mx' + Date.now(), data: { name: 'Mx', mi: 'non-valido;;;' } }) }).then(r => r.json())""")
    letto2 = pg.evaluate(f"fetch('/api/profilo?code={sporco['code']}').then(r => r.json())")
    check(letto2['data'].get('mi', '') == '', 'un "mi" non valido non entra nel profilo', json.dumps(letto2['data'].get('mi')))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    pg.close()

    print('N3 · modalità portale (R-244): niente donazioni e link, codice al posto del link, vocali spenti')
    ctxP = br.new_context(locale='it-IT', viewport={'width': 720, 'height': 460})
    ctxP.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctxP.route('**/fonts.g*/**', lambda r: r.abort())
    ctxP.set_default_timeout(60000)
    pg = ctxP.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?portale=crazygames&scena=neve', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    st = pg.evaluate('window.CYFDiag.state()')
    check(st['portale'] == 'crazygames' and st['fonte'] == 'portale', 'il gioco sa di essere sul portale e la visita ha fonte "portale" (R-246)', f"{st['portale']} · {st['fonte']}")
    check(st['vocali'] == 0, 'i vocali partono spenti sul portale (S-46)', str(st['vocali']))
    check(pg.evaluate("document.documentElement.classList.contains('portale')"), 'la pagina ha la classe "portale"')
    check(pg.evaluate("[...document.querySelectorAll('[data-donate]')].every(a => getComputedStyle(a).display === 'none')"), 'niente pulsanti delle donazioni')
    check(pg.evaluate("[...document.querySelectorAll('a.brand')].every(a => !a.href)"), 'il titolo C-Y-F Gaming non è più un link')
    pg.evaluate("document.getElementById('inName').value = 'Portato'; document.getElementById('btnCreate').click()")
    pg.wait_for_function("window.CYFDiag.state().modo === 'lobby'", timeout=30000)
    check(pg.evaluate("document.getElementById('linkText').hidden") and pg.evaluate("document.getElementById('shareWa').hidden") and pg.evaluate("document.getElementById('shareTg').hidden"),
          'nella stanza niente link, WhatsApp e Telegram: gli amici entrano con il codice')
    check(len(pg.inner_text('#lobbyCode').strip()) >= 4, 'il codice della stanza si vede', pg.inner_text('#lobbyCode'))
    # la modalità resta per tutta la visita anche senza il parametro (sessionStorage)
    pg.goto(f'{BASE}/pista-nera/?scena=neve', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    check(pg.evaluate("window.CYFDiag.state().portale") == 'crazygames', 'la modalità portale resta per tutta la visita (sessionStorage)')
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    ctxP.close()

    print('N4 · città della settimana (R-245): riquadro nel menu e "Corri a …" che mette la città nel menu')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?scena=neve', wait_until='domcontentloaded')
    pg.wait_for_function("window.CYFDiag && window.CYFDiag.state && !document.getElementById('weekBox').hidden", timeout=30000)
    G = pg.evaluate("fetch('/api/giorno', { cache: 'no-store' }).then(r => r.json())")
    w = G.get('settimana') or {}
    nome = pg.inner_text('#weekName'); info = pg.inner_text('#weekInfo')
    check(f"#{w.get('n')}" in nome or str(w.get('n')) in nome, 'il riquadro della settimana è nel menu con il suo numero', nome)
    check(info.strip() != '', 'sotto c\'è la scadenza e il premio', info)
    pg.evaluate("document.getElementById('btnWeekGo').click()")
    check(pg.evaluate("document.getElementById('selScena').value") == w.get('scena'), '"Corri a …" mette la città della settimana nel menu', pg.evaluate("document.getElementById('selScena').value"))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    pg.close()

    print('N5 · Gran Premio delle 21 (R-247): riquadro con orario e attesa, pulsante attivo solo nella finestra')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?scena=neve', wait_until='domcontentloaded')
    pg.wait_for_function("window.CYFDiag && window.CYFDiag.state && !document.getElementById('gpBox').hidden", timeout=30000)
    gp = pg.evaluate("fetch('/api/gp', { cache: 'no-store' }).then(r => r.json())")
    nome = pg.inner_text('#gpName'); info = pg.inner_text('#gpInfo')
    check(nome.strip() != '' and ':' in nome, 'il riquadro mostra l\'orario del Gran Premio', nome)
    check(info.strip() != '', 'sotto c\'è il conto alla rovescia o lo stato', info)
    check(pg.evaluate("document.getElementById('btnGp').disabled") == (not gp['aperto']),
          'il pulsante "Entra" è attivo solo da 10 minuti prima a 6 minuti dopo il via', f"aperto={gp['aperto']}")
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    pg.close()

    print('N6 · "batti il mio tempo" in gara (R-236): si accetta la sfida e in pista c\'è la riga del distacco')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?batti=1&t=61000&da=Marco&c=napoli', wait_until='domcontentloaded')
    pg.wait_for_function('window.CYFDiag && window.CYFDiag.state')
    pg.evaluate("document.getElementById('inName').value = 'Sfidante'")
    pg.evaluate("document.getElementById('btnRivalGo').click()")
    try: pg.wait_for_function("['countdown', 'race'].includes(window.CYFDiag.state().modo)", timeout=30000)
    except Exception: pass
    st = pg.evaluate('window.CYFDiag.state()')
    check(st['modo'] in ('countdown', 'race') and st['scena'] == 'napoli' and st['stanza'].startswith('G'),
          'Accetta la sfida: si corre la pista del giorno #1, a Napoli', json.dumps({k: st[k] for k in ('modo', 'scena', 'stanza')}))
    pg.wait_for_function("window.CYFDiag.state().modo === 'race'", timeout=30000)
    try: pg.wait_for_function("!document.getElementById('rival').hidden && document.getElementById('rival').textContent.includes('Marco')", timeout=30000)
    except Exception: pass
    riga = pg.inner_text('#rival')
    check('Marco' in riga and 's' in riga, 'in gara c\'è la riga con il distacco stimato da Marco', riga)
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    pg.close()

    # La discesa completa dei 4,2 km non si può fare qui: con la grafica software il gioco va a ~0,15x (dt a 0,033 s)
    # e il traguardo arriverebbe dopo più di mezz'ora. Esito e Immagine si provano sul modulo vero (sfida.js) con una
    # gara finita pilotata: pagina reale senza game.js, PN.sfida creato dalla prova con i risultati in mano.
    print('N7 · esito e Immagine (R-236, D-05): il modulo sfida con una gara finita pilotata')
    ctxS = br.new_context(locale='it-IT', viewport={'width': 720, 'height': 460}, accept_downloads=True)
    ctxS.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctxS.route('**/fonts.g*/**', lambda r: r.abort())
    ctxS.route('**/pista-nera/game.js', lambda r: r.fulfill(body='window.__senzaGioco = 1;', content_type='application/javascript'))
    ctxS.set_default_timeout(60000)
    pg = ctxS.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?batti=1&t=61000&da=Marco&c=napoli', wait_until='load')
    pg.wait_for_function('window.__senzaGioco === 1 && window.PN && PN.sfida && PN.lingua && PN.portale')
    pg.evaluate("""() => {
      const finiti = new Map([['me1', 55000]]);
      window.__stato = {
        mode: 'results', myId: 'me1', theme: 'napoli', raceLen: 4200, nome: () => 'Io',
        serverNow: () => 100000, distM: () => 2100,
        net: { daily: true, giorno: { n: 1, scena: 'napoli', rivincita: true }, results: [{ id: 'me1', name: 'Io', ms: 55000 }],
               finished: finiti, startAt: 0, round: 1, minutes: 5, pub: false, code: 'GPROVA' }
      };
      window.__S = PN.sfida({ stato: window.__stato, schermate: { cityName: s => s, giorno: { n: 3, scena: 'roma' } },
        say: () => {}, foto: () => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; }, accetta: () => {} });
      window.__S.render();
    }""")
    check(pg.evaluate('window.__S.sfida && window.__S.sfida.da') == 'Marco' and pg.evaluate('window.__S.sfida.ms') == 61000,
          'il modulo legge la sfida dal link (Marco, 1:01)')
    # riga del distacco: a metà pista (2.100 m) con 55 s stimati si è avanti di 30,5 − 55? no: tempo mio 55 s, Marco a metà sarebbe a 30,5 s → siamo dietro
    pg.evaluate("window.__stato.mode = 'race'; window.__S.hud(1)")
    riga = pg.inner_text('#rival')
    check('Marco' in riga and '+' in riga, 'la riga del distacco stima dove sarebbe Marco alla sua media (qui siamo dietro: +)', riga)
    pg.evaluate("window.__stato.mode = 'results'; window.__S.risultati()")
    check(not pg.evaluate("document.getElementById('resRival').hidden"), 'nei risultati compare l\'esito contro Marco')
    esito = pg.inner_text('#resRival')
    vinta = pg.evaluate("document.getElementById('resRival').classList.contains('win')")
    check('Marco' in esito and vinta, 'con 55 s contro 1:01 la sfida è vinta ("Hai battuto Marco…")', esito)
    with pg.expect_download(timeout=30000) as dl:
        pg.evaluate("document.getElementById('btnImgRes').click()")
    nomefile = dl.value.suggested_filename
    check(nomefile.startswith('pista-nera-giorno-1') and nomefile.endswith('.png'), 'il pulsante Immagine produce il PNG del risultato (D-05)', nomefile)
    # e se si perde? risultato più lento del tempo da battere
    pg.evaluate("window.__stato.net.results[0].ms = 70000; window.__stato.net.finished.set('me1', 70000); window.__S.risultati()")
    check(not pg.evaluate("document.getElementById('resRival').classList.contains('win')") and 'Marco' in pg.inner_text('#resRival'),
          'con 1:10 contro 1:01 la sfida è persa ("Marco è ancora davanti…")', pg.inner_text('#resRival'))
    check(not errs, 'nessun errore nella pagina', '; '.join(errs)[:150])
    ctxS.close()
    br.close()

print(f'\nTempo: {time.time() - t0:.0f} s')
print('\n' + ('PROBLEMI:' if problems else 'NESSUN PROBLEMA'))
for x in problems: print(' -', x)
sys.exit(1 if problems else 0)
