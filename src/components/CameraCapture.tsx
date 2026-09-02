import { useEffect, useRef, useState } from "react";

type Props = Readonly<{
  /** Called with a loaded <img> element ready for classification. */
  onCapture: (img: HTMLImageElement, dataUrl: string) => void;
  busy?: boolean;
  /** Error from the parent (e.g. classification failure) to display here. */
  error?: string | null;
  /** True while the model chunk is still downloading / warming up. */
  modelLoading?: boolean;
  /** True when no real model loaded and identifications are sample data. */
  demo?: boolean;
  /** Focus the shutter on mount (set when returning from a result). */
  focusOnMount?: boolean;
}>;

/**
 * Camera capture via a file input with `capture="environment"`. This is the
 * most reliable cross-browser approach (notably on iOS Safari) and opens the
 * rear camera on phones, while still allowing gallery selection on desktop.
 */

/**
 * A 12 MP phone photo becomes a ~15-20 MB base64 string; we only paint it at
 * ~500px and the classifier resizes to 224px, so cap the longest edge here.
 */
const MAX_PHOTO_DIM = 1280;

/** After this long in the busy state, reassure the user it's still working. */
const SLOW_SCAN_MS = 8000;

function downscale(
  img: HTMLImageElement,
  dataUrl: string,
  done: (img: HTMLImageElement, dataUrl: string) => void,
) {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= MAX_PHOTO_DIM) {
    done(img, dataUrl);
    return;
  }
  const scale = MAX_PHOTO_DIM / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    done(img, dataUrl);
    return;
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const smallUrl = canvas.toDataURL("image/jpeg", 0.85);
  const small = new Image();
  small.onload = () => done(small, smallUrl);
  small.onerror = () => done(img, dataUrl);
  small.src = smallUrl;
}
export default function CameraCapture({
  onCapture,
  busy,
  error,
  modelLoading,
  demo,
  focusOnMount,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const shownError = localError ?? error;

  useEffect(() => {
    if (focusOnMount) shutterRef.current?.focus();
  }, [focusOnMount]);

  // A long wait is almost always the one-time model download + warmup on the
  // first scan of a session. Surface a reassurance rather than a silent spin.
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), SLOW_SCAN_MS);
    return () => clearTimeout(t);
  }, [busy]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => downscale(img, dataUrl, onCapture);
      img.onerror = () =>
        setLocalError("Couldn't read that image. Try another.");
      img.src = dataUrl;
    };
    reader.onerror = () => setLocalError("Couldn't read that file.");
    reader.readAsDataURL(file);

    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
  }

  let label = "Scan the sky";
  if (busy) label = modelLoading ? "Warming up the field guide…" : "Identifying…";

  return (
    <div className="capture">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        hidden
      />
      <button
        ref={shutterRef}
        className={busy ? "shutter busy" : "shutter"}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label="Take a photo of the sky"
      >
        <span className="shutter-ring" />
        <span className="shutter-label">{label}</span>
      </button>
      <p className="capture-hint">
        Point at the clouds and snap a photo — or pick one from your gallery.
      </p>
      {slow && (
        <p className="capture-note" role="status">
          Still working — the first scan of a session takes a little longer while
          the field guide loads.
        </p>
      )}
      {demo && !busy && (
        <p className="capture-note">
          Demo mode: identifications are sample data and aren't saved to your
          collection.
        </p>
      )}
      {shownError && (
        <p className="error" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
