---
title: "C-Y-F Gaming — Business plan"
subtitle: "Versione 1.0 · 24 ottobre 2026 · riservato"
---

Questo documento descrive come C-Y-F Gaming può passare da progetto personale a piccola attività che si sostiene da sola. I numeri di mercato sono stime ragionate e vanno verificati sui dati reali del sito: ogni cifra segnata "ipotesi" è un'assunzione, non un fatto. Non è una consulenza finanziaria.

# 1. L'idea in breve

**C-Y-F Gaming (Challenge Your Friends)** è un sito di giochi immediati nel browser: niente da installare, niente account obbligatorio. Si crea una sfida, si manda un link, si gareggia in tempo reale. Il primo gioco è **Pista Nera**: discese da 5-15 minuti in snowboard o skateboard attraverso 13 scenari (neve e 12 città con i loro monumenti, da Napoli a New York), con acrobazie, messaggi vocali, banane e bombe in stile kart.

I tre punti di forza su cui costruire:

1. **Zero attrito**: dal link alla gara in meno di 10 secondi, anche dal telefono. È il vantaggio decisivo contro i giochi da scaricare.
2. **Il link è la pubblicità**: ogni sfida creata viene condivisa con amici che oggi non conoscono il sito. Il prodotto si distribuisce da solo, a costo zero.
3. **Le città come identità**: la gara "a casa tua" (Napoli, Roma, Milano…) dà un motivo per parlarne, per campanilismo e per condividere video.

# 2. Dove siamo oggi

| Cosa | Stato al 24/10/2026 |
|---|---|
| Prodotto | Online e funzionante: gare 1-8 giocatori, sale pubbliche, punti persistenti, 4 lingue, 13 scenari |
| Costi vivi | ~0 €/mese (piano gratuito Cloudflare, fino a ~100.000 richieste al giorno) |
| Ricavi | Pulsante donazioni PayPal (attivo, nessun dato ancora) |
| Squadra | Luigi (visione e requisiti) + Claude (sviluppo), con controllo qualità notturno automatico |
| Utenti | Da misurare: il sito è appena uscito |

# 3. Mercato e concorrenza

Il riferimento sono i giochi "istantanei" nel browser, un settore reso enorme da siti come Poki o CrazyGames (centinaia di milioni di visite al mese dichiarate) e dai giochi .io (Agar.io, Slither.io, smash karts e simili). Che cosa dice questo mercato:

- la domanda di giochi immediati multigiocatore esiste ed è grande, soprattutto su mobile e tra i 10 e i 30 anni;
- i successi del genere vivono di sessioni corte, meccaniche semplici e condivisione tra amici — esattamente il formato di Pista Nera;
- la monetizzazione tipica è pubblicità più acquisti estetici; le donazioni da sole di norma non bastano.

**Concorrenza.** Contro i portali generalisti non si vince per catalogo, ma per identità (le città, l'italiano, le sfide tra amici) e per qualità della singola esperienza. Contro i kart-game affermati si vince sull'attrito: loro chiedono download e account, noi un link.

**Nicchia iniziale** (ipotesi da validare): giovani italiani all'estero e gruppi di amici/colleghi che vogliono sfidarsi al volo — il "derby" Napoli-Roma-Milano è un gancio naturale sui social.

# 4. Come può guadagnare

In ordine di attivazione, dal più semplice:

| Fase | Fonte | Come funziona | Nota |
|---|---|---|---|
| Ora | Donazioni | Pulsante "Sostieni" (PayPal) | Già attivo; copre i primi costi |
| 1 | Pubblicità leggera | Un banner discreto nei menu (mai in gara), es. AdSense o rete per giochi | Ipotesi: 1-3 € ogni 1.000 visite; richiede banner dei cookie |
| 2 | Estetica a pagamento | Maglie speciali, scie, adesivi per la tavola (2-5 €) | Non tocca l'equilibrio di gara: chi paga non va più forte |
| 2 | Pass tornei | Tornei serali o "derby delle città" con iscrizione simbolica (1-2 €) e classifica dedicata | Serve prima massa critica nelle sale online |
| 3 | Sponsor locali | Un marchio sulla rampa o sullo striscione d'arrivo dello scenario della sua città | Vendita diretta, margini alti, richiede numeri dimostrabili |

Regole fisse: niente vantaggi di gioco a pagamento ("pay-to-win"), pubblicità mai durante la gara, prezzi piccoli e chiari.

# 5. Costi

| Voce | Oggi | A ~1.000 giocatori/giorno (ipotesi) |
|---|---|---|
| Server (Cloudflare Workers + Durable Objects) | 0 € | ~5-20 €/mese |
| Dominio proprio (es. cyfgaming.it) | — | ~10-15 €/anno |
| Strumenti di sviluppo e controllo notturno | Compresi nell'abbonamento Claude già in uso | invariato |
| Marketing | 0 € (crescita organica) | facoltativo |

La struttura dei costi è il vero vantaggio: sotto i 25 €/mese fino a volumi importanti, quindi **il pareggio si raggiunge con poche decine di euro al mese** di donazioni o pubblicità. Il rischio economico di provarci è vicino a zero; l'investimento vero è il tempo.

# 6. Strategia di crescita

1. **Prodotto che si condivide da solo**: il link di sfida è già il motore. Da aggiungere: pulsante "condividi su WhatsApp/Telegram" e un'immagine automatica del risultato ("1° a Napoli in 5:12!") da incollare in chat.
2. **Contenuti brevi**: clip da 15-30 secondi di acrobazie e cadute per TikTok/Instagram/YouTube Shorts, una per città. Costo zero, si registrano dal gioco.
3. **Campanilismo organizzato**: "derby" settimanali tra città con classifica dedicata; le community locali (gruppi di studenti, Erasmus, italiani all'estero) sono il primo pubblico da contattare direttamente.
4. **Lingue già pronte**: inglese, francese e spagnolo aprono le community delle 6 città non italiane già nel gioco.
5. **Ritenzione**: i punti collezionati, le classifiche per durata e i tornei danno un motivo per tornare. Prossimo passo tecnico: accesso facoltativo (es. Google) per ritrovare i punti su più dispositivi.

# 7. Tappe e obiettivi (proposta)

| Trimestre | Obiettivo principale | Il numero che conta (ipotesi di successo) |
|---|---|---|
| Q4 2026 | Misurare: statistiche di base (visite, gare/giorno), condivisione su WhatsApp, dominio proprio | 100 gare/giorno |
| Q1 2027 | Trattenere: account facoltativo, classifiche settimanali, primo "derby delle città" | 25% di giocatori che tornano entro 7 giorni |
| Q2 2027 | Monetizzare: banner leggero + prime maglie a pagamento | primi 100 €/mese |
| Q3 2027 | Allargare: secondo gioco C-Y-F (riusando sale, punti e sfide), primo sponsor locale | 1.000 giocatori/giorno |

Ogni tappa è un cancello: se il numero non arriva, si corregge o ci si ferma prima di spendere altro tempo.

# 8. I numeri da guardare (KPI)

- Gare completate al giorno (la misura più onesta dell'uso reale)
- Giocatori unici al giorno e % che torna entro 7 giorni
- Sfide create → amici che entrano dal link (fattore virale)
- Donazioni e, dopo, ricavo per 1.000 visite
- Costo server per 1.000 gare (deve restare sotto il ricavo)

# 9. Rischi e contromisure

| Rischio | Gravità | Contromisura |
|---|---|---|
| Nessuno lo scopre (il rischio principale) | Alta | Le azioni del punto 6; misurare tutto; nicchia prima, massa poi |
| Abusi nei vocali e nei nomi | Media | Già oggi: vocali solo in gara, uno ogni 3 min; da aggiungere: silenzia giocatore e segnalazione |
| Marchi altrui (squadre, monumenti) | Media | Già mitigato: solo colori e nomi di città, niente stemmi o nomi di club; vale anche per gli sponsor |
| Costi che crescono con il successo | Bassa | La struttura Cloudflare scala in modo graduale; i KPI la tengono d'occhio |
| Dipendenza da una persona sola | Media | Codice documentato, requisiti scritti, controllo notturno automatico; riepilogo sempre aggiornato |
| Privacy e norme (GDPR, cookie) | Media | Oggi non ci sono account né tracciamento; prima della pubblicità servono banner cookie e informativa |

# 10. Scenari a 12 mesi (ipotesi, non previsioni)

| Scenario | Giocatori/giorno | Ricavi/mese | Costi/mese | Risultato |
|---|---|---|---|---|
| Prudente | 50 | 5-20 € (donazioni) | ~0 € | Hobby che si paga da solo |
| Base | 500 | 80-200 € (pubblicità + estetica) | ~10 € | Progetto laterale solido |
| Ottimista | 5.000 | 1.000-3.000 € (+ sponsor e tornei) | 50-150 € | Valutare tempo dedicato e partita IVA |

**Conclusione.** Il progetto ha costi quasi nulli, un prodotto già online e un meccanismo di diffusione incorporato nel link di sfida. La strada sensata è: misurare l'uso reale, far crescere la condivisione, e accendere i ricavi per gradi solo dove i numeri lo giustificano.
