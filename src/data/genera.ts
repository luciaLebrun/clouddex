// The 10 WMO cloud genera (+ an optional "contrail" extra that the CCSN dataset
// also provides). The `id` values are the canonical class labels — they MUST
// match the label order your trained model outputs (see public/model/labels.json
// and training/README.md). Keep this list and the model's labels in sync.

/** Resolve a public/ asset path against the deploy base (e.g. "/clouddex/"). */
export const assetUrl = (path: string): string =>
  import.meta.env.BASE_URL.replace(/\/$/, "") + "/" + path.replace(/^\//, "");

export type AltitudeBand = "high" | "mid" | "low" | "vertical";

export interface Genus {
  /** Canonical class id — must match the model's output label. */
  id: string;
  /** Common English name. */
  name: string;
  /** Latin genus name. */
  latin: string;
  /** WMO abbreviation. */
  abbr: string;
  altitude: AltitudeBand;
  /** Approximate base height, for display. */
  heightText: string;
  /** What it looks like in the sky. */
  appearance: string;
  /** What weather it usually signals. */
  weather: string;
  /** A short memorable fact for the Pokedex card. */
  fact: string;
  /** Reference image in public/genera/ (optional; falls back to a gradient). */
  image?: string;
}

export const GENERA: Genus[] = [
  {
    id: "cumulus",
    name: "Cumulus",
    latin: "Cumulus",
    abbr: "Cu",
    altitude: "low",
    heightText: "below 2,000 m",
    appearance:
      "Puffy, cotton-wool heaps with flat bases and bright, rounded tops.",
    weather: "Fair weather — but can grow into showers on warm afternoons.",
    fact: "The classic 'cartoon cloud'. Forms over rising columns of warm air (thermals).",
    image: "/genera/cumulus.jpg",
  },
  {
    id: "stratus",
    name: "Stratus",
    latin: "Stratus",
    abbr: "St",
    altitude: "low",
    heightText: "below 2,000 m",
    appearance: "A featureless grey sheet covering the whole sky, like high fog.",
    weather: "Dull, overcast skies; sometimes drizzle or light mist.",
    fact: "If a stratus cloud touches the ground, you simply call it fog.",
    image: "/genera/stratus.jpg",
  },
  {
    id: "stratocumulus",
    name: "Stratocumulus",
    latin: "Stratocumulus",
    abbr: "Sc",
    altitude: "low",
    heightText: "below 2,000 m",
    appearance:
      "Low, lumpy patches or rolls of grey and white, often in a honeycomb pattern.",
    weather: "Usually dry; the most common cloud type on Earth.",
    fact: "Covers more of the planet than any other cloud — you've seen it countless times.",
    image: "/genera/stratocumulus.jpg",
  },
  {
    id: "cumulonimbus",
    name: "Cumulonimbus",
    latin: "Cumulonimbus",
    abbr: "Cb",
    altitude: "vertical",
    heightText: "base low, top up to 12,000+ m",
    appearance:
      "Towering, mountainous cloud with a dark base and an anvil-shaped top.",
    weather: "Thunderstorms, heavy rain, hail, lightning — the storm cloud.",
    fact: "The king of clouds. A single one can hold the energy of many atomic bombs.",
    image: "/genera/cumulonimbus.jpg",
  },
  {
    id: "nimbostratus",
    name: "Nimbostratus",
    latin: "Nimbostratus",
    abbr: "Ns",
    altitude: "mid",
    heightText: "2,000–4,000 m (thick, multi-level)",
    appearance: "A thick, dark grey, shapeless layer that blots out the sun.",
    weather: "Steady, prolonged rain or snow — the 'all-day rain' cloud.",
    fact: "So thick you can't see the sun through it, unlike thinner grey layers.",
    image: "/genera/nimbostratus.jpg",
  },
  {
    id: "altocumulus",
    name: "Altocumulus",
    latin: "Altocumulus",
    abbr: "Ac",
    altitude: "mid",
    heightText: "2,000–7,000 m",
    appearance:
      "Mid-level patches of white/grey 'cloudlets', often in rows like a fish skeleton.",
    weather: "Often a sign of change; thunderstorms may follow on a humid morning.",
    fact: "A 'mackerel sky' of altocumulus is a classic folk forecast of coming rain.",
    image: "/genera/altocumulus.jpg",
  },
  {
    id: "altostratus",
    name: "Altostratus",
    latin: "Altostratus",
    abbr: "As",
    altitude: "mid",
    heightText: "2,000–7,000 m",
    appearance: "A grey or blue-grey veil; the sun looks like it's behind frosted glass.",
    weather: "Often precedes a warm front and steady rain.",
    fact: "Through altostratus the sun appears as a dim, watery disc — no sharp shadows.",
    image: "/genera/altostratus.jpg",
  },
  {
    id: "cirrus",
    name: "Cirrus",
    latin: "Cirrus",
    abbr: "Ci",
    altitude: "high",
    heightText: "above 6,000 m",
    appearance: "Delicate, wispy white streaks, like brushstrokes or 'mares' tails'.",
    weather: "Fair now, but often a sign of an approaching warm front within a day.",
    fact: "Made entirely of ice crystals, blown into streaks by high-altitude winds.",
    image: "/genera/cirrus.jpg",
  },
  {
    id: "cirrocumulus",
    name: "Cirrocumulus",
    latin: "Cirrocumulus",
    abbr: "Cc",
    altitude: "high",
    heightText: "above 6,000 m",
    appearance:
      "High, tiny white ripples or grains, like fine sand or fish scales.",
    weather: "Fair, often cold; usually short-lived.",
    fact: "The rarest of the high clouds — a true catch for any cloud-collector.",
    image: "/genera/cirrocumulus.jpg",
  },
  {
    id: "cirrostratus",
    name: "Cirrostratus",
    latin: "Cirrostratus",
    abbr: "Cs",
    altitude: "high",
    heightText: "above 6,000 m",
    appearance: "A thin, milky veil over the whole sky, often making a halo round the sun or moon.",
    weather: "Rain or snow may arrive within 12–24 hours.",
    fact: "The halo it casts around the sun is sunlight bending through its ice crystals.",
    image: "/genera/cirrostratus.jpg",
  },
];

/** Extra non-genus class present in the CCSN dataset; handled like a genus. */
export const CONTRAIL: Genus = {
  id: "contrail",
  name: "Contrail",
  latin: "—",
  abbr: "Ct",
  altitude: "high",
  heightText: "above 8,000 m",
  appearance: "Straight white lines drawn across the sky behind aircraft.",
  weather: "Not a natural cloud; persistence hints at humid air aloft.",
  fact: "A 'condensation trail' of ice crystals from jet engine exhaust.",
  image: "/genera/contrail.jpg",
};

/** All collectible entries, keyed by id for quick lookup. */
export const ALL_ENTRIES: Genus[] = [...GENERA, CONTRAIL];

export const GENUS_BY_ID: Record<string, Genus> = Object.fromEntries(
  ALL_ENTRIES.map((g) => [g.id, g]),
);

export const ALTITUDE_LABELS: Record<AltitudeBand, string> = {
  high: "High cloud",
  mid: "Mid-level cloud",
  low: "Low cloud",
  vertical: "Vertical / towering cloud",
};
