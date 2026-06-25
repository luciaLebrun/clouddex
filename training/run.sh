#!/usr/bin/env bash
# One-shot: train the cloud classifier, export to TensorFlow.js, and place it in
# ../public/model/ so the app picks it up (demo badge disappears).
#
# Prereqs:
#   1. Python env ready:  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
#   2. CCSN dataset placed under ./data/ — either the original 2-letter folders
#      (Ci, Cu, ...) or already-renamed full ids (cirrus, cumulus, ...).
#
# Usage:
#   ./run.sh                 # train + convert (local)
#   ./run.sh --epochs 20     # pass-through args to train.py
#
set -euo pipefail
cd "$(dirname "$0")"

PY=".venv/bin/python"
[ -x "$PY" ] || { echo "ERROR: .venv missing. Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"; exit 1; }

[ -d data ] || { echo "ERROR: ./data not found. Place the CCSN dataset there (one folder per class)."; exit 1; }

# --- Normalize CCSN 2-letter folder codes -> full class ids the app expects ---
declare -A MAP=(
  [Ci]=cirrus [Cs]=cirrostratus [Cc]=cirrocumulus
  [Ac]=altocumulus [As]=altostratus
  [Cu]=cumulus [Cb]=cumulonimbus [Ns]=nimbostratus
  [Sc]=stratocumulus [St]=stratus [Ct]=contrail
)
for code in "${!MAP[@]}"; do
  if [ -d "data/$code" ] && [ ! -d "data/${MAP[$code]}" ]; then
    echo "Renaming data/$code -> data/${MAP[$code]}"
    mv "data/$code" "data/${MAP[$code]}"
  fi
done

echo "Classes found:"; ls -1 data | sed 's/^/  - /'

# --- Train ---
echo "==> Training"
$PY train.py --data ./data "$@"

# --- Convert to TF.js (uses tensorflowjs_converter from the venv) ---
echo "==> Converting to TensorFlow.js"
export PATH="$(pwd)/.venv/bin:$PATH"
./convert.sh

echo
echo "Done. Model written to ../public/model/."
echo "Verify locally:  (cd .. && npm run dev)  — the 'demo model' badge should be gone."
echo "Deploy:          (cd .. && git add public/model && git commit -m 'Add trained model' && git push)"
