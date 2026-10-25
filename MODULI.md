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

- **Puri** (`PN.base`, `PN.lingua`, `PN.geometria`, `PN.rider`): un oggetto pronto all'uso, creato quando il file si carica.
- **Con istanza** (`PN.pista`, `PN.sfondi`, `PN.citta`, `PN.effetti`, `PN.audio`, `PN.vocali`, `PN.oggetti`, `PN.avversari`):
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
| il modello del rider, la maglia, lo stemma, la posa | `moduli/rider.js` |
| scia, spruzzi, scintille, fiocchi | `moduli/effetti.js` |
| suoni e pulsante audio | `moduli/audio.js` |
| messaggi vocali, silenzia, segnala | `moduli/vocali.js` |
| banane e bombe | `moduli/oggetti.js` |
| gli avversari in pista e la classifica dal vivo | `moduli/avversari.js` |
| i messaggi tra gioco e server | `shared/protocollo.js` |
| stato della partita, fisica, generazione della pista, comandi, schermate, rete, HUD | `game.js` (da dividere ancora: A-11) |
