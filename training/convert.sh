#!/usr/bin/env bash
# Convert the trained Keras SavedModel into a TensorFlow.js graph model that the
# Clouddex app loads from public/model/.
#
#   pip install tensorflowjs
#   ./convert.sh
#
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
