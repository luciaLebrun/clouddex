import { ALTITUDE_LABELS, assetUrl, type Genus } from "../data/genera";
import type { CaughtEntry } from "../store/collection";

interface Props {
  genus: Genus;
  caught?: CaughtEntry;
  onClose: () => void;
}

export default function GenusDetail({ genus, caught, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div
          className="sheet-hero"
          style={
            genus.image
              ? { backgroundImage: `url(${assetUrl(genus.image)})` }
              : undefined
          }
        >
          {!caught && <span className="locked-overlay">Not yet caught</span>}
        </div>
        <div className="sheet-body">
          <div className="result-title">
            <h2>{genus.name}</h2>
            <span className="abbr-chip">{genus.abbr}</span>
          </div>
          <p className="latin">
            {genus.latin} · {ALTITUDE_LABELS[genus.altitude]} · {genus.heightText}
          </p>
          <p>{genus.appearance}</p>
          <p className="weather">
            <strong>Weather:</strong> {genus.weather}
          </p>
          <p className="fact">💡 {genus.fact}</p>
          {caught && (
            <p className="muted small">
              Caught {new Date(caught.caughtAt).toLocaleDateString()} · best
              confidence {Math.round(caught.bestScore * 100)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
