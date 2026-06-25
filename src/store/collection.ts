// Local, account-free persistence of which genera the user has "caught".
// Stored in localStorage as a map of genus id -> first-caught info.

const KEY = "clouddex.collection.v1";

export interface CaughtEntry {
  id: string;
  caughtAt: number; // epoch ms
  bestScore: number; // best confidence seen, 0..1
}

export type Collection = Record<string, CaughtEntry>;

export function loadCollection(): Collection {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Collection) : {};
  } catch {
    return {};
  }
}

function save(c: Collection) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage may be full or blocked; non-fatal */
  }
}

/**
 * Record a successful catch. Returns the updated collection and whether this
 * was a brand-new genus (so the UI can celebrate a first catch).
 */
export function recordCatch(
  id: string,
  score: number,
): { collection: Collection; isNew: boolean } {
  const c = loadCollection();
  const existing = c[id];
  const isNew = !existing;
  c[id] = {
    id,
    caughtAt: existing?.caughtAt ?? Date.now(),
    bestScore: Math.max(existing?.bestScore ?? 0, score),
  };
  save(c);
  return { collection: c, isNew };
}
