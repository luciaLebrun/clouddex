import { GENUS_BY_ID, ALTITUDE_LABELS } from "../data/genera";
import { LOW_CONFIDENCE, type PredictResult } from "../ml/predict";

interface Props {
  photo: string;
  result: PredictResult;
  isNew: boolean;
  onRetake: () => void;
}

export default function ResultCard({ photo, result, isNew, onRetake }: Props) {
  const top = result.top[0];
  const genus = top ? GENUS_BY_ID[top.id] : undefined;
  const lowConfidence = !top || top.score < LOW_CONFIDENCE;

  return (
    <div className="result">
      <div className="result-photo">
        <img src={photo} alt="Your sky photo" />
        {result.demo && <span className="badge demo">DEMO MODEL</span>}
        {!result.demo && isNew && !lowConfidence && (
          <span className="badge new">NEW!</span>
        )}
      </div>

      {lowConfidence ? (
        <div className="result-body">
          <h2>Not sure about this one 🤔</h2>
          <p className="muted">
            The model isn't confident. Try a clearer shot of the sky — fill the
            frame with cloud, avoid buildings, trees and the sun.
          </p>
          {top && genus && (
            <p className="muted small">
              Closest guess: {genus.name} ({Math.round(top.score * 100)}%)
            </p>
          )}
        </div>
      ) : (
        genus && (
          <div className="result-body">
            <div className="result-title">
              <h2>{genus.name}</h2>
              <span className="confidence">{Math.round(top.score * 100)}%</span>
            </div>
            <p className="latin">
              {genus.latin} · {genus.abbr} · {ALTITUDE_LABELS[genus.altitude]}
            </p>
            <p>{genus.appearance}</p>
            <p className="weather">
              <strong>Weather:</strong> {genus.weather}
            </p>
            <p className="fact">💡 {genus.fact}</p>
          </div>
        )
      )}

      {result.top.length > 1 && (
        <div className="alts">
          <p className="alts-label">Other possibilities</p>
          {result.top.slice(0, 3).map((p) => {
            const g = GENUS_BY_ID[p.id];
            return (
              <div className="alt-row" key={p.id}>
                <span className="alt-name">{g?.name ?? p.id}</span>
                <span className="alt-bar">
                  <span
                    className="alt-bar-fill"
                    style={{ width: `${Math.round(p.score * 100)}%` }}
                  />
                </span>
                <span className="alt-score">{Math.round(p.score * 100)}%</span>
              </div>
            );
          })}
        </div>
      )}

      <button className="primary" onClick={onRetake}>
        Scan another
      </button>
    </div>
  );
}
