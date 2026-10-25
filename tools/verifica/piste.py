"""Controllo dei tracciati delle città (R-312): legge TRACKS da game.js e stampa, per ogni pista,
ampiezza, pendenza laterale massima, raggio di curva minimo, quota di rettilineo e fattore di tempo.

Fattore di tempo: con la fisica del gioco la velocità vale vmax·cos(angolo)^1,6 e si avanza di cos(angolo),
quindi il tempo per metro di gara cresce come (1 + pendenza²)^1,3. Stessa media = tempi uguali a guida ideale.
Uso: python3 piste.py   (serve numpy)"""
import os, re, json
import numpy as np
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
src = open(os.path.join(REPO, 'public', 'pista-nera', 'game.js'), encoding='utf-8').read()
block = src[src.index('const TRACKS = {') + len('const TRACKS = '):src.index('let TRK = TRACKS.neve;')].strip().rstrip(';')
block = re.sub(r'//[^\n]*', '', block)
block = re.sub(r'(\w+):', r'"\1":', block)
block = re.sub(r",\s*}$", "}", block)
TRACKS = json.loads(block)
Z = np.arange(0, -12000, -1.0)
def center(T):
    s = sum(a * np.sin(Z / w + p) for a, w, p in T['w'])
    if T['lo'] < 1: s = s * (T['lo'] + (1 - T['lo']) * (0.5 + 0.5 * np.sin(Z / T['W'] + T['q'])) ** T['k'])
    return s
ref = None
print(f"{'pista':12s} {'ampiezza':>8s} {'pend.max':>8s} {'raggio min':>10s} {'rettilineo':>10s} {'tempo':>8s}")
for k, T in TRACKS.items():
    c = center(T); s = np.gradient(c); cc = np.gradient(s)
    tf = np.mean((1 + s * s) ** 1.3); ref = ref or tf
    print(f"{k:12s} {c.max() - c.min():7.1f}m {abs(s).max():8.3f} {1 / abs(cc).max():9.0f}m {np.mean(abs(s) < 0.05):9.0%} {100 * (tf / ref - 1):+7.2f}%")
