#!/usr/bin/env python3
"""render_previews.py -- builds the lookbook previews (SPEC.md section 10).

Reads lookbook/samples/*.png|jpg, writes into lookbook/previews/:
  <sample>__original.jpg
  <sample>__L01_Clean.jpg ... __L13_Airy.jpg   (Rec.709 look .cube applied)
  <sample>__slog3.jpg                           (synthetic S-Log3 demo)
  <sample>__base709.jpg                         (technical LUT applied)
  <sample>__SLog3_L01_Clean.jpg ... _L13_Airy.jpg (combined LUTs applied)
  chart__original.png, chart__L01_Clean.png ... (synthesised charts)
  index.json

Interpretive note (spec gives one filename pattern, "chart__<look>.png", for
three distinct 1200x300 chart elements): this renders each of the three
elements at its stated 1200x300 size and stacks them into one 1200x900
composite per look, so the single naming pattern is satisfied literally.
Charts keep their synthesised size (not the 720px preview cap, which is for
the photographic sample previews) and are saved as PNG.

Every LUT application here goes through the actual built .cube files (via
lut_apply.apply_lut, tetrahedral) rather than the analytic bnc_color
functions directly, so the previews show what the delivered LUTs do.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bnc_color as bc
import bnc_looks as bl
from lut_apply import read_cube, apply_lut

TOOLS_DIR = Path(__file__).resolve().parent
COLOR_GRADING_ROOT = TOOLS_DIR.parent
SAMPLES_DIR = COLOR_GRADING_ROOT / "lookbook" / "samples"
PREVIEWS_DIR = COLOR_GRADING_ROOT / "lookbook" / "previews"
LUTS_DIR = COLOR_GRADING_ROOT / "luts"

PREVIEW_LONG_EDGE = 720
JPEG_QUALITY = 85
CHART_W, CHART_H = 1200, 300

# The X-Rite ColorChecker 2005 published sRGB values (SPEC.md section 10).
COLORCHECKER_24 = [
    ("dark skin", (115, 82, 68)), ("light skin", (194, 150, 130)),
    ("blue sky", (98, 122, 157)), ("foliage", (87, 108, 67)),
    ("blue flower", (133, 128, 177)), ("bluish green", (103, 189, 170)),
    ("orange", (214, 126, 44)), ("purplish blue", (80, 91, 166)),
    ("moderate red", (193, 90, 99)), ("purple", (94, 60, 108)),
    ("yellow green", (157, 188, 64)), ("orange yellow", (224, 163, 46)),
    ("blue", (56, 61, 150)), ("green", (70, 148, 73)),
    ("red", (175, 54, 60)), ("yellow", (231, 199, 31)),
    ("magenta", (187, 86, 149)), ("cyan", (8, 133, 161)),
    ("white", (243, 243, 242)), ("neutral 8", (200, 200, 200)),
    ("neutral 6.5", (160, 160, 160)), ("neutral 5", (122, 122, 122)),
    ("neutral 3.5", (85, 85, 85)), ("black", (52, 52, 52)),
]


# --------------------------------------------------------------------- I/O

def load_sample(path: Path) -> np.ndarray:
    """Load an sRGB 8-bit image as a float64 (H,W,3) array in [0,1]."""
    img = Image.open(path).convert("RGB")
    return np.asarray(img, dtype=np.float64) / 255.0


def to_uint8(arr: np.ndarray) -> np.ndarray:
    return np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8)


def resize_long_edge(img: Image.Image, max_edge: int = PREVIEW_LONG_EDGE) -> Image.Image:
    """Downscale (never upscale) so the long edge is at most `max_edge`."""
    w, h = img.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return img
    scale = max_edge / long_edge
    new_size = (max(1, round(w * scale)), max(1, round(h * scale)))
    return img.resize(new_size, Image.LANCZOS)


def save_preview_jpeg(arr: np.ndarray, path: Path) -> None:
    """Resize (long edge <= 720) and save a float [0,1] array as JPEG q85."""
    img = Image.fromarray(to_uint8(arr), mode="RGB")
    img = resize_long_edge(img, PREVIEW_LONG_EDGE)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="JPEG", quality=JPEG_QUALITY)


def save_chart_png(arr: np.ndarray, path: Path) -> None:
    """Save a float [0,1] array as PNG at its native (synthesised) size."""
    img = Image.fromarray(to_uint8(arr), mode="RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")


# ------------------------------------------------------------- chart build

def build_checker_strip() -> np.ndarray:
    """24-patch ColorChecker-style strip, 1200x300, equal-width columns."""
    n = len(COLORCHECKER_24)
    col_w = CHART_W // n
    strip = np.zeros((CHART_H, CHART_W, 3), dtype=np.float64)
    for i, (_name, rgb8) in enumerate(COLORCHECKER_24):
        x0 = i * col_w
        x1 = CHART_W if i == n - 1 else (i + 1) * col_w
        strip[:, x0:x1, :] = np.array(rgb8, dtype=np.float64) / 255.0
    return strip


def build_grey_ramp() -> np.ndarray:
    """A 0->1 grey ramp (as display code), 1200x300."""
    ramp = np.linspace(0.0, 1.0, CHART_W, dtype=np.float64)
    return np.repeat(ramp[None, :, None], CHART_H, axis=0).repeat(3, axis=2)


def build_hue_sat_wheel() -> np.ndarray:
    """Hue (x, 0-360 deg) vs saturation (y, chroma 0->0.32 in Oklab) at a
    fixed lightness. Rectangular (not circular) to fit the shared 1200x300
    chart canvas; the sRGB gamut boundary shows up naturally via gamut_clip
    as saturation increases toward the top/bottom of the frame.
    """
    xs = np.linspace(0.0, 360.0, CHART_W, endpoint=False)
    ys = np.linspace(0.0, 1.0, CHART_H)
    hue_grid, sat_grid = np.meshgrid(xs, ys)  # both (H, W)
    L = 0.70
    C_MAX = 0.32
    C = sat_grid * C_MAX
    rad = np.radians(hue_grid)
    lab = np.stack([np.full_like(C, L), C * np.cos(rad), C * np.sin(rad)], axis=-1)
    lin = bc.gamut_clip(bc.oklab_to_linear(lab))
    return bc.to_code(lin)


def build_chart_composite() -> np.ndarray:
    """Stack the three 1200x300 chart elements into one 1200x900 image."""
    return np.concatenate([build_checker_strip(), build_grey_ramp(), build_hue_sat_wheel()], axis=0)


# ------------------------------------------------------------------- main

def main():
    t0 = time.time()
    PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading look .cube LUTs ...")
    look_lattices = {}
    for look in bl.LOOKS:
        path = LUTS_DIR / "02_looks" / f"BNC_{look.id}_{look.slug}.cube"
        _n, lattice, _title = read_cube(str(path))
        look_lattices[look.id] = lattice

    print("Loading technical S-Log3 .cube ...")
    _n, tech_slog3, _title = read_cube(str(LUTS_DIR / "01_technical" / "BNC_Base_SLog3-SGamut3Cine_to_Rec709-G24.cube"))

    print("Loading combined S-Log3 .cube LUTs ...")
    combined_lattices = {}
    for look in bl.LOOKS:
        path = LUTS_DIR / "03_combined_slog3" / f"BNC_SLog3_{look.id}_{look.slug}.cube"
        _n, lattice, _title = read_cube(str(path))
        combined_lattices[look.id] = lattice

    index = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "preview_long_edge": PREVIEW_LONG_EDGE,
        "jpeg_quality": JPEG_QUALITY,
        "samples": {},
        "charts": {"size_per_element": [CHART_W, CHART_H], "composite_size": [CHART_W, CHART_H * 3]},
    }

    sample_paths = sorted(
        p for p in SAMPLES_DIR.iterdir()
        if p.suffix.lower() in (".png", ".jpg", ".jpeg")
    )
    print(f"\nFound {len(sample_paths)} sample image(s): {[p.name for p in sample_paths]}")

    n_written = 0
    for sample_path in sample_paths:
        stem = sample_path.stem
        print(f"\n[{stem}]")
        rgb = load_sample(sample_path)
        entry = {"looks": {}, "combined": {}}

        # __original.jpg
        out_path = PREVIEWS_DIR / f"{stem}__original.jpg"
        save_preview_jpeg(rgb, out_path)
        entry["original"] = out_path.name
        n_written += 1

        # __L01_Clean.jpg ... (Rec.709 look LUT applied to the sRGB image)
        for look in bl.LOOKS:
            out = apply_lut(rgb, look_lattices[look.id])
            fname = f"{stem}__{look.id}_{look.slug}.jpg"
            save_preview_jpeg(out, PREVIEWS_DIR / fname)
            entry["looks"][look.id] = fname
            n_written += 1

        # Synthetic S-Log3 demo: sRGB -> linear (2.2) -> scale to sensible
        # scene-linear -> Rec.709->S-Gamut3.Cine -> S-Log3 encode.
        lin22 = rgb ** 2.2
        mean_Y = float(bc.luma(lin22).mean())
        scale = float(np.clip(0.18 / max(mean_Y, 1e-6), 0.5, 2.0))
        scene_lin = lin22 * scale
        sgamut_lin = bc.apply_matrix(scene_lin, bc.M_709_TO_SGAMUT3CINE)
        slog3_code = np.clip(bc.slog3_encode(sgamut_lin), 0.0, 1.0)

        fname = f"{stem}__slog3.jpg"
        save_preview_jpeg(slog3_code, PREVIEWS_DIR / fname)
        entry["slog3"] = fname
        entry["slog3_exposure_scale"] = scale
        n_written += 1

        base_out = apply_lut(slog3_code, tech_slog3)
        fname = f"{stem}__base709.jpg"
        save_preview_jpeg(base_out, PREVIEWS_DIR / fname)
        entry["base709"] = fname
        n_written += 1

        for look in bl.LOOKS:
            out = apply_lut(slog3_code, combined_lattices[look.id])
            fname = f"{stem}__SLog3_{look.id}_{look.slug}.jpg"
            save_preview_jpeg(out, PREVIEWS_DIR / fname)
            entry["combined"][look.id] = fname
            n_written += 1

        index["samples"][stem] = entry
        print(f"  wrote {3 + 2 * len(bl.LOOKS)} files")

    # Charts
    print("\n[charts]")
    chart = build_chart_composite()
    save_chart_png(chart, PREVIEWS_DIR / "chart__original.png")
    charts_entry = {"original": "chart__original.png", "looks": {}}
    n_written += 1
    for look in bl.LOOKS:
        out = apply_lut(chart, look_lattices[look.id])
        fname = f"chart__{look.id}_{look.slug}.png"
        save_chart_png(out, PREVIEWS_DIR / fname)
        charts_entry["looks"][look.id] = fname
        n_written += 1
    index["charts"].update(charts_entry)
    print(f"  wrote {1 + len(bl.LOOKS)} files")

    index["counts"] = {"files_written": n_written, "samples": len(sample_paths), "looks": len(bl.LOOKS)}
    with open(PREVIEWS_DIR / "index.json", "w") as f:
        json.dump(index, f, indent=2)
    n_written += 1

    dt = time.time() - t0
    print(f"\nWrote {n_written} files to {PREVIEWS_DIR.relative_to(COLOR_GRADING_ROOT)} in {dt:.2f}s.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
