# App Android di Pista Nera (R-550)

L'app Android è **lo stesso sito aperto a schermo intero dentro un'app** (in gergo: TWA). Qui non c'è codice del
gioco: quando il sito si aggiorna, l'app è già aggiornata. Un file nuovo per Google Play serve solo se cambiano il
nome, l'icona, l'indirizzo del sito o le regole di Google sulla versione di Android.

| Cosa | Dove |
|---|---|
| Descrizione dell'app (nome, sito, colori, versione) | `android/twa-manifest.json` |
| Progetto generato (non si modifica a mano) | il resto di `android/` |
| Come si rigenera | `tools/android/genera.mjs` (le istruzioni sono in testa al file) |
| Come si costruisce il file `.aab` | GitHub, `.github/workflows/android.yml`: parte da solo quando cambia `android/`, oppure Actions → «App Android» → Run workflow |
| Legame tra sito e app (`/.well-known/assetlinks.json`) | `src/android.mjs` |
| Testi e immagini per la scheda dello store | `docs/play/` |

## Dati fissi

- Nome tecnico: `com.cyfgaming.pistanera` (**non si può più cambiare dopo il primo caricamento su Google Play**).
- Apre: `https://cyf-gaming.benedetta-davinci-mellum.workers.dev/pista-nera/?fonte=app` (il gioco riconosce l'app da `?fonte=app`).
- Destinata ad Android 16 (API 36); funziona da Android 7 in su (lo chiede la libreria di Google che apre il sito; serve Chrome o un browser compatibile).
- Schermo intero, notifiche spente, nessun permesso chiesto dall'app (il microfono lo chiede il browser, solo quando si preme il pulsante dei vocali).

## Firma

Il file `.aab` va firmato con la **chiave di caricamento**. La chiave e la sua password **non stanno nel repository**:
le ha Luigi (file `cyf-upload.keystore` e `ANDROID_FIRMA.txt`, ricevuti in chat il 23/11/2026) e stanno nel segreto
`ANDROID_FIRMA` di GitHub (Settings → Secrets and variables → Actions), una riga sola: `<password> <chiave in base64>`.
Se si perde, Google permette di sostituirla (Play Console → Integrità dell'app → richiedi la reimpostazione della
chiave di caricamento): per questo su Google Play va lasciata accesa la «firma dell'app di Google Play».

## Cambiare indirizzo del sito (dominio nuovo)

1. In `android/twa-manifest.json` cambiare `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl`, `fullScopeUrl` e aumentare `appVersionCode` di 1.
2. Rigenerare con `tools/android/genera.mjs` e mettere tutto nel commit: GitHub costruisce il file nuovo.
3. Il sito nuovo deve rispondere a `/.well-known/assetlinks.json` (lo fa già il server, `src/android.mjs`).
