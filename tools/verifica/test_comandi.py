"""Comandi touch sul telefono simulato: rotellina (curva, accelera, frena), Salta, microfono in allenamento e in sfida."""
import os, json
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = os.environ.get('OUT', '/tmp/cyf-verifica/foto-comandi'); os.makedirs(OUT, exist_ok=True)
THREE = open(os.environ.get('THREE_JS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'vendor', 'three.min.js')), 'rb').read()   # three r128 del sito (public/vendor, A-16)
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
hook = "  applyLang(lang);\n"
GAME = GAME.replace(hook, hook + "  window.__dbg = { get P() { return P; }, stick, get mode() { return mode; }, get t() { return t; }, god() { invuln = 1e9; lives = 99; } };\n")
problems = []

def local(ctx):
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())

PHONE = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
TOUCH_JS = """([type, x, y]) => {
  const el = document.elementFromPoint(x, y);
  const target = type === 'pointerdown' ? el : (window.__tgt || el);
  if (type === 'pointerdown') window.__tgt = el;
  target.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  return el && (el.id || el.className);
}"""

def drag_hold(pg, x0, y0, dx, dy, secs):
    pg.evaluate(TOUCH_JS, ['pointerdown', x0, y0])
    for i in range(1, 6):
        pg.evaluate(TOUCH_JS, ['pointermove', x0 + dx * i / 5, y0 + dy * i / 5])
    # si aspetta tempo di GIOCO, non tempo reale: con la grafica software un secondo reale può valere pochi fotogrammi
    if secs > 0:
        t0 = pg.evaluate('__dbg.t')
        pg.wait_for_function(f'__dbg.t - {t0} >= {secs}', timeout=120000)
    st = pg.evaluate('({x: __dbg.stick.x, y: __dbg.stick.y, knob: document.getElementById("stickKnob").style.transform, on: document.getElementById("stick").classList.contains("on")})')
    return st

def end(pg, x, y):
    pg.evaluate(TOUCH_JS, ['pointerup', x, y])

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for orient, vp in [('verticale', {'width': 390, 'height': 844}), ('orizzontale', {'width': 844, 'height': 390})]:
        ctx = br.new_context(locale='it-IT', **{**PHONE, 'viewport': vp}); local(ctx); ctx.set_default_timeout(90000)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1500)
        coarse = pg.evaluate("matchMedia('(pointer: coarse)').matches")
        menu_vis = pg.evaluate("[getComputedStyle(tJump).display, getComputedStyle(stick).display]")
        pg.click('#btnSolo') if pg.locator('#btnSolo').count() else pg.get_by_role('button', name='Allenati da solo').click()
        pg.wait_for_timeout(1500)
        info = pg.evaluate("""() => {
          const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
          const vis = id => { const e = document.getElementById(id); return !e.hidden && getComputedStyle(e).display !== 'none'; };
          return { mode: __dbg.mode, playing: document.getElementById('stage').classList.contains('playing'), jump: [vis('tJump'), r('tJump')], stick: [vis('stick'), r('stick')], mic: [vis('btnVoice'), r('btnVoice'), document.getElementById('btnVoice').className], sound: r('btnSound'), stage: r('stage') };
        }""")
        print(orient, 'coarse', coarse, 'nel menu (salta, rotellina):', menu_vis)
        print('  allenamento:', json.dumps(info))
        if not info['playing'] or not info['jump'][0] or not info['stick'][0] or not info['mic'][0]: problems.append(f'{orient}: comandi non visibili in allenamento')
        if menu_vis != ['none', 'none']: problems.append(f'{orient}: comandi visibili nel menu')
        sx, sy, sw, sh = info['stick'][1]
        cx, cy = sx + sw * 0.6, sy + sh * 0.6
        # 1. accelera (su) e frena (giù): velocità a confronto (senza cadute, che falserebbero la velocità)
        pg.evaluate('__dbg.god()')
        pg.wait_for_timeout(2500)
        st = drag_hold(pg, cx, cy, 0, -70, 3.0); v_up = pg.evaluate('__dbg.P.speed')
        pg.screenshot(path=f'{OUT}/{orient}-rotellina-su.png')
        end(pg, cx, cy - 70)
        st2 = drag_hold(pg, cx, cy, 0, 70, 3.0); v_dn = pg.evaluate('__dbg.P.speed')
        end(pg, cx, cy + 70)
        print(f'  su: stick={st}  velocità {v_up:.1f} m/s | giù: stick={st2}  velocità {v_dn:.1f} m/s')
        if not (st['y'] < -0.9 and st2['y'] > 0.9 and v_up > v_dn + 2): problems.append(f'{orient}: accelera/frena non funziona ({v_up:.1f} vs {v_dn:.1f})')
        # 2. curva: destra poi sinistra, l'angolo del rider cambia segno
        drag_hold(pg, cx, cy, 60, 0, 0.6); a_r = pg.evaluate('__dbg.P.ang'); end(pg, cx + 60, cy)
        drag_hold(pg, cx, cy, -60, 0, 0.9); a_l = pg.evaluate('__dbg.P.ang'); end(pg, cx - 60, cy)
        # mezzo spostamento = curva più dolce
        drag_hold(pg, cx, cy, 25, 0, 0.0); half = pg.evaluate('__dbg.stick.x'); end(pg, cx + 25, cy)
        rest = pg.evaluate('[__dbg.stick.x, __dbg.stick.y, document.getElementById("stick").classList.contains("on")]')
        print(f'  curva destra ang={a_r:.2f}, sinistra ang={a_l:.2f}, mezzo spostamento x={half:.2f}, dopo aver alzato il dito {rest}')
        if not (a_r > 0.2 and a_l < -0.2 and 0.2 < half < 0.6 and rest == [0, 0, False]): problems.append(f'{orient}: curva/rilascio non corretti')
        # 3. Salta
        jx, jy, jw, jh = info['jump'][1]
        pg.evaluate(TOUCH_JS, ['pointerdown', jx + jw / 2, jy + jh / 2]); pg.wait_for_timeout(150)
        air = pg.evaluate('__dbg.P.air'); pg.evaluate(TOUCH_JS, ['pointerup', jx + jw / 2, jy + jh / 2])
        # 4. microfono in allenamento: avviso
        pg.wait_for_timeout(1200)
        pg.locator('#btnVoice').click(); pg.wait_for_timeout(300)
        toast = pg.locator('#toasts').inner_text()
        print(f'  salto in aria: {air} | tocco microfono: "{toast.strip()[:80]}"')
        if not air: problems.append(f'{orient}: Salta non salta')
        if 'sfida' not in toast: problems.append(f'{orient}: il microfono in allenamento non avvisa')
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{OUT}/{orient}-allenamento.png')
        if errs: problems.append(f'{orient}: errori {errs[:2]}')
        ctx.close()

    # 5. sfida a due sul telefono: microfono attivo in alto, non coperto
    host = br.new_context(locale='it-IT', **PHONE); local(host); host.set_default_timeout(90000)
    pg = host.new_page(); pg.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pg.wait_for_function('window.__dbg'); pg.wait_for_timeout(1200)
    pg.fill('#inName', 'Luigi'); pg.click('#btnCreate'); pg.wait_for_timeout(1500)
    code = pg.evaluate("new URLSearchParams(location.search).get('sfida')")
    g = br.new_context(locale='it-IT', viewport={'width': 320, 'height': 240}); local(g); g.set_default_timeout(90000)
    g.add_init_script("localStorage.setItem('cyf.id','pGuest'); localStorage.setItem('cyf.name','Ospite')")
    gp = g.new_page(); gp.goto(f'{BASE}/pista-nera/?sfida={code}', wait_until='domcontentloaded'); gp.wait_for_timeout(2500)
    pg.click('#btnGo'); pg.wait_for_timeout(9000)
    mic = pg.evaluate("""() => { const b = document.getElementById('btnVoice'); const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { hidden: b.hidden, cls: b.className, label: document.getElementById('voiceLbl').textContent, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width)], onTop: b.contains(top) }; }""")
    print('sfida: microfono', mic)
    if mic['hidden'] or 'solo' in mic['cls'] or not mic['onTop']: problems.append('in sfida il microfono non è visibile o è coperto')
    pg.screenshot(path=f'{OUT}/sfida-telefono.png')
    g.close(); host.close(); br.close()
print('\nPROBLEMI:' if problems else '\nNESSUN PROBLEMA')
for x in problems: print(' -', x)
import sys as _sys
_sys.exit(1 if problems else 0)   # esito per il cancello dei test: 1 = qualcosa non va
