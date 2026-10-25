#!/usr/bin/env bash
# Cancello dei test di C-Y-F Gaming: una sola riga per lanciare le prove, in locale, su GitHub e nel controllo notturno.
#
#   bash tools/verifica/cancello.sh            giro rapido (~2 min): controlli statici, server senza la gara da 231 s, 13 scenari e diagnosi
#   bash tools/verifica/cancello.sh tutto      giro completo (~30 min): anche gara valida, guida, lingue, risultati, comandi, vocale
#
# Se il server locale non è già acceso su 127.0.0.1:8787 lo avvia (wrangler dev, attesa della sfida di 4 s) e lo spegne alla fine.
# Con un server già acceso le prove assumono l'attesa vera di 25 s, salvo ATTESA_SFIDA_MS esportata con lo stesso valore del server.
# Esce con 1 se una prova fallisce: è questo che chiude il cancello.
set -u
MODO="${1:-rapido}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export BASE="${BASE:-http://127.0.0.1:8787}"

# copia locale di three r128: il browser di prova non raggiunge il CDN
if [ -z "${THREE_JS:-}" ] || [ ! -f "$THREE_JS" ]; then
  export THREE_JS="$HOME/three/package/build/three.min.js"
  if [ ! -f "$THREE_JS" ]; then
    mkdir -p "$HOME/three" && (cd "$HOME/three" && npm pack three@0.128.0 >/dev/null 2>&1 && tar xzf three-0.128.0.tgz)
  fi
fi

SERVER_PID=""
if ! curl -s -o /dev/null "$BASE/"; then
  [ -d node_modules/wrangler ] || npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
  # attesa della sfida accorciata a 10 s solo qui (online sono 25 s, R-119): le prove che avviano gare non aspettano 25 s ognuna
  export ATTESA_SFIDA_MS="${ATTESA_SFIDA_MS:-10000}"
  WRANGLER_SEND_METRICS=false npx wrangler dev --port 8787 --var "ATTESA_SFIDA_MS:$ATTESA_SFIDA_MS" > /tmp/cyf-wrangler.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null "$BASE/" && break; sleep 1; done
  curl -s -o /dev/null "$BASE/" || { echo "Il server locale non parte:"; tail -20 /tmp/cyf-wrangler.log; exit 1; }
fi
trap '[ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null' EXIT

RIGHE=(); FALLITE=0
prova() {   # prova "nome" comando…
  local nome="$1"; shift
  local t0=$SECONDS
  echo; echo "════ $nome"
  if "$@"; then RIGHE+=("✓  $nome  ($((SECONDS - t0)) s)")
  else RIGHE+=("✗  $nome  ($((SECONDS - t0)) s)"); FALLITE=$((FALLITE + 1)); fi
}

prova "Controlli statici (sintassi, lingue, versione)" node tools/verifica/controlli.mjs
prova "Matrice dei moduli (dipendenze dichiarate, nessun ciclo)" node tools/verifica/matrice.mjs --check
prova "Nomi non definiti (scope di ogni file)" node tools/verifica/nomi.mjs
if [ "$MODO" = "tutto" ]; then
  prova "Server delle gare (completo, con gara valida)" node tools/verifica/test_server.mjs
else
  prova "Server delle gare (rapido)" env VELOCE=1 node tools/verifica/test_server.mjs
fi
prova "Browser: 13 scenari e diagnosi" python3 tools/verifica/test_rapido.py
if [ "$MODO" = "tutto" ]; then
  prova "Gioco: città, guida, acrobazie, gara a due" python3 tools/verifica/test_gioco.py
  prova "Piedi sopra le rampe e i trampolini giganti" python3 tools/verifica/test_trampolino.py
  prova "Lingue su telefono e PC" python3 tools/verifica/test_lingue.py
  prova "Schermata dei risultati" python3 tools/verifica/test_risultati.py
  prova "Comandi touch" python3 tools/verifica/test_comandi.py
  prova "Messaggi vocali" python3 tools/verifica/test_vocale.py
  echo; echo "════ Rotellina contro tastiera (solo informativa)"; python3 tools/verifica/cmp_input.py || true
fi

echo; echo "════ Riepilogo ($MODO)"
printf '%s\n' "${RIGHE[@]}"
if [ $FALLITE -gt 0 ]; then echo "CANCELLO CHIUSO: $FALLITE prove fallite"; exit 1; fi
echo "CANCELLO APERTO: tutte le prove superate"
