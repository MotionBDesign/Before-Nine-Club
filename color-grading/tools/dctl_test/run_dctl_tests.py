#!/usr/bin/env python3
"""tools/dctl_test/run_dctl_tests.py -- compile every BNC Grade .dctl file
with gcc through the tools/dctl_test/ shim/harness and numerically check it
against the tools/bnc_color.py / tools/bnc_looks.py reference.

For each .dctl file under resolve/dctl/ (and resolve/dctl/looks/):
  1. Compile it with `gcc -Wall -Wextra -x c -DDCTL_FILE=... harness.c.in -lm`
     (the base transform is additionally compiled -- and run -- with two
     small variant harnesses that set the `camera` combo global to its
     F-Log2 and F-Log indices; see run_variant()). Fail if gcc exits
     non-zero, or if it prints any warning other than -Wunused-parameter
     (the transform() entry point signature is fixed by the DCTL API and
     always carries unused p_Width/p_Height/p_X/p_Y in these files).
  2. Feed it 5,000 random RGB triples in [0,1]^3, a full grey ramp, and a
     handful of reference/edge points, and compare its stdout against the
     equivalent tools/bnc_color.py computation, float32 vs float64.
  3. Report the max absolute error per file against its threshold:
     base transforms < 0.004, looks (and the look toolbox) < 0.006.

Exits 0 if every file compiles cleanly and passes its threshold, 1 otherwise.

Usage: python3 tools/dctl_test/run_dctl_tests.py [--n-random 5000] [--seed 0]
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

THIS_DIR = Path(__file__).resolve().parent           # tools/dctl_test
TOOLS_DIR = THIS_DIR.parent                            # tools
REPO_ROOT = TOOLS_DIR.parent                            # color-grading
RESOLVE_DCTL_DIR = REPO_ROOT / "resolve" / "dctl"
LOOKS_DIR = RESOLVE_DCTL_DIR / "looks"
HARNESS_C_IN = THIS_DIR / "harness.c.in"
DCTL_SHIM_H = THIS_DIR / "dctl_shim.h"

sys.path.insert(0, str(TOOLS_DIR))
import bnc_color as bc  # noqa: E402
import bnc_looks as bl  # noqa: E402

# bnc_color.py's vectorised np.where branches (e.g. _op_softclip with hi=1.0,
# or lo=0.0) compute both sides of the where() unconditionally, which can
# raise a division-by-zero/invalid RuntimeWarning on the branch that is then
# discarded -- benign, and inherent to the reference implementation itself
# (never modified here), not a real error. Silence it so it doesn't clutter
# this script's own PASS/FAIL reporting.
np.seterr(divide="ignore", invalid="ignore")

BASE_THRESHOLD = 0.004
LOOK_THRESHOLD = 0.006

REFERENCE_POINTS = [
    (0.0, 0.0, 0.0), (1.0, 1.0, 1.0),
    (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0),
    (1.0, 1.0, 0.0), (1.0, 0.0, 1.0), (0.0, 1.0, 1.0),
]


# ---------------------------------------------------------------------------
# gcc plumbing
# ---------------------------------------------------------------------------

class CompileResult:
    def __init__(self, ok, binary_path, warnings, raw_stderr):
        self.ok = ok
        self.binary_path = binary_path
        self.warnings = warnings  # list of offending diagnostic lines
        self.raw_stderr = raw_stderr


def _bad_diagnostics(stderr_text: str):
    """Diagnostic header lines that are errors, or warnings other than
    -Wunused-parameter (transform()'s p_Width/p_Height/p_X/p_Y are unused
    by design in every BNC DCTL; the brief allows that one)."""
    bad = []
    for line in stderr_text.splitlines():
        if ": error:" in line:
            bad.append(line)
        elif ": warning:" in line and "-Wunused-parameter" not in line:
            bad.append(line)
    return bad


def compile_default(dctl_path: Path, build_dir: Path) -> CompileResult:
    """Compile via the real tools/dctl_test/harness.c.in, exactly as the
    brief specifies: gcc -x c -DDCTL_FILE='"<path>"' harness.c.in -lm."""
    out_path = build_dir / (dctl_path.stem + ".bin")
    cmd = [
        "gcc", "-Wall", "-Wextra", "-x", "c",
        f"-DDCTL_FILE=\"{dctl_path}\"",
        "-o", str(out_path), str(HARNESS_C_IN), "-lm",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    bad = _bad_diagnostics(proc.stderr)
    ok = (proc.returncode == 0) and not bad
    return CompileResult(ok, out_path if ok else None, bad, proc.stderr)


def compile_variant(dctl_path: Path, build_dir: Path, tag: str, setup_lines) -> CompileResult:
    """Compile a small variant harness that #includes the same shim and the
    same .dctl file as harness.c.in, but runs `setup_lines` (plain C
    statements) in main() before the stdin loop -- e.g. to set the `camera`
    combo global, which DEFINE_UI_PARAMS declares as an ordinary static int
    in the shim (tools/dctl_test/dctl_shim.h), so a direct assignment in the
    same translation unit is all a variant needs."""
    variant_src = build_dir / f"{dctl_path.stem}_{tag}.c"
    setup = "\n".join(f"    {line}" for line in setup_lines)
    variant_src.write_text(
        f'#include "dctl_shim.h"\n'
        f'#include "{dctl_path}"\n'
        f"int main(void) {{\n"
        f"{setup}\n"
        f"    float r, g, b;\n"
        f'    while (scanf("%f %f %f", &r, &g, &b) == 3) {{\n'
        f"        float3 o = transform(1920, 1080, 0, 0, r, g, b);\n"
        f'        printf("%.7f %.7f %.7f\\n", o.x, o.y, o.z);\n'
        f"    }}\n"
        f"    return 0;\n"
        f"}}\n"
    )
    out_path = build_dir / f"{dctl_path.stem}_{tag}.bin"
    cmd = [
        "gcc", "-Wall", "-Wextra", "-x", "c",
        "-I", str(THIS_DIR),
        "-o", str(out_path), str(variant_src), "-lm",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    bad = _bad_diagnostics(proc.stderr)
    ok = (proc.returncode == 0) and not bad
    return CompileResult(ok, out_path if ok else None, bad, proc.stderr)


def run_binary(binary_path: Path, points: np.ndarray) -> np.ndarray:
    """Feed (N,3) float64 `points` to `binary_path` over stdin, return its
    (N,3) float64 stdout, parsed."""
    text = "\n".join(f"{r:.9g} {g:.9g} {b:.9g}" for r, g, b in points)
    proc = subprocess.run([str(binary_path)], input=text, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"{binary_path} exited {proc.returncode}: {proc.stderr}")
    rows = [line.split() for line in proc.stdout.splitlines() if line.strip()]
    if len(rows) != len(points):
        raise RuntimeError(
            f"{binary_path}: expected {len(points)} output rows, got {len(rows)}"
        )
    return np.array(rows, dtype=np.float64)


# ---------------------------------------------------------------------------
# Test-vector construction
# ---------------------------------------------------------------------------

def random_points(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.random((n, 3))


def grey_ramp(n: int = 513) -> np.ndarray:
    g = np.linspace(0.0, 1.0, n)
    return np.stack([g, g, g], axis=-1)


def as_points(triples) -> np.ndarray:
    return np.array(triples, dtype=np.float64)


# ---------------------------------------------------------------------------
# Look-toolbox parameter presets (spec 5), matching BNC_Look_Toolbox.dctl's
# fixed op order and DEFINE_UI_PARAMS defaults exactly.
# ---------------------------------------------------------------------------

TOOLBOX_DEFAULTS = {
    "wbWarm": 0.0, "wbTint": 0.0,
    "exposureEV": 0.0,
    "contrastAmount": 1.0, "contrastPivot": 0.43,
    "toeStrength": 0.0,
    "shoulderAmount": 0.0,
    "liftBlacks": 0.0,
    "saturationAmount": 1.0,
    "vibranceAmount": 1.0,
    "densityAmount": 0.0,
    "splitShadowHue": 210.0, "splitShadowAmount": 0.0,
    "splitHighlightHue": 55.0, "splitHighlightAmount": 0.0,
    "hueShiftCentre": 142.0, "hueShiftWidth": 40.0, "hueShiftAmount": 0.0,
    "hueSatCentre": 142.0, "hueSatWidth": 40.0, "hueSatMult": 1.0,
    "hueLumMult": 1.0,
    "softclipHi": 1.0,
}

TOOLBOX_PRESETS = {
    "identity": {},
    "typical": {
        "wbWarm": 0.04, "wbTint": -0.01, "exposureEV": 0.15,
        "contrastAmount": 1.15, "contrastPivot": 0.45,
        "toeStrength": 0.25, "shoulderAmount": 0.2, "liftBlacks": 0.02,
        "saturationAmount": 0.9, "vibranceAmount": 1.1, "densityAmount": 0.08,
        "splitShadowHue": 200.0, "splitShadowAmount": 0.02,
        "splitHighlightHue": 45.0, "splitHighlightAmount": 0.015,
        "hueShiftCentre": 29.0, "hueShiftWidth": 30.0, "hueShiftAmount": 10.0,
        "hueSatCentre": 195.0, "hueSatWidth": 45.0, "hueSatMult": 0.85,
        "hueLumMult": 1.1, "softclipHi": 0.88,
    },
    "extreme": {
        "wbWarm": -0.3, "wbTint": 0.15, "exposureEV": -1.2,
        "contrastAmount": 1.8, "contrastPivot": 0.3,
        "toeStrength": 0.9, "shoulderAmount": 0.9, "liftBlacks": 0.25,
        "saturationAmount": 0.2, "vibranceAmount": 1.9, "densityAmount": 0.28,
        "splitShadowHue": 300.0, "splitShadowAmount": -0.09,
        "splitHighlightHue": 90.0, "splitHighlightAmount": -0.08,
        "hueShiftCentre": 328.0, "hueShiftWidth": 10.0, "hueShiftAmount": -55.0,
        "hueSatCentre": 60.0, "hueSatWidth": 80.0, "hueSatMult": 1.9,
        "hueLumMult": 0.1, "softclipHi": 0.55,
    },
}


def toolbox_ops(params: dict):
    """Build the exact bnc_color.Op sequence BNC_Look_Toolbox.dctl's fixed
    pipeline runs for a given (possibly partial) slider dict, in the same
    order as the DCTL, with the same non-slider values pinned (contrast
    hi/lo, toe range, shoulder start, split_tone ranges, softclip lo)."""
    p = {**TOOLBOX_DEFAULTS, **params}
    return [
        bc.Op("white_balance", {"warm": p["wbWarm"], "tint": p["wbTint"]}),
        bc.Op("exposure", {"ev": p["exposureEV"]}),
        bc.Op("contrast", {"amount": p["contrastAmount"], "pivot": p["contrastPivot"], "hi": 0.85, "lo": 0.06}),
        bc.Op("toe", {"strength": p["toeStrength"], "range": 0.25}),
        bc.Op("shoulder", {"start": 0.70, "k": p["shoulderAmount"]}),
        bc.Op("lift_blacks", {"amount": p["liftBlacks"]}),
        bc.Op("saturation", {"amount": p["saturationAmount"]}),
        bc.Op("vibrance", {"amount": p["vibranceAmount"]}),
        bc.Op("density", {"k": p["densityAmount"]}),
        bc.Op("split_tone", {
            "sh_hue": p["splitShadowHue"], "sh_amt": p["splitShadowAmount"],
            "hi_hue": p["splitHighlightHue"], "hi_amt": p["splitHighlightAmount"],
            "sh_range": (0.0, 0.55), "hi_range": (0.45, 1.0),
        }),
        bc.Op("hue_shift", {"centre": p["hueShiftCentre"], "width": p["hueShiftWidth"], "shift": p["hueShiftAmount"]}),
        bc.Op("hue_sat", {"centre": p["hueSatCentre"], "width": p["hueSatWidth"], "mult": p["hueSatMult"]}),
        bc.Op("hue_lum", {"centre": p["hueSatCentre"], "width": p["hueSatWidth"], "mult": p["hueLumMult"]}),
        bc.Op("softclip", {"hi": p["softclipHi"], "lo": 0.0}),
    ]


def toolbox_setup_lines(params: dict):
    p = {**TOOLBOX_DEFAULTS, **params}
    return [f"{name} = {value!r}f;" for name, value in p.items()]


# ---------------------------------------------------------------------------
# Per-file test cases
# ---------------------------------------------------------------------------

class FileResult:
    def __init__(self, name, category, n_points, max_err, threshold, compile_ok, warnings):
        self.name = name
        self.category = category
        self.n_points = n_points
        self.max_err = max_err
        self.threshold = threshold
        self.compile_ok = compile_ok
        self.warnings = warnings

    @property
    def passed(self):
        return self.compile_ok and (self.max_err is not None) and (self.max_err < self.threshold)


def test_base_transform(build_dir: Path, rng: np.random.Generator, n_random: int) -> FileResult:
    dctl_path = RESOLVE_DCTL_DIR / "BNC_Base_Display_Transform.dctl"
    name = dctl_path.name

    compiled = compile_default(dctl_path, build_dir)
    if not compiled.ok:
        return FileResult(name, "base", 0, None, BASE_THRESHOLD, False, compiled.warnings)

    variants = [
        ("slog3", "slog3", []),
        ("flog2", "flog2", ["camera = 1;"]),
        ("flog", "flog", ["camera = 2;"]),
    ]

    max_err = 0.0
    total_pts = 0
    all_warnings = list(compiled.warnings)

    for tag, camera_name, setup in variants:
        if setup:
            variant = compile_variant(dctl_path, build_dir, tag, setup)
            if not variant.ok:
                all_warnings += [f"[{tag}] {w}" for w in variant.warnings]
                continue
            binary = variant.binary_path
        else:
            binary = compiled.binary_path

        pts = [random_points(n_random, rng), grey_ramp()]
        pts.append(as_points(REFERENCE_POINTS))
        if camera_name == "slog3":
            # Spec 3.3 reference points (neutral only; the three channels
            # are asserted equal by construction here).
            pts.append(as_points([
                (0.410557, 0.410557, 0.410557),
                (0.584447, 0.584447, 0.584447),
                (1.0, 1.0, 1.0),
                (0.0929, 0.0929, 0.0929),
                (0.0, 0.0, 0.0),
            ]))
        points = np.concatenate(pts, axis=0)

        actual = run_binary(binary, points)
        expected = bc.base_transform(points, camera=camera_name, exposure_ev=0.0, per_channel_mix=0.8)
        expected = np.clip(expected, 0.0, 1.0)

        if not np.all(np.isfinite(actual)):
            all_warnings.append(f"[{tag}] non-finite values in DCTL output")

        err = float(np.max(np.abs(actual - expected)))
        max_err = max(max_err, err)
        total_pts += len(points)

    if len(all_warnings) > len(compiled.warnings):
        # a variant failed to compile or produced non-finite output
        ok_compile = False
    else:
        ok_compile = True

    return FileResult(name, "base", total_pts, max_err, BASE_THRESHOLD, ok_compile, all_warnings)


def test_look_toolbox(build_dir: Path, rng: np.random.Generator, n_random: int) -> FileResult:
    dctl_path = RESOLVE_DCTL_DIR / "BNC_Look_Toolbox.dctl"
    name = dctl_path.name

    compiled = compile_default(dctl_path, build_dir)
    if not compiled.ok:
        return FileResult(name, "toolbox", 0, None, LOOK_THRESHOLD, False, compiled.warnings)

    max_err = 0.0
    total_pts = 0
    warnings = list(compiled.warnings)
    n_per_preset = max(1, n_random // len(TOOLBOX_PRESETS))

    for preset_name, params in TOOLBOX_PRESETS.items():
        variant = compile_variant(dctl_path, build_dir, preset_name, toolbox_setup_lines(params))
        if not variant.ok:
            warnings += [f"[{preset_name}] {w}" for w in variant.warnings]
            continue

        pts = [random_points(n_per_preset, rng), grey_ramp(129), as_points(REFERENCE_POINTS)]
        points = np.concatenate(pts, axis=0)

        actual = run_binary(variant.binary_path, points)
        expected = bc.apply_look(points, toolbox_ops(params))

        if not np.all(np.isfinite(actual)):
            warnings.append(f"[{preset_name}] non-finite values in DCTL output")

        err = float(np.max(np.abs(actual - expected)))
        max_err = max(max_err, err)
        total_pts += len(points)

    ok_compile = len(warnings) == len(compiled.warnings)
    return FileResult(name, "toolbox", total_pts, max_err, LOOK_THRESHOLD, ok_compile, warnings)


def test_look_file(dctl_path: Path, look: bl.Look, build_dir: Path, rng: np.random.Generator, n_random: int) -> FileResult:
    name = dctl_path.name
    compiled = compile_default(dctl_path, build_dir)
    if not compiled.ok:
        return FileResult(name, "look", 0, None, LOOK_THRESHOLD, False, compiled.warnings)

    pts = [random_points(n_random, rng), grey_ramp(), as_points(REFERENCE_POINTS)]
    points = np.concatenate(pts, axis=0)

    actual = run_binary(compiled.binary_path, points)  # strength defaults to 1.0
    expected = bc.apply_look(points, look.ops)

    warnings = list(compiled.warnings)
    if not np.all(np.isfinite(actual)):
        warnings.append("non-finite values in DCTL output")

    err = float(np.max(np.abs(actual - expected)))
    return FileResult(name, "look", len(points), err, LOOK_THRESHOLD, len(warnings) == len(compiled.warnings), warnings)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def print_table(results):
    header = f"{'File':34s} {'Category':9s} {'Points':>8s} {'MaxErr':>12s} {'Threshold':>10s} {'Result':>7s}"
    print(header)
    print("-" * len(header))
    for r in results:
        err_str = f"{r.max_err:.6f}" if r.max_err is not None else "n/a"
        status = "PASS" if r.passed else "FAIL"
        print(f"{r.name:34s} {r.category:9s} {r.n_points:8d} {err_str:>12s} {r.threshold:>10.4f} {status:>7s}")
    print("-" * len(header))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n-random", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--keep-build-dir", action="store_true",
                         help="do not delete the temporary gcc build directory (for debugging)")
    args = parser.parse_args()

    if shutil.which("gcc") is None:
        print("ERROR: gcc not found on PATH", file=sys.stderr)
        return 1

    rng = np.random.default_rng(args.seed)
    build_dir = Path(tempfile.mkdtemp(prefix="bnc_dctl_test_"))

    try:
        results = []

        results.append(test_base_transform(build_dir, rng, args.n_random))
        results.append(test_look_toolbox(build_dir, rng, args.n_random))

        look_files = sorted(LOOKS_DIR.glob("BNC_L*.dctl"))
        if not look_files:
            print(f"ERROR: no look DCTLs found in {LOOKS_DIR} -- run tools/gen_look_dctls.py first", file=sys.stderr)
            return 1

        for dctl_path in look_files:
            look_id = dctl_path.stem.split("_")[1]  # BNC_L01_Clean -> L01
            look = bl.LOOKS_BY_ID.get(look_id)
            if look is None:
                print(f"ERROR: {dctl_path.name} does not match any id in bnc_looks.LOOKS_BY_ID", file=sys.stderr)
                return 1
            results.append(test_look_file(dctl_path, look, build_dir, rng, args.n_random))

        print()
        print_table(results)
        print()

        any_fail = False
        for r in results:
            if not r.passed:
                any_fail = True
                print(f"FAIL: {r.name}")
                if not r.compile_ok:
                    print("  compile/runtime problems:")
                    for w in r.warnings[:20]:
                        print(f"    {w}")
                elif r.max_err is not None and r.max_err >= r.threshold:
                    print(f"  max abs error {r.max_err:.6f} >= threshold {r.threshold:.4f}")

        if any_fail:
            print("\nRESULT: FAIL")
            return 1

        print("RESULT: PASS -- all DCTLs compiled cleanly (gcc -Wall -Wextra, no warnings")
        print("beyond -Wunused-parameter) and matched tools/bnc_color.py / tools/bnc_looks.py")
        print(f"within threshold on {args.n_random} random points + a grey ramp + reference points each.")
        return 0
    finally:
        if args.keep_build_dir:
            print(f"\n(build dir kept at {build_dir})")
        else:
            shutil.rmtree(build_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
