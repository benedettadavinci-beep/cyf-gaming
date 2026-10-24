---
title: "C-Y-F Gaming · Pista Nera — Requisiti del gioco"
subtitle: "Versione 0.5.0 · aggiornato al 24 ottobre 2026, ore 15:30"
---

Questo documento raccoglie tutto quello che Luigi ha chiesto per il gioco, con lo stato di ogni richiesta. Viene aggiornato a ogni nuova richiesta.

**Legenda dello stato** (in ordine di avanzamento)

- **Da confermare**: idea emersa nelle chat, non ancora approvata da Luigi.
- **Da fare**: richiesto da Luigi, non ancora iniziato.
- **In corso**: ci stiamo lavorando.
- **Fatto**: è nel gioco online. Claude lo ha provato, ma Luigi non l'ha ancora controllato.
- **Controllato**: Luigi l'ha provato nel gioco e va bene.

Quando Luigi controlla un requisito, basta dirlo a Claude con il numero (per esempio "R-303 controllato"): lo stato passa a Controllato.

Sito: https://cyf-gaming.benedetta-davinci-mellum.workers.dev (gioco: `/pista-nera/`)

# 1. Sito e piattaforma

| ID | Requisito | Richiesto | Stato | Note |
|---|---|---|---|---|
| R-001 | Sito pubblico "C-Y-F Gaming · Challenge Your Friends" dove le persone si collegano e si sfidano in gara | ott 2026 | Fatto | Online dal 24/10/2026 |
| R-002 | Primo gioco: discesa in snowboard 3D superando ostacoli ("Pista Nera") | ott 2026 | Fatto | |
| R-003 | Pubblicazione su Cloudflare, aggiornata in automatico a ogni modifica su GitHub | 24/10/2026 | Fatto | Repository benedettadavinci-beep/cyf-gaming |
| R-004 | Modifiche veloci: Claude carica direttamente il codice su GitHub | 24/10/2026 | Fatto | 1-2 minuti per modifica |
| R-005 | Giocabile su PC e su telefono | ott 2026 | Fatto | Sul telefono pulsanti ◀, Salta, ▶ |
| R-006 | Pulsante per fare una donazione | 24/10/2026 | Fatto | PayPal: paypal.me/Limper17, nella home e nei menu |
| R-007 | Nella schermata iniziale si sceglie la lingua: italiano, inglese, francese, spagnolo | 24/10/2026 | Da fare | |

# 2. Sfida online

| ID | Requisito | Richiesto | Stato | Note |
|---|---|---|---|---|
| R-101 | Sfida con codice o link da mandare agli amici | ott 2026 | Fatto | Da 1 a 8 giocatori |
| R-102 | Chi crea la sfida la fa partire; rivincita con gli stessi giocatori | ott 2026 | Fatto | |
| R-103 | Stessa pista e stessa partenza per tutti; vince il tempo migliore sui 2.000 m | ott 2026 | Fatto | Il tempo lo misura il server |
| R-104 | Si vedono gli avversari in pista, ognuno con il proprio colore e il nome sopra la testa | ott 2026 | Fatto | 8 colori di giacca |
| R-105 | Classifica dei migliori tempi | ott 2026 | Fatto | Primi 20 tempi |
| R-106 | Messaggi vocali: si preme un pulsante, si registra, tutti gli altri lo sentono; al massimo uno ogni 3 minuti | 24/10/2026 | Fatto | Durata massima circa 8 s; limite controllato dal server |
| R-107 | Pulsante del microfono ben visibile durante la gara, per mandare i vocali agli altri concorrenti (uno ogni 3 minuti a testa) | 24/10/2026 | Da fare | Finora c'era solo la scritta "Parla (V)" in basso a sinistra, e solo dentro una sfida |
| R-108 | La gara finisce al traguardo. Durata di circa 5 minuti, che si può cambiare all'inizio in 10 o 15 minuti | 24/10/2026 | Da fare | La durata scelta diventa la lunghezza della pista |
| R-109 | Durante la gara, in alto a destra, classifica dal vivo degli altri concorrenti | 24/10/2026 | Da fare | |
| R-110 | A fine gara: classifica con il vincitore e, in basso, chi ha fatto la velocità massima e chi più acrobazie | 24/10/2026 | Da fare | |
| R-111 | Modalità online: senza invitare amici, si entra in una sala pubblica e si aspetta che si colleghino altre persone | 24/10/2026 | Da fare | |
| R-112 | A ogni gara finita si collezionano punti e il gioco se li ricorda | 24/10/2026 | Da fare | |
| R-113 | Spendere i propri punti per far cadere gli altri: bombe, trappole o banane lasciate sulla strada; le banane si possono anche lanciare con un doppio clic sullo schermo | 24/10/2026 | Da fare | |

# 3. Guida e acrobazie

| ID | Requisito | Richiesto | Stato | Note |
|---|---|---|---|---|
| R-201 | Ostacoli da evitare o saltare, bonus da raccogliere, porte e rampe | ott 2026 | Fatto | Le rocce si saltano, gli alberi no |
| R-202 | Atterraggio assistito: il gioco aiuta ad atterrare, si cade meno facilmente | 24/10/2026 | Fatto | Si cade solo atterrando molto storti |
| R-203 | Acrobazie più belle con le frecce destra, sinistra, alto e basso | 24/10/2026 | Fatto | Avvitamenti, salti mortali, presa della tavola; nomi e punti a schermo |
| R-204 | Ali stampate sulla giacca del giocatore | 24/10/2026 | Fatto | Sul fianco visto dalla telecamera e sulla schiena |
| R-205 | Nelle città senza neve si va in skateboard con le rotelle al posto dello snowboard | 24/10/2026 | Fatto | Napoli e Roma; vale anche per gli avversari |
| R-206 | Freccia giù: si va più veloci e il rider si abbassa sulle ginocchia | 24/10/2026 | Da fare | |
| R-207 | Freccia su: il rider si sposta un po' in avanti e la velocità diminuisce | 24/10/2026 | Da fare | |
| R-208 | Accelerazione più alta del 30%: oggi si arriva alla velocità massima troppo lentamente | 24/10/2026 | Da fare | |

# 4. Scenari e città

| ID | Requisito | Richiesto | Stato | Note |
|---|---|---|---|---|
| R-301 | Scelta dello scenario o della città nel menu | 24/10/2026 | Fatto | Neve, Napoli, Roma |
| R-302 | Napoli: strade al posto della neve, mare, Vesuvio sullo sfondo; rocce lasciate; pizze e caffè al posto dei cristalli | 24/10/2026 | Fatto | |
| R-303 | Roma: in fondo allo scenario si vede il Colosseo; piatti di carbonara e carciofi al posto di pizza e caffè | 24/10/2026 | Fatto | Strada in sampietrini, palazzi romani, cupole e pini sullo sfondo |
| R-304 | In tutti gli scenari i testi dicono "albero" (non "abete") | 24/10/2026 | Fatto | A Napoli sono palme, a Roma pini |

# 5. Grafica e qualità

| ID | Requisito | Richiesto | Stato | Note |
|---|---|---|---|---|
| R-401 | Eliminare le schermate di un solo colore, come dei muri | 24/10/2026 | Fatto | Lo sfondo di Napoli restava fermo e dopo ~400 m la telecamera ci entrava dentro |
| R-402 | Migliorare un po' la qualità generale delle immagini | 24/10/2026 | Fatto | Texture più definite, luce più morbida, modelli più arrotondati |
| R-403 | Omino con un corpo più naturale: niente cubi, testa non a sfera, busto non a parallelepipedo | 24/10/2026 | Da fare | |

# 6. Documentazione

| ID | Requisito | Richiesto | Stato | Note |
|---|---|---|---|---|
| R-501 | File con tutti i requisiti del gioco, aggiornato a ogni richiesta, nella cartella "CYF gaming" sul Desktop | 24/10/2026 | Fatto | Questo documento; copia anche su GitHub (REQUISITI.md) |
| R-502 | Nel file dei requisiti, oltre a fatto e da fare, lo stato "Controllato" | 24/10/2026 | Fatto | Vedi la legenda all'inizio |

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

# Storico delle versioni

| Versione | Data | Cosa è cambiato |
|---|---|---|
| 0.1–0.3 | ott 2026 | Gioco, sfida online, classifica, messa online, ali sulla giacca |
| 0.4.0 | 24/10/2026 | Donazioni, atterraggio assistito, acrobazie, messaggi vocali, scenario Napoli |
| 0.5.0 | 24/10/2026 | Correzione schermate a tinta unita, scenario Roma con Colosseo, skateboard in città, "albero" ovunque, grafica migliorata, file dei requisiti |
