import { useRef, useState } from "react";

interface Props {
  /** Called with a loaded <img> element ready for classification. */
  onCapture: (img: HTMLImageElement, dataUrl: string) => void;
  busy?: boolean;
  /** Error from the parent (e.g. classification failure) to display here. */
  error?: string | null;
}

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
export default function CameraCapture({ onCapture, busy, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;

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
        className="shutter"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Take a photo of the sky"
      >
        <span className="shutter-ring" />
        <span className="shutter-label">
          {busy ? "Identifying…" : "Scan the sky"}
        </span>
      </button>
      <p className="capture-hint">
        Point at the clouds and snap a photo — or pick one from your gallery.
      </p>
      {shownError && (
        <p className="error" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
