#!/usr/bin/env python3
"""test_pipeline.py -- plain-script asserts for every reference value and
"assert"/"Property to assert" statement in tools/SPEC.md (sections 1-5).
No pytest (not available). Exits 0 on success; an AssertionError (with a
message naming the failing check) propagates as a non-zero exit otherwise.

This checks the colour-science *formulas* in bnc_color.py directly. Whether
the *built .cube files* reproduce them to within tolerance at 33 points is a
separate, LUT-fidelity question checked by verify_luts.py (SPEC.md sec. 9).
"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bnc_color as bc
import bnc_looks as bl

CHECKS_RUN = 0


def check(label, cond):
    global CHECKS_RUN
    CHECKS_RUN += 1
    assert cond, f"FAILED: {label}"
    print(f"  ok  {label}")


def close(a, b, tol):
    return abs(float(a) - float(b)) <= tol


# ---------------------------------------------------------------------------
print("== Section 2.1: S-Log3 reference values (tolerance 1e-4) ==")
check("S-Log3 encode(0.18) == 0.410557", close(bc.slog3_encode(np.array([0.18]))[0], 0.410557, 1e-4))
check("S-Log3 encode(0.90) == 0.584447", close(bc.slog3_encode(np.array([0.90]))[0], 0.584447, 1e-4))
check("S-Log3 decode(1.0) ~= 38.42", close(bc.slog3_decode(np.array([1.0]))[0], 38.42, 0.01))
check("S-Log3 decode(0.0929) == 0", close(bc.slog3_decode(np.array([0.0929]))[0], 0.0, 1e-4))

print("\n== Section 2.2: F-Log2 / F-Log reference values ==")
check("F-Log2 encode(0.18) ~= 0.3910 (tol 1e-3)", close(bc.flog2_encode(np.array([0.18]))[0], 0.3910, 1e-3))
check("F-Log  encode(0.18) ~= 0.4593 (tol 1e-3)", close(bc.flog_encode(np.array([0.18]))[0], 0.4593, 1e-3))
check("F-Log2 decode(1.0) ~= 58.2 (tol 0.1, spec gives 1 decimal)", close(bc.flog2_decode(np.array([1.0]))[0], 58.2, 0.1))

print("\n== Section 2.3: gamut matrix rows sum to 1.0 (white -> white) ==")
for name, M in [("S-Gamut3.Cine->709", bc.M_SGAMUT3CINE_TO_709),
                ("F-Gamut->709", bc.M_FGAMUT_TO_709),
                ("709->S-Gamut3.Cine", bc.M_709_TO_SGAMUT3CINE)]:
    row_sums = M.sum(axis=1)
    check(f"{name} row sums == 1.0 (max dev {np.max(np.abs(row_sums-1)):.2e})",
          np.allclose(row_sums, 1.0, atol=1e-9))

print("\n== Section 3.1: gamut_compress corner property ==")
corners = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1]], dtype=np.float64)
lin709_corners = bc.apply_matrix(corners, bc.M_SGAMUT3CINE_TO_709)
compressed = bc.gamut_compress(lin709_corners)
check(f"all 6 S-Gamut3.Cine corners compress to >= -1e-9 (min={compressed.min():.6g})",
      bool(np.all(compressed >= -1e-9)))

print("\n== Section 3.2: tone curve T(t) is monotonic (fine grid) ==")
check("T(t) non-decreasing on a 4001-point grid over [-9,8]", bc.TONE_CURVE_T.is_monotonic(4001))
grid = np.linspace(-9, 8, 4001)
vals = bc.tone_curve_T(grid)
check("T(t) in [0,1] everywhere on the grid", bool(np.all(vals >= -1e-12) and np.all(vals <= 1 + 1e-12)))
check("T(-9) == 0.000", close(bc.tone_curve_T(np.array([-9.0]))[0], 0.000, 1e-9))
check("T(8) == 1.000", close(bc.tone_curve_T(np.array([8.0]))[0], 1.000, 1e-9))
check("T(t<=-9) flat at 0.0", close(bc.tone_curve_T(np.array([-20.0]))[0], 0.0, 1e-9))
check("T(t>=8) flat at 1.0", close(bc.tone_curve_T(np.array([20.0]))[0], 1.0, 1e-9))

print("\n== PCHIP: monotonicity on an independent synthetic monotone dataset ==")
xs = np.array([0.0, 1.0, 2.0, 3.5, 5.0, 8.0, 10.0])
ys = np.array([0.0, 0.1, 0.15, 0.9, 0.95, 0.951, 2.0])  # includes a near-flat run and a steep jump
p = bc.PCHIP(xs, ys)
check("PCHIP stays monotone through a near-flat run + steep jump", p.is_monotonic(5001))

print("\n== Section 3.3: base_transform reference values (S-Log3, tol 0.01) ==")
grey = bc.base_transform(np.array([[0.410557] * 3]), camera="slog3")[0]
check("S-Log3 grey 0.410557 -> 0.430", close(np.mean(grey), 0.430, 0.01))
check("S-Log3 grey: 3 channels equal within 0.002", float(np.ptp(grey)) <= 0.002 + 1e-9)

white90 = bc.base_transform(np.array([[0.584447] * 3]), camera="slog3")[0]
check("S-Log3 90% white 0.584447 -> ~0.77 (tol 0.02)", close(np.mean(white90), 0.77, 0.02))
check("S-Log3 90% white: 3 channels equal within 0.002", float(np.ptp(white90)) <= 0.002 + 1e-9)

top = bc.base_transform(np.array([[1.0] * 3]), camera="slog3")[0]
check("S-Log3 code 1.0 -> >= 0.995", float(np.mean(top)) >= 0.995 - 1e-9)
check("S-Log3 code 1.0: 3 channels equal within 0.002", float(np.ptp(top)) <= 0.002 + 1e-9)

bottom = bc.base_transform(np.array([[0.0929] * 3]), camera="slog3")[0]
check("S-Log3 code 0.0929 -> <= 0.002", float(np.mean(bottom)) <= 0.002 + 1e-9)
lower = bc.base_transform(np.array([[0.02] * 3]), camera="slog3")[0]
check("S-Log3 code lower than 0.0929 -> <= 0.002", float(np.mean(lower)) <= 0.002 + 1e-9)

ramp = np.linspace(0, 1, 513)
ramp_rgb = np.stack([ramp, ramp, ramp], axis=-1)
ramp_out = bc.base_transform(ramp_rgb, camera="slog3")
ramp_Y = bc.luma(bc.to_lin(ramp_out))
check("S-Log3 grey-axis output non-decreasing in the input",
      bool(np.all(np.diff(ramp_Y) >= -1e-9)))

print("\n== Section 4: Oklab round trip + reference hues ==")
rng = np.random.default_rng(0)
rand_lin = rng.uniform(-0.5, 1.5, size=(5000, 3))  # includes some out-of-[0,1] to exercise cbrt on negatives
lab = bc.linear_to_oklab(rand_lin)
back = bc.oklab_to_linear(lab)
max_rt_err = float(np.max(np.abs(rand_lin - back)))
check(f"Oklab round trip error < 1e-6 on random colours (max={max_rt_err:.3e})", max_rt_err < 1e-6)

white_lab = bc.linear_to_oklab(np.array([[1.0, 1.0, 1.0]]))[0]
check(f"lin(1,1,1) -> L ~= 1.0 (got {white_lab[0]:.6f})", close(white_lab[0], 1.0, 1e-4))
check(f"lin(1,1,1) -> a ~= 0 (got {white_lab[1]:.2e})", close(white_lab[1], 0.0, 1e-4))
check(f"lin(1,1,1) -> b ~= 0 (got {white_lab[2]:.2e})", close(white_lab[2], 0.0, 1e-4))

_REF_HUES = [("red", (1, 0, 0), 29), ("yellow", (1, 1, 0), 110), ("green", (0, 1, 0), 142),
             ("cyan", (0, 1, 1), 195), ("blue", (0, 0, 1), 264), ("magenta", (1, 0, 1), 328)]
for name, rgb, expect_deg in _REF_HUES:
    lab_c = bc.linear_to_oklab(np.array([rgb], dtype=np.float64))
    h = float(bc.oklab_hue_deg(lab_c)[0])
    d = min(abs(h - expect_deg), 360 - abs(h - expect_deg))
    check(f"hue({name}) ~= {expect_deg} deg (got {h:.2f}, |diff|={d:.2f} <= 2)", d <= 2.0)

# Descriptive claim (not a numbered reference value -- no exact input is
# given, so this is informational rather than a hard assert): "Skin tones
# sit ~45-75 deg". Sanity-checked against the two ColorChecker skin patches
# used later for the preview charts (section 10).
print("  -- informational (spec gives no exact input for this claim):")
for name, rgb8 in [("dark skin", (115, 82, 68)), ("light skin", (194, 150, 130))]:
    srgb = np.array([[c / 255.0 for c in rgb8]])
    lin = bc.to_lin(srgb)
    h = float(bc.oklab_hue_deg(bc.linear_to_oklab(lin))[0])
    near_range = 40.0 <= h <= 80.0
    print(f"      ColorChecker {name} hue = {h:.1f} deg "
          f"({'within' if 45.0 <= h <= 75.0 else 'near'} the ~45-75 deg claim)")
    check(f"ColorChecker {name} hue within a widened ~[40,80] deg envelope", near_range)

print("\n== Section 5: gamut_clip + apply_look sanity ==")
wild = rng.uniform(-1.0, 2.0, size=(4000, 3))
clipped = bc.gamut_clip(wild)
check("gamut_clip output within [0,1]", bool(np.all(clipped >= -1e-9) and np.all(clipped <= 1 + 1e-9)))
check("gamut_clip output finite (no NaN)", bool(np.all(np.isfinite(clipped))))

achromatic = np.stack([np.linspace(0, 1, 101)] * 3, axis=-1)
ach_clipped = bc.gamut_clip(bc.to_lin(achromatic))
check("gamut_clip leaves an in-gamut achromatic ramp unchanged",
      float(np.max(np.abs(ach_clipped - bc.to_lin(achromatic)))) < 1e-6)

print("\n== Section 5/6: all 13 looks -- NaN-free, in range, black/white/monotone ==")
sample = rng.uniform(0, 1, size=(64, 64, 3))
black_in = np.zeros((1, 3))
white_in = np.ones((1, 3))
grey_ramp_in = np.stack([np.linspace(0, 1, 513)] * 3, axis=-1)
for look in bl.LOOKS:
    out = bc.apply_look(sample, look.ops)
    check(f"{look.id} {look.slug}: no NaN", not bool(np.isnan(out).any()))
    check(f"{look.id} {look.slug}: output in [0,1]", bool(out.min() >= -1e-9 and out.max() <= 1 + 1e-9))

    b = bc.apply_look(black_in, look.ops)[0]
    w = bc.apply_look(white_in, look.ops)[0]
    b_luma = float(bc.luma(bc.to_lin(b)))
    w_luma = float(bc.luma(bc.to_lin(w)))
    lift = max((op.kwargs["amount"] for op in look.ops if op.name == "lift_blacks"), default=0.0)
    black_bound = lift if lift > 0 else 0.002
    check(f"{look.id} {look.slug}: black -> luma {b_luma:.4f} <= {black_bound:.3f}", b_luma <= black_bound + 1e-6)
    check(f"{look.id} {look.slug}: white -> luma {w_luma:.4f} in [0.85,1.0]", 0.85 - 1e-6 <= w_luma <= 1.0 + 1e-6)

    g_out = bc.apply_look(grey_ramp_in, look.ops)
    g_Y = bc.luma(bc.to_lin(g_out))
    check(f"{look.id} {look.slug}: grey axis non-decreasing (tolerance 1e-4)", bool(np.all(np.diff(g_Y) >= -1e-4)))

    # describe() runs without error and returns one line per op
    desc = bl.describe(look)
    check(f"{look.id} {look.slug}: describe() returns {len(look.ops)} lines", len(desc) == len(look.ops))

print(f"\nALL {CHECKS_RUN} CHECKS PASSED")
