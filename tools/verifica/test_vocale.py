"""Vocale da telefono a telefono con microfono finto di Chromium: registrazione Web Audio → WAV → server → riproduzione."""
import base64, json, os, struct
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
THREE = open(os.environ.get('THREE_JS', os.path.expanduser('~/three/package/build/three.min.js')), 'rb').read()
REPO = os.environ.get('CYF_REPO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GAME = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
GAME = GAME.replace("  function playVoice(m) {\n", "  function playVoice(m) { window.__lastVoice = m;\n", 1)
GAME = GAME.replace("  applyLang(lang);\n", "  applyLang(lang);\n  window.__dbg = { get voice() { return voice; }, get mode() { return mode; }, get playing() { return voicePlaying; }, get ac() { return audio && audio.ac; }, voiceButton, stopVoice };\n  window.__toasts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__toasts.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true });\n", 1)
assert '__lastVoice' in GAME and '__dbg' in GAME
problems = []
def check(c, label, extra=''):
    print(('  ✓ ' if c else '  ✗ ') + label + (f'  [{extra}]' if extra else ''))
    if not c: problems.append(label)
def local(ctx):
    ctx.route('**/three.min.js', lambda r: r.fulfill(body=THREE, content_type='application/javascript'))
    ctx.route('**/pista-nera/game.js*', lambda r: r.fulfill(body=GAME, content_type='application/javascript'))
    ctx.route('**/fonts.g*/**', lambda r: r.abort())
PHONE = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
    A = br.new_context(locale='it-IT', **PHONE); local(A); A.set_default_timeout(90000); A.grant_permissions(['microphone'])
    pa = A.new_page(); errs = []; pa.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    pa.goto(BASE + '/pista-nera/', wait_until='domcontentloaded'); pa.wait_for_function('window.__dbg'); pa.wait_for_timeout(1200)
    pa.fill('#inName', 'Voce'); pa.click('#btnCreate'); pa.wait_for_timeout(1500)
    code = pa.evaluate("new URLSearchParams(location.search).get('sfida')")
    B = br.new_context(locale='es-ES', **PHONE); local(B); B.set_default_timeout(90000); B.grant_permissions(['microphone'])
    B.add_init_script("localStorage.setItem('cyf.id','pAscolta'); localStorage.setItem('cyf.name','Ascolta')")
    pb = B.new_page(); pb.on('pageerror', lambda e: errs.append('B: ' + str(e)))
    pb.goto(f'{BASE}/pista-nera/?sfida={code}', wait_until='domcontentloaded'); pb.wait_for_function('window.__dbg'); pb.wait_for_timeout(2000)
    # il contesto audio di B va "sbloccato" con un tocco, come su un telefono vero
    pb.click('#btnReady'); pb.wait_for_timeout(300); pb.click('#btnReady'); pb.wait_for_timeout(300)
    vis = pa.evaluate("() => ({ hidden: document.getElementById('btnVoice').hidden, label: document.getElementById('voiceLbl').textContent, mr: typeof MediaRecorder })")
    check(not vis['hidden'] and vis['label'] == 'Parla', 'pulsante del microfono presente nella stanza', json.dumps(vis))
    # registra 1,6 s con il microfono finto e manda
    pa.click('#btnVoice'); pa.wait_for_timeout(400)
    rec = pa.evaluate("() => ({ recording: __dbg.voice.recording, rate: __dbg.voice.rate, label: document.getElementById('voiceLbl').textContent, toasts: window.__toasts.join('|') })")
    check(rec['recording'] and rec['rate'] >= 8000, 'registrazione partita con Web Audio (niente MediaRecorder)', json.dumps(rec))
    pa.wait_for_timeout(1600)
    pa.click('#btnVoice')
    try:
        pb.wait_for_function("!document.getElementById('voiceNow').hidden", timeout=10000); bubble_seen = True
    except Exception: bubble_seen = False
    who_seen = pb.evaluate("() => ({ who: document.querySelector('#voiceNow b').textContent, playing: !!__dbg.playing, ac: __dbg.ac && __dbg.ac.state })")
    pa.wait_for_timeout(1500)
    sent = pa.evaluate("() => ({ toasts: window.__toasts.join('|'), recording: __dbg.voice.recording })")
    check('Vocale inviato' in sent['toasts'] and not sent['recording'], 'vocale inviato (conferma del server)', json.dumps(sent))
    got = pb.evaluate("() => window.__lastVoice ? { mime: window.__lastVoice.mime, len: window.__lastVoice.data.length, dur: window.__lastVoice.dur, name: window.__lastVoice.name, data: window.__lastVoice.data } : null")
    check(got is not None and got['mime'] == 'audio/wav', 'l\'altro telefono riceve il vocale in formato WAV', got and json.dumps({k: v for k, v in got.items() if k != 'data'}))
    if got:
        raw = base64.b64decode(got['data'])
        rate, ch, bits = struct.unpack('<I', raw[24:28])[0], struct.unpack('<H', raw[22:24])[0], struct.unpack('<H', raw[34:36])[0]
        n = struct.unpack('<I', raw[40:44])[0] // 2
        dur = n / rate
        peak = max(abs(struct.unpack('<h', raw[44 + i * 2:46 + i * 2])[0]) for i in range(0, n, 50)) if n else 0
        check(raw[:4] == b'RIFF' and raw[8:12] == b'WAVE' and ch == 1 and bits == 16 and 8000 <= rate <= 16000, f'WAV mono 16 bit a {rate} Hz', f'{len(raw)} byte')
        check(1.0 <= dur <= 3.0 and abs(dur - got['dur']) < 0.3, f'durata {dur:.2f} s coerente con quella dichiarata ({got["dur"]} s)')
        check(peak > 500, 'l\'audio non è muto (il microfono finto genera un tono)', f'picco {peak}')
        check(got['len'] <= 300000, 'dentro il limite del server', str(got['len']))
    check(bubble_seen and who_seen['who'] == 'Voce' and who_seen['playing'], 'sull\'altro telefono il vocale si riproduce (fumetto "Voce está hablando")', json.dumps(who_seen))
    pb.wait_for_function("document.getElementById('voiceNow').hidden", timeout=15000)
    after = pb.evaluate("() => ({ bubble: !document.getElementById('voiceNow').hidden, toasts: window.__toasts.join('|') })")
    check(not after['bubble'] and 'reproducir' not in after['toasts'], 'a fine riproduzione il fumetto sparisce, nessun errore di formato', json.dumps(after))
    # secondo vocale entro 3 minuti: il server fa aspettare
    w = pa.evaluate("() => ({ disabled: document.getElementById('btnVoice').disabled, label: document.getElementById('voiceLbl').textContent })")
    check(w['disabled'] and ':' in w['label'], 'subito dopo il pulsante mostra il conto alla rovescia dei 3 minuti ed è disattivato', json.dumps(w))
    check(not errs, 'nessun errore JavaScript', '; '.join(errs[:2]))
    br.close()
print('\n' + ('PROBLEMI:' if problems else 'NESSUN PROBLEMA'))
for x in problems: print(' -', x)
import sys as _sys
_sys.exit(1 if problems else 0)   # esito per il cancello dei test: 1 = qualcosa non va
