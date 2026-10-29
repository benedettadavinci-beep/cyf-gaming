# C-Y-F Gaming (Challenge Your Friends) — riepilogo del progetto

Aggiornato al 29 ottobre 2026 (Implementation dell'1:00): **versione online 0.25.7** (28/10 sera, riquadro pubblicitario spento per tutti); sul ramo `giorno/2026-10-29-notte` aspettano le prove della Verifica delle 9:30 la **0.26.0** (sfondo al livello 2, qualità automatica), la **0.26.1** (B-05 classifica in allenamento, B-06 corridoio di atterraggio), la **0.26.2** (B-04 posto prenotato nella sala online), la **0.27.0** (prezzi nuovi: banana 1.500, bomba 50; immuni a banana e bananone curvando o in aria; rotellina del telefono come la tastiera), la **0.28.0** (allenamento uguale alla gara, con il "server finto" `gara_locale.js`) e la **0.29.0** (uccelli lontani, acqua che luccica). Dettagli in `claude/CYF-Gaming-0.26.2-0.29.0-implementation-29-10.md`, `claude/CYF-Gaming-0.26.0-sfondo-livello-2.md`, `claude/CYF-Gaming-0.26.1-classifica-allenamento-atterraggio.md`, `claude/CYF-Gaming-0.25.6-pubblicita.md`, `claude/CYF-Gaming-simulazione-2026-10-28.md`. Le regole di lavoro valide sono in `claude/CYF-Gaming-regole-di-lavoro.md` e in testa a REQUISITI.md. Il codice è su GitHub; `cyf-gaming.zip` resta come copia della prima versione.

## Obiettivo
Un **sito pubblico** dove le persone si collegano e si sfidano in gara in tempo reale. Il primo gioco è **Pista Nera**: snowboard 3D su una pista nera. Vince il tempo migliore.

## Regola di lavoro sulle prove (R-506/R-512, decisione di Luigi del 28/10 alle 23:15)
- **Due attività al giorno.** **Implementation all'1:00** (fino alle 5:30) scrive su un ramo `giorno/<data>-notte` prima i bachi aperti, poi le righe "Sì" della tabella di Claude, poi i requisiti Da fare approvati, **senza prove** (solo controlli statici: `node --check`, matrice, `npm run nomi`, `controlli.mjs`), e lascia nei prossimi passi le prove precise da aggiungere. **Verifica alle 9:30** unisce i rami `giorno/…`, aggiunge quelle prove, fa il giro completo, corregge ogni errore e **pubblica solo con tutto verde ed entro le 14:30**; poi, entro le 15, il confronto con le altre app (R-508). Nelle chat con Luigi nessuna prova se non la chiede chiaramente. Dettagli in `claude/CYF-Gaming-regole-di-lavoro.md`.
- Luigi vuole una **notifica sul cellulare** quando un lavoro lungo finisce o serve una sua decisione (26/10).
- All'inizio di ogni attività: tempo che serve e token (R-509).

## Piano di crescita (sezione 13 di REQUISITI.md, approvato il 26/10)
- Problema: si gioca in gara solo con almeno 2 persone collegate insieme; con pochi giocatori la sala online è quasi sempre vuota.
- Passi, uno per versione: **R-232 misure (fatto, 0.16.1)** → **R-233 pista del giorno (fatto, 0.17.0)** → **R-234…R-239 avversari guidati dal computer (fatto, 0.18.0)** → **R-236 "batti il mio tempo" (fatto, 0.21.0, online con la 0.25.5)** → **R-243 missioni (fatto)** → **R-244 modalità portale (fatto)** → **R-245 città della settimana (fatto)** → **R-246 fonte delle visite (fatto)** → **R-247 Gran Premio delle 21 (fatto)** → **R-517 riquadro pubblicitario (fatto, 0.25.6, spento)**. In corso: la grafica al livello 2 partendo dallo sfondo (R-513, 0.26.0 e 0.29.0 da provare) e l'allenamento uguale alla gara (R-519, 0.26.1 e 0.28.0 da provare).
- **Cambio del 26/10 sera**: niente fantasmi trasparenti. Luigi vuole avversari uguali ai giocatori veri ma guidati dal software; sue scelte: 🤖 piccolo solo nelle classifiche (in pista non si distinguono), presenti in allenamento, pista del giorno, sfida e sala online vuota, livelli misti.
- Idee da decidere dopo i dati delle misure: F-11 medaglie a tempo, F-12 gara online 2-3 min, F-13 oggetti per chi è indietro, F-14 livelli e sblocchi solo estetici (primo pezzo: la maglia della settimana), F-16…F-19 (serie di giorni, prima discesa guidata, tedesco, stagione, riga 2d per Luigi), F-20 formati della pubblicità.
- Il 27/10 alle 19:11 Luigi ha chiesto di **implementare quello che hanno i concorrenti e noi no, partendo dalla modifica più grossa**: fatto con le 0.21-0.25. Resta la proposta vera su CrazyGames, che fa Luigi (D-12).

## Stato attuale
- **Online dal 24 ottobre 2026:** https://cyf-gaming.benedetta-davinci-mellum.workers.dev (gioco: `/pista-nera/`). Versione online: **0.25.7** (28/10 sera, cancello n. 84 verde sul commit e54aaa1).
- Codice su GitHub: github.com/benedettadavinci-beep/cyf-gaming (pubblico, ramo `main`, **protetto dal 25/10 (A-08)**: si unisce solo con il cancello "prove" verde; Claude lavora su un ramo e poi `git push origin HEAD:main` a cancello verde).
  - Dalla 0.9.3 c'è `package-lock.json` (serve a `npm ci` nel cancello dei test); il deploy su Cloudflare funziona ugualmente.
  - **Dalla sandbox di Claude non si possono cancellare rami su GitHub**: i rami uniti li cancella Luigi dalla pagina Branches. Già dentro `main` al 29/10: `giorno/batti-missioni`, `giorno/portale-settimana`, `giorno/pagina-vecchia`, `giorno/oggetti-allenamento`, `giorno/prossimi-passi`, `notte/2026-10-26`, `notte/2026-10-27-sera`, `pubblicita-0.25.6`; superato `notte/2026-10-27`. **Rami del 28-29/10 da unire (catena unica)**: `giorno/riga-1d` ⊂ `giorno/2026-10-28-mattina` ⊂ `giorno/simulazione` ⊂ `giorno/2026-10-28-sera` ⊂ `giorno/2026-10-29-notte` (l'ultimo contiene tutti gli altri e `main`).
- Cloudflare: account benedetta.davinci.mellum@gmail.com.
  - Il Worker `cyf-gaming` è collegato al repository con Workers Builds (deploy command `npx wrangler deploy`).
  - Ogni modifica su `main` va online da sola. I build dei rami diversi da `main` risultano "failure" su GitHub: è normale.
  - Dalla sandbox di Claude il sito non si raggiunge con curl o node (proxy 403) e nemmeno con WebFetch (indirizzo non consentito: anche nelle notti del 28 e del 29/10, quindi errori dei telefoni e misure non letti): lo stato del deploy si legge dai check del commit su GitHub. Rimedio per Luigi (riga 1d dei prossimi passi): su claude.ai/code, ambiente cloud → Network access: Custom → Allowed domains `cyf-gaming.benedetta-davinci-mellum.workers.dev`.
- GitHub è collegato a Claude con il connettore e con l'app "Claude", installata su benedettadavinci-beep con accesso a cyf-gaming. In una chat nuova basta collegare il repository (`add_repo` con `access: push`).
- **Struttura a moduli (dalla 0.12.0 — A-10, A-11, A-12, A-18).** `game.js` è passato da 4.075 a ~1.100 righe. I moduli stanno in `public/pista-nera/moduli/` e ognuno espone `PN.<nome>`: base, lingua, portale (puro), pubblicita (0.25.6), pista, geometria, cielo (0.26.0: sole, nuvole e dalla 0.29.0 gli uccelli), qualita (0.26.0), panorami (puro, gira anche nel worker), sfondi, citta, fisica, tracciato, generazione, rider, effetti, audio, vocali, profilo, personaggio, oggetti, avversari, bot, comandi, schermate, settimana, granpremio, missioni, sfida, **sala** (0.26.2: `/api/quick` con il posto prenotato e i nuovi tentativi), **gara_locale** (0.28.0: il "server finto" dell'allenamento-gara). Le 12 città sono schede in `public/pista-nera/citta/<nome>.js`. In `public/shared/` i file che girano sia nel gioco sia nel server: `protocollo.js` (messaggi, `VERSIONE` 7, `COSTI`), `calendario.js` (settimana → città e maglia), **`gara.js`** (0.28.0: tempo minimo, tempo stimato degli avversari, classifica finale con punti e premi; lo usano `src/stanza.mjs`, `src/comune.mjs`, `src/avversari.mjs` e `moduli/gara_locale.js`). Nel server `src/sale.mjs` (0.26.2: scelta della sala e prenotazione, funzioni pure). **`MODULI.md`** contiene la matrice (chi dipende da chi), generata da `node tools/verifica/matrice.mjs` (`--check` nel cancello) e le regole per lavorare in parallelo. Convenzioni: moduli puri = oggetto pronto; moduli con istanza = funzione `PN.x({ … })` chiamata una volta da `game.js`; i moduli leggono lo stato del gioco dall'oggetto `stato` (P, mode, invuln, bonus, raceLen, myId, theme, remotes, throwAnim(), racing(), isCity(), net, serverNow(), lives, myTotal, distM(), score(), racePlace(), renderLive(), amIn(), toMenu(), colpo(), allenaConAvversari, **sterza** (0.27.0), nome(), sfida, settimana, granpremio), mai copie proprie. Le prove Playwright iniettano `window.__dbg` in `game.js` dopo `applyLang(lang);`. Restano in `game.js` (A-11 "in corso"): stato, il movimento del rider (con le regole di `moduli/fisica.js`), rete (`net`, `connect`, `onMsg`, `beginRace`, `raceClock`, `endRaceView`, `toMenu`; dalla 0.28.0 `net.locale` = allenamento-gara con `net.ws` = oggetto di `gara_locale.js`), render e ciclo `frame`.
- **Cancello dei test (dalla 0.9.3):** `.github/workflows/cancello.yml` lancia a ogni push il giro rapido (~2,5-4 min); **non parte sui rami `giorno/**`**. In locale `npm test` (rapido) e `npm run test:tutto` (~40-45 min, solo la Verifica); `tools/verifica/cancello.sh` accende e spegne da solo wrangler dev. `tools/verifica/controlli.mjs`: C1 sintassi, C2 lingue, C3 testi usati, C4 versione (pagina, config, package, storico, `online:` in testa a REQUISITI.md), C5 attesa di 25 s, C6 schede delle città. `tools/verifica/simulazione.mjs` (28/10): 50 giocatori simulati contro il server locale (`--modo=sfida|online`, `--solo-ingresso=1`, `--ritmo=ms`). **Nota misurata il 28/10**: con la grafica software il ciclo del gioco va a ~0,15x del tempo vero, quindi una gara completa di 4,2 km non si può correre nel browser di prova; l'allenamento-gara da 2 km (0.28.0) va provato portando il rider al traguardo con `P.z` forzato.
- **Diagnosi (dalla 0.9.3):** `public/pista-nera/diagnosi.js`: registro eventi (`diag.log`), stato (`diag.state`: avversari, portale, vocali, fonte, pubblicita, qualita, fpsGioco, monti), pannello con `?debug=1`, 5 tocchi sul numero di versione o F2, "Invia" con codice. Errori a `POST /api/errors`; `GET /api/errors?giorni=7`. In locale non si inviano. Visita a `/api/visita` (R-232) con la fonte (R-246); fps veri a `/api/fps` (A-14, 0.26.0).
- **Misure (dalla 0.16.1, R-232, S-38):** su `/api/stats` (giorni in UTC): `visitors`, `visit_{sfida|batti|portale|home|diretto}`, `load_{tel|pc}_{lt3|3_6|6_10|gt10}`, `load_ms_sum`, `load_n`, `pts_lt50|pts_50_149|pts_150_1499|pts_1500` (fasce fisse 50/150/1.500 anche dopo i prezzi nuovi della 0.27.0, così restano confrontabili), `pts_sum`, `pts_n`, `use_banana|use_bomb|use_bananone`, `races_bots`, `batti_gare`, `settimana_gare`, `settimana_premi`, `gp_sale`, `gp_persone`, dalla 0.26.0 `fps_{tel|pc}_{lt20|20_40|40_55|gt55}`, `fps_*_sum`, `fps_*_n`, `q_{alta|media|bassa}`. `GET /api/ritorni` → `{visite, corse, fonti}`.
- Attività automatiche: **Implementation all'1:00** (ramo `giorno/<data>-notte`, senza prove, rapporto con tabella, prove da aggiungere e prossimi passi) e **Verifica alle 9:30** (prove, correzioni, pubblicazione entro le 14:30, confronto con le altre app entro le 15). Prima frase di ogni rapporto: tempo e token (R-509).
- Struttura del software: REQUISITI.md sezione 11 (A-01…A-25). Fatti A-01…A-08, A-10, A-12, A-18, A-19, A-20, A-21, A-22; in corso A-11 (resta la rete), A-14 (qualità automatica e fps veri dalla 0.26.0; misure con soglie da scrivere), A-16 (Three.js dal sito; l'aggiornamento di versione aspetta A-23). Da fare: A-09 sito di prova, A-13 parte comune C-Y-F, A-15 tipi, A-17 interruttori, A-23 esbuild (Da approvare, riga 1f per Luigi), A-24, A-25.
- Storia delle versioni: storico in REQUISITI.md e i file `claude/CYF-Gaming-*.md`. Dettagli tecnici dei moduli nei commenti in testa ai file.
- Modifiche del 29 ottobre 2026 (Implementation dell'1:00, ramo `giorno/2026-10-29-notte`, commit da 07dc0bb a 6de13ec, senza prove): B-04 (0.26.2), prezzi R-520/R-521 con S-54 di ripiego (0.27.0), R-522 immuni curvando (0.27.0), R-523 rotellina (0.27.0), R-519 seconda parte con S-53 di ripiego (0.28.0), R-513 uccelli e acqua (0.29.0). Prove da aggiungere elencate in testa a REQUISITI.md. Errori dei telefoni non letti (dominio non consentito).
- Business plan: `BUSINESS-PLAN.md` nel repo. Facoltativo, dopo: un dominio proprio (es. cyfgaming.it).

## Da fare (da REQUISITI.md, prossimi passi in testa)
- Verifica delle 9:30 del 29/10: unire `giorno/2026-10-29-notte` (contiene tutto), aggiungere le prove delle 0.26.0-0.29.0, giro completo, foto di riferimento rifatte (cielo, Neve, corridoio di atterraggio, uccelli, acqua), pubblicare entro le 14:30, poi confronto con le altre app.
- Implementation: riga 1 "terzo piano per le città senza monti" (R-513), riga 4 "resto del livello 2" (colori e luci di tutte le città, turno a sé con le foto prima/dopo), riga 3 Three.js nuovo dopo la riga 5 (A-23, Da approvare).
- Luigi: 1i S-54 (bananone 1.500 fisso di ripiego), 1h S-53 (allenamento senza vite di ripiego), 1j provare R-520…R-523 dal telefono dopo le 14:30, 1d dominio consentito al cloud, 1f A-23, 1g AdSense e consenso (R-518), 1c S-40, D-12 CrazyGames, D-03 dominio, cancellare i rami già uniti.
- A-11 Claude: continuare con la rete fuori da `game.js` (serve al controllo anti-imbroglio e alle classifiche).

## Architettura
| Parte | File | Ruolo |
| --- | --- | --- |
| Home del sito | `public/index.html` | Presentazione di C-Y-F Gaming e scheda del gioco, testi in 4 lingue nello stesso file |
| Impostazioni | `public/config.js` | Versione (`window.CYF.version`), link donazioni, `pubblicita { fornitore, client, slot, ogniS }` |
| Contratto di rete | `public/shared/protocollo.js` | Messaggi, campi obbligatori, città, durate, costi (`COSTI`: banana 1.500, bomba 50, bananone 1.500 dalla 0.27.0), fermi, nomi degli avversari, `VERSIONE`; usato dal gioco (`PN.protocollo`) e dal server (`import`) |
| Calendario delle settimane | `public/shared/calendario.js` | Settimana → città in evidenza e maglia (R-245) |
| Regole di fine gara | `public/shared/gara.js` | Tempo minimo, tempo stimato degli avversari, classifica con punti e premi (0.28.0); usato dal server e dall'allenamento-gara |
| Gioco | `public/pista-nera/index.html`, `game.js` | Three.js r128 (dal sito); stato della partita, fisica, rete, ciclo di gioco; carica i moduli e le città con tag `<script>` in ordine |
| Moduli | `public/pista-nera/moduli/*.js` | base, lingua, portale, pubblicita, geometria, cielo, qualita, panorami, sfondi, pista, citta, fisica, tracciato, generazione, rider, effetti, audio, vocali, profilo, personaggio, oggetti, avversari, bot, comandi, schermate, settimana, granpremio, sala, gara_locale, missioni, sfida (`PN.<nome>`) |
| Città | `public/pista-nera/citta/<nome>.js` | Una scheda per città (12), registrata in `PN.citta.schede` |
| Matrice | `MODULI.md`, `tools/verifica/matrice.mjs` | Chi dipende da chi, regole per lavorare in parallelo (A-18), "dove sta cosa" |
| Diagnosi | `public/pista-nera/diagnosi.js` | Registro eventi, pannello di debug, invio errori, visita, fps |
| Lingue | `public/pista-nera/i18n.js` | Tutti i testi in it/en/fr/es (`tr()` + attributi `data-i18n`) |
| Server gare | `src/worker.js` (indirizzi) → `src/stanza.mjs`, classe `RaceRoom`; costanti in `src/comune.mjs`; `src/sale.mjs` (scelta della sala e prenotazione) | Cloudflare Worker + Durable Object: una stanza per codice, WebSocket, vocali, avversari del computer (pilota), maglia della settimana, sale GP01…GP08, posti prenotati (B-04) |
| Classifica | `src/classifica.mjs` → classe `Leaderboard` | Durable Object con SQLite: tempi, punti, premi, contatori, visite, fps, errori |
| Pista del giorno | `src/giorno.mjs` | Giorno italiano, numero, città e seed del giorno; `pistaNumero(n)` |
| Settimana | `src/settimana.mjs` | Settimana corrente e premio per una gara nella città in evidenza |
| Gran Premio | `src/granpremio.mjs` | Orario delle 21 italiane, finestra d'ingresso, seme e chiave `gp:<giorno>` |
| Ritorni | `src/ritorni.mjs` | Calcolo dei ritorni D1/D7/D30, anche per fonte |
| Avversari | `src/avversari.mjs` | Riesporta `stimaArrivo` da `shared/gara.js` |
| Prove | `tools/verifica/`, `.github/workflows/cancello.yml` | Cancello dei test, simulazione di carico, README con i comandi e i tempi |
| Requisiti | `REQUISITI.md`, `tools/requisiti_docx.py` | Fonte dei due Word in `docs/` (serve pandoc) |
| Configurazione | `wrangler.jsonc`, `package.json` (wrangler 4.148.0, acorn) | Asset in `public/`, binding `RACE` e `LEADERBOARD` |

API:
- `GET /api/leaderboard?min=5|10|15` → `[{name, ms}]`, top 20 per durata.
- `GET /api/quick?id=<id>` → `{ code, players, prenotati }`: la sala pubblica in cui entrare, con il posto prenotato per 10 s (0.26.2); `?gp=1` la sala del Gran Premio (409 fuori dalla finestra); 503 se tutte piene. `GET /api/gp?id=…` orario, città, finestra e classifica della sera.
- `POST /api/profilo` salva le impostazioni e crea il codice personale; `GET /api/profilo?code=…` le restituisce (R-226).
- `GET /api/me?id=…` punti collezionati e `premi`; `GET /api/points` i migliori per punti.
- `GET /api/stats` contatori d'uso degli ultimi 14 giorni; `POST /api/fps {id, fps, tel, q}` (0.26.0).
- `GET /api/giorno?id=…` pista del giorno di oggi e `settimana`; `WS /api/giorno/<CODICE>` stanza da soli (R-233), con `?b=1&n=<numero>` la pista di un giorno passato (R-236).
- `POST /api/visita {id, ms, tel, fonte}`; `GET /api/ritorni`.
- `POST /api/errors`; `GET /api/errors?giorni=7`.
- `WS /api/room/<CODICE>` apre la stanza. Codici di 4–8 caratteri A–Z0–9; `ONLINE1…ONLINE20` sale online, `GP01…GP08` sale del Gran Premio.

Protocollo WebSocket (`shared/protocollo.js`, VERSIONE 7):
- Dal client: `hello{v,id,name,j,h,p,e,s,sc}`, `jersey`, `ready`, `start`, `settings{minutes, bots?}`, `scena`, `loaded`, `pronto`, `pos` 10 volte al secondo, `finish`, `drop`, `throw` (uno ogni 0,9 s), `hit`, `bots` e `botfinish` (solo il pilota), `voice`, `reportVoice`; `ping` ogni 20 s.
- Dal server: `welcome`, `lobby`, `full`, `aggiorna`, `countdown`, `gather`, `go`, `racers`, `pos`, `bots`, `pilota`, `left`, `drop`, `throw`, `hit`, `finished`, `results` (avversari con `bot:1`, `earned: null`; `premio`; `giorno`; `gp`), `voice`, `voiceOk`, `voiceWait`, `voiceBlocked`, `reported`. L'allenamento-gara (0.28.0) usa gli stessi messaggi, generati sul dispositivo da `moduli/gara_locale.js`.

## Regole della sfida (decise)
- Da 1 a 8 corridori (persone + avversari del computer). Chi crea la stanza è l'organizzatore: sceglie città, durata e quanti avversari (0-4) e preme **Parti**. Le partite successive con **Rivincita**.
- Dopo "Parti" si aspettano al massimo 25 s, poi conto alla rovescia di 5 s (R-119); "Sono pronto" accorcia l'attesa (R-222). Sale online: da soli, dopo 15 s si parte con 3 avversari (R-235); con almeno 2 persone parte da sola dopo 30 s. Con 50 persone che premono "Online" insieme ognuno ha il posto prenotato (B-04, 0.26.2).
- Gran Premio delle 21 (R-247): ogni sera alle 21 italiane, nella città della settimana, sale GP01…GP08 con la stessa pista.
- Il traguardo è a 5, 10 o 15 minuti di discesa (4,2 / 8,4 / 12,6 km); in allenamento (0.28.0) a 2 km.
- In gara le cadute non eliminano. Bomba 50 punti, fermo 4 s; banana 1.500 punti, fermo 2 s; bananone 1.500 punti, fermo 4 s (0.27.0, R-520/R-521/S-54). Banana e bananone lanciati non colpiscono chi è in aria (R-241) né chi sta curvando con ← → o la rotellina di lato (R-522, 0.27.0); gli oggetti a terra colpiscono sempre, salvo saltarli.
- **Il tempo è misurato dal server** (in allenamento dal dispositivo, senza classifiche). Un arrivo più veloce del limite fisico (lunghezza / 24 m/s) viene scartato. La gara finisce quando le persone sono tutte arrivate; gli avversari ancora in pista prendono un tempo stimato (`shared/gara.js`).
- La classifica generale tiene il miglior tempo per nome (solo persone). Chi finisce una gara valida nella città della settimana vince la maglia esclusiva (R-245).

## Gioco (Pista Nera)
- Camera bassa alle spalle del rider, pista inclinata di 16°, partenza a quota 2.950 m. Cielo con sole e nuvole, cartolina della città in due piani, Neve dipinta (0.26.0); uccelli lontani e acqua che luccica (0.29.0).
- Ostacoli e bonus: alberi, rocce (si saltano), banane/bombe/bananoni, porte +50 in combo, cristalli o cibi della città +10, rampe con rotazioni, trampolini giganti con cartelli CYF; dopo ogni rampa un corridoio di atterraggio libero (B-06, 0.26.1).
- Avversari del computer: in allenamento (3, gara a 2 km dalla 0.28.0), pista del giorno (3), sfida (0-4), sala online da soli (3). Livelli misti. 🤖 solo in classifica.
- Rider personalizzabile in "Modifica il personaggio"; in città skater, sulla neve snowboarder. Frenando si alza un po' (0.27.0).
- Comandi PC: ← → curva, ↓ raccolto (più veloce), ↑ frena, Spazio salta/Sono pronto; in aria ← → spin, ↑ ↓ flip; V vocale, B banana, N bomba, G bananone, M audio. Telefono: rotellina (dalla 0.27.0 **giù = accelera, su = frena**, come la tastiera), Salta, microfono, doppio tocco per la banana.
- Velocità reali (R-242): fino a 71 km/h, 80 in raccolta; media ~50 km/h. Qualità alta/media/bassa automatica (0.26.0).
- Menu: riquadro "ti sfida", pista del giorno, città della settimana, Gran Premio delle 21, missioni con le stelle. Con `?portale=crazygames` niente donazioni e link esterni. Riquadro pubblicitario nei momenti di attesa, spento (`?pubblicita=prova` per vederlo).

## File dei requisiti
- Luigi vuole un file con tutti i requisiti, aggiornato a ogni richiesta, con i prossimi passi in testa. **Regola: prima si aggiorna il file dei requisiti, poi il software.**
- La fonte è `REQUISITI.md` nel repository. I **due Word** si generano con `python3 tools/requisiti_docx.py REQUISITI.md docs/` (serve pandoc) e vanno nel commit; si leggono anche dai link fissi su GitHub (R-516). Chi pubblica aggiorna `online:` in testa a REQUISITI.md (controllo C4).
- Ogni requisito ha un ID (R-xxx), la data e lo stato: Da confermare → Da fare → In corso → Fatto → Controllato. Scelte S-xx, idee F-xx, da fare D-xx, struttura A-xx, processi P-xx, bachi B-xx (sezione "Bachi" in testa).

## Costi (verificati il 24 ottobre 2026)
- I Durable Objects sono inclusi nel piano Workers gratuito (100.000 richieste al giorno). I messaggi WebSocket in arrivo contano 1 richiesta ogni 20. Il piano a pagamento parte da 5 $ al mese. `/api/quick` fa fino a 20 chiamate `info()` più una `prenota()` (RPC tra Worker e Durable Object).

## Prossimi passi (roadmap)
1. ~~Messa online~~: fatta il 24 ottobre 2026.
2. **Crescita (sezione 13):** tutto online dalla 0.25.5 (28/10). Ora: Luigi propone il gioco su CrazyGames (D-12) e si guardano le misure.
3. **Grafica al livello 2 (R-513):** sfondo (0.26.0 e 0.29.0, da provare), poi prestazioni misurate (A-14), Three.js nuovo (A-16, dopo A-23), resto del livello 2.
4. **Allenamento uguale alla gara (R-519):** 0.26.1 e 0.28.0 da provare; S-53 per Luigi.
5. **Fase 2:** partita rapida con sconosciuti (matchmaking), login (es. Google).
6. Più controlli contro chi bara: il server verifica la traiettoria (richiede A-11).
7. **Fase 3:** ottimizzazione per telefono, nuove piste, altri giochi C-Y-F (richiede A-13). Idee: altre città (P-01), tornei, F-11…F-20.

## Collegamenti utili
- Versione da giocare da soli (artifact della prima chat): https://claude.ai/artifact/WZdaq6VW91AH7YEuSYxVmp
- Prezzi Durable Objects: https://developers.cloudflare.com/durable-objects/platform/pricing
- Cancello dei test su GitHub: https://github.com/benedettadavinci-beep/cyf-gaming/actions
- Requisiti di CrazyGames: https://docs.crazygames.com/requirements/technical e /requirements/gameplay/
- Word su GitHub (R-516): https://raw.githubusercontent.com/benedettadavinci-beep/cyf-gaming/main/docs/CYF-Gaming-Requisiti-da-Implementare-o-Bachi.docx

## Come ripartire in una nuova chat
1. Apri una chat nuova nel progetto "CYF gaming".
2. Scrivi a Claude: "Continua C-Y-F Gaming: collega il repository benedettadavinci-beep/cyf-gaming", poi la modifica che vuoi. **Se ci sono più chat in parallelo, nella prima frase si dice su quale modulo lavora la chat**: le regole sono in `MODULI.md`.
3. Claude aggiorna prima `REQUISITI.md` e i due Word in `docs/`, poi il software, su un ramo `giorno/<nome>` fatto partire dall'ultimo ramo del giorno non ancora pubblicato (o da `main`); nessuna prova fuori dalla Verifica delle 9:30, che prova, corregge e pubblica.
