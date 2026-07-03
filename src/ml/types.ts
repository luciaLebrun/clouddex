// Shared prediction types and thresholds, deliberately free of any
// TensorFlow import so UI components can use them without pulling the
// ~2 MB tfjs bundle into the initial chunk. Keep ml/predict.ts and
// ml/model.ts behind dynamic import() only.

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
