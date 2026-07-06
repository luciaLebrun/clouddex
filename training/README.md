# Training the Clouddex model

The app loads a TensorFlow.js classifier from `public/model/`. Until one exists,
the app runs in **demo mode** (fake predictions, clearly labelled). Pick a path:

- **Colab, one click (recommended, free GPU)** — see below. Open the notebook,
  Runtime → **Run all**, wait, download the model. No uploads, no credentials,
  no local install.
- **Train locally** — the Python pipeline below (`run.sh`); simpler baseline
  recipe, useful without a GPU quota.
- **No code at all** — Google Teachable Machine (fast path below).

## Recommended path — Colab, one click

1. Open [`clouddex_colab.ipynb`](clouddex_colab.ipynb) in Google Colab
   (<https://colab.research.google.com> → File → Upload notebook → pick this
   file, or open it from the GitHub tab). The notebook requests a **T4 GPU**
   runtime by itself.
2. Runtime → **Run all**. That's the only step. The notebook:
   - installs a **pinned known-good environment** (TF 2.16.2 + `tf_keras` +
     `tensorflowjs` 4.22 + NumPy 1.26 — the combo where training *and* the
     TF.js export both work, no mid-notebook restart);
   - **auto-downloads CCSN** (~95 MB, CC0) from a GitHub mirror with the
     official Harvard Dataverse as fallback — no Kaggle keys, no form;
   - **enriches** each genus with freely-licensed Wikimedia Commons photos
     (`harvest_wikimedia.py`, attribution CSV included) and **removes
     near-duplicates** before the train/val split;
   - trains **EfficientNetV2-B0** two-stage (frozen-backbone head warm-up,
     then full fine-tune with BatchNorm frozen) with AdamW, warmup + cosine
     LR, label smoothing, mixup, class-weighted loss, augmentation, mixed
     precision, best-checkpoint saving and early stopping;
   - prints a **per-class report + confusion matrix** (with flip TTA);
   - exports a **float16-quantized TF.js Layers model (~12 MB)** and downloads
     `clouddex_model.zip` in your browser.
3. Unzip `clouddex_model.zip` (`model.json`, `group1-shard*.bin`,
   `labels.json`) into the repo's **`public/model/`**, then:

   ```bash
   git add public/model && git commit -m "Add trained model" && git push
   ```

   The push triggers the GitHub Actions deploy; the live site loses the
   "demo model" badge.

Total ≈ 60–90 min on a free T4. All knobs (backbone, epochs, augmentation,
Commons images per genus, float16 quantization, …) live in the single
**CONFIG cell** at the top of the notebook. Set `DRIVE_BACKUP = True` there to
persist the best checkpoint to Google Drive (one extra auth click) so a full VM
reset doesn't lose training; otherwise re-running **Run all** after a disconnect
resumes from the on-disk checkpoint and the idempotent dataset downloads.

### Why EfficientNetV2-B0 + Keras 2 (verified, don't "simplify")

- **Keras 2 (`tf_keras`), not Keras 3.** Keras 3 `model.export()` SavedModels
  break the TF.js converter ("Identity is not in graph").
- **EfficientNetV2-B0 with `include_preprocessing=False`.** It takes `[-1, 1]`
  input directly — matching `src/ml/preprocess.ts` — and converts to a TF.js
  **Layers** model that was confirmed to load and predict with the app's
  `@tensorflow/tfjs-layers`. MobileNetV3 does **not** convert: its hard-swish
  serializes as a `TFOpLambda` layer TF.js can't deserialize. `mobilenetv2` is
  kept as a fallback backbone in the CONFIG cell.
- **Normalize in the data pipeline, not the model.** Putting a Rescaling /
  `preprocess_input` layer in the graph and normalizing again in
  `preprocess.ts` double-normalizes — the #1 silent-failure mode.
- **NumPy 1.26 pin.** NumPy ≥1.24 removed `np.object`/`np.bool` aliases some
  `tensorflowjs` builds reference at import; the export cells also restore them
  defensively.

### Accuracy: recipe and realistic expectation

Published CCSN results cluster at **88–91%** for 11-class CNNs — CloudNet ~89%
([Zhang et al., 2018](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2018GL077787)),
CloudDenseNet 90.7%
([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10537665/)), ALGA-DenseNet
97.3% with heavy augmentation
([PLOS One](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0333999)).
[Kopeć, 2024](https://rmets.onlinelibrary.wiley.com/doi/full/10.1002/qj.4865)
finds ConvNeXt ≳ EfficientNet ≳ ResNet (ViT best) for ground-based clouds.
Many of these numbers use leaky random splits over a dataset with near
duplicates, so they are optimistic. This notebook **de-duplicates before the
split**, which lowers but truthifies the number. With EfficientNetV2-B0, the
two-stage fine-tune, strong augmentation + mixup + label smoothing, class
weights, and Commons enrichment, **≥80% honest validation accuracy is a
realistic target** (the old MobileNetV2 recipe plateaued at ~60–62%). The
[TF.js Rescaling-layer issue](https://github.com/tensorflow/tfjs/issues/3728)
is why the backbone is built with `include_preprocessing=False`. CCSN itself is
[Harvard Dataverse, CC0](https://doi.org/10.7910/DVN/CADDPD).

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

## Better path — Python / Keras (local, no GPU quota needed)

```bash
cd training
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt   # TF 2.16 + tensorflowjs (arm64-ok)

# 1. Put the CCSN dataset under ./data/ (see "Dataset" below).
# 2. One command does the rest — train, convert, place model in ../public/model/:
./run.sh                  # or: ./run.sh --epochs 20
```

`run.sh` auto-renames CCSN's 2-letter folders (Ci, Cu, …) to the full class ids
the app expects, then runs `train.py`. `train.py` trains a MobileNetV2 baseline,
exports a TensorFlow.js **Layers** model straight into `../public/model/`, and
writes `labels.json` there in the model's true output order — so the app stays
in sync automatically. (This local path uses the simpler baseline recipe; the
higher-accuracy EfficientNetV2 recipe lives in the Colab notebook above.) After
it finishes:

```bash
cd .. && npm run dev          # confirm the "demo model" badge is gone
git add public/model && git commit -m "Add trained model" && git push
```

The push triggers the GitHub Actions deploy, so the live site updates with the
real model.

## Dataset — CCSN (Cirrus Cumulus Stratus Nimbus Database)

- ~2,543 ground-based sky images, 256×256, 11 classes: Ci, Cs, Cc, Ac, As, Cu,
  Cb, Ns, Sc, St, Ct (contrail) — a direct match for the 10 WMO genera (+ a
  bonus contrail class).
- Published with: J. Zhang et al., "CloudNet: Ground-Based Cloud Classification
  With Deep Convolutional Neural Network", *Geophysical Research Letters*, 2018.
- **License**: CC0 1.0 (public domain) on Harvard Dataverse. Fine for this app.
- **The Colab notebook downloads it for you** (GitHub mirror →
  <https://doi.org/10.7910/DVN/CADDPD> fallback). For the local path, fetch it
  manually and extract so each class is its own folder under `training/data/`.
  `run.sh` accepts either CCSN's original 2-letter codes (`Ci`, `Cu`, …) or the
  full ids and will rename them for you:

  ```
  training/data/
    Ci/  *.jpg     (or cirrus/)
    Cs/  ...        cirrostratus/
    Cc/  ...        cirrocumulus/
    Ac/  ...        altocumulus/
    As/  ...        altostratus/
    Cu/  ...        cumulus/
    Cb/  ...        cumulonimbus/
    Ns/  ...        nimbostratus/
    Sc/  ...        stratocumulus/
    St/  ...        stratus/
    Ct/  ...        contrail/
  ```

### Class imbalance
High clouds (cirrus family) have fewer samples. Both the Colab notebook and
`train.py` apply class weighting and augmentation. The Colab recipe additionally
uses mixup, label smoothing, and Commons enrichment to help the sparse classes.

## Enrich the dataset — real sky photos from Wikimedia Commons

`harvest_wikimedia.py` adds real, freely-licensed photos per genus to balance
out CCSN (the Colab notebook runs it for you). It walks each WMO genus' Commons
category tree (staying on-label — never pulling a `stratocumulus` subcategory
into `cumulus`, etc.), keeps only **CC0 / public-domain / CC-BY / CC-BY-SA**
images (no NC/ND/GFDL), downloads 720px-wide copies into `training/data/<genus>/`,
and records every author + license + source URL to `training/data/_attributions.csv`
(feed it into the top-level `ATTRIBUTIONS.md`).

```bash
cd training
.venv/bin/python harvest_wikimedia.py --per-genus 175        # all 11 genera
.venv/bin/python harvest_wikimedia.py --genera cirrus,cirrostratus --per-genus 100
```

It's idempotent/resumable (skips genera already at target and files already on
disk), re-encodes every download to a clean RGB JPEG, and is polite to the API —
backs off and honors `Retry-After` on HTTP 429/503, with `--delay` (default
0.3s) between downloads. Needs `certifi` + `Pillow` (both in requirements.txt;
preinstalled on Colab). Review the folders by eye and delete obvious
mislabels/non-sky shots before training — Commons categories are curated by
humans but not perfect.