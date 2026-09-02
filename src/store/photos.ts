// Account-free storage of the user's *own* catch photos — one per genus — in
// IndexedDB. The lightweight catch metadata (id / date / best score) stays in
// localStorage (see collection.ts); this module only holds the pictures,
// because a handful of downscaled JPEG data URLs blows past the localStorage
// quota. Every call is best-effort: private-mode, disabled storage or a
// blocked upgrade all degrade to "no photo", never to a thrown error.

const DB_NAME = "clouddex";
const DB_VERSION = 1;
const STORE = "catch-photos";

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

/** Store (or replace) the photo a genus was caught with. Resolves either way. */
export async function putCatchPhoto(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Read every stored catch photo as an id -> data-URL map ({} if unavailable). */
export async function getAllCatchPhotos(): Promise<Record<string, string>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    const out: Record<string, string> = {};
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (typeof cursor.value === "string") {
            out[String(cursor.key)] = cursor.value;
          }
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
