#!/usr/bin/env python3
"""build_lookbook.py -- renders lookbook/index.html, the visual look book for
the BNC Grade LUT pack (SPEC.md section 10 / docs/08-lookbook.md).

Reads:
  - bnc_looks.LOOKS / bnc_looks.describe()      -- the 13 look recipes
  - lookbook/previews/*.jpg|png + index.json    -- already-rendered previews
  - luts/02_looks, luts/03_combined_slog3       -- to confirm LUT filenames
  - docs/08-lookbook.md                         -- "How to choose" table and
                                                    the operation-to-app
                                                    mapping table, copied
                                                    verbatim into the dicts
                                                    below (OP_APP_MAP,
                                                    HOW_TO_CHOOSE)

Writes:
  - lookbook/index.html -- a single self-contained file. All preview images
    are inlined as base64 data URIs (JPEG photos re-encoded at quality 80 /
    max width 720px; PNG charts resized but kept lossless). The only
    external resource is the Google Fonts stylesheet link. Everything
    interactive (look selection, before/after slider, strength blend,
    sample switching, copy-to-clipboard) is vanilla JS driven off one JSON
    data object built here.

Regenerate after changing a look recipe, replacing a sample image (then
re-run render_previews.py first), or editing the mapping/how-to-choose
content below:

    python3 tools/render_previews.py   # only if samples/recipes changed
    python3 tools/build_lookbook.py
"""

from __future__ import annotations

import base64
import html
import io
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
sys.path.insert(0, str(TOOLS_DIR))

import bnc_looks as bl  # noqa: E402  (LOOKS, describe(), Look)

PREVIEWS_DIR = ROOT / "lookbook" / "previews"
LUTS_DIR = ROOT / "luts"
OUT_PATH = ROOT / "lookbook" / "index.html"

SAMPLES = ["astronaut", "coffee", "chelsea", "rocket"]
SAMPLE_LABELS = {
    "astronaut": "Astronaut",
    "coffee": "Coffee",
    "chelsea": "Chelsea",
    "rocket": "Rocket",
    "slog3demo": "S-Log3 demo",
}

# Re-encoding budget (brief: "Re-encode JPEGs at quality 80 and max width
# 720 to hit the size budget").
JPEG_MAX_WIDTH = 720
JPEG_QUALITY = 80
CHART_FULL_WIDTH = 900
CHART_STRIP_SIZE = (600, 60)
# The composite chart is 1200x900: three stacked 1200x300 elements
# (ColorChecker row, grey ramp, hue/sat wheel -- see render_previews.py's
# build_chart_composite()). The rail swatch takes a 1200x120 slice centred
# in that top 300px ColorChecker row (matching the brief's "e.g. 1200x120
# resized to 600x60") so the 10:1 crop aspect matches the 10:1 thumbnail
# aspect with no distortion.
CHART_STRIP_CROP = (0, 90, 1200, 210)

GOOGLE_FONTS_HREF = (
    "https://fonts.googleapis.com/css2?"
    "family=Fraunces:opsz,wght@9..144,300..900"
    "&family=IBM+Plex+Sans:wght@400;500;600"
    "&family=IBM+Plex+Mono:wght@400;500;600"
    "&display=swap"
)

# ---------------------------------------------------------------------------
# Operation -> app mapping, copied verbatim from docs/08-lookbook.md
# ("The toolbox: one operation, three apps"). Keyed by the op name used in
# bnc_color.py / Op.name, "term" is the doc table's "Operation (recipe
# term)" column.
# ---------------------------------------------------------------------------

OP_APP_MAP = {
    "white_balance": {
        "term": "white_balance(warm, tint)",
        "what": "Shifts the whole image warm/cool and green/magenta, luminance preserved",
        "resolve": "Primaries → Offset wheel, or Temperature/Tint sliders",
        "photoshop": "Camera Raw Temp/Tint; PS Photo Filter at low density",
        "ae": "Basic Correction → Temperature / Tint",
    },
    "exposure": {
        "term": "exposure(ev)",
        "what": "Brightens or darkens everything by a fraction of a stop",
        "resolve": "Primaries → Offset (log) or Gain",
        "photoshop": "Camera Raw Exposure",
        "ae": "Basic Correction → Exposure",
    },
    "contrast": {
        "term": "contrast(amount, pivot)",
        "what": "S-curve contrast around the pivot (0.43 = middle grey) with a built-in soft clip",
        "resolve": "Primaries → Contrast / Pivot (pivot ≈ 0.435)",
        "photoshop": "Curves: S-curve anchored at the midpoint; Camera Raw Contrast",
        "ae": "Basic Correction → Contrast; Curves",
    },
    "toe": {
        "term": "toe(strength, range)",
        "what": "Deepens shadows below the range without touching mids",
        "resolve": "Custom curve: pull the point at 0.12 down; or Log wheels Shadow",
        "photoshop": "Curves: lower a point at 12–15% input",
        "ae": "Curves",
    },
    "shoulder": {
        "term": "shoulder(start, k)",
        "what": "Compresses highlights above the start point (matte highlights)",
        "resolve": "Custom curve: pull the top end down; Soft Clip High",
        "photoshop": "Curves: drop the white point to 0.9–0.95",
        "ae": "Curves",
    },
    "lift_blacks": {
        "term": "lift_blacks(amount)",
        "what": "Raises pure black to the given level (faded/matte)",
        "resolve": "Primaries → Lift (all channels)",
        "photoshop": "Curves: raise the black point; Camera Raw Blacks +",
        "ae": "Basic Correction → Blacks; Curves",
    },
    "softclip": {
        "term": "softclip(hi)",
        "what": "Gentle roll-off of everything above hi so nothing hard-clips",
        "resolve": "Soft Clip High / High Softness",
        "photoshop": "Curves: soften the top",
        "ae": "Curves",
    },
    "saturation": {
        "term": "saturation(amount)",
        "what": "Global saturation (hue-safe, perceptual)",
        "resolve": "Primaries → Saturation",
        "photoshop": "Hue/Saturation layer; Camera Raw Saturation",
        "ae": "Basic Correction → Saturation",
    },
    "vibrance": {
        "term": "vibrance(amount)",
        "what": "Saturates muted colours more than already-saturated ones",
        "resolve": "Primaries → Color Boost",
        "photoshop": "Vibrance layer; Camera Raw Vibrance",
        "ae": "Creative → Vibrance",
    },
    "density": {
        "term": "density(k)",
        "what": "Subtractive saturation: the more saturated a colour, the darker it gets (film-like)",
        "resolve": "Curves → Sat vs Lum (pull luminance down as saturation rises)",
        "photoshop": "Camera Raw HSL → Luminance −5 to −10 on saturated colours",
        "ae": "Curves → Sat vs Lum (via Lumetri Curves in Premiere; in AE use Hue/Sat lightness on colours)",
    },
    "split_tone": {
        "term": "split_tone(sh_hue, sh_amt, hi_hue, hi_amt)",
        "what": "Tints shadows toward one hue and highlights toward another",
        "resolve": "Log wheels: Shadow and Highlight wheels; or Color Warper",
        "photoshop": "Camera Raw Color Grading (Shadows/Highlights wheels); PS Gradient Map at low opacity",
        "ae": "Creative → Shadow Tint / Highlight Tint; Color Wheels",
    },
    "hue_shift": {
        "term": "hue_shift(centre, width, shift)",
        "what": "Rotates one hue band (e.g. blues toward teal)",
        "resolve": "Curves → Hue vs Hue",
        "photoshop": "Camera Raw HSL → Hue; PS Hue/Saturation on a colour range",
        "ae": "Hue/Saturation effect on a colour range; Lumetri HSL Secondary",
    },
    "hue_sat": {
        "term": "hue_sat(centre, width, mult)",
        "what": "Saturates or mutes one hue band",
        "resolve": "Curves → Hue vs Sat",
        "photoshop": "Camera Raw HSL → Saturation",
        "ae": "Hue/Saturation on a colour range",
    },
    "hue_lum": {
        "term": "hue_lum(centre, width, mult)",
        "what": "Darkens or lightens one hue band (e.g. deeper blues)",
        "resolve": "Curves → Hue vs Lum",
        "photoshop": "Camera Raw HSL → Luminance",
        "ae": "Hue/Saturation → Lightness on a range",
    },
    "bw_mix": {
        "term": "bw_mix(r, g, b)",
        "what": "Black and white with a channel mix (red-filter style)",
        "resolve": "Primaries → RGB Mixer, Monochrome on",
        "photoshop": "Black & White adjustment layer sliders",
        "ae": "Channel Mixer, Monochrome",
    },
    "tint": {
        "term": "tint(hue, amount)",
        "what": "Uniform colour tint (toning for B&W)",
        "resolve": "Primaries → Offset",
        "photoshop": "Photo Filter; Color Balance",
        "ae": "Tint effect at low amount",
    },
}

# ---------------------------------------------------------------------------
# "How to choose" table, copied verbatim from docs/08-lookbook.md.
# ---------------------------------------------------------------------------

HOW_TO_CHOOSE = [
    ('Corporate, product, "just make it clean"', "L01 Clean", "L05 Chrome for a muted premium feel"),
    ("Cinematic narrative, drama, interviews", "L02 Print 2383", "L07 Eterna for softer dialogue scenes"),
    ("Lifestyle, weddings, morning light", "L03 Golden Hour", "L13 Airy for bright, high-key"),
    ('Action, travel, "blockbuster"', "L04 Teal & Orange", "L12 Vivid for landscapes"),
    ("Editorial, fashion, street", "L05 Chrome / L06 Nostalgic", "L10 Faded for a printed-photo feel"),
    ("Night, moody, urban", "L09 Nocturne", "L08 Bleach for grit"),
    ("Documentary, gritty, war/industrial", "L08 Bleach", "L11 Acros in black and white"),
    (
        "Matching X-T5 stills shot in a Fuji simulation",
        "L05 Chrome (Classic Chrome), L06 Nostalgic (Nostalgic Neg), "
        "L07 Eterna (Eterna), L11 Acros (Acros), L12 Vivid (Velvia)",
        "",
    ),
]

RULE_OF_THUMB = (
    "Apply a look at 100% first, then pull Strength back to 60–80%. "
    "Never stack two looks. If skin looks wrong, fix white balance before "
    "the look rather than fighting the LUT."
)

# ---------------------------------------------------------------------------
# Footer install steps -- terminology matches docs/05, 06 and 07.
# ---------------------------------------------------------------------------

INSTALL_STEPS = {
    "Resolve": [
        "Copy the .cube files into your LUT folder — Project Settings "
        "→ Color Management → Open LUT Folder finds it — then "
        "on the Color page's LUTs panel, right-click and choose Refresh "
        "LUT List.",
        "Put each LUT on its own node: the base/technical LUT after your "
        "log corrections, then the look LUT after that, so it lands on "
        "display-referred data.",
        "To pull a look back from full strength, open the node, open the "
        "Key palette, and lower Key Output → Gain.",
    ],
    "Photoshop / Camera Raw": [
        "Layer → New Adjustment Layer → Color Lookup, then in the "
        "3D LUT dropdown choose Load 3D LUT… and select the .cube "
        "file.",
        "Leave the layer's blend mode at Normal for the LUT's intended "
        "result — try Luminosity or Color if you want tone or hue in "
        "isolation.",
        "Dial the look back with the adjustment layer's own Opacity "
        "slider.",
    ],
    "After Effects": [
        "Base/technical LUT: Lumetri Color → Basic Correction → "
        "Input LUT — this applies at full strength and should be "
        "first in the stack.",
        "Look LUT: Lumetri Color → Creative → Look, then set "
        "Intensity (0–200%) to taste.",
        "To apply a LUT outside Lumetri, or to stack more than one pass, "
        "use Effect → Utility → Apply Color LUT and control "
        "strength through the layer's opacity.",
    ],
}

ATTRIBUTION_ITEMS = [
    ("astronaut.png", "NASA photo of astronaut Eileen Collins", "Public domain (NASA)"),
    ("coffee.png", "Rachel Michetti, via Pixabay", "CC0"),
    ("chelsea.png", "Stefan van der Walt", "CC0"),
    ("rocket.jpg", "NASA (rocket launch)", "Public domain (NASA)"),
]


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def jpeg_data_uri(path: Path, max_width: int = JPEG_MAX_WIDTH, quality: int = JPEG_QUALITY) -> str:
    """Re-encode a preview JPEG at the given quality/max width and return a
    data: URI. Previews are already <=720px long edge, but we resize by
    width defensively so the budget holds even if a future preview run
    changes that."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if w > max_width:
        im = im.resize((max_width, max(1, round(h * max_width / w))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True)
    return f"data:image/jpeg;base64,{_b64(buf.getvalue())}"


def _png_data_uri(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return f"data:image/png;base64,{_b64(buf.getvalue())}"


def chart_full_data_uri(path: Path, width: int = CHART_FULL_WIDTH) -> str:
    """Full chart (ColorChecker row + grey ramp + hue/sat wheel), resized to
    `width` wide, for the main panel."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    im2 = im.resize((width, max(1, round(h * width / w))), Image.LANCZOS)
    return _png_data_uri(im2)


def chart_strip_data_uri(path: Path) -> str:
    """Thin ColorChecker-row swatch strip for the rail thumbnail."""
    im = Image.open(path).convert("RGB")
    crop = im.crop(CHART_STRIP_CROP).resize(CHART_STRIP_SIZE, Image.LANCZOS)
    return _png_data_uri(crop)


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------

def unique_ops(look: "bl.Look") -> list[str]:
    """Distinct op names used by `look`, in first-use order (a look may use
    the same op type more than once, e.g. hue_sat on two different hue
    bands -- the rebuild table lists the control once)."""
    seen: list[str] = []
    for op in look.ops:
        if op.name not in seen:
            seen.append(op.name)
    return seen


def look_lut_filenames(look: "bl.Look") -> tuple[str, str]:
    lut = f"BNC_{look.id}_{look.slug}.cube"
    combined = f"BNC_SLog3_{look.id}_{look.slug}.cube"
    lut_path = LUTS_DIR / "02_looks" / lut
    combined_path = LUTS_DIR / "03_combined_slog3" / combined
    assert lut_path.exists(), f"missing look LUT: {lut_path}"
    assert combined_path.exists(), f"missing combined LUT: {combined_path}"
    return lut, combined


def build_page_data() -> dict:
    all_op_names = {op.name for look in bl.LOOKS for op in look.ops}
    missing = all_op_names - set(OP_APP_MAP.keys())
    assert not missing, f"OP_APP_MAP is missing entries for: {sorted(missing)}"

    print("Encoding originals ...")
    originals = {s: jpeg_data_uri(PREVIEWS_DIR / f"{s}__original.jpg") for s in SAMPLES}

    print("Encoding S-Log3 demo base images (astronaut only) ...")
    slog3_base = {
        "log": jpeg_data_uri(PREVIEWS_DIR / "astronaut__slog3.jpg"),
        "base": jpeg_data_uri(PREVIEWS_DIR / "astronaut__base709.jpg"),
    }

    print("Encoding reference chart (original) ...")
    chart_original_full = chart_full_data_uri(PREVIEWS_DIR / "chart__original.png")

    looks_out = []
    for look in bl.LOOKS:
        print(f"Encoding {look.id} {look.slug} ...")
        lut_file, combined_file = look_lut_filenames(look)
        samples = {
            s: jpeg_data_uri(PREVIEWS_DIR / f"{s}__{look.id}_{look.slug}.jpg")
            for s in SAMPLES
        }
        combined_img = jpeg_data_uri(PREVIEWS_DIR / f"astronaut__SLog3_{look.id}_{look.slug}.jpg")
        chart_path = PREVIEWS_DIR / f"chart__{look.id}_{look.slug}.png"
        looks_out.append(
            {
                "id": look.id,
                "name": look.name,
                "intent": look.intent,
                "useFor": look.use_for,
                "recipe": bl.describe(look),
                "ops": unique_ops(look),
                "lutFile": lut_file,
                "combinedFile": combined_file,
                "samples": samples,
                "combined": combined_img,
                "chartFull": chart_full_data_uri(chart_path),
                "chartStrip": chart_strip_data_uri(chart_path),
            }
        )

    return {
        "looks": looks_out,
        "originals": originals,
        "slog3Base": slog3_base,
        "chartOriginalFull": chart_original_full,
        "opMap": OP_APP_MAP,
        "sampleLabels": SAMPLE_LABELS,
        "sampleOrder": SAMPLES,
    }


# ---------------------------------------------------------------------------
# Static HTML fragments (server-rendered; the per-look content in the main
# panel is rendered client-side from the JSON data object built above)
# ---------------------------------------------------------------------------

def esc(text: str) -> str:
    return html.escape(str(text), quote=True)


_LOOK_REF_RE = re.compile(r"\bL(\d{2})\b")


def linkify_look_refs(text: str) -> str:
    """Escape `text` and turn "L05"-style tokens into deep links."""
    escaped = html.escape(text, quote=False)

    def repl(m: re.Match) -> str:
        lid = "L" + m.group(1)
        return f'<a class="look-link" href="#{lid}">{lid}</a>'

    return _LOOK_REF_RE.sub(repl, escaped)


def render_rail(data: dict) -> str:
    items = []
    for look in data["looks"]:
        items.append(
            '<a class="rail-item" href="#{id}" data-look-id="{id}">'
            '<img class="rail-swatch" src="{strip}" alt="" width="600" height="60">'
            '<span class="rail-id mono">{id}</span>'
            '<span class="rail-name">{name}</span>'
            "</a>".format(id=esc(look["id"]), strip=look["chartStrip"], name=esc(look["name"]))
        )
    return "\n".join(items)


def render_how_to_choose() -> str:
    rows = []
    for brief, start, then in HOW_TO_CHOOSE:
        rows.append(
            "<tr><td>{brief}</td><td>{start}</td><td>{then}</td></tr>".format(
                brief=linkify_look_refs(brief),
                start=linkify_look_refs(start),
                then=linkify_look_refs(then) if then else '<span class="muted">—</span>',
            )
        )
    return (
        '<details class="how-to-choose">'
        "<summary>How to choose a look</summary>"
        '<div class="how-to-choose-body">'
        '<div class="table-scroll">'
        "<table><thead><tr>"
        "<th>If the brief is…</th><th>Start with</th><th>Then consider</th>"
        "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>"
        "</div>"
        f'<p class="hint">{esc(RULE_OF_THUMB)}</p>'
        "</div>"
        "</details>"
    )


def render_install_steps() -> str:
    cols = []
    for app_name, steps in INSTALL_STEPS.items():
        items = "".join(f"<li>{esc(s)}</li>" for s in steps)
        cols.append(f'<div class="install-col"><h3>{esc(app_name)}</h3><ol>{items}</ol></div>')
    return '<div class="install-cols">' + "".join(cols) + "</div>"


def render_attribution() -> str:
    items = "".join(
        f"<li><span class=\"mono\">{esc(fname)}</span> — {esc(source)}. {esc(licence)}.</li>"
        for fname, source, licence in ATTRIBUTION_ITEMS
    )
    return (
        '<p class="footer-text">Preview photos are public-domain or CC0 sample '
        "images from the scikit-image test-data set, used only to demonstrate "
        "the LUTs.</p>"
        f'<ul class="attribution-list">{items}</ul>'
        '<p class="footer-text">Replace them with your own FX30 frames or X-T5 '
        "photos: drop files into <span class=\"mono\">lookbook/samples</span> "
        "and re-run <span class=\"mono\">tools/render_previews.py</span>, then "
        '<span class="mono">tools/build_lookbook.py</span>.</p>'
    )


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

CSS_TEXT = r"""
*, *::before, *::after { box-sizing: border-box; }

:root {
  color-scheme: dark;

  /* -- BNC Look Book tokens: dark-first (colourists judge on a dark surround) -- */
  --bg: #121214;
  --surface: #1b1b20;
  --surface-2: #242429;
  --line: #2f2f36;
  --text: #ece9e2;
  --muted: #9a978f;
  --accent: #e0a458;
  --accent-2: #4fa3a0;

  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-body: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;

  --fs-100: 0.75rem;
  --fs-200: 0.8125rem;
  --fs-300: 0.9375rem;
  --fs-400: 1rem;
  --fs-500: 1.125rem;
  --fs-600: 1.375rem;
  --fs-700: 1.75rem;
  --fs-800: clamp(2rem, 1.55rem + 1.8vw, 2.75rem);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 20px;
  --space-5: 32px;
  --space-6: 48px;

  --radius: 4px;
  --radius-lg: 10px;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --bg: #f3f1ec;
    --surface: #ffffff;
    --surface-2: #ebe8e1;
    --line: #d9d5cc;
    --text: #1b1b1f;
    --muted: #5f5d58;
    --accent: #b8782a;
    --accent-2: #2f7f7c;
  }
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f3f1ec;
  --surface: #ffffff;
  --surface-2: #ebe8e1;
  --line: #d9d5cc;
  --text: #1b1b1f;
  --muted: #5f5d58;
  --accent: #b8782a;
  --accent-2: #2f7f7c;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

[hidden] { display: none !important; }

html { text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--fs-400);
  line-height: 1.55;
  min-width: 0;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 600;
  font-optical-sizing: auto;
  text-wrap: balance;
  margin: 0;
  color: var(--text);
}

p { margin: 0; }

img { max-width: 100%; display: block; }

a { color: var(--accent-2); }
a.look-link { color: var(--accent); text-decoration-thickness: 1px; }

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.muted { color: var(--muted); }

.eyebrow {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--fs-100);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: var(--space-3);
  top: -3rem;
  background: var(--accent);
  color: var(--bg);
  padding: 0.6rem 1rem;
  border-radius: var(--radius);
  z-index: 1000;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.15s ease;
}
.skip-link:focus { top: var(--space-3); }

a:focus-visible,
button:focus-visible,
input:focus-visible,
summary:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.table-scroll { overflow-x: auto; }

/* -------------------------------------------------- page shell */

.page {
  max-width: 1400px;
  margin-inline: auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* -------------------------------------------------- header */

.site-header { display: flex; flex-direction: column; gap: var(--space-4); }

.site-header h1 {
  font-size: var(--fs-800);
  line-height: 1.05;
}

.lede {
  max-width: 68ch;
  font-size: var(--fs-500);
  color: var(--text);
}

.pipeline {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-1);
}

.pipeline-step {
  flex: 1 1 0;
  min-width: 130px;
  max-width: 220px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.pipeline-step img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.pipeline-step figcaption {
  font-size: var(--fs-100);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.pipeline-arrow {
  color: var(--muted);
  font-size: var(--fs-500);
  flex: 0 0 auto;
}

details.how-to-choose {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: var(--space-3) var(--space-4);
}

details.how-to-choose summary {
  cursor: pointer;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--fs-500);
  padding: var(--space-1) 0;
}

.how-to-choose-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.how-to-choose table,
table.rebuild {
  border-collapse: collapse;
  width: 100%;
  min-width: 640px;
  font-size: var(--fs-300);
}

.how-to-choose th, .how-to-choose td,
table.rebuild th, table.rebuild td {
  text-align: left;
  vertical-align: top;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
}

.how-to-choose thead th,
table.rebuild thead th {
  font-family: var(--font-body);
  font-weight: 600;
  text-transform: uppercase;
  font-size: var(--fs-100);
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: nowrap;
}

table.rebuild tbody td { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
table.rebuild tbody td:first-child { color: var(--accent); white-space: nowrap; }

/* -------------------------------------------------- layout: rail + main */

.layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.rail-nav {
  position: sticky;
  top: var(--space-4);
  max-height: calc(100vh - var(--space-4) * 2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: var(--space-2);
}

.rail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid transparent;
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
}

.rail-item:hover { background: var(--surface-2); }

.rail-item.is-active {
  border-left-color: var(--accent);
  background: var(--surface-2);
}

.rail-swatch {
  width: 100%;
  height: 26px;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid var(--line);
}

.rail-id { font-size: var(--fs-100); color: var(--muted); letter-spacing: 0.03em; }
.rail-name { font-family: var(--font-display); font-weight: 600; font-size: var(--fs-500); }

@media (max-width: 959px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .rail-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: visible;
    max-height: none;
  }
  .rail-item { flex: 0 0 168px; }
}

/* -------------------------------------------------- main panel */

.main-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.look-heading { display: flex; flex-direction: column; gap: var(--space-2); }
.look-heading h2 { font-size: var(--fs-700); }
.look-intent { max-width: 68ch; }
.look-usefor {
  display: flex;
  gap: var(--space-1);
  max-width: 68ch;
  color: var(--muted);
}
.field-label {
  flex-shrink: 0;
  text-transform: uppercase;
  font-size: var(--fs-100);
  letter-spacing: 0.06em;
  color: var(--muted);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-top: 1px solid var(--line);
  padding-top: var(--space-5);
}

.panel-section h3 {
  font-size: var(--fs-600);
}

.chip-row { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.chip {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--fs-100);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 7px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

.chip:hover { border-color: var(--accent); }

.chip.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}

.compare-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  touch-action: pan-y;
  --divider-pct: 50%;
  --strength: 1;
}

.compare-frame img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--surface-2);
}

#img-after {
  clip-path: inset(0 0 0 var(--divider-pct));
  opacity: var(--strength);
}

.divider-line {
  position: absolute;
  top: 0; bottom: 0;
  left: var(--divider-pct);
  width: 2px;
  background: var(--accent);
  transform: translateX(-1px);
  pointer-events: none;
}

.divider-handle {
  position: absolute;
  top: 50%;
  left: var(--divider-pct);
  transform: translate(-50%, -50%);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid var(--bg);
  box-shadow: 0 0 0 1px var(--line);
  cursor: ew-resize;
  touch-action: none;
}

.divider-handle::before {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 12px;
  height: 2px;
  background: var(--bg);
  box-shadow: 0 -4px 0 var(--bg), 0 4px 0 var(--bg);
}

.compare-caption {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  font-family: var(--font-mono);
  font-size: var(--fs-200);
  color: var(--muted);
}
#compare-look-label { color: var(--text); }

.strength-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.strength-row label {
  font-weight: 600;
  font-size: var(--fs-300);
  min-width: 5.5rem;
}

.strength-row input[type="range"] {
  flex: 1 1 220px;
  accent-color: var(--accent);
}

.strength-row output {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  min-width: 3.5ch;
  text-align: right;
}

.hint {
  max-width: 68ch;
  font-size: var(--fs-300);
  color: var(--muted);
}

.triptych {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.triptych figure { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.triptych img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.triptych figcaption {
  font-size: var(--fs-100);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 719px) {
  .triptych { grid-template-columns: 1fr; }
}

.chart-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chart-figure {
  margin: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
}
.chart-figure img { width: 100%; height: auto; }
.chart-figure figcaption {
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--fs-200);
  color: var(--muted);
  border-top: 1px solid var(--line);
}

.recipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: recipe;
  display: flex;
  flex-direction: column;
}

.recipe-list li {
  counter-increment: recipe;
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--line);
}

.recipe-list li::before {
  content: counter(recipe);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  min-width: 1.6em;
}

.recipe-list .num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.file-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
}

.file-label {
  min-width: 11rem;
  color: var(--muted);
  font-size: var(--fs-300);
}

.file-name {
  font-family: var(--font-mono);
  font-size: var(--fs-300);
  word-break: break-all;
  flex: 1 1 auto;
}

.copy-btn {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--fs-100);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
  margin-left: auto;
  min-width: 5.5rem;
}

.copy-btn:hover { border-color: var(--accent); }

.copy-btn.is-copied {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}

/* -------------------------------------------------- footer */

.site-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  border-top: 1px solid var(--line);
  padding-top: var(--space-5);
}

.footer-block { display: flex; flex-direction: column; gap: var(--space-3); }

.footer-heading { font-size: var(--fs-600); }

.install-cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.install-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.install-col h3 {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--fs-300);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.install-col ol {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--fs-300);
}

@media (max-width: 719px) {
  .install-cols { grid-template-columns: 1fr; }
}

.footer-text { max-width: 68ch; font-size: var(--fs-300); color: var(--muted); }

.attribution-list {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--fs-300);
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.footer-generated {
  font-size: var(--fs-200);
  color: var(--muted);
}
"""


# ---------------------------------------------------------------------------
# JavaScript (vanilla; __DATA_PLACEHOLDER__ is replaced with json.dumps(...))
# ---------------------------------------------------------------------------

JS_TEMPLATE = r"""
const DATA = __DATA_PLACEHOLDER__;

(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }

  var railItems = Array.prototype.slice.call(document.querySelectorAll(".rail-item"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-sample]"));

  var pipelineLookImg = byId("pipeline-look");

  var lookIdLabel = byId("look-id-label");
  var lookNameEl = byId("look-name");
  var lookIntentEl = byId("look-intent");
  var lookUseForEl = byId("look-usefor-text");

  var compareSlider = byId("compare-slider");
  var compareTriptych = byId("compare-triptych");
  var frame = byId("compare-frame");
  var handle = byId("divider-handle");
  var imgBefore = byId("img-before");
  var imgAfter = byId("img-after");
  var compareLookLabel = byId("compare-look-label");

  var strengthRange = byId("strength-range");
  var strengthValue = byId("strength-value");

  var tripCombined = byId("trip-combined");

  var chartLookImg = byId("chart-look-img");
  var chartLookCaption = byId("chart-look-caption");

  var recipeList = byId("recipe-list");
  var rebuildBody = byId("rebuild-body");

  var fileLookName = byId("file-look-name");
  var fileCombinedName = byId("file-combined-name");
  var copyLookBtn = byId("copy-look-btn");
  var copyCombinedBtn = byId("copy-combined-btn");

  var statusEl = byId("status");

  var currentSample = "astronaut";
  var currentLookId = null;

  function getLook(id) {
    for (var i = 0; i < DATA.looks.length; i++) {
      if (DATA.looks[i].id === id) return DATA.looks[i];
    }
    return DATA.looks[0];
  }

  function currentLook() { return getLook(currentLookId); }

  function currentHashId() {
    var h = (location.hash || "").replace("#", "").trim();
    for (var i = 0; i < DATA.looks.length; i++) {
      if (DATA.looks[i].id === h) return h;
    }
    return DATA.looks[0].id;
  }

  /* ---- numify: wrap numeric tokens in the recipe text for mono styling ---- */
  var NUM_RE = /[+-]?\d+(?:\.\d+)?/g;
  function numify(text) {
    var out = document.createElement("span");
    var last = 0;
    var m;
    NUM_RE.lastIndex = 0;
    while ((m = NUM_RE.exec(text))) {
      if (m.index > last) out.appendChild(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement("span");
      span.className = "num";
      span.textContent = m[0];
      out.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) out.appendChild(document.createTextNode(text.slice(last)));
    return out;
  }

  /* ------------------------------------------------------- before/after */

  function setDivider(pct) {
    pct = Math.max(0, Math.min(100, pct));
    frame.style.setProperty("--divider-pct", pct + "%");
    var rounded = Math.round(pct);
    handle.setAttribute("aria-valuenow", String(rounded));
    handle.setAttribute(
      "aria-valuetext",
      rounded + "% — " + (rounded < 50 ? "more original" : "more look")
    );
  }

  function currentDivider() {
    var raw = frame.style.getPropertyValue("--divider-pct");
    var v = parseFloat(raw);
    return isNaN(v) ? 50 : v;
  }

  function pctFromClientX(clientX) {
    var rect = frame.getBoundingClientRect();
    if (rect.width === 0) return currentDivider();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  var dragging = false;

  handle.addEventListener("pointerdown", function (e) {
    dragging = true;
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    handle.focus();
    e.preventDefault();
  });
  handle.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    setDivider(pctFromClientX(e.clientX));
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  handle.addEventListener("keydown", function (e) {
    var cur = currentDivider();
    var step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setDivider(cur - step); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { setDivider(cur + step); e.preventDefault(); }
    else if (e.key === "Home") { setDivider(0); e.preventDefault(); }
    else if (e.key === "End") { setDivider(100); e.preventDefault(); }
  });

  frame.addEventListener("pointerdown", function (e) {
    if (e.target === handle) return;
    setDivider(pctFromClientX(e.clientX));
  });

  strengthRange.addEventListener("input", function () {
    var v = parseFloat(strengthRange.value);
    frame.style.setProperty("--strength", String(v / 100));
    strengthValue.textContent = Math.round(v) + "%";
  });

  /* ------------------------------------------------------- sample chips */

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      currentSample = chip.getAttribute("data-sample");
      chips.forEach(function (c) { c.classList.toggle("is-active", c === chip); });
      renderCompare();
    });
  });

  function renderCompare() {
    var look = currentLook();
    var isDemo = currentSample === "slog3demo";
    compareSlider.hidden = isDemo;
    compareTriptych.hidden = !isDemo;

    if (isDemo) {
      tripCombined.src = look.combined;
      tripCombined.alt = look.name + " — base transform and look combined into one LUT";
    } else {
      var label = DATA.sampleLabels[currentSample];
      imgBefore.src = DATA.originals[currentSample];
      imgBefore.alt = label + " — original";
      imgAfter.src = look.samples[currentSample];
      imgAfter.alt = label + " with " + look.name + " applied";
      compareLookLabel.textContent = look.name;
    }
  }

  /* ------------------------------------------------------------ apply() */

  function applyLook(id) {
    var look = getLook(id);
    currentLookId = look.id;

    railItems.forEach(function (a) {
      var active = a.getAttribute("data-look-id") === look.id;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });

    pipelineLookImg.src = look.combined;
    pipelineLookImg.alt = look.name + " — astronaut sample after the base transform and look";

    lookIdLabel.textContent = look.id;
    lookNameEl.textContent = look.name;
    lookIntentEl.textContent = look.intent;
    lookUseForEl.textContent = look.useFor;

    renderCompare();

    chartLookImg.src = look.chartFull;
    chartLookImg.alt = look.name + " — colour chart";
    chartLookCaption.textContent = look.name;

    recipeList.innerHTML = "";
    look.recipe.forEach(function (line) {
      var li = document.createElement("li");
      li.appendChild(numify(line));
      recipeList.appendChild(li);
    });

    rebuildBody.innerHTML = "";
    look.ops.forEach(function (opName) {
      var row = DATA.opMap[opName];
      if (!row) return;
      var tr = document.createElement("tr");
      var tdTerm = document.createElement("td");
      tdTerm.textContent = row.term;
      tdTerm.title = row.what;
      var tdResolve = document.createElement("td");
      tdResolve.textContent = row.resolve;
      var tdPs = document.createElement("td");
      tdPs.textContent = row.photoshop;
      var tdAe = document.createElement("td");
      tdAe.textContent = row.ae;
      tr.appendChild(tdTerm);
      tr.appendChild(tdResolve);
      tr.appendChild(tdPs);
      tr.appendChild(tdAe);
      rebuildBody.appendChild(tr);
    });

    fileLookName.textContent = look.lutFile;
    fileCombinedName.textContent = look.combinedFile;
    copyLookBtn.setAttribute("data-value", look.lutFile);
    copyCombinedBtn.setAttribute("data-value", look.combinedFile);

    history.replaceState(null, "", "#" + look.id);
    if (statusEl) statusEl.textContent = look.name + " selected.";
  }

  window.addEventListener("hashchange", function () { applyLook(currentHashId()); });

  /* --------------------------------------------------- copy-to-clipboard */

  function setupCopyButton(btn) {
    if (!btn) return;
    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-value");
      if (!value) return;
      var done = function () {
        var original = btn.getAttribute("data-label") || btn.textContent;
        btn.setAttribute("data-label", original);
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
        window.clearTimeout(btn._copyTimer);
        btn._copyTimer = window.setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("is-copied");
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (err) { /* ignore */ }
        document.body.removeChild(ta);
        done();
      }
    });
  }
  setupCopyButton(copyLookBtn);
  setupCopyButton(copyCombinedBtn);

  /* ------------------------------------------------------------- init */

  setDivider(50);
  frame.style.setProperty("--strength", "1");
  applyLook(currentHashId());
})();
"""


# ---------------------------------------------------------------------------
# Page assembly
# ---------------------------------------------------------------------------

def render_page(data: dict) -> str:
    # "chartStrip" (the rail swatch) is only ever used server-side, to render
    # the static rail markup below -- the client-side JS never looks it up,
    # so leave it out of the JSON payload rather than shipping it twice.
    json_data = dict(data)
    json_data["looks"] = [
        {k: v for k, v in look.items() if k != "chartStrip"} for look in data["looks"]
    ]
    json_text = json.dumps(json_data, ensure_ascii=False, separators=(",", ":"))
    json_text = json_text.replace("</script", "<\\/script").replace("<!--", "<\\!--")
    js_final = JS_TEMPLATE.replace("__DATA_PLACEHOLDER__", json_text)

    built_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    rail_html = render_rail(data)
    how_to_choose_html = render_how_to_choose()
    install_html = render_install_steps()
    attribution_html = render_attribution()

    slog3_log = data["slog3Base"]["log"]
    slog3_base = data["slog3Base"]["base"]
    chart_original_full = data["chartOriginalFull"]

    # This file is written straight to disk as the finished deliverable (see
    # docs/08-lookbook.md: "The visual version with previews is
    # lookbook/index.html") -- there is no publishing step downstream that
    # wraps it in a document skeleton, so it has to be a complete, valid
    # HTML5 document itself (doctype present -> standards mode, balanced
    # html/head/body) to satisfy "valid HTML" and render correctly when
    # opened directly in a browser. <title> and <style> are still the first
    # substantive things in <head>, right after the charset declaration.
    parts = []
    parts.append("<!DOCTYPE html>")
    parts.append('<html lang="en">')
    parts.append("<head>")
    parts.append('<meta charset="utf-8">')
    parts.append("<title>BNC Look Book</title>")
    parts.append(f"<style>{CSS_TEXT}</style>")
    parts.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    parts.append(
        '<meta name="description" content="Visual reference for the BNC Grade LUT pack: '
        'thirteen looks, previewed and explained.">'
    )
    parts.append('<link rel="preconnect" href="https://fonts.googleapis.com">')
    parts.append('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
    parts.append(f'<link rel="stylesheet" href="{GOOGLE_FONTS_HREF}">')
    parts.append("</head>")
    parts.append("<body>")

    parts.append('<a class="skip-link" href="#main">Skip to look details</a>')
    parts.append('<div class="page">')

    # ---- header ----
    parts.append('<header class="site-header">')
    parts.append('<p class="eyebrow">BNC Grade — colour grading LUT pack</p>')
    parts.append("<h1>BNC Look Book</h1>")
    parts.append(
        '<p class="lede">Thirteen looks built from one small toolbox, so you can '
        "apply the LUT or rebuild it by hand in Resolve, Photoshop / Camera Raw, "
        "or After Effects.</p>"
    )
    parts.append('<div class="pipeline">')
    parts.append(
        f'<figure class="pipeline-step"><img src="{slog3_log}" alt="Astronaut sample in camera log (S-Log3)">'
        '<figcaption>Camera log</figcaption></figure>'
    )
    parts.append('<span class="pipeline-arrow" aria-hidden="true">→</span>')
    parts.append(
        f'<figure class="pipeline-step"><img src="{slog3_base}" alt="Astronaut sample after the base transform LUT">'
        '<figcaption>Base transform</figcaption></figure>'
    )
    parts.append('<span class="pipeline-arrow" aria-hidden="true">→</span>')
    parts.append(
        '<figure class="pipeline-step"><img id="pipeline-look" alt="Astronaut sample after the selected look">'
        '<figcaption>Look</figcaption></figure>'
    )
    parts.append("</div>")  # .pipeline
    parts.append(how_to_choose_html)
    parts.append("</header>")

    # ---- rail + main ----
    parts.append('<div class="layout">')
    parts.append('<nav class="rail-nav" aria-label="Looks">')
    parts.append(rail_html)
    parts.append("</nav>")

    parts.append('<main id="main" class="main-panel">')

    parts.append('<div class="look-heading">')
    parts.append('<p class="eyebrow mono" id="look-id-label">L01</p>')
    parts.append('<h2 id="look-name">Clean</h2>')
    parts.append('<p class="look-intent" id="look-intent"></p>')
    parts.append(
        '<p class="look-usefor"><span class="field-label">Use for</span>'
        '<span id="look-usefor-text"></span></p>'
    )
    parts.append("</div>")  # .look-heading

    # before/after
    parts.append('<section class="panel-section" aria-labelledby="compare-heading">')
    parts.append('<h3 id="compare-heading">Before / after</h3>')
    parts.append('<div class="chip-row" role="group" aria-label="Sample image">')
    parts.append('<button type="button" class="chip is-active" data-sample="astronaut">Astronaut</button>')
    parts.append('<button type="button" class="chip" data-sample="coffee">Coffee</button>')
    parts.append('<button type="button" class="chip" data-sample="chelsea">Chelsea</button>')
    parts.append('<button type="button" class="chip" data-sample="rocket">Rocket</button>')
    parts.append('<button type="button" class="chip" data-sample="slog3demo">S-Log3 demo</button>')
    parts.append("</div>")  # .chip-row

    parts.append('<div id="compare-slider">')
    parts.append('<div class="compare-frame" id="compare-frame">')
    parts.append('<img id="img-before" alt="">')
    parts.append('<img id="img-after" alt="">')
    parts.append('<div class="divider-line" aria-hidden="true"></div>')
    parts.append(
        '<div class="divider-handle" id="divider-handle" role="slider" tabindex="0" '
        'aria-label="Comparison split position" aria-orientation="horizontal" '
        'aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"></div>'
    )
    parts.append("</div>")  # .compare-frame
    parts.append(
        '<p class="compare-caption"><span>Original</span><span aria-hidden="true">↔</span>'
        '<span id="compare-look-label">Clean</span></p>'
    )
    parts.append('<div class="strength-row">')
    parts.append('<label for="strength-range">Strength</label>')
    parts.append(
        '<input type="range" id="strength-range" min="0" max="100" value="100" step="1" '
        'aria-describedby="strength-hint">'
    )
    parts.append('<output id="strength-value" for="strength-range">100%</output>')
    parts.append("</div>")  # .strength-row
    parts.append(
        '<p class="hint" id="strength-hint">Strength blends the look over the original at this '
        "percentage — the same control as Key Output Gain in Resolve, layer opacity in "
        "Photoshop, or Intensity in Lumetri.</p>"
    )
    parts.append("</div>")  # #compare-slider

    parts.append('<div id="compare-triptych" hidden>')
    parts.append('<div class="triptych">')
    parts.append(
        f'<figure><img id="trip-log" src="{slog3_log}" alt="Astronaut sample in camera log">'
        "<figcaption>Camera log</figcaption></figure>"
    )
    parts.append(
        f'<figure><img id="trip-base" src="{slog3_base}" alt="Astronaut sample after the base transform">'
        "<figcaption>Base transform</figcaption></figure>"
    )
    parts.append(
        '<figure><img id="trip-combined" alt=""><figcaption>Base + look (combined LUT)</figcaption></figure>'
    )
    parts.append("</div>")  # .triptych
    parts.append(
        '<p class="hint">The combined LUT applies the base transform and the look in a single '
        "pass, for delivering directly from S-Log3 footage.</p>"
    )
    parts.append("</div>")  # #compare-triptych
    parts.append("</section>")

    # chart row
    parts.append('<section class="panel-section" aria-labelledby="chart-heading">')
    parts.append('<h3 id="chart-heading">Colour chart</h3>')
    parts.append(
        '<p class="hint">ColorChecker row, grey ramp and hue/saturation wheel, before and after '
        "the look — use these to see exactly what moved.</p>"
    )
    parts.append('<div class="chart-row">')
    parts.append(
        f'<figure class="chart-figure"><img src="{chart_original_full}" '
        'alt="Reference chart, untouched: ColorChecker row, grey ramp and hue/saturation wheel">'
        "<figcaption>Original</figcaption></figure>"
    )
    parts.append(
        '<figure class="chart-figure"><img id="chart-look-img" alt="">'
        '<figcaption id="chart-look-caption">Clean</figcaption></figure>'
    )
    parts.append("</div>")  # .chart-row
    parts.append("</section>")

    # recipe
    parts.append('<section class="panel-section" aria-labelledby="recipe-heading">')
    parts.append('<h3 id="recipe-heading">Recipe</h3>')
    parts.append(
        '<p class="hint">The operations that make up this look, in order — order is real '
        "information here.</p>"
    )
    parts.append('<ol class="recipe-list" id="recipe-list"></ol>')
    parts.append("</section>")

    # rebuild by hand
    parts.append('<section class="panel-section" aria-labelledby="rebuild-heading">')
    parts.append('<h3 id="rebuild-heading">Rebuild it by hand</h3>')
    parts.append(
        '<p class="hint">Where to find the control for each operation this look uses, in three '
        "apps.</p>"
    )
    parts.append('<div class="table-scroll">')
    parts.append(
        '<table class="rebuild"><thead><tr><th>Operation</th><th>Resolve</th>'
        "<th>Photoshop / Camera Raw</th><th>After Effects</th></tr></thead>"
        '<tbody id="rebuild-body"></tbody></table>'
    )
    parts.append("</div>")  # .table-scroll
    parts.append("</section>")

    # files
    parts.append('<section class="panel-section" aria-labelledby="files-heading">')
    parts.append('<h3 id="files-heading">Files</h3>')
    parts.append('<div class="file-row">')
    parts.append('<span class="file-label">Look LUT</span>')
    parts.append('<span class="file-name" id="file-look-name"></span>')
    parts.append('<button type="button" class="copy-btn" id="copy-look-btn" data-value="">Copy</button>')
    parts.append("</div>")
    parts.append('<div class="file-row">')
    parts.append('<span class="file-label">Combined S-Log3 LUT</span>')
    parts.append('<span class="file-name" id="file-combined-name"></span>')
    parts.append('<button type="button" class="copy-btn" id="copy-combined-btn" data-value="">Copy</button>')
    parts.append("</div>")
    parts.append("</section>")

    parts.append("</main>")
    parts.append("</div>")  # .layout

    # ---- footer ----
    parts.append('<footer class="site-footer">')
    parts.append('<div class="footer-block"><h2 class="footer-heading">Installing the LUTs</h2>')
    parts.append(install_html)
    parts.append("</div>")
    parts.append('<div class="footer-block"><h2 class="footer-heading">Sample images</h2>')
    parts.append(attribution_html)
    parts.append(
        f'<p class="footer-generated">Generated by <span class="mono">tools/build_lookbook.py</span> '
        f'on <span class="mono">{built_date}</span>.</p>'
    )
    parts.append("</div>")
    parts.append("</footer>")

    parts.append("</div>")  # .page

    parts.append('<p id="status" class="sr-only" role="status" aria-live="polite"></p>')

    parts.append(f"<script>{js_final}</script>")

    parts.append("</body>")
    parts.append("</html>")

    return "\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    data = build_page_data()
    page = render_page(data)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(page, encoding="utf-8")

    size = OUT_PATH.stat().st_size
    budget = 12 * 1024 * 1024
    print(f"\nWrote {OUT_PATH} -- {size:,} bytes ({size / 1024 / 1024:.2f} MiB)")
    if size > budget:
        print(
            f"WARNING: output is over the 12 MiB budget "
            f"({size / 1024 / 1024:.2f} MiB > {budget / 1024 / 1024:.0f} MiB). "
            "If you replaced the sample images, re-check their resolution before "
            "re-running render_previews.py.",
            file=sys.stderr,
        )
    else:
        print(f"Under budget: {(budget - size) / 1024 / 1024:.2f} MiB to spare.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
