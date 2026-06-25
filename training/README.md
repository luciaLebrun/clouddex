# Training the Clouddex model

The app loads a TensorFlow.js classifier from `public/model/`. Until one exists,
the app runs in **demo mode** (fake predictions, clearly labelled). There are
two ways to produce a real model — start with the fast path.

## Fast path — Google Teachable Machine (no code, ~1 hour)

1. Get the **CCSN** dataset (see "Dataset" below) and unzip it so you have one
   folder of images per class.
2. Go to <https://teachablemachine.withgoogle.com> → **Image Project** →
   **Standard image model**.
3. Create one class per cloud genus. **Name each class exactly** like the `id`
   values in `src/data/genera.ts` (e.g. `cumulus`, `cirrostratus`). Upload the
   matching CCSN images into each class.
4. **Train**, then **Export Model → TensorFlow.js → Download**.
5. Unzip the download and copy `model.json` + the `*.bin` weight shard(s) and
   `metadata.json` into `public/model/`.
6. Open `public/model/metadata.json`, read its `labels` array, and make
   `public/model/labels.json` contain those labels **in the same order**:
   `{ "labels": ["cumulus", ...] }`.
7. Reload the app — the "demo model" badge disappears.

> Teachable Machine exports a Keras LayersModel; the app's `model.ts` loads it
> with `tf.loadLayersModel` automatically. Its preprocessing (224×224, [-1,1])
> already matches `src/ml/preprocess.ts`.

## Better path — Python / Keras (higher accuracy on 10 genera)

```bash
cd training
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Arrange CCSN as data/<class_name>/*.jpg (one folder per genus), then:
python train.py --data ./data --epochs 15
./convert.sh        # exports tfjs graph model + labels into ../public/model/
```

`train.py` writes `labels.json` in the model's true output order and `convert.sh`
copies it next to the model, so the app stays in sync automatically.

## Dataset — CCSN (Cirrus Cumulus Stratus Nimbus Database)

- ~2,543 ground-based sky images, 256×256, 11 classes: Ci, Cs, Cc, Ac, As, Cu,
  Cb, Ns, Sc, St, Ct (contrail) — a direct match for the 10 WMO genera (+ a
  bonus contrail class).
- Published with: J. Zhang et al., "CloudNet: Ground-Based Cloud Classification
  With Deep Convolutional Neural Network", *Geophysical Research Letters*, 2018.
- Find it via the paper's GitHub release or Harvard Dataverse (search
  "CCSN Database cloud").
- **License**: distributed for **academic / research use**. Fine for this POC.
  Verify the terms before redistributing trained weights commercially.
- The folder names you create become the class labels — name them to match the
  `id` values in `src/data/genera.ts`. CCSN ships with 2-letter codes (Ci, Cu…);
  rename the folders to the full ids (`cirrus`, `cumulus`, …) before training.

### Class imbalance
High clouds (cirrus family) have fewer samples. `train.py` already applies
class weighting and data augmentation. Expect lower accuracy on subtle high
clouds — that's an inherent difficulty, not a bug. More data is the main lever.
