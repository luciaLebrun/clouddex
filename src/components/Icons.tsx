// Minimal stroke-based icon set (paths from Lucide, ISC license — see
// ATTRIBUTIONS.md). One style everywhere: 24px grid, 1.75 stroke, round caps.
// All icons are decorative next to visible text, so callers keep them
// aria-hidden via the wrapper props below.

type IconProps = Readonly<{
  size?: number;
}>;

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
}

export function CloudIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

export function CameraIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export function BookIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// Altitude-band silhouettes for locked Clouddex cells — so an empty grid reads
// as four cloud families hinting at height, not ten identical glyphs.

/** High cloud: thin, wind-drawn wisps (cirrus family). */
export function HighCloudGlyph({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 7c4-2.5 8-2.5 12 0" />
      <path d="M6 12c4-2.5 8-2.5 12 0" />
      <path d="M4 17c4-2.5 8-2.5 12 0" />
    </svg>
  );
}

/** Mid-level cloud: a broken row of cloudlets (alto- family). */
export function MidCloudGlyph({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 10a2.4 2.4 0 0 1 4.6-1 2.4 2.4 0 0 1 4.6 0 2.4 2.4 0 0 1 4.6 1" />
      <path d="M3 15a2.4 2.4 0 0 1 4.6-1 2.4 2.4 0 0 1 4.6 0 2.4 2.4 0 0 1 4.6 1" />
    </svg>
  );
}

/** Low cloud: flat, layered sheets (stratus family). */
export function LowCloudGlyph({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 8h13" />
      <path d="M3 12h17" />
      <path d="M5 16h11" />
    </svg>
  );
}

/** Towering cloud: deep convection with an anvil top (cumulonimbus). */
export function ToweringCloudGlyph({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 6h15" />
      <path d="M8 20a4 4 0 0 1-.5-8 5 5 0 0 1 9.7-1.2A3.3 3.3 0 0 1 16.5 20z" />
    </svg>
  );
}
