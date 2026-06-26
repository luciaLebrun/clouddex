# Training the Clouddex model

The app loads a TensorFlow.js classifier from `public/model/`. Until one exists,
the app runs in **demo mode** (fake predictions, clearly labelled). Pick a path:

- **Train in the cloud (recommended, free GPU)** — open
  [`clouddex_colab.ipynb`](clouddex_colab.ipynb) in Google Colab, set the runtime
  to GPU, run all cells, provide the CCSN dataset when prompted, and download the
  converted model. No local install needed. Steps to upload to Colab: go to
  <https://colab.research.google.com> → File → Upload notebook → pick this file
  (or push the repo to GitHub and open it from the GitHub tab).
- **Train locally** — the Python pipeline below (`run.sh`).
- **No code at all** — Google Teachable Machine (fast path below).

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
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt   # TF 2.16 + tensorflowjs (arm64-ok)

# 1. Put the CCSN dataset under ./data/ (see "Dataset" below).
# 2. One command does the rest — train, convert, place model in ../public/model/:
./run.sh                  # or: ./run.sh --epochs 20
```

`run.sh` auto-renames CCSN's 2-letter folders (Ci, Cu, …) to the full class ids
the app expects, then runs `train.py`. `train.py` trains, exports a TensorFlow.js
**Layers** model straight into `../public/model/`, and writes `labels.json` there
in the model's true output order — so the app stays in sync automatically. (The
old `convert.sh` SavedModel→graph-model step is deprecated; `train.py` does the
TF.js export itself.) After it finishes:

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
- **Where to get it** (verify the live link yourself before downloading):
  - GitHub mirror commonly used: search GitHub for **"CCSN Database"**
    (e.g. the `upuil/CCSN-Database` repository) and download/clone it.
  - Or Harvard Dataverse / the paper's supplementary data — search
    **"CCSN Database cloud classification"**.
- **License**: distributed for **academic / research use**. Fine for this POC.
  Verify the terms before redistributing trained weights commercially.
- **Where to put it:** extract so each class is its own folder under
  `training/data/`. `run.sh` accepts either CCSN's original 2-letter codes
  (`Ci`, `Cu`, …) or the full ids and will rename them for you:

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
High clouds (cirrus family) have fewer samples. `train.py` already applies
class weighting and data augmentation. Expect lower accuracy on subtle high
clouds — that's an inherent difficulty, not a bug. More data is the main lever.

## Enrich the dataset — real sky photos from Wikimedia Commons

`harvest_wikimedia.py` adds real, freely-licensed photos per genus to balance out
CCSN. It walks each WMO genus' Commons category tree (staying on-label — never
pulling a `stratocumulus` subcategory into `cumulus`, etc.), keeps only
**CC0 / public-domain / CC-BY / CC-BY-SA** images (no NC/ND/GFDL), downloads
720px-wide copies into `training/data/<genus>/`, and records every author +
license + source URL to `training/data/_attributions.csv` (feed it into the
top-level `ATTRIBUTIONS.md`).

```bash
cd training
.venv/bin/python harvest_wikimedia.py --per-genus 175        # all 11 genera
.venv/bin/python harvest_wikimedia.py --genera cirrus,cirrostratus --per-genus 100
```

It's idempotent/resumable (skips genera already at target and files already on
disk) and depends only on the stdlib + `certifi`. Review the folders by eye and
delete obvious mislabels/non-sky shots before training — Commons categories are
curated by humans but not perfect.

**Using harvested data on Colab:** `training/data/` is gitignored (don't commit
~hundreds of MB of images). Either zip it and upload to Google Drive, or just run
`harvest_wikimedia.py` *inside* a Colab cell to download straight into
`/content/data` alongside CCSN before training.
