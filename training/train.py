"""
Train a cloud-genus classifier with MobileNetV2 transfer learning, then export
to TensorFlow.js for the Clouddex PWA.

This is the "better path" from the project plan. The "fast path" (Google
Teachable Machine, no code) is described in training/README.md.

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

IMPORTANT: the preprocessing here (224x224, normalize to [-1, 1] via
mobilenet_v2.preprocess_input) MUST match src/ml/preprocess.ts in the app.

Usage:
    pip install -r requirements.txt
    python train.py --data ./data --epochs 15
    ./convert.sh              # converts saved_model -> ../public/model/
"""

import argparse
import json
import os

import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

IMG_SIZE = 224
BATCH = 32


def build_datasets(data_dir: str, val_split: float = 0.2):
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="training",
        seed=1337,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH,
        label_mode="categorical",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="validation",
        seed=1337,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH,
        label_mode="categorical",
    )
    class_names = train_ds.class_names  # alphabetical order
    return train_ds, val_ds, class_names


def compute_class_weights(data_dir: str, class_names: list[str]) -> dict[int, float]:
    """CCSN is imbalanced (high clouds underrepresented) — weight accordingly."""
    counts = []
    for name in class_names:
        d = os.path.join(data_dir, name)
        counts.append(len([f for f in os.listdir(d) if not f.startswith(".")]))
    total = sum(counts)
    n = len(class_names)
    return {i: total / (n * c) if c else 1.0 for i, c in enumerate(counts)}


def build_model(num_classes: int) -> tf.keras.Model:
    augment = models.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.05),
            layers.RandomZoom(0.1),
            layers.RandomContrast(0.1),
        ],
        name="augment",
    )

    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False, weights="imagenet"
    )
    base.trainable = False  # feature extraction first

    inputs = layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = augment(inputs)
    x = preprocess_input(x)  # -> [-1, 1], matches src/ml/preprocess.ts
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    model = models.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model, base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="./data")
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--fine-tune-epochs", type=int, default=8)
    ap.add_argument("--out", default="./saved_model")
    args = ap.parse_args()

    train_ds, val_ds, class_names = build_datasets(args.data)
    print("Classes (model output order):", class_names)

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(AUTOTUNE)
    val_ds = val_ds.prefetch(AUTOTUNE)

    class_weight = compute_class_weights(args.data, class_names)
    model, base = build_model(len(class_names))

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        class_weight=class_weight,
    )

    # Fine-tune the top of the backbone for a few epochs at a low LR.
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.fine_tune_epochs,
        class_weight=class_weight,
    )

    os.makedirs(args.out, exist_ok=True)
    model.export(args.out)  # SavedModel for tensorflowjs_converter

    # Write labels in the SAME order the model outputs, for the app to consume.
    labels_path = os.path.join(os.path.dirname(__file__), "labels.json")
    with open(labels_path, "w") as f:
        json.dump({"labels": class_names}, f, indent=2)
    print(f"Wrote {labels_path}. Copy it to ../public/model/labels.json after convert.")


if __name__ == "__main__":
    main()
