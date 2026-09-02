import { useEffect, useRef } from "react";
import { ALTITUDE_LABELS, assetUrl, type Genus } from "../data/genera";
import type { CaughtEntry } from "../store/collection";
import { CloseIcon } from "./Icons";

type Props = Readonly<{
  genus: Genus;
  caught?: CaughtEntry;
  /** The user's own catch photo, when they have one stored. */
  photo?: string;
  onClose: () => void;
}>;

/**
 * Bottom sheet built on the native <dialog> element: modal focus trapping,
 * Escape-to-close and focus restore to the opener all come from the platform.
 */
export default function GenusDetail({ genus, caught, photo, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // The user's own catch photo wins; the reference image is the fallback for
  // older catches and for genera not yet caught.
  const heroImage =
    photo ?? (genus.image ? assetUrl(genus.image) : undefined);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    // Clicks on ::backdrop are dispatched to the dialog element itself.
    if (e.target === e.currentTarget) ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="genus-title"
      onClose={onClose}
      onClick={handleClick}
    >
      <button
        className="sheet-close"
        onClick={() => ref.current?.close()}
        aria-label="Close"
      >
        <CloseIcon />
      </button>
      <div
        className="sheet-hero"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        {!caught && <span className="locked-overlay">Not yet caught</span>}
      </div>
      <div className="sheet-body">
        <div className="result-title">
          <h2 id="genus-title">{genus.name}</h2>
          <span className="abbr-chip">{genus.abbr}</span>
        </div>
        <p className="meta">
          {ALTITUDE_LABELS[genus.altitude]} · {genus.heightText}
        </p>
        <p>{genus.appearance}</p>
        <p className="weather">
          <strong>Weather:</strong> {genus.weather}
        </p>
        <p className="fact">{genus.fact}</p>
        {caught && (
          <p className="muted small">
            Caught {new Date(caught.caughtAt).toLocaleDateString()} · best
            confidence {Math.round(caught.bestScore * 100)}%
          </p>
        )}
      </div>
    </dialog>
  );
}
