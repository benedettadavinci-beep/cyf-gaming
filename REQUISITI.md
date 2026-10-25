---
title: "C-Y-F Gaming · Pista Nera — Requisiti del gioco"
subtitle: "Versione 0.9.3 · aggiornato al 25 ottobre 2026, ore 09:00 · nuova sezione 11: struttura del software, cancello dei test e diagnosi"
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
| R-005 | Giocabile su PC e su telefono | ott 2026 | Fatto | PC: frecce, Spazio, V/B/N/M. Telefono: rotellina, Salta e microfono (R-210, R-211, R-212) |
| R-006 | Pulsante per fare una donazione | 24/10/2026 | Fatto | PayPal: paypal.me/Limper17, nella home e nei menu |
| R-007 | Nella schermata iniziale si sceglie la lingua: italiano, inglese, francese, spagnolo | 24/10/2026 | Fatto | Quattro pulsanti in cima al menu; la scelta resta salvata e parte nella lingua del browser |
| R-008 | Contatori d'uso per capire quanto viene giocato | 24/10/2026 | Fatto | Il server conta per giorno: gare avviate e finite, corridori, giocatori unici, segnalazioni. Si leggono su /api/stats (ultimi 14 giorni). Niente cookie né dati personali |
| R-009 | Tutto il sito in quattro lingue, compresa la home: italiano, inglese, francese, spagnolo | 24/10/2026 | Fatto | Pulsanti IT · EN · FR · ES in alto nella home. Parte nella lingua del telefono o del browser (se non è tra le quattro, in italiano). La scelta vale anche nel gioco e viceversa, anche in navigazione privata. Un link con ?lang=en apre il sito in inglese. Provato su telefono e PC nelle quattro lingue |

# 2. Sfida online

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-101 | Sfida con codice o link da mandare agli amici | ott 2026 | Fatto | Da 1 a 8 giocatori |
| R-102 | Chi crea la sfida la fa partire; rivincita con gli stessi giocatori | ott 2026 | Fatto | |
| R-103 | Stessa pista e stessa partenza per tutti; vince il tempo migliore sui 2.000 m | ott 2026 | Fatto | Il tempo lo misura il server. Dalla 0.6.0 la distanza non è più fissa a 2.000 m: è quella della durata scelta (R-108) |
| R-104 | Si vedono gli avversari in pista, ognuno con il proprio colore e il nome sopra la testa | ott 2026 | Fatto | 8 colori di giacca |
| R-105 | Classifica dei migliori tempi | ott 2026 | Fatto | Il server tiene i primi 20 tempi per ogni durata (5, 10, 15 min); il menu mostra i primi 10 della gara da 5 minuti |
| R-106 | Messaggi vocali: si preme un pulsante, si registra, tutti gli altri lo sentono; al massimo uno ogni 3 minuti | 24/10/2026 | Fatto | Durata massima circa 8 s; limite controllato dal server. Dalla 0.9.2 la registrazione non dipende più dal registratore del browser (MediaRecorder, assente o diverso su alcuni Android e nei browser interni delle app): si usa Web Audio e il vocale viaggia in WAV, che ogni telefono sa riprodurre; la riproduzione passa da Web Audio (funziona anche senza un tocco recente) con ripiego sull'elemento audio classico; se il telefono nega il microfono, il messaggio spiega come consentirlo o di aprire il link in Chrome/Safari |
| R-107 | Pulsante del microfono ben visibile durante la gara, per mandare i vocali agli altri concorrenti (uno ogni 3 minuti a testa) | 24/10/2026 | Fatto | Pulsante tondo arancione con il microfono, dalla 0.9.0 in alto a sinistra (R-212); mostra il conto alla rovescia dei 3 minuti |
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
| R-205 | Nelle città senza neve si va in skateboard con le rotelle al posto dello snowboard | 24/10/2026 | Fatto | In tutte le 12 città; vale anche per gli avversari |
| R-206 | Freccia giù: si va più veloci e il rider si abbassa sulle ginocchia | 24/10/2026 | Fatto | +12% di velocità in posizione raccolta |
| R-207 | Freccia su: il rider si sposta un po' in avanti e la velocità diminuisce | 24/10/2026 | Fatto | Peso in avanti e frenata; a terra non fa più saltare (si salta con Spazio) |
| R-208 | Accelerazione più alta del 30%: oggi si arriva alla velocità massima troppo lentamente | 24/10/2026 | Fatto | |
| R-209 | Maglia dell'omino a scelta con un menu a tendina: la maglia della squadra di calcio della propria città o di un'altra città | 24/10/2026 | Fatto | 8 maglie con i colori delle città (Napoli, Roma, Milano ×2, Torino ×2, Palermo, Bologna); gli avversari la vedono. Solo colori, senza nomi o stemmi delle squadre, che sono marchi registrati |
| R-210 | Sul telefono una rotellina al posto delle freccette: dove si appoggia il dito si sposta a destra o a sinistra per curvare, in alto o in basso per accelerare o frenare | 24/10/2026 | Fatto | Zona in basso a destra; la rotellina compare sotto il dito. Più la sposti di lato, più curvi. ▲ accelera (come freccia giù sulla tastiera), ▼ frena; in aria ◀ ▶ avvitamento, ▲ ▼ salto mortale. Provato: stessa velocità della tastiera (21 m/s accelerando, 10 m/s frenando) |
| R-211 | Sul telefono il pulsante Salta a sinistra | 24/10/2026 | Fatto | Pulsante tondo arancione in basso a sinistra; tenuto premuto in aria fa il backflip. Banane e bombe sopra il Salta |
| R-212 | Simbolo del microfono in alto per mandare i vocali agli altri giocatori durante il gioco | 24/10/2026 | Fatto | In alto a sinistra, sempre visibile mentre si gioca, su qualsiasi telefono. In sfida e online è arancione e manda il vocale; in allenamento è grigio e, toccato, spiega che i vocali sono per le sfide |
| R-213 | Il microfono deve essere presente e funzionare anche sugli altri telefoni Android, non solo su quello di Luigi | 25/10/2026 | Fatto | Vedi R-106: registrazione Web Audio + WAV, riproduzione con doppia via, messaggi chiari se manca il permesso o il browser dell'app non dà il microfono. Provato da telefono a telefono con un microfono simulato (`tools/verifica/test_vocale.py`) |

# 4. Scenari e città

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-301 | Scelta dello scenario o della città nel menu | 24/10/2026 | Fatto | Menu a tendina con 13 scenari: Neve e le 12 città |
| R-302 | Napoli: strade al posto della neve, mare, Vesuvio sullo sfondo; rocce lasciate; pizze e caffè al posto dei cristalli | 24/10/2026 | Fatto | |
| R-303 | Roma: in fondo allo scenario si vede il Colosseo; piatti di carbonara e carciofi al posto di pizza e caffè | 24/10/2026 | Fatto | Strada in sampietrini, palazzi romani, cupole e pini sullo sfondo |
| R-304 | In tutti gli scenari i testi dicono "albero" (non "abete") | 24/10/2026 | Fatto | A Napoli sono palme, a Roma pini; gli ostacoli che non sono alberi dicono il loro nome (Lampione!, Fioriera!…) |
| R-305 | La pista è troppo rettilinea: servono curve naturali, non troppo complicate | 24/10/2026 | Fatto | Tre onde sovrapposte danno curve ampie e dolci; la pista resta uguale per tutti nella stessa gara |
| R-306 | Tutte le altre città della tabella "CYF-elementi-per-citta.xlsx" (cartella sul Desktop) | 24/10/2026 | Fatto | Milano, Parigi, Londra, Francoforte, Madrid, Lisbona, Zagabria, Berlino, Zurigo, New York: ostacoli, bonus, rampe, porte, paletti, strada, palazzi, monumenti e, dalla 0.9.1, anche gli oggetti ai lati della tabella (tram arancione a Milano, cabine rosse e bus a due piani a Londra, tram giallo a Lisbona, ombrelloni rossi a Zagabria, tratti del Muro a Berlino, tram blu e bianco a Zurigo, taxi a New York), doppie linee gialle al marciapiede a Londra, marciapiedi a mosaico a Berlino, fiume Meno a Francoforte. Tabella verificata riga per riga il 25/10 (sezione 10) |

# 5. Grafica e qualità

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-401 | Eliminare le schermate di un solo colore, come dei muri | 24/10/2026 | Fatto | Lo sfondo di Napoli restava fermo e dopo ~400 m la telecamera ci entrava dentro |
| R-402 | Migliorare un po' la qualità generale delle immagini | 24/10/2026 | Fatto | Texture più definite, luce più morbida, modelli più arrotondati |
| R-403 | Omino con un corpo più naturale: niente cubi, testa non a sfera, busto non a parallelepipedo | 24/10/2026 | Fatto | Busto e testa modellati, spalle, gomiti e ginocchia arrotondati, scarponi e tavole con bordi morbidi |
| R-404 | Omino più umano | 24/10/2026 | Fatto | Bacino e pantaloni larghi (niente fessura da manichino), gambe e braccia modellate, giacca lunga con cappuccio e cerniera, casco che copre le orecchie e lascia il viso scoperto, occhiali, naso, scaldacollo, muffole con il pollice; testa girata verso dove si va, braccio davanti teso e braccio dietro morbido come i rider veri |

# 6. Documentazione

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| R-501 | File con tutti i requisiti del gioco, aggiornato a ogni richiesta, nella cartella "CYF gaming" sul Desktop | 24/10/2026 | Fatto | Questo documento; copia anche su GitHub (REQUISITI.md) |
| R-502 | Nel file dei requisiti, oltre a fatto e da fare, lo stato "Controllato" | 24/10/2026 | Fatto | Vedi la legenda all'inizio |
| R-503 | Controllo generale automatico ogni sera verso le 22: qualità, bachi, stabilità e idee di miglioramento | 24/10/2026 | Fatto | Attività pianificata ogni sera alle 21:33 (poco prima delle 22, per evitare l'ora di punta dei server); corregge solo bachi piccoli e sicuri e lascia un rapporto. Dal 25/10 fa anche il giro completo del cancello dei test (A-05) |
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
| S-12 | Dalla tabella delle città: niente vapore dai tombini a New York; Roma tiene carbonara e carciofi (chiesti da Luigi) invece di supplì e maritozzo; il semaforo di Berlino è senza l'omino (Ampelmännchen) disegnato. (Le porte a scacchi di Zagabria, che mancavano, ci sono dalla 0.9.1) | 24/10/2026 | Da confermare |
| S-13 | Classifica dei migliori tempi separata per durata (5, 10, 15 min); nel menu si vede quella dei 5 minuti | 24/10/2026 | Da confermare |
| S-14 | Nel menu del gioco la voce della maglia diventa "Colore assegnato" (Assigned colour, Couleur attribuée, Color asignado): la vecchia "Colore di gara (automatico)" era tagliata sul telefono in tutte le lingue | 24/10/2026 | Da confermare |
| S-15 | Nella home in francese si dà del tu, come nel gioco; in spagnolo "desafío" come nel gioco; in inglese l'ortografia britannica del gioco (colour) | 24/10/2026 | Da confermare |
| S-16 | Il pulsante per far partire la gara si chiama "Lancer" in francese ed "Empezar" in spagnolo: prima era "Partir" e "Salir", che vogliono dire anche "andarsene" ("Salir" era identico al pulsante Esci) | 24/10/2026 | Da confermare |
| S-17 | Le posizioni si scrivono come si usa in ogni lingua: 1° · 1st · 1er · 1.º (prima c'era sempre "1°", in inglese "I finished 1° in…") | 24/10/2026 | Da confermare |
| S-18 | Nomi delle maglie tradotti con i colori (es. "Naples · sky blue", "Rome · jaune et rouge"); in italiano restano i soprannomi (azzurra, giallorossa…) | 24/10/2026 | Da confermare |
| S-19 | Revisione delle traduzioni: in francese "Feu rouge !" (prima "Feu !", cioè "Fuoco!"), "Le plus de figures" (prima "Plus de figures", che si legge anche "basta figure"), "Borne d'incendie", "double appui"; in inglese "Run complete" (prima "Run over", che vuol dire anche "investito"); in spagnolo "Reanudar" | 24/10/2026 | Da confermare |
| S-20 | Rotellina: ▲ (dito in alto) accelera e ▼ frena, come un joystick; sulla tastiera resta freccia giù = accelera, freccia su = frena (R-206, R-207) | 24/10/2026 | Da confermare |
| S-21 | Sul telefono l'interruttore dell'audio è in alto accanto al microfono, i messaggi del vocale ("sta parlando…") compaiono a metà schermo; su PC il microfono è in alto a sinistra e i comandi touch non si vedono | 24/10/2026 | Da confermare |
| S-22 | I vocali viaggiano in WAV a 11-12 kHz (qualità da telefonata, circa 25 KB al secondo) invece che in Opus compresso: pesa di più ma si registra e si riproduce su ogni telefono senza dipendere dal browser | 25/10/2026 | Da confermare |

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
| D-01 | Provare la v0.9.1 dai telefoni con qualche amico (microfono su iPhone, comandi touch, fluidità) e scrivere a Claude i numeri dei requisiti che vanno bene ("R-303 controllato") | Luigi |
| D-02 | Leggere il rapporto del primo controllo notturno (parte stasera alle 21:33) | Luigi |
| D-03 | Comprare il dominio (es. cyfgaming.it, ~10-15 €/anno) e collegarlo: Cloudflare → Workers & Pages → cyf-gaming → Domains. Claude guida se serve | Luigi, ~10 min |
| D-04 | Decidere le scelte S-01…S-22: basta scrivere "S-xx va bene" oppure cosa cambiare | Luigi |
| D-05 | Immagine automatica del risultato ("1° a Napoli in 5:12") da allegare alla condivisione | Claude |
| D-06 | Prime letture dei contatori (/api/stats) dopo le gare di prova, per partire con i numeri del business plan | Insieme |
| D-07 | ~~Ricopiare sul Desktop i file Word aggiornati~~ Fatto il 25/10 alle 8: Word dei requisiti alla 0.9.2 e tabella Excel delle città aggiornata con lo stato nel gioco (tutte le 12 città "Nel gioco", in arancione i 4 punti diversi dalla tabella, vedi S-12) | Claude ✓ |

# 10. Verifica completa del 25 ottobre 2026

Nella notte tra il 24 e il 25 ottobre Claude ha ricontrollato ogni requisito nel software, leggendo tutto il codice e con prove automatiche: 62 controlli sul server delle gare (client simulati: stanze, durate, tempi, punti, vocali, segnalazioni, sale online, contatori), 135 controlli nel gioco (13 scenari, guida, acrobazie, gara a due), le prove delle 4 lingue, dei risultati e dei comandi touch, e il confronto riga per riga con la tabella Excel delle città. Esito per ogni requisito:

| ID | Esito | Come è stato verificato |
|---|---|---|
| R-001, R-002, R-003, R-004 | ✓ | Sito e gioco online; ogni modifica pubblicata da Cloudflare (5 pubblicazioni il 24/10, tutte riuscite) |
| R-005 | ✓ | PC con tastiera; telefono simulato in verticale e in orizzontale con rotellina, Salta e microfono |
| R-006 | ✓ | Link PayPal in `config.js`; pulsanti nella home, nel menu e nei risultati |
| R-007, R-009 | ✓ | Prova automatica: home e gioco nelle 4 lingue, scelta salvata, lingua del telefono, link `?lang=` |
| R-008 | ✓ | Dopo una gara di prova i contatori segnano gara avviata e finita, 2 corridori, 2 giocatori unici, segnalazioni |
| R-101 | ✓ | Codici da 4 a 8 caratteri; 8 giocatori entrano, il 9° viene rifiutato |
| R-102 | ✓ | Solo l'organizzatore avvia e rilancia; se esce, il ruolo passa al giocatore rimasto |
| R-103 | ✓ | Stesso seed e stesso istante di partenza per tutti; tempo misurato dal server |
| R-104 | ✓ | Avversario in pista con nome; 8 colori diversi; maglia trasmessa agli altri |
| R-105 | ✓ | Un tempo valido entra nella classifica della sua durata e non in quelle delle altre |
| R-106, R-213 | ✓ | Vocale inoltrato con nome e colore; secondo vocale entro 3 minuti rifiutato; formati sconosciuti scartati. 25/10 ore 8: vocale registrato con Web Audio da un telefono simulato, ricevuto in WAV e riprodotto dall'altro (fumetto "sta parlando", poi sparisce) |
| R-107, R-212 | ✓ | Pulsante visibile in gara e in allenamento (foto); conto alla rovescia nel codice |
| R-108 | ✓ | Traguardo a 12.000 m in gara; avviso a 500 m; 10 min → 24.000 m; durate non ammesse ignorate |
| R-109 | ✓ | Classifica dal vivo con i 2 nomi durante la gara |
| R-110 | ✓ | Premi velocità massima e acrobazie assegnati a chi li ha fatti; schermata finale nelle 4 lingue |
| R-111 | ✓ | `/api/quick` indica una sala ONLINE; con 2 giocatori parte in 30 s, con tutti pronti in 3 s; "Parti" e durata non esistono |
| R-112 | ✓ | Vincitore: 100 + punti rimasti, salvati sul server e letti da `/api/me`; non arrivato: 0 + punti rimasti |
| R-113 | ✓ | Banana lanciata col doppio clic (50 punti), vista dall'avversario; limite di una ogni 0,9 s; chi scivola lo dice a tutti |
| R-115 | ✓ | Link WhatsApp e Telegram nella stanza (provato sul sito online); risultato condiviso nelle 4 lingue |
| R-116 | ✓ | Due segnalazioni da persone diverse bloccano i vocali; dalla stessa persona no; silenzio salvato sul dispositivo |
| R-201 | ✓ | La roccia fa cadere a terra ma si supera saltando; l'albero e la palina fanno cadere sempre; porte e rampe in pista |
| R-202 | ✓ | Da 0,9 m con 34° di errore il rider si raddrizza e atterra pulito con i punti pieni |
| R-203 | ✓ | 180° = 60 punti, salto mortale = 150, due acrobazie +50%, atterraggio storto dimezza, molto storto fa cadere |
| R-204 | ✓ | Ali bianche sul fianco e sulla schiena della giacca (lettura della texture e foto) |
| R-205 | ✓ | Skateboard in tutte le 12 città, snowboard sulla neve |
| R-206, R-207, R-208 | ✓ | Raccolto 20,5 m/s, normale 18, frenata 9,5 (stessi valori con rotellina e tastiera) |
| R-209 | ✓ | 8 maglie + colore assegnato; scelta salvata; arriva agli avversari |
| R-210, R-211 | ✓ | Rotellina: destra/sinistra, su/giù, mezzo spostamento = mezza curva, rilascio a zero; Salta decolla |
| R-301 | ✓ | 13 scenari nel menu, ognuno si apre senza errori |
| R-302, R-303 | ✓ | Napoli: palme, pizza e caffè, basoli, golfo e Vesuvio; Roma: pini, carbonara e carciofo, sampietrini, Colosseo |
| R-304 | ✓ | Messaggi di caduta di ogni città, mai "Abete" |
| R-305 | ✓ | Curve ampie (48 m di escursione) e dolci (pendenza laterale massima 0,27) |
| R-306 | ✓ dopo correzione | Tabella Excel (15 righe × 12 città) confrontata riga per riga: le 7 righe di gioco erano tutte conformi; nelle righe di scena mancavano gli oggetti ai lati (tram, cabine, bus, taxi, ombrelloni, Muro), le linee gialle di Londra, i marciapiedi di Berlino, il fiume Meno, le porte a scacchi di Zagabria e i dettagli delle rampe di Madrid e Berlino: aggiunti nella 0.9.1. La pista resta identica in ogni città (stesso seed, stessi ostacoli) |
| R-401 | ✓ | Gli sfondi seguono la telecamera; 12 foto a 120 m senza schermate a tinta unita |
| R-402, R-403, R-404 | ✓ | Foto del rider da 6 angolazioni |
| R-501, R-502, R-504 | ✓ | Questo file e il Word; legenda; copia sul Desktop aggiornata il 25/10 (D-07) |
| R-503 | ✓ | Attività pianificata attiva: primo giro 24/10 dalle 21:33 alle 22:12, riuscito (ha pubblicato la 0.8.3); prossimo 25/10 alle 21:33 |
| R-505 | ✓ | `BUSINESS-PLAN.md` nel repo e Word sul Desktop |
| S-01 … S-21 | ✓ | Ogni scelta corrisponde al codice (S-12 aggiornata: le porte di Zagabria ora sono a scacchi) |

Difetto trovato e corretto nella 0.9.1: una banana o bomba lasciata mentre un telefono lento era ancora al conto alla rovescia veniva ignorata da quel telefono.

# 11. Struttura del software (per crescere senza rompere)

Raccomandazioni del 25/10/2026 per far sì che, man mano che il gioco cresce, le modifiche restino veloci e il sito stabile. Il principio, confermato dagli studi DORA sui team software (libro *Accelerate*, Forsgren e altri, 2018, e i rapporti annuali "State of DevOps"): prove automatiche, modifiche piccole e rilasci frequenti rendono un team **sia più veloce sia più stabile**. Le due cose vanno insieme, non si escludono. È lo stesso principio dei gate di validazione nei rilasci ADAS.

**Com'era il 25/10 mattina.** `game.js` (3.779 righe) conteneva tutto dentro un'unica funzione, con circa 175 variabili condivise: grafica, fisica, 13 città, rete, vocali, punti e schermate. Una modifica all'omino poteva rompere la rete senza che nessuno se ne accorgesse. Ogni push su `main` andava online da solo, e le prove si lanciavano a mano. In più, tutte le prove finivano con "esito OK" anche quando trovavano problemi.

**Ordine consigliato.** Prima il cancello dei test (A-01…A-05) e la diagnosi (A-06, A-07), fatti il 25/10. Poi la protezione di `main` e l'ambiente di prova (A-08, A-09). Poi, un pezzo alla volta e con le prove che confermano che nulla cambia, la separazione del codice (A-10…A-13). Il resto quando serve.

| ID | Richiesta | Data | Stato | Come funziona oggi |
|---|---|---|---|---|
| A-01 | Cancello dei test a ogni modifica: si va online solo se le prove sono verdi | 25/10/2026 | Fatto | Su GitHub (scheda Actions, "Cancello dei test") parte da solo a ogni modifica il giro rapido: controlli statici, server delle gare, 13 scenari e diagnosi. Prove ~75 s, in tutto ~5 min con la preparazione della macchina. Verde = si può pubblicare; rosso = qualcosa si è rotto. Da GitHub si lancia anche il giro completo ("Run workflow" → tutto) |
| A-02 | Le prove devono segnalare davvero quando qualcosa non va | 25/10/2026 | Fatto | Prima tutte le prove finivano "OK" anche con problemi, quindi nessun cancello poteva chiudersi. Ora ognuna esce con errore se trova un problema; verificato rompendo apposta un testo |
| A-03 | Una sola riga per lanciare le prove | 25/10/2026 | Fatto | `npm test` (giro rapido) e `npm run test:tutto` (giro completo, ~30 min); il server locale si accende e si spegne da solo |
| A-04 | Controlli immediati, senza browser | 25/10/2026 | Fatto | `npm run controlli` in mezzo secondo: sintassi di tutti i file, ogni testo usato dal gioco presente nelle 4 lingue con gli stessi segnaposto, versione presente nello storico |
| A-05 | Controllo notturno con il giro completo delle prove | 25/10/2026 | Fatto | L'attività delle 21:33 lancia tutte le prove (compresa la gara valida da 231 s), guarda l'esito del cancello su GitHub e gli errori arrivati dai telefoni, e mette nel rapporto la tabella superata/fallita con i tempi. Pubblica solo se tutte le prove passano |
| A-06 | Diagnosi nel gioco per trovare i bachi in fretta, anche sul telefono di un amico | 25/10/2026 | Fatto | Pannello che si apre con `?debug=1` nell'indirizzo, con 5 tocchi veloci sul numero di versione in fondo al menu o con F2. Mostra fps, scenario, seed della pista, velocità, distanza, stato della rete, ping, giocatori ed eventi recenti (collegamenti, cadute di rete, cambi di schermata). "Invia" manda la diagnosi al server e mostra un codice da dire a Luigi; "Copia" la copia negli appunti |
| A-07 | Errori dei telefoni dei giocatori raccolti in automatico | 25/10/2026 | Fatto | Ogni errore JavaScript viene mandato in forma anonima (versione, messaggio, punto del codice, tipo di telefono e browser, stato del gioco; niente nomi) e raggruppato per giorno con il conteggio. Si leggono su `/api/errors`. Massimo 8 invii per pagina; le prove in locale non inviano |
| A-08 | `main` protetto: niente va online senza il cancello verde | 25/10/2026 | Da fare | Serve un clic di Luigi su GitHub (Settings → Branches → regola per `main` con "Require status checks": Cancello dei test). Da quel momento Claude lavora su un ramo e unisce solo a cancello verde: ogni modifica impiega ~5 minuti in più, ma un errore non arriva più ai giocatori |
| A-09 | Ambiente di prova separato prima del sito pubblico | 25/10/2026 | Da fare | Le anteprime automatiche di Cloudflare non funzionano con i Durable Objects (stanze e classifica). Serve un secondo sito, es. `cyf-gaming-prova`, pubblicato da GitHub con una chiave Cloudflare (Luigi la crea in ~10 min); lì si provano le novità dal telefono prima di pubblicarle |
| A-10 | Città come dati: un file per città | 25/10/2026 | Da fare | Oggi le città sono codice dentro `game.js` (circa 300 righe di schede più i modelli). Ogni città diventa un file (`citta/milano.js`) con ostacoli, bonus, colori e oggetti; aggiungerne una vuol dire aggiungere un file senza toccare il motore. Una prova controlla che ogni scheda abbia tutti i campi. Le lingue sono già fatte così (`i18n.js`) |
| A-11 | Dividere `game.js` in moduli, un pezzo alla volta | 25/10/2026 | Da fare | Moduli: pista (generazione con il seed), fisica, rider, città, comandi, rete, vocali, schermate, audio. Fisica e regole di gara senza grafica, così si provano in Node in millisecondi e lo stesso codice gira sul server per verificare la traiettoria (il controllo contro chi bara dei "Prossimi passi"). Il primo pezzo separato è la diagnosi (`diagnosi.js`, 25/10) |
| A-12 | Un contratto unico per i messaggi di rete | 25/10/2026 | Da fare | File `shared/protocollo.js` con tutti i messaggi (`hello`, `pos`, `voice`…) e un numero di versione, usato da gioco e server. Chi ha ancora la pagina vecchia aperta riceve "aggiorna la pagina" invece di errori strani |
| A-13 | Parte comune della piattaforma C-Y-F, separata dal gioco | 25/10/2026 | Da fare | Stanze, lobby, vocali, punti, lingue e donazioni non sono di Pista Nera ma di C-Y-F: vanno in una parte comune, e ogni gioco porta solo le sue regole. Così il secondo gioco costa una frazione del primo |
| A-14 | Prestazioni misurate nelle prove | 25/10/2026 | Da fare | fps, peso della pagina e tempo di caricamento misurati a ogni giro, con soglie: il cancello si chiude se una modifica rende il gioco più lento |
| A-15 | Controllo dei tipi dei dati | 25/10/2026 | Da fare | Commenti JSDoc e `// @ts-check`, senza passaggi di compilazione: l'editor e le prove trovano errori come un numero passato al posto di un testo |
| A-16 | Aggiornare Three.js e servirlo dal sito stesso | 25/10/2026 | Da fare | Oggi si usa la r128 (2021) da un CDN esterno: se il CDN ha un problema, il gioco non parte. Va fatto dopo A-11, con le foto delle città per confrontare prima e dopo |
| A-17 | Interruttori per le novità | 25/10/2026 | Da fare | In `config.js`, per accendere una novità solo per Luigi (o con `?prova=nome`) prima che per tutti |

**Cosa non fare.** Niente riscrittura completa: è la causa classica di progetti fermi per mesi; si sposta un pezzo alla volta, con le prove che confermano che nulla cambia. Niente framework come React per il gioco: non servono e appesantiscono. Niente server diviso in tanti servizi: con i numeri attuali Worker e Durable Objects bastano largamente.

**Come si fa il debug da oggi.** (1) Un amico dice che qualcosa non va: gli si chiede di toccare 5 volte il numero di versione nel menu e premere "Invia", poi di dire il codice; Claude legge la sua diagnosi su `/api/errors`. (2) Errori che nessuno segnala: arrivano da soli su `/api/errors` e il controllo notturno li riassume. (3) Prima di ogni pubblicazione: `npm test` in locale o il cancello su GitHub.

# Storico delle versioni

| Versione | Data | Cosa è cambiato |
|---|---|---|
| 0.1–0.3 | ott 2026 | Gioco, sfida online, classifica, messa online, ali sulla giacca |
| 0.4.0 | 24/10/2026 | Donazioni, atterraggio assistito, acrobazie, messaggi vocali, scenario Napoli |
| 0.5.0 | 24/10/2026 | Correzione schermate a tinta unita, scenario Roma con Colosseo, skateboard in città, "albero" ovunque, grafica migliorata, file dei requisiti |
| 0.6.0 | 24/10/2026 | Rider modellato, accelerazione +30%, freccia giù/su, gare a traguardo 5/10/15 min, classifica live, premi, modalità online, punti collezionati, banane e bombe, microfono, 4 lingue, maglie delle città |
| 0.7.0 | 24/10/2026 | Curve naturali, 10 nuove città dalla tabella di Luigi, stabilità sui salti di posizione, business plan e controllo notturno |
| 0.8.0 | 24/10/2026 | Contatori d'uso (/api/stats), condivisione su WhatsApp/Telegram e del risultato, silenzia/segnala i vocali con blocco automatico dopo 2 segnalazioni |
| 0.8.1 | 24/10/2026 | Home in quattro lingue con scelta IT/EN/FR/ES, lingua condivisa tra home e gioco, link ?lang=, voce della maglia non più tagliata sul telefono |
| 0.8.2 | 24/10/2026 | Debug sul sito online: pulsante di partenza in francese e spagnolo, posizioni nella lingua giusta anche nel risultato condiviso, maglie tradotte, revisione delle traduzioni, schermata dei risultati sul telefono (pulsanti non più tagliati, nomi leggibili accanto a "non arrivato", premi su una riga) |
| 0.8.3 | 24/10/2026 | Controllo notturno: descrizioni rimaste alla versione dei 2.000 m aggiornate (anteprima dei link condivisi di Pista Nera, che diceva ancora "2.000 metri" e "Napoli e Roma", e README con regole e limiti attuali); nessun baco trovato nel codice: sintassi, chiavi delle 4 lingue, server locale, 13 scenari e una gara a due giocatori provati e a posto |
| 0.9.0 | 24/10/2026 | Rotellina sul telefono (curva, accelera, frena), Salta a sinistra, microfono in alto sempre visibile, omino più umano, messaggi a schermo che vanno a capo, riga dei risultati più compatta |
| 0.9.1 | 25/10/2026 | Verifica completa dei requisiti (sezione 10). Città completate come da tabella: oggetti ai lati (tram, cabine, bus, taxi, ombrelloni, Muro), linee gialle a Londra, marciapiedi a Berlino, fiume Meno, porte e rampa a scacchi a Zagabria, rampe di Madrid e Berlino; banane accettate anche durante il conto alla rovescia |
| 0.9.2 | 25/10/2026 | Microfono su tutti i telefoni (R-213): registrazione con Web Audio e vocali in WAV, riproduzione con doppia via, messaggi chiari se il microfono è negato o il browser dell'app non lo dà |
| 0.9.3 | 25/10/2026 | Struttura del software (sezione 11): cancello dei test su GitHub a ogni modifica (A-01), prove che segnalano davvero gli errori (A-02), `npm test` e `npm run test:tutto` (A-03), controlli statici (A-04), giro completo nel controllo notturno (A-05), pannello di diagnosi nel gioco con numero di versione nel menu (A-06), errori dei telefoni raccolti su /api/errors (A-07) |
