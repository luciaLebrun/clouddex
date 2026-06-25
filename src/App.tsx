import { useEffect, useState } from "react";
import CameraCapture from "./components/CameraCapture";
import ResultCard from "./components/ResultCard";
import Clouddex from "./components/Clouddex";
import { classify, LOW_CONFIDENCE, type PredictResult } from "./ml/predict";
import { getModel } from "./ml/model";
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
  const [collection, setCollection] = useState<Collection>(() =>
    loadCollection(),
  );
  const [demoModel, setDemoModel] = useState(false);

  // Kick off model load (and warmup) as soon as the app mounts.
  useEffect(() => {
    getModel()
      .then((m) => setDemoModel(m.demo))
      .catch(() => setDemoModel(true));
  }, []);

  async function handleCapture(img: HTMLImageElement, dataUrl: string) {
    setBusy(true);
    try {
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="logo">☁</span> Clouddex
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
            <CameraCapture onCapture={handleCapture} busy={busy} />
          )
        ) : (
          <Clouddex collection={collection} />
        )}
      </main>

      <nav className="tabbar">
        <button
          className={tab === "scan" ? "active" : ""}
          onClick={() => setTab("scan")}
        >
          📷 Scan
        </button>
        <button
          className={tab === "dex" ? "active" : ""}
          onClick={() => setTab("dex")}
        >
          📖 Clouddex
        </button>
      </nav>
    </div>
  );
}
