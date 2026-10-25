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
| `npm test` (`cancello.sh`) | **Cancello rapido**: controlli statici + server senza T8 + `test_rapido.py`. Accende e spegne da solo il server locale. Esce con 1 se una prova fallisce | ~75 s |
| `npm run test:tutto` | **Giro completo**: tutte le prove qui sotto (lo fa il controllo notturno) | ~30 min |
| `node controlli.mjs` | Sintassi di tutti i .js, testi del gioco presenti nelle 4 lingue con gli stessi segnaposto, versione nello storico | <1 s |
| `python3 test_rapido.py` | 13 scenari nella stessa pagina (allenamento parte, il rider scende), pannello di diagnosi, errori nel registro | ~50 s |
| `node test_server.mjs` (`VELOCE=1` salta T8) | Server delle gare: errori dai browser (T9), codici, città della gara scelta dall'organizzatore, attesa dei concorrenti (anche i 40 s massimi) e ingresso a gara avviata, maglia nella stanza, stanza piena, organizzatore, durate, seed, arrivo troppo veloce, banane e bombe, vocali e segnalazioni, sala online, scheda doppia, gara valida con attesa reale (231 s), classifica, punti, contatori | ~6 min |
| `python3 test_gioco.py` | 13 scenari contro `tabella_citta.json` (la tabella Excel delle città), pista diversa per città con tempi simili, trampolini giganti, stemma CYF, guida, acrobazie, atterraggio assistito, velocità, maglie, gara a due con banana e silenzio | ~6 min |
| `python3 test_lingue.py` | Home e gioco nelle 4 lingue, su telefono e PC | ~6 min |
| `python3 test_risultati.py` | Schermata dei risultati e testo condiviso nelle 4 lingue (`SOLO=telefono-it,pc-en` per limitare) | ~6 min |
| `python3 test_comandi.py` | Rotellina, Salta e microfono sul telefono simulato (i tempi reali del 3D software falsano i confronti di velocità: per quelli vale `cmp_input.py`) | ~4 min |
| `python3 test_vocale.py` | Vocale da telefono a telefono con il microfono finto di Chromium: registrazione Web Audio, WAV, server, riproduzione, conto alla rovescia dei 3 minuti | ~1 min |
| `python3 cmp_input.py` | Rotellina contro tastiera a parità di tempo di gioco | ~2 min |
| `python3 piste.py` | I 13 tracciati (R-312): ampiezza, pendenza massima, raggio minimo, rettilinei e fattore di tempo rispetto alla Neve (serve numpy, non il server) | pochi secondi |
| `python3 foto_citta.py [città,…] [spostamento]` | Foto di ogni città, anche guardando verso il lato (spostamento 13) | ~1 min/città |
| `python3 rider_view.py [cartella] [scena]` | Primi piani del rider da 6 angolazioni | ~1 min |

`tabella_citta.py` ricostruisce `tabella_citta.json` dalla tabella `CYF-elementi-per-citta.xlsx` del 24/10/2026 (cartella "CYF gaming" sul Desktop di Luigi): se la tabella cambia, vanno aggiornati tutti e due.

Tutte le prove escono con codice 1 se trovano un problema: è quello che usa il cancello su GitHub (`.github/workflows/cancello.yml`).
