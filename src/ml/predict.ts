import * as tf from "@tensorflow/tfjs-core";
import { getModel } from "./model";
import { imageToTensor } from "./preprocess";
import type { Prediction, PredictResult } from "./types";

export { LOW_CONFIDENCE, type Prediction, type PredictResult } from "./types";

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
  let logits: tf.Tensor | undefined;
  try {
    logits = model.predict(input) as tf.Tensor;
    // Teachable Machine models already output probabilities; a raw Keras head
    // may output logits. Applying softmax to a probability vector is harmless
    // enough for ranking, but to be safe we only softmax if values fall
    // outside [0, 1].
    const data = Array.from(await logits.data());
    const looksLikeProbs =
      data.every((v) => v >= 0 && v <= 1) &&
      Math.abs(data.reduce((a, b) => a + b, 0) - 1) < 0.05;
    let probs = data;
    if (!looksLikeProbs) {
      const softmaxed = tf.softmax(logits as tf.Tensor1D);
      probs = Array.from(await softmaxed.data());
      tf.dispose(softmaxed);
    }

    const ranked = softmaxToPredictions(probs, labels).slice(0, topK);
    return { top: ranked, demo: false };
  } finally {
    tf.dispose(input);
    if (logits) tf.dispose(logits);
  }
}
