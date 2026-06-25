"""
Self-contained Colab training script for Clouddex.

Designed to be fetched and run in Colab without copy-pasting code (which mangles
long lines). It assumes the CCSN dataset is already extracted under /content/data
(any nesting / Mac-zip layout is handled), trains a MobileNetV2 classifier with
Keras 2 (tf_keras), and exports a TensorFlow.js *Layers* model to
/content/web_model, zipped at /content/clouddex_model.zip.

Usage in a Colab cell:
    !wget -qO colab_train.py https://raw.githubusercontent.com/luciaLebrun/clouddex/main/training/colab_train.py
    !python colab_train.py
Then, in a second cell, trigger the browser download:
    from google.colab import files; files.download("/content/clouddex_model.zip")

Preprocessing (normalize to [-1, 1] in the data pipeline; model takes [-1,1]
directly) matches src/ml/preprocess.ts in the app.
"""
import json
import os
import shutil
import subprocess
import sys

IMG_SIZE = 224
BATCH = 32
DATA_ROOT = "/content/data"
OUT_DIR = "/content/web_model"
ZIP_PATH = "/content/clouddex_model"

CCSN_MAP = {
    "Ci": "cirrus", "Cs": "cirrostratus", "Cc": "cirrocumulus",
    "Ac": "altocumulus", "As": "altostratus", "Cu": "cumulus",
    "Cb": "cumulonimbus", "Ns": "nimbostratus", "Sc": "stratocumulus",
    "St": "stratus", "Ct": "contrail",
}


def pip_install():
    print(">> installing tf_keras + tensorflowjs ...", flush=True)
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-q", "tf_keras", "tensorflowjs"],
        check=True,
    )


def has_images(d):
    try:
        return any(
            f.lower().endswith((".jpg", ".jpeg", ".png")) for f in os.listdir(d)
        )
    except OSError:
        return False


def find_class_root(base):
    cur = base
    for _ in range(6):
        subs = [
            d for d in os.listdir(cur)
            if os.path.isdir(os.path.join(cur, d)) and not d.startswith("__")
        ]
        if len(subs) >= 2 and any(has_images(os.path.join(cur, s)) for s in subs):
            return cur
        if len(subs) == 1:
            cur = os.path.join(cur, subs[0])
            continue
        return cur
    return cur


def prepare(data_dir):
    """Idempotent: remove Mac junk, rename CCSN codes, drop bad files."""
    import tensorflow as tf
    from PIL import Image, ImageFile
    ImageFile.LOAD_TRUNCATED_IMAGES = False

    shutil.rmtree(os.path.join(DATA_ROOT, "__MACOSX"), ignore_errors=True)

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
    pip_install()
    os.environ["TF_USE_LEGACY_KERAS"] = "1"

    import tensorflow as tf
    import tf_keras as keras
    from tf_keras import layers, models
    from tf_keras.applications import MobileNetV2

    gpus = tf.config.list_physical_devices("GPU")
    print("TF", tf.__version__, "| GPU:", gpus if gpus else "NONE (slow)")

    if not os.path.isdir(DATA_ROOT):
        sys.exit(f"ERROR: {DATA_ROOT} not found — upload/extract the CCSN dataset there first.")

    data_dir = find_class_root(DATA_ROOT)
    print("DATA_DIR =", data_dir)
    prepare(data_dir)

    train_ds = keras.utils.image_dataset_from_directory(
        data_dir, validation_split=0.2, subset="training", seed=1337,
        image_size=(IMG_SIZE, IMG_SIZE), batch_size=BATCH, label_mode="categorical")
    val_ds = keras.utils.image_dataset_from_directory(
        data_dir, validation_split=0.2, subset="validation", seed=1337,
        image_size=(IMG_SIZE, IMG_SIZE), batch_size=BATCH, label_mode="categorical")
    class_names = train_ds.class_names
    print("MODEL OUTPUT ORDER:", class_names)

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
    base.trainable = False
    model = models.Sequential([
        layers.Input((IMG_SIZE, IMG_SIZE, 3)),
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(len(class_names), activation="softmax"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(1e-3),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=15, class_weight=class_weight)

    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(optimizer=keras.optimizers.Adam(1e-5),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=8, class_weight=class_weight)

    # Export a TF.js Layers model (no SavedModel freezing).
    import tensorflowjs as tfjs
    shutil.rmtree(OUT_DIR, ignore_errors=True)
    try:
        tfjs.converters.save_keras_model(model, OUT_DIR)
    except Exception as e:
        print("save_keras_model failed -> H5 + CLI fallback:", e)
        model.save("/content/model.h5")
        r = subprocess.run(
            ["tensorflowjs_converter", "--input_format=keras",
             "/content/model.h5", OUT_DIR],
            capture_output=True, text=True)
        print(r.stdout[-1000:])
        print(r.stderr[-2000:])
        if r.returncode != 0:
            sys.exit("conversion failed")

    json.dump({"labels": class_names}, open(os.path.join(OUT_DIR, "labels.json"), "w"),
              indent=2)
    shutil.make_archive(ZIP_PATH, "zip", OUT_DIR)
    print("web_model:", os.listdir(OUT_DIR))
    print("DONE -> %s.zip  (run files.download on it in the next cell)" % ZIP_PATH)


if __name__ == "__main__":
    main()
