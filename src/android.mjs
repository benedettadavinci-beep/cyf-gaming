// App Android di Pista Nera su Google Play (R-547, R-550): il legame tra l'app e questo sito.
//
// PACCHETTO è il nome tecnico dell'app. Dopo il primo caricamento su Google Play non si può più cambiare: deve restare
// uguale a quello del progetto in android/ (android/twa-manifest.json, "packageId").
//
// IMPRONTE sono le impronte SHA-256 delle chiavi che firmano l'app, così come le mostra Play Console
// (Configurazione → Integrità dell'app → Firma dell'app): la «chiave di firma dell'app» di Google e la «chiave di
// caricamento». Vanno copiate qui tali e quali, per esempio 'AB:CD:…'. Finché l'elenco è vuoto l'app funziona lo stesso,
// ma in alto mostra la barra con l'indirizzo del sito.
export const PACCHETTO = 'com.cyfgaming.pistanera';
export const IMPRONTE = [
  // chiave di caricamento (quella che firma il file .aab costruito da GitHub, .github/workflows/android.yml)
  'E2:F2:1E:90:8E:46:98:86:6F:31:26:EC:DB:2F:68:AE:76:75:2E:B6:53:1D:CF:57:CB:3D:C9:8C:45:0B:4E:B4'
  // qui sotto va aggiunta la «chiave di firma dell'app» di Google, appena Play Console la mostra (D-15)
];

// contenuto di /.well-known/assetlinks.json (lo serve worker.js)
export const assetlinks = () => (IMPRONTE.length ? [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: PACCHETTO, sha256_cert_fingerprints: IMPRONTE }
}] : []);
