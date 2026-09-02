import { useState } from "react";
import {
  ALL_ENTRIES,
  assetUrl,
  type AltitudeBand,
  type Genus,
} from "../data/genera";
import type { Collection } from "../store/collection";
import GenusDetail from "./GenusDetail";
import {
  HighCloudGlyph,
  LowCloudGlyph,
  MidCloudGlyph,
  ToweringCloudGlyph,
} from "./Icons";

type Props = Readonly<{
  collection: Collection;
  /** id -> data URL of the user's own catch photo, when they have one. */
  photos: Record<string, string>;
  onGoScan: () => void;
}>;

/** Locked cells hint at the cloud's altitude band instead of all showing one
 *  identical glyph — four silhouette families across the grid. */
const ALTITUDE_GLYPH: Record<AltitudeBand, typeof HighCloudGlyph> = {
  high: HighCloudGlyph,
  mid: MidCloudGlyph,
  low: LowCloudGlyph,
  vertical: ToweringCloudGlyph,
};

/** The photo shown for a caught cell: the user's own shot first, the reference
 *  image as a fallback (older catches, or storage unavailable). */
function cellPhoto(
  genus: Genus,
  caught: boolean,
  photos: Record<string, string>,
): string | null {
  if (!caught) return null;
  if (photos[genus.id]) return photos[genus.id];
  return genus.image ? assetUrl(genus.image) : null;
}

export default function Clouddex({ collection, photos, onGoScan }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const caughtCount = ALL_ENTRIES.filter((g) => collection[g.id]).length;
  const open = ALL_ENTRIES.find((g) => g.id === openId) ?? null;

  return (
    <div className="dex">
      <div className="dex-header">
        <h2>Collection</h2>
        <span className="dex-count">
          {caughtCount} / {ALL_ENTRIES.length} caught
        </span>
      </div>

      {caughtCount === 0 && (
        <div className="dex-empty">
          <p>
            Your field guide is empty. Photograph the sky and a confident
            identification pins that genus here — your own photo, kept on this
            device.
          </p>
          <button type="button" className="linklike" onClick={onGoScan}>
            Open the camera
          </button>
        </div>
      )}

      <div className="dex-grid">
        {ALL_ENTRIES.map((g, i) => {
          const caught = Boolean(collection[g.id]);
          const shot = cellPhoto(g, caught, photos);
          const Glyph = ALTITUDE_GLYPH[g.altitude];
          return (
            <button
              key={g.id}
              className={caught ? "dex-cell caught" : "dex-cell locked"}
              aria-label={
                caught
                  ? `${g.name}, number ${i + 1}, caught`
                  : `Number ${i + 1}, not yet caught`
              }
              onClick={() => setOpenId(g.id)}
              style={shot ? { backgroundImage: `url(${shot})` } : undefined}
            >
              <span className="dex-num">#{String(i + 1).padStart(2, "0")}</span>
              <span className="dex-name">{caught ? g.name : "???"}</span>
              {!caught && (
                <span className="dex-silhouette" aria-hidden="true">
                  <Glyph size={40} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <GenusDetail
          genus={open}
          caught={collection[open.id]}
          photo={photos[open.id]}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
