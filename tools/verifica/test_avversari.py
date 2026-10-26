"""Avversari del computer (R-234…R-239, S-39) nel browser (Playwright, Chromium software).

A1 il tracciato degli avversari è la stessa pista che si vede (stessi alberi, rocce, rampe, porte e bonus)
A2 allenamento con 3 avversari: si muovono, hanno nomi e aspetti diversi, restano nei paraggi
A3 sfida con 2 avversari: scelta nella stanza, li guida chi organizza, l'altro li vede; banana a un avversario;
   chi organizza esce e li prende l'ospite; 🤖 nella classifica dal vivo e nei risultati
A4 sala online da soli: "Sono pronto" e si parte con 3 avversari
Serve wrangler dev su 127.0.0.1:8787 (lo accende tools/verifica/cancello.sh).
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """
  window.__dbg = {
    get P() { return P; }, get objs() { return GEN.objs; }, get mode() { return mode; }, set mode(v) { mode = v; }, get raceLen() { return raceLen; }, set raceLen(v) { raceLen = v; },
    get bonus() { return bonus; }, set bonus(v) { bonus = v; }, set invuln(v) { invuln = v; }, BOT, net, remotes, reset, applyTheme, ensureSpawned, center, PISTA,
    frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); }
  };
  window.__toasts = [];
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__toasts.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true });
""")
problems = []
def check(cond, label, extra=''):
    print(('  ✓ ' if cond else '  ✗ ') + label + (f'  [{extra}]' if extra else ''))
    if not cond: problems.append(label + (f' [{extra}]' if extra else ''))

def local(ctx):
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())

def page(br, pid, name, errs):
    c = br.new_context(locale='it-IT', viewport={'width': 640, 'height': 400}); local(c); c.set_default_timeout(120000)
    c.add_init_script(f"localStorage.setItem('cyf.id','{pid}'); localStorage.setItem('cyf.name','{name}')")
    pg = c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1000)
    return c, pg

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    errs = []
    c0, pg = page(br, 'pAvv1', 'Prova', errs)

    print('A1 · il tracciato degli avversari è la pista che si vede (R-234)')
    for theme, seed, mode in [('neve', 123, 'solo'), ('napoli', 456, 'race'), ('londra', 789, 'solo'), ('roma', 2468, 'race')]:
        r = pg.evaluate("""([theme, seed, mode]) => {
          const D = window.__dbg; D.applyTheme(theme); D.mode = mode; D.raceLen = 3000; D.reset(seed, null, mode === 'race');
          const dati = PN.tracciato.dati(seed, { center: D.center, gara: mode === 'race', lunghezza: 3000 });
          const key = o => o.type + ':' + o.x.toFixed(3) + ':' + o.z.toFixed(3) + (o.type === 'ramp' ? ':' + (o.big ? 1 : 0) : '');
          let diverse = 0, n = 0;
          for (let i = 0; i < 12; i++) {
            D.P.z -= 150; D.ensureSpawned(); dati.avanza(D.P.z - 200);
            const vis = new Set(D.objs.filter(o => ['tree', 'rock', 'ramp', 'gate', 'gem'].includes(o.type) && o.z < D.P.z + 10 && o.z > D.P.z - 190 && !(o.type === 'tree' && Math.abs(o.x - D.center(o.z)) > 20)).map(key));
            const dat = new Set(dati.vicini(D.P.z + 10, D.P.z - 190).map(key));
            for (const k of vis) if (!dat.has(k)) diverse++;
            for (const k of dat) if (!vis.has(k)) diverse++;
            n += vis.size;
          }
          D.mode = 'menu';
          return { n, diverse };
        }""", [theme, seed, mode])
        check(r['n'] > 300 and r['diverse'] == 0, f'{theme}, {"gara" if mode == "race" else "allenamento"}: stessi oggetti nello stesso punto', json.dumps(r))

    print('A2 · allenamento con 3 avversari (R-239)')
    pg.evaluate("document.getElementById('btnSolo').click()")
    pg.wait_for_function("window.__dbg.mode === 'solo' && window.__dbg.BOT.lista.length === 3", timeout=20000)
    a = pg.evaluate("""() => { const D = window.__dbg; D.invuln = 1e9; return D.BOT.lista.map(b => { const r = D.remotes.get(b.id); return { nome: b.nome, liv: b.liv, z: b.z, vis: !!(r && r.model.group.visible) }; }); }""")
    check(len(a) == 3 and sorted(x['liv'] for x in a) == ['forte', 'lento', 'medio'] and all(x['vis'] for x in a) and len({x['nome'] for x in a}) == 3,
          'tre avversari visibili, con nomi diversi, livelli misti', json.dumps(a))
    look = pg.evaluate("() => { const D = window.__dbg; return D.BOT.lista.map(b => JSON.stringify(PN.rider.lookBot(b.id))); }")
    check(len(set(look)) == 3, 'aspetti diversi (maglia, capelli, pantaloni, casco, tavola dal loro codice)')
    # accelera: il rider in automatico per un po' di fotogrammi
    pg.evaluate("window.__dbg.frames(150)")
    b = pg.evaluate("() => { const D = window.__dbg; return { P: D.P.z, bot: D.BOT.lista.map(b => ({ z: +b.z.toFixed(1), v: +b.speed.toFixed(1) })) }; }")
    check(all(x['z'] < -15 for x in b['bot']) and all(abs(x['z'] - b['P']) < 200 for x in b['bot']), 'scendono anche loro e restano nei paraggi del rider', json.dumps(b))
    pg.screenshot(path=os.path.join(OUT, 'avversari-allenamento.png'))
    check(not errs, 'nessun errore JavaScript in allenamento', '; '.join(errs[:2]))
    pg.evaluate("document.getElementById('btnMenu').click()")
    check(pg.evaluate("window.__dbg.BOT.lista.length === 0 && window.__dbg.remotes.size === 0"), 'tornando al menu gli avversari spariscono')

    print('A3 · sfida con 2 avversari: stanza, pilota, banana, cambio di pilota, risultati (R-234, R-237, S-39)')
    pg.evaluate("document.getElementById('inName').value = 'Capo'; document.getElementById('btnCreate').click()")
    pg.wait_for_function("window.__dbg.net.code && window.__dbg.net.ws && window.__dbg.net.ws.readyState === 1", timeout=20000)
    code = pg.evaluate("window.__dbg.net.code")
    errs2 = []
    c1, gp = page(br, 'pAvv2', 'Ospite', errs2)
    gp.goto(f'{BASE}/pista-nera/?sfida={code}', wait_until='domcontentloaded'); gp.wait_for_function('window.__dbg'); gp.wait_for_timeout(1500)
    gp.wait_for_function("window.__dbg.net.players.length === 2", timeout=20000)
    dis = gp.evaluate("[...document.querySelectorAll('[data-bots]')].every(b => b.disabled)")
    check(dis, 'chi non organizza non può scegliere gli avversari')
    pg.evaluate("document.querySelector('[data-bots=\"2\"]').click()")
    gp.wait_for_function("window.__dbg.net.bots === 2", timeout=10000)
    txt = gp.inner_text('#lobbyPlayers')
    check('🤖 + 2' in txt and gp.evaluate("document.querySelector('[data-bots=\"2\"]').getAttribute('aria-pressed') === 'true'"), 'nella stanza si vede "🤖 + 2 avversari del computer"', txt.replace('\n', ' | ')[:120])
    pg.evaluate("document.getElementById('btnGo').click()")
    pg.wait_for_function("!document.getElementById('btnPronto').hidden", timeout=60000); gp.wait_for_function("!document.getElementById('btnPronto').hidden", timeout=60000)
    r = gp.evaluate("() => { const D = window.__dbg; return { racers: D.net.racers.map(x => x.name + (x.bot ? '🤖' : '')), pilota: D.net.pilota, ready: D.net.ready.length }; }")
    check(len(r['racers']) == 4 and sum('🤖' in x for x in r['racers']) == 2 and r['pilota'] == 'pAvv1' and r['ready'] >= 2, 'in gara 2 persone e 2 avversari; li guida chi organizza; mano già alzata', json.dumps(r))
    pg.dispatch_event('#btnPronto', 'pointerdown'); gp.dispatch_event('#btnPronto', 'pointerdown')
    pg.wait_for_function("window.__dbg.mode === 'race'", timeout=90000); gp.wait_for_function("window.__dbg.mode === 'race'", timeout=90000)
    pg.evaluate("window.__dbg.invuln = 1e9"); gp.evaluate("window.__dbg.invuln = 1e9")
    pg.evaluate("window.__dbg.frames(60)")
    h = pg.evaluate("() => { const D = window.__dbg; return { modo: D.BOT.modo, n: D.BOT.lista.length, z: D.BOT.lista.map(b => +b.z.toFixed(1)) }; }")
    check(h['modo'] == 'gara' and h['n'] == 2 and all(z < -3 for z in h['z']), 'chi organizza guida i 2 avversari, che partono', json.dumps(h))
    gp.wait_for_function("(() => { const D = window.__dbg; const b = D.net.racers.filter(x => x.bot); return b.length === 2 && b.every(x => { const r = D.remotes.get(x.id); return r && r.has && r.tz < -5; }); })()", timeout=30000)
    g = gp.evaluate("() => { const D = window.__dbg; return { modo: D.BOT.modo, live: [...document.querySelectorAll('#liveList li .nm')].map(e => e.textContent) }; }")
    check(g['modo'] is None and sum('🤖' in x for x in g['live']) == 2, "l'ospite li vede scendere (non li guida) e in classifica dal vivo hanno il 🤖", json.dumps(g))
    # banana del pilota all'avversario davanti
    t = pg.evaluate("""() => { const D = window.__dbg; const b = D.BOT.lista[0]; D.P.z = b.z + 25; D.P.x = b.x; D.bonus = 200; window.__toasts.length = 0;
      for (const [id, r] of D.remotes) if (!D.BOT.guida(id)) r.model.group.visible = false;   // davanti c'è solo l'avversario
      document.getElementById('btnBanana').click();
      // la banana va all'avversario più vicino davanti: si controlla che quello si fermi
      return new Promise(res => setTimeout(() => { const toast = window.__toasts.join('|'), c = D.BOT.lista.find(x => toast.includes(x.nome));
        res({ toast, colpito: c ? c.nome : null, fermo: c ? c.stopUntil - performance.now() : 0 }); }, 700)); }""")
    check(t['colpito'] and t['fermo'] > 500, "banana lanciata all'avversario davanti: lui si ferma (R-224)", json.dumps(t))
    pg.screenshot(path=os.path.join(OUT, 'avversari-sfida.png'))
    # chi organizza esce: li prende l'ospite, da dove erano
    zprima = gp.evaluate("Math.min(...window.__dbg.net.racers.filter(x => x.bot).map(x => window.__dbg.remotes.get(x.id).tz))")
    c0.close()
    gp.wait_for_function("window.__dbg.net.pilota === 'pAvv2' && window.__dbg.BOT.lista.length === 2", timeout=30000)
    k = gp.evaluate("() => window.__dbg.BOT.lista.map(b => +b.z.toFixed(1))")
    check(all(z < -3 for z in k) and min(k) <= zprima + 30, "chi organizza esce: gli avversari li guida l'ospite e ripartono da dove erano (S-39)", json.dumps({'prima': zprima, 'dopo': k}))
    gp.evaluate("() => { const D = window.__dbg; D.P.z = -D.raceLen - 1; }")
    gp.wait_for_function("window.__dbg.mode === 'results'", timeout=30000)
    res = gp.inner_text('#resList')
    check(res.count('🤖') == 2, 'nei risultati gli avversari hanno il 🤖', res.replace('\n', ' | ')[:200])
    check(not errs2, 'nessun errore JavaScript nella sfida', '; '.join(errs2[:2]))
    c1.close()

    print('A4 · sala online da soli: si parte con 3 avversari (R-235)')
    errs3 = []
    c2, op = page(br, 'pAvv3' + str(os.getpid()), 'Solitario', errs3)
    op.evaluate("document.getElementById('btnOnline').click()")
    op.wait_for_function("window.__dbg.net.ws && window.__dbg.net.ws.readyState === 1 && window.__dbg.net.players.length === 1", timeout=20000)
    op.wait_for_timeout(800)
    st = op.inner_text('#lobbyStatus')
    check('avversari del computer' in st, 'da soli la stanza dice che tra poco si parte con gli avversari', st)
    op.evaluate("document.getElementById('btnReady').click()")
    op.wait_for_function("['countdown', 'race'].includes(window.__dbg.mode)", timeout=30000)
    r = op.evaluate("() => { const D = window.__dbg; return { bot: D.net.racers.filter(x => x.bot).length, pilota: D.net.pilota === D.net.racers.find(x => !x.bot).id }; }")
    check(r['bot'] == 3 and r['pilota'], 'gara con 3 avversari del computer, guidati da chi gioca', json.dumps(r))
    check(not errs3, 'nessun errore JavaScript nella sala online', '; '.join(errs3[:2]))
    c2.close()
    br.close()

print('\n' + ('PROBLEMI:' if problems else 'NESSUN PROBLEMA'))
for x in problems: print(' -', x)
sys.exit(1 if problems else 0)
