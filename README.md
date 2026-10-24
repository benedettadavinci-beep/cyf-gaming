# C-Y-F Gaming · Challenge Your Friends

Giochi nel browser per sfidare gli amici in tempo reale. Primo gioco: **Pista Nera**, snowboard in 3D sui 2.000 metri.

## Come funziona

| Parte | Dove | Cosa fa |
| --- | --- | --- |
| Sito e gioco | `public/` | Pagina iniziale (`/`) e gioco (`/pista-nera/`), file statici |
| Server delle gare | `src/worker.js` → `RaceRoom` | Una "stanza" per ogni codice sfida: lobby, conto alla rovescia, stessa pista per tutti (seed), posizioni in tempo reale, tempi misurati dal server |
| Classifica | `src/worker.js` → `Leaderboard` | Database SQLite con i migliori tempi sui 2.000 m |

Tutto gira su Cloudflare Workers con Durable Objects. Configurazione in `wrangler.jsonc`.

### Regole della sfida
- Da 1 a 8 giocatori per stanza; chi crea la stanza è l'organizzatore e preme **Parti**.
- Tutti ricevono lo stesso tracciato. Il tempo parte allo stesso istante per tutti ed è misurato dal server.
- Le cadute non eliminano: fanno perdere tempo.
- Un arrivo più veloce del limite fisico del gioco (2.000 m a 47 m/s, circa 42,5 s) viene scartato.
- Dopo 4 minuti chi non è arrivato risulta "non arrivato".

## Messa online (una volta sola)

1. **GitHub**: crea un account su github.com e un repository vuoto chiamato `cyf-gaming`, poi carica questo codice (lo fa Claude se colleghi il repository alla sessione).
2. **Cloudflare**: crea un account gratuito su dash.cloudflare.com.
3. Nel pannello Cloudflare: **Workers & Pages → Create application → GitHub**, autorizza GitHub, scegli `cyf-gaming`, lascia il nome del progetto `cyf-gaming` (deve corrispondere a `name` in `wrangler.jsonc`) e premi **Save and Deploy**.
4. Il sito sarà su `https://cyf-gaming.<tuo-sottodominio>.workers.dev`. Da quel momento ogni modifica caricata su GitHub va online da sola.
5. Facoltativo: un dominio tuo (es. `cyfgaming.it`) si collega da **Workers & Pages → cyf-gaming → Settings → Domains & Routes**.

Il piano gratuito di Workers include i Durable Objects (100.000 richieste al giorno). I messaggi WebSocket in arrivo contano 1 richiesta ogni 20: una gara di circa 1 minuto pesa intorno alle 30 richieste per giocatore.

## Provare in locale

```bash
npm install
npm run dev      # apre http://localhost:8787
```

Per provare una sfida apri due finestre del browser, crea la stanza in una ed entra con il codice nell'altra.

## Prossimi passi
- Partita rapida con sconosciuti (matchmaking)
- Classifiche giornaliere e login
- Più controlli contro chi bara (il server verifica la traiettoria)
