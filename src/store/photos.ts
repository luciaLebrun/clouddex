// Account-free storage of the user's *own* catch photos — one per genus — in
// IndexedDB. The lightweight catch metadata (id / date / best score) stays in
// localStorage (see collection.ts); this module only holds the pictures,
// because a handful of full-size JPEG data URLs blows past the localStorage
// quota. Every call is best-effort: private-mode, disabled storage or a
// blocked upgrade all degrade to "no photo", never to a thrown error.
//
// Each record keeps two sizes: `full` (the capture, ~1280 px, for the detail
// sheet) and `thumb` (~320 px, for the collection grid — ten of these paint
// together on tab open, so they must stay cheap to decode).

const DB_NAME = "clouddex";
const DB_VERSION = 1;
const STORE = "catch-photos";

const THUMB_DIM = 320;
const THUMB_QUALITY = 0.72;

export interface CatchPhoto {
  full: string;
  thumb: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/** Normalise a stored value: older builds wrote a bare data-URL string. */
function toCatchPhoto(value: unknown): CatchPhoto | null {
  if (typeof value === "string") return { full: value, thumb: value };
  if (
    value &&
    typeof value === "object" &&
    typeof (value as CatchPhoto).full === "string" &&
    typeof (value as CatchPhoto).thumb === "string"
  ) {
    return value as CatchPhoto;
  }
  return null;
}

/**
 * Downscale a data URL to a grid thumbnail. Resolves to the original on any
 * failure (missing canvas, decode error) — a slightly heavy grid beats none.
 */
export function makeThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest <= THUMB_DIM) {
        resolve(dataUrl);
        return;
      }
      const scale = THUMB_DIM / longest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/jpeg", THUMB_QUALITY));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Store (or replace) the photo a genus was caught with. Resolves either way. */
export async function putCatchPhoto(
  id: string,
  photo: CatchPhoto,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(photo, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Read every stored catch photo as an id -> {full, thumb} map ({} if none). */
export async function getAllCatchPhotos(): Promise<Record<string, CatchPhoto>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    const out: Record<string, CatchPhoto> = {};
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const photo = toCatchPhoto(cursor.value);
          if (photo) out[String(cursor.key)] = photo;
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}
