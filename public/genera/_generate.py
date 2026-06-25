#!/usr/bin/env python3
"""
Generate original, license-free reference illustrations for each cloud genus.

These are simple vector (SVG) renders -> JPG, used as placeholders in the
Clouddex grid and detail sheets until you drop in real photos with the same
filenames (e.g. cumulus.jpg). Re-run any time:

    python3 _generate.py          # needs rsvg-convert (brew install librsvg) + sips (macOS)

Each image is 600x450 (4:3) with a fully opaque sky so JPG conversion is clean.
"""
import os
import subprocess
import tempfile

W, H = 600, 450
OUT = os.path.dirname(os.path.abspath(__file__))

# Sky gradients keyed loosely by altitude/mood.
SKIES = {
    "low": ("#4a90d9", "#bcdcf6"),
    "mid": ("#6398cb", "#cfe0ef"),
    "high": ("#5887cc", "#dcecfb"),
    "storm": ("#3a4a63", "#8fa6bf"),
    "grey": ("#7d8aa0", "#c4ccd9"),
}


def sky(grad):
    a, b = SKIES[grad]
    return f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/>
  </linearGradient>
  <radialGradient id="puff" cx="0.4" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dde8f2"/>
  </radialGradient>
  <radialGradient id="greypuff" cx="0.4" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#eef1f6"/><stop offset="1" stop-color="#9aa6b8"/>
  </radialGradient></defs>"""


def sun(x, y, r=34, color="#fff6d8", glow=True):
    g = (
        f'<circle cx="{x}" cy="{y}" r="{r*2.2}" fill="{color}" opacity="0.25"/>'
        if glow else ""
    )
    return f'{g}<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'


def puff(cx, cy, s, fill="url(#puff)"):
    """A fluffy cloud built from overlapping ellipses with a flat-ish base."""
    e = lambda dx, dy, rx, ry: (
        f'<ellipse cx="{cx+dx}" cy="{cy+dy}" rx="{rx}" ry="{ry}" fill="{fill}"/>'
    )
    base = f'<rect x="{cx-90*s}" y="{cy}" width="{180*s}" height="{34*s}" rx="14" fill="{fill}"/>'
    return (
        base
        + e(-55 * s, 6 * s, 48 * s, 40 * s)
        + e(0, -22 * s, 64 * s, 56 * s)
        + e(58 * s, 4 * s, 50 * s, 42 * s)
        + e(20 * s, 10 * s, 44 * s, 36 * s)
    )


def streak(cx, cy, w, curl=1.0, op=0.9):
    """A wispy cirrus streak."""
    return (
        f'<path d="M{cx-w} {cy} q {w*0.5} {-20*curl} {w} {-6} q {w*0.4} {10} {w*0.8} {2}" '
        f'stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" opacity="{op}"/>'
    )


def render(genus, body):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n  {body}\n</svg>'
    with tempfile.TemporaryDirectory() as td:
        svg_p = os.path.join(td, "i.svg")
        png_p = os.path.join(td, "i.png")
        with open(svg_p, "w") as f:
            f.write(svg)
        subprocess.run(
            ["rsvg-convert", "-w", str(W), "-h", str(H), svg_p, "-o", png_p],
            check=True,
        )
        jpg_p = os.path.join(OUT, f"{genus}.jpg")
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82", png_p,
             "--out", jpg_p],
            check=True, stdout=subprocess.DEVNULL,
        )
    print("wrote", f"{genus}.jpg")


# --- Per-genus scenes ----------------------------------------------------------
scenes = {}

scenes["cumulus"] = sky("low") + sun(500, 90) + puff(180, 250, 1.0) + puff(420, 320, 0.7)

scenes["cumulonimbus"] = (
    sky("storm")
    # anvil top
    + f'<ellipse cx="300" cy="120" rx="230" ry="46" fill="url(#puff)"/>'
    # towering body
    + f'<path d="M190 420 Q150 250 230 180 Q300 120 380 180 Q450 250 410 420 Z" fill="url(#greypuff)"/>'
    + puff(300, 250, 0.9, "url(#greypuff)")
    # rain
    + "".join(
        f'<line x1="{x}" y1="400" x2="{x-12}" y2="445" stroke="#cdd8e6" stroke-width="3" opacity="0.6"/>'
        for x in range(230, 400, 24)
    )
)

scenes["stratus"] = (
    sky("grey")
    + f'<rect x="0" y="150" width="{W}" height="220" fill="#b9c2d2" opacity="0.85"/>'
    + f'<rect x="0" y="200" width="{W}" height="120" fill="#aab4c6" opacity="0.7"/>'
)

scenes["stratocumulus"] = sky("low") + "".join(
    puff(x, y, 0.45, "url(#greypuff)")
    for y in (170, 250, 330)
    for x in (110, 250, 390, 530)
)

scenes["nimbostratus"] = (
    sky("storm")
    + f'<rect x="0" y="80" width="{W}" height="260" fill="#5b6678" opacity="0.95"/>'
    + f'<rect x="0" y="60" width="{W}" height="120" fill="#48515f" opacity="0.8"/>'
    + "".join(
        f'<line x1="{x}" y1="330" x2="{x-16}" y2="445" stroke="#aeb8c6" stroke-width="3" opacity="0.55"/>'
        for x in range(40, 600, 26)
    )
)

scenes["altocumulus"] = sky("mid") + sun(70, 70, 26) + "".join(
    f'<ellipse cx="{x}" cy="{y}" rx="34" ry="18" fill="url(#puff)" opacity="0.95"/>'
    for y in (140, 200, 260)
    for x in range(70, 600, 70)
)

scenes["altostratus"] = (
    sky("grey")
    + f'<rect width="{W}" height="{H}" fill="#9aa6ba" opacity="0.55"/>'
    + sun(300, 200, 40, "#e9eef5", glow=False)
    + f'<rect width="{W}" height="{H}" fill="#aeb9ca" opacity="0.35"/>'
)

scenes["cirrus"] = (
    sky("high")
    + streak(220, 130, 150, 1.4)
    + streak(380, 180, 170, 1.1)
    + streak(300, 240, 130, 1.6)
    + streak(180, 300, 120, 1.0, 0.7)
)

scenes["cirrocumulus"] = sky("high") + "".join(
    f'<circle cx="{x}" cy="{y}" r="9" fill="#ffffff" opacity="0.95"/>'
    for y in range(120, 300, 26)
    for x in range(150, 470, 26)
)

scenes["cirrostratus"] = (
    sky("high")
    + f'<rect width="{W}" height="{H}" fill="#ffffff" opacity="0.18"/>'
    + sun(300, 200, 30)
    # 22-degree halo ring
    + '<circle cx="300" cy="200" r="120" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.5"/>'
    + '<circle cx="300" cy="200" r="120" fill="none" stroke="#ffe9b0" stroke-width="2" opacity="0.6"/>'
)

scenes["contrail"] = (
    sky("low")
    + sun(520, 80)
    + "".join(
        f'<line x1="40" y1="{y}" x2="540" y2="{y-60}" stroke="#ffffff" stroke-width="7" opacity="0.85" stroke-linecap="round"/>'
        for y in (180, 250, 320)
    )
    + '<circle cx="540" cy="190" r="4" fill="#33405a"/>'
)

if __name__ == "__main__":
    for genus, body in scenes.items():
        render(genus, body)
    print(f"Done: {len(scenes)} illustrations in {OUT}")
