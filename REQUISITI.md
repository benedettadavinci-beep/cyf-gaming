---
title: "C-Y-F Gaming · Pista Nera — Requisiti del gioco"
subtitle: "Versione 0.8.0 · aggiornato al 24 ottobre 2026, ore 17:25"
---

Questo documento è l'elenco ufficiale dei requisiti di C-Y-F Gaming. Ogni riga è una richiesta di Luigi: che cosa deve fare il gioco, quando è stata chiesta, a che punto è e come funziona oggi. Claude lo aggiorna a ogni nuova richiesta e lo salva nella cartella "CYF gaming" sul Desktop; la copia tecnica è su GitHub (REQUISITI.md).

**Come leggere le tabelle.** Ogni sezione raggruppa i requisiti per argomento. Le colonne sono: **ID** (il codice da citare per parlarne, per esempio "R-303"), **Richiesta** (che cosa deve fare il gioco, con le parole più semplici possibili), **Data** (quando è stata chiesta), **Stato** (a che punto è, vedi la legenda) e **Come funziona oggi** (che cosa si vede nel gioco e i limiti scelti).

**Legenda dello stato** (in ordine di avanzamento)

- **Da confermare**: idea emersa nelle chat, non ancora approvata da Luigi.
- **Da fare**: richiesto da Luigi, non ancora iniziato.
- **In corso**: ci stiamo lavorando.
- **Fatto**: è nel gioco online. Claude lo ha provato, ma Luigi non l'ha ancora controllato.
- **Controllato**: Luigi l'ha provato nel gioco e va bene.

Quando Luigi controlla un requisito, basta dirlo a Claude con il numero (per esempio "R-303 controllato"): lo stato passa a Controllato.

Sito: https://cyf-gaming.benedetta-davinci-mellum.workers.dev (gioco: `/pista-nera/`)

# 1. Sito e piattaforma

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-001 | Sito pubblico "C-Y-F Gaming · Challenge Your Friends" dove le persone si collegano e si sfidano in gara | ott 2026 | Fatto | Online dal 24/10/2026 |
| R-002 | Primo gioco: discesa in snowboard 3D superando ostacoli ("Pista Nera") | ott 2026 | Fatto | |
| R-003 | Pubblicazione su Cloudflare, aggiornata in automatico a ogni modifica su GitHub | 24/10/2026 | Fatto | Repository benedettadavinci-beep/cyf-gaming |
| R-004 | Modifiche veloci: Claude carica direttamente il codice su GitHub | 24/10/2026 | Fatto | 1-2 minuti per modifica |
| R-005 | Giocabile su PC e su telefono | ott 2026 | Fatto | Sul telefono pulsanti ◀, Salta, ▶ |
| R-006 | Pulsante per fare una donazione | 24/10/2026 | Fatto | PayPal: paypal.me/Limper17, nella home e nei menu |
| R-007 | Nella schermata iniziale si sceglie la lingua: italiano, inglese, francese, spagnolo | 24/10/2026 | Fatto | Quattro pulsanti in cima al menu; la scelta resta salvata e parte nella lingua del browser |
| R-008 | Contatori d'uso per capire quanto viene giocato | 24/10/2026 | Fatto | Il server conta per giorno: gare avviate e finite, corridori, giocatori unici, segnalazioni. Si leggono su /api/stats (ultimi 14 giorni). Niente cookie né dati personali |

# 2. Sfida online

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-101 | Sfida con codice o link da mandare agli amici | ott 2026 | Fatto | Da 1 a 8 giocatori |
| R-102 | Chi crea la sfida la fa partire; rivincita con gli stessi giocatori | ott 2026 | Fatto | |
| R-103 | Stessa pista e stessa partenza per tutti; vince il tempo migliore sui 2.000 m | ott 2026 | Fatto | Il tempo lo misura il server |
| R-104 | Si vedono gli avversari in pista, ognuno con il proprio colore e il nome sopra la testa | ott 2026 | Fatto | 8 colori di giacca |
| R-105 | Classifica dei migliori tempi | ott 2026 | Fatto | Primi 20 tempi |
| R-106 | Messaggi vocali: si preme un pulsante, si registra, tutti gli altri lo sentono; al massimo uno ogni 3 minuti | 24/10/2026 | Fatto | Durata massima circa 8 s; limite controllato dal server |
| R-107 | Pulsante del microfono ben visibile durante la gara, per mandare i vocali agli altri concorrenti (uno ogni 3 minuti a testa) | 24/10/2026 | Fatto | Pulsante tondo arancione con il microfono, a destra; mostra il conto alla rovescia dei 3 minuti |
| R-108 | La gara finisce al traguardo. Durata di circa 5 minuti, che si può cambiare all'inizio in 10 o 15 minuti | 24/10/2026 | Fatto | La sceglie chi crea la sfida (5/10/15 min); lunghezza = minuti × 40 m/s (12, 24 o 36 km); striscione ARRIVO, striscia a scacchi e avviso a 500 m |
| R-109 | Durante la gara, in alto a destra, classifica dal vivo degli altri concorrenti | 24/10/2026 | Fatto | Posizioni, colori, nomi e distacco dal primo; chi è arrivato mostra il tempo |
| R-110 | A fine gara: classifica con il vincitore e, in basso, chi ha fatto la velocità massima e chi più acrobazie | 24/10/2026 | Fatto | Coppa al vincitore; premi ⚡ velocità massima e 🤸 più acrobazie |
| R-111 | Modalità online: senza invitare amici, si entra in una sala pubblica e si aspetta che si colleghino altre persone | 24/10/2026 | Fatto | Pulsante "Gioca online"; con almeno 2 giocatori la gara parte da sola dopo 30 s (prima se tutti premono "Sono pronto") |
| R-112 | A ogni gara finita si collezionano punti e il gioco se li ricorda | 24/10/2026 | Fatto | 100/70/50 ai primi tre, 30 agli altri arrivati, più i punti rimasti della gara; salvati sul server e mostrati nel menu |
| R-113 | Spendere i propri punti per far cadere gli altri: bombe, trappole o banane lasciate sulla strada; le banane si possono anche lanciare con un doppio clic sullo schermo | 24/10/2026 | Fatto | Banana 50 punti (tasto B), bomba 150 (tasto N); doppio clic o doppio tocco lancia la banana davanti a te; chi le tocca cade |
| R-115 | Condividere la sfida e il risultato con gli amici | 24/10/2026 | Fatto | Pulsanti WhatsApp e Telegram nella stanza della sfida; "Condividi" a fine gara con posizione, città e tempo (sul telefono apre il menu di condivisione) |
| R-116 | Moderazione dei messaggi vocali | 24/10/2026 | Fatto | Sul fumetto "sta parlando" ci sono 🔇 (non senti più quel giocatore, resta salvato sul tuo dispositivo) e ⚠️ (segnala); con 2 segnalazioni da persone diverse il server blocca i vocali del segnalato in quella stanza |

# 3. Guida e acrobazie

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-201 | Ostacoli da evitare o saltare, bonus da raccogliere, porte e rampe | ott 2026 | Fatto | Le rocce si saltano, gli alberi no |
| R-202 | Atterraggio assistito: il gioco aiuta ad atterrare, si cade meno facilmente | 24/10/2026 | Fatto | Si cade solo atterrando molto storti |
| R-203 | Acrobazie più belle con le frecce destra, sinistra, alto e basso | 24/10/2026 | Fatto | Avvitamenti, salti mortali, presa della tavola; nomi e punti a schermo |
| R-204 | Ali stampate sulla giacca del giocatore | 24/10/2026 | Fatto | Sul fianco visto dalla telecamera e sulla schiena |
| R-205 | Nelle città senza neve si va in skateboard con le rotelle al posto dello snowboard | 24/10/2026 | Fatto | Napoli e Roma; vale anche per gli avversari |
| R-206 | Freccia giù: si va più veloci e il rider si abbassa sulle ginocchia | 24/10/2026 | Fatto | +12% di velocità in posizione raccolta |
| R-207 | Freccia su: il rider si sposta un po' in avanti e la velocità diminuisce | 24/10/2026 | Fatto | Peso in avanti e frenata; a terra non fa più saltare (si salta con Spazio) |
| R-208 | Accelerazione più alta del 30%: oggi si arriva alla velocità massima troppo lentamente | 24/10/2026 | Fatto | |
| R-209 | Maglia dell'omino a scelta con un menu a tendina: la maglia della squadra di calcio della propria città o di un'altra città | 24/10/2026 | Fatto | 8 maglie con i colori delle città (Napoli, Roma, Milano ×2, Torino ×2, Palermo, Bologna); gli avversari la vedono. Solo colori, senza nomi o stemmi delle squadre, che sono marchi registrati |

# 4. Scenari e città

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-301 | Scelta dello scenario o della città nel menu | 24/10/2026 | Fatto | Neve, Napoli, Roma |
| R-302 | Napoli: strade al posto della neve, mare, Vesuvio sullo sfondo; rocce lasciate; pizze e caffè al posto dei cristalli | 24/10/2026 | Fatto | |
| R-303 | Roma: in fondo allo scenario si vede il Colosseo; piatti di carbonara e carciofi al posto di pizza e caffè | 24/10/2026 | Fatto | Strada in sampietrini, palazzi romani, cupole e pini sullo sfondo |
| R-304 | In tutti gli scenari i testi dicono "albero" (non "abete") | 24/10/2026 | Fatto | A Napoli sono palme, a Roma pini; gli ostacoli che non sono alberi dicono il loro nome (Lampione!, Fioriera!…) |
| R-305 | La pista è troppo rettilinea: servono curve naturali, non troppo complicate | 24/10/2026 | Fatto | Tre onde sovrapposte danno curve ampie e dolci; la pista resta uguale per tutti nella stessa gara |
| R-306 | Tutte le altre città della tabella "CYF-elementi-per-citta.xlsx" (cartella sul Desktop) | 24/10/2026 | Fatto | Milano, Parigi, Londra, Francoforte, Madrid, Lisbona, Zagabria, Berlino, Zurigo, New York: ostacoli, bonus, rampe, porte, paletti, strada, palazzi e monumenti come da tabella; scenari in un menu a tendina |

# 5. Grafica e qualità

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-401 | Eliminare le schermate di un solo colore, come dei muri | 24/10/2026 | Fatto | Lo sfondo di Napoli restava fermo e dopo ~400 m la telecamera ci entrava dentro |
| R-402 | Migliorare un po' la qualità generale delle immagini | 24/10/2026 | Fatto | Texture più definite, luce più morbida, modelli più arrotondati |
| R-403 | Omino con un corpo più naturale: niente cubi, testa non a sfera, busto non a parallelepipedo | 24/10/2026 | Fatto | Busto e testa modellati, spalle, gomiti e ginocchia arrotondati, scarponi e tavole con bordi morbidi |

# 6. Documentazione

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-501 | File con tutti i requisiti del gioco, aggiornato a ogni richiesta, nella cartella "CYF gaming" sul Desktop | 24/10/2026 | Fatto | Questo documento; copia anche su GitHub (REQUISITI.md) |
| R-502 | Nel file dei requisiti, oltre a fatto e da fare, lo stato "Controllato" | 24/10/2026 | Fatto | Vedi la legenda all'inizio |
| R-503 | Controllo generale automatico ogni sera verso le 22: qualità, bachi, stabilità e idee di miglioramento | 24/10/2026 | Fatto | Attività pianificata ogni sera alle 21:33 (poco prima delle 22, per evitare l'ora di punta dei server); corregge solo bachi piccoli e sicuri e lascia un rapporto |
| R-504 | Migliorare la descrizione del documento Word e delle tabelle | 24/10/2026 | Fatto | Introduzione, legenda e colonne riscritte; colonna "Come funziona oggi" |
| R-505 | Business plan con aspetti economici e strategia aziendale, in un file separato | 24/10/2026 | Fatto | CYF-Gaming-business-plan.docx nella cartella sul Desktop |

# 7. Scelte fatte da Claude (da confermare)

Dettagli decisi durante il lavoro, che Luigi non ha chiesto esplicitamente. Si possono cambiare.

| ID | Scelta | Data | Stato |
|---|---|---|---|
| S-01 | A Napoli le palme sostituiscono gli abeti; a Roma i pini a ombrello | 24/10/2026 | Da confermare |
| S-02 | In città la strada è chiusa dai palazzi: chi va contro il muro rimbalza e rallenta ("Muro!"), senza perdere vite | 24/10/2026 | Da confermare |
| S-03 | In città le rocce sono di pietra, senza neve sopra | 24/10/2026 | Da confermare |
| S-04 | Il messaggio vocale dura al massimo circa 8 secondi | 24/10/2026 | Da confermare |
| S-05 | La pista è identica in tutti gli scenari, così i tempi restano confrontabili | 24/10/2026 | Da confermare |
| S-06 | Per bombe e banane si spendono i punti guadagnati nella gara in corso; quelli che restano a fine gara si aggiungono ai punti collezionati (R-112) | 24/10/2026 | Da confermare |
| S-07 | La freccia su a terra non fa più saltare, perché ora frena (R-207): si salta con la barra spaziatrice. In aria le frecce su e giù restano per i salti mortali | 24/10/2026 | Da confermare |
| S-08 | Lunghezza della gara = minuti × 40 m/s (velocità media stimata): 5 min ≈ 12 km, 10 ≈ 24, 15 ≈ 36. Fuori tempo massimo al doppio dei minuti scelti | 24/10/2026 | Da confermare |
| S-09 | Punti di fine gara: 100/70/50 ai primi tre, 30 agli altri arrivati. Costi: banana 50, bomba 150, pagati con i punti della gara in corso | 24/10/2026 | Da confermare |
| S-10 | Nella sala online la gara parte da sola 30 secondi dopo il secondo giocatore; se tutti premono "Sono pronto" parte dopo 3 secondi | 24/10/2026 | Da confermare |
| S-11 | Maglie con i soli colori delle città, senza nomi o stemmi delle squadre (marchi registrati) | 24/10/2026 | Da confermare |
| S-12 | Dalla tabella delle città: porte di Zagabria in tinta unita invece che a scacchi, niente vapore dai tombini a New York; Roma tiene carbonara e carciofi (chiesti da Luigi) invece di supplì e maritozzo | 24/10/2026 | Da confermare |
| S-13 | Classifica dei migliori tempi separata per durata (5, 10, 15 min); nel menu si vede quella dei 5 minuti | 24/10/2026 | Da confermare |

# 8. Idee per il futuro (da confermare)

Emerse nelle chat precedenti; nessuna è stata ancora approvata.

| ID | Idea | Stato |
|---|---|---|
| F-01 | Partita rapida con sconosciuti | Approvata: ora è R-111 |
| F-02 | Classifiche giornaliere | Da confermare |
| F-03 | Accesso con un account (es. Google) | Da confermare |
| F-04 | Controlli più forti contro chi bara (il server verifica il percorso, non solo il tempo) | Da confermare |
| F-05 | Altre città, con sfondo e bonus propri | Da confermare |
| F-06 | Piste diverse | Da confermare |
| F-07 | Stili di guida: powder, racing, freestyle | Da confermare |
| F-08 | Tornei e leghe | Da confermare |
| F-09 | Altri mezzi: sci, monopattino, deltaplano | Da confermare |
| F-10 | Dominio proprio (es. cyfgaming.it) | Da confermare |

# 9. Da fare domani (domenica 25 ottobre)

Appunti operativi per la prossima sessione. "Chi": chi deve muoversi per primo.

| ID | Cosa | Chi |
|---|---|---|
| D-01 | Provare la v0.8.0 dai telefoni con qualche amico (microfono su iPhone, comandi touch, fluidità) e scrivere a Claude i numeri dei requisiti che vanno bene ("R-303 controllato") | Luigi |
| D-02 | Leggere il rapporto del primo controllo notturno (parte stasera alle 21:33) | Luigi |
| D-03 | Comprare il dominio (es. cyfgaming.it, ~10-15 €/anno) e collegarlo: Cloudflare → Workers & Pages → cyf-gaming → Domains. Claude guida se serve | Luigi, ~10 min |
| D-04 | Decidere le scelte S-01…S-13: basta scrivere "S-xx va bene" oppure cosa cambiare | Luigi |
| D-05 | Immagine automatica del risultato ("1° a Napoli in 5:12") da allegare alla condivisione | Claude |
| D-06 | Prime letture dei contatori (/api/stats) dopo le gare di prova, per partire con i numeri del business plan | Insieme |

# Storico delle versioni

| Versione | Data | Cosa è cambiato |
|---|---|---|
| 0.1–0.3 | ott 2026 | Gioco, sfida online, classifica, messa online, ali sulla giacca |
| 0.4.0 | 24/10/2026 | Donazioni, atterraggio assistito, acrobazie, messaggi vocali, scenario Napoli |
| 0.5.0 | 24/10/2026 | Correzione schermate a tinta unita, scenario Roma con Colosseo, skateboard in città, "albero" ovunque, grafica migliorata, file dei requisiti |
| 0.6.0 | 24/10/2026 | Rider modellato, accelerazione +30%, freccia giù/su, gare a traguardo 5/10/15 min, classifica live, premi, modalità online, punti collezionati, banane e bombe, microfono, 4 lingue, maglie delle città |
| 0.7.0 | 24/10/2026 | Curve naturali, 10 nuove città dalla tabella di Luigi, stabilità sui salti di posizione, business plan e controllo notturno |
| 0.8.0 | 24/10/2026 | Contatori d'uso (/api/stats), condivisione su WhatsApp/Telegram e del risultato, silenzia/segnala i vocali con blocco automatico dopo 2 segnalazioni |
