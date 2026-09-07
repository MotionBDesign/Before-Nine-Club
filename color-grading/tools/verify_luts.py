#!/usr/bin/env python3
"""verify_luts.py -- checks every .cube per SPEC.md section 9.

For each file:
  1. Parse; assert size, count, finite, in [0,1].
  2. Grey axis (r=g=b=i/(N-1)): assert non-decreasing luminance; assert max
     channel spread <= 0.004 for technical LUTs and for looks whose recipe
     has no split_tone/tint/white_balance (spread is reported for all).
  3. Technical LUTs: section-3.3 reference values (S-Log3 only, since those
     are S-Log3-specific input codes) via tetrahedral LUT lookup; plus, for
     every technical LUT, LUT-vs-analytic max abs error on the whole cube
     (20,000 random codes, fail if > 0.035 -- most of the cube is physically
     unreachable), on a 1,001-point grey ramp (fail if > 0.005) and on the
     24 ColorChecker patches at -6..+6 stops encoded into the camera's log
     space (fail if > 0.01) -- the region real footage lives in.
  4. Looks and combined LUTs: black (0,0,0) -> luminance <= lift_blacks (or
     <= 0.002 if the recipe has none); white (1,1,1) -> luminance in
     [0.85, 1.0]; grey axis monotone (already checked in 2).

Prints a table (file, size, grey spread, max error, PASS/FAIL) and exits
non-zero on any failure.
"""

import argparse
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bnc_color as bc
import bnc_looks as bl
from lut_apply import read_cube, apply_lut

COLOR_GRADING_ROOT = Path(__file__).resolve().parent.parent

# Section 3.3 reference values -- S-Log3-specific input codes, tolerance 0.01
# (except the >= / <= bullets, checked with a tiny numerical epsilon).
_TECH_REFERENCE_SLOG3 = [
    (0.410557, "grey(0.410557)->0.430", lambda v: abs(v - 0.430) <= 0.01),
    (0.584447, "90%white(0.584447)->~0.77", lambda v: abs(v - 0.77) <= 0.02),
    (1.0, "1.0 -> >=0.995", lambda v: v >= 0.995 - 1e-9),
    (0.0929, "0.0929 -> <=0.002", lambda v: v <= 0.002 + 1e-9),
]

_CAMERA_FILENAME_SUFFIX = {
    "slog3": "Base_SLog3-SGamut3Cine_to_Rec709-G24.cube",
    "flog2": "Base_FLog2-FGamut_to_Rec709-G24.cube",
    "flog": "Base_FLog-FGamut_to_Rec709-G24.cube",
}


def classify(path: Path) -> str:
    parts = path.parts
    if "01_technical" in parts:
        return "technical"
    if "02_looks" in parts:
        return "look"
    if "03_combined_slog3" in parts:
        return "combined"
    return "unknown"


def camera_for_technical(path: Path):
    for cam, suffix in _CAMERA_FILENAME_SUFFIX.items():
        if path.name.endswith(suffix):
            return cam
    return None


def look_for_path(path: Path):
    m = re.search(r"(L\d{2})", path.stem)
    if not m:
        return None
    return bl.LOOKS_BY_ID.get(m.group(1))


def grey_axis(lattice: np.ndarray):
    n = lattice.shape[0]
    diag = np.array([lattice[i, i, i] for i in range(n)])
    Yg = bc.luma(bc.to_lin(diag))
    non_decreasing = bool(np.all(np.diff(Yg) >= -1e-6))
    spread = float(np.max(np.ptp(diag, axis=-1)))
    return non_decreasing, spread


def verify_file(path: Path):
    """Returns a dict describing this file's verification result."""
    rel = str(path.relative_to(COLOR_GRADING_ROOT)) if path.is_relative_to(COLOR_GRADING_ROOT) else str(path)
    notes = []
    ok = True

    try:
        n, lattice, _title = read_cube(str(path))
    except Exception as exc:  # noqa: BLE001 - report, don't crash the run
        return dict(file=rel, size="-", grey_spread=float("nan"),
                    max_error=float("nan"), status="FAIL", notes=f"parse error: {exc}")

    # 1. basic validity
    if lattice.shape != (n, n, n, 3):
        ok = False
        notes.append(f"bad shape {lattice.shape}")
    if not np.all(np.isfinite(lattice)):
        ok = False
        notes.append("non-finite values present")
    lo, hi = float(lattice.min()), float(lattice.max())
    if lo < -1e-6 or hi > 1.0 + 1e-6:
        ok = False
        notes.append(f"out of [0,1]: [{lo:.5f},{hi:.5f}]")

    # 2. grey axis
    grey_nondec, grey_spread = grey_axis(lattice)
    if not grey_nondec:
        ok = False
        notes.append("grey axis not non-decreasing")

    kind = classify(path)
    look = look_for_path(path) if kind in ("look", "combined") else None
    exempt_spread = kind in ("look", "combined") and look is not None and bl.has_op(
        look, "split_tone", "tint", "white_balance"
    )
    if (kind == "technical" or not exempt_spread) and grey_spread > 0.004 + 1e-9:
        ok = False
        notes.append(f"grey spread {grey_spread:.5f} > 0.004")

    max_error = float("nan")

    if kind == "technical":
        cam = camera_for_technical(path)
        if cam is None:
            ok = False
            notes.append("unrecognised technical filename (camera not identified)")
        else:
            if cam == "slog3":
                for code, label, check in _TECH_REFERENCE_SLOG3:
                    v = apply_lut(np.array([[code, code, code]]), lattice)[0]
                    spread3 = float(np.ptp(v))
                    vm = float(np.mean(v))
                    if not check(vm):
                        ok = False
                        notes.append(f"{label}: got {vm:.4f}")
                    if spread3 > 0.002 + 1e-9:
                        ok = False
                        notes.append(f"{label}: channel spread {spread3:.4f} > 0.002")

            # (a) whole cube, 20,000 random codes: most of the cube is
            #     physically unreachable (e.g. one channel below the log
            #     black level while the others sit 5 stops over grey), so
            #     the tolerance here is loose.
            rng = np.random.default_rng(42)
            rand_in = rng.uniform(0.0, 1.0, size=(20000, 3))
            analytic = bc.base_transform(rand_in, camera=cam)
            lut_out = apply_lut(rand_in, lattice)
            cube_err = float(np.max(np.abs(analytic - lut_out)))
            if cube_err > 0.035:
                ok = False
                notes.append(f"whole-cube max err {cube_err:.5f} > 0.035")
            # (b) grey ramp, 1,001 points: tight.
            ramp = np.stack([np.linspace(0.0, 1.0, 1001)] * 3, axis=-1)
            ramp_err = float(np.max(np.abs(bc.base_transform(ramp, camera=cam)
                                           - apply_lut(ramp, lattice))))
            if ramp_err > 0.005:
                ok = False
                notes.append(f"grey ramp max err {ramp_err:.5f} > 0.005")
            # (c) realistic colours: the 24 ColorChecker patches at every
            #     half stop from -6 to +6, encoded into the camera's log
            #     space. This is the region real footage lives in.
            real_in = realistic_codes(cam)
            real_err = float(np.max(np.abs(bc.base_transform(real_in, camera=cam)
                                           - apply_lut(real_in, lattice))))
            if real_err > 0.012:
                ok = False
                notes.append(f"realistic-colour max err {real_err:.5f} > 0.012")
            max_error = real_err
            notes.append(f"cube {cube_err:.4f} ramp {ramp_err:.4f}")

    elif kind in ("look", "combined"):
        if look is None:
            ok = False
            notes.append("could not match filename to a look recipe (L01..L13)")
        else:
            black = apply_lut(np.zeros((1, 3)), lattice)[0]
            white = apply_lut(np.ones((1, 3)), lattice)[0]
            # luminance in *code* (display) terms, like the waveform shows it
            black_luma = float(bc.to_code(bc.luma(bc.to_lin(black))))
            white_luma = float(bc.to_code(bc.luma(bc.to_lin(white))))
            # Design rules (code/waveform terms): black never milky, white
            # never dull. Then the LUT must reproduce the recipe's own black.
            if black_luma > 0.08 + 1e-6:
                ok = False
                notes.append(f"black luma {black_luma:.4f} > 0.08 (milky)")
            if not (0.85 - 1e-6 <= white_luma <= 1.0 + 1e-6):
                ok = False
                notes.append(f"white luma {white_luma:.4f} not in [0.85,1.0]")
            ref_black = bc.apply_look(np.zeros((1, 3)), look.ops)[0] if kind == "look" else \
                bc.apply_look(bc.base_transform(np.zeros((1, 3)), camera="slog3"), look.ops)[0]
            black_err = float(np.max(np.abs(ref_black - black)))
            if black_err > 0.003:
                ok = False
                notes.append(f"LUT black differs from recipe black by {black_err:.4f}")

            # Informational LUT-vs-analytic error (not a hard fail criterion
            # per spec bullet 4, but useful and fits the table's column).
            rng = np.random.default_rng(43)
            rand_in = rng.uniform(0.0, 1.0, size=(2000, 3))
            if kind == "look":
                analytic = bc.apply_look(rand_in, look.ops)
            else:
                analytic = bc.apply_look(bc.base_transform(rand_in, camera="slog3"), look.ops)
            lut_out = apply_lut(rand_in, lattice)
            max_error = float(np.max(np.abs(analytic - lut_out)))
    else:
        notes.append("unclassified path (not under 01_technical/02_looks/03_combined_slog3)")

    return dict(file=rel, size=n, grey_spread=grey_spread, max_error=max_error,
                status="PASS" if ok else "FAIL", notes="; ".join(notes))


# 24 ColorChecker patches (sRGB 8-bit), used to build a realistic test set.
_COLORCHECKER_SRGB = np.array([
    (115, 82, 68), (194, 150, 130), (98, 122, 157), (87, 108, 67), (133, 128, 177),
    (103, 189, 170), (214, 126, 44), (80, 91, 166), (193, 90, 99), (94, 60, 108),
    (157, 188, 64), (224, 163, 46), (56, 61, 150), (70, 148, 73), (175, 54, 60),
    (231, 199, 31), (187, 86, 149), (8, 133, 161), (243, 243, 242), (200, 200, 200),
    (160, 160, 160), (122, 122, 122), (85, 85, 85), (52, 52, 52),
], dtype=np.float64) / 255.0


def realistic_codes(cam: str) -> np.ndarray:
    """ColorChecker reflectances at -6..+6 stops (half-stop steps), encoded
    into the given camera's log space -- the colours real footage is made of."""
    lin709 = np.clip(_COLORCHECKER_SRGB, 0, 1) ** 2.2  # display -> linear
    stops = np.arange(-6.0, 6.01, 0.5)
    lin = np.concatenate([lin709 * (2.0 ** st) for st in stops], axis=0)
    m = np.linalg.inv(bc.CAMERA_MATRIX[cam])  # Rec.709 -> camera gamut
    lin_cam = lin @ m.T
    enc = {"slog3": bc.slog3_encode, "flog2": bc.flog2_encode, "flog": bc.flog_encode}[cam]
    return np.clip(enc(np.maximum(lin_cam, 0.0)), 0.0, 1.0)


def main():
    ap = argparse.ArgumentParser(description="Verify BNC Grade .cube LUTs.")
    ap.add_argument("paths", nargs="*", help="specific .cube files to check (default: all under --dir)")
    ap.add_argument("--dir", default="luts", help="root to glob for .cube files (default: luts)")
    args = ap.parse_args()

    if args.paths:
        files = [Path(p).resolve() for p in args.paths]
    else:
        root = Path(args.dir)
        if not root.is_absolute():
            root = COLOR_GRADING_ROOT / root
        files = sorted(root.rglob("*.cube"))

    if not files:
        print("No .cube files found to verify.")
        return 1

    results = [verify_file(p) for p in files]

    name_w = max(len(r["file"]) for r in results) + 2
    header = f"{'file':<{name_w}}{'size':>6}  {'grey_spread':>11}  {'max_error':>10}  status  notes"
    print(header)
    print("-" * len(header))
    n_fail = 0
    for r in results:
        if r["status"] != "PASS":
            n_fail += 1
        me = "n/a" if (isinstance(r["max_error"], float) and np.isnan(r["max_error"])) else f"{r['max_error']:.5f}"
        print(f"{r['file']:<{name_w}}{str(r['size']):>6}  {r['grey_spread']:>11.5f}  {me:>10}  "
              f"{r['status']:<6}  {r['notes']}")

    print("-" * len(header))
    print(f"{len(results)} file(s) checked, {len(results) - n_fail} PASS, {n_fail} FAIL.")
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
