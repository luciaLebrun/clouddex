import { useEffect, useState } from "react";
import CameraCapture from "./components/CameraCapture";
import ResultCard from "./components/ResultCard";
import Clouddex from "./components/Clouddex";
import { LOW_CONFIDENCE, type PredictResult } from "./ml/types";
import { GENUS_BY_ID, isCollectible } from "./data/genera";
import { BookIcon, CameraIcon, CloudIcon } from "./components/Icons";
import {
  loadCollection,
  recordCatch,
  type Collection,
} from "./store/collection";
import {
  getAllCatchPhotos,
  makeThumbnail,
  putCatchPhoto,
  type CatchPhoto,
} from "./store/photos";

/** After this long mid-scan, reassure the user it's still working. */
const SLOW_SCAN_MS = 8000;

type Tab = "scan" | "dex";
type ModelStatus = "loading" | "ready" | "demo";

interface ScanState {
  photo: string;
  result: PredictResult;
  isNew: boolean;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("scan");
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [everScanned, setEverScanned] = useState(false);
  const [resultRevisited, setResultRevisited] = useState(false);
  const [slowScan, setSlowScan] = useState(false);
  const [collection, setCollection] = useState<Collection>(() =>
    loadCollection(),
  );
  const [photos, setPhotos] = useState<Record<string, CatchPhoto>>({});
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const demoModel = modelStatus === "demo";

  // Load the ML chunk (tfjs + model + warmup) in the background right after
  // first paint. Dynamic import keeps the ~2 MB of TensorFlow.js out of the
  // initial bundle so the shell renders instantly.
  useEffect(() => {
    let cancelled = false;
    import("./ml/model")
      .then((mod) => mod.getModel())
      .then((m) => {
        if (!cancelled) setModelStatus(m.demo ? "demo" : "ready");
      })
      .catch(() => {
        if (!cancelled) setModelStatus("demo");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rehydrate the user's own catch photos from IndexedDB (best-effort).
  useEffect(() => {
    let cancelled = false;
    getAllCatchPhotos().then((p) => {
      if (!cancelled) setPhotos(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A long wait is almost always the one-time model download + warmup on the
  // first scan of a session. One timer, one announcement — the capture screen
  // reads `slowScan` for its visual note (it is not a second live region).
  useEffect(() => {
    if (!busy) {
      setSlowScan(false);
      return;
    }
    const t = setTimeout(() => setSlowScan(true), SLOW_SCAN_MS);
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    if (slowScan) {
      setAnnounce("Still working on it — the first scan of a session takes longer.");
    }
  }, [slowScan]);

  async function handleCapture(img: HTMLImageElement, dataUrl: string) {
    setBusy(true);
    setScanError(null);
    setEverScanned(true);
    setResultRevisited(false);
    setAnnounce("Identifying cloud…");
    try {
      // Already warm in the module cache by now (kicked off on mount).
      const { classify } = await import("./ml/predict");
      const result = await classify(img);
      const top = result.top[0];
      let isNew = false;
      // Only "catch" a confident, real (non-demo) identification of one of the
      // 10 collectible genera — never a contrail, never a demo guess.
      if (
        top &&
        top.score >= LOW_CONFIDENCE &&
        !result.demo &&
        isCollectible(top.id)
      ) {
        const r = recordCatch(top.id, top.score);
        setCollection(r.collection);
        isNew = r.isNew;
        // Keep the photo aligned with `bestScore`: only replace it when this
        // identification beats every earlier one (a re-catch at lower
        // confidence shouldn't overwrite your best shot).
        if (r.isBest) {
          const caughtId = top.id;
          void (async () => {
            const thumb = await makeThumbnail(dataUrl);
            const photo: CatchPhoto = { full: dataUrl, thumb };
            setPhotos((p) => ({ ...p, [caughtId]: photo }));
            await putCatchPhoto(caughtId, photo);
          })();
        }
      }
      setScan({ photo: dataUrl, result, isNew });
      if (!top || top.score < LOW_CONFIDENCE) {
        setAnnounce("Not sure about this one. Try a clearer shot of the sky.");
      } else if (!isCollectible(top.id)) {
        setAnnounce(
          "That's a contrail — a jet's condensation trail, not one of the 10 cloud genera.",
        );
      } else {
        const name = GENUS_BY_ID[top.id]?.name ?? top.id;
        const pct = Math.round(top.score * 100);
        setAnnounce(
          `${isNew ? "New catch! " : ""}Identified ${name}, ${pct} percent confidence.`,
        );
      }
    } catch {
      setScanError(
        "Something went wrong while identifying that photo. Try again with another shot.",
      );
      setAnnounce("");
    } finally {
      setBusy(false);
    }
  }

  function openDex() {
    if (scan) setResultRevisited(true);
    setTab("dex");
  }

  function retake() {
    setScan(null);
    setResultRevisited(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="logo">
            <CloudIcon size={22} />
          </span>
          Clouddex
        </h1>
        {demoModel && <span className="demo-pill">demo model</span>}
      </header>

      <main className="content">
        {tab === "scan" ? (
          scan ? (
            <ResultCard
              photo={scan.photo}
              result={scan.result}
              isNew={scan.isNew}
              revisited={resultRevisited}
              onRetake={retake}
              onViewCollection={openDex}
            />
          ) : (
            <CameraCapture
              onCapture={handleCapture}
              busy={busy}
              error={scanError}
              modelLoading={modelStatus === "loading"}
              slow={slowScan}
              demo={demoModel}
              focusOnMount={everScanned}
            />
          )
        ) : (
          <Clouddex
            collection={collection}
            photos={photos}
            onGoScan={() => setTab("scan")}
          />
        )}
      </main>

      <div className="sr-only" role="status">
        {announce}
      </div>

      <nav className="tabbar">
        <button
          className={tab === "scan" ? "active" : ""}
          aria-current={tab === "scan" ? "page" : undefined}
          onClick={() => setTab("scan")}
        >
          <CameraIcon />
          Scan
        </button>
        <button
          className={tab === "dex" ? "active" : ""}
          aria-current={tab === "dex" ? "page" : undefined}
          onClick={openDex}
        >
          <BookIcon />
          Collection
        </button>
      </nav>
    </div>
  );
}
