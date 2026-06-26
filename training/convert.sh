#!/usr/bin/env bash
# DEPRECATED — do not use. This produced a TF.js *graph* model from a Keras
# SavedModel, but the app loads a *Layers* model via loadLayersModel, and the
# Keras-3 SavedModel export breaks tensorflowjs ("Identity is not in graph").
# train.py now exports the TF.js Layers model directly into ../public/model/.
# Kept only for reference. See train.py's header for the full rationale.
echo "convert.sh is deprecated — train.py exports the TF.js model directly." >&2
exit 1

set -euo pipefail

SAVED_MODEL="${1:-./saved_model}"
OUT_DIR="../public/model"

mkdir -p "$OUT_DIR"

tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --signature_name=serving_default \
  --saved_model_tags=serve \
  "$SAVED_MODEL" \
  "$OUT_DIR"

# Keep labels in sync with the freshly trained model.
cp ./labels.json "$OUT_DIR/labels.json"

echo "Wrote model + labels to $OUT_DIR"
echo "Reload the app — the demo badge should disappear."
