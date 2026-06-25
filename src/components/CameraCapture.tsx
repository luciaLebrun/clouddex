import { useRef, useState } from "react";

interface Props {
  /** Called with a loaded <img> element ready for classification. */
  onCapture: (img: HTMLImageElement, dataUrl: string) => void;
  busy?: boolean;
}

/**
 * Camera capture via a file input with `capture="environment"`. This is the
 * most reliable cross-browser approach (notably on iOS Safari) and opens the
 * rear camera on phones, while still allowing gallery selection on desktop.
 */
export default function CameraCapture({ onCapture, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => onCapture(img, dataUrl);
      img.onerror = () => setError("Couldn't read that image. Try another.");
      img.src = dataUrl;
    };
    reader.onerror = () => setError("Couldn't read that file.");
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
      {error && <p className="error">{error}</p>}
    </div>
  );
}
