import * as tf from "@tensorflow/tfjs";

// ---------------------------------------------------------------------------
// SHARED preprocessing constants.
//
// These MUST exactly match what the model was trained on. MobileNetV2 (the
// default backbone for both the Teachable Machine "fast path" and the Keras
// "better path") expects 224x224 RGB images normalized to the range [-1, 1].
//
// If you train with a different input size or normalization, change it HERE and
// mirror the same change in training/train.py. Mismatched preprocessing is the
// single most common cause of "the model returns nonsense" — keep them in sync.
// ---------------------------------------------------------------------------

export const INPUT_SIZE = 224;

/** Normalization mode. "neg1to1" = (x/127.5 - 1); "zeroToOne" = x/255. */
export type NormMode = "neg1to1" | "zeroToOne";
export const NORM_MODE: NormMode = "neg1to1";

/**
 * Turn an image/canvas/video element into a normalized [1, 224, 224, 3] tensor
 * ready for the model. Caller is responsible for disposing the returned tensor
 * (or wrapping the call in tf.tidy).
 */
export function imageToTensor(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
): tf.Tensor4D {
  return tf.tidy(() => {
    let img = tf.browser.fromPixels(source).toFloat();
    // Resize with bilinear interpolation to the model's expected size.
    img = tf.image.resizeBilinear(img, [INPUT_SIZE, INPUT_SIZE]);
    const normalized =
      NORM_MODE === "neg1to1" ? img.div(127.5).sub(1) : img.div(255);
    return normalized.expandDims(0) as tf.Tensor4D;
  });
}
