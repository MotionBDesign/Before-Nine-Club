#!/usr/bin/env python3
"""build_luts.py -- writes all 29 BNC Grade .cube files (SPEC.md section 7).

    01_technical/BNC_Base_SLog3-SGamut3Cine_to_Rec709-G24.cube
    01_technical/BNC_Base_FLog2-FGamut_to_Rec709-G24.cube
    01_technical/BNC_Base_FLog-FGamut_to_Rec709-G24.cube
    02_looks/BNC_L01_Clean.cube ... BNC_L13_Airy.cube        (Rec.709 -> Rec.709)
    03_combined_slog3/BNC_SLog3_L01_Clean.cube ... L13       (S-Log3 -> base -> look)

Combined LUTs are computed analytically -- base_transform then apply_look on
the same lattice input, never by sampling one .cube through another.

    python3 tools/build_luts.py [--out luts] [--size 33] [--prefix BNC]
                                 [--only technical|looks|combined]
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bnc_color as bc
import bnc_looks as bl
from lut_apply import write_cube

TOOLS_DIR = Path(__file__).resolve().parent
COLOR_GRADING_ROOT = TOOLS_DIR.parent

CAMERA_INFO = {
    "slog3": dict(
        filename="Base_SLog3-SGamut3Cine_to_Rec709-G24.cube",
        title="BNC Base SLog3-SGamut3Cine to Rec709-G24",
        description="Sony S-Log3/S-Gamut3.Cine (FX30) to Rec.709 Gamma 2.4, filmic highlight roll-off",
        input_space="S-Log3 / S-Gamut3.Cine",
    ),
    "flog2": dict(
        filename="Base_FLog2-FGamut_to_Rec709-G24.cube",
        title="BNC Base FLog2-FGamut to Rec709-G24",
        description="Fujifilm F-Log2/F-Gamut (X-T5) to Rec.709 Gamma 2.4, filmic highlight roll-off",
        input_space="F-Log2 / F-Gamut",
    ),
    "flog": dict(
        filename="Base_FLog-FGamut_to_Rec709-G24.cube",
        title="BNC Base FLog-FGamut to Rec709-G24",
        description="Fujifilm F-Log/F-Gamut (X-T5) to Rec.709 Gamma 2.4, filmic highlight roll-off",
        input_space="F-Log / F-Gamut",
    ),
}

CAMERA_ORDER = ["slog3", "flog2", "flog"]


def make_lattice_in(n: int) -> np.ndarray:
    """The (N,N,N,3) input lattice, indexed [b,g,r], where lattice[b,g,r] =
    (r/(N-1), g/(N-1), b/(N-1)) -- i.e. exactly the red-fastest .cube domain.
    """
    coord = np.arange(n, dtype=np.float64) / (n - 1)
    b_idx, g_idx, r_idx = np.meshgrid(coord, coord, coord, indexing="ij")
    return np.stack([r_idx, g_idx, b_idx], axis=-1)


def grey_axis_check(lattice: np.ndarray):
    """Sample the diagonal r=g=b=i/(N-1); return (non_decreasing, max_spread)."""
    n = lattice.shape[0]
    diag = np.array([lattice[i, i, i] for i in range(n)])
    Y = bc.luma(bc.to_lin(diag))
    non_decreasing = bool(np.all(np.diff(Y) >= -1e-6))
    spread = float(np.max(np.ptp(diag, axis=-1)))
    return non_decreasing, spread


def write_and_report(path: Path, lattice: np.ndarray, title, description, input_space, prefix_label):
    path.parent.mkdir(parents=True, exist_ok=True)
    write_cube(str(path), lattice, title, description, input_space)
    n = lattice.shape[0]
    mn, mx = float(lattice.min()), float(lattice.max())
    grey_ok, spread = grey_axis_check(lattice)
    finite = bool(np.all(np.isfinite(lattice)))
    status = "OK" if (finite and grey_ok and -1e-6 <= mn and mx <= 1.0 + 1e-6) else "CHECK"
    try:
        shown_path = path.relative_to(COLOR_GRADING_ROOT)
    except ValueError:
        shown_path = path
    print(
        f"  {shown_path!s:55s} "
        f"N={n:3d}  min={mn:8.5f}  max={mx:8.5f}  "
        f"grey_nondec={grey_ok!s:5}  grey_spread={spread:.5f}  [{status}]"
    )
    return status == "OK"


def build_technical(out_root: Path, size: int, prefix: str) -> bool:
    print(f"\n[technical]  size={size}")
    ok = True
    lattice_in = make_lattice_in(size)
    for cam in CAMERA_ORDER:
        info = CAMERA_INFO[cam]
        lattice_out = bc.base_transform(lattice_in, camera=cam)
        # on-disk name is "<prefix>_<filename>"; filename carries no prefix token.
        path = out_root / "01_technical" / f"{prefix}_{info['filename']}"
        title = info["title"].replace("BNC", prefix, 1)
        ok &= write_and_report(path, lattice_out, title, info["description"], info["input_space"], prefix)
    return ok


def build_looks(out_root: Path, prefix: str) -> bool:
    print(f"\n[looks]  size=33")
    ok = True
    lattice_in = make_lattice_in(33)
    for look in bl.LOOKS:
        lattice_out = bc.apply_look(lattice_in, look.ops)
        path = out_root / "02_looks" / f"{prefix}_{look.id}_{look.slug}.cube"
        title = f"{prefix} {look.id} {look.slug}"
        description = f"{look.intent}"
        ok &= write_and_report(path, lattice_out, title, description, "Rec.709 Gamma 2.4", prefix)
    return ok


def build_combined_slog3(out_root: Path, prefix: str) -> bool:
    print(f"\n[combined_slog3]  size=33")
    ok = True
    lattice_in = make_lattice_in(33)
    lattice_base = bc.base_transform(lattice_in, camera="slog3")  # analytic, same lattice
    for look in bl.LOOKS:
        lattice_out = bc.apply_look(lattice_base, look.ops)  # base then look, no LUT-of-LUT
        path = out_root / "03_combined_slog3" / f"{prefix}_SLog3_{look.id}_{look.slug}.cube"
        title = f"{prefix} SLog3 {look.id} {look.slug}"
        description = f"S-Log3/S-Gamut3.Cine -> BNC Base -> {look.intent}"
        ok &= write_and_report(path, lattice_out, title, description, "S-Log3 / S-Gamut3.Cine", prefix)
    return ok


def main():
    ap = argparse.ArgumentParser(description="Build all BNC Grade .cube LUTs.")
    ap.add_argument("--out", default="luts", help="output dir, relative to color-grading/ (default: luts)")
    ap.add_argument("--size", type=int, default=33, help="lattice size for TECHNICAL luts only (default: 33)")
    ap.add_argument("--prefix", default="BNC", help="filename prefix (default: BNC)")
    ap.add_argument("--only", choices=["technical", "looks", "combined"], default=None,
                     help="build only one group (default: all)")
    args = ap.parse_args()

    out_root = Path(args.out)
    if not out_root.is_absolute():
        out_root = COLOR_GRADING_ROOT / out_root
    out_root.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    ok = True
    if args.only in (None, "technical"):
        ok &= build_technical(out_root, args.size, args.prefix)
    if args.only in (None, "looks"):
        ok &= build_looks(out_root, args.prefix)
    if args.only in (None, "combined"):
        ok &= build_combined_slog3(out_root, args.prefix)
    dt = time.time() - t0

    print(f"\nDone in {dt:.2f}s. {'All OK.' if ok else 'SOME FILES FAILED CHECKS -- see [CHECK] above.'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
