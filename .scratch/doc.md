# C-Y-F Gaming · Pista Nera — 0.26.2 … 0.29.0 (Implementation dell'1:00 del 29/10/2026)

Scritte nella notte tra il 28 e il 29 ottobre 2026 dall'attività "Implementation" (R-512), **senza prove** (solo controlli statici: `node --check`, matrice, `npm run nomi`, `controlli.mjs`; unico rosso C4 su `online:`). Ramo `giorno/2026-10-29-notte`, che parte da `giorno/2026-10-28-sera` (0.26.1, contiene `main` 0.25.7 e tutti i rami del 28/10). **Niente è online**: la Verifica delle 9:30 aggiunge le prove qui sotto, fa il giro completo, corregge e pubblica entro le 14:30.

| Versione | ID | Cosa | Dove |
|---|---|---|---|
| 0.26.2 | B-04 | Posto prenotato nella sala online e del Gran Premio; nuovi tentativi automatici nel gioco se la sala è piena | `src/sale.mjs` (nuovo), `src/stanza.mjs`, `src/worker.js`, `moduli/sala.js` (nuovo), `game.js` |
| 0.27.0 | R-520, R-521, S-54 | Banana 1.500, bomba 50, bananone 1.500 fisso | `shared/protocollo.js`, `index.html`, `i18n.js`, `src/comune.mjs` |
| 0.27.0 | R-522 | Immuni a banana e bananone lanciati curvando o in aria (anche gli avversari del computer); oggetti a terra come prima | `bot.js`, `game.js` (`stato.sterza`), `i18n.js` |
| 0.27.0 | R-523 | Rotellina del telefono come la tastiera: giù = accelera (rider abbassato), su = frena (rider alzato) | `comandi.js`, `game.js` (`flipIn`), `rider.js` (`pose`), `i18n.js` |
| 0.28.0 | R-519 (seconda parte), S-53 | Allenamento uguale alla gara: gara vera sul dispositivo contro 3 avversari, con il "server finto" | `moduli/gara_locale.js` (nuovo), `shared/gara.js` (nuovo), `game.js`, `schermate.js`, `src/stanza.mjs`, `src/comune.mjs`, `src/avversari.mjs`, `i18n.js` |
| 0.29.0 | R-513 (riga 1, punto 6) | Uccelli lontani nel cielo e acqua che luccica sul suolo lontano delle città sul mare | `cielo.js`, `sfondi.js`, `panorami.js` (`acqua`), `game.js` |

## B-04 — sala online con 50 persone insieme (0.26.2)

**Il baco** (simulazione del 28/10): `/api/quick` sceglieva la sala contando solo chi era già dentro; tra la risposta e il saluto (`hello`) passano 0,1-0,5 s e in quell'intervallo tutti vedevano la stessa sala libera: 42 su 50 respinti con "La sfida è piena".

**La correzione, in due parti.**
1. **Server.** `src/sale.mjs` (funzioni pure, provabili in Node): `pulisciPrenotazioni(mappa, dentro, now, durata)`, `prenotaPosto(mappa, id, presenti, max, now)`, `occupati(info)`, `ordinaSaleOnline(infos, max)`, `ordinaSaleGp(infos, max)`, `PRENOTAZIONE_MS = 10000`. In `src/stanza.mjs`: `this.prenotazioni` (Map id → istante, in memoria), `info()` risponde anche `prenotati`, nuova RPC `prenota(id)` → `{ ok, players, prenotati }` (un Durable Object esegue una chiamata alla volta: 50 richieste nello stesso istante ricevono 50 risposte coerenti), `hello` cancella la prenotazione del proprio id. In `src/worker.js` `/api/quick?id=…` (e `?gp=1`) interroga le sale, le ordina contando presenti + prenotati e prenota prima di rispondere `{ code, players, prenotati }`; sale piene saltate, tutte piene → 503 come prima; GP chiuso → 409 come prima.
2. **Gioco.** `moduli/sala.js` (`PN.sala({ myId, diag })`): `chiedi(gp)` chiama `/api/quick` con il proprio id; `riprova(gp)` dopo un `full` chiede un'altra sala da sola fino a 3 volte con un'attesa a caso di 0,2-1 s, senza errore a schermo; `tentativi()`. In `game.js` i pulsanti Online e "Entra nel Gran Premio" e la chiusura 1008 usano il modulo; il messaggio `full` non mostra più l'errore nelle sale pubbliche. Corretto anche: la sala GP piena rimandava a `btnOnline` (sala online normale).

**Prove per la Verifica**: `node tools/verifica/simulazione.mjs --modo=online --solo-ingresso=1` → 0 respinti, sale ONLINE1…ONLINE7; T17 in `test_server.mjs`: 12 `/api/quick?id=p1…p12` in `Promise.all` → 8 ONLINE1 + 4 ONLINE2, poi `hello` di uno su ONLINE1 e un nuovo `/api/quick` → ancora ONLINE2; `sale.mjs` in Node (`prenotaPosto` 7+0 → true, 7+1 → false; `pulisciPrenotazioni` toglie una prenotazione di 11 s fa e una di chi è dentro; `ordinaSaleOnline` preferisce lobby con 1 prenotato a racing con 3 presenti); browser: `fetch` finto che risponde `full` due volte e la terza una sala → si entra senza `#menuErr`, `PN.sala` con `tentativi()` = 2.

## 0a — prezzi (0.27.0)

`COSTI = { banana: 1500, bomb: 50, bananone: 1500 }` in `shared/protocollo.js` (prima `{ banana: 50, bomb: 150 }` e `bananone = bomb × 10`): gioco, server (`st.spesa`) e avversari del computer leggono lo stesso numero. Pulsanti 🍌 1500 · 💣 50 · 🍌 1500 in `index.html`; testi `kBanana`, `kBomb`, `kThrow`, `bananaTitle`, `bombTitle` nelle 4 lingue. **Fasce delle misure** `pts_lt50 / pts_50_149 / pts_150_1499 / pts_1500` in `src/comune.mjs` con i numeri fissi 50/150/1.500 (prima lette da `COSTI`): le misure restano confrontabili con i giorni prima. `bot.js` non cambia: le soglie leggono `COSTI` (bomba posata appena ha 50 punti e qualcuno dietro entro 45 m, ogni 18-40 s). Già aggiornata la riga di `test_server.mjs` che controllava "bananone = 10 × bomba". S-54: Luigi non ha risposto → 1.500 fisso.

## 0b — immuni curvando o in aria (0.27.0)

`bot.js` `colpo()` è il punto unico in cui banana e bananone lanciati arrivano (persone e avversari guidati da questo dispositivo): dopo i 450 ms di volo, chi è in aria (R-241, come prima) **oppure** sta sterzando non cade e vede "Schivata in curva!" (`dodgedSteer`, 4 lingue). Per il giocatore: `stato.sterza` (nuovo in `game.js`) = `inSteer() !== 0`, cioè ← → o A/D premuti o rotellina spostata di lato oltre la zona morta (`dead()` in `comandi.js`, 14 %). Per gli avversari: `b.sterzo` salvato a ogni passo (0 se fermi, caduti o in aria), schivano se |sterzo| > 0,3. **Oggetti a terra** (`oggetti.js` `collideHazards`): invariati, colpiscono anche curvando; in aria si saltano come prima.

## 0c — rotellina come la tastiera (0.27.0)

`comandi.js`: `inFast` = freccia giù o `stick.y > 0.35` (dito in basso); `inSlow` = freccia su o `stick.y < -0.35`. `game.js` `flipIn` con gli stessi segni (in aria su/giù = stessi salti mortali delle frecce). `rider.js` `pose(k0, …, fwd)`: con la frenata (`fwd` = `brakeS`) `k = k0 × (1 − fwd/2)` (ginocchia piegate la metà), `hipY = 0.93 − k×0.25 + fwd×0.06` (anche almeno 5-6 cm più alte della corsa normale), `kneeY + fwd×0.03`; vale anche per gli altri rider in pista (`avversari.js` passa `fwd = max(0, −ks)`). Testi `tStick` e `stickAria` nelle 4 lingue. Chiude S-20.

## 0 — allenamento uguale alla gara (0.28.0)

**Idea**: non riscrivere la gara per l'allenamento, ma dare al gioco un "server finto" che parla il protocollo. `moduli/gara_locale.js` (`PN.garaLocale({ myId, onMsg, diag })`): `ws()` restituisce un oggetto con `readyState`, `send(str)`, `close()` che va in `net.ws` al posto del WebSocket; `avvia({ me, scena, seed })` manda `countdown` (racers = giocatore + 3 avversari forte/medio/lento, `pilota` = giocatore, `length` 2000, `startAt` 0, `gatherUntil` +4 s); su `loaded` (o `pronto`, o dopo 4 s) manda `go` con `startAt` = ora + 3 s; `bots` e `pos` aggiornano l'ultima posizione e le statistiche; `botfinish` e `finish` → `finished`; quando il giocatore arriva (o dopo 6 minuti) → `results` con i tempi stimati degli avversari ancora in pista, `awards`, `earned = null` per tutti (niente punti collezionati: sono del server); `start` dai risultati → gara nuova con un seme nuovo (`round` + 1). I messaggi arrivano al gioco con `setTimeout(…, 0)`, come dalla rete. `throw`, `drop`, `hit`, `voice` sono ignorati: gli "altri" sono gli avversari guidati dallo stesso dispositivo, che li hanno già visti.

**`game.js`**: `startSolo()` prepara `net` (`code` ALLENAMENTO, `hostId` = io, `locale` = true, `ws` = GL.ws()) e chiama `GL.avvia`; `connect()` azzera `net.locale`; `raceClock` salta l'attesa della sala quando `net.locale`; `beginRace` dice "Allenamento: gara contro 3 avversari del computer, traguardo a 2 km" (`trainRace`); il microfono è grigio come nella pista del giorno. **`schermate.js`**: titolo "Allenamento · città · gara n" (`trainTitle`), pulsante **Ricomincia** (`trainAgain`), stato "Premi Ricomincia… In allenamento non si vincono punti" (`trainHint`). Tutto il resto (HUD con tempo, posizione, Mancano, classifica dal vivo, banane e bombe, avversari che corrono fino al traguardo, 3-2-1, cartello dei 500 m, risultati con 🤖 e premi) è il codice della gara.

**`shared/gara.js`** (`PN.gara` / `CYF_GARA`, puro): `VEL_MAX_MS` 24, `PUNTI_POSTO` [100, 70, 50], `PUNTI_ALTRI` 30, `tempoMinimoMs(len)`, `stimaArrivo(z, el, len, minMs, maxMs)`, `classifica(results, { daily, senzaPunti })` → `{ results, awards }`. Lo usano il server (`src/comune.mjs` per `MAX_SPEED_MS` e `PLACE_POINTS`, `src/avversari.mjs` che riesporta `stimaArrivo`, `src/stanza.mjs` `endRace` che ora chiama `GARA.classifica` al posto delle 14 righe di prima: stesso risultato) e il gioco.

**S-53** (Luigi non ha risposto): senza vite e senza record di punti, come in gara; la discesa senza fine (`mode 'solo'`, 3 vite, pausa) resta nel codice ma non parte più dal menu. **Da sapere**: le missioni "gare finite" e "podio" contano anche l'allenamento-gara.

## Riga 1, punto 6 — uccelli e acqua (0.29.0)

`cielo.js`: gruppo `uccelli` (6 `THREE.Line` di 3 punti, 4 sul telefono) a 450 m che segue la telecamera come il cielo, ali che battono (`battito(time)`), stormo che attraversa il cielo in ~10 minuti (`angolo += dt × 0.011`), invisibile dietro la telecamera; `uccelliVisibili(v)` (spento in qualità bassa da `game.js`); fermo con `?cielo=fermo` e "riduci il movimento". `sfondi.js`: per le città con `terra` nelle ricette (`PAN.acqua(nome)`: Napoli, Londra, Lisbona, New York) il disco del suolo lontano usa un `ShaderMaterial` con la stessa sfumatura più scintille (celle 1/380 della tela, una su venti, fasi a caso, più forti verso il sole, solo nella fascia del mare); `time` avanza in `segui()` se non è fermo. `game.js` passa `sole: T.sun` a `skylineFor`. `sfondi` ora dipende anche da `base` (matrice aggiornata).

## Prove da aggiungere (Verifica delle 9:30) — riassunto

Il dettaglio sta nel paragrafo "Implementation dell'1:00 del 29/10" in testa a REQUISITI.md e nelle righe B-04, 0a, 0b, 0c, 0, 1. In breve: (1) B-04 simulazione e T17; (2) costi nuovi in T4/T8 e pulsanti; (3) schivata in curva e oggetti a terra; (4) rotellina invertita in `test_gioco.py`/`test_comandi.py` (le prove R-210/R-211 vanno invertite); (5) `test_allenamento_gara.py` dal via ai risultati + `shared/gara.js` in Node + T8 identica; (6) uccelli e acqua con e senza `?cielo=fermo` (foto di riferimento da rifare: cambiano Napoli, Londra, Lisbona, New York e tutte le città per gli uccelli, salvo `?cielo=fermo` che li tiene fermi ma visibili). Le prove di `test_oggetti_allenamento.py` e `test_avversari.py` scritte sull'allenamento senza fine vanno riscritte sulla gara locale.

## Non fatto e perché

- Riga 1 "terzo piano per le città senza monti" e riga 2 "misure con soglie a ogni giro" (strumenti di prova: li scrive la Verifica); riga 3 aspetta la riga 5 (A-23, Da approvare); riga 4 (resto del livello 2) cambia colori e luci di tutte le città: va fatta in un turno a sé con le foto prima/dopo, quando le prove della 0.26.0-0.29.0 sono verdi.
- Errori dei telefoni (`/api/errors?giorni=2`) non letti: dominio non consentito al proxy della sessione (riga 1d per Luigi). Ultimo cancello di GitHub: n. 84, `main` 0.25.7, verde.
