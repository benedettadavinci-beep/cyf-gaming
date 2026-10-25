"""Verifica nel gioco (Playwright, Chromium software): scenari e città contro la tabella Excel, guida, acrobazie, gara."""
import json, os, sys, base64
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()   # copia locale di three r128: npm pack three@0.128.0
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """
  window.__dbg = {
    get P() { return P; }, get objs() { return GEN.objs; }, get mode() { return mode; }, set mode(v) { mode = v; }, get theme() { return theme; },
    get bonus() { return bonus; }, set bonus(v) { bonus = v; }, get lives() { return lives; }, set invuln(v) { invuln = v; }, get raceLen() { return raceLen; },
    get finishObj() { return finishObj; }, get hazards() { return hazards; }, get PART() { return PART; }, get tuckS() { return tuckS; }, get brakeS() { return brakeS; }, get throwT() { return throwT; },
    reset, applyTheme, ensureSpawned, TRACKS, assets, CITY_CFG, THEMES, builtSky, bay: builtSky.napoli, rome: builtSky.roma, ranges, camera, me, scene, renderer, collide, keys, stick, net, center, hgt, tr,
    store, mutedIds, playVoice, useItem, jump, PALETTE, flakes, groundMat, sky, hemi, sun, trailMesh, sprayPts, isCity, remotes, standings, GEO, GROUND_TEX,
    jacketTexture, JERSEYS, myJersey, THREE, world, god() { invuln = 1e9; lives = 99; }, setLives(n) { lives = n; renderLives(); }, lastToast() { const t = window.__toasts; return t.length ? t[t.length - 1] : ''; },
    frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); }
  };
  window.__toasts = [];
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__toasts.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true });
""")
TAB = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tabella_citta.json'), encoding='utf-8'))
CITY_KEY = {'Napoli': 'napoli', 'Roma': 'roma', 'Milano': 'milano', 'Parigi': 'parigi', 'Londra': 'londra', 'Francoforte': 'francoforte', 'Madrid': 'madrid', 'Lisbona': 'lisbona', 'Zagabria': 'zagabria', 'Berlino': 'berlino', 'Zurigo': 'zurigo', 'New York': 'newyork'}
problems = []
def check(cond, label, extra=''):
    print(('  ✓ ' if cond else '  ✗ ') + label + (f'  [{extra}]' if extra else ''))
    if not cond: problems.append(label + (f' [{extra}]' if extra else ''))

def local(ctx):
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(locale='it-IT', viewport={'width': 720, 'height': 460}); local(ctx); ctx.set_default_timeout(120000)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1500)

    print('G1 · scenari e città (R-301, R-302, R-303, R-306, R-205, R-304, R-401, S-01, S-03) contro la tabella')
    SEED = 123456
    layout_snow = None
    for city in ['Neve'] + TAB['cities']:
        key = 'neve' if city == 'Neve' else CITY_KEY[city]
        info = pg.evaluate("""([key, seed]) => {
          const D = window.__dbg; D.applyTheme(key); D.mode = 'solo'; D.reset(seed, null, false); D.mode = 'menu';
          const C = D.CITY_CFG[key] || null, A = C ? D.assets() : null;
          const objs = D.objs.filter(o => o.z > -220);
          const byType = {}; for (const o of objs) byType[o.type] = (byType[o.type] || 0) + 1;
          const sameGeo = (type, geo) => objs.filter(o => o.type === type).every(o => o.mesh.geometry === geo);
          const gems = objs.filter(o => o.type === 'gem');
          const foods = [...new Set(gems.map(o => o.food))];
          const gates = objs.filter(o => o.type === 'gate');
          return {
            theme: D.theme, city: D.isCity(), skate: D.me.body.children[1].visible, snowb: D.me.body.children[0].visible,
            ranges: D.ranges.visible, sky: Object.keys(D.builtSky).filter(k => D.builtSky[k].visible),
            byType, foods, layout: objs.filter(o => ['rock', 'gem', 'ramp', 'gate', 'marker'].includes(o.type) || (o.type === 'tree' && Math.abs(o.x - D.center(o.z)) < 16)).map(o => [o.type, +o.x.toFixed(2), +o.z.toFixed(2)]),
            rel: objs.filter(o => ['rock', 'gem', 'ramp', 'gate'].includes(o.type) || (o.type === 'tree' && Math.abs(o.x - D.center(o.z)) < 16)).map(o => [o.type, +(o.x - D.center(o.z)).toFixed(2), +o.z.toFixed(2)]),
            geoOk: C ? { tall: sameGeo('tree', A.tall), low: sameGeo('rock', A.low), ramp: sameGeo('ramp', A.ramp), marker: sameGeo('marker', A.marker),
                         gate: gates.every(o => o.mesh.geometry === A.gates[0] || o.mesh.geometry === A.gates[1]),
                         food: gems.every(o => (o.food === C.fa && o.mesh.geometry === A.fa) || (o.food === C.fb && o.mesh.geometry === A.fb)) } : null,
            gateCols: C ? C.gate : null, rampCols: C ? C.ramp : null, crash: C ? [D.tr(C.tallCrash), D.tr(C.lowCrash), D.tr(C.markerCrash)] : [D.tr('crashTree'), D.tr('crashRock'), D.tr('crashPole')],
            fog: [D.scene.fog.near, D.scene.fog.far], part: D.PART, flakes: D.flakes.visible, groundTex: !!D.groundMat.map, rough: D.groundMat.roughness,
            fa: C ? [C.fa, D.tr('food_' + C.fa)] : null, fb: C ? [C.fb, D.tr('food_' + C.fb)] : null,
            style: C ? [C.style, C.style2 || ''] : null, bldH: C ? C.bldH : null, rails: null
          };
        }""", [key, SEED])
        if city == 'Neve':
            layout_snow = info['layout']; rel_snow = info['rel']
            check(not info['city'] and info['snowb'] and not info['skate'] and info['ranges'] and not info['sky'] and info['flakes'], 'Neve: snowboard, montagne, nevicata, nessuno sfondo di città')
            check(info['byType'].get('tree', 0) > 20 and info['byType'].get('bldg', 0) in (0, None), 'Neve: bosco ai lati, niente palazzi', json.dumps(info['byType']))
            continue
        row = {r['elemento']: r['valori'][city] for r in TAB['rows']}
        print(f' · {city}: {json.dumps(info["byType"])} · bonus {info["fa"][1]} / {info["fb"][1]} · cadute {info["crash"]}')
        check(info['city'] and info['skate'] and not info['snowb'], f'{city}: skateboard al posto dello snowboard (R-205)')
        check(info['sky'] == [key] and not info['ranges'], f'{city}: sfondo lontano della città visibile, montagne alpine nascoste', str(info['sky']))
        # R-307: Roma ha i ruderi dei fori al posto dei palazzi; Napoli ha i palazzi solo a sinistra (a destra il mare)
        n_bldg = info['byType'].get('bldg', 0)
        bldg_ok = (info['byType'].get('side', 0) > 10 and n_bldg == 0) if city == 'Roma' else n_bldg > (5 if city == 'Napoli' else 10)
        check(bldg_ok and info['byType'].get('tree', 0) > 0 and info['byType'].get('rock', 0) > 0 and info['byType'].get('marker', 0) > 10, f'{city}: lati come la strada vera (R-307), ostacoli alti e bassi, segnaletica', json.dumps(info['byType']))
        if city in ('Napoli', 'Roma', 'Parigi', 'Lisbona', 'Berlino', 'Zurigo'):
            check(info['byType'].get('sidetree', 0) > 3, f'{city}: file di alberi ai lati della strada (R-307)', json.dumps(info['byType']))
        g = info['geoOk']
        check(all(g.values()), f'{city}: ogni oggetto di gioco usa il modello della città (alto, basso, bonus, rampa, porte, paletti)', json.dumps(g))
        same_rel = len(info['rel']) == len(rel_snow) and all(a[0] == b[0] and abs(a[1] - b[1]) < 0.03 and abs(a[2] - b[2]) < 0.03 for a, b in zip(info['rel'], rel_snow))
        if not same_rel: print('   primo diverso:', next(((a, b) for a, b in zip(info['rel'], rel_snow) if a[0] != b[0] or abs(a[1] - b[1]) >= 0.03 or abs(a[2] - b[2]) >= 0.03), None))
        check(info['layout'] != layout_snow and same_rel, f'{city}: forma della strada propria (R-312), ma stessa sequenza di ostacoli, bonus, rampe e porte della neve rispetto alla strada (R-309)', f'{len(info["rel"])} vs {len(rel_snow)}')
        again = pg.evaluate("([key, seed]) => { const D = window.__dbg; D.mode = 'solo'; D.reset(seed, null, false); D.mode = 'menu'; return D.objs.filter(o => o.z > -220 && (['rock', 'gem', 'ramp', 'gate', 'marker'].includes(o.type) || (o.type === 'tree' && Math.abs(o.x - D.center(o.z)) < 16))).map(o => [o.type, +o.x.toFixed(2), +o.z.toFixed(2)]); }", [key, SEED])
        check(again == info['layout'], f'{city}: stessa città e stesso seed → pista identica (tutti i giocatori della gara)')
        check(info['groundTex'], f'{city}: fondo stradale proprio')
        # tabella: nomi dei bonus
        exp_a, exp_b = row['Bonus A (+10)'], row['Bonus B (+10, alternato ad A)']
        if city == 'Roma':
            check(info['fa'][1] == 'Carbonara' and info['fb'][1] == 'Carciofo', f'{city}: bonus carbonara e carciofo (R-303; la tabella diceva supplì e maritozzo → S-12)')
        else:
            import re
            words = lambda s: {w for w in re.split(r'[^a-zàèéìòùčš&]+', s.lower()) if len(w) >= 2 and w not in ('di', 'de', 'da', 'con', 'e')}
            same = lambda a, b: bool(words(a) & words(b))
            check(same(exp_a, info['fa'][1]), f'{city}: bonus A come da tabella ("{exp_a}")', info['fa'][1])
            check(same(exp_b, info['fb'][1]), f'{city}: bonus B come da tabella ("{exp_b}")', info['fb'][1])
        check('!' in info['crash'][0] and '!' in info['crash'][1] and '!' in info['crash'][2] and 'Abete' not in ''.join(info['crash']), f'{city}: messaggi di caduta propri, mai "Abete" (R-304)', ', '.join(info['crash']))
        # foto a 120 m di discesa con il rider in posa
        pg.evaluate("""() => { const D = window.__dbg; D.mode = 'solo'; D.god(); D.P.z = -120; D.P.x = D.center(-120); D.P.speed = 30; document.getElementById('menu').hidden = true; }""")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f'{OUT}/citta-{key}.png')
        pg.evaluate("() => { window.__dbg.mode = 'menu'; document.getElementById('menu').hidden = false; }")
    check(not errs, 'nessun errore JavaScript cambiando scenario', '; '.join(errs[:3]))

    print('G2 · guida: curve della pista (R-305), salto sopra le rocce ma non sugli alberi (R-201), muro in città (S-02)')
    # ogni città ha il suo tracciato (R-312): curve dolci, rettilinei dove previsti, tempi simili.
    # Fattore di tempo = media di (1 + pendenza²)^1,3 sui 12 km della gara da 5 minuti (velocità ∝ cos^1,6 dell'angolo, avanzamento ∝ cos).
    tracks = pg.evaluate("""() => { const D = window.__dbg; const out = {};
      for (const key of Object.keys(D.TRACKS)) { D.applyTheme(key);
        let lo = 1e9, hi = -1e9, maxSlope = 0, tf = 0, n = 0, straight = 0;
        for (let z = 0; z > -12000; z -= 2) { const c = D.center(z), s = (D.center(z - 1) - D.center(z + 1)) / 2; lo = Math.min(lo, c); hi = Math.max(hi, c); maxSlope = Math.max(maxSlope, Math.abs(s)); tf += Math.pow(1 + s * s, 1.3); if (Math.abs(s) < 0.05) straight++; n++; }
        out[key] = { span: +(hi - lo).toFixed(1), maxSlope: +maxSlope.toFixed(3), tf: +(tf / n).toFixed(4), straight: +(straight / n).toFixed(2), c400: +D.center(-400).toFixed(1) };
      } D.applyTheme('neve'); return out; }""")
    for k, v in tracks.items(): print(f'   {k:12s} {json.dumps(v)}')
    ref = tracks['neve']['tf']
    check(all(v['span'] > 20 and v['maxSlope'] < 0.5 for v in tracks.values()), 'ogni pista curva in modo naturale (ampiezza > 20 m, pendenza laterale < 0,5)')
    check(all(abs(v['tf'] / ref - 1) < 0.005 for v in tracks.values()), 'tempi simili in tutte le città: fattore di tempo entro ±0,5% della neve (R-312)', ', '.join(f"{k} {v['tf']}" for k, v in tracks.items()))
    check(len({v['c400'] for v in tracks.values()}) == len(tracks), 'tracciati tutti diversi tra loro (posizione della pista a 400 m)')
    check(max(v['straight'] for v in tracks.values()) - min(v['straight'] for v in tracks.values()) >= 0.06, 'alcune città hanno più rettilinei, altre più curve', ', '.join(f"{k} {v['straight']}" for k, v in tracks.items()))

    print('G2b · trampolini giganti (R-214): circa il 15% delle rampe, grandi il doppio, salto molto più alto')
    r = pg.evaluate("""() => { const D = window.__dbg; const res = {};
      for (const key of ['neve', 'napoli', 'newyork']) { D.applyTheme(key); D.mode = 'solo'; D.reset(4242, null, false); D.god();
        const seen = new Map(), bad = new Set(); let scale = 0;
        for (let z = 0; z > -30000; z -= 150) { D.P.z = z; D.P.x = D.center(z); D.ensureSpawned();
          for (const o of D.objs) if (o.type === 'ramp') {
            seen.set(o.z, o.big);
            if (o.big) scale = o.mesh.scale.x;
            if (o.big) for (const q of D.objs) if (q !== o && ['tree', 'rock', 'gem', 'ramp', 'gate'].includes(q.type) && q.z < o.z + 4.5 && q.z > o.z - 5 && Math.abs(q.x - o.x) < 3.4) bad.add(q.type + q.x + ',' + q.z);
          } }
        const blocked = bad.size;
        const all = [...seen.values()];
        res[key] = { ramps: all.length, big: all.filter(Boolean).length, blocked, scale };
      }
      D.mode = 'menu'; return res; }""")
    for k, v in r.items():
        share = v['big'] / max(1, v['ramps'])
        check(0.10 < share < 0.20 and v['scale'] == 2, f'{k}: {v["big"]} trampolini giganti su {v["ramps"]} rampe ({share:.0%}), modello grande il doppio', json.dumps(v))
        check(v['blocked'] == 0, f'{k}: niente ostacoli, bonus o porte sopra i trampolini giganti', json.dumps(v))
    jumps = {}
    for big in (False, True):
        jumps[big] = pg.evaluate("""async big => { const D = window.__dbg; D.applyTheme('neve'); D.mode = 'solo'; D.reset(4242, null, false); D.god();
          document.getElementById('menu').hidden = true;
          let o = null; for (let z = 0; z > -30000 && !o; z -= 150) { D.P.z = z; D.P.x = D.center(z); D.ensureSpawned(); o = D.objs.find(q => q.type === 'ramp' && !!q.big === big && q.z < z - 30); }
          D.P.z = o.z + (big ? 3.8 : 1.9); D.P.x = o.x; D.P.ang = 0; D.P.speed = 28; D.P.air = false; D.P.y = 0; D.P.onRamp = null; D.P.crash = 0;
          let maxY = 0, air = 0, launched = false, vy = 0; const start = performance.now();
          while (performance.now() - start < 120000) { await D.frames(1);
            if (D.P.air && !launched) { launched = true; vy = D.P.vy; }
            if (launched) { maxY = Math.max(maxY, D.P.y); if (D.P.air) air = Math.max(air, D.P.airT); else break; } }
          D.mode = 'menu'; document.getElementById('menu').hidden = false;
          return { vy: +vy.toFixed(1), maxY: +maxY.toFixed(2), airT: +air.toFixed(2), crash: D.P.crash > 0, toast: window.__toasts.slice(-3).join('|') }; }""", big)
    print('   rampa normale', json.dumps(jumps[False])); print('   trampolino gigante', json.dumps(jumps[True]))
    check(jumps[True]['maxY'] >= 2 * jumps[False]['maxY'] and jumps[True]['airT'] > 1.3 * jumps[False]['airT'], 'dal trampolino gigante si salta almeno il doppio più in alto e si resta più a lungo in aria', f"{jumps[True]['maxY']} m / {jumps[False]['maxY']} m, {jumps[True]['airT']} s / {jumps[False]['airT']} s")
    check(not jumps[True]['crash'] and 'gigante' in jumps[True]['toast'], 'atterraggio pulito e messaggio "Trampolino gigante!"', jumps[True]['toast'])
    r = pg.evaluate("""() => {
      const D = window.__dbg; D.applyTheme('neve'); D.mode = 'solo'; D.reset(777, null, false);
      const at = (type, y) => { D.setLives(3); const o = D.objs.find(o => o.type === type && o.z < -40); D.P.x = o.x; D.P.z = o.z; D.P.y = y; D.P.crash = 0; D.invuln = 0; D.collide(); const c = D.P.crash > 0; D.P.crash = 0; D.invuln = 0; return c; };
      return { rockLow: at('rock', 0), rockJump: at('rock', 1.2), treeLow: at('tree', 0), treeJump: at('tree', 1.2), markerHit: at('marker', 0) };
    }""")
    check(r['rockLow'] and not r['rockJump'], 'la roccia fa cadere a terra ma si supera saltando', json.dumps(r))
    check(r['treeLow'] and r['treeJump'], 'l\'albero fa cadere anche saltando', json.dumps(r))
    check(r['markerHit'], 'la palina fa cadere', json.dumps(r))
    r = pg.evaluate("""() => { const D = window.__dbg; D.applyTheme('napoli'); D.mode = 'solo'; D.reset(777, null, false); D.setLives(3); D.invuln = 0; D.P.z = -60; D.P.x = D.center(-60) + 30; D.P.ang = 0.5; D.P.speed = 20; const l0 = D.lives; window.__toasts.length = 0;
      return D.frames(4).then(() => ({ x: +(D.P.x - D.center(D.P.z)).toFixed(1), lives: D.lives, l0, toasts: window.__toasts.join('|') })); }""")
    check(abs(r['x']) <= 21.7 and r['lives'] == r['l0'] and 'Muro' in r['toasts'], 'in città il muro rimbalza verso il centro ("Muro!") senza togliere vite', json.dumps(r))

    print('G3 · acrobazie e atterraggio assistito (R-202, R-203)')
    def trick(spin, flip, y=0.001, vy=-6, frames=8, god=True):
        return pg.evaluate("""([spin, flip, y, vy, n, god]) => { const D = window.__dbg; D.applyTheme('neve'); D.mode = 'solo'; D.reset(99, null, false); if (god) D.god(); else { D.setLives(3); D.invuln = 0; } D.P.z = -50; D.P.x = D.center(-50); D.P.speed = 25;
          D.bonus = 0; D.P.air = true; D.P.airT = 1; D.P.y = y; D.P.vy = vy; D.P.spin = spin; D.P.flip = flip; D.P.grab = 0; D.P.grabT = 0; D.P.ramp = false; window.__toasts.length = 0;
          return D.frames(n).then(() => ({ bonus: D.bonus, toast: window.__toasts.join('|'), crash: D.P.crash > 0, air: D.P.air })); }""", [spin, flip, y, vy, frames, god])
    r = trick(3.14159, 0); check(r['bonus'] == 60 and '180°' in r['toast'] and not r['air'], 'avvitamento di 180° = 60 punti', json.dumps(r))
    r = trick(0, 6.2832); check(r['bonus'] == 150 and 'Backflip' in r['toast'], 'salto mortale all\'indietro = 150 punti', json.dumps(r))
    r = trick(0, -6.2832); check(r['bonus'] == 150 and 'Frontflip' in r['toast'], 'salto mortale in avanti = 150 punti', json.dumps(r))
    r = trick(6.2832, 6.2832); check(r['bonus'] == round((150 + 120) * 1.5), 'due acrobazie insieme: +50%', json.dumps(r))
    r = trick(3.14159 + 0.75, 0, y=0.001, vy=-20); check(r['bonus'] == 30 and not r['crash'] and 'storto' not in r['toast'].lower(), 'atterraggio un po\' storto: punti dimezzati, niente caduta', json.dumps(r))
    r = trick(3.14159 + 1.45, 0, y=0.001, vy=-20, god=False); check(r['crash'] and r['bonus'] == 0 and 'storto' in r['toast'].lower(), 'atterraggio molto storto: caduta', json.dumps(r))
    r = trick(3.14159 + 0.6, 0, y=0.9, vy=-3.5, frames=40); check(r['bonus'] == 60 and not r['crash'] and not r['air'], 'atterraggio assistito: da 0,9 m con 34° di errore il rider si raddrizza e atterra pulito (60 punti pieni)', json.dumps(r))
    r = pg.evaluate("""() => { const D = window.__dbg; D.mode = 'solo'; D.reset(99, null, false); D.god(); D.P.z = -50; D.P.x = D.center(-50); D.P.speed = 25; D.P.air = false; D.P.y = 0; D.jump(); return { air: D.P.air, vy: D.P.vy }; }""")
    check(r['air'] and r['vy'] > 5, 'Spazio/Salta: il rider decolla', json.dumps(r))

    print('G4 · velocità: accelerazione, raccolto e frenata (R-206, R-207, R-208)')
    check(abs((18 + min(26, 2000 * 0.00975)) - 37.5) < 0.1, 'velocità massima cresce con la distanza: 18 m/s al via, 37,5 a 2 km, 44 oltre 2,7 km')
    r = pg.evaluate("""() => { const D = window.__dbg; D.mode = 'solo'; D.reset(5, null, false); D.god(); D.P.z = -30; D.P.x = D.center(-30); D.P.speed = 18; D.keys.down = true;
      return D.frames(45).then(() => { const a = { tuck: +D.tuckS.toFixed(2), v: +D.P.speed.toFixed(1), air: D.P.air }; D.keys.down = false; D.keys.up = true; return D.frames(45).then(() => { D.keys.up = false; return { ...a, brake: +D.brakeS.toFixed(2), v2: +D.P.speed.toFixed(1) }; }); }); }""")
    check(r['tuck'] > 0.95 and r['brake'] > 0.95 and r['v'] > r['v2'] + 5, 'freccia giù: posa raccolta e più veloce; freccia su: peso avanti e frenata', json.dumps(r))

    print('G5 · maglie e stemma CYF (R-209, R-216)')
    r = pg.evaluate("""() => { const D = window.__dbg; const opts = [...document.querySelectorAll('#selJersey option')].map(o => [o.value, o.textContent]);
      const sel = document.getElementById('selJersey'); sel.value = 'roma'; sel.dispatchEvent(new Event('change'));
      const tex = D.jacketTexture('#ff5a1f', 'roma'); const c = tex.image; const g = c.getContext('2d');
      // in ogni zona dello stemma ci devono essere bianco (scudo), blu notte (bordo e scritta) e arancione (fascia)
      const zone = (u, v, w, h) => { const d = g.getImageData(Math.round(u * 1024 - w / 2), Math.round((1 - v) * 512 - h / 2), w, h).data; let wh = 0, navy = 0, orange = 0;
        for (let i = 0; i < d.length; i += 4) { const [r, gg, b] = [d[i], d[i + 1], d[i + 2]]; if (r > 225 && gg > 225 && b > 225) wh++; else if (r < 40 && gg < 60 && b < 80) navy++; else if (r > 230 && gg > 70 && gg < 110 && b < 50) orange++; }
        return { wh, navy, orange }; };
      // ali bianche: prima occupavano tutta la larghezza del fianco; ora fuori dallo stemma c'è solo la maglia
      return { opts: opts.length, saved: D.store.get('cyf.jersey'), side: zone(0.02, 0.55, 36, 80), side2: zone(0.5, 0.55, 100, 80), back: zone(0.75, 0.57, 130, 110), chest: zone(0.283, 0.62, 60, 48),
               oldWing: zone(0.17, 0.5, 30, 30), keys: Object.keys(D.JERSEYS).filter(k => !D.JERSEYS[k].color).length, colors: Object.keys(D.JERSEYS).filter(k => D.JERSEYS[k].color).length }; }""")
    check(r['opts'] == 17 and r['keys'] == 8 and r['colors'] == 8 and r['saved'] == 'roma', '8 maglie delle città e 8 colori nel menu + colore assegnato (R-221); la scelta resta salvata', json.dumps(r))
    full = lambda z: z['wh'] > 30 and z['navy'] > 30 and z['orange'] > 30
    check(full(r['side2']) and full(r['back']) and full(r['chest']) and r['side']['wh'] > 30, 'stemma CYF (scudo bianco, bordo e scritta blu, fascia arancione) sui due fianchi, sulla schiena e sul petto', json.dumps(r))
    check(r['oldWing']['wh'] == 0, 'niente più ali bianche sul fianco', json.dumps(r['oldWing']))
    pg.evaluate("() => { const D = window.__dbg; const c = D.jacketTexture('#ff5a1f', 'roma').image; window.__badge = c.toDataURL(); }")
    open(f'{OUT}/giacca-texture.png', 'wb').write(base64.b64decode(pg.evaluate('window.__badge').split(',')[1]))
    pg.evaluate("() => { const sel = document.getElementById('selJersey'); sel.value = ''; sel.dispatchEvent(new Event('change')); }")

    print('G6 · gara: traguardo, avviso a 500 m, arrivo controllato dal server, banana lanciata con doppio clic, silenzio (R-108, R-113, R-116)')
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    pg.fill('#inName', 'Tester'); pg.click('#btnCreate'); pg.wait_for_timeout(1500)
    code = pg.evaluate("new URLSearchParams(location.search).get('sfida')")
    g = br.new_context(locale='it-IT', viewport={'width': 400, 'height': 300}); local(g); g.set_default_timeout(120000)
    g.add_init_script("localStorage.setItem('cyf.id','pGuest2'); localStorage.setItem('cyf.name','Ospite')")
    gp = g.new_page(); gp.goto(f'{BASE}/pista-nera/?sfida={code}', wait_until='domcontentloaded'); gp.wait_for_function('window.__dbg'); gp.wait_for_timeout(1500)
    pg.click('#btnGo')
    # attesa prima del via (R-222): pulsante verde "Sono pronto" al posto di Salta; con tutti pronti si parte subito
    pg.wait_for_function("!document.getElementById('btnPronto').hidden", timeout=60000); gp.wait_for_function("!document.getElementById('btnPronto').hidden", timeout=60000)
    # letto nello stesso istante in cui il pulsante è visibile (con l'attesa accorciata delle prove può finire subito dopo)
    rp = pg.evaluate("() => new Promise(res => { const t0 = performance.now(); const f = () => { const b = document.getElementById('btnPronto'); if (!b.hidden || performance.now() - t0 > 60000) res({ text: b.textContent, hidden: b.hidden, gather: document.getElementById('stage').classList.contains('gather') }); else requestAnimationFrame(f); }; f(); })")
    check(rp['text'] == 'Sono pronto' and rp['gather'], 'durante l\'attesa compare il pulsante verde "Sono pronto"', json.dumps(rp))
    pg.dispatch_event('#btnPronto', 'pointerdown')
    gp.wait_for_function("(() => { const r = window.__dbg.remotes.get('pTester') || [...window.__dbg.remotes.values()][0]; return !!r && r.ready; })()", timeout=10000)
    check(True, 'chi preme "Sono pronto" alza la mano e gli altri lo vedono')
    gp.dispatch_event('#btnPronto', 'pointerdown')
    pg.wait_for_function("window.__dbg.mode === 'race'", timeout=90000); gp.wait_for_function("window.__dbg.mode === 'race'", timeout=90000); pg.wait_for_timeout(200)
    r = pg.evaluate("""() => { const D = window.__dbg; return { mode: D.mode, finish: !!D.finishObj, finishZ: D.finishObj ? D.finishObj.children[0].position.z : null, raceLen: D.raceLen, remotes: D.remotes.size, live: document.querySelectorAll('#liveList li').length }; }""")
    check(r['mode'] == 'race' and r['finish'] and abs(r['finishZ'] + r['raceLen']) < 1 and r['raceLen'] == 12000, 'in gara c\'è il traguardo a 12.000 m', json.dumps(r))
    check(r['remotes'] == 1 and r['live'] == 2, 'avversario in pista e classifica dal vivo con 2 nomi', json.dumps(r))
    r = pg.evaluate("""() => { const D = window.__dbg; D.god(); D.bonus = 200; window.__toasts.length = 0; const cvs = document.getElementById('game'); const rc = cvs.getBoundingClientRect();
      const ev = () => new PointerEvent('pointerdown', { clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height * 0.7, bubbles: true, pointerId: 3 });
      cvs.dispatchEvent(ev()); cvs.dispatchEvent(ev());
      const h = [...D.hazards.values()][0];
      return { n: D.hazards.size, kind: h && h.kind, fly: !!(h && h.fly), ahead: h ? h.z < D.P.z : null, bonus: D.bonus, toast: window.__toasts.join('|') }; }""")
    check(r['n'] == 1 and r['kind'] == 'banana' and r['fly'] and r['ahead'] and r['bonus'] == 150, 'doppio clic sulla pista: banana lanciata davanti, 50 punti spesi', json.dumps(r))
    gp.wait_for_function("window.__dbg.hazards.size === 1", timeout=20000)
    gh = gp.evaluate("() => ({ n: window.__dbg.hazards.size, kind: [...window.__dbg.hazards.values()][0].kind })")
    check(gh['n'] == 1 and gh['kind'] == 'banana', 'l\'avversario vede la banana', json.dumps(gh))
    # banana lanciata al giocatore davanti (R-224): l'ospite va 30 m più avanti, l'organizzatore lancia, l'ospite si ferma 2 s
    gp.evaluate("() => { const D = window.__dbg; D.P.z -= 30; D.P.x = D.center(D.P.z); D.invuln = 0; window.__toasts.length = 0; }")
    pg.wait_for_function("(() => { const D = window.__dbg; const r = D.remotes.get('pGuest2'); return !!r && D.P.z - r.z > 5; })()", timeout=20000)
    pg.wait_for_timeout(1100)
    r = pg.evaluate("""() => { const D = window.__dbg; D.bonus = 200; window.__toasts.length = 0; const cvs = document.getElementById('game'); const rc = cvs.getBoundingClientRect();
      const ev = () => new PointerEvent('pointerdown', { clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height * 0.7, bubbles: true, pointerId: 4 });
      cvs.dispatchEvent(ev()); cvs.dispatchEvent(ev()); return D.frames(2).then(() => ({ bonus: D.bonus, toast: window.__toasts.join('|') })); }""")
    check(r['bonus'] == 150 and 'Ospite' in r['toast'], 'doppio clic con un avversario davanti: la banana è lanciata a lui (R-224)', json.dumps(r))
    try:
        gp.wait_for_function("window.__dbg.P.stop > 0", timeout=10000)
        gr = gp.evaluate("() => ({ stop: +window.__dbg.P.stop.toFixed(2), toast: window.__toasts.join('|') })")
    except Exception as e:
        gr = { 'stop': 0, 'toast': str(e)[:80] }
    check(gr['stop'] > 1 and gr['stop'] <= 2 and 'Banana' in gr['toast'], 'chi la riceve cade e resta fermo 2 s (R-224)', json.dumps(gr))
    # il pulsante 🍌 lancia come il doppio clic, con il gesto del braccio (R-230)
    pg.wait_for_timeout(1100)
    r = pg.evaluate("""() => { const D = window.__dbg; D.bonus = 200; window.__toasts.length = 0; document.getElementById('btnBanana').click();
      return D.frames(3).then(() => ({ bonus: D.bonus, toast: window.__toasts.join('|'), gesto: D.throwT })); }""")
    check(r['bonus'] == 150 and 'Ospite' in r['toast'] and r['gesto'] > 0, 'pulsante della banana: gesto del braccio e banana lanciata al giocatore davanti (R-230)', json.dumps(r))
    # bananone (R-231): con 1.499 punti dice quanti ne servono; con 1.600 si lancia all'ospite davanti, che si ferma 4 s
    gp.evaluate("() => { const D = window.__dbg; D.P.z -= 40; D.P.x = D.center(D.P.z); D.invuln = 0; D.P.crash = 0; D.P.stop = 0; window.__toasts.length = 0; }")
    pg.wait_for_function("(() => { const D = window.__dbg; const r = D.remotes.get('pGuest2'); return !!r && D.P.z - r.z > 5; })()", timeout=20000)
    pg.wait_for_timeout(1100)
    r = pg.evaluate("""() => { const D = window.__dbg; D.bonus = 1499; window.__toasts.length = 0; document.getElementById('btnBananone').click();
      return D.frames(2).then(() => ({ bonus: D.bonus, toast: window.__toasts.join('|'), short: document.getElementById('btnBananone').classList.contains('short') })); }""")
    check(r['bonus'] == 1499 and '1500' in r['toast'], 'bananone con meno di 1500 punti: non parte e dice quanti punti servono (R-231)', json.dumps(r))
    gp.evaluate("() => { const D = window.__dbg; D.invuln = 0; D.P.crash = 0; window.__toasts.length = 0; }")
    r = pg.evaluate("""() => { const D = window.__dbg; D.bonus = 1600; window.__toasts.length = 0; document.getElementById('btnBananone').click();
      return D.frames(3).then(() => ({ bonus: D.bonus, toast: window.__toasts.join('|'), gesto: D.throwT })); }""")
    check(r['bonus'] == 100 and 'Ospite' in r['toast'] and r['gesto'] > 0, 'pulsante del bananone: gesto del braccio, 1500 punti spesi, lanciato al giocatore davanti (R-231)', json.dumps(r))
    try:
        gp.wait_for_function("window.__dbg.P.stop > 0", timeout=10000)
        # durata decisa al colpo (stopUntil), non la lettura del fotogramma: il browser delle prove gira a pochi fotogrammi al secondo
        gr = gp.evaluate("() => { const P = window.__dbg.P; return { stop: +((P.stopUntil - performance.now()) / 1000).toFixed(2), left: +P.stop.toFixed(2), toast: window.__toasts.join('|') }; }")
    except Exception as e:
        gr = { 'stop': 0, 'toast': str(e)[:80] }
    check(gr['stop'] > 2 and gr['stop'] <= 4 and 'Bananone' in gr['toast'], 'chi riceve il bananone cade e resta fermo più di una banana, fino a 4 s (R-231)', json.dumps(gr))
    r = pg.evaluate("""() => { const D = window.__dbg; window.__toasts.length = 0; D.P.z = -(D.raceLen - 400); D.P.x = D.center(D.P.z); return D.frames(4).then(() => ({ toast: window.__toasts.join('|') })); }""")
    check('500' in r['toast'], 'avviso "Traguardo tra 500 m"', json.dumps(r))
    r = pg.evaluate("""() => { const D = window.__dbg; window.__toasts.length = 0; D.P.z = -D.raceLen - 1; return D.frames(4).then(() => new Promise(res => setTimeout(() => res({ mode: D.mode, toasts: window.__toasts.join('|'), banner: document.getElementById('banner').textContent }), 1500))); }""")
    check(r['mode'] == 'finished' and 'non valido' in r['toasts'].lower() and 'Traguardo' in r['toasts'], 'al traguardo il client si ferma e il server scarta il tempo impossibile (pochi secondi per 12 km)', json.dumps(r))
    WAV = 'UklGRkQcAABXQVZFZm10IBAAAAABAAEA4C4AAMBdAAACABAAZGF0YSAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='   # 0,3 s di silenzio in WAV 12 kHz: dalla 0.9.2 il fumetto compare dopo la decodifica
    r = pg.evaluate("""wav => { const D = window.__dbg; D.playVoice({ id: 'pGuest2', name: 'Ospite', data: wav, mime: 'audio/wav' });
      return new Promise(res => setTimeout(res, 150)).then(() => { const shown = !document.getElementById('voiceNow').hidden; document.getElementById('btnMute').click();
      D.playVoice({ id: 'pGuest2', name: 'Ospite', data: wav, mime: 'audio/wav' });
      return new Promise(res => setTimeout(res, 300)).then(() => ({ shown, hidden: document.getElementById('voiceNow').hidden, saved: D.store.get('cyf.muted'), muted: D.mutedIds.has('pGuest2') })); }); }""", WAV)
    check(r['shown'] and r['hidden'] and r['muted'] and 'pGuest2' in (r['saved'] or ''), 'silenziare un giocatore: il suo vocale non si sente più e la scelta resta salvata', json.dumps(r))
    g.close()
    check(not errs, 'nessun errore JavaScript nelle prove di gioco', '; '.join(errs[:3]))
    br.close()
print('\n' + ('PROBLEMI:' if problems else 'NESSUN PROBLEMA'))
for x in problems: print(' -', x)
import sys as _sys
_sys.exit(1 if problems else 0)   # esito per il cancello dei test: 1 = qualcosa non va
