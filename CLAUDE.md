# C-Y-F Gaming · Pista Nera — istruzioni per Claude

Leggi questo file al posto del riepilogo lungo. Rispondi a Luigi in italiano, semplice, senza gergo.

## Cos'è
Gioco multigiocatore di snowboard/skate 3D nel browser (sito, Android, iPhone: **ogni modifica vale per tutti e tre**, R-010).
Online: https://cyf-gaming.benedetta-davinci-mellum.workers.dev/pista-nera/ — ogni commit su `main` va online da solo
(Cloudflare Workers Builds). Versione in `public/config.js`; `online:` in testa a `REQUISITI.md` = versione su `main`.

## Regole di Luigi (valgono su tutto)
1. **Prima frase di ogni attività: tempo stimato e token** (rimasti / stima del consumo) (R-509).
2. **Sera (regola del 18/11, 21:47 e 22:43):** le modifiche chieste vanno online **subito, senza prove di Claude**,
   ma **dopo il controllo automatico di GitHub** ("prove", ~4-5 min, ruleset "Cancello main" attivo: Luigi ha deciso
   di tenerlo). Rosso = non va online, si corregge. **Prove complete e correzioni generali solo di notte, dopo le 00.**
   Di giorno nessuna prova se Luigi non la chiede chiaramente. In chat solo controlli statici: `node --check` sui file
   toccati, `npm run matrice`, `npm run nomi`, `npm run controlli`.
3. **Prima i requisiti, poi il software (R-501).** Ogni richiesta = riga in `REQUISITI.md` (ID, data, stato, parole di Luigi).
4. **Word dei requisiti rigenerati a ogni cosa fatta**, prossimi passi in testa (R-507, R-511):
   `python3 tools/requisiti_docx.py REQUISITI.md docs/` (serve pandoc). Online = `docs/` su GitHub.
   Se la chat è collegata al PC: stessi due Word anche in `C:\Users\luigi\Desktop\CYF gaming` (e, se collegata,
   `G:\Il mio Drive\CYF gaming`). **Desktop e online devono essere uguali.**
5. **Il software cresce senza rallentare (R-510):** niente framework, niente riscritture; ogni novità è un modulo.

## Giro notturno 00:00–07:00 (R-537, dal 18/11)
Tutto il lavoro automatico gira di notte con cinque attività pianificate: 1 Verifica e pubblicazione (00:00–01:45),
2 Implementazione (01:50–05:10; la notte tra domenica e lunedì: Revisione settimanale), 3 Confronto con le altre app
(05:15–05:55), 4 Rapporto del mattino (06:05–06:35). Chi scrive non pubblica: il blocco 2 lascia il codice su
`giorno/<data>-notte`, lo prova e lo pubblica il blocco 1 la notte dopo. Ogni blocco scrive la sua riga in «Ultima notte»
(testa dei Prossimi passi). Dettagli: `REQUISITI.md`, «Regole di lavoro», punto 3.

## Come leggere i requisiti senza sprecare token (A-26)
- `REQUISITI.md` (~125 KB): solo ciò che serve per lavorare. Leggi prima le sezioni "Prossimi passi" e "Bachi";
  il resto con `grep -n` sull'ID o sulla parola.
- `REQUISITI-ARCHIVIO.md`: righe chiuse. **Mai leggerlo intero**: `grep -n "R-123" REQUISITI-ARCHIVIO.md`.
  Lo scrive da solo il generatore dei Word; le righe nuove vanno sempre in `REQUISITI.md`.
- `MODULI.md`: matrice delle dipendenze; aprila solo se tocchi la struttura dei moduli.

## Dove sta cosa
| Parte | File |
| --- | --- |
| Gioco: stato, movimento, rete, ciclo | `public/pista-nera/game.js` (non deve crescere: il codice nuovo va nei moduli) |
| Moduli del gioco (`PN.<nome>`) | `public/pista-nera/moduli/*.js` — fisica, rider, pista, citta, oggetti, bot, schermate, sala, gara_locale… |
| Città (12 schede) | `public/pista-nera/citta/<nome>.js` |
| Comune a gioco e server | `public/shared/` — `protocollo.js` (messaggi, `COSTI`), `gara.js`, `calendario.js` |
| Testi in 4 lingue | `public/pista-nera/i18n.js` (it/en/fr/es, sempre tutte e 4) |
| Server | `src/worker.js` (indirizzi) → `stanza.mjs` (gare), `classifica.mjs`, `comune.mjs`, `sale.mjs`, `giorno.mjs`… |
| Prove (solo di notte) | `tools/verifica/`, `npm test` (rapido), `npm run test:tutto` (~45 min) |
| Diagnosi | `public/pista-nera/diagnosi.js`, `?debug=1`, errori su `/api/errors?giorni=2` |

Convenzioni: modulo puro = oggetto pronto; modulo con istanza = `PN.x({ … })` chiamato una volta da `game.js`;
lo stato si legge dall'oggetto `stato`, mai copie proprie; dipendenze dichiarate in testa al modulo, matrice senza cicli.
Le pagine caricano i moduli con `<script>` in ordine in `public/pista-nera/index.html`.

## Pubblicare (sera)
1. Ramo `giorno/<data>-<nome>` da `main` aggiornato.
2. Requisiti → codice → versione (`config.js`, `package.json`, `<meta name="cyf-versione">`, riga nello storico) →
   `online:` = nuova versione → Word rigenerati → controlli statici.
3. Commit, push del ramo, pull request; quando il check "prove" è verde (~4-5 min) unione in `main` con la REST API
   (`gh api -X PUT repos/…/pulls/<n>/merge`; GraphQL e auto-merge non vanno).
4. Nota breve nel Project (`claude/CYF-Gaming-<versione>-<argomento>.md`) e Word sul Desktop se il PC è collegato.

## Cose che non funzionano dalla sandbox
- Il sito non si raggiunge (proxy 403): lo stato del deploy si legge dai check del commit su GitHub.
- Non si cancellano rami su GitHub: si elencano a Luigi.
- Le attività pianificate: dal 18/11 le modifica Claude direttamente quando Luigi lo chiede; il modello di un'attività
  si cambia solo su sua richiesta esplicita.
