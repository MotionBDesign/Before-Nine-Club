"""bnc_color.py -- BNC Grade colour-science core.

Implements, exactly as written in tools/SPEC.md:
  * S-Log3 / F-Log / F-Log2 encode + decode (section 2)
  * camera gamut matrices (section 2.3)
  * the base display transform "BNC Base" (section 3), including ACES-style
    gamut compression (3.1), a monotone PCHIP tone curve (3.2) and the
    per-channel / luminance blend (3.3)
  * Oklab conversions (section 4)
  * the look toolbox ops and apply_look() wrapper (section 5)

All maths is float64 numpy, vectorised over arrays of shape (..., 3).
No scipy. Only numpy is imported here; Pillow is not needed in this module.
"""

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np

# ---------------------------------------------------------------------------
# 1. Conventions
# ---------------------------------------------------------------------------

MIDDLE_GREY_LINEAR = 0.18
MIDDLE_GREY_CODE = 0.43
GAMMA = 2.4

# Rec.709 luminance weights (linear light).
LUMA_R, LUMA_G, LUMA_B = 0.2126, 0.7152, 0.0722
_LUMA_VEC = np.array([LUMA_R, LUMA_G, LUMA_B], dtype=np.float64)


def luma(lin: np.ndarray) -> np.ndarray:
    """Rec.709 linear luminance Y = 0.2126 R + 0.7152 G + 0.0722 B."""
    lin = np.asarray(lin, dtype=np.float64)
    return lin[..., 0] * LUMA_R + lin[..., 1] * LUMA_G + lin[..., 2] * LUMA_B


def to_code(lin: np.ndarray) -> np.ndarray:
    """Rec.709/sRGB-like display encode: code = clip(lin, 0, 1) ** (1/2.4).

    Section 1: "Clamp lin to [0,1] before encoding. Treat sRGB input the
    same way (the difference is negligible for these looks)."
    """
    lin = np.asarray(lin, dtype=np.float64)
    return np.clip(lin, 0.0, 1.0) ** (1.0 / GAMMA)


def to_lin(code: np.ndarray) -> np.ndarray:
    """Rec.709/sRGB-like display decode: lin = clip(code, 0, 1) ** 2.4."""
    code = np.asarray(code, dtype=np.float64)
    return np.clip(code, 0.0, 1.0) ** GAMMA


def stops_from_grey(x: np.ndarray) -> np.ndarray:
    """t = log2(max(x, 1e-6) / 0.18) -- stops relative to middle grey."""
    x = np.asarray(x, dtype=np.float64)
    return np.log2(np.maximum(x, 1e-6) / MIDDLE_GREY_LINEAR)


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    """smoothstep(e0, e1, x): u = clip((x-e0)/(e1-e0), 0, 1); u*u*(3-2u)."""
    x = np.asarray(x, dtype=np.float64)
    u = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def hue_window(h: np.ndarray, centre: float, width: float) -> np.ndarray:
    """w(h; centre, width): raised-cosine falloff, 0 beyond `width` degrees.

    d = smallest angular distance between h and centre, in [0, 180].
    w = 0.5*(1+cos(pi*d/width)) if d < width else 0.
    """
    h = np.asarray(h, dtype=np.float64)
    d = np.abs(((h - centre + 180.0) % 360.0) - 180.0)
    w = 0.5 * (1.0 + np.cos(np.pi * d / width))
    return np.where(d < width, w, 0.0)


# ---------------------------------------------------------------------------
# 2. Camera decodes (code -> scene-linear reflectance)
# ---------------------------------------------------------------------------

_SLOG3_KNEE_Y = 171.2102946929 / 1023.0
_SLOG3_KNEE_X = 0.01125000


def slog3_decode(y: np.ndarray) -> np.ndarray:
    """Sony S-Log3 code -> scene-linear reflectance (section 2.1)."""
    y = np.asarray(y, dtype=np.float64)
    hi = (10.0 ** ((y * 1023.0 - 420.0) / 261.5)) * (0.18 + 0.01) - 0.01
    lo = (y * 1023.0 - 95.0) * 0.01125000 / (171.2102946929 - 95.0)
    return np.where(y >= _SLOG3_KNEE_Y, hi, lo)


def slog3_encode(x: np.ndarray) -> np.ndarray:
    """Scene-linear reflectance -> Sony S-Log3 code (section 2.1)."""
    x = np.asarray(x, dtype=np.float64)
    safe_arg = np.maximum((x + 0.01) / (0.18 + 0.01), 1e-10)
    hi = (420.0 + np.log10(safe_arg) * 261.5) / 1023.0
    lo = (x * (171.2102946929 - 95.0) / 0.01125000 + 95.0) / 1023.0
    return np.where(x >= _SLOG3_KNEE_X, hi, lo)


def _flog_family(a, b, c, d, e, f, cut1, cut2):
    """Build (decode, encode) callables for the F-Log / F-Log2 formula family
    (section 2.2): a hybrid log/linear curve shared by both Fujifilm curves.
    """

    def decode(y: np.ndarray) -> np.ndarray:
        y = np.asarray(y, dtype=np.float64)
        hi = (10.0 ** ((y - d) / c)) / a - b / a
        lo = (y - f) / e
        return np.where(y >= cut2, hi, lo)

    def encode(x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=np.float64)
        arg = np.maximum(a * x + b, 1e-10)
        hi = c * np.log10(arg) + d
        lo = e * x + f
        return np.where(x >= cut1, hi, lo)

    return decode, encode


# F-Log2: a=5.555556, b=0.064829, c=0.245281, d=0.384316, e=8.799461,
#         f=0.092864, cut1=0.000889, cut2=0.100686685370811
flog2_decode, flog2_encode = _flog_family(
    5.555556, 0.064829, 0.245281, 0.384316, 8.799461, 0.092864,
    0.000889, 0.100686685370811,
)

# F-Log : a=0.555556, b=0.009468, c=0.344676, d=0.790453, e=8.735631,
#         f=0.092864, cut1=0.00089, cut2=0.100537775223865
flog_decode, flog_encode = _flog_family(
    0.555556, 0.009468, 0.344676, 0.790453, 8.735631, 0.092864,
    0.00089, 0.100537775223865,
)

DECODERS = {"slog3": slog3_decode, "flog2": flog2_decode, "flog": flog_decode}
ENCODERS = {"slog3": slog3_encode, "flog2": flog2_encode, "flog": flog_encode}

# ---------------------------------------------------------------------------
# 2.3 Gamut matrices (scene-linear, D65 -> D65)
# ---------------------------------------------------------------------------

M_SGAMUT3CINE_TO_709 = np.array([
    [1.6269474097, -0.5401385389, -0.0868088709],
    [-0.1785155271, 1.4179409275, -0.2394254003],
    [-0.0444361150, -0.1959199662, 1.2403560812],
])

M_FGAMUT_TO_709 = np.array([
    [1.6604910021, -0.5876411388, -0.0728498633],
    [-0.1245504745, 1.1328998971, -0.0083494226],
    [-0.0181507634, -0.1005788980, 1.1187296614],
])

M_709_TO_SGAMUT3CINE = np.array([
    [0.6456794776, 0.2591145470, 0.0952059754],
    [0.0875299915, 0.7596995626, 0.1527704459],
    [0.0369574199, 0.1292809048, 0.8337616753],
])

CAMERA_MATRIX = {
    "slog3": M_SGAMUT3CINE_TO_709,
    "flog2": M_FGAMUT_TO_709,
    "flog": M_FGAMUT_TO_709,
}


def apply_matrix(lin: np.ndarray, m: np.ndarray) -> np.ndarray:
    """Apply a 3x3 matrix to the last axis of an (..., 3) array: y = M @ x."""
    lin = np.asarray(lin, dtype=np.float64)
    return lin @ m.T


# ---------------------------------------------------------------------------
# 3.1 Gamut compression (ACES 1.3 reference-gamut-compress algorithm, retuned)
# ---------------------------------------------------------------------------

GAMUT_COMPRESS_THR = (0.80, 0.80, 0.80)
GAMUT_COMPRESS_POWER = (1.2, 1.2, 1.2)


def gamut_compress(
    lin709: np.ndarray,
    thr=GAMUT_COMPRESS_THR,
    power=GAMUT_COMPRESS_POWER,
) -> np.ndarray:
    """Per-channel gamut compression toward the achromatic axis (spec 3.1).

    Derived from the ACES 1.3 reference gamut compressor, with one change:
    the compression curve asymptotes exactly at the Rec.709 boundary
    (distance 1.0) instead of slightly outside it, so *every* input --
    however far outside the gamut -- lands inside Rec.709 with no negative
    channel values. The curve is the identity below `thr` and C1-continuous
    at the knee.

        d  = (ach - c) / ach                      # 0 on the max channel
        x  = (d - thr) / (1 - thr)                # for d > thr
        d' = thr + (1 - thr) * x / (1 + x**p) ** (1/p)
        c' = ach - d' * ach

    Achromatic pixels (r == g == b) and near-black pixels pass unchanged.
    Grading meaning: this is what keeps neon, LEDs and saturated skies from
    clipping to flat colour blocks after the camera-to-Rec.709 matrix.
    """
    lin709 = np.asarray(lin709, dtype=np.float64)
    thr_a = np.asarray(thr, dtype=np.float64)
    pow_a = np.asarray(power, dtype=np.float64)

    ach = np.max(lin709, axis=-1, keepdims=True)
    safe = ach > 1e-6
    ach_safe = np.where(safe, ach, 1.0)

    d = (ach_safe - lin709) / ach_safe  # 0 on the max channel

    x = np.maximum((d - thr_a) / (1.0 - thr_a), 0.0)
    d_comp = thr_a + (1.0 - thr_a) * x / ((1.0 + x ** pow_a) ** (1.0 / pow_a))
    d_new = np.where(d > thr_a, d_comp, d)

    out = ach_safe - d_new * ach_safe
    return np.where(safe, out, lin709)


# ---------------------------------------------------------------------------
# 3.2 PCHIP (Fritsch-Carlson monotone cubic interpolation), implemented here
# ---------------------------------------------------------------------------

def _pchip_end_slope(h0: float, h1: float, d0: float, d1: float) -> float:
    """Non-centred three-point end-slope estimate, clamped for monotonicity.

    h0, d0 are the interval/secant adjacent to the boundary; h1, d1 the
    next one in. This is the standard Fritsch-Carlson boundary rule.
    """
    m = ((2.0 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
    if np.sign(m) != np.sign(d0):
        m = 0.0
    elif (np.sign(d0) != np.sign(d1)) and (abs(m) > 3.0 * abs(d0)):
        m = 3.0 * d0
    return m


def pchip_slopes(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Node slopes m_k for Fritsch-Carlson monotone cubic interpolation.

    Interior slopes are the weighted harmonic mean of the adjacent secant
    slopes, zeroed wherever the secants change sign (a local extremum) or
    either secant is zero -- this is what guarantees monotonicity on
    monotone input data. End slopes use a one-sided three-point estimate,
    clamped to keep the same monotonicity guarantee.
    """
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n = x.size
    if n < 2:
        raise ValueError("pchip_slopes needs at least 2 points")

    h = np.diff(x)
    delta = np.diff(y) / h
    m = np.zeros(n, dtype=np.float64)

    if n == 2:
        m[:] = delta[0]
        return m

    d0 = delta[:-1]  # d_{k-1} for interior k = 1..n-2
    d1 = delta[1:]  # d_k
    h0 = h[:-1]  # h_{k-1}
    h1 = h[1:]  # h_k

    same_sign = (d0 * d1) > 0.0
    d0_safe = np.where(same_sign, d0, 1.0)
    d1_safe = np.where(same_sign, d1, 1.0)

    w1 = 2.0 * h1 + h0  # paired with d_{k-1}
    w2 = h1 + 2.0 * h0  # paired with d_k
    denom = w1 / d0_safe + w2 / d1_safe
    interior = np.where(same_sign, 3.0 * (h0 + h1) / denom, 0.0)
    m[1:-1] = interior

    m[0] = _pchip_end_slope(h[0], h[1], delta[0], delta[1])
    m[-1] = _pchip_end_slope(h[-1], h[-2], delta[-1], delta[-2])
    return m


def pchip_eval(x: np.ndarray, y: np.ndarray, m: np.ndarray, xe: np.ndarray) -> np.ndarray:
    """Evaluate the piecewise cubic Hermite curve (x, y, slopes m) at xe.

    xe is clamped to [x[0], x[-1]] (flat extrapolation), then evaluated in
    the standard Hermite basis on the containing interval. Vectorised.
    """
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    m = np.asarray(m, dtype=np.float64)
    xe = np.asarray(xe, dtype=np.float64)

    xc = np.clip(xe, x[0], x[-1])
    idx = np.searchsorted(x, xc, side="right") - 1
    idx = np.clip(idx, 0, x.size - 2)

    x0, x1 = x[idx], x[idx + 1]
    y0, y1 = y[idx], y[idx + 1]
    m0, m1 = m[idx], m[idx + 1]
    h = x1 - x0
    t = (xc - x0) / h
    t2 = t * t
    t3 = t2 * t

    h00 = 2.0 * t3 - 3.0 * t2 + 1.0
    h10 = t3 - 2.0 * t2 + t
    h01 = -2.0 * t3 + 3.0 * t2
    h11 = t3 - t2

    return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1


class PCHIP:
    """A monotone cubic (Fritsch-Carlson PCHIP) curve through (x, y)."""

    def __init__(self, x: Sequence[float], y: Sequence[float]):
        order = np.argsort(np.asarray(x, dtype=np.float64))
        self.x = np.asarray(x, dtype=np.float64)[order]
        self.y = np.asarray(y, dtype=np.float64)[order]
        self.m = pchip_slopes(self.x, self.y)

    def __call__(self, xe: np.ndarray) -> np.ndarray:
        return pchip_eval(self.x, self.y, self.m, xe)

    def is_monotonic(self, n: int = 4001) -> bool:
        """Numerically verify the curve is non-decreasing on a fine grid."""
        grid = np.linspace(self.x[0], self.x[-1], n)
        vals = self(grid)
        return bool(np.all(np.diff(vals) >= -1e-12))


# Tone curve T(t): stops-from-grey -> display code (section 3.2).
_T_STOPS = np.array(
    [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    dtype=np.float64,
)
_T_CODES = np.array(
    [0.000, 0.002, 0.007, 0.017, 0.036, 0.068, 0.120, 0.195, 0.295, 0.430,
     0.595, 0.735, 0.835, 0.905, 0.950, 0.978, 0.993, 1.000],
    dtype=np.float64,
)
TONE_CURVE_T = PCHIP(_T_STOPS, _T_CODES)


def tone_curve_T(t: np.ndarray) -> np.ndarray:
    """The BNC Base tone curve T(t): stops-from-grey -> display code.

    Outside the control-point range it is flat: t <= -9 -> 0.0, t >= 8 -> 1.0
    (this falls out of pchip_eval's flat extrapolation automatically, since
    the end control points are exactly 0.000 and 1.000).
    """
    return TONE_CURVE_T(t)


# ---------------------------------------------------------------------------
# 3. Base display transform ("BNC Base")
# ---------------------------------------------------------------------------

def tonemap_blend(lin709: np.ndarray, per_channel_mix: float = 0.8) -> np.ndarray:
    """Section 3.3: per-channel / luminance-preserving blend of T(t).

    rgb_pc is T(t) applied per channel (can shift saturation/hue at the
    highlight roll-off); rgb_lp scales the whole pixel by the ratio needed
    to bring luminance onto T(t), which preserves hue but can look flat.
    `per_channel_mix` (k) blends the two, k=1 -> pure per-channel, k=0 ->
    pure hue-preserving luminance path.
    """
    lin709 = np.asarray(lin709, dtype=np.float64)
    r, g, b = lin709[..., 0], lin709[..., 1], lin709[..., 2]

    rgb_pc = tone_curve_T(stops_from_grey(lin709))

    Y = LUMA_R * r + LUMA_G * g + LUMA_B * b
    Yc = tone_curve_T(stops_from_grey(Y))
    ratio = (Yc ** GAMMA) / np.maximum(Y, 1e-6)
    rgb_lp = np.clip(lin709 * ratio[..., None], 0.0, 1.0) ** (1.0 / GAMMA)

    k = per_channel_mix
    return k * rgb_pc + (1.0 - k) * rgb_lp


def base_transform(
    code_rgb: np.ndarray,
    camera: str = "slog3",
    exposure_ev: float = 0.0,
    per_channel_mix: float = 0.8,
) -> np.ndarray:
    """BNC Base: camera log code -> Rec.709 gamma 2.4 display code.

    camera in {'slog3', 'flog2', 'flog'}. See section 3 of SPEC.md for the
    six numbered steps this function implements.
    """
    if camera not in DECODERS:
        raise ValueError(f"unknown camera {camera!r}; expected one of {sorted(DECODERS)}")

    code_rgb = np.asarray(code_rgb, dtype=np.float64)
    lin_cam = DECODERS[camera](code_rgb)  # step 1
    lin_cam = lin_cam * (2.0 ** exposure_ev)  # step 2
    lin709 = apply_matrix(lin_cam, CAMERA_MATRIX[camera])  # step 3
    lin709 = gamut_compress(lin709)  # step 4
    out = tonemap_blend(lin709, per_channel_mix)  # step 5
    return np.clip(out, 0.0, 1.0)  # step 6


# ---------------------------------------------------------------------------
# 4. Oklab
# ---------------------------------------------------------------------------

_OKLAB_M1 = np.array([
    [0.4122214708, 0.5363325363, 0.0514459929],
    [0.2119034982, 0.6806995451, 0.1073969566],
    [0.0883024619, 0.2817188376, 0.6299787005],
])
_OKLAB_M2 = np.array([
    [0.2104542553, 0.7936177850, -0.0040720468],
    [1.9779984951, -2.4285922050, 0.4505937099],
    [0.0259040371, 0.7827717662, -0.8086757660],
])
_OKLAB_M2INV = np.array([
    [1.0, 0.3963377774, 0.2158037573],
    [1.0, -0.1055613458, -0.0638541728],
    [1.0, -0.0894841775, -1.2914855480],
])
_OKLAB_M1INV = np.array([
    [4.0767416621, -3.3077115913, 0.2309699292],
    [-1.2684380046, 2.6097574011, -0.3413193965],
    [-0.0041960863, -0.7034186147, 1.7076147010],
])


def linear_to_oklab(lin: np.ndarray) -> np.ndarray:
    """Linear Rec.709/sRGB (..., 3) -> Oklab (..., 3) = (L, a, b)."""
    lin = np.asarray(lin, dtype=np.float64)
    lms = lin @ _OKLAB_M1.T
    lms_ = np.cbrt(lms)  # np.cbrt handles negative lms correctly
    return lms_ @ _OKLAB_M2.T


def oklab_to_linear(lab: np.ndarray) -> np.ndarray:
    """Oklab (..., 3) -> linear Rec.709/sRGB (..., 3)."""
    lab = np.asarray(lab, dtype=np.float64)
    lms_ = lab @ _OKLAB_M2INV.T
    lms = lms_ ** 3
    return lms @ _OKLAB_M1INV.T


def oklab_chroma(lab: np.ndarray) -> np.ndarray:
    """Oklab chroma C = hypot(a, b)."""
    return np.hypot(lab[..., 1], lab[..., 2])


def oklab_hue_deg(lab: np.ndarray) -> np.ndarray:
    """Oklab hue h = degrees(atan2(b, a)) mod 360."""
    return np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360.0


# ---------------------------------------------------------------------------
# 5. Look toolbox
# ---------------------------------------------------------------------------

@dataclass
class Op:
    """One look-toolbox operation: a name (key into OP) plus its kwargs."""

    name: str
    kwargs: dict = field(default_factory=dict)


def gamut_clip(lin: np.ndarray) -> np.ndarray:
    """Clamp a linear-light Oklab-round-tripped colour back into gamut.

    Clamps Oklab L to [0,1]; for any pixel whose linear RGB then falls
    outside [-1e-6, 1+1e-6], finds by vectorised bisection (10 iterations)
    the largest chroma scale s in [0,1] such that Oklab (L, s*a, s*b) maps
    back inside that range, then finally clips to [0,1].
    """
    lin = np.asarray(lin, dtype=np.float64)
    lab = linear_to_oklab(lin)
    L = np.clip(lab[..., 0], 0.0, 1.0)
    a = lab[..., 1]
    b = lab[..., 2]

    lin_full = oklab_to_linear(np.stack([L, a, b], axis=-1))
    out_of_gamut = np.any((lin_full < -1e-6) | (lin_full > 1.0 + 1e-6), axis=-1)

    lo_s = np.zeros_like(L)
    hi_s = np.ones_like(L)
    for _ in range(10):
        s = 0.5 * (lo_s + hi_s)
        test = oklab_to_linear(np.stack([L, s * a, s * b], axis=-1))
        inside = np.all((test >= -1e-6) & (test <= 1.0 + 1e-6), axis=-1)
        lo_s = np.where(inside, s, lo_s)
        hi_s = np.where(inside, hi_s, s)

    s_final = np.where(out_of_gamut, lo_s, 1.0)
    lin_out = oklab_to_linear(np.stack([L, s_final * a, s_final * b], axis=-1))
    return np.clip(lin_out, 0.0, 1.0)


# --- op implementations: every one takes and returns linear RGB (...,3) ----

def _op_exposure(lin, ev=0.0):
    return lin * (2.0 ** ev)


def _op_white_balance(lin, warm=0.0, tint=0.0):
    g = np.array([1.0 + warm, 1.0 + tint, 1.0 - warm], dtype=np.float64)
    g = g / (LUMA_R * g[0] + LUMA_G * g[1] + LUMA_B * g[2])
    return lin * g


def _op_contrast(lin, amount=1.0, pivot=MIDDLE_GREY_CODE, hi=0.85, lo=0.06):
    if amount == 1.0:
        return lin
    v = pivot + (to_code(lin) - pivot) * amount
    if amount > 1.0:
        v_hi = hi + (1.0 - hi) * np.tanh((v - hi) / (1.0 - hi))
        v_lo = lo - lo * np.tanh((lo - v) / lo)
        v = np.where(v > hi, v_hi, np.where(v < lo, v_lo, v))
    return to_lin(v)


def _op_tone_curve(lin, points=((0.0, 0.0), (1.0, 1.0))):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    curve = PCHIP(xs, ys)
    return to_lin(np.clip(curve(to_code(lin)), 0.0, 1.0))


def _op_lift_blacks(lin, amount=0.0):
    code = to_code(lin)
    return to_lin(amount + code * (1.0 - amount))


def _op_toe(lin, strength=0.0, range=0.25):
    code = to_code(lin)
    u = code / range
    crushed = code - strength * code * (1.0 - u) ** 2
    return to_lin(np.where(code < range, crushed, code))


def _op_shoulder(lin, start=0.7, k=0.2):
    code = to_code(lin)
    u = (code - start) / (1.0 - start)
    rolled = start + (1.0 - start) * u / np.sqrt(1.0 + k * u * u)
    return to_lin(np.where(code > start, rolled, code))


def _op_softclip(lin, hi=0.85, lo=0.0):
    code = to_code(lin)
    out = np.where(code > hi, hi + (1.0 - hi) * np.tanh((code - hi) / (1.0 - hi)), code)
    if lo > 0.0:
        out = np.where(code < lo, lo - lo * np.tanh((lo - code) / lo), out)
    return to_lin(out)


def _op_saturation(lin, amount=1.0):
    lab = linear_to_oklab(lin).copy()
    lab[..., 1] *= amount
    lab[..., 2] *= amount
    return gamut_clip(oklab_to_linear(lab))


def _op_vibrance(lin, amount=1.0):
    lab = linear_to_oklab(lin).copy()
    C = oklab_chroma(lab)
    factor = 1.0 + (amount - 1.0) * (1.0 - np.minimum(1.0, C / 0.20))
    lab[..., 1] *= factor
    lab[..., 2] *= factor
    return gamut_clip(oklab_to_linear(lab))


def _op_density(lin, k=0.0):
    lab = linear_to_oklab(lin).copy()
    C = oklab_chroma(lab)
    lab[..., 0] = lab[..., 0] * (1.0 - k * np.minimum(1.0, C / 0.25))
    return gamut_clip(oklab_to_linear(lab))


def _op_split_tone(lin, sh_hue=0.0, sh_amt=0.0, hi_hue=0.0, hi_amt=0.0,
                    sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)):
    Yc = to_code(luma(lin))  # from the *input* lin, before this op changes it
    # Shadow weight fades to zero at black (smoothstep 0..0.08) so pure
    # black stays black and the tint ramps in smoothly instead of milking
    # the floor; also keeps the grey axis monotone under strong tints.
    w_sh = (1.0 - smoothstep(sh_range[0], sh_range[1], Yc)) * smoothstep(0.0, 0.08, Yc)
    w_hi = smoothstep(hi_range[0], hi_range[1], Yc)

    lab = linear_to_oklab(lin).copy()
    sh_rad, hi_rad = np.radians(sh_hue), np.radians(hi_hue)
    lab[..., 1] += w_sh * sh_amt * np.cos(sh_rad) + w_hi * hi_amt * np.cos(hi_rad)
    lab[..., 2] += w_sh * sh_amt * np.sin(sh_rad) + w_hi * hi_amt * np.sin(hi_rad)
    return gamut_clip(oklab_to_linear(lab))


def _op_hue_shift(lin, centre=0.0, width=30.0, shift=0.0):
    lab = linear_to_oklab(lin)
    L, C = lab[..., 0], oklab_chroma(lab)
    h = oklab_hue_deg(lab)
    h_new = h + shift * hue_window(h, centre, width)
    rad = np.radians(h_new)
    lab_new = np.stack([L, C * np.cos(rad), C * np.sin(rad)], axis=-1)
    return gamut_clip(oklab_to_linear(lab_new))


def _op_hue_sat(lin, centre=0.0, width=30.0, mult=1.0):
    lab = linear_to_oklab(lin)
    L, C = lab[..., 0], oklab_chroma(lab)
    h = oklab_hue_deg(lab)
    C_new = C * (1.0 + (mult - 1.0) * hue_window(h, centre, width))
    rad = np.radians(h)
    lab_new = np.stack([L, C_new * np.cos(rad), C_new * np.sin(rad)], axis=-1)
    return gamut_clip(oklab_to_linear(lab_new))


def _op_hue_lum(lin, centre=0.0, width=30.0, mult=1.0):
    lab = linear_to_oklab(lin).copy()
    C = oklab_chroma(lab)
    h = oklab_hue_deg(lab)
    w = hue_window(h, centre, width)
    lab[..., 0] = lab[..., 0] * (1.0 + (mult - 1.0) * w * np.minimum(1.0, C / 0.10))
    return gamut_clip(oklab_to_linear(lab))


def _op_bw_mix(lin, wr=1.0 / 3, wg=1.0 / 3, wb=1.0 / 3):
    s = wr + wg + wb
    wr, wg, wb = wr / s, wg / s, wb / s
    Y = wr * lin[..., 0] + wg * lin[..., 1] + wb * lin[..., 2]
    return np.stack([Y, Y, Y], axis=-1)


def _op_tint(lin, hue=0.0, amount=0.0):
    lab = linear_to_oklab(lin).copy()
    w = smoothstep(0.0, 0.08, lab[..., 0])
    lab[..., 1] += amount * np.cos(np.radians(hue)) * w
    lab[..., 2] += amount * np.sin(np.radians(hue)) * w
    return gamut_clip(oklab_to_linear(lab))


OP = {
    "exposure": _op_exposure,
    "white_balance": _op_white_balance,
    "contrast": _op_contrast,
    "tone_curve": _op_tone_curve,
    "lift_blacks": _op_lift_blacks,
    "toe": _op_toe,
    "shoulder": _op_shoulder,
    "softclip": _op_softclip,
    "saturation": _op_saturation,
    "vibrance": _op_vibrance,
    "density": _op_density,
    "split_tone": _op_split_tone,
    "hue_shift": _op_hue_shift,
    "hue_sat": _op_hue_sat,
    "hue_lum": _op_hue_lum,
    "bw_mix": _op_bw_mix,
    "tint": _op_tint,
}


# --- public constructors: build Op(name, kwargs) with named, documented args

def exposure(ev: float) -> Op:
    """Uniform linear-light exposure change of `ev` stops (lin *= 2**ev).

    Resolve: Primaries -> Log wheels -> Exposure slider (or the Gain wheel
    for a straight linear multiply).
    """
    return Op("exposure", {"ev": ev})


def white_balance(warm: float = 0.0, tint: float = 0.0) -> Op:
    """Luminance-normalised RGB gain: warms/cools and adds magenta/green tint.

    gains = (1+warm, 1+tint, 1-warm), then divided by their own luminance so
    the change does not brighten or darken the image overall.

    Resolve: Primaries -> Color Temp / Tint wheels (or White Balance in
    Camera Raw).
    """
    return Op("white_balance", {"warm": warm, "tint": tint})


def contrast(amount: float, pivot: float = MIDDLE_GREY_CODE, hi: float = 0.85, lo: float = 0.06) -> Op:
    """Linear contrast around `pivot` in code space; softly clips beyond
    `hi`/`lo` when amount > 1 so highlights/shadows don't hard-clip.

    Resolve: Primaries -> Contrast / Pivot (Log wheels), or Curves -> Custom
    for the soft highlight/shadow rolloff.
    """
    return Op("contrast", {"amount": amount, "pivot": pivot, "hi": hi, "lo": lo})


def tone_curve(points) -> Op:
    """Custom monotone (PCHIP) tone curve through (x, y) code-space points;
    must include x=0 and x=1.

    Resolve: Color Page -> Curves -> Custom (Luma vs Luma).
    """
    return Op("tone_curve", {"points": tuple(points)})


def lift_blacks(amount: float) -> Op:
    """Raises the shadow floor: code' = amount + code*(1-amount).

    Resolve: Primaries -> Lift wheel (raise master Lift / Black Level).
    """
    return Op("lift_blacks", {"amount": amount})


def toe(strength: float, range: float = 0.25) -> Op:
    """Crushes near-black detail below `range` (a C1, monotone toe rolloff
    for strength < 1).

    Resolve: Curves -> Custom curve, pull the lower-left anchor down/in
    toward black.
    """
    return Op("toe", {"strength": strength, "range": range})


def shoulder(start: float, k: float) -> Op:
    """Soft highlight rolloff above `start`, curvature `k` (Reinhard-style).

    Resolve: Curves -> Custom curve, pull the upper-right anchor down for a
    filmic highlight roll-off.
    """
    return Op("shoulder", {"start": start, "k": k})


def softclip(hi: float = 0.85, lo: float = 0.0) -> Op:
    """Tanh soft clip above `hi` (and, if lo > 0, mirrored below `lo`).

    Resolve: Curves -> Custom curve S-shape near black/white, or the Soft
    Clip control in the Camera Raw tab.
    """
    return Op("softclip", {"hi": hi, "lo": lo})


def saturation(amount: float) -> Op:
    """Uniform Oklab saturation: a,b *= amount.

    Resolve: Primaries -> Saturation slider (Color Boost off).
    """
    return Op("saturation", {"amount": amount})


def vibrance(amount: float) -> Op:
    """Saturation change that protects already-saturated colours (a smaller
    push on high-chroma pixels than on low-chroma ones).

    Resolve: Primaries -> Color Boost.
    """
    return Op("vibrance", {"amount": amount})


def density(k: float) -> Op:
    """Subtractive, film-print-like darkening of saturated colours (Oklab L
    reduced in proportion to chroma).

    Resolve: approximate with Primaries -> Saturation vs Gain (or a print-
    film emulation LUT/ResolveFX).
    """
    return Op("density", {"k": k})


def split_tone(sh_hue: float, sh_amt: float, hi_hue: float, hi_amt: float,
                sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)) -> Op:
    """Adds an Oklab colour cast to shadows (toward sh_hue) and highlights
    (toward hi_hue), weighted by input luma via smoothstep windows.

    Resolve: Color Page -> Primaries -> Shadow/Highlight colour wheels (a
    classic split-tone), or Color Warper Hue vs Lum.
    """
    return Op("split_tone", {
        "sh_hue": sh_hue, "sh_amt": sh_amt, "hi_hue": hi_hue, "hi_amt": hi_amt,
        "sh_range": tuple(sh_range), "hi_range": tuple(hi_range),
    })


def hue_shift(centre: float, width: float, shift: float) -> Op:
    """Rotates hue within a raised-cosine window around `centre` (+-`width`
    degrees) by up to `shift` degrees.

    Resolve: Curves -> Hue vs Hue curve.
    """
    return Op("hue_shift", {"centre": centre, "width": width, "shift": shift})


def hue_sat(centre: float, width: float, mult: float) -> Op:
    """Scales chroma within a hue window around `centre` by `mult`.

    Resolve: Curves -> Hue vs Sat curve.
    """
    return Op("hue_sat", {"centre": centre, "width": width, "mult": mult})


def hue_lum(centre: float, width: float, mult: float) -> Op:
    """Scales lightness within a hue window around `centre` by `mult`,
    weighted down for near-neutral (low-chroma) pixels.

    Resolve: Curves -> Hue vs Lum curve.
    """
    return Op("hue_lum", {"centre": centre, "width": width, "mult": mult})


def bw_mix(wr: float, wg: float, wb: float) -> Op:
    """Desaturates to a weighted grayscale mix of linear R,G,B (weights
    normalised to sum to 1), replicated across all 3 channels.

    Resolve: Color Page -> B&W adjustment layer with custom RGB Mixer
    channel weights (or the Black & White ResolveFX).
    """
    return Op("bw_mix", {"wr": wr, "wg": wg, "wb": wb})


def tint(hue: float, amount: float) -> Op:
    """Adds an Oklab colour cast toward `hue`, fading in from black via a
    smoothstep on lightness (so pure black stays untinted).

    Resolve: Primaries -> Highlight/Midtone colour wheel push toward `hue`.
    """
    return Op("tint", {"hue": hue, "amount": amount})


def apply_look(code_in: np.ndarray, ops: Sequence[Op]) -> np.ndarray:
    """Apply an ordered list of look-toolbox ops to display-referred code.

    lin = clip(code_in,0,1)**2.4; each op consumes/returns linear RGB;
    finally gamut_clip and re-encode to code. Section 5 wrapper, verbatim.
    """
    lin = to_lin(np.asarray(code_in, dtype=np.float64))
    for op in ops:
        lin = OP[op.name](lin, **op.kwargs)
    lin = gamut_clip(lin)
    return to_code(lin)
