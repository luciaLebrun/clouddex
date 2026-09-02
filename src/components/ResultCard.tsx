import { useEffect, useRef } from "react";
import {
  ALTITUDE_LABELS,
  GENUS_BY_ID,
  isCollectible,
} from "../data/genera";
import { LOW_CONFIDENCE, type PredictResult } from "../ml/types";

type Props = Readonly<{
  photo: string;
  result: PredictResult;
  isNew: boolean;
  /** True when the user tabbed away and back to a result already on screen. */
  revisited?: boolean;
  onRetake: () => void;
  onViewCollection: () => void;
}>;

/** The subtitle under the genus name: the altitude band, in plain words. The
 *  Latin genus name is identical to the display name for all 10 genera, so it
 *  is shown only if a future entry's Latin name actually differs; the WMO
 *  abbreviation lives on the detail sheet, not on this celebratory card. */
function metaLine(genus: {
  name: string;
  latin: string;
  altitude: keyof typeof ALTITUDE_LABELS;
}): string {
  const band = ALTITUDE_LABELS[genus.altitude];
  if (genus.latin && genus.latin !== genus.name && genus.latin !== "—") {
    return `${genus.latin} · ${band}`;
  }
  return band;
}

export default function ResultCard({
  photo,
  result,
  isNew,
  revisited,
  onRetake,
  onViewCollection,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const top = result.top[0];
  const genus = top ? GENUS_BY_ID[top.id] : undefined;
  const lowConfidence = !top || top.score < LOW_CONFIDENCE;
  const collectible = !!top && isCollectible(top.id);
  const others = result.top
    .slice(1, 3)
    .map((p) => GENUS_BY_ID[p.id]?.name ?? p.id);

  // Move focus to the result heading so keyboard and screen-reader users land
  // on the answer instead of being dropped at the top of the document when the
  // capture screen unmounts.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="result">
      {revisited && (
        <p className="result-revisit muted small">Your most recent scan.</p>
      )}

      <div className="result-photo">
        <img src={photo} alt="The sky you scanned" width={1280} height={960} />
        {result.demo && <span className="badge demo">DEMO MODEL</span>}
        {!result.demo && isNew && collectible && !lowConfidence && (
          <span className="badge new">NEW!</span>
        )}
      </div>

      {lowConfidence ? (
        <div className="result-body">
          <h2 ref={headingRef} tabIndex={-1}>
            Not sure about this one
          </h2>
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
      ) : !collectible && genus ? (
        <div className="result-body">
          <h2 ref={headingRef} tabIndex={-1}>
            {genus.name}
          </h2>
          <p className="meta">{metaLine(genus)}</p>
          <p>
            A jet's condensation trail, not one of the 10 cloud genera — so
            there's nothing to add to your collection. Still, a sharp eye.
          </p>
          <p className="fact">{genus.fact}</p>
        </div>
      ) : (
        genus && (
          <div className="result-body">
            <div className="result-title">
              <h2 ref={headingRef} tabIndex={-1}>
                {genus.name}
              </h2>
              <span className="confidence">
                {Math.round(top.score * 100)}%
              </span>
            </div>
            <p className="meta">{metaLine(genus)}</p>
            <p>{genus.appearance}</p>
            <p className="weather">
              <strong>Weather:</strong> {genus.weather}
            </p>
            <p className="fact">{genus.fact}</p>
            {isNew && (
              <p className="caught-note">
                Added to your collection.{" "}
                <button
                  type="button"
                  className="linklike"
                  onClick={onViewCollection}
                >
                  View collection
                </button>
              </p>
            )}
            {others.length > 0 && (
              <p className="also muted small">
                Also possible: {others.join(", ")}.
              </p>
            )}
          </div>
        )
      )}

      <button className="primary" onClick={onRetake}>
        Scan another
      </button>
    </div>
  );
}
