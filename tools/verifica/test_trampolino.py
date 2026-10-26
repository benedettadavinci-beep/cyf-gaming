"""Salto dalla rampa (R-219) e piedi sopra la rampa (R-214).
Piedi e tavola sopra la rampa (R-214): si passa su rampa normale e trampolino gigante, a ogni fotogramma
si misura quanto il rider entra dentro la superficie della rampa. Esce con 1 se entra più di 5 cm (lo spessore della tavola; prima della 0.11.1 si arrivava a 1 m)."""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
assert GAME.count(hook) == 1
GAME = GAME.replace(hook, hook + """
  window.__dbg = { get P() { return P; }, get objs() { return GEN.objs; }, set mode(v) { mode = v; }, jump, reset, applyTheme, ensureSpawned, center, hgt, rider, world, THREE,
    god() { invuln = 1e9; lives = 99; }, frames(n) { return new Promise(res => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); } };
""")

MISURA = """async ([scena, big, side]) => {
  const D = window.__dbg, T = D.THREE; D.applyTheme(scena); D.mode = 'solo'; D.reset(4242, null, false); D.god();
  document.getElementById('menu').hidden = true;
  let o = null; for (let z = 0; z > -30000 && !o; z -= 150) { D.P.z = z; D.P.x = D.center(z); D.ensureSpawned(); o = D.objs.find(q => q.type === 'ramp' && !!q.big === big && q.z < z - 30); }
  const k = big ? 2 : 1;
  // profilo vero della rampa: raggi dall'alto sul modello, ogni 2 cm lungo la rampa
  D.world.updateMatrixWorld(true);
  const rc = new T.Raycaster(), surf = [];
  for (let dz = 3.2 * k; dz >= -2.3 * k; dz -= 0.02) {
    rc.set(D.world.localToWorld(new T.Vector3(o.x, 50, o.z + dz)), new T.Vector3(0, -1, 0).transformDirection(D.world.matrixWorld));
    const h = rc.intersectObject(o.mesh, false); surf.push([o.z + dz, h.length ? D.world.worldToLocal(h[0].point.clone()).y : -1e9]);
  }
  const surfAt = z => { let best = null, d = 1e9; for (const s of surf) { const e = Math.abs(s[0] - z); if (e < d) { d = e; best = s; } } return d < 0.03 ? best[1] : -1e9; };
  D.P.z = o.z + 6 * k; D.P.x = o.x + side * k; D.P.ang = 0; D.P.speed = 26; D.P.air = false; D.P.y = 0; D.P.onRamp = null; D.P.crash = 0;
  let worst = 0, worstAt = '', frames = 0, onRampFrames = 0, launched = false; const v = new T.Vector3(), t0 = performance.now();
  while (performance.now() - t0 < 60000) {
    await D.frames(1); frames++;
    if (D.P.onRamp) onRampFrames++;
    D.rider.updateMatrixWorld(true);
    D.rider.traverse(m => {
      if (!m.isMesh || !m.visible) return;
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); D.world.worldToLocal(v);
        if (Math.abs(v.x - o.x) > 1.45 * k) continue;
        const s = surfAt(v.z); if (s < -1e8) continue;
        const pen = s - v.y;
        if (pen > worst) { worst = pen; worstAt = 'z ' + (v.z - o.z).toFixed(2) + ' su rampa, onRamp ' + !!D.P.onRamp + ', air ' + D.P.air + ', rider z ' + (D.P.z - o.z).toFixed(2) + ' y ' + D.P.y.toFixed(2) + ' vert sopra piedi ' + (v.y - D.rider.position.y).toFixed(2) + ' superficie ' + (s - D.hgt(o.x,o.z)).toFixed(2) + ' rotx ' + D.rider.rotation.x.toFixed(2) + ' crash ' + D.P.crash.toFixed(2); }
      }
    });
    if (D.P.air) launched = true;
    if (launched && (!D.P.air || D.P.z < o.z - 8 * k)) break;
  }
  D.mode = 'menu'; document.getElementById('menu').hidden = false;
  const top = Math.max(...surf.map(s => s[1])) - D.hgt(o.x, o.z);
  return { worst: +worst.toFixed(3), worstAt, onRampFrames, launched, top: +top.toFixed(2) };
}"""

# R-219: Salta premuto mentre si sale sulla rampa. Il rider deve atterrare (prima sprofondava all'infinito sotto terra).
SALTO = """async ([scena, big, frac]) => {
  const D = window.__dbg; D.applyTheme(scena); D.mode = 'solo'; D.reset(4242, null, false); D.god();
  document.getElementById('menu').hidden = true;
  let o = null; for (let z = 0; z > -30000 && !o; z -= 150) { D.P.z = z; D.P.x = D.center(z); D.ensureSpawned(); o = D.objs.find(q => q.type === 'ramp' && !!q.big === big && q.z < z - 30); }
  const k = big ? 2 : 1;
  D.P.z = o.z + 6 * k; D.P.x = o.x; D.P.ang = 0; D.P.speed = 18; D.P.air = false; D.P.y = 0; D.P.onRamp = null; D.P.crash = 0;
  const target = o.z + 2.85 * k - frac * 4.85 * k;   // punto della salita in cui si preme Salta
  let jumped = false, minY = 0, maxY = 0, landed = false, t0 = performance.now(), wasAir = false, onRampAtJump = false;
  while (performance.now() - t0 < 90000) {
    await D.frames(1);
    if (!jumped && D.P.onRamp && D.P.z <= target) { onRampAtJump = true; D.jump(); jumped = true; }
    if (!jumped && !D.P.onRamp && D.P.z < o.z - 2 * k) { D.jump(); jumped = true; }   // la salita è finita prima del punto: salto normale
    if (jumped) { minY = Math.min(minY, D.P.y); maxY = Math.max(maxY, D.P.y); if (D.P.air) wasAir = true; if (wasAir && !D.P.air) { landed = true; break; } }
    if (D.P.y < -20) break;
  }
  D.mode = 'menu'; document.getElementById('menu').hidden = false;
  return { onRampAtJump, landed, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), y: +D.P.y.toFixed(2) };
}"""

problems = []
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = br.new_context(viewport={'width': 1000, 'height': 640}, locale='it-IT')
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
    pg = ctx.new_page()
    pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(800)
    print('Salto premuto sulla salita della rampa (R-219)', flush=True)
    for scena, big in [('neve', False), ('neve', True), ('napoli', True)]:
        for frac in (0.2, 0.5, 0.8):
            r = pg.evaluate(SALTO, [scena, big, frac])
            ok = r['onRampAtJump'] and r['landed'] and r['minY'] > -0.1
            tag = f"salto {scena} {'gigante' if big else 'normale'} a {int(frac * 100)}% della salita"
            print(('OK   ' if ok else 'NO   ') + tag + (': atterra' if r['landed'] else ': NON ATTERRA'), json.dumps(r), flush=True)
            if not ok: problems.append(tag)
    if os.environ.get('SOLO_SALTO'): SCENE_LIST = []
    else: SCENE_LIST = os.environ.get('SCENE', 'neve,napoli,berlino').split(',')
    print('Piedi sopra la rampa (R-214)', flush=True)
    for scena in SCENE_LIST:
        for big in (False, True):
            for side in (0, 0.9):
                r = pg.evaluate(MISURA, [scena, big, side])
                ok = r['launched'] and r['onRampFrames'] > 3 and r["worst"] <= 0.05
                tag = f"{scena} {'gigante' if big else 'normale'} {'centro' if side == 0 else 'di lato'}"
                print(('OK   ' if ok else 'NO   ') + tag + ': rider dentro la rampa al massimo di ' + f"{r['worst'] * 100:.0f} cm", json.dumps(r), flush=True)
                if not ok: problems.append(tag)
    br.close()
print('PROBLEMI: ' + ', '.join(problems) if problems else 'Tutto a posto')
sys.exit(1 if problems else 0)
