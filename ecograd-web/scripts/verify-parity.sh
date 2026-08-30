#!/usr/bin/env bash
# Compara numericamente os motores TypeScript com o backend Python original.
# Requer o venv do projeto Python na raiz do repositório (../.venv), ou a
# variável PYTHON apontando para um interpretador com streamlit/networkx/pandas.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$(dirname "$AQUI")"
RAIZ="$(dirname "$APP")"
SAIDA="$APP/.parity"
BASE="${1:-$RAIZ/base_ppgegc.json}"

mkdir -p "$SAIDA"
PY="${PYTHON:-$RAIZ/.venv/bin/python}"

echo "▶ Referência Python ($PY)..."
"$PY" "$AQUI/verify-parity-reference.py" > "$SAIDA/py_ref.json"

echo "▶ Motores TypeScript..."
npx esbuild "$AQUI/verify-parity.ts" --bundle --platform=node --format=esm \
  --target=node20 --outfile="$SAIDA/verify.mjs" --log-level=error
node --max-old-space-size=6144 "$SAIDA/verify.mjs" "$BASE" > "$SAIDA/ts_ref.json"

echo "▶ Comparando..."
PARITY_DIR="$SAIDA" python3 "$AQUI/verify-parity-compare.py"
