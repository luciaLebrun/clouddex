import * as tf from "@tensorflow/tfjs";
import { getModel } from "./model";
import { imageToTensor } from "./preprocess";

export interface Prediction {
  /** Class id (matches a genus id in src/data/genera.ts). */
  id: string;
  /** Probability 0..1. */
  score: number;
}

export interface PredictResult {
  /** Sorted descending by score. */
  top: Prediction[];
  /** True when no real model is loaded and results are faked. */
  demo: boolean;
}

/** Confidence below this is shown as "not sure / try again". */
export const LOW_CONFIDENCE = 0.4;

function softmaxToPredictions(scores: number[], labels: string[]): Prediction[] {
  return labels
    .map((id, i) => ({ id, score: scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

/** Deterministic fake prediction so the UI is testable without a model. */
function demoPredict(source: HTMLImageElement): PredictResult {
  // Hash the image's natural size to pick a stable pseudo-result.
  const seed = (source.naturalWidth * 31 + source.naturalHeight) % 1000;
  const ids = ["cumulus", "cirrus", "stratocumulus", "cumulonimbus", "altocumulus"];
  const pick = ids[seed % ids.length];
  const main = 0.55 + ((seed % 30) / 100);
  const rest = (1 - main) / 2;
  const top = softmaxToPredictions(
    [main, rest, rest],
    [pick, ids[(seed + 1) % ids.length], ids[(seed + 2) % ids.length]],
  );
  return { top, demo: true };
}

/** Run the classifier on an <img> element and return the top-k predictions. */
export async function classify(
  source: HTMLImageElement,
  topK = 3,
): Promise<PredictResult> {
  const { model, labels, demo } = await getModel();

  if (demo || !model) {
    return demoPredict(source);
  }

  const input = imageToTensor(source);
  try {
    const logits = model.predict(input) as tf.Tensor;
    // Teachable Machine models already output probabilities; a raw Keras head
    // may output logits. Applying softmax to a probability vector is harmless
    // enough for ranking, but to be safe we only softmax if values fall
    // outside [0, 1].
    const data = Array.from(await logits.data());
    const looksLikeProbs =
      data.every((v) => v >= 0 && v <= 1) &&
      Math.abs(data.reduce((a, b) => a + b, 0) - 1) < 0.05;
    const probs = looksLikeProbs
      ? data
      : Array.from(await tf.softmax(logits as tf.Tensor1D).data());
    tf.dispose(logits);

    const ranked = softmaxToPredictions(probs, labels).slice(0, topK);
    return { top: ranked, demo: false };
  } finally {
    tf.dispose(input);
  }
}
