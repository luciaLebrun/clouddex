import * as tf from "@tensorflow/tfjs-core";
// Register the WebGL backend (fast path) and the pure-CPU backend (fallback
// when WebGL is unavailable). Importing the scoped packages instead of the
// "@tensorflow/tfjs" umbrella keeps tfjs-data & co. out of the bundle.
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import { loadLayersModel, type LayersModel } from "@tensorflow/tfjs-layers";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import { INPUT_SIZE } from "./preprocess";

// ---------------------------------------------------------------------------
// Model loading.
//
// The classifier is a drop-in asset served from /model/model.json (+ *.bin
// shards). It can be produced either by Google Teachable Machine (export ->
// TensorFlow.js) or by the Python/Keras pipeline in training/. We try both
// model formats so either export works without code changes.
//
// If no model is present yet (you haven't trained one), the app falls back to
// DEMO MODE so the whole UI/flow is still testable. Demo mode returns a
// deterministic-but-fake prediction and is clearly labelled in the UI.
// ---------------------------------------------------------------------------

export interface LoadedModel {
  model: LayersModel | GraphModel | null;
  labels: string[];
  demo: boolean;
}

const MODEL_URL = `${import.meta.env.BASE_URL}model/model.json`;
const LABELS_URL = `${import.meta.env.BASE_URL}model/labels.json`;

let cached: Promise<LoadedModel> | null = null;

async function loadLabels(): Promise<string[]> {
  try {
    const res = await fetch(LABELS_URL);
    if (!res.ok) throw new Error(`labels ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json?.labels)) return json.labels as string[];
  } catch {
    /* fall through to empty */
  }
  return [];
}

async function tryLoadModel(): Promise<LayersModel | GraphModel | null> {
  // Teachable Machine and Keras `tfjs` exports are LayersModels; the
  // tensorflowjs graph converter produces GraphModels. Try both.
  try {
    return await loadLayersModel(MODEL_URL);
  } catch {
    try {
      return await loadGraphModel(MODEL_URL);
    } catch {
      return null;
    }
  }
}

/** Load (once) and warm up the model. Safe to call repeatedly. */
export function getModel(): Promise<LoadedModel> {
  if (cached) return cached;

  cached = (async () => {
    await tf.ready();
    // Prefer the WebGL backend (fast on mobile GPUs); tfjs falls back to wasm
    // or cpu automatically if WebGL is unavailable.
    try {
      await tf.setBackend("webgl");
    } catch {
      /* keep default backend */
    }

    const [labels, model] = await Promise.all([loadLabels(), tryLoadModel()]);

    if (!model || labels.length === 0) {
      return { model: null, labels, demo: true };
    }

    // Warm up so the first real prediction isn't slow. `await data()` instead
    // of `dataSync()` keeps the main thread free during the GPU readback.
    try {
      const warm = tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3]);
      const out = (model as LayersModel).predict(warm) as tf.Tensor;
      await out.data();
      tf.dispose([warm, out]);
    } catch {
      /* warmup is best-effort */
    }

    return { model, labels, demo: false };
  })();

  return cached;
}
