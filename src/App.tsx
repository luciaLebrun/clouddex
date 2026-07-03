import { useEffect, useState } from "react";
import CameraCapture from "./components/CameraCapture";
import ResultCard from "./components/ResultCard";
import Clouddex from "./components/Clouddex";
import { LOW_CONFIDENCE, type PredictResult } from "./ml/types";
import { GENUS_BY_ID } from "./data/genera";
import { BookIcon, CameraIcon, CloudIcon } from "./components/Icons";
import {
  loadCollection,
  recordCatch,
  type Collection,
} from "./store/collection";

type Tab = "scan" | "dex";

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
  const [collection, setCollection] = useState<Collection>(() =>
    loadCollection(),
  );
  const [demoModel, setDemoModel] = useState(false);

  // Load the ML chunk (tfjs + model + warmup) in the background right after
  // first paint. Dynamic import keeps the ~2 MB of TensorFlow.js out of the
  // initial bundle so the shell renders instantly.
  useEffect(() => {
    import("./ml/model")
      .then((mod) => mod.getModel())
      .then((m) => setDemoModel(m.demo))
      .catch(() => setDemoModel(true));
  }, []);

  async function handleCapture(img: HTMLImageElement, dataUrl: string) {
    setBusy(true);
    setScanError(null);
    setAnnounce("Identifying cloud…");
    try {
      // Already warm in the module cache by now (kicked off on mount).
      const { classify } = await import("./ml/predict");
      const result = await classify(img);
      const top = result.top[0];
      let isNew = false;
      // Only "catch" a confident, real (non-demo) identification.
      if (top && top.score >= LOW_CONFIDENCE && !result.demo) {
        const r = recordCatch(top.id, top.score);
        setCollection(r.collection);
        isNew = r.isNew;
      }
      setScan({ photo: dataUrl, result, isNew });
      if (!top || top.score < LOW_CONFIDENCE) {
        setAnnounce("Not sure about this one. Try a clearer shot of the sky.");
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
              onRetake={() => setScan(null)}
            />
          ) : (
            <CameraCapture
              onCapture={handleCapture}
              busy={busy}
              error={scanError}
            />
          )
        ) : (
          <Clouddex collection={collection} />
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
          onClick={() => setTab("dex")}
        >
          <BookIcon />
          Clouddex
        </button>
      </nav>
    </div>
  );
}
