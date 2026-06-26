"""Convert a trained Keras model (.h5/.keras) to a TF.js Layers model.

Use this when Colab's in-notebook TF.js export breaks from version skew (e.g.
`np.object` removed, or `tf.compat.v1.estimator` missing). The model trains fine
on Colab — you just save it and convert here, where the venv's tensorflowjs works:

    # in Colab, after training:
    model.save("/content/clouddex_model.h5")
    from google.colab import files; files.download("/content/clouddex_model.h5")

    # locally:
    .venv/bin/python convert_h5.py ~/Downloads/clouddex_model.h5 --out ../public/model

Writes the TF.js model + labels.json straight into the app's public/model/.
"""
import argparse
import json
import os
import shutil
import sys

# Must precede TF import so Keras resolves to Keras 2 (matches training).
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

# Model output order = alphabetical class names from image_dataset_from_directory.
DEFAULT_LABELS = [
    "altocumulus", "altostratus", "cirrocumulus", "cirrostratus", "cirrus",
    "contrail", "cumulonimbus", "cumulus", "nimbostratus", "stratocumulus", "stratus",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model", help="path to the downloaded .h5/.keras model")
    ap.add_argument("--out", default="../public/model")
    ap.add_argument("--labels", default="",
                    help="comma-separated labels in model-output order; "
                         "default = the 11 alphabetical genera (matches the app)")
    args = ap.parse_args()

    if not os.path.isfile(args.model):
        sys.exit(f"ERROR: {args.model} not found")

    import tf_keras as keras
    # NumPy >=1.24 removed np.object/np.bool aliases some tensorflowjs builds use.
    import numpy as np
    for _n, _t in (("object", object), ("bool", bool), ("int", int), ("float", float)):
        if not hasattr(np, _n):
            setattr(np, _n, _t)
    import tensorflowjs as tfjs

    model = keras.models.load_model(args.model, compile=False)
    n_out = model.output_shape[-1]

    labels = [s.strip() for s in args.labels.split(",") if s.strip()] or DEFAULT_LABELS
    if len(labels) != n_out:
        sys.exit(f"ERROR: model outputs {n_out} classes but {len(labels)} labels given. "
                 "Pass --labels with the exact class_names printed during training.")

    out = os.path.abspath(args.out)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out, exist_ok=True)
    tfjs.converters.save_keras_model(model, out)
    json.dump({"labels": labels}, open(os.path.join(out, "labels.json"), "w"), indent=2)
    print("Wrote TF.js Layers model + labels to", out)
    print("Reload the app — the demo badge should be gone.")


if __name__ == "__main__":
    main()
