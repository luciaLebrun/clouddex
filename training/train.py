"""
Train a cloud-genus classifier with MobileNetV2 transfer learning, then export
directly to a TensorFlow.js *Layers* model for the Clouddex PWA.

This is the "better path" from the project plan. The "fast path" (Google
Teachable Machine, no code) is described in training/README.md. For free GPU,
training/colab_train.py is the self-contained Colab twin of this script.

Dataset: CCSN (Cirrus Cumulus Stratus Nimbus) database — ~2,543 images, 11
classes. Download separately (see README) and arrange as:

    data/
      cirrus/ *.jpg
      cirrostratus/ *.jpg
      cirrocumulus/ *.jpg
      altocumulus/ *.jpg
      altostratus/ *.jpg
      cumulus/ *.jpg
      cumulonimbus/ *.jpg
      nimbostratus/ *.jpg
      stratocumulus/ *.jpg
      stratus/ *.jpg
      contrail/ *.jpg

CRITICAL — why this script looks the way it does (hard-won, do not "simplify"):
  * Keras 2 (tf_keras), NOT Keras 3. Keras-3 `model.export()` SavedModel +
    in-graph preprocessing breaks tensorflowjs ("Identity is not in graph").
  * Normalization to [-1, 1] happens in the DATA PIPELINE, not in the model.
    Putting `preprocess_input` in the graph AND normalizing in preprocess.ts
    double-normalizes — the #1 silent-failure mode. The model takes [-1, 1]
    input directly, matching src/ml/preprocess.ts.
  * Export via `tfjs.converters.save_keras_model` -> a Layers model the app
    loads with `loadLayersModel`. No SavedModel, no convert.sh.

Usage:
    pip install -r requirements.txt
    python train.py --data ./data --out ../public/model
"""

import argparse
import json
import os
import shutil
import sys

# Must be set BEFORE TensorFlow is imported so tf.keras resolves to Keras 2.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

IMG_SIZE = 224
BATCH = 32

# CCSN ships 2-letter folder codes; map them to the full class ids the app uses.
CCSN_MAP = {
    "Ci": "cirrus", "Cs": "cirrostratus", "Cc": "cirrocumulus",
    "Ac": "altocumulus", "As": "altostratus", "Cu": "cumulus",
    "Cb": "cumulonimbus", "Ns": "nimbostratus", "Sc": "stratocumulus",
    "St": "stratus", "Ct": "contrail",
}


def _has_images(d: str) -> bool:
    try:
        return any(
            f.lower().endswith((".jpg", ".jpeg", ".png")) for f in os.listdir(d)
        )
    except OSError:
        return False


def find_class_root(base: str) -> str:
    """Descend through single-child / Mac-zip nesting to the real class root."""
    cur = base
    for _ in range(6):
        subs = [
            d for d in os.listdir(cur)
            if os.path.isdir(os.path.join(cur, d)) and not d.startswith("__")
        ]
        if len(subs) >= 2 and any(_has_images(os.path.join(cur, s)) for s in subs):
            return cur
        if len(subs) == 1:
            cur = os.path.join(cur, subs[0])
            continue
        return cur
    return cur


def prepare(data_dir: str) -> list[str]:
    """Idempotent: strip Mac junk, rename CCSN codes, drop/repair bad images."""
    import tensorflow as tf
    from PIL import Image, ImageFile
    ImageFile.LOAD_TRUNCATED_IMAGES = False

    shutil.rmtree(os.path.join(data_dir, "__MACOSX"), ignore_errors=True)

    for code, full in CCSN_MAP.items():
        s, d = os.path.join(data_dir, code), os.path.join(data_dir, full)
        if os.path.isdir(s) and not os.path.isdir(d):
            os.rename(s, d)

    classes = sorted(
        d for d in os.listdir(data_dir)
        if os.path.isdir(os.path.join(data_dir, d)) and not d.startswith("__")
    )
    removed = 0
    for c in classes:
        cdir = os.path.join(data_dir, c)
        for fn in list(os.listdir(cdir)):
            fp = os.path.join(cdir, fn)
            if fn.startswith("._") or not os.path.isfile(fp):
                if os.path.isfile(fp):
                    os.remove(fp)
                    removed += 1
                continue
            try:
                tf.image.decode_image(tf.io.read_file(fp), expand_animations=False)
            except Exception:
                try:
                    Image.open(fp).convert("RGB").save(fp, "JPEG", quality=92)
                except Exception:
                    os.remove(fp)
                    removed += 1
    print("classes:", classes)
    print("counts:", {c: len(os.listdir(os.path.join(data_dir, c))) for c in classes})
    print("removed junk/undecodable:", removed)
    return classes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="./data")
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--fine-tune-epochs", type=int, default=8)
    ap.add_argument("--out", default="../public/model")
    args = ap.parse_args()

    import tensorflow as tf
    import tf_keras as keras
    from tf_keras import layers, models
    from tf_keras.applications import MobileNetV2

    gpus = tf.config.list_physical_devices("GPU")
    print("TF", tf.__version__, "| GPU:", gpus if gpus else "NONE (slow on CPU)")

    if not os.path.isdir(args.data):
        sys.exit(f"ERROR: {args.data} not found — place the CCSN dataset there first.")

    data_dir = find_class_root(args.data)
    print("DATA_DIR =", data_dir)
    prepare(data_dir)

    train_ds = keras.utils.image_dataset_from_directory(
        data_dir, validation_split=0.2, subset="training", seed=1337,
        image_size=(IMG_SIZE, IMG_SIZE), batch_size=BATCH, label_mode="categorical")
    val_ds = keras.utils.image_dataset_from_directory(
        data_dir, validation_split=0.2, subset="validation", seed=1337,
        image_size=(IMG_SIZE, IMG_SIZE), batch_size=BATCH, label_mode="categorical")
    class_names = train_ds.class_names  # alphabetical = model output order
    print("MODEL OUTPUT ORDER:", class_names)

    # CCSN is imbalanced (high clouds underrepresented) — weight accordingly.
    counts = [len(os.listdir(os.path.join(data_dir, c))) for c in class_names]
    total, n = sum(counts), len(class_names)
    class_weight = {i: (total / (n * c) if c else 1.0) for i, c in enumerate(counts)}

    autotune = tf.data.AUTOTUNE

    def prep_train(x, y):
        x = tf.image.random_flip_left_right(x)
        x = tf.image.random_brightness(x, 0.1 * 255)
        x = tf.image.random_contrast(x, 0.9, 1.1)
        x = tf.clip_by_value(x, 0.0, 255.0)
        return x / 127.5 - 1.0, y          # -> [-1, 1], matches src/ml/preprocess.ts

    def prep_val(x, y):
        return x / 127.5 - 1.0, y

    train_ds = train_ds.map(prep_train, num_parallel_calls=autotune).prefetch(autotune)
    val_ds = val_ds.map(prep_val, num_parallel_calls=autotune).prefetch(autotune)

    base = MobileNetV2(input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False,
                       weights="imagenet")
    base.trainable = False  # feature extraction first
    model = models.Sequential([
        layers.Input((IMG_SIZE, IMG_SIZE, 3)),  # input is already [-1, 1]
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(len(class_names), activation="softmax"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(1e-3),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs,
              class_weight=class_weight)

    # Fine-tune the top of the backbone for a few epochs at a low LR.
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(optimizer=keras.optimizers.Adam(1e-5),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=args.fine_tune_epochs,
              class_weight=class_weight)

    # Export a TF.js Layers model straight into the app (no SavedModel freezing).
    import tensorflowjs as tfjs
    out = os.path.abspath(args.out)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out, exist_ok=True)
    try:
        tfjs.converters.save_keras_model(model, out)
    except Exception as e:
        print("save_keras_model failed -> H5 + CLI fallback:", e)
        h5 = os.path.join(out, "_model.h5")
        model.save(h5)
        import subprocess
        r = subprocess.run(
            ["tensorflowjs_converter", "--input_format=keras", h5, out],
            capture_output=True, text=True)
        print(r.stdout[-1000:])
        print(r.stderr[-2000:])
        os.remove(h5)
        if r.returncode != 0:
            sys.exit("conversion failed")

    # Write labels in the SAME order the model outputs, for the app to consume.
    with open(os.path.join(out, "labels.json"), "w") as f:
        json.dump({"labels": class_names}, f, indent=2)
    print("Wrote model + labels to", out)
    print("Reload the app — the 'demo model' badge should disappear.")


if __name__ == "__main__":
    main()
