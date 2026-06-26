"""
Harvest real, freely-licensed sky photos per WMO cloud genus from Wikimedia
Commons, to enrich the small/imbalanced CCSN training set for Clouddex.

WHY: CCSN is ~2.5k images and imbalanced (high clouds underrepresented). Real
Commons photos add real-world variety and help even out the classes. Output is
arranged exactly like the CCSN folders so train.py / run.sh consume it directly:

    data/
      cirrus/ *.jpg
      cumulus/ *.jpg
      ...

LICENSE POLICY (decided for Clouddex — a free public app):
  Accept only CC0, public-domain, CC-BY, CC-BY-SA. Reject NonCommercial (NC),
  NoDerivatives (ND), GFDL, and non-free/fair-use. Every kept image's author +
  license + source page is written to data/_attributions.csv for ATTRIBUTIONS.md.

LABEL HYGIENE: Commons nests photos in subcategories. We recurse, but only into
subcategories that match the TARGET genus and contain NO other genus name — so
"Cumulus clouds" never pulls in a "Stratocumulus" subcategory, etc.

Polite to the API: single-threaded, descriptive User-Agent with contact, honors
maxlag, paginates. Idempotent: re-running skips files already on disk.

Usage:
    python harvest_wikimedia.py --per-genus 175 --out ./data
    python harvest_wikimedia.py --genera cirrus,contrail --per-genus 50   # subset
"""

import argparse
import csv
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "Clouddex-dataset-builder/1.0 (https://github.com/luciaLebrun/clouddex; cloud-genus PWA)"

# python.org framework Python ships no system CA bundle; use certifi's if present.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()

# The 11 app classes. Values = candidate Commons root categories to seed from.
GENUS_CATEGORIES = {
    "cirrus":        ["Cirrus clouds", "Cirrus cloud"],
    "cirrocumulus":  ["Cirrocumulus clouds", "Cirrocumulus"],
    "cirrostratus":  ["Cirrostratus clouds", "Cirrostratus"],
    "altocumulus":   ["Altocumulus clouds", "Altocumulus"],
    "altostratus":   ["Altostratus clouds", "Altostratus"],
    "cumulus":       ["Cumulus clouds", "Cumulus cloud"],
    "cumulonimbus":  ["Cumulonimbus clouds", "Cumulonimbus"],
    "nimbostratus":  ["Nimbostratus clouds", "Nimbostratus"],
    "stratocumulus": ["Stratocumulus clouds", "Stratocumulus"],
    "stratus":       ["Stratus clouds", "Stratus cloud"],
    "contrail":      ["Contrails", "Contrail"],
}
ALL_GENERA = list(GENUS_CATEGORIES)

# Substring license rules applied to a normalized "license" string.
ALLOW = ("cc0", "publicdomain", "public domain", "cc-by", "cc by")
DENY = ("-nc", " nc", "noncommercial", "-nd", " nd", "noderiv",
        "gfdl", "fair use", "non-free", "nonfree")

IMG_EXT = (".jpg", ".jpeg", ".png")


def api_get(params, post=False):
    """Query the Commons API as JSON, honoring maxlag with a couple of retries.

    Use post=True for requests with many/long titles (GET hits HTTP 414).
    """
    params = {**params, "format": "json", "maxlag": "5"}
    for attempt in range(4):
        if post:
            body = urllib.parse.urlencode(params).encode()
            req = urllib.request.Request(API, data=body, headers={"User-Agent": UA})
        else:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                         headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
                data = json.load(r)
            if "error" in data and data["error"].get("code") == "maxlag":
                time.sleep(2 + attempt * 2)
                continue
            return data
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(1 + attempt)
    return {}


def category_members(title, cmtype):
    """Yield member titles of a category (cmtype 'file' or 'subcat'), paginated."""
    cont = {}
    while True:
        data = api_get({
            "action": "query", "list": "categorymembers",
            "cmtitle": title, "cmtype": cmtype, "cmlimit": "500", **cont,
        })
        for m in data.get("query", {}).get("categorymembers", []):
            yield m["title"]
        if "continue" in data:
            cont = data["continue"]
            time.sleep(0.1)
        else:
            return


def on_label_subcat(subcat_title, genus):
    """True only if the subcategory matches `genus` and no OTHER genus name."""
    s = subcat_title.lower()
    for other in ALL_GENERA:
        if other != genus and other in s:
            return False  # cross-contamination (e.g. 'nimbostratus' inside 'stratus')
    return genus in s


def collect_file_titles(genus, max_depth):
    """BFS the genus' categories + on-label subcategories for image file titles."""
    titles, seen_cats = set(), set()
    # Seed with whichever candidate root categories actually exist.
    frontier = []
    for cand in GENUS_CATEGORIES[genus]:
        cat = "Category:" + cand
        # Cheap existence probe: does it have any members at all?
        if any(True for _ in _first(category_members(cat, "file"))) or \
           any(True for _ in _first(category_members(cat, "subcat"))):
            frontier.append((cat, 0))
    for cat, depth in _bfs(frontier, seen_cats, genus, max_depth):
        for ft in category_members(cat, "file"):
            titles.add(ft)
    return sorted(titles)


def _first(gen):
    """Yield at most one item — used as a cheap 'is non-empty' probe."""
    for x in gen:
        yield x
        return


def _bfs(frontier, seen_cats, genus, max_depth):
    """Breadth-first walk over the category tree, staying on-label."""
    queue = list(frontier)
    while queue:
        cat, depth = queue.pop(0)
        if cat in seen_cats:
            continue
        seen_cats.add(cat)
        yield cat, depth
        if depth >= max_depth:
            continue
        for sub in category_members(cat, "subcat"):
            name = sub.replace("Category:", "")
            if on_label_subcat(name, genus) and sub not in seen_cats:
                queue.append((sub, depth + 1))


def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def license_ok(meta):
    """Decide from extmetadata whether the license is in our allowed set."""
    bits = " ".join(strip_html(meta.get(k, {}).get("value", "")).lower()
                    for k in ("License", "LicenseShortName", "UsageTerms"))
    if any(d in bits for d in DENY):
        return None
    if any(a in bits for a in ALLOW):
        short = strip_html(meta.get("LicenseShortName", {}).get("value", "")) or "see source"
        return short
    return None


def imageinfo(file_titles, thumb_width):
    """Batch-fetch url/size/mime/extmetadata for up to 50 File: titles."""
    out = {}
    for i in range(0, len(file_titles), 50):
        batch = file_titles[i:i + 50]
        data = api_get({
            "action": "query", "titles": "|".join(batch),
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": str(thumb_width),
        }, post=True)
        for page in data.get("query", {}).get("pages", {}).values():
            ii = page.get("imageinfo")
            if ii:
                out[page["title"]] = ii[0]
        time.sleep(0.1)
    return out


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r, open(dest, "wb") as f:
        f.write(r.read())


def safe_name(title):
    base = title.replace("File:", "")
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base)
    return base[:120]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="./data")
    ap.add_argument("--per-genus", type=int, default=175)
    ap.add_argument("--min-width", type=int, default=400)
    ap.add_argument("--thumb-width", type=int, default=720,
                    help="download a scaled JPEG/PNG this many px wide (saves space)")
    ap.add_argument("--max-depth", type=int, default=2)
    ap.add_argument("--genera", default="",
                    help="comma-separated subset; default = all 11")
    ap.add_argument("--add", action="store_true",
                    help="additive mode: pull up to --per-genus NEW images per genus "
                         "regardless of how many already exist (e.g. on top of CCSN). "
                         "Default tops folders UP TO --per-genus total.")
    args = ap.parse_args()

    genera = [g.strip() for g in args.genera.split(",") if g.strip()] or ALL_GENERA
    bad = [g for g in genera if g not in GENUS_CATEGORIES]
    if bad:
        sys.exit("unknown genera: " + ", ".join(bad))

    os.makedirs(args.out, exist_ok=True)
    manifest = os.path.join(args.out, "_attributions.csv")
    have = set()
    new_manifest = not os.path.exists(manifest) or os.path.getsize(manifest) == 0
    if not new_manifest:
        with open(manifest, newline="") as f:
            have = {row["file"] for row in csv.DictReader(f)}
    mf = open(manifest, "a", newline="")
    writer = csv.writer(mf)
    if new_manifest:
        writer.writerow(["genus", "file", "title", "author", "license", "source_page"])

    grand = 0
    for genus in genera:
        gdir = os.path.join(args.out, genus)
        os.makedirs(gdir, exist_ok=True)
        existing = len([f for f in os.listdir(gdir)
                        if f.lower().endswith(IMG_EXT)])
        if args.add:
            need = args.per_genus
            print(f"\n=== {genus}: have {existing}, adding up to {need} new ===", flush=True)
        else:
            need = args.per_genus - existing
            print(f"\n=== {genus}: have {existing}, target {args.per_genus} ===", flush=True)
            if need <= 0:
                print("  already satisfied, skipping")
                continue

        titles = collect_file_titles(genus, args.max_depth)
        print(f"  candidate files in category tree: {len(titles)}", flush=True)
        info = imageinfo(titles, args.thumb_width)

        kept = 0
        for title in titles:
            if kept >= need:
                break
            ii = info.get(title)
            if not ii:
                continue
            if ii.get("mime", "") not in ("image/jpeg", "image/png"):
                continue
            if int(ii.get("width", 0)) < args.min_width:
                continue
            lic = license_ok(ii.get("extmetadata", {}))
            if not lic:
                continue
            src = ii.get("thumburl") or ii.get("url")
            if not src:
                continue
            ext = ".png" if ii.get("mime") == "image/png" else ".jpg"
            fname = safe_name(title)
            fname = os.path.splitext(fname)[0] + ext
            if fname in have:
                continue
            dest = os.path.join(gdir, fname)
            if os.path.exists(dest):
                have.add(fname)
                continue
            try:
                download(src, dest)
            except Exception as e:
                print("  download failed:", title, e)
                continue
            author = strip_html(ii["extmetadata"].get("Artist", {}).get("value", "")) or "Unknown"
            page = ii.get("descriptionshorturl") or ii.get("descriptionurl") or title
            writer.writerow([genus, fname, title.replace("File:", ""), author, lic, page])
            mf.flush()
            have.add(fname)
            kept += 1
            if kept % 25 == 0:
                print(f"  ...{kept}/{need}", flush=True)
            time.sleep(0.05)
        grand += kept
        print(f"  kept {kept} new images for {genus}")

    mf.close()
    print(f"\nDONE. Added {grand} images. Attribution manifest: {manifest}")
    print("Review the folders, then train:  ./run.sh   (or python train.py)")


if __name__ == "__main__":
    main()
