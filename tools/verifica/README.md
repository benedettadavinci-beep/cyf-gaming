# Prove automatiche di Pista Nera

Girano contro `wrangler dev` (http://127.0.0.1:8787) con Playwright per Python e Chromium (grafica software: i flag swiftshader sono già nei file).
Nessuna di queste prove va online: `public/` resta l'unica cartella pubblicata.

Preparazione (una volta):

```bash
npm install                                   # wrangler
mkdir -p ~/three && cd ~/three && npm pack three@0.128.0 && tar xzf three-0.128.0.tgz && cd -
export THREE_JS=~/three/package/build/three.min.js   # il browser di prova non raggiunge il CDN
npx wrangler dev --port 8787 &
```

| File | Cosa prova | Tempo |
|---|---|---|
| `node test_server.mjs` | Server delle gare: codici, stanza piena, organizzatore, durate, seed, arrivo troppo veloce, banane e bombe, vocali e segnalazioni, sala online, scheda doppia, gara valida con attesa reale (231 s), classifica, punti, contatori | ~5 min |
| `python3 test_gioco.py` | 13 scenari contro `tabella_citta.json` (la tabella Excel delle città), pista identica, guida, acrobazie, atterraggio assistito, velocità, maglie e ali, gara a due con banana e silenzio | ~6 min |
| `python3 test_lingue.py` | Home e gioco nelle 4 lingue, su telefono e PC | ~6 min |
| `python3 test_risultati.py` | Schermata dei risultati e testo condiviso nelle 4 lingue (`SOLO=telefono-it,pc-en` per limitare) | ~6 min |
| `python3 test_comandi.py` | Rotellina, Salta e microfono sul telefono simulato (i tempi reali del 3D software falsano i confronti di velocità: per quelli vale `cmp_input.py`) | ~4 min |
| `python3 cmp_input.py` | Rotellina contro tastiera a parità di tempo di gioco | ~2 min |
| `python3 foto_citta.py [città,…] [spostamento]` | Foto di ogni città, anche guardando verso il lato (spostamento 13) | ~1 min/città |
| `python3 rider_view.py [cartella] [scena]` | Primi piani del rider da 6 angolazioni | ~1 min |

`tabella_citta.py` ricostruisce `tabella_citta.json` dalla tabella `CYF-elementi-per-citta.xlsx` del 24/10/2026 (cartella "CYF gaming" sul Desktop di Luigi): se la tabella cambia, vanno aggiornati tutti e due.
