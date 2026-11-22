"""Rilievo di neve e asfalto (R-513 seconda parte, 0.40.0, moduli/rilievo.js), scritta partendo dal requisito.

Requisito: il terreno della pista ha il rilievo ricavato dalla sua piastrella (punti chiari più alti dei scuri: righe
della neve battuta, sampietrini, pietre, asfalto), sulla neve una grana fine in più; si calcola una volta per scenario
(tela 512 sul PC, 256 sul telefono) e si ricorda; qualità alta e media sì, bassa no, e se la qualità cambia mentre si
gioca il rilievo si accende o si spegne; la piastrella si ripete senza giunture; solo grafica (la guida non cambia).
Parte 1: il modulo con un materiale finto e piastrelle disegnate (numeri esatti). Parte 2: il gioco vero (Neve, Roma,
Londra; qualità alta e bassa; telefono simulato), foto in OUT per il blocco 1. Esce con 1 se qualcosa non va."""
import json, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """  window.__dbg = { get mode() { return mode; }, get P() { return P; }, startSolo, RILIEVO, groundMat, QUALITA, keys,
    god() { invuln = 1e9; lives = 99; } };
""")
fails = []
def check(ok, what, extra=''):
    print(('  ✓ ' if ok else '  ✗ ') + what + (('  ' + extra) if extra else ''), flush=True)
    if not ok: fails.append(what + (f' [{extra}]' if extra else ''))

# piastrelle finte: 'piatta' (un colore solo), 'righe' (righe orizzontali come la neve battuta), 'colonne' (verticali)
FINTO = """(telefono) => {
  const tela = (disegno) => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#ffffff';
    if (disegno === 'righe') for (let y = 0; y < 512; y += 16) g.fillRect(0, y, 512, 8);
    if (disegno === 'colonne') for (let x = 0; x < 512; x += 16) g.fillRect(x, 0, 8, 512);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(50, 50); return t; };
  const map = { piatta: tela('piatta'), righe: tela('righe'), colonne: tela('colonne') };
  const M = new THREE.MeshStandardMaterial({ map: map.piatta }), G = { livello: 'alta' };
  const R = PN.rilievo({ materiale: M, grafica: G, telefono });
  const leggi = () => { const c = M.normalMap.image, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sx = 0, sy = 0, mz = 255, n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { sx += Math.abs(d[i] - 128); sy += Math.abs(d[i + 1] - 128); mz = Math.min(mz, d[i + 2]); }
    // giunture: differenza media tra la prima e l'ultima colonna/riga contro quella tra due colonne/righe vicine dentro
    const L = c.width, px = (x, y) => (y * L + x) * 4; let bordo = 0, dentro = 0;
    for (let k = 0; k < L; k++) { for (const ch of [0, 1]) { bordo += Math.abs(d[px(0, k) + ch] - d[px(L - 1, k) + ch]) + Math.abs(d[px(k, 0) + ch] - d[px(k, L - 1) + ch]);
      dentro += Math.abs(d[px(L / 2, k) + ch] - d[px(L / 2 - 1, k) + ch]) + Math.abs(d[px(k, L / 2) + ch] - d[px(k, L / 2 - 1) + ch]); } }
    return { lato: c.width, x: +(sx / n).toFixed(1), y: +(sy / n).toFixed(1), zMin: mz, bordo: +(bordo / L).toFixed(1), dentro: +(dentro / L).toFixed(1),
      wrap: M.normalMap.wrapS === THREE.RepeatWrapping && M.normalMap.wrapT === THREE.RepeatWrapping, repeat: M.normalMap.repeat.x }; };
  const out = {};
  M.map = map.piatta; R.applica('berlino'); out.piatta = leggi(); out.piattaForza = M.normalScale.x;
  M.map = map.righe; R.applica('neve'); out.righe = leggi(); out.neveForza = M.normalScale.x;
  M.map = map.colonne; R.applica('roma'); out.colonne = leggi(); out.romaForza = M.normalScale.x;
  const costruite = R.conta().costruite, tex = M.normalMap;
  M.map = map.colonne; R.applica('roma'); out.ricordata = R.conta().costruite === costruite && M.normalMap === tex;
  M.map = map.righe; R.applica('neve'); out.ricordataNeve = R.conta().costruite === costruite;
  G.livello = 'media'; R.passo(); out.media = !!M.normalMap;
  let v = M.version; G.livello = 'bassa'; R.passo(); out.bassa = M.normalMap === null; out.bassaRicompila = M.version > v;
  v = M.version; R.passo(); out.fermoNonRicompila = M.version === v;
  G.livello = 'alta'; R.passo(); out.ritorna = !!M.normalMap;
  G.livello = 'bassa'; R.applica('roma'); out.bassaApplica = M.normalMap === null;
  out.ms = R.conta().msUltima;
  return out;
}"""

def nuova(br, **opz):
    ctx = br.new_context(**dict({'viewport': {'width': 1000, 'height': 640}, 'locale': 'it-IT'}, **opz)); ctx.set_default_timeout(180000)
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    return ctx

def gioca(ctx, scena, qualita, foto=None):
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/pista-nera/?qualita={qualita}&cielo=fermo&scena={scena}', wait_until='domcontentloaded')
    pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    pg.evaluate("() => { __dbg.startSolo(); __dbg.god(); }")
    pg.wait_for_function("() => __dbg.mode === 'solo' || __dbg.mode === 'race'", timeout=30000)
    pg.wait_for_timeout(4000)
    info = pg.evaluate("() => Object.assign(__dbg.RILIEVO.conta(), { normale: !!__dbg.groundMat.normalMap, mode: __dbg.mode, livello: __dbg.QUALITA.livello })")
    if foto: pg.screenshot(path=os.path.join(OUT, foto))
    pg.close()
    return info, errs

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = nuova(br)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('() => !!(window.__dbg && PN.rilievo)'); pg.wait_for_timeout(500)

    print('1. Il modulo con un materiale finto (PC):', flush=True)
    r = pg.evaluate(FINTO, False)
    check(r['piatta']['lato'] == 512 and r['piatta']['wrap'] and r['piatta']['repeat'] == 50, 'tela 512, si ripete come la piastrella (50 volte)', json.dumps(r['piatta']))
    check(r['piatta']['x'] <= 1 and r['piatta']['y'] <= 1 and r['piatta']['zMin'] >= 250, 'piastrella di un colore solo (città, senza grana): terreno piatto', json.dumps(r['piatta']))
    check(r['righe']['y'] >= 8 and r['righe']['y'] >= 4 * r['righe']['x'], 'righe orizzontali (neve battuta): il rilievo pende avanti/indietro, poco di lato', json.dumps(r['righe']))
    check(r['colonne']['x'] >= 8 and r['colonne']['x'] >= 4 * r['colonne']['y'], 'righe verticali: il rilievo pende di lato', json.dumps(r['colonne']))
    check(r['righe']['x'] >= 0.3, 'sulla neve c\'è anche la grana fine (un po\' di rilievo in ogni direzione)', str(r['righe']['x']))
    check(r['colonne']['bordo'] <= 1.5 * r['colonne']['dentro'] + 2, 'nessuna giuntura dove la piastrella si ripete', json.dumps(r['colonne']))
    check(r['neveForza'] < r['piattaForza'] < r['romaForza'], 'neve più morbida, asfalto in mezzo, sampietrini di Roma più marcati', json.dumps([r['neveForza'], r['piattaForza'], r['romaForza']]))
    check(r['ricordata'] and r['ricordataNeve'], 'si calcola una volta per piastrella e si ricorda')
    check(r['media'], 'qualità media: rilievo acceso')
    check(r['bassa'] and r['bassaRicompila'], 'qualità scesa a bassa mentre si gioca: rilievo spento, materiale aggiornato')
    check(r['fermoNonRicompila'], 'senza cambi di qualità passo() non tocca il materiale')
    check(r['ritorna'], 'qualità risalita ad alta: rilievo di nuovo acceso')
    check(r['bassaApplica'], 'cambio di scenario con qualità bassa: niente rilievo')
    check(not errs, 'nessun errore nella pagina', '; '.join(errs[:2]))
    rt = pg.evaluate(FINTO, True)
    check(rt['piatta']['lato'] == 256 and rt['righe']['y'] >= 8, 'telefono: tela 256 con lo stesso rilievo', json.dumps(rt['righe']))
    pg.close()

    print('2. Il gioco vero, allenamento (PC):', flush=True)
    for sc in ['neve', 'roma', 'londra']:
        info, e = gioca(ctx, sc, 'alta', f'rilievo-{sc}.png')
        check(info['normale'] and info['acceso'] and info['lato'] == 512, f'{sc}, qualità alta: rilievo acceso', json.dumps(info))
        check(info['msUltima'] <= 150, f'{sc}: calcolato in meno di 150 ms nel browser delle prove (CPU simulata)', f'{info["msUltima"]} ms')
        check(info['mode'] in ('solo', 'race') and not e, f'{sc}: si gioca, nessun errore', '; '.join(e[:2]))
    info, e = gioca(ctx, 'roma', 'bassa', 'rilievo-roma-bassa.png')
    check(not info['normale'] and info['livello'] == 'bassa' and not e, 'Roma, qualità bassa: niente rilievo, nessun errore', json.dumps(info))
    ctx.close()

    print('3. Telefono simulato:', flush=True)
    ctx = nuova(br, **{k: v for k, v in p.devices['Pixel 7'].items() if k != 'default_browser_type'})
    info, e = gioca(ctx, 'napoli', 'media', 'rilievo-napoli-telefono.png')
    # sul telefono la qualità automatica scende sotto i 45 fps (il browser delle prove è lento): il rilievo deve seguirla
    check(info['costruite'] >= 1 and info['lato'] == 256 and info['normale'] == (info['livello'] != 'bassa') and not e,
          'telefono, Napoli, partito con qualità media: tela 256, rilievo acceso se la qualità è ancora media, spento se è scesa a bassa', json.dumps(info))
    ctx.close()
    br.close()

print('foto in', OUT, '(rilievo-*.png)')
print('\n' + ('PROBLEMI:\n - ' + '\n - '.join(fails) if fails else 'NESSUN PROBLEMA'))
raise SystemExit(1 if fails else 0)
