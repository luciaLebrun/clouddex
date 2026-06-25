import { useState } from "react";
import { ALL_ENTRIES, assetUrl } from "../data/genera";
import type { Collection } from "../store/collection";
import GenusDetail from "./GenusDetail";

interface Props {
  collection: Collection;
}

export default function Clouddex({ collection }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const caughtCount = ALL_ENTRIES.filter((g) => collection[g.id]).length;
  const open = ALL_ENTRIES.find((g) => g.id === openId) ?? null;

  return (
    <div className="dex">
      <div className="dex-header">
        <h2>Clouddex</h2>
        <span className="dex-count">
          {caughtCount} / {ALL_ENTRIES.length} caught
        </span>
      </div>
      <div className="dex-grid">
        {ALL_ENTRIES.map((g, i) => {
          const caught = collection[g.id];
          return (
            <button
              key={g.id}
              className={`dex-cell ${caught ? "caught" : "locked"}`}
              onClick={() => setOpenId(g.id)}
              style={
                caught && g.image
                  ? { backgroundImage: `url(${assetUrl(g.image)})` }
                  : undefined
              }
            >
              <span className="dex-num">#{String(i + 1).padStart(2, "0")}</span>
              <span className="dex-name">{caught ? g.name : "???"}</span>
              {!caught && <span className="dex-silhouette">☁</span>}
            </button>
          );
        })}
      </div>
      {open && (
        <GenusDetail
          genus={open}
          caught={collection[open.id]}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
