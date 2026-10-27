# Moduli di Pista Nera — la matrice

Dalla 0.12.0 il gioco non è più un file solo: `public/pista-nera/game.js` tiene lo stato della partita e il ciclo
di gioco, e tutto il resto sta in `public/pista-nera/moduli/`, un file per argomento. Ogni modulo espone `PN.<nome>`
e dichiara in testa da quali altri moduli dipende:

```js
// modulo: oggetti
// dipende da: base, lingua, geometria, pista, effetti, audio
```

La tabella qui sotto (la **matrice**) la genera `node tools/verifica/matrice.mjs` leggendo i file; con `--check`
esce con 1 se un modulo usa qualcosa che non dichiara, se dichiara una dipendenza che non usa, o se due moduli si
usano a vicenda. Il cancello dei test la esegue a ogni modifica: così la matrice non invecchia mai.

## Come sono fatti i moduli

- **Puri** (`PN.base`, `PN.lingua`, `PN.geometria`, `PN.rider`, `PN.tracciato`, `PN.fisica`, `PN.panorami`): un oggetto pronto all'uso, creato quando il file si carica. `base` e `panorami` girano anche dentro un worker (niente `document`, niente THREE): `sfondi` li ricarica lì per dipingere le cartoline senza fermare il gioco (A-22).
- **Con istanza** (`PN.pista`, `PN.sfondi`, `PN.citta`, `PN.generazione`, `PN.effetti`, `PN.audio`, `PN.vocali`, `PN.profilo`, `PN.personaggio`, `PN.oggetti`, `PN.avversari`, `PN.bot`, `PN.comandi`, `PN.schermate`, `PN.missioni`, `PN.sfida`):
  una funzione che il gioco chiama una volta sola passando quello che serve (la scena 3D, il terreno, la rete…) e che
  restituisce l'istanza. Quello che un modulo riceve è scritto nel commento in testa al file.
- **Lo stato del gioco** (posizione del rider, modalità, punti…) resta in `game.js`. I moduli che devono leggerlo
  ricevono l'oggetto `stato` (solo lettura, tranne `bonus`): non tengono copie proprie.
- Nessun modulo tocca il DOM fuori dai propri elementi (il pulsante audio sta in `audio`, quelli dei vocali in `vocali`).

## Lavorare in parallelo (A-18)

Due chat possono lavorare insieme se toccano moduli diversi. Prima di iniziare, ogni chat dice su quale modulo lavora
("questa chat tocca solo `citta` e `citta/*.js`") e lavora su un ramo proprio; si unisce a `main` solo con il cancello
verde. Le coppie sicure sono quelle che nella matrice non si toccano: per esempio `citta` e `vocali`, `rider` e `rete`,
`oggetti` e `sfondi`. Due chat sullo stesso modulo, o una su `game.js` e l'altra su un modulo che `game.js` chiama in
modo diverso, vanno in conflitto: meglio una alla volta.

## La matrice

<!-- matrice -->
| File | Modulo (PN.…) | Righe | Dipende da (cosa usa) |
|---|---|---|---|
| `moduli/audio.js` | audio | 63 | base (store); lingua (tr) |
| `moduli/avversari.js` | avversari | 141 | pista (center, hgt); base (TAU, PALETTE, fmtTime); lingua (tr, ord, fmtLen); rider (JERSEYS, makeRider, bodyTurn, switchOf, lookBot) |
| `moduli/base.js` | base | 41 | nessuno |
| `moduli/bot.js` | bot | 419 | fisica (); base (TAU, clamp, mulberry32); lingua (tr); protocollo (COSTI, FERMO, NOMI_BOT); tracciato (dati); pista (center, hgt); oggetti (hazards, showThrow, addHazard, removeHazard); avversari (botUpdate, remotes, playThrow) |
| `moduli/citta.js` | citta | 881 | pista (center, hgt, groundCanvas, stoneTexture, sampietriniTexture, GROUND_MAKE); base (TAU, lin, mulberry32); lingua (tr, fmtLen); geometria (merge, lumpy, vcMat, GEO, gateGeo) |
| `moduli/comandi.js` | comandi | 105 | base (clamp); audio (initAudio, muted) |
| `moduli/effetti.js` | effetti | 132 | base (isPhone, lin, rand, reduceMotion) |
| `moduli/fisica.js` | fisica | 84 | base (TAU, clamp) |
| `moduli/generazione.js` | generazione | 322 | base (TAU, lin, mulberry32); geometria (GEO, vcMat); tracciato (riga, coperto, passo); fisica (rampTop); pista (center, hgt, addMesh); citta (CITY_CFG, facadesFor, roofFor, buildingGeo, gemGeo, gemMat, …) |
| `moduli/geometria.js` | geometria | 95 | base (TAU, lin, mulberry32) |
| `moduli/lingua.js` | lingua | 37 | base (store) |
| `moduli/missioni.js` | missioni | 129 | base (store); lingua (lang, tr) |
| `moduli/oggetti.js` | oggetti | 176 | base (TAU, clamp, lin); lingua (tr); geometria (merge, vcMat); protocollo (COSTI, FERMO, THROW_KINDS); pista (center, hgt, addMesh); effetti (spray, sparkle); audio (thump) |
| `moduli/panorami.js` | panorami | 1110 | base (mulberry32) |
| `moduli/personaggio.js` | personaggio | 104 | base (store, lin); rider (JERSEYS, myJersey, myHair, myGear, makeRider) |
| `moduli/pista.js` | pista | 176 | base (TAU, clamp, isPhone, lin, mulberry32) |
| `moduli/profilo.js` | profilo | 101 | base (store); lingua (tr) |
| `moduli/rider.js` | rider | 532 | base (TAU, lin, store, mulberry32) |
| `moduli/schermate.js` | schermate | 287 | base (PALETTE, START_ALT, SLOPE, fmt, fmtTime); lingua (tr, ord, fmtLen); protocollo (COSTI) |
| `moduli/sfida.js` | sfida | 184 | base (fmtTime); lingua (lang, tr, ord); protocollo (SCENE); schermate (cityName, giorno) |
| `moduli/sfondi.js` | sfondi | 119 | base (lin); panorami (dipingi) |
| `moduli/tracciato.js` | tracciato | 98 | base (TAU, clamp, mulberry32) |
| `moduli/vocali.js` | vocali | 180 | audio (initAudio, audio, muted); base (isPhone, store, PALETTE); lingua (tr) |
| `game.js` | — | 1056 | base (TAU, SLOPE_DEG, SLOPE, START_ALT, HORIZON, PALETTE, …); lingua (); pista (); sfondi (); geometria (merge, lumpy, vcMat, GEO, gateGeo); citta (); rider (JERSEYS, myJersey, myHair, myGear, jacketTexture, switchOf, …); effetti (); audio (); fisica (); generazione (); comandi (); schermate (); profilo (); missioni (); personaggio (); protocollo (VERSIONE, THROW_KINDS); vocali (); oggetti (); avversari (); bot (); sfida () |
| `diagnosi.js` | — | 162 | nessuno |
| `i18n.js` | — | 379 | nessuno |
| `shared/protocollo.js` | protocollo | 94 | nessuno |
<!-- /matrice -->

## Dove sta cosa

| Cerco… | File |
|---|---|
| le costanti, `clamp`, `store`, il generatore di numeri casuali con seme | `moduli/base.js` |
| i testi e la lingua | `moduli/lingua.js` (i testi stessi in `i18n.js`) |
| la forma della strada di una città (`TRACKS`), il rilievo, il terreno | `moduli/pista.js` |
| gli sfondi lontani (Vesuvio, Colosseo, skyline) | `moduli/sfondi.js` |
| forme condivise (abete, roccia, rampa della neve, porta) | `moduli/geometria.js` |
| i modelli e i colori di una città, le facciate, il traguardo | `moduli/citta.js` e `citta/<nome>.js` |
| il modello del rider, la maglia, i capelli, pantaloni, casco e tavole, lo stemma, la posa | `moduli/rider.js` |
| scia, spruzzi, scintille, fiocchi | `moduli/effetti.js` |
| suoni e pulsante audio | `moduli/audio.js` |
| messaggi vocali, silenzia, segnala | `moduli/vocali.js` |
| missioni con le stelle, 3 obiettivi alla volta (R-243) | `moduli/missioni.js` |
| "batti il mio tempo": link, riquadro "ti sfida", distacco in gara, Condividi e immagine del risultato (R-236, D-05) | `moduli/sfida.js` |
| schermata "Modifica il personaggio" con l'anteprima 3D (R-227) | `moduli/personaggio.js` (i modelli di casco, tavole e pantaloni in `moduli/rider.js`) |
| impostazioni ricordate dal server, codice personale (R-226) | `moduli/profilo.js` (il server in `src/worker.js`, `/api/profilo`) |
| banane e bombe | `moduli/oggetti.js` |
| gli avversari in pista e la classifica dal vivo | `moduli/avversari.js` |
| dove sono ostacoli, bonus, rampe e porte (la pista come dati, uguale per tutti) | `moduli/tracciato.js` (i modelli li costruisce `moduli/generazione.js`) |
| gli avversari guidati dal computer: guida, salti, acrobazie, banane, pilota (R-234) | `moduli/bot.js` (il server in `src/worker.js` e `src/avversari.mjs`) |
| i messaggi tra gioco e server | `shared/protocollo.js` |
| schermate (menu, stanza, risultati), avvisi, HUD, classifica del menu | `moduli/schermate.js` |
| generazione della pista con il seme, palazzi, lati della strada | `moduli/generazione.js` |
| tastiera, rotellina, Salta | `moduli/comandi.js` |
| stato della partita, fisica, rete, ciclo di gioco | `game.js` (da dividere ancora: A-11) |
